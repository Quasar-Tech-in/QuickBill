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

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const DEFAULT_CATEGORIES: ItemCategory[] = [
  { id: 'cat-01', name: 'Grocery', description: 'Packaged foods, staples, pulses & grains' },
  { id: 'cat-02', name: 'Dairy & Eggs', description: 'Milk, cheese, butter, curd and farm eggs' },
  { id: 'cat-03', name: 'Beverages', description: 'Juices, cold drinks, tea, coffee & energy drinks' },
  { id: 'cat-04', name: 'Snacks & Sweets', description: 'Biscuits, chips, namkeen, chocolates & bakery' },
  { id: 'cat-05', name: 'Personal Care', description: 'Soaps, haircare, skincare, oral care & grooming' },
  { id: 'cat-06', name: 'Electronics & Gadgets', description: 'Cables, chargers, peripherals, accessories & batteries' },
  { id: 'cat-07', name: 'General Store', description: 'General merchandise & assorted counter items' },
];

const DEFAULT_ITEMS: Item[] = [
  {
    id: 'itm-001',
    publicItemId: 'ITM-1001',
    name: 'Basmati Rice Premium Royal (Loose/Pack)',
    sku: 'RICE-BAS-01',
    barcode: '8901030381001',
    category: 'Grocery',
    taxRate: 5.0,
    unit: 'kg',
    mrp: 140.0,
    salePrice: 120.0,
    purchasePrice: 95.0,
    currentStock: 85.5,
    minStockAlert: 20.0,
    allowParts: true,
  },
  {
    id: 'itm-002',
    publicItemId: 'ITM-1002',
    name: 'Refined Sunflower Oil (1L Pouch)',
    sku: 'OIL-SUN-01',
    barcode: '8901030381002',
    category: 'Grocery',
    taxRate: 5.0,
    unit: 'ltr',
    mrp: 160.0,
    salePrice: 145.0,
    purchasePrice: 125.0,
    currentStock: 42.0,
    minStockAlert: 15.0,
    allowParts: true,
  },
  {
    id: 'itm-003',
    publicItemId: 'ITM-1003',
    name: 'Wireless Ergonomic Optical Mouse',
    sku: 'ELEC-MOU-01',
    barcode: '8901030381003',
    category: 'Electronics & Gadgets',
    taxRate: 18.0,
    unit: 'pcs',
    mrp: 699.0,
    salePrice: 499.0,
    purchasePrice: 320.0,
    currentStock: 18,
    minStockAlert: 5,
    allowParts: false,
  },
  {
    id: 'itm-004',
    publicItemId: 'ITM-1004',
    name: 'USB-C Fast Charging Braided Cable (1.5m)',
    sku: 'ELEC-CAB-01',
    barcode: '8901030381004',
    category: 'Electronics & Gadgets',
    taxRate: 18.0,
    unit: 'pcs',
    mrp: 399.0,
    salePrice: 249.0,
    purchasePrice: 130.0,
    currentStock: 35,
    minStockAlert: 10,
    allowParts: false,
  },
  {
    id: 'itm-005',
    publicItemId: 'ITM-1005',
    name: 'Dairy Milk Silk Chocolate (150g)',
    sku: 'SNK-CHOC-01',
    barcode: '8901030381005',
    category: 'Snacks & Sweets',
    taxRate: 12.0,
    unit: 'pcs',
    mrp: 100.0,
    salePrice: 90.0,
    purchasePrice: 72.0,
    currentStock: 4,
    minStockAlert: 10,
    allowParts: false,
  },
  {
    id: 'itm-006',
    publicItemId: 'ITM-1006',
    name: 'Organic Himalayan Green Tea (25 Bags)',
    sku: 'BEV-TEA-01',
    barcode: '8901030381006',
    category: 'Beverages',
    taxRate: 5.0,
    unit: 'box',
    mrp: 210.0,
    salePrice: 185.0,
    purchasePrice: 140.0,
    currentStock: 22,
    minStockAlert: 8,
    allowParts: false,
  },
];

