import { Platform, NativeModules } from 'react-native';
import axios from 'axios';
import { 
  Item, 
  Party, 
  Invoice, 
  CartItem, 
  PurchaseOrder, 
  LedgerEntry, 
  DashboardStats, 
  StoreLocation, 
  ItemCategory, 
  User, 
  Business, 
  Expense 
} from '../types';

// Auto-detect host IP from Metro bundler URL or fallback to Wi-Fi/LAN IP
const resolveDefaultBaseUrl = (): string => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1' && match[1] !== '10.0.2.2') {
        return `http://${match[1]}:8000/api/v1`;
      }
    }
  } catch {}

  return 'http://192.168.6.4:8000/api/v1';
};

let currentApiBaseUrl = resolveDefaultBaseUrl();

export const apiClient = axios.create({
  baseURL: currentApiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

class MobileStore {
  private items: Item[] = [];
  private categories: ItemCategory[] = [];
  private parties: Party[] = [];
  private invoices: Invoice[] = [];
  private purchaseOrders: PurchaseOrder[] = [];
  private ledgerEntries: LedgerEntry[] = [];
  private cart: CartItem[] = [];
  private users: User[] = [];
  private locations: StoreLocation[] = [];
  private expenses: Expense[] = [];
  
  private activeUser: User | null = null;
  private businessProfile: Business | null = null;
  private activeLocation: StoreLocation | null = null;

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // --- Server Connection Configuration ---
  getApiBaseUrl(): string {
    return currentApiBaseUrl;
  }

  setApiBaseUrl(newUrl: string): void {
    let clean = newUrl.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api/v1')) {
      if (clean.endsWith('/api')) clean = `${clean}/v1`;
      else clean = `${clean}/api/v1`;
    }
    currentApiBaseUrl = clean;
    apiClient.defaults.baseURL = clean;
    this.notify();
  }

  async testConnection(testUrl?: string): Promise<{ success: boolean; message: string }> {
    const rawTarget = (testUrl || currentApiBaseUrl).trim().replace(/\/+$/, '');
    const baseUrl = rawTarget.endsWith('/api/v1') 
      ? rawTarget.replace('/api/v1', '') 
      : (rawTarget.endsWith('/api') ? rawTarget.replace('/api', '') : rawTarget);

    try {
      const res = await axios.get(`${baseUrl}/health/live`, { timeout: 4000 });
      if (res.status === 200) {
        return { success: true, message: `Connected successfully to ${rawTarget} (Server Online)` };
      }
      return { success: false, message: `Server responded with status ${res.status}` };
    } catch (err: any) {
      try {
        const fallbackRes = await axios.get(`${rawTarget}/health`, { timeout: 3000 });
        if (fallbackRes.status === 200) {
          return { success: true, message: `Connected successfully to ${rawTarget} (Server Online)` };
        }
      } catch {}
      return { 
        success: false, 
        message: err?.message || `Could not connect to ${rawTarget}. Ensure phone is on same Wi-Fi and port 8000 is open.` 
      };
    }
  }

  // --- Auth & User Lifecycle ---
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Please provide both work email and password.' };
    }

    try {
      const res = await axios.post(`${currentApiBaseUrl}/auth/login`, {
        email: cleanEmail,
        password: password,
      }, { timeout: 8000 });

      if (res.data?.access_token) {
        const rawRole = (res.data.roles && res.data.roles[0]) || 'CASHIER';
        const userRole = (rawRole === 'SUPER_ADMIN' || rawRole === 'TENANT_ADMIN' || rawRole === 'MANAGER' || rawRole === 'CASHIER')
          ? rawRole : 'CASHIER';

        const authenticatedUser: User = {
          id: res.data.user_id,
          email: res.data.email,
          name: res.data.name || cleanEmail.split('@')[0],
          role: userRole,
          businessId: res.data.default_business_id || '',
          token: res.data.access_token,
          assignedLocationIds: res.data.assigned_location_ids || [],
          isActive: true,
        };

        this.activeUser = authenticatedUser;

        // Configure axios defaults
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${authenticatedUser.token}`;
        if (authenticatedUser.businessId) {
          apiClient.defaults.headers.common['X-Business-ID'] = authenticatedUser.businessId;
        }

        // Fetch live store context
        await this.syncAllData();

        this.notify();
        return { success: true, user: authenticatedUser };
      }

      return { success: false, error: 'Invalid authentication response from server.' };
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Login failed. Please verify credentials and server connection.';
      return { success: false, error: errMsg };
    }
  }

  logout() {
    this.activeUser = null;
    this.businessProfile = null;
    this.activeLocation = null;
    this.items = [];
    this.categories = [];
    this.parties = [];
    this.invoices = [];
    this.purchaseOrders = [];
    this.ledgerEntries = [];
    this.cart = [];

    delete apiClient.defaults.headers.common['Authorization'];
    delete apiClient.defaults.headers.common['X-Business-ID'];

    this.notify();
  }

  isAuthenticated(): boolean {
    return !!this.activeUser && !!this.activeUser.token;
  }

  getActiveUser(): User | null {
    return this.activeUser;
  }

  setActiveUser(user: User | null) {
    this.activeUser = user;
    if (user?.token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${user.token}`;
      if (user.businessId) {
        apiClient.defaults.headers.common['X-Business-ID'] = user.businessId;
      }
    }
    this.notify();
  }

  getBusinessProfile(): Business {
    return this.businessProfile || {
      id: this.activeUser?.businessId || '',
      name: this.activeUser?.tenantName || 'Store Profile',
      currency: '₹',
    };
  }

  updateBusinessProfile(updates: Partial<Business>) {
    if (this.businessProfile) {
      this.businessProfile = { ...this.businessProfile, ...updates };
    } else {
      this.businessProfile = {
        id: this.activeUser?.businessId || '',
        name: 'Store Profile',
        currency: '₹',
        ...updates
      };
    }
    this.notify();
  }

  // --- Full Data Synchronization ---
  async syncAllData() {
    try {
      await Promise.allSettled([
        this.fetchItems(),
        this.fetchCategories(),
        this.fetchParties(),
        this.fetchInvoices(),
        this.fetchPurchaseOrders(),
        this.fetchBusinessProfile(),
      ]);
    } catch (e) {
      console.warn('Error during full data sync:', e);
    }
  }

  async fetchBusinessProfile(): Promise<Business | null> {
    try {
      const res = await apiClient.get('/businesses/me');
      if (res.data) {
        this.businessProfile = {
          id: res.data.id || res.data._id,
          name: res.data.name,
          gstin: res.data.taxId || res.data.gstin,
          phone: res.data.phone,
          email: res.data.email,
          address: res.data.address?.street || res.data.address,
          currency: res.data.currency || '₹',
        };
        this.notify();
        return this.businessProfile;
      }
    } catch {
      // Graceful fallback
    }
    return null;
  }

  // --- Items & Inventory ---
  getItems(): Item[] {
    return [...this.items];
  }

  getItemById(id: string): Item | undefined {
    return this.items.find(i => i.id === id || i.publicItemId === id);
  }

  getItemByCode(code: string): Item | undefined {
    const clean = code.trim().toLowerCase();
    return this.items.find(i => 
      i.barcode?.toLowerCase() === clean || 
      i.sku?.toLowerCase() === clean || 
      i.publicItemId.toLowerCase() === clean
    );
  }

  async fetchItems(): Promise<Item[]> {
    try {
      const res = await apiClient.get('/items', { params: { page: 1, page_size: 200 } });
      if (res.data?.data && Array.isArray(res.data.data)) {
        const liveItems: Item[] = res.data.data.map((d: any) => ({
          id: d._id || d.id || d.publicItemId,
          businessId: d.businessId || this.activeUser?.businessId,
          publicItemId: d.publicItemId || d.sku || 'ITM-TEMP',
          name: d.name,
          sku: d.sku,
          barcode: d.barcode,
          category: d.category || 'General',
          taxRate: Number(d.taxRate || 0),
          unit: d.unit || 'pcs',
          description: d.description,
          mrp: d.mrp ? Number(d.mrp) : Number(d.salePrice || 0),
          salePrice: Number(d.salePrice || 0),
          purchasePrice: Number(d.purchasePrice || 0),
          currentStock: Number(d.currentStock || 0),
          minStockAlert: Number(d.minStockAlert || 5),
          hasDiscount: !!d.hasDiscount,
          discountType: d.discountType,
          discountValue: d.discountValue ? Number(d.discountValue) : undefined,
          allowParts: !!d.allowParts,
          imageUrl: d.imageUrl,
          locations: d.locations,
          batches: d.batches,
        }));
        this.items = liveItems;
        this.notify();
        return this.items;
      }
    } catch (err) {
      console.warn('Could not fetch items from backend:', err);
    }
    return this.items;
  }

  async saveItem(item: Item): Promise<Item> {
    const idx = this.items.findIndex(i => i.id === item.id || i.publicItemId === item.publicItemId);
    
    try {
      if (idx >= 0) {
        const res = await apiClient.put(`/items/${item.id}`, item);
        if (res.data) {
          item.id = res.data.id || res.data._id || item.id;
        }
      } else {
        const res = await apiClient.post('/items', item);
        if (res.data) {
          item.id = res.data.id || res.data._id || item.id;
        }
      }
    } catch (err) {
      console.warn('Item save backend sync failed, saving locally:', err);
    }

    if (idx >= 0) {
      this.items[idx] = { ...item };
    } else {
      this.items.unshift({ ...item });
    }
    this.notify();
    return item;
  }

  async adjustStock(itemId: string, adjustmentQty: number, reason?: string) {
    try {
      await apiClient.post(`/items/${itemId}/adjust-stock`, { delta: adjustmentQty });
    } catch (err) {
      console.warn('Stock adjustment API failed, applying locally:', err);
    }

    const item = this.items.find(i => i.id === itemId || i.publicItemId === itemId);
    if (item) {
      item.currentStock = Number((item.currentStock + adjustmentQty).toFixed(3));
      this.notify();
    }
  }

  // --- Categories ---
  getCategories(): ItemCategory[] {
    return [...this.categories];
  }

  async fetchCategories(): Promise<ItemCategory[]> {
    try {
      const res = await apiClient.get('/categories', { params: { type: 'PRODUCT' } });
      if (res.data && Array.isArray(res.data)) {
        this.categories = res.data.map((c: any) => ({
          id: c.id || c._id,
          businessId: c.businessId || this.activeUser?.businessId,
          name: c.name,
          type: 'PRODUCT',
          description: c.description,
        }));
        this.notify();
        return this.categories;
      }
    } catch (err) {
      console.warn('Could not fetch categories from backend:', err);
    }
    return this.categories;
  }

  async addCategory(category: ItemCategory): Promise<ItemCategory> {
    try {
      const res = await apiClient.post('/categories', {
        name: category.name,
        type: 'PRODUCT',
        description: category.description,
      });
      if (res.data) {
        category.id = res.data.id || res.data._id || category.id;
      }
    } catch (err) {
      console.warn('Add category backend failed:', err);
    }

    this.categories.push(category);
    this.notify();
    return category;
  }

  // --- Cart Management ---
  getCart(): CartItem[] {
    return [...this.cart];
  }

  addToCart(item: Item, quantity: number = 1) {
    const existingIdx = this.cart.findIndex(c => c.item.id === item.id);
    if (existingIdx >= 0) {
      const existing = this.cart[existingIdx];
      const newQty = Number((existing.quantity + quantity).toFixed(3));
      this.updateCartItem(existingIdx, newQty, existing.unitPrice, existing.discountPercent);
    } else {
      const unitPrice = item.salePrice;
      const discountPercent = item.hasDiscount && item.discountType === 'PERCENT' ? (item.discountValue || 0) : 0;
      const effectivePrice = unitPrice * (1 - discountPercent / 100);
      const lineTotal = Number((effectivePrice * quantity).toFixed(2));

      this.cart.push({
        item,
        quantity,
        unitPrice,
        discountPercent,
        taxRate: item.taxRate,
        lineTotal,
        allowParts: item.allowParts,
      });
      this.notify();
    }
  }

  updateCartItem(index: number, quantity: number, unitPrice: number, discountPercent: number = 0) {
    if (index < 0 || index >= this.cart.length) return;
    if (quantity <= 0) {
      this.cart.splice(index, 1);
    } else {
      const effectivePrice = unitPrice * (1 - discountPercent / 100);
      const lineTotal = Number((effectivePrice * quantity).toFixed(2));

      this.cart[index] = {
        ...this.cart[index],
        quantity: Number(quantity.toFixed(3)),
        unitPrice,
        discountPercent,
        lineTotal,
      };
    }
    this.notify();
  }

  removeFromCart(index: number) {
    if (index >= 0 && index < this.cart.length) {
      this.cart.splice(index, 1);
      this.notify();
    }
  }

  clearCart() {
    this.cart = [];
    this.notify();
  }

  // --- Invoices & Sales ---
  getInvoices(): Invoice[] {
    return [...this.invoices];
  }

  getInvoiceById(id: string): Invoice | undefined {
    return this.invoices.find(inv => inv.id === id || inv.invoiceNumber === id);
  }

  async fetchInvoices(): Promise<Invoice[]> {
    try {
      const res = await apiClient.get('/sales', { params: { page: 1, page_size: 50 } });
      if (res.data?.data && Array.isArray(res.data.data)) {
        this.invoices = res.data.data.map((d: any) => ({
          id: d.id || d._id,
          invoiceNumber: d.invoiceNumber || d.invoice_number || `INV-${d.id}`,
          date: d.date || d.createdAt || new Date().toISOString(),
          partyId: d.partyId,
          partyName: d.partyName || d.consumerName,
          partyPhone: d.partyPhone || d.consumerPhone,
          consumerName: d.consumerName,
          consumerPhone: d.consumerPhone,
          billedByName: d.billedByName,
          type: 'SALE',
          items: Array.isArray(d.items) ? d.items.map((it: any) => ({
            itemId: it.itemId || it.item_id,
            name: it.name || it.itemName || 'Item',
            unit: it.unit || 'pcs',
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || it.unit_price || 0),
            discountPercent: Number(it.discountPercent || 0),
            taxRate: Number(it.taxRate || it.tax_rate || 0),
            taxAmount: Number(it.taxAmount || it.tax_amount || 0),
            total: Number(it.total || 0),
          })) : [],
          subtotal: Number(d.subtotal || 0),
          taxTotal: Number(d.taxTotal || d.tax_total || 0),
          discountTotal: Number(d.discountTotal || d.discount_total || 0),
          roundOff: Number(d.roundOff || d.round_off || 0),
          grandTotal: Number(d.grandTotal || d.grand_total || 0),
          paidAmount: Number(d.paidAmount || d.paid_amount || 0),
          balanceAmount: Number(d.balanceAmount || d.balanceDue || d.balance_due || 0),
          paymentMode: d.paymentMode || 'CASH',
          status: d.status || 'PAID',
        }));
        this.notify();
        return this.invoices;
      }
    } catch (err) {
      console.warn('Could not fetch invoices from backend:', err);
    }
    return this.invoices;
  }

  async createInvoice(invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'date'>): Promise<Invoice> {
    const payload = {
      partyId: invoiceData.partyId || undefined,
      partyNameInput: invoiceData.partyName,
      partyPhoneInput: invoiceData.partyPhone,
      consumerName: invoiceData.consumerName || invoiceData.partyName,
      consumerPhone: invoiceData.consumerPhone || invoiceData.partyPhone,
      billedById: this.activeUser?.id,
      billedByName: this.activeUser?.name || 'Mobile Cashier',
      billedByRole: this.activeUser?.role || 'CASHIER',
      items: invoiceData.items.map(it => ({
        item_id: it.itemId,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        discount: it.discountPercent ? ((it.unitPrice * it.quantity) * (it.discountPercent / 100)) : 0,
        tax_rate: it.taxRate,
      })),
      invoiceDiscount: Number(invoiceData.discountTotal || 0),
      paidAmount: Number(invoiceData.paidAmount),
      paymentMode: invoiceData.paymentMode || 'CASH',
      enableRoundOff: invoiceData.roundOff !== 0,
    };

    let createdInvoice: Invoice;

    try {
      const res = await apiClient.post('/sales', payload);
      if (res.data) {
        const d = res.data;
        createdInvoice = {
          ...invoiceData,
          id: d.id || d._id || `inv-${Date.now()}`,
          invoiceNumber: d.invoiceNumber || d.invoice_number || `INV-${Date.now()}`,
          date: d.date || d.createdAt || new Date().toISOString(),
        };
      } else {
        throw new Error('No data from server');
      }
    } catch (err) {
      console.warn('Backend sale creation failed, saving locally:', err);
      const invCount = this.invoices.length + 1;
      createdInvoice = {
        ...invoiceData,
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(invCount).padStart(5, '0')}`,
        date: new Date().toISOString(),
      };
    }

    // Deduct local stock
    createdInvoice.items.forEach(invItem => {
      const match = this.items.find(i => i.id === invItem.itemId || i.name === invItem.name);
      if (match) {
        match.currentStock = Number(Math.max(0, match.currentStock - invItem.quantity).toFixed(3));
      }
    });

    // Record ledger entry
    this.ledgerEntries.unshift({
      id: `led-${Date.now()}`,
      date: createdInvoice.date,
      type: 'PAYMENT_IN',
      title: `Sale Receipt #${createdInvoice.invoiceNumber}`,
      partyOrPayee: createdInvoice.partyName || 'Counter Customer',
      paymentMode: createdInvoice.paymentMode,
      amount: createdInvoice.paidAmount,
    });

    // Update customer stats
    if (createdInvoice.partyId) {
      const party = this.parties.find(p => p.id === createdInvoice.partyId);
      if (party) {
        party.totalSpent = (party.totalSpent || 0) + createdInvoice.grandTotal;
        party.totalVisits = (party.totalVisits || 0) + 1;
        party.currentBalance += createdInvoice.balanceAmount;
      }
    }

    this.invoices.unshift(createdInvoice);
    this.clearCart();
    this.notify();
    return createdInvoice;
  }

  async updateInvoiceWithReturn(
    invoiceId: string,
    updateData: {
      items: Array<{
        itemId: string;
        quantity: number;
        returnedQuantity: number;
        returnReason?: string;
        returnNote?: string;
        unitPrice?: number;
        taxRate?: number;
        discount?: number;
      }>;
      notes?: string;
      returnNotes?: string;
      paymentMode?: string;
    }
  ): Promise<Invoice> {
    const existing = this.invoices.find(i => i.id === invoiceId);
    let updatedInvoice: Invoice | null = null;

    try {
      const payload = {
        items: updateData.items.map(it => ({
          itemId: it.itemId,
          quantity: it.quantity,
          returnedQuantity: it.returnedQuantity,
          returnReason: it.returnReason,
          returnNote: it.returnNote,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          discount: it.discount,
        })),
        notes: updateData.notes,
        returnNotes: updateData.returnNotes,
        paymentMode: updateData.paymentMode,
      };

      const res = await apiClient.put(`/sales/${invoiceId}`, payload);
      if (res.data) {
        const d = res.data;
        updatedInvoice = {
          ...(existing || {}),
          id: d.id || d._id || invoiceId,
          invoiceNumber: d.invoiceNumber || d.invoice_number || existing?.invoiceNumber || '',
          businessId: d.businessId || existing?.businessId || '',
          date: d.date || d.createdAt || existing?.date || new Date().toISOString(),
          partyId: d.partyId || existing?.partyId,
          partyName: d.partyNameSnapshot || d.party_name_snapshot || existing?.partyName || '',
          partyPhone: d.partyPhoneSnapshot || d.party_phone_snapshot || existing?.partyPhone,
          items: d.items || existing?.items || [],
          subtotal: Number(d.subtotal || 0),
          taxTotal: Number(d.taxTotal ?? d.tax_total ?? 0),
          discountTotal: Number(d.discountTotal ?? d.discount_total ?? 0),
          grandTotal: Number(d.grandTotal ?? d.grand_total ?? 0),
          paidAmount: Number(d.paidAmount ?? d.paid_amount ?? 0),
          balanceAmount: Number(d.balanceDue ?? d.balance_due ?? 0),
          paymentMode: d.paymentMode || existing?.paymentMode || 'CASH',
          status: d.status || existing?.status || 'CONFIRMED',
          notes: d.notes || existing?.notes,
        } as Invoice;
      }
    } catch (err) {
      console.warn('Backend PUT /sales/{id} failed in mobile store, calculating locally:', err);
    }

    if (!updatedInvoice) {
      if (!existing) throw new Error('Invoice not found');
      
      const origGrand = existing.grandTotal;
      let netSubtotal = 0;
      let netTax = 0;
      let anyReturn = false;
      let allReturned = true;

      const updatedItems = existing.items.map(item => {
        const up = updateData.items.find(u => u.itemId === item.itemId);
        const retQty = up ? up.returnedQuantity : 0;
        const activeQty = Math.max(0, item.quantity - retQty);

        if (retQty > 0) anyReturn = true;
        if (activeQty > 0) allReturned = false;

        const lineGross = activeQty * item.unitPrice;
        const lineDisc = item.discountPercent ? (lineGross * (item.discountPercent / 100)) : 0;
        const netLineInclusive = Math.max(0, lineGross - lineDisc);
        const lineTaxable = item.taxRate > 0 ? (netLineInclusive * 100 / (100 + item.taxRate)) : netLineInclusive;
        const lineTax = netLineInclusive - lineTaxable;
        const lineTotal = netLineInclusive;

        netSubtotal += lineTaxable;
        netTax += lineTax;

        return {
          ...item,
          quantity: item.quantity,
          returnedQuantity: retQty,
          returnReason: up?.returnReason as any,
          returnNote: up?.returnNote,
          total: Number(lineTotal.toFixed(2)),
        };
      });

      const netGrand = Number((netSubtotal + netTax).toFixed(2));
      const newStatus = allReturned && anyReturn ? 'RETURNED' : (anyReturn ? 'PARTIALLY_RETURNED' : existing.status);

      updatedInvoice = {
        ...existing,
        items: updatedItems,
        subtotal: Number(netSubtotal.toFixed(2)),
        taxTotal: Number(netTax.toFixed(2)),
        grandTotal: netGrand,
        status: newStatus as any,
      };
    }

    // Restock returned items
    updateData.items.forEach(up => {
      const match = this.items.find(i => i.id === up.itemId);
      if (match && up.returnedQuantity > 0 && up.returnReason !== 'DEFECTIVE_DAMAGED') {
        match.currentStock = Number((match.currentStock + up.returnedQuantity).toFixed(3));
      }
    });

    this.invoices = this.invoices.map(inv => inv.id === invoiceId ? updatedInvoice! : inv);
    this.notify();
    return updatedInvoice;
  }

  // --- Parties ---
  getParties(): Party[] {
    return [...this.parties];
  }

  getCustomers(): Party[] {
    return this.parties.filter(p => p.type === 'CUSTOMER');
  }

  getSuppliers(): Party[] {
    return this.parties.filter(p => p.type === 'SUPPLIER');
  }

  async fetchParties(): Promise<Party[]> {
    try {
      const [custRes, partyRes] = await Promise.allSettled([
        apiClient.get('/customers', { params: { page_size: 100 } }),
        apiClient.get('/parties', { params: { page_size: 100 } })
      ]);

      const fetchedList: Party[] = [];

      if (custRes.status === 'fulfilled' && custRes.value.data?.data) {
        custRes.value.data.data.forEach((c: any) => {
          fetchedList.push({
            id: c.id || c._id,
            businessId: c.businessId || this.activeUser?.businessId,
            name: c.name,
            type: 'CUSTOMER',
            phone: c.phone || undefined,
            email: c.email || undefined,
            address: c.address || undefined,
            gstin: c.gstin || undefined,
            currentBalance: Number(c.currentBalance || 0),
          });
        });
      }

      if (partyRes.status === 'fulfilled' && partyRes.value.data?.data) {
        partyRes.value.data.data.forEach((p: any) => {
          const pId = p.id || p._id;
          if (!fetchedList.some(x => x.id === pId)) {
            fetchedList.push({
              id: pId,
              businessId: p.businessId || this.activeUser?.businessId,
              name: p.name,
              type: Array.isArray(p.type) ? (p.type.includes('supplier') ? 'SUPPLIER' : 'CUSTOMER') : (p.type || 'CUSTOMER'),
              phone: p.phone || undefined,
              email: p.email || undefined,
              address: p.billingAddress?.street || p.address || undefined,
              gstin: p.taxId || p.gstin || undefined,
              currentBalance: Number(p.currentReceivable || p.currentBalance || 0),
            });
          }
        });
      }

      if (custRes.status === 'fulfilled' || partyRes.status === 'fulfilled') {
        this.parties = fetchedList;
        this.notify();
      }
    } catch (err) {
      console.warn('Could not fetch parties from backend:', err);
    }
    return this.parties;
  }

  async saveParty(party: Party): Promise<Party> {
    const idx = this.parties.findIndex(p => p.id === party.id);
    
    try {
      if (party.type === 'CUSTOMER') {
        if (idx >= 0 && !party.id.startsWith('pty_')) {
          await apiClient.put(`/customers/${party.id}`, party);
        } else {
          const res = await apiClient.post('/customers', party);
          if (res.data) {
            party.id = res.data.id || res.data._id || party.id;
          }
        }
      } else {
        if (idx >= 0 && !party.id.startsWith('pty_')) {
          await apiClient.put(`/parties/${party.id}`, party);
        } else {
          const res = await apiClient.post('/parties', party);
          if (res.data) {
            party.id = res.data.id || res.data._id || party.id;
          }
        }
      }
    } catch (err) {
      console.warn('Party backend sync failed, saving locally:', err);
    }

    if (idx >= 0) {
      this.parties[idx] = { ...party };
    } else {
      this.parties.unshift({ ...party });
    }
    this.notify();
    return party;
  }

  // --- Purchase Orders ---
  getPurchaseOrders(): PurchaseOrder[] {
    return [...this.purchaseOrders];
  }

  async fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
      const res = await apiClient.get('/purchase-orders', { params: { page: 1, page_size: 50 } });
      if (res.data?.data && Array.isArray(res.data.data)) {
        this.purchaseOrders = res.data.data.map((d: any) => ({
          id: String(d.id || d._id),
          poNumber: d.poNumber || d.po_number || '',
          businessId: String(d.businessId || d.business_id || ''),
          supplierId: String(d.supplierId || d.supplier_id || ''),
          supplierName: d.supplierName || d.supplier_name || '',
          supplierPhone: d.supplierPhone || d.supplier_phone,
          supplierGstin: d.supplierGstin || d.supplier_gstin,
          orderDate: d.orderDate || d.order_date || d.createdAt,
          expectedDeliveryDate: d.expectedDeliveryDate || d.expected_delivery_date,
          status: d.status || 'ORDERED',
          items: Array.isArray(d.items || d.orderItems) ? (d.items || d.orderItems).map((it: any) => ({
            itemId: String(it.itemId || it.item_id || ''),
            name: it.name || it.itemName || 'Item',
            unit: it.unit || 'pcs',
            orderedQty: Number(it.orderedQty ?? it.ordered_qty ?? it.quantity ?? 0),
            receivedQty: Number(it.receivedQty ?? it.received_qty ?? 0),
            unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
            taxRate: Number(it.taxRate ?? it.tax_rate ?? 0),
            taxAmount: Number(it.taxAmount ?? it.tax_amount ?? 0),
            totalAmount: Number(it.totalAmount ?? it.total_amount ?? 0),
          })) : [],
          subtotal: Number(d.subtotal || 0),
          taxTotal: Number(d.taxTotal ?? d.tax_total ?? 0),
          grandTotal: Number(d.grandTotal ?? d.grand_total ?? 0),
          notes: d.notes,
          createdAt: d.createdAt || new Date().toISOString(),
        }));
        this.notify();
        return this.purchaseOrders;
      }
    } catch (err) {
      console.warn('Could not fetch purchase orders from backend:', err);
    }
    return this.purchaseOrders;
  }

  async createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt'>): Promise<PurchaseOrder> {
    let newPO: PurchaseOrder;
    try {
      const res = await apiClient.post('/purchase-orders', po);
      if (res.data) {
        newPO = {
          ...po,
          id: res.data.id || res.data._id,
          poNumber: res.data.poNumber || res.data.po_number,
          createdAt: res.data.createdAt || new Date().toISOString(),
        };
      } else {
        throw new Error('No data');
      }
    } catch (err) {
      console.warn('Purchase order API failed, saving locally:', err);
      const poNumber = `PO-${new Date().getFullYear()}-${String(this.purchaseOrders.length + 1).padStart(4, '0')}`;
      newPO = {
        ...po,
        id: `po-${Date.now()}`,
        poNumber,
        createdAt: new Date().toISOString(),
      };
    }

    this.purchaseOrders.unshift(newPO);
    this.notify();
    return newPO;
  }

  async receivePurchaseOrder(poId: string) {
    try {
      await apiClient.post(`/purchase-orders/${poId}/receive-goods`, {
        receipts: this.purchaseOrders.find(p => p.id === poId)?.items.map(i => ({
          itemId: i.itemId,
          qty: i.orderedQty - (i.receivedQty || 0)
        })) || []
      });
    } catch (err) {
      console.warn('Receive PO API failed, applying locally:', err);
    }

    const po = this.purchaseOrders.find(p => p.id === poId);
    if (po && po.status !== 'RECEIVED' && po.status !== 'FULLY_RECEIVED') {
      po.status = 'RECEIVED';
      po.items.forEach(poItem => {
        poItem.receivedQty = poItem.orderedQty;
        const item = this.items.find(i => i.id === poItem.itemId || i.name === poItem.name);
        if (item) {
          item.currentStock = Number((item.currentStock + poItem.orderedQty).toFixed(3));
        }
      });
      this.notify();
    }
  }

  // --- Ledger & Financials ---
  getLedgerEntries(): LedgerEntry[] {
    return [...this.ledgerEntries];
  }

  addPayment(entry: Omit<LedgerEntry, 'id' | 'date'>) {
    this.ledgerEntries.unshift({
      ...entry,
      id: `led-${Date.now()}`,
      date: new Date().toISOString(),
    });
    this.notify();
  }

  // --- Dashboard Stats ---
  getDashboardStats(): DashboardStats {
    const todaySales = this.invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    const todayTransactionsCount = this.invoices.length;
    const totalReceivables = this.parties.filter(p => p.currentBalance > 0).reduce((acc, p) => acc + p.currentBalance, 0);
    const totalPayables = Math.abs(this.parties.filter(p => p.currentBalance < 0).reduce((acc, p) => acc + p.currentBalance, 0));
    const lowStockCount = this.items.filter(i => i.currentStock <= i.minStockAlert).length;
    const netProfit = Number((todaySales * 0.28).toFixed(2));

    return {
      todaySales,
      todayTransactionsCount,
      totalReceivables,
      totalPayables,
      lowStockCount,
      netProfit,
    };
  }

  // --- Locations & Branches ---
  getLocations(): StoreLocation[] {
    return [...this.locations];
  }

  getActiveLocation(): StoreLocation {
    if (this.activeLocation) return this.activeLocation;
    if (this.locations.length > 0) return this.locations[0];
    return {
      id: 'loc-main',
      businessId: this.activeUser?.businessId || '',
      name: 'Main Flagship Counter',
      code: 'MAIN-01',
      isActive: true,
      isDefault: true,
    };
  }

  setActiveLocation(loc: StoreLocation) {
    this.activeLocation = loc;
    this.notify();
  }

  async fetchLocations(): Promise<StoreLocation[]> {
    try {
      const res = await apiClient.get('/locations');
      if (res.data && Array.isArray(res.data)) {
        this.locations = res.data.map((l: any) => ({
          id: l.id || l._id,
          businessId: l.businessId || this.activeUser?.businessId || '',
          name: l.name,
          code: l.code || '',
          address: l.address,
          phone: l.phone,
          gstin: l.gstin,
          isDefault: !!l.isDefault,
          isActive: l.isActive !== false,
        }));
        if (!this.activeLocation && this.locations.length > 0) {
          this.activeLocation = this.locations[0];
        }
        this.notify();
      }
    } catch (e) {
      console.warn('Could not fetch locations:', e);
    }
    return this.locations;
  }

  async createLocation(location: Omit<StoreLocation, 'id' | 'businessId'>): Promise<StoreLocation> {
    try {
      const res = await apiClient.post('/locations', location);
      const newLoc: StoreLocation = {
        ...location,
        id: res.data?.id || res.data?._id || `loc-${Date.now()}`,
        businessId: this.activeUser?.businessId || '',
      };
      this.locations.push(newLoc);
      this.notify();
      return newLoc;
    } catch (e) {
      const newLoc: StoreLocation = {
        ...location,
        id: `loc-${Date.now()}`,
        businessId: this.activeUser?.businessId || '',
      };
      this.locations.push(newLoc);
      this.notify();
      return newLoc;
    }
  }

  // --- Staff & User Management ---
  getUsers(): User[] {
    return [...this.users];
  }

  async fetchUsers(): Promise<User[]> {
    try {
      const res = await apiClient.get('/users');
      if (res.data && Array.isArray(res.data)) {
        this.users = res.data.map((u: any) => ({
          id: u.id || u._id,
          email: u.email,
          name: u.name,
          role: (u.roles && u.roles[0]) || u.role || 'CASHIER',
          businessId: u.businessId || u.tenantId || this.activeUser?.businessId || '',
          isActive: u.isActive !== false,
          assignedLocationIds: u.assignedLocationIds || [],
        }));
        this.notify();
      }
    } catch (e) {
      console.warn('Could not fetch users:', e);
    }
    return this.users;
  }

  async createUser(userData: { name: string; email: string; password?: string; role: 'MANAGER' | 'CASHIER' }): Promise<User> {
    try {
      const res = await apiClient.post('/users', {
        name: userData.name,
        email: userData.email,
        password: userData.password || 'QuickBill@123',
        roles: [userData.role],
      });
      const newUser: User = {
        id: res.data?.id || res.data?._id || `usr-${Date.now()}`,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        businessId: this.activeUser?.businessId || '',
        isActive: true,
      };
      this.users.push(newUser);
      this.notify();
      return newUser;
    } catch (e) {
      const newUser: User = {
        id: `usr-${Date.now()}`,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        businessId: this.activeUser?.businessId || '',
        isActive: true,
      };
      this.users.push(newUser);
      this.notify();
      return newUser;
    }
  }

  async deleteUser(userId: string) {
    try {
      await apiClient.delete(`/users/${userId}`);
    } catch (e) {
      console.warn('Delete user backend failed:', e);
    }
    this.users = this.users.filter(u => u.id !== userId);
    this.notify();
  }

  // --- Expenses & Vouchers ---
  getExpenses(): Expense[] {
    return [...this.expenses];
  }

  async fetchExpenses(): Promise<Expense[]> {
    try {
      const res = await apiClient.get('/expenses', { params: { page: 1, page_size: 50 } });
      if (res.data?.data && Array.isArray(res.data.data)) {
        this.expenses = res.data.data.map((e: any) => ({
          id: e.id || e._id,
          businessId: e.businessId || this.activeUser?.businessId,
          category: e.category || 'General',
          amount: Number(e.amount || 0),
          payee: e.payee,
          paymentMode: e.paymentMode || 'CASH',
          referenceNumber: e.referenceNumber,
          description: e.description,
          expenseDate: e.expenseDate || e.createdAt || new Date().toISOString(),
        }));
        this.notify();
      }
    } catch (e) {
      console.warn('Could not fetch expenses:', e);
    }
    return this.expenses;
  }

  async createExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    let newExp: Expense;
    try {
      const res = await apiClient.post('/expenses', expense);
      newExp = {
        ...expense,
        id: res.data?.id || res.data?._id || `exp-${Date.now()}`,
      };
    } catch (e) {
      newExp = {
        ...expense,
        id: `exp-${Date.now()}`,
      };
    }
    this.expenses.unshift(newExp);
    this.ledgerEntries.unshift({
      id: `led-${Date.now()}`,
      date: newExp.expenseDate,
      type: 'EXPENSE',
      title: `Expense: ${newExp.category}`,
      partyOrPayee: newExp.payee || 'Expense Payee',
      category: newExp.category,
      paymentMode: newExp.paymentMode,
      referenceNumber: newExp.referenceNumber,
      amount: newExp.amount,
    });
    this.notify();
    return newExp;
  }

  async deleteItem(itemId: string) {
    try {
      await apiClient.delete(`/items/${itemId}`);
    } catch (e) {
      console.warn('Delete item backend failed:', e);
    }
    this.items = this.items.filter(i => i.id !== itemId && i.publicItemId !== itemId);
    this.notify();
  }

  async deleteCategory(categoryId: string) {
    try {
      await apiClient.delete(`/categories/${categoryId}`);
    } catch (e) {
      console.warn('Delete category backend failed:', e);
    }
    this.categories = this.categories.filter(c => c.id !== categoryId);
    this.notify();
  }
}

export const store = new MobileStore();
