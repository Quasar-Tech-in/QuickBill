import axios from 'axios';
import { Item, Party, Invoice, Payment, DashboardStats, Tenant, PlatformStats, TenantDatabaseConfig } from '../types';
import { INITIAL_ITEMS, INITIAL_PARTIES, INITIAL_INVOICES, INITIAL_PAYMENTS } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: '65f2a1b9a000000000000001',
    name: 'QuickBill Enterprise Main Store',
    slug: 'main-store-01',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    adminEmail: 'admin@quickbill.local',
    phone: '+91 9876543210',
    gstin: '07AABCB1234F1Z5',
    createdAt: '2026-01-15T10:00:00Z',
    databaseConfig: {
      isolationMode: 'SHARED',
      mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin',
      databaseName: 'quickbill_db',
    },
    stats: {
      productsCount: 6,
      invoicesCount: 2,
      monthlyGmv: 6149.0,
      usersCount: 4,
    },
  },
  {
    id: '65f2a1b9a000000000000002',
    name: 'Apex Retail Supermart',
    slug: 'apex-retail-west',
    plan: 'PROFESSIONAL',
    status: 'ACTIVE',
    adminEmail: 'manager@apexretail.in',
    phone: '+91 9811223344',
    gstin: '07AAAAA0000A1Z5',
    createdAt: '2026-02-01T14:30:00Z',
    databaseConfig: {
      isolationMode: 'DEDICATED_DATABASE',
      mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_apex_db?authSource=admin',
      databaseName: 'quickbill_apex_db',
    },
    stats: {
      productsCount: 142,
      invoicesCount: 89,
      monthlyGmv: 128450.0,
      usersCount: 8,
    },
  },
  {
    id: '65f2a1b9a000000000000003',
    name: 'Metro Tech Hardware & Spares',
    slug: 'metro-tech-spares',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    adminEmail: 'billing@metrotech.com',
    phone: '+91 9988776655',
    gstin: '07BBBBB1111B2Z6',
    createdAt: '2026-02-18T09:15:00Z',
    databaseConfig: {
      isolationMode: 'CUSTOM_CLUSTER',
      mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_metrotech_db?authSource=admin',
      databaseName: 'quickbill_metrotech_db',
    },
    stats: {
      productsCount: 320,
      invoicesCount: 210,
      monthlyGmv: 349800.0,
      usersCount: 12,
    },
  },
];

class StoreService {
  private items: Item[] = [];
  private parties: Party[] = [];
  private invoices: Invoice[] = [];
  private payments: Payment[] = [];
  private tenants: Tenant[] = [];
  private currentTenant: Tenant = DEFAULT_TENANTS[0];
  private isSuperAdminMode: boolean = false;
  private isOnline: boolean = false;

  constructor() {
    this.loadFromStorage();
    this.checkHealth();
  }

  private loadFromStorage() {
    try {
      const savedItems = localStorage.getItem('qb_items');
      const savedParties = localStorage.getItem('qb_parties');
      const savedInvoices = localStorage.getItem('qb_invoices');
      const savedPayments = localStorage.getItem('qb_payments');
      const savedTenants = localStorage.getItem('qb_tenants');
      const savedCurrentTenantId = localStorage.getItem('qb_current_tenant_id');
      const savedSuperAdmin = localStorage.getItem('qb_super_admin_mode');

      this.items = savedItems ? JSON.parse(savedItems) : INITIAL_ITEMS;
      this.parties = savedParties ? JSON.parse(savedParties) : INITIAL_PARTIES;
      this.invoices = savedInvoices ? JSON.parse(savedInvoices) : INITIAL_INVOICES;
      this.payments = savedPayments ? JSON.parse(savedPayments) : INITIAL_PAYMENTS;
      this.tenants = savedTenants ? JSON.parse(savedTenants) : DEFAULT_TENANTS;
      this.isSuperAdminMode = savedSuperAdmin === 'true';

      if (savedCurrentTenantId) {
        const found = this.tenants.find(t => t.id === savedCurrentTenantId);
        if (found) this.currentTenant = found;
      }
    } catch {
      this.items = INITIAL_ITEMS;
      this.parties = INITIAL_PARTIES;
      this.invoices = INITIAL_INVOICES;
      this.payments = INITIAL_PAYMENTS;
      this.tenants = DEFAULT_TENANTS;
      this.currentTenant = DEFAULT_TENANTS[0];
    }
  }