const DEFAULT_PARTIES: Party[] = [
  {
    id: 'pty-001',
    name: 'Aarav Sharma',
    type: 'CUSTOMER',
    phone: '+91 98765 43210',
    email: 'aarav.sharma@example.com',
    address: '45 Indiranagar 1st Stage, Bengaluru - 560038',
    currentBalance: 450.0,
    totalSpent: 14850.0,
    totalVisits: 8,
  },
  {
    id: 'pty-002',
    name: 'Pooja Verma',
    type: 'CUSTOMER',
    phone: '+91 98111 22334',
    email: 'pooja.verma@example.com',
    address: 'Flat 402, Sunshine Heights, Mumbai - 400053',
    currentBalance: 0.0,
    totalSpent: 8240.0,
    totalVisits: 5,
  },
  {
    id: 'pty-003',
    name: 'Rajesh Traders & Wholesale',
    type: 'SUPPLIER',
    phone: '+91 98220 33445',
    email: 'contact@rajeshtraders.com',
    gstin: '29ABCDE1234F1Z5',
    address: '12 APMC Yard, Yeshwanthpur, Bengaluru - 560022',
    currentBalance: -18500.0,
  },
];

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-000101',
    date: new Date().toISOString(),
    partyId: 'pty-001',
    partyName: 'Aarav Sharma',
    partyPhone: '+91 98765 43210',
    consumerName: 'Aarav Sharma',
    consumerPhone: '+91 98765 43210',
    billedByName: 'Cashier Desk',
    type: 'SALE',
    items: [
      {
        itemId: 'itm-001',
        name: 'Basmati Rice Premium Royal (Loose/Pack)',
        unit: 'kg',
        quantity: 1.506,
        unitPrice: 120.0,
        discountPercent: 0,
        taxRate: 5.0,
        taxAmount: 9.04,
        total: 189.76,
      },
      {
        itemId: 'itm-005',
        name: 'Dairy Milk Silk Chocolate (150g)',
        unit: 'pcs',
        quantity: 3,
        unitPrice: 90.0,
        discountPercent: 0,
        taxRate: 12.0,
        taxAmount: 32.40,
        total: 302.40,
      }
    ],
    subtotal: 450.72,
    taxTotal: 41.44,
    discountTotal: 0,
    roundOff: -0.16,
    grandTotal: 492.0,
    paidAmount: 492.0,
    balanceAmount: 0.0,
    paymentMode: 'UPI',
    status: 'PAID',
  }
];

const DEFAULT_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-001',
    poNumber: 'PO-2026-0042',
    supplierId: 'pty-003',
    supplierName: 'Rajesh Traders & Wholesale',
    supplierPhone: '+91 98220 33445',
    supplierGstin: '29ABCDE1234F1Z5',
    orderDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    expectedDeliveryDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    status: 'ORDERED',
    items: [
      {
        itemId: 'itm-001',
        name: 'Basmati Rice Premium Royal (Loose/Pack)',
        unit: 'kg',
        orderedQty: 100,
        receivedQty: 0,
        unitPrice: 95.0,
        taxRate: 5.0,
        taxAmount: 475.0,
        totalAmount: 9975.0,
      },
      {
        itemId: 'itm-002',
        name: 'Refined Sunflower Oil (1L Pouch)',
        unit: 'ltr',
        orderedQty: 50,
        receivedQty: 0,
        unitPrice: 125.0,
        taxRate: 5.0,
        taxAmount: 312.5,
        totalAmount: 6562.5,
      }
    ],
    subtotal: 15750.0,
    taxTotal: 787.5,
    grandTotal: 16537.5,
    notes: 'Urgent weekend restocking order',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

const DEFAULT_LEDGER: LedgerEntry[] = [
  {
    id: 'led-001',
    date: new Date().toISOString(),
    type: 'PAYMENT_IN',
    title: 'Sale Receipt #INV-2026-000101',
    partyOrPayee: 'Aarav Sharma',
    paymentMode: 'UPI',
    referenceNumber: 'UPI/98765432/01',
    amount: 492.0,
  },
  {
    id: 'led-002',
    date: new Date(Date.now() - 86400000).toISOString(),
    type: 'EXPENSE',
    title: 'Store Electricity Bill',
    partyOrPayee: 'BESCOM Power Dept',
    category: 'Electricity Bill',
    paymentMode: 'BANK_TRANSFER',
    referenceNumber: 'TXN-998822',
    amount: 2450.0,
  },
];

class MobileStore {
  private items: Item[] = [...DEFAULT_ITEMS];
  private categories: ItemCategory[] = [...DEFAULT_CATEGORIES];
  private parties: Party[] = [...DEFAULT_PARTIES];
  private invoices: Invoice[] = [...DEFAULT_INVOICES];
  private purchaseOrders: PurchaseOrder[] = [...DEFAULT_PURCHASE_ORDERS];
  private ledgerEntries: LedgerEntry[] = [...DEFAULT_LEDGER];
  private cart: CartItem[] = [];
  
