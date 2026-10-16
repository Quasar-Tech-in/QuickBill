import { Platform, NativeModules } from 'react-native';
import axios from 'axios';
import { 
  Item, 
  Party, 
  Invoice, 
  InvoiceItem,
  CartItem, 
  StagedOrder,
  PurchaseOrder, 
  LedgerEntry, 
  DashboardStats, 
  StoreLocation, 
  ItemCategory, 
  User, 
  UserRole,
  Business, 
  Expense,
  Tenant,
  TenantSubscription,
  InventoryMovement
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
  private stagedOrders: StagedOrder[] = [];
  private users: User[] = [];
  private locations: StoreLocation[] = [];
  private expenses: Expense[] = [];
  private inventoryMovements: InventoryMovement[] = [];
  
  private activeUser: User | null = null;
  private businessProfile: Business | null = null;
  private activeLocation: StoreLocation | null = null;
  private activeTenant: Tenant | null = null;

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
    this.inventoryMovements = [];

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
    const loc = this.getActiveLocation();
    if (this.businessProfile) {
      return {
        ...this.businessProfile,
        address: this.businessProfile.address || loc?.address,
        phone: this.businessProfile.phone || loc?.phone,
        gstin: this.businessProfile.gstin || loc?.gstin,
      };
    }
    return {
      id: this.activeUser?.businessId || '',
      name: this.activeUser?.tenantName || 'QuickBill Store',
      currency: '₹',
      address: loc?.address,
      phone: loc?.phone,
      gstin: loc?.gstin,
    };
  }

  async updateBusinessProfile(updates: Partial<Business>): Promise<void> {
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

    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.gstin !== undefined) payload.gstin = updates.gstin;
      if (updates.email !== undefined) payload.admin_email = updates.email;
      if (updates.address !== undefined) payload.address = updates.address;
      if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
      if (updates.tagline !== undefined) payload.tagline = updates.tagline;
      if (updates.receiptFooterNote !== undefined) payload.receipt_footer = updates.receiptFooterNote;

      const tenantId = this.businessProfile.id || 'current';
      await apiClient.patch(`/tenants/${tenantId}`, payload);
    } catch (e) {
      console.warn('Backend tenant profile update failed:', e);
    }
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
        this.fetchLocations(),
        this.fetchBusinessProfile(),
        this.fetchInventoryMovements(),
      ]);
    } catch (e) {
      console.warn('Error during full data sync:', e);
    }
  }

  async fetchBusinessProfile(): Promise<Business | null> {
    try {
      const res = await apiClient.get('/tenants/current');
      if (res.data) {
        const t = res.data;
        const activeLoc = this.getActiveLocation();
        this.businessProfile = {
          id: t.id || t._id,
          name: t.name || this.activeUser?.tenantName || 'QuickBill Store',
          gstin: t.gstin || activeLoc?.gstin,
          phone: t.phone || activeLoc?.phone,
          email: t.admin_email || t.adminEmail || t.email,
          address: t.address || activeLoc?.address,
          currency: '₹',
          logoUrl: t.logo_url || t.logoUrl,
          tagline: t.tagline,
          receiptFooterNote: t.receipt_footer || t.receiptFooterNote || t.receiptFooter,
        };

        const sub = t.subscription;
        this.activeTenant = {
          id: t.id || t._id,
          name: t.name,
          slug: t.slug,
          plan: t.plan || sub?.plan_id || sub?.planId || 'PROFESSIONAL',
          status: t.status || sub?.status || 'ACTIVE',
          adminEmail: t.admin_email || t.adminEmail || '',
          phone: t.phone,
          gstin: t.gstin,
          address: t.address,
          logoUrl: t.logo_url || t.logoUrl,
          tagline: t.tagline,
          receiptFooterNote: t.receipt_footer || t.receiptFooterNote || t.receiptFooter,
          createdAt: t.created_at || t.createdAt || new Date().toISOString(),
          subscription: {
            planId: sub?.plan_id || sub?.planId || 'PROFESSIONAL',
            planName: sub?.plan_name || sub?.planName || 'Professional Tier',
            status: sub?.status || 'ACTIVE',
            maxUsers: sub?.max_users !== undefined ? sub.max_users : (sub?.maxUsers !== undefined ? sub.maxUsers : 3),
            maxLocations: sub?.max_locations !== undefined ? sub.max_locations : (sub?.maxLocations !== undefined ? sub.maxLocations : 3),
            billingCycle: sub?.billing_cycle || sub?.billingCycle || 'ANNUAL',
            startDate: sub?.start_date || sub?.startDate || t.created_at,
            endDate: sub?.end_date || sub?.endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
            daysRemaining: sub?.days_remaining !== undefined ? sub.days_remaining : 365,
            gracePeriodDays: sub?.grace_period_days || 7,
            pricePerCycle: sub?.price_per_cycle || 1999,
            currency: '₹',
            autoRenew: sub?.auto_renew || false,
            features: sub?.features || ['pos', 'inventory', 'ledger'],
          },
          stats: t.stats || {
            productsCount: 0,
            invoicesCount: 0,
            monthlyGmv: 0,
            usersCount: 0,
            locationsCount: 0,
          }
        };

        this.notify();
        return this.businessProfile;
      }
    } catch {
      // Graceful fallback
    }
    return null;
  }

  getActiveTenant(): Tenant | null {
    return this.activeTenant;
  }

  async fetchActiveTenant(): Promise<Tenant | null> {
    await this.fetchBusinessProfile();
    return this.activeTenant;
  }

  isStoreSuspended(): boolean {
    const t = this.activeTenant;
    if (!t) return false;
    return t.status === 'SUSPENDED' || t.subscription?.status === 'SUSPENDED';
  }

  isSubscriptionExpired(): boolean {
    const t = this.activeTenant;
    if (!t) return false;
    if (t.status === 'SUSPENDED') return false;
    const sub = t.subscription;
    if (!sub) return false;
    if (sub.status === 'EXPIRED') return true;
    const days = sub.daysRemaining ?? 365;
    const graceDays = sub.gracePeriodDays ?? 7;
    return days < -graceDays;
  }

  isStoreLocked(): boolean {
    return this.isStoreSuspended() || this.isSubscriptionExpired();
  }

  getStoreLockoutReason(): string | null {
    if (this.isStoreSuspended()) {
      return 'Store operations are suspended by platform administration.';
    }
    if (this.isSubscriptionExpired()) {
      const sub = this.activeTenant?.subscription;
      const endStr = sub?.endDate ? new Date(sub.endDate).toLocaleDateString() : 'recently';
      return `Store subscription license expired on ${endStr}.`;
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

  async adjustStock(itemId: string, adjustmentQty: number, reason?: string, unitCost?: number, notes?: string) {
    const item = this.items.find(i => i.id === itemId || i.publicItemId === itemId);
    const prevStock = item ? item.currentStock : 0;
    const newStock = Number((prevStock + adjustmentQty).toFixed(3));

    try {
      await apiClient.post(`/items/${itemId}/adjust-stock`, { 
        delta: adjustmentQty,
        reason,
        unit_cost: unitCost,
        notes
      });
    } catch (err) {
      console.warn('Stock adjustment API failed, applying locally:', err);
    }

    if (item) {
      item.currentStock = newStock;
    }

    this.recordInventoryMovement({
      itemId,
      itemName: item?.name || 'Product',
      sku: item?.sku,
      quantityChange: adjustmentQty,
      quantityBefore: prevStock,
      quantityAfter: newStock,
      resultingStock: newStock,
      unitCost: unitCost !== undefined ? unitCost : (item?.purchasePrice || 0),
      type: 'MANUAL_ADJUSTMENT',
      movementType: 'MANUAL_ADJUSTMENT',
      reason: reason || 'Manual Stock Adjustment',
      notes,
      referenceType: 'ADJUSTMENT',
    });

    this.notify();
  }

  // --- Inventory Movements Audit Ledger ---
  getInventoryMovements(): InventoryMovement[] {
    return [...this.inventoryMovements];
  }

  recordInventoryMovement(movementData: Partial<InventoryMovement>): InventoryMovement {
    const item = movementData.itemId ? this.getItemById(movementData.itemId) : undefined;
    const qtyChange = Number(movementData.quantityChange !== undefined ? movementData.quantityChange : (movementData.quantity || 0));
    const qtyBefore = Number(movementData.quantityBefore !== undefined ? movementData.quantityBefore : (item?.currentStock ?? 0));
    const qtyAfter = Number(movementData.quantityAfter !== undefined ? movementData.quantityAfter : (qtyBefore + qtyChange));
    const uCost = Number(movementData.unitCost !== undefined ? movementData.unitCost : (item?.purchasePrice ?? 0));

    const movement: InventoryMovement = {
      id: movementData.id || `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessId: movementData.businessId || this.activeUser?.businessId,
      itemId: movementData.itemId || item?.id || '',
      publicItemId: movementData.publicItemId || item?.publicItemId,
      itemName: movementData.itemName || item?.name || 'Item',
      sku: movementData.sku || item?.sku,
      locationId: movementData.locationId || this.activeLocation?.id,
      locationName: movementData.locationName || this.activeLocation?.name,
      type: movementData.type || movementData.movementType || 'MANUAL_ADJUSTMENT',
      movementType: movementData.type || movementData.movementType || 'MANUAL_ADJUSTMENT',
      referenceType: movementData.referenceType,
      referenceId: movementData.referenceId,
      referenceNumber: movementData.referenceNumber,
      quantityChange: qtyChange,
      quantityBefore: qtyBefore,
      quantityAfter: qtyAfter,
      resultingStock: qtyAfter,
      unitCost: uCost,
      totalCost: movementData.totalCost !== undefined ? movementData.totalCost : Number((Math.abs(qtyChange) * uCost).toFixed(2)),
      reason: movementData.reason,
      notes: movementData.notes,
      createdByUserId: this.activeUser?.id,
      createdByName: this.activeUser?.name || 'Staff',
      createdAt: movementData.createdAt || new Date().toISOString(),
    };

    this.inventoryMovements.unshift(movement);
    this.notify();
    return movement;
  }

  async fetchInventoryMovements(params: {
    page?: number;
    pageSize?: number;
    itemId?: string;
    locationId?: string;
    type?: string;
    search?: string;
  } = {}): Promise<InventoryMovement[]> {
    try {
      const qParams: Record<string, any> = {
        page: params.page || 1,
        page_size: params.pageSize || 100,
      };
      if (params.itemId && params.itemId !== 'ALL') qParams.item_id = params.itemId;
      if (params.locationId && params.locationId !== 'ALL') qParams.location_id = params.locationId;
      if (params.type && params.type !== 'ALL') qParams.type = params.type;
      if (params.search?.trim()) qParams.search = params.search.trim();

      const res = await apiClient.get('/inventory/movements', { params: qParams });
      const rawList = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(rawList)) {
        this.inventoryMovements = rawList.map((d: any) => ({
          id: d._id || d.id || `mov-${Date.now()}-${Math.random()}`,
          businessId: d.businessId || this.activeUser?.businessId,
          itemId: d.itemId,
          publicItemId: d.publicItemId,
          itemName: d.itemName || 'Product',
          sku: d.sku,
          locationId: d.locationId,
          locationName: d.locationName,
          type: d.type || d.movementType || 'MANUAL_ADJUSTMENT',
          movementType: d.type || d.movementType || 'MANUAL_ADJUSTMENT',
          referenceType: d.referenceType,
          referenceId: d.referenceId,
          referenceNumber: d.referenceNumber,
          quantityChange: Number(d.quantityChange !== undefined ? d.quantityChange : (d.quantityDelta || 0)),
          quantityBefore: Number(d.quantityBefore !== undefined ? d.quantityBefore : (d.previousStock || 0)),
          quantityAfter: Number(d.quantityAfter !== undefined ? d.quantityAfter : (d.newStock || 0)),
          resultingStock: Number(d.resultingStock !== undefined ? d.resultingStock : (d.quantityAfter || 0)),
          unitCost: Number(d.unitCost || 0),
          totalCost: Number(d.totalCost || 0),
          reason: d.reason,
          notes: d.notes,
          createdByUserId: d.createdByUserId,
          createdByName: d.createdByName || d.performedBy || 'Staff',
          createdAt: d.createdAt || new Date().toISOString(),
        }));
        this.notify();
        return this.inventoryMovements;
      }
    } catch (err) {
      console.warn('Could not fetch inventory movements from backend:', err);
    }
    return this.inventoryMovements;
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

  updateCartItem(
    index: number, 
    quantity: number, 
    unitPrice: number, 
    discountPercent: number = 0,
    discountType: 'PERCENT' | 'FLAT' = 'PERCENT',
    discountValue?: number
  ) {
    if (index < 0 || index >= this.cart.length) return;
    if (quantity <= 0) {
      this.cart.splice(index, 1);
    } else {
      const gross = unitPrice * quantity;
      let effectiveDiscPercent = discountPercent;
      if (discountType === 'FLAT' && discountValue !== undefined && discountValue > 0) {
        effectiveDiscPercent = gross > 0 ? (discountValue / gross) * 100 : 0;
      }
      const discAmt = (gross * effectiveDiscPercent) / 100;
      const lineTotal = Number(Math.max(0, gross - discAmt).toFixed(2));

      this.cart[index] = {
        ...this.cart[index],
        quantity: Number(quantity.toFixed(3)),
        unitPrice,
        discountPercent: Number(effectiveDiscPercent.toFixed(2)),
        discountType,
        discountValue: discountValue !== undefined ? discountValue : discountPercent,
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

  setCart(newCart: CartItem[]) {
    this.cart = [...newCart];
    this.notify();
  }

  // --- Staged / Draft Orders (Local State Accessors) ---
  resumeStagedOrder(stagedOrderId: string, keepInDrafts: boolean = false): StagedOrder | null {
    const found = this.stagedOrders.find(o => o.id === stagedOrderId);
    if (!found) return null;
    if (!keepInDrafts) {
      this.stagedOrders = this.stagedOrders.filter(o => o.id !== stagedOrderId);
    }
    this.cart = [...(found.cart || found.items || [])];
    this.notify();
    return found;
  }

  updateStagedOrderLabel(stagedOrderId: string, label: string, notes?: string): boolean {
    const idx = this.stagedOrders.findIndex(o => o.id === stagedOrderId);
    if (idx === -1) return false;
    this.stagedOrders[idx].label = label.trim() || this.stagedOrders[idx].label;
    if (notes !== undefined) {
      this.stagedOrders[idx].notes = notes;
    }
    this.stagedOrders[idx].updatedAt = new Date().toISOString();
    this.notify();
    return true;
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
        this.invoices = res.data.data.map((d: any) => {
          const items: InvoiceItem[] = Array.isArray(d.items) ? d.items.map((it: any) => {
            const qty = Number(it.quantity || 1);
            const price = Number(it.unitPrice !== undefined ? it.unitPrice : (it.unit_price || 0));
            const gross = qty * price;
            const discAmt = Number(it.discountAmount !== undefined ? it.discountAmount : (it.discount !== undefined ? it.discount : (it.discount_amount || 0)));
            const discType = it.discountType || it.discount_type || (it.discountPercent > 0 ? 'PERCENT' : 'FLAT');
            const discVal = Number(it.discountValue !== undefined ? it.discountValue : (it.discount_value !== undefined ? it.discount_value : (discType === 'PERCENT' ? (it.discountPercent || (gross > 0 ? (discAmt / gross) * 100 : 0)) : discAmt)));
            const discPct = Number(it.discountPercent !== undefined ? it.discountPercent : (it.discount_percent !== undefined ? it.discount_percent : (discType === 'PERCENT' ? discVal : (gross > 0 ? (discAmt / gross) * 100 : 0))));
            const total = Number(it.total !== undefined ? it.total : (it.lineTotal !== undefined ? it.lineTotal : (it.line_total !== undefined ? it.line_total : (gross - discAmt))));

            return {
              itemId: it.itemId || it.item_id,
              name: it.nameSnapshot || it.name_snapshot || it.name || it.itemName || 'Item',
              unit: it.unit || it.unit_snapshot || 'pcs',
              quantity: qty,
              returnedQuantity: Number(it.returnedQuantity !== undefined ? it.returnedQuantity : (it.returned_quantity || 0)),
              returnReason: it.returnReason || it.return_reason,
              returnNote: it.returnNote || it.return_note,
              returnDate: it.returnDate || it.return_date,
              returnStatus: it.returnStatus || it.return_status,
              unitPrice: price,
              discountPercent: Number(discPct.toFixed(2)),
              discountAmount: Number(discAmt.toFixed(2)),
              discountType: discType,
              discountValue: Number(discVal.toFixed(2)),
              taxRate: Number(it.taxRate !== undefined ? it.taxRate : (it.tax_rate || 0)),
              taxAmount: Number(it.taxAmount !== undefined ? it.taxAmount : (it.tax_amount || 0)),
              taxableAmount: it.taxableAmount !== undefined ? Number(it.taxableAmount) : (it.taxable_amount !== undefined ? Number(it.taxable_amount) : undefined),
              total,
              originalTotal: it.originalTotal ? Number(it.originalTotal) : Number(gross.toFixed(2)),
            };
          }) : [];

          const hasReturns = Boolean(d.hasReturns || d.has_returns || (d.returnTotal && d.returnTotal > 0) || items.some((i: InvoiceItem) => (i.returnedQuantity || 0) > 0));
          const returnTotal = d.returnTotal !== undefined ? Number(d.returnTotal) : (d.return_total !== undefined ? Number(d.return_total) : (hasReturns ? Math.max(0, (Number(d.originalGrandTotal || d.grandTotal || 0) - Number(d.grandTotal || 0))) : 0));

          return {
            id: d.id || d._id,
            invoiceNumber: d.invoiceNumber || d.invoice_number || `INV-${d.id}`,
            date: d.date || d.createdAt || new Date().toISOString(),
            partyId: d.partyId,
            partyName: d.partyName || d.consumerName,
            partyPhone: d.partyPhone || d.consumerPhone,
            consumerName: d.consumerName,
            consumerPhone: d.consumerPhone,
            billedByName: d.billedByName,
            locationId: d.locationId || d.location_id,
            locationName: d.locationName || d.location_name,
            locationAddress: d.locationAddress || d.location_address,
            locationPhone: d.locationPhone || d.location_phone,
            locationGstin: d.locationGstin || d.location_gstin,
            type: 'SALE',
            items,
            subtotal: Number(d.subtotal || 0),
            taxTotal: Number(d.taxTotal || d.tax_total || 0),
            discountTotal: Number(d.discountTotal || d.discount_total || 0),
            roundOff: Number(d.roundOff || d.round_off || 0),
            grandTotal: Number(d.grandTotal || d.grand_total || 0),
            originalGrandTotal: d.originalGrandTotal ? Number(d.originalGrandTotal) : (d.original_grand_total ? Number(d.original_grand_total) : undefined),
            hasReturns,
            returnTotal,
            returnStatus: d.returnStatus || d.return_status,
            paidAmount: Number(d.paidAmount || d.paid_amount || 0),
            balanceAmount: Number(d.balanceAmount || d.balanceDue || d.balance_due || 0),
            paymentMode: d.paymentMode || 'CASH',
            status: d.status || 'PAID',
          };
        });
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
      items: invoiceData.items.map(it => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unitPrice || 0);
        const gross = qty * price;
        let discAmount = 0;
        if (it.discountAmount !== undefined && it.discountAmount > 0) {
          discAmount = it.discountAmount;
        } else if (it.discountPercent) {
          discAmount = (gross * it.discountPercent) / 100;
        }

        return {
          item_id: it.itemId,
          quantity: qty,
          unit_price: price,
          discount: Number(discAmount.toFixed(2)),
          tax_rate: Number(it.taxRate || 0),
          discount_type: it.discountType || (it.discountPercent ? 'PERCENT' : 'FLAT'),
          discount_value: it.discountValue !== undefined ? Number(it.discountValue) : (it.discountPercent || discAmount),
          discount_percent: Number(it.discountPercent || (gross > 0 ? (discAmount / gross) * 100 : 0)),
        };
      }),
      invoiceDiscount: Number((
        invoiceData.orderDiscountAmount !== undefined 
          ? invoiceData.orderDiscountAmount 
          : (invoiceData.itemDiscountTotal !== undefined
              ? Math.max(0, Number(invoiceData.discountTotal || 0) - Number(invoiceData.itemDiscountTotal || 0))
              : Math.max(0, Number(invoiceData.discountTotal || 0) - invoiceData.items.reduce((s, it) => s + (it.discountAmount || 0), 0)))
      ).toFixed(2)),
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

    // Deduct local stock and record inventory movement
    createdInvoice.items.forEach(invItem => {
      const match = this.items.find(i => i.id === invItem.itemId || i.name === invItem.name);
      if (match) {
        const prevStock = match.currentStock;
        const newStock = Number(Math.max(0, match.currentStock - invItem.quantity).toFixed(3));
        match.currentStock = newStock;

        this.recordInventoryMovement({
          itemId: match.id,
          itemName: match.name,
          sku: match.sku,
          quantityChange: -invItem.quantity,
          quantityBefore: prevStock,
          quantityAfter: newStock,
          resultingStock: newStock,
          unitCost: match.purchasePrice,
          type: 'SALE',
          movementType: 'SALE',
          reason: `Sale Invoice #${createdInvoice.invoiceNumber}`,
          referenceType: 'INVOICE',
          referenceId: createdInvoice.id,
          referenceNumber: createdInvoice.invoiceNumber,
        });
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
      const returnTotalVal = Number(Math.max(0, origGrand - netGrand).toFixed(2));
      const newStatus = allReturned && anyReturn ? 'RETURNED' : (anyReturn ? 'PARTIALLY_RETURNED' : existing.status);

      updatedInvoice = {
        ...existing,
        items: updatedItems,
        subtotal: Number(netSubtotal.toFixed(2)),
        taxTotal: Number(netTax.toFixed(2)),
        grandTotal: netGrand,
        originalGrandTotal: existing.originalGrandTotal || origGrand,
        returnTotal: returnTotalVal,
        hasReturns: anyReturn,
        returnStatus: allReturned ? 'FULLY_RETURNED' : (anyReturn ? 'PARTIALLY_RETURNED' : 'NONE'),
        status: newStatus as any,
      };
    }

    // Restock returned items & record audit ledger
    updateData.items.forEach(up => {
      const match = this.items.find(i => i.id === up.itemId);
      if (match && up.returnedQuantity > 0 && up.returnReason !== 'DEFECTIVE_DAMAGED') {
        const prevStock = match.currentStock;
        const newStock = Number((match.currentStock + up.returnedQuantity).toFixed(3));
        match.currentStock = newStock;

        this.recordInventoryMovement({
          itemId: match.id,
          itemName: match.name,
          sku: match.sku,
          quantityChange: up.returnedQuantity,
          quantityBefore: prevStock,
          quantityAfter: newStock,
          resultingStock: newStock,
          unitCost: match.purchasePrice,
          type: 'SALE_RETURN',
          movementType: 'SALE_RETURN',
          reason: up.returnReason || 'Customer Sales Return (Restocked)',
          notes: up.returnNote,
          referenceType: 'RETURN',
          referenceId: invoiceId,
          referenceNumber: existing?.invoiceNumber,
        });
      } else if (match && up.returnedQuantity > 0 && up.returnReason === 'DEFECTIVE_DAMAGED') {
        this.recordInventoryMovement({
          itemId: match.id,
          itemName: match.name,
          sku: match.sku,
          quantityChange: 0,
          quantityBefore: match.currentStock,
          quantityAfter: match.currentStock,
          resultingStock: match.currentStock,
          unitCost: match.purchasePrice,
          type: 'DAMAGED',
          movementType: 'DAMAGED',
          reason: 'Defective / Damaged Return (Not Restocked)',
          notes: up.returnNote,
          referenceType: 'RETURN',
          referenceId: invoiceId,
          referenceNumber: existing?.invoiceNumber,
        });
      }
    });

    this.invoices = this.invoices.map(inv => inv.id === invoiceId ? updatedInvoice! : inv);
    this.notify();
    return updatedInvoice;
  }

  async recordInvoicePayment(
    invoiceId: string, 
    paymentData: { amount: number; paymentMode: string; referenceNumber?: string; notes?: string }
  ): Promise<Invoice | null> {
    const inv = this.invoices.find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) return null;

    try {
      await apiClient.post(`/sales/${inv.id}/payments`, paymentData);
    } catch (err) {
      console.warn('Backend sale payment API failed, applying locally:', err);
    }

    inv.paidAmount = Number(((inv.paidAmount || 0) + paymentData.amount).toFixed(2));
    inv.balanceAmount = Math.max(0, Number(((inv.balanceAmount || 0) - paymentData.amount).toFixed(2)));
    inv.status = inv.balanceAmount === 0 ? 'PAID' : 'PARTIAL';

    if (inv.partyId) {
      const party = this.parties.find(p => p.id === inv.partyId);
      if (party) {
        party.currentBalance = Math.max(0, Number((party.currentBalance - paymentData.amount).toFixed(2)));
      }
    }

    this.ledgerEntries.unshift({
      id: `led-inv-pay-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'PAYMENT_IN',
      title: `Invoice Payment #${inv.invoiceNumber}`,
      partyOrPayee: inv.partyName || 'Customer',
      partyId: inv.partyId,
      amount: paymentData.amount,
      paymentMode: paymentData.paymentMode,
      referenceNumber: paymentData.referenceNumber,
      category: 'Customer Dues Clearance',
    });

    this.notify();
    return inv;
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

  async updateParty(id: string, updates: Partial<Party>): Promise<Party | null> {
    const party = this.parties.find(p => p.id === id);
    if (!party) return null;

    const updatedParty: Party = {
      ...party,
      ...updates,
      id,
    };

    try {
      if (party.type === 'CUSTOMER') {
        await apiClient.put(`/customers/${id}`, updatedParty);
      } else {
        await apiClient.put(`/parties/${id}`, updatedParty);
      }
    } catch (err) {
      console.warn('Update party API failed, applying locally:', err);
    }

    const idx = this.parties.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.parties[idx] = updatedParty;
    }
    this.notify();
    return updatedParty;
  }

  async deleteParty(id: string): Promise<boolean> {
    const party = this.parties.find(p => p.id === id);
    if (!party) return false;

    try {
      if (party.type === 'CUSTOMER') {
        await apiClient.delete(`/customers/${id}`);
      } else {
        await apiClient.delete(`/parties/${id}`);
      }
    } catch (err) {
      console.warn('Delete party API failed, applying locally:', err);
    }

    this.parties = this.parties.filter(p => p.id !== id);
    this.notify();
    return true;
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
          totalReceivedAmount: Number(d.totalReceivedAmount ?? d.total_received_amount ?? 0),
          totalPaidAmount: Number(d.totalPaidAmount ?? d.total_paid_amount ?? 0),
          balanceDue: Number(d.balanceDue ?? d.balance_due ?? 0),
          paymentStatus: d.paymentStatus || d.payment_status || 'UNPAID',
          payments: Array.isArray(d.payments) ? d.payments.map((p: any) => ({
            paymentId: String(p.paymentId || p.payment_id || ''),
            amount: Number(p.amount || 0),
            paymentMode: p.paymentMode || p.payment_mode || 'BANK_TRANSFER',
            referenceNumber: p.referenceNumber || p.reference_number,
            notes: p.notes,
            paymentDate: p.paymentDate || p.payment_date || new Date().toISOString(),
            recordedBy: p.recordedBy || p.recorded_by,
          })) : [],
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

  async receivePurchaseOrder(
    poId: string, 
    options?: { 
      items?: Array<{ itemId: string; qty: number }>;
      payment?: { amount: number; paymentMode: string; referenceNumber?: string; notes?: string }; 
      notes?: string;
    }
  ) {
    const po = this.purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const itemsToReceive = options?.items && options.items.length > 0
      ? options.items.filter(i => i.qty > 0)
      : po.items.map(i => ({
          itemId: i.itemId,
          qty: Math.max(0, i.orderedQty - (i.receivedQty || 0))
        })).filter(i => i.qty > 0);

    try {
      await apiClient.post(`/purchase-orders/${poId}/receive-goods`, {
        items: itemsToReceive,
        notes: options?.notes,
        payment: options?.payment,
      });
    } catch (err) {
      console.warn('Receive PO API failed, applying locally:', err);
    }

    itemsToReceive.forEach(rec => {
      const poItem = po.items.find(i => i.itemId === rec.itemId);
      if (poItem && rec.qty > 0) {
        poItem.receivedQty = (poItem.receivedQty || 0) + rec.qty;

        const item = this.items.find(i => i.id === poItem.itemId || i.name === poItem.name);
        if (item) {
          const prevStock = item.currentStock;
          const newStock = Number((item.currentStock + rec.qty).toFixed(3));
          item.currentStock = newStock;

          this.recordInventoryMovement({
            itemId: item.id,
            itemName: item.name,
            sku: item.sku,
            quantityChange: rec.qty,
            quantityBefore: prevStock,
            quantityAfter: newStock,
            resultingStock: newStock,
            unitCost: poItem.unitPrice,
            type: 'PURCHASE',
            movementType: 'PURCHASE',
            reason: `PO #${po.poNumber} Inward (${rec.qty} ${poItem.unit || 'pcs'})`,
            referenceType: 'PURCHASE_ORDER',
            referenceId: po.id,
            referenceNumber: po.poNumber,
            notes: options?.notes,
          });
        }
      }
    });

    const totalRecVal = po.items.reduce((s, it) => {
      const q = it.receivedQty || 0;
      return s + (q * it.unitPrice * (1 + (it.taxRate || 0) / 100));
    }, 0);
    po.totalReceivedAmount = Number(totalRecVal.toFixed(2));

    const allReceived = po.items.every(i => (i.receivedQty || 0) >= i.orderedQty);
    const anyReceived = po.items.some(i => (i.receivedQty || 0) > 0);
    po.status = allReceived ? 'FULLY_RECEIVED' : (anyReceived ? 'PARTIALLY_RECEIVED' : po.status);

    if (options?.payment && options.payment.amount > 0) {
      po.totalPaidAmount = (po.totalPaidAmount || 0) + options.payment.amount;
      if (!po.payments) po.payments = [];
      po.payments.push({
        paymentId: `pmt-${Date.now()}`,
        amount: options.payment.amount,
        paymentMode: options.payment.paymentMode,
        referenceNumber: options.payment.referenceNumber,
        notes: options.payment.notes,
        paymentDate: new Date().toISOString(),
      });

      const sup = this.parties.find(p => p.id === po.supplierId);
      if (sup) {
        sup.currentBalance = (sup.currentBalance || 0) - options.payment.amount;
      }

      this.ledgerEntries.unshift({
        id: `led-po-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'PAYMENT_OUT',
        title: `PO Payment #${po.poNumber}`,
        partyOrPayee: po.supplierName || 'Supplier',
        partyId: po.supplierId,
        paymentMode: options.payment.paymentMode,
        amount: options.payment.amount,
        category: 'Purchase Order Settlement',
      });
    }

    const effectiveReceived = po.totalReceivedAmount !== undefined ? po.totalReceivedAmount : po.grandTotal;
    po.balanceDue = Math.max(0, effectiveReceived - (po.totalPaidAmount || 0));
    po.paymentStatus = po.balanceDue === 0 && effectiveReceived > 0 
      ? 'PAID' 
      : ((po.totalPaidAmount || 0) > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    this.notify();
  }

  async recordPurchaseOrderPayment(poId: string, paymentData: { amount: number; paymentMode: string; referenceNumber?: string; notes?: string }) {
    try {
      await apiClient.post(`/purchase-orders/${poId}/payments`, paymentData);
    } catch (err) {
      console.warn('Record PO payment API failed, applying locally:', err);
    }

    const po = this.purchaseOrders.find(p => p.id === poId);
    if (po) {
      po.totalPaidAmount = (po.totalPaidAmount || 0) + paymentData.amount;
      const effectiveReceived = po.totalReceivedAmount !== undefined ? po.totalReceivedAmount : po.grandTotal;
      po.balanceDue = Math.max(0, effectiveReceived - po.totalPaidAmount);
      po.paymentStatus = po.balanceDue === 0 ? 'PAID' : 'PARTIALLY_PAID';
      if (!po.payments) po.payments = [];
      po.payments.push({
        paymentId: `pmt-${Date.now()}`,
        amount: paymentData.amount,
        paymentMode: paymentData.paymentMode,
        referenceNumber: paymentData.referenceNumber,
        notes: paymentData.notes,
        paymentDate: new Date().toISOString(),
      });

      // Update supplier party balance
      const sup = this.parties.find(p => p.id === po.supplierId);
      if (sup) {
        sup.currentBalance = (sup.currentBalance || 0) - paymentData.amount;
      }

      // Add to mobile financial ledger entries stream
      this.ledgerEntries.unshift({
        id: `led-po-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'PAYMENT_OUT',
        title: po.poNumber ? `PO Payment (${po.poNumber})` : 'PO Vendor Settlement',
        partyOrPayee: po.supplierName || 'Supplier',
        partyId: po.supplierId,
        category: 'Purchase Order Settlement',
        paymentMode: paymentData.paymentMode,
        referenceNumber: paymentData.referenceNumber || po.poNumber,
        purchaseOrderId: po.id,
        purchaseOrderNumber: po.poNumber,
        referenceType: 'PURCHASE_ORDER',
        referenceId: po.id,
        notes: paymentData.notes || `Payment towards PO ${po.poNumber}`,
        amount: paymentData.amount,
      });

      this.notify();
    }
  }

  // --- Ledger & Financials ---
  getLedgerEntries(): LedgerEntry[] {
    return [...this.ledgerEntries];
  }

  async addPayment(entry: Omit<LedgerEntry, 'id' | 'date'>): Promise<LedgerEntry> {
    const newEntry: LedgerEntry = {
      ...entry,
      id: `led-${Date.now()}`,
      date: new Date().toISOString(),
    };
    this.ledgerEntries.unshift(newEntry);

    // If linked to a party, update the party's currentBalance in local store and sync with API
    if (entry.partyId) {
      const party = this.parties.find(p => p.id === entry.partyId);
      if (party) {
        if (entry.type === 'PAYMENT_IN') {
          // Customer paid money towards dues -> receivable decreases
          party.currentBalance = Number((party.currentBalance - entry.amount).toFixed(2));
        } else if (entry.type === 'PAYMENT_OUT') {
          // Supplier was paid -> payable decreases (currentBalance moves closer to 0)
          party.currentBalance = Number((party.currentBalance + entry.amount).toFixed(2));
        }
      }

      // Persist to backend
      try {
        await apiClient.post('/payments', {
          partyId: entry.partyId,
          partyName: entry.partyOrPayee,
          type: entry.type,
          amount: entry.amount,
          paymentMode: entry.paymentMode,
          referenceNumber: entry.referenceNumber,
          notes: entry.notes,
          category: entry.category,
        });
      } catch (err) {
        console.warn('Backend payment sync failed, saved locally:', err);
      }
    } else if (entry.type === 'EXPENSE') {
      try {
        await apiClient.post('/expenses', {
          category: entry.category || 'General',
          amount: entry.amount,
          payee: entry.partyOrPayee,
          paymentMode: entry.paymentMode,
          referenceNumber: entry.referenceNumber,
          description: entry.notes,
          locationId: this.getActiveLocation().id,
          expenseDate: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        console.warn('Backend expense sync failed, saved locally:', err);
      }
    }

    this.notify();
    return newEntry;
  }

  getExpenseCategories(): ItemCategory[] {
    return this.categories.filter(c => c.type === 'EXPENSE');
  }

  async fetchExpenseCategories(): Promise<ItemCategory[]> {
    try {
      const res = await apiClient.get('/categories', { params: { type: 'EXPENSE' } });
      if (res.data && Array.isArray(res.data)) {
        const expCats: ItemCategory[] = res.data.map((c: any) => ({
          id: c.id || c._id,
          businessId: c.businessId || this.activeUser?.businessId,
          name: c.name,
          type: 'EXPENSE',
          description: c.description,
        }));
        this.categories = [
          ...this.categories.filter(c => c.type !== 'EXPENSE'),
          ...expCats
        ];
        this.notify();
        return expCats;
      }
    } catch (e) {
      console.warn('Could not fetch expense categories:', e);
    }
    return this.getExpenseCategories();
  }

  async addExpenseCategory(name: string, description?: string): Promise<ItemCategory> {
    const newCat: ItemCategory = {
      id: `cat-exp-${Date.now()}`,
      businessId: this.activeUser?.businessId,
      name: name.trim(),
      type: 'EXPENSE',
      description: description?.trim(),
    };
    try {
      const res = await apiClient.post('/categories', {
        name: newCat.name,
        type: 'EXPENSE',
        description: newCat.description,
      });
      if (res.data?.id || res.data?._id) {
        newCat.id = res.data.id || res.data._id;
      }
    } catch (e) {
      console.warn('Backend add expense category failed:', e);
    }
    this.categories.push(newCat);
    this.notify();
    return newCat;
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

  async updateLocation(locationId: string, updates: Partial<StoreLocation>): Promise<StoreLocation | null> {
    const idx = this.locations.findIndex(l => l.id === locationId);
    if (idx === -1) return null;

    try {
      const res = await apiClient.put(`/locations/${locationId}`, updates);
      if (res.data) {
        const live: StoreLocation = {
          id: res.data.id || res.data._id || locationId,
          businessId: res.data.businessId || this.activeUser?.businessId || '',
          name: res.data.name || this.locations[idx].name,
          code: res.data.code || this.locations[idx].code,
          address: res.data.address !== undefined ? res.data.address : (this.locations[idx].address || ''),
          phone: res.data.phone !== undefined ? res.data.phone : (this.locations[idx].phone || ''),
          gstin: res.data.gstin !== undefined ? res.data.gstin : (this.locations[idx].gstin || ''),
          isDefault: res.data.isDefault !== undefined ? !!res.data.isDefault : !!this.locations[idx].isDefault,
          isActive: res.data.isActive !== undefined ? !!res.data.isActive : (this.locations[idx].isActive !== false),
          createdAt: res.data.createdAt || this.locations[idx].createdAt,
        };
        this.locations[idx] = live;
        if (this.activeLocation?.id === locationId) {
          this.activeLocation = live;
        }
        this.notify();
        return live;
      }
    } catch (err) {
      console.warn(`Backend /locations/${locationId} update failed, applying local update:`, err);
    }

    this.locations[idx] = { ...this.locations[idx], ...updates };
    if (this.activeLocation?.id === locationId) {
      this.activeLocation = this.locations[idx];
    }
    this.notify();
    return this.locations[idx];
  }

  async deleteLocation(locationId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/locations/${locationId}`);
    } catch (err) {
      console.warn(`Backend /locations/${locationId} delete failed:`, err);
    }

    this.locations = this.locations.filter(l => l.id !== locationId);
    if (this.activeLocation?.id === locationId) {
      this.activeLocation = this.locations[0] || null;
    }
    this.notify();
    return true;
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

  async createUser(userData: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    assignedLocationIds?: string[];
  }): Promise<User> {
    try {
      const res = await apiClient.post('/users', {
        name: userData.name,
        email: userData.email,
        password: userData.password || 'QuickBill@123',
        roles: [userData.role],
        role: userData.role,
        assignedLocationIds: userData.assignedLocationIds || [],
      });
      const newUser: User = {
        id: res.data?.id || res.data?._id || `usr-${Date.now()}`,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        businessId: this.activeUser?.businessId || '',
        assignedLocationIds: userData.assignedLocationIds || [],
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
        assignedLocationIds: userData.assignedLocationIds || [],
        isActive: true,
      };
      this.users.push(newUser);
      this.notify();
      return newUser;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const idx = this.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;

    try {
      await apiClient.put(`/users/${userId}`, updates);
    } catch (e) {
      console.warn(`Backend /users/${userId} update failed:`, e);
    }

    this.users[idx] = { ...this.users[idx], ...updates };
    this.notify();
    return this.users[idx];
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

  // --- Staged / Held Orders (Multi-Tenant & Location Scoped with Cloud DB Sync) ---
  getStagedOrders(locationId?: string): StagedOrder[] {
    const activeTenantId = this.businessProfile?.id || this.activeUser?.businessId || '';
    const targetLocId = locationId || this.activeLocation?.id;
    return this.stagedOrders.filter(order => {
      const matchTenant = !order.businessId || order.businessId === activeTenantId;
      const matchLoc = !targetLocId || targetLocId === 'ALL' || !order.locationId || order.locationId === targetLocId;
      return matchTenant && matchLoc;
    });
  }

  async fetchStagedOrders(locationId?: string): Promise<StagedOrder[]> {
    const activeTenantId = this.businessProfile?.id || this.activeUser?.businessId || '';
    const targetLocId = locationId || this.activeLocation?.id;
    try {
      const params: Record<string, string> = {};
      if (targetLocId && targetLocId !== 'ALL') {
        params.locationId = targetLocId;
      }
      const res = await apiClient.get('/staged-orders', { params });
      if (Array.isArray(res.data)) {
        const fetched: StagedOrder[] = res.data.map((d: any) => ({
          id: d._id || d.id,
          businessId: d.businessId || activeTenantId,
          locationId: d.locationId,
          locationName: d.locationName,
          label: d.label,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          partyId: d.partyId,
          cart: d.cart || [],
          orderDiscountType: d.orderDiscountType,
          orderDiscountValue: d.orderDiscountValue,
          paymentMode: d.paymentMode,
          subtotal: d.subtotal ? Number(d.subtotal) : undefined,
          taxTotal: d.taxTotal ? Number(d.taxTotal) : undefined,
          grandTotal: d.grandTotal ? Number(d.grandTotal) : undefined,
          notes: d.notes,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
        }));

        const otherOrders = this.stagedOrders.filter(o => 
          (o.businessId && o.businessId !== activeTenantId) || 
          (targetLocId && targetLocId !== 'ALL' && o.locationId && o.locationId !== targetLocId)
        );
        this.stagedOrders = [...fetched, ...otherOrders];
        this.notify();
        return this.getStagedOrders(targetLocId);
      }
    } catch (e) {
      console.warn('Could not fetch remote staged orders in mobile store:', e);
    }
    return this.getStagedOrders(targetLocId);
  }

  async stageCurrentOrder(orderData: {
    id?: string;
    label: string;
    cart: CartItem[];
    locationId?: string;
    locationName?: string;
    customerName?: string;
    customerPhone?: string;
    partyId?: string;
    selectedPartyId?: string;
    orderDiscountType?: 'PERCENT' | 'FLAT';
    orderDiscountValue?: string;
    paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER';
    subtotal?: number;
    taxTotal?: number;
    grandTotal?: number;
    notes?: string;
  }): Promise<StagedOrder> {
    const activeTenantId = this.businessProfile?.id || this.activeUser?.businessId || '';
    const locId = orderData.locationId || this.activeLocation?.id;
    const locName = orderData.locationName || this.activeLocation?.name;
    const now = new Date().toISOString();

    const existingIdx = orderData.id ? this.stagedOrders.findIndex(o => o.id === orderData.id) : -1;
    let targetOrder: StagedOrder;

    if (existingIdx >= 0) {
      targetOrder = {
        ...this.stagedOrders[existingIdx],
        ...orderData,
        partyId: orderData.partyId || orderData.selectedPartyId || this.stagedOrders[existingIdx].partyId,
        businessId: activeTenantId,
        locationId: locId,
        locationName: locName,
        updatedAt: now,
      };
      this.stagedOrders[existingIdx] = targetOrder;
    } else {
      targetOrder = {
        id: orderData.id || `stg_mob_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        businessId: activeTenantId,
        locationId: locId,
        locationName: locName,
        label: orderData.label,
        cart: orderData.cart,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        partyId: orderData.partyId || orderData.selectedPartyId,
        orderDiscountType: orderData.orderDiscountType,
        orderDiscountValue: orderData.orderDiscountValue,
        paymentMode: orderData.paymentMode,
        subtotal: orderData.subtotal,
        taxTotal: orderData.taxTotal,
        grandTotal: orderData.grandTotal,
        notes: orderData.notes,
        createdAt: now,
        updatedAt: now,
      };
      this.stagedOrders.unshift(targetOrder);
    }

    this.notify();

    try {
      const payload = {
        id: targetOrder.id,
        label: targetOrder.label,
        locationId: targetOrder.locationId,
        locationName: targetOrder.locationName,
        customerName: targetOrder.customerName,
        customerPhone: targetOrder.customerPhone,
        partyId: targetOrder.partyId,
        cart: targetOrder.cart,
        orderDiscountType: targetOrder.orderDiscountType,
        orderDiscountValue: targetOrder.orderDiscountValue,
        paymentMode: targetOrder.paymentMode,
        subtotal: targetOrder.subtotal,
        taxTotal: targetOrder.taxTotal,
        grandTotal: targetOrder.grandTotal,
        notes: targetOrder.notes,
      };

      const res = await apiClient.post('/staged-orders', payload);
      if (res.data && (res.data._id || res.data.id)) {
        const syncedId = res.data._id || res.data.id;
        if (syncedId !== targetOrder.id) {
          targetOrder.id = syncedId;
          this.notify();
        }
      }
    } catch (err) {
      console.warn('Mobile backend staged order sync failed:', err);
    }

    return targetOrder;
  }

  async deleteStagedOrder(id: string): Promise<boolean> {
    this.stagedOrders = this.stagedOrders.filter(o => o.id !== id);
    this.notify();

    try {
      await apiClient.delete(`/staged-orders/${id}`);
      return true;
    } catch (err) {
      console.warn('Mobile backend staged order delete failed:', err);
      return true;
    }
  }
}


export const store = new MobileStore();