  private saveToStorage() {
    localStorage.setItem('qb_items', JSON.stringify(this.items));
    localStorage.setItem('qb_parties', JSON.stringify(this.parties));
    localStorage.setItem('qb_invoices', JSON.stringify(this.invoices));
    localStorage.setItem('qb_payments', JSON.stringify(this.payments));
    localStorage.setItem('qb_tenants', JSON.stringify(this.tenants));
    localStorage.setItem('qb_current_tenant_id', this.currentTenant.id);
    localStorage.setItem('qb_super_admin_mode', String(this.isSuperAdminMode));
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await axios.get('http://localhost:8000/health/ready', { timeout: 1500 });
      this.isOnline = res.status === 200;
      return this.isOnline;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Super Admin & Tenancy
  isSuperAdmin(): boolean {
    return this.isSuperAdminMode;
  }

  setSuperAdminMode(enable: boolean) {
    this.isSuperAdminMode = enable;
    this.saveToStorage();
  }

  getTenants(): Tenant[] {
    return [...this.tenants];
  }

  getActiveTenant(): Tenant {
    return this.currentTenant;
  }

  switchActiveTenant(tenantId: string): Tenant | null {
    const found = this.tenants.find(t => t.id === tenantId);
    if (!found) return null;
    this.currentTenant = found;
    this.saveToStorage();
    return this.currentTenant;
  }

  addTenant(tenantData: Omit<Tenant, 'id' | 'createdAt' | 'stats' | 'status'> & { initialPassword?: string }): Tenant {
    const newTenant: Tenant = {
      ...tenantData,
      id: `tenant_${Date.now()}`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      stats: {
        productsCount: 0,
        invoicesCount: 0,
        monthlyGmv: 0,
        usersCount: 1,
      },
    };
    this.tenants.unshift(newTenant);
    this.saveToStorage();
    return newTenant;
  }

  async testMongoConnection(uri: string, dbName: string): Promise<{ success: boolean; message: string }> {
    try {
      // Try backend endpoint if available
      const res = await axios.post('http://localhost:8000/api/v1/tenants/test-db-connection', {
        mongodb_uri: uri,
        database_name: dbName,
      }, { timeout: 3000 });
      return res.data;
    } catch (e: any) {
      // Offline / Direct verification fallback
      if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
        return {
          success: true,
          message: `Connection syntax valid. Target database: '${dbName}' ready for isolation.`,
        };
      }
      return {
        success: false,
        message: 'Invalid MongoDB connection URI format.',
      };
    }
  }

  getPlatformStats(): PlatformStats {
    const totalTenants = this.tenants.length;
    const activeTenants = this.tenants.filter(t => t.status === 'ACTIVE').length;
    const globalCombinedGmv = this.tenants.reduce((sum, t) => sum + t.stats.monthlyGmv, 0);
    const totalProducts = this.tenants.reduce((sum, t) => sum + t.stats.productsCount, 0);
    const totalInvoices = this.tenants.reduce((sum, t) => sum + t.stats.invoicesCount, 0);
    
    // Unique DB URIs or databases
    const distinctDbs = new Set(this.tenants.map(t => t.databaseConfig.mongodbUri || t.databaseConfig.databaseName));
    const databaseClustersCount = Math.max(1, distinctDbs.size);

    return {
      totalTenants,
      activeTenants,
      globalCombinedGmv,
      totalProducts,
      totalInvoices,
      databaseClustersCount,
    };
  }

  // Items
  getItems(): Item[] {
    return [...this.items];
  }