  private activeUser: User = {
    id: 'usr-001',
    name: 'Prajjawal Pandit',
    email: 'admin@quickbill.local',
    role: 'TENANT_ADMIN',
    businessId: 'biz-001',
    tenantName: 'QuickBill Super Store',
  };

  private businessProfile: Business = {
    id: 'biz-001',
    name: 'QuickBill Super Store',
    gstin: '29AAAAA0000A1Z5',
    phone: '+91 98765 43210',
    email: 'contact@quickbillstore.com',
    address: '123 MG Road, Bengaluru, Karnataka - 560001',
    currency: '₹',
  };

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // --- Auth & User ---
  getActiveUser(): User {
    return this.activeUser;
  }

  setActiveUser(user: User) {
    this.activeUser = user;
    this.notify();
  }

  getBusinessProfile(): Business {
    return this.businessProfile;
  }

  updateBusinessProfile(updates: Partial<Business>) {
    this.businessProfile = { ...this.businessProfile, ...updates };
    this.notify();
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

  saveItem(item: Item) {
    const idx = this.items.findIndex(i => i.id === item.id || i.publicItemId === item.publicItemId);
    if (idx >= 0) {
      this.items[idx] = { ...item };
    } else {
      this.items.unshift({ ...item });
    }
    this.notify();
  }

  adjustStock(itemId: string, adjustmentQty: number, reason: string) {
    const item = this.items.find(i => i.id === itemId || i.publicItemId === itemId);
    if (item) {
      item.currentStock = Number((item.currentStock + adjustmentQty).toFixed(3));
      this.notify();
    }
  }

  getCategories(): ItemCategory[] {
    return [...this.categories];
  }

  addCategory(category: ItemCategory) {
    this.categories.push(category);
    this.notify();
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
      const taxAmount = effectivePrice * quantity * (item.taxRate / 100);
      const lineTotal = Number((effectivePrice * quantity + taxAmount).toFixed(2));

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
      const item = this.cart[index].item;
      const effectivePrice = unitPrice * (1 - discountPercent / 100);
      const taxAmount = effectivePrice * quantity * (item.taxRate / 100);
      const lineTotal = Number((effectivePrice * quantity + taxAmount).toFixed(2));

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

  createInvoice(invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'date'>): Invoice {
    const invCount = this.invoices.length + 101;
    const invoiceNumber = `INV-2026-${String(invCount).padStart(6, '0')}`;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber,
      date: new Date().toISOString(),
    };

    // Deduct stock
    newInvoice.items.forEach(invItem => {
      const match = this.items.find(i => i.id === invItem.itemId || i.name === invItem.name);
      if (match) {
        match.currentStock = Number(Math.max(0, match.currentStock - invItem.quantity).toFixed(3));
      }
    });

    // Record ledger entry
    this.ledgerEntries.unshift({
      id: `led-${Date.now()}`,
      date: newInvoice.date,
      type: 'PAYMENT_IN',
      title: `Sale Receipt #${newInvoice.invoiceNumber}`,
      partyOrPayee: newInvoice.partyName || 'Counter Customer',
      paymentMode: newInvoice.paymentMode,
      amount: newInvoice.paidAmount,
    });

    // Update customer stats
    if (newInvoice.partyId) {
      const party = this.parties.find(p => p.id === newInvoice.partyId);
      if (party) {
        party.totalSpent = (party.totalSpent || 0) + newInvoice.grandTotal;
        party.totalVisits = (party.totalVisits || 0) + 1;
        party.currentBalance += newInvoice.balanceAmount;
      }
    }

    this.invoices.unshift(newInvoice);
    this.clearCart();
    this.notify();
    return newInvoice;
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

  saveParty(party: Party) {
    const idx = this.parties.findIndex(p => p.id === party.id);
    if (idx >= 0) {
      this.parties[idx] = { ...party };
    } else {
      this.parties.unshift({ ...party });
    }
    this.notify();
  }

  // --- Purchase Orders ---
  getPurchaseOrders(): PurchaseOrder[] {
    return [...this.purchaseOrders];
  }

  createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt'>): PurchaseOrder {
    const poNumber = `PO-2026-${String(this.purchaseOrders.length + 43).padStart(4, '0')}`;
    const newPO: PurchaseOrder = {
      ...po,
      id: `po-${Date.now()}`,
      poNumber,
      createdAt: new Date().toISOString(),
    };
    this.purchaseOrders.unshift(newPO);
    this.notify();
    return newPO;
  }

  receivePurchaseOrder(poId: string) {
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
}

export const store = new MobileStore();