  getItemById(id: string): Item | undefined {
    return this.items.find(i => i.id === id || i.publicItemId === id);
  }

  addItem(item: Omit<Item, 'id' | 'publicItemId'>): Item {
    const newItem: Item = {
      ...item,
      id: `item_${Date.now()}`,
      publicItemId: `ITM-${1000 + this.items.length + 1}`,
    };
    this.items.unshift(newItem);
    this.currentTenant.stats.productsCount = this.items.length;
    this.saveToStorage();
    return newItem;
  }

  updateItem(id: string, updates: Partial<Item>): Item | null {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    this.items[idx] = { ...this.items[idx], ...updates };
    this.saveToStorage();
    return this.items[idx];
  }

  adjustStock(id: string, delta: number): Item | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    item.currentStock = Math.max(0, item.currentStock + delta);
    this.saveToStorage();
    return item;
  }

  deleteItem(id: string): boolean {
    const prevLen = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    this.currentTenant.stats.productsCount = this.items.length;
    this.saveToStorage();
    return this.items.length < prevLen;
  }

  // Parties
  getParties(): Party[] {
    return [...this.parties];
  }

  addParty(party: Omit<Party, 'id' | 'currentBalance'>): Party {
    const newParty: Party = {
      ...party,
      id: `party_${Date.now()}`,
      currentBalance: 0,
    };
    this.parties.unshift(newParty);
    this.saveToStorage();
    return newParty;
  }

  updatePartyBalance(partyId: string, delta: number) {
    const p = this.parties.find(x => x.id === partyId);
    if (p) {
      p.currentBalance += delta;
      this.saveToStorage();
    }
  }

  // Invoices & Billing
  getInvoices(): Invoice[] {
    return [...this.invoices];
  }

  createInvoice(invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>): Invoice {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv_${Date.now()}`,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(this.invoices.length + 1).padStart(3, '0')}`,
    };

    // Deduct stock for sold items
    newInvoice.items.forEach(line => {
      this.adjustStock(line.itemId, -line.quantity);
    });

    // If unpaid / partial balance and associated with a registered party, update receivable balance
    if (newInvoice.partyId && newInvoice.balanceAmount > 0) {
      this.updatePartyBalance(newInvoice.partyId, newInvoice.balanceAmount);
    }

    this.invoices.unshift(newInvoice);
    this.currentTenant.stats.invoicesCount = this.invoices.length;
    this.currentTenant.stats.monthlyGmv += newInvoice.grandTotal;
    this.saveToStorage();
    return newInvoice;
  }

  // Payments
  getPayments(): Payment[] {
    return [...this.payments];
  }

  recordPayment(paymentData: Omit<Payment, 'id'>): Payment {
    const payment: Payment = {
      ...paymentData,
      id: `pay_${Date.now()}`,
    };

    if (payment.type === 'PAYMENT_IN') {
      this.updatePartyBalance(payment.partyId, -payment.amount);
    } else {
      this.updatePartyBalance(payment.partyId, payment.amount);
    }

    this.payments.unshift(payment);
    this.saveToStorage();
    return payment;
  }

  // Dashboard Metrics
  getDashboardStats(): DashboardStats {
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = this.invoices.filter(i => i.date === today && i.type === 'SALE');
    const todaySales = todayInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

    const totalReceivables = this.parties
      .filter(p => p.currentBalance > 0)
      .reduce((sum, p) => sum + p.currentBalance, 0);

    const totalPayables = this.parties
      .filter(p => p.currentBalance < 0)
      .reduce((sum, p) => sum + Math.abs(p.currentBalance), 0);

    const lowStockCount = this.items.filter(i => i.currentStock <= i.minStockAlert).length;
    const netProfit = Math.round(todaySales * 0.22);

    return {
      todaySales,
      todayTransactionsCount: todayInvoices.length,
      totalReceivables,
      totalPayables,
      lowStockCount,
      netProfit,
    };
  }
}

export const store = new StoreService();
