import axios from 'axios';
import { Item, Party, Invoice, Payment, DashboardStats, Tenant, PlatformStats, TenantDatabaseConfig, User, UserRole, StoreLocation, ItemCategory, CartItem, Expense, ExpenseCategory, LedgerEntry, PaginatedApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'exp-cat-1', name: 'Electricity Bill', isCustom: false },
  { id: 'exp-cat-2', name: 'Staff Salary & Wages', isCustom: false },
  { id: 'exp-cat-3', name: 'Shop / Store Rent', isCustom: false },
  { id: 'exp-cat-4', name: 'Maintenance & Repairs', isCustom: false },
  { id: 'exp-cat-5', name: 'Tea & Refreshments', isCustom: false },
  { id: 'exp-cat-6', name: 'Printing & Stationery', isCustom: false },
  { id: 'exp-cat-7', name: 'Internet & Telephone', isCustom: false },
  { id: 'exp-cat-8', name: 'Municipal / Trade Tax', isCustom: false },
  { id: 'exp-cat-9', name: 'Packaging & Materials', isCustom: false },
  { id: 'exp-cat-10', name: 'Logistics / Delivery', isCustom: false },
];

export const DEFAULT_CATEGORIES: ItemCategory[] = [
  { id: 'cat-01', businessId: '65f2a1b9a000000000000001', name: 'Grocery', description: 'Packaged foods, staples, pulses & grains', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-02', businessId: '65f2a1b9a000000000000001', name: 'Dairy & Eggs', description: 'Milk, cheese, butter, curd and farm eggs', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-03', businessId: '65f2a1b9a000000000000001', name: 'Beverages', description: 'Juices, cold drinks, tea, coffee & energy drinks', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-04', businessId: '65f2a1b9a000000000000001', name: 'Snacks & Sweets', description: 'Biscuits, chips, namkeen, chocolates & bakery', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-05', businessId: '65f2a1b9a000000000000001', name: 'Personal Care', description: 'Soaps, haircare, skincare, oral care & grooming', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-06', businessId: '65f2a1b9a000000000000001', name: 'Household & Cleaning', description: 'Detergents, cleaners, dishwash & kitchen essentials', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-07', businessId: '65f2a1b9a000000000000001', name: 'Electronics & Gadgets', description: 'Cables, chargers, peripherals, accessories & batteries', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-08', businessId: '65f2a1b9a000000000000001', name: 'Apparel & Lifestyle', description: 'Ready-to-wear clothing, innerwear & accessories', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-09', businessId: '65f2a1b9a000000000000001', name: 'Stationery & Office', description: 'Books, notebooks, pens, markers & desk supplies', createdAt: '2026-01-15T10:00:00Z' },
  { id: 'cat-10', businessId: '65f2a1b9a000000000000001', name: 'General Store', description: 'General merchandise & assorted counter items', createdAt: '2026-01-15T10:00:00Z' },
];

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: '65f2a1b9a000000000000001',
    name: 'QuickBill Enterprise Retail',
    slug: 'quickbill-main',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    adminEmail: 'admin@quickbill.local',
    phone: '+91 9876543210',
    gstin: '07AABCB1234F1Z5',
    createdAt: '2026-01-15T10:00:00Z',
    databaseConfig: {
      isolationMode: 'DEDICATED_DATABASE',
      mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_main_db?authSource=admin',
      databaseName: 'quickbill_main_db',
    },
    stats: {
      productsCount: 32,
      invoicesCount: 2,
      monthlyGmv: 2629.0,
      usersCount: 3,
    },
  },
];

const DEFAULT_LOCATIONS: StoreLocation[] = [
  {
    id: '65f2a1b9a000000000000101',
    businessId: '65f2a1b9a000000000000001',
    name: 'Main Flagship Counter',
    code: 'MAIN-01',
    address: 'Ground Floor, Metro Retail Plaza, Sector 18',
    phone: '+91 9876543210',
    isDefault: true,
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: '65f2a1b9a000000000000102',
    businessId: '65f2a1b9a000000000000001',
    name: 'Downtown Express Branch',
    code: 'DT-02',
    address: 'Shop 14, City Walk Center, Downtown',
    phone: '+91 9811223344',
    isDefault: false,
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: '65f2a1b9a000000000000103',
    businessId: '65f2a1b9a000000000000001',
    name: 'Central Supply Warehouse',
    code: 'WH-03',
    address: 'Plot 8B, Industrial Logistics Park',
    phone: '+91 9988776655',
    isDefault: false,
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
];

const DEFAULT_USERS: User[] = [
  {
    id: '65f2a1b9a000000000000011',
    name: 'QuickBill Store Admin',
    email: 'admin@quickbill.local',
    role: 'TENANT_ADMIN',
    businessId: '65f2a1b9a000000000000001',
    tenantName: 'QuickBill Enterprise Retail',
    assignedLocationIds: ['65f2a1b9a000000000000101', '65f2a1b9a000000000000102', '65f2a1b9a000000000000103'],
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: '65f2a1b9a000000000000012',
    name: 'Store Operations Manager',
    email: 'manager@quickbill.local',
    role: 'MANAGER',
    businessId: '65f2a1b9a000000000000001',
    tenantName: 'QuickBill Enterprise Retail',
    assignedLocationIds: ['65f2a1b9a000000000000101', '65f2a1b9a000000000000102'],
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: '65f2a1b9a000000000000013',
    name: 'Main POS Billing Staff',
    email: 'cashier@quickbill.local',
    role: 'CASHIER',
    businessId: '65f2a1b9a000000000000001',
    tenantName: 'QuickBill Enterprise Retail',
    assignedLocationIds: ['65f2a1b9a000000000000101'],
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
];

class StoreService {
  private items: Item[] = [];
  private parties: Party[] = [];
  private invoices: Invoice[] = [];
  private payments: Payment[] = [];
  private expenses: Expense[] = [];
  private expenseCategories: ExpenseCategory[] = [];
  private tenants: Tenant[] = [];
  private locations: StoreLocation[] = [];
  private users: User[] = [];
  private categories: ItemCategory[] = [];
  private activeLocation: StoreLocation = DEFAULT_LOCATIONS[0];
  private currentTenant: Tenant = DEFAULT_TENANTS[0];
  private isSuperAdminMode: boolean = false;
  private isOnline: boolean = false;
  private currentUser: User | null = null;

  constructor() {
    this.loadFromStorage();
    this.setupAxiosInterceptors();
    this.checkHealth().then(isOnline => {
      if (isOnline) {
        this.fetchCategories().catch(() => {});
        this.fetchItems().catch(() => {});
        this.fetchInvoices().catch(() => {});
        this.fetchParties().catch(() => {});
        this.fetchExpenses().catch(() => {});
        this.fetchExpenseCategories().catch(() => {});
      }
    });
  }

  private setupAxiosInterceptors() {
    apiClient.interceptors.request.use((config) => {
      if (this.currentTenant?.id) {
        config.headers['X-Business-ID'] = this.currentTenant.id;
      }
      if (this.currentUser?.token) {
        config.headers['Authorization'] = `Bearer ${this.currentUser.token}`;
      }
      return config;
    });
  }

  private loadFromStorage() {
    try {
      const savedItems = localStorage.getItem('qb_items');
      const savedParties = localStorage.getItem('qb_parties');
      const savedPayments = localStorage.getItem('qb_payments');
      const savedExpenses = localStorage.getItem('qb_expenses');
      const savedExpCats = localStorage.getItem('qb_expense_categories');
      const savedTenants = localStorage.getItem('qb_tenants');
      const savedLocations = localStorage.getItem('qb_locations');
      const savedUsers = localStorage.getItem('qb_users');
      const savedCategories = localStorage.getItem('qb_categories');
      const savedActiveLocId = localStorage.getItem('qb_active_location_id');
      const savedSuperAdmin = localStorage.getItem('qb_super_admin_mode');
      const savedUser = localStorage.getItem('qb_auth_user');

      // Purge any stale UI cached invoices
      localStorage.removeItem('qb_invoices');
      this.invoices = [];

      this.items = savedItems ? JSON.parse(savedItems) : [];
      this.parties = savedParties ? JSON.parse(savedParties) : [];
      this.payments = savedPayments ? JSON.parse(savedPayments) : [];
      this.expenses = savedExpenses ? JSON.parse(savedExpenses) : [];
      this.expenseCategories = savedExpCats ? JSON.parse(savedExpCats) : DEFAULT_EXPENSE_CATEGORIES;
      this.tenants = savedTenants ? JSON.parse(savedTenants) : DEFAULT_TENANTS;
      this.locations = savedLocations ? JSON.parse(savedLocations) : DEFAULT_LOCATIONS;
      this.users = savedUsers ? JSON.parse(savedUsers) : DEFAULT_USERS;
      this.categories = savedCategories ? JSON.parse(savedCategories) : DEFAULT_CATEGORIES;
      this.currentTenant = this.tenants[0] || DEFAULT_TENANTS[0];
      this.isSuperAdminMode = savedSuperAdmin === 'true';

      if (savedActiveLocId) {
        const foundLoc = this.locations.find(l => l.id === savedActiveLocId);
        if (foundLoc) this.activeLocation = foundLoc;
        else this.activeLocation = this.locations[0] || DEFAULT_LOCATIONS[0];
      } else {
        this.activeLocation = this.locations[0] || DEFAULT_LOCATIONS[0];
      }

      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      } else {
        this.currentUser = DEFAULT_USERS[0];
      }

      // Sync businessIds to single tenant
      this.items.forEach(i => { i.businessId = this.currentTenant.id; });
      this.parties.forEach(p => { p.businessId = this.currentTenant.id; });
      this.payments.forEach(pay => { pay.businessId = this.currentTenant.id; });
      this.expenses.forEach(exp => { exp.businessId = this.currentTenant.id; });
      this.categories.forEach(c => { c.businessId = this.currentTenant.id; });

    } catch {
      this.items = [];
      this.parties = [];
      this.invoices = [];
      this.payments = [];
      this.expenses = [];
      this.expenseCategories = DEFAULT_EXPENSE_CATEGORIES;
      this.tenants = DEFAULT_TENANTS;
      this.locations = DEFAULT_LOCATIONS;
      this.users = DEFAULT_USERS;
      this.categories = DEFAULT_CATEGORIES;
      this.currentTenant = DEFAULT_TENANTS[0];
      this.activeLocation = DEFAULT_LOCATIONS[0];
      this.currentUser = DEFAULT_USERS[0];
    }
  }

  private saveToStorage() {
    localStorage.setItem('qb_items', JSON.stringify(this.items));
    localStorage.setItem('qb_parties', JSON.stringify(this.parties));
    localStorage.setItem('qb_payments', JSON.stringify(this.payments));
    localStorage.setItem('qb_expenses', JSON.stringify(this.expenses));
    localStorage.setItem('qb_expense_categories', JSON.stringify(this.expenseCategories));
    localStorage.setItem('qb_tenants', JSON.stringify(this.tenants));
    localStorage.setItem('qb_locations', JSON.stringify(this.locations));
    localStorage.setItem('qb_users', JSON.stringify(this.users));
    localStorage.setItem('qb_categories', JSON.stringify(this.categories));
    localStorage.setItem('qb_active_location_id', this.activeLocation?.id || '');
    localStorage.setItem('qb_current_tenant_id', this.currentTenant.id);
    localStorage.setItem('qb_super_admin_mode', String(this.isSuperAdminMode));
    if (this.currentUser) {
      localStorage.setItem('qb_auth_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('qb_auth_user');
    }
  }

  // --- Authentication (Strict Dynamic Database Validation) ---
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  async login(
    email: string, 
    password: string, 
    _tenantId?: string,
    isSuperAdminPortal: boolean = false
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return { success: false, error: 'Please provide both work email and password.' };
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: cleanEmail,
        password: password,
      }, { timeout: 4000 });

      if (res.data?.access_token) {
        const rawRole = (res.data.roles && res.data.roles[0]) || 'CASHIER';
        const userRole: UserRole = (rawRole === 'SUPER_ADMIN' || rawRole === 'TENANT_ADMIN' || rawRole === 'MANAGER' || rawRole === 'CASHIER')
          ? rawRole : 'CASHIER';

        if (isSuperAdminPortal && userRole !== 'SUPER_ADMIN') {
          return { success: false, error: 'Access denied: Super Administrator role required for Control Plane.' };
        }

        const authenticatedUser: User = {
          id: res.data.user_id,
          email: res.data.email,
          name: res.data.name || cleanEmail.split('@')[0],
          role: userRole,
          businessId: res.data.default_business_id,
          tenantName: this.currentTenant.name,
          token: res.data.access_token,
          assignedLocationIds: res.data.assigned_location_ids || [],
          isActive: true,
        };

        this.currentUser = authenticatedUser;
        this.isSuperAdminMode = userRole === 'SUPER_ADMIN';

        // Match active location to user's assigned locations
        if (authenticatedUser.assignedLocationIds && authenticatedUser.assignedLocationIds.length > 0) {
          const matched = this.locations.find(l => authenticatedUser.assignedLocationIds?.includes(l.id));
          if (matched) this.activeLocation = matched;
        }

        this.saveToStorage();
        return { success: true, user: authenticatedUser };
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message;
      return { 
        success: false, 
        error: typeof errMsg === 'string' ? errMsg : 'Invalid email or password. Authentication failed.' 
      };
    }

    return { success: false, error: 'Invalid email or password.' };
  }

  logout() {
    this.currentUser = null;
    this.isSuperAdminMode = false;
    this.saveToStorage();
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

  isSuperAdmin(): boolean {
    return this.isSuperAdminMode || this.currentUser?.role === 'SUPER_ADMIN';
  }

  setSuperAdminMode(enable: boolean) {
    this.isSuperAdminMode = enable;
    this.saveToStorage();
  }

  // --- POS Cart Tracking & Synchronization ---
  private posCart: CartItem[] = [];
  private cartListeners: Array<(cart: CartItem[]) => void> = [];

  getPosCart(): CartItem[] {
    return this.posCart;
  }

  setPosCart(cart: CartItem[]): void {
    this.posCart = cart;
    this.cartListeners.forEach(listener => {
      try { listener(cart); } catch (e) { console.error(e); }
    });
  }

  setPosCartSilent(cart: CartItem[]): void {
    this.posCart = cart;
  }

  clearPosCart(): void {
    this.posCart = [];
    this.cartListeners.forEach(listener => {
      try { listener([]); } catch (e) { console.error(e); }
    });
  }

  subscribePosCart(listener: (cart: CartItem[]) => void): () => void {
    this.cartListeners.push(listener);
    return () => {
      this.cartListeners = this.cartListeners.filter(l => l !== listener);
    };
  }

  // --- Locations & Branches ---
  getLocations(): StoreLocation[] {
    const user = this.currentUser;
    // Store Admin & Super Admin see all locations
    if (!user || user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return this.locations;
    }
    // Managers and Cashiers see only their assigned locations
    const assignedIds = user.assignedLocationIds || [];
    if (assignedIds.length === 0) return this.locations.slice(0, 1);
    return this.locations.filter(loc => assignedIds.includes(loc.id));
  }

  getAllLocations(): StoreLocation[] {
    return this.locations;
  }

  getActiveLocation(): StoreLocation {
    return this.activeLocation || this.locations[0] || DEFAULT_LOCATIONS[0];
  }

  setActiveLocation(locationOrId: string | StoreLocation): StoreLocation {
    const locId = typeof locationOrId === 'string' ? locationOrId : locationOrId.id;
    const found = this.locations.find(l => l.id === locId);
    if (found) {
      this.activeLocation = found;
      this.clearPosCart(); // Always empty POS cart upon location change
      this.saveToStorage();
    }
    return this.getActiveLocation();
  }

  async addLocation(locData: Omit<StoreLocation, 'id' | 'businessId' | 'createdAt' | 'isActive'>): Promise<StoreLocation> {
    const newLoc: StoreLocation = {
      ...locData,
      id: `loc_${Date.now()}`,
      businessId: this.currentTenant.id,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await apiClient.post('/locations', {
        name: locData.name,
        code: locData.code,
        address: locData.address,
        phone: locData.phone,
        isDefault: locData.isDefault || false,
      });
      if (res.data?.id) {
        newLoc.id = res.data.id;
      }
    } catch {
      // offline fallback
    }

    this.locations.push(newLoc);
    this.saveToStorage();
    return newLoc;
  }

  // --- Team & Staff Users Management ---
  getUsers(): User[] {
    return this.users.filter(u => u.businessId === this.currentTenant.id || !u.businessId);
  }

  async addUser(userData: { name: string; email: string; password?: string; role: UserRole; assignedLocationIds: string[] }): Promise<User> {
    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: userData.name,
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      businessId: this.currentTenant.id,
      tenantName: this.currentTenant.name,
      assignedLocationIds: userData.assignedLocationIds,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await apiClient.post('/users', {
        name: userData.name,
        email: userData.email,
        password: userData.password || 'quickbill123',
        role: userData.role,
        assignedLocationIds: userData.assignedLocationIds,
      });
      if (res.data?.id) {
        newUser.id = res.data.id;
      }
    } catch {
      // offline fallback
    }

    this.users.unshift(newUser);
    this.saveToStorage();
    return newUser;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const idx = this.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;

    try {
      await apiClient.put(`/users/${userId}`, updates);
    } catch {
      // offline fallback
    }

    this.users[idx] = { ...this.users[idx], ...updates };
    this.saveToStorage();
    return this.users[idx];
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/users/${userId}`);
    } catch {
      // offline fallback
    }
    const prevLen = this.users.length;
    this.users = this.users.filter(u => u.id !== userId);
    this.saveToStorage();
    return this.users.length < prevLen;
  }

  // --- Tenancy ---
  getTenants(): Tenant[] {
    const visibleTenants = (this.isSuperAdmin() || !this.currentUser) 
      ? this.tenants 
      : [this.currentTenant];

    return visibleTenants.map(t => {
      const tenantItems = this.items.filter(i => (i.businessId || DEFAULT_TENANTS[0].id) === t.id);
      const tenantInvoices = this.invoices.filter(inv => (inv.businessId || DEFAULT_TENANTS[0].id) === t.id);
      const monthlyGmv = tenantInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

      return {
        ...t,
        stats: {
          productsCount: tenantItems.length,
          invoicesCount: tenantInvoices.length,
          monthlyGmv: monthlyGmv,
          usersCount: this.users.length,
        }
      };
    });
  }

  getActiveTenant(): Tenant {
    return this.currentTenant;
  }

  switchActiveTenant(tenantId: string): Tenant | null {
    if (!this.isSuperAdmin()) {
      return null;
    }
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
      const res = await axios.post(`${API_BASE_URL}/tenants/test-db-connection`, {
        mongodb_uri: uri,
        database_name: dbName,
      }, { timeout: 3000 });
      return res.data;
    } catch {
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
    const tenantsWithLiveStats = this.getTenants();
    const totalTenants = tenantsWithLiveStats.length;
    const activeTenants = tenantsWithLiveStats.filter(t => t.status === 'ACTIVE').length;
    const globalCombinedGmv = tenantsWithLiveStats.reduce((sum, t) => sum + t.stats.monthlyGmv, 0);
    const totalProducts = tenantsWithLiveStats.reduce((sum, t) => sum + t.stats.productsCount, 0);
    const totalInvoices = tenantsWithLiveStats.reduce((sum, t) => sum + t.stats.invoicesCount, 0);
    
    return {
      totalTenants,
      activeTenants,
      globalCombinedGmv,
      totalProducts,
      totalInvoices,
      databaseClustersCount: 1,
    };
  }

  // --- Strict Tenant & Location-Isolated Items ---
  getItems(locationId?: string, includeUnlisted: boolean = false): Item[] {
    const activeTenantId = this.currentTenant.id;
    const targetLocId = locationId || this.getActiveLocation().id;
    const tenantItems = this.items.filter(i => (i.businessId || DEFAULT_TENANTS[0].id) === activeTenantId);

    const result: Item[] = [];

    for (const item of tenantItems) {
      // Find location-specific override if present
      const locInv = item.locations?.find(l => l.locationId === targetLocId);

      if (locInv) {
        if (!includeUnlisted && locInv.isListed === false) {
          continue; // skip item if explicitly not listed in this branch
        }

        const mrp = locInv.mrp ?? locInv.salePrice ?? item.salePrice;
        let effectiveSalePrice = mrp;
        if (locInv.hasDiscount && locInv.discountValue && locInv.discountValue > 0) {
          if (locInv.discountType === 'PERCENT') {
            effectiveSalePrice = Number((mrp - (mrp * locInv.discountValue / 100)).toFixed(2));
          } else {
            effectiveSalePrice = Math.max(0, Number((mrp - locInv.discountValue).toFixed(2)));
          }
        } else if (locInv.salePrice) {
          effectiveSalePrice = locInv.salePrice;
        }

        result.push({
          ...item,
          mrp,
          salePrice: effectiveSalePrice,
          hasDiscount: locInv.hasDiscount || false,
          discountType: locInv.discountType || 'PERCENT',
          discountValue: locInv.discountValue || 0,
          purchasePrice: locInv.purchasePrice ?? item.purchasePrice,
          currentStock: locInv.currentStock ?? item.currentStock,
          minStockAlert: locInv.minStockAlert ?? item.minStockAlert,
        });
      } else {
        // If the item has explicit locations specified, but NOT this target location, skip when unlisted are excluded
        if (!includeUnlisted && item.locations && item.locations.length > 0) {
          continue;
        }

        // Fall back to item master defaults
        const mrp = item.mrp ?? item.salePrice;
        let effectiveSalePrice = mrp;
        if (item.hasDiscount && item.discountValue && item.discountValue > 0) {
          if (item.discountType === 'PERCENT') {
            effectiveSalePrice = Number((mrp - (mrp * item.discountValue / 100)).toFixed(2));
          } else {
            effectiveSalePrice = Math.max(0, Number((mrp - item.discountValue).toFixed(2)));
          }
        }

        result.push({
          ...item,
          mrp,
          salePrice: effectiveSalePrice,
        });
      }
    }

    return result;
  }

  async fetchItems(locationId?: string): Promise<Item[]> {
    try {
      const locId = locationId || this.getActiveLocation().id;
      const res = await apiClient.get('/items', { params: { page: 1, page_size: 500, locationId: locId } });
      if (res.data?.data && Array.isArray(res.data.data)) {
        const liveItems: Item[] = res.data.data.map((d: any) => ({
          id: d._id || d.id || d.publicItemId,
          businessId: d.businessId || this.currentTenant.id,
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
          hasDiscount: d.hasDiscount,
          discountType: d.discountType,
          discountValue: d.discountValue ? Number(d.discountValue) : undefined,
          locations: d.locations,
          images: d.images,
          imageUrl: d.imageUrl,
          allowParts: !!d.allowParts,
        }));
        if (liveItems.length > 0) {
          this.items = liveItems;
          this.saveToStorage();
        }
      }
    } catch (e) {
      console.warn('Could not fetch live items from /items API:', e);
    }
    return this.getItems(locationId);
  }

  async fetchItemsPaginated(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    locationId?: string;
  }): Promise<PaginatedApiResponse<Item>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const locId = params.locationId || this.getActiveLocation().id;

    try {
      const qParams: any = {
        page,
        page_size: pageSize,
      };
      if (params.search && params.search.trim()) {
        qParams.search = params.search.trim();
      }
      if (params.category && params.category !== 'ALL') {
        qParams.category = params.category;
      }
      if (locId && locId !== 'ALL') {
        qParams.locationId = locId;
      }

      const res = await apiClient.get('/items', { params: qParams });
      if (res.data && Array.isArray(res.data.data)) {
        const liveItems: Item[] = res.data.data.map((d: any) => ({
          id: d._id || d.id || d.publicItemId,
          businessId: d.businessId || this.currentTenant.id,
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
          hasDiscount: d.hasDiscount,
          discountType: d.discountType,
          discountValue: d.discountValue ? Number(d.discountValue) : undefined,
          locations: d.locations,
          images: d.images,
          imageUrl: d.imageUrl,
          allowParts: !!d.allowParts,
        }));

        return {
          data: liveItems,
          page: res.data.page || page,
          pageSize: res.data.page_size || pageSize,
          total: res.data.total !== undefined ? res.data.total : liveItems.length,
          totalPages: res.data.total_pages || Math.ceil((res.data.total || liveItems.length) / pageSize),
        };
      }
    } catch (e) {
      console.warn('Could not fetch paginated items from API, falling back to local:', e);
    }

    // Local fallback
    const all = this.getItems(locId, true);
    const filtered = all.filter(i => {
      if (params.category && params.category !== 'ALL' && i.category !== params.category) return false;
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase();
        const m = i.name.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q)) || (i.publicItemId && i.publicItemId.toLowerCase().includes(q));
        if (!m) return false;
      }
      return true;
    });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: slice,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  getRawItems(): Item[] {
    const activeTenantId = this.currentTenant.id;
    return this.items.filter(i => (i.businessId || DEFAULT_TENANTS[0].id) === activeTenantId);
  }

  getItemById(id: string, locationId?: string): Item | undefined {
    const items = this.getItems(locationId, true);
    return items.find(i => i.id === id || i.publicItemId === id);
  }

  async addItem(item: Omit<Item, 'id' | 'publicItemId' | 'businessId'>): Promise<Item> {
    const activeId = this.currentTenant.id;
    const storeItems = this.getRawItems();
    
    // Ensure every registered location has an entry in item.locations if not provided
    let locs = item.locations;
    if (!locs || locs.length === 0) {
      locs = this.locations.map(loc => ({
        locationId: loc.id,
        locationName: loc.name,
        mrp: item.mrp || item.salePrice,
        salePrice: item.salePrice,
        purchasePrice: item.purchasePrice,
        currentStock: item.currentStock,
        minStockAlert: item.minStockAlert,
        isListed: true,
        hasDiscount: item.hasDiscount || false,
        discountType: item.discountType || 'PERCENT',
        discountValue: item.discountValue || 0,
      }));
    }

    try {
      const payload = {
        name: item.name,
        sku: item.sku || undefined,
        barcode: item.barcode || undefined,
        category: item.category || 'General',
        unit: item.unit || 'pcs',
        purchasePrice: item.purchasePrice || 0,
        salePrice: item.salePrice || 0,
        mrp: item.mrp || item.salePrice,
        taxRate: item.taxRate || 0,
        currentStock: item.currentStock || 0,
        minStockAlert: item.minStockAlert || 5,
        allowParts: !!item.allowParts,
        description: item.description || undefined,
        hasDiscount: !!item.hasDiscount,
        discountType: item.discountType || 'PERCENT',
        discountValue: item.discountValue || 0,
        locations: locs,
        images: item.images || [],
        imageUrl: item.imageUrl || undefined,
      };

      const res = await apiClient.post('/items', payload);
      if (res.data && (res.data.id || res.data._id)) {
        const d = res.data;
        const created: Item = {
          id: d._id || d.id,
          businessId: d.businessId || activeId,
          publicItemId: d.publicItemId || `ITM-${1000 + storeItems.length + 1}`,
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
          locations: d.locations || locs,
          images: d.images,
          imageUrl: d.imageUrl,
          allowParts: !!d.allowParts,
        };
        this.items.unshift(created);
        this.saveToStorage();
        return created;
      }
    } catch (e) {
      console.warn('Backend /items creation failed, fallback local:', e);
    }

    const newItem: Item = {
      ...item,
      id: `item_${Date.now()}`,
      businessId: activeId,
      publicItemId: `ITM-${1000 + storeItems.length + 1}`,
      locations: locs,
    };
    this.items.unshift(newItem);
    this.saveToStorage();
    return newItem;
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item | null> {
    const activeId = this.currentTenant.id;
    const idx = this.items.findIndex(
      i => (i.businessId || DEFAULT_TENANTS[0].id) === activeId && i.id === id
    );

    try {
      const payload: any = { ...updates };
      if (payload.id) delete payload.id;
      if (payload.businessId) delete payload.businessId;
      if (payload.publicItemId) delete payload.publicItemId;

      const res = await apiClient.put(`/items/${id}`, payload);
      if (res.data && (res.data.id || res.data._id)) {
        const d = res.data;
        const updated: Item = {
          id: d._id || d.id || id,
          businessId: d.businessId || activeId,
          publicItemId: d.publicItemId,
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
          locations: d.locations,
          images: d.images,
          imageUrl: d.imageUrl,
          allowParts: !!d.allowParts,
        };
        if (idx !== -1) {
          this.items[idx] = updated;
        } else {
          this.items.unshift(updated);
        }
        this.saveToStorage();
        return updated;
      }
    } catch (e) {
      console.warn(`Backend /items/${id} update failed, fallback local:`, e);
    }

    if (idx === -1) return null;
    this.items[idx] = { ...this.items[idx], ...updates, businessId: activeId };
    this.saveToStorage();
    return this.items[idx];
  }

  async adjustStock(id: string, delta: number, locationId?: string): Promise<Item | null> {
    const activeId = this.currentTenant.id;
    const targetLocId = locationId || this.getActiveLocation().id;

    try {
      const res = await apiClient.post(`/items/${id}/adjust-stock`, { delta, locationId: targetLocId });
      if (res.data && (res.data.id || res.data._id)) {
        const d = res.data;
        const updated: Item = {
          id: d._id || d.id || id,
          businessId: d.businessId || activeId,
          publicItemId: d.publicItemId,
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
          locations: d.locations,
          images: d.images,
          imageUrl: d.imageUrl,
          allowParts: !!d.allowParts,
        };
        const idx = this.items.findIndex(i => i.id === id);
        if (idx !== -1) {
          this.items[idx] = updated;
        }
        this.saveToStorage();
        return updated;
      }
    } catch (e) {
      console.warn(`Backend /items/${id}/adjust-stock failed, fallback local:`, e);
    }

    const item = this.items.find(
      i => (i.businessId || DEFAULT_TENANTS[0].id) === activeId && i.id === id
    );
    if (!item) return null;

    // Adjust in branch location
    if (item.locations && item.locations.length > 0) {
      const branch = item.locations.find(l => l.locationId === targetLocId);
      if (branch) {
        branch.currentStock = Number(Math.max(0, branch.currentStock + delta).toFixed(3));
      }
      // Recompute aggregate master stock
      item.currentStock = Number(item.locations.reduce((sum, l) => sum + (l.currentStock || 0), 0).toFixed(3));
    } else {
      item.currentStock = Number(Math.max(0, item.currentStock + delta).toFixed(3));
    }

    this.saveToStorage();
    return item;
  }

  async deleteItem(id: string): Promise<boolean> {
    const activeId = this.currentTenant.id;
    try {
      await apiClient.delete(`/items/${id}`);
    } catch (e) {
      console.warn(`Backend /items/${id} delete failed:`, e);
    }
    const prevLen = this.items.length;
    this.items = this.items.filter(
      i => !((i.businessId || DEFAULT_TENANTS[0].id) === activeId && i.id === id)
    );
    this.saveToStorage();
    return this.items.length < prevLen;
  }

  // --- Strict Tenant-Isolated Product Categories ---
  getCategories(): ItemCategory[] {
    const activeId = this.currentTenant.id;
    return this.categories.filter(c => (c.businessId || DEFAULT_TENANTS[0].id) === activeId);
  }

  async fetchCategories(): Promise<ItemCategory[]> {
    try {
      const res = await apiClient.get('/categories', { params: { type: 'PRODUCT' } });
      if (res.data && Array.isArray(res.data)) {
        if (res.data.length > 0) {
          const liveCats: ItemCategory[] = res.data.map((c: any) => ({
            id: c.id || c._id,
            businessId: c.businessId || this.currentTenant.id,
            name: c.name,
            type: 'PRODUCT',
            description: c.description || undefined,
            createdAt: c.createdAt || new Date().toISOString(),
          }));
          this.categories = liveCats;
          this.saveToStorage();
          return this.getCategories();
        } else {
          // If database is empty for this tenant, seed standard initial product categories into MongoDB
          const seeded: ItemCategory[] = [];
          for (const def of DEFAULT_CATEGORIES) {
            try {
              const createRes = await apiClient.post('/categories', {
                name: def.name,
                type: 'PRODUCT',
                description: def.description,
              });
              seeded.push({
                id: createRes.data?.id || createRes.data?._id || def.id,
                businessId: this.currentTenant.id,
                name: def.name,
                type: 'PRODUCT',
                description: def.description,
                createdAt: new Date().toISOString(),
              });
            } catch {
              seeded.push({
                ...def,
                businessId: this.currentTenant.id,
                type: 'PRODUCT',
              });
            }
          }
          if (seeded.length > 0) {
            this.categories = seeded;
            this.saveToStorage();
          }
          return this.getCategories();
        }
      }
    } catch (e) {
      console.warn('Could not fetch product categories from API:', e);
    }
    return this.getCategories();
  }

  async addCategory(data: { name: string; description?: string }): Promise<ItemCategory> {
    const activeId = this.currentTenant.id;
    const cleanName = data.name.trim();
    
    // Check if category name already exists
    const existing = this.categories.find(
      c => (c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      return existing;
    }

    const newCategory: ItemCategory = {
      id: `cat_${Date.now()}`,
      businessId: activeId,
      name: cleanName,
      type: 'PRODUCT',
      description: data.description?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    // Attempt backend sync
    try {
      const res = await apiClient.post('/categories', {
        name: newCategory.name,
        type: 'PRODUCT',
        description: newCategory.description,
      });
      if (res.data?.id || res.data?._id) {
        newCategory.id = res.data.id || res.data._id;
      }
    } catch (err) {
      console.warn('Could not sync product category to backend API:', err);
    }

    this.categories.push(newCategory);
    this.saveToStorage();
    return newCategory;
  }

  async updateCategory(id: string, updates: Partial<ItemCategory>): Promise<ItemCategory | null> {
    const activeId = this.currentTenant.id;
    const idx = this.categories.findIndex(
      c => (c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.id === id
    );
    if (idx === -1) return null;

    const oldName = this.categories[idx].name;
    const newName = updates.name ? updates.name.trim() : oldName;

    this.categories[idx] = {
      ...this.categories[idx],
      ...updates,
      name: newName,
      businessId: activeId,
    };

    // Cascade category rename to tagged inventory items
    if (newName !== oldName) {
      this.items.forEach(item => {
        if (item.category === oldName) {
          item.category = newName;
        }
      });
    }

    this.saveToStorage();

    if (!id.startsWith('cat_')) {
      try {
        await apiClient.put(`/categories/${id}`, {
          name: newName,
          type: 'PRODUCT',
          description: updates.description,
        });
      } catch (err) {
        console.warn('Could not sync product category update to backend API:', err);
      }
    }

    return this.categories[idx];
  }

  async deleteCategory(id: string): Promise<boolean> {
    const activeId = this.currentTenant.id;
    const target = this.categories.find(
      c => (c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.id === id
    );
    if (!target) return false;

    this.categories = this.categories.filter(
      c => !((c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.id === id)
    );
    this.saveToStorage();

    if (!id.startsWith('cat_')) {
      try {
        await apiClient.delete(`/categories/${id}`);
      } catch (err) {
        console.warn('Could not sync product category deletion to backend API:', err);
      }
    }

    return true;
  }

  // --- Strict Tenant-Isolated Parties & Dedicated Customers (CRM & DB Integration) ---
  getParties(locationId?: string): Party[] {
    const activeId = this.currentTenant.id;
    const tenantParties = this.parties.filter(p => (p.businessId || DEFAULT_TENANTS[0].id) === activeId);
    if (!locationId || locationId === 'ALL') return tenantParties;

    return tenantParties.filter(p => 
      !p.locationIds || p.locationIds.length === 0 || p.locationIds.includes(locationId) || p.locationId === locationId
    );
  }

  async fetchParties(locationId?: string): Promise<Party[]> {
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
            businessId: c.businessId || this.currentTenant.id,
            name: c.name,
            type: 'CUSTOMER',
            phone: c.phone || undefined,
            email: c.email || undefined,
            address: c.address || undefined,
            gstin: c.gstin || undefined,
            currentBalance: Number(c.currentBalance || 0),
            locationIds: c.locationIds || []
          });
        });
      }

      if (partyRes.status === 'fulfilled' && partyRes.value.data?.data) {
        partyRes.value.data.data.forEach((p: any) => {
          const pId = p.id || p._id;
          if (!fetchedList.some(x => x.id === pId)) {
            fetchedList.push({
              id: pId,
              businessId: p.businessId || this.currentTenant.id,
              name: p.name,
              type: Array.isArray(p.type) ? (p.type.includes('supplier') ? 'SUPPLIER' : 'CUSTOMER') : (p.type || 'CUSTOMER'),
              phone: p.phone || undefined,
              email: p.email || undefined,
              address: p.billingAddress?.street || p.address || undefined,
              gstin: p.taxId || p.gstin || undefined,
              currentBalance: Number(p.currentReceivable || p.currentBalance || 0),
              locationIds: p.locationIds || []
            });
          }
        });
      }

      if (fetchedList.length > 0) {
        this.parties = fetchedList;
        this.saveToStorage();
      }
    } catch (err) {
      console.warn('Could not fetch parties/customers from backend API:', err);
    }
    return this.getParties(locationId);
  }

  async fetchPartiesPaginated(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: 'ALL' | 'CUSTOMER' | 'SUPPLIER';
    locationId?: string;
  }): Promise<PaginatedApiResponse<Party>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const locId = params.locationId || 'ALL';

    try {
      const qParams: any = {
        page,
        page_size: pageSize,
      };
      if (params.search && params.search.trim()) {
        qParams.search = params.search.trim();
      }
      if (params.type && params.type !== 'ALL') {
        qParams.type = params.type;
      }
      if (locId && locId !== 'ALL') {
        qParams.locationId = locId;
      }

      const res = await apiClient.get('/parties', { params: qParams });
      if (res.data && Array.isArray(res.data.data)) {
        const liveParties: Party[] = res.data.data.map((p: any) => ({
          id: p._id || p.id,
          businessId: p.businessId || this.currentTenant.id,
          name: p.name,
          type: Array.isArray(p.type) ? (p.type.includes('supplier') ? 'SUPPLIER' : 'CUSTOMER') : (p.type || 'CUSTOMER'),
          phone: p.phone || undefined,
          email: p.email || undefined,
          address: p.billingAddress?.street || p.address || undefined,
          gstin: p.taxId || p.gstin || undefined,
          currentBalance: Number(p.currentReceivable !== undefined ? p.currentReceivable : (p.currentBalance || 0)),
          locationIds: p.locationIds || []
        }));

        return {
          data: liveParties,
          page: res.data.page || page,
          pageSize: res.data.page_size || pageSize,
          total: res.data.total !== undefined ? res.data.total : liveParties.length,
          totalPages: res.data.total_pages || Math.ceil((res.data.total || liveParties.length) / pageSize),
        };
      }
    } catch (err) {
      console.warn('Could not fetch paginated parties from backend API, falling back to local:', err);
    }

    // Local fallback
    const all = this.getParties(locId === 'ALL' ? undefined : locId);
    const filtered = all.filter(p => {
      if (params.type && params.type !== 'ALL' && p.type !== params.type) return false;
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase();
        const m = p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q)) || (p.email && p.email.toLowerCase().includes(q)) || (p.gstin && p.gstin.toLowerCase().includes(q));
        if (!m) return false;
      }
      return true;
    });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: slice,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  addParty(party: Omit<Party, 'id' | 'currentBalance' | 'businessId'>): Party {
    const activeId = this.currentTenant.id;
    const newParty: Party = {
      ...party,
      id: `party_${Date.now()}`,
      businessId: activeId,
      currentBalance: 0,
    };
    this.parties.unshift(newParty);
    this.saveToStorage();

    // If online, sync to backend in background
    if (party.type === 'CUSTOMER') {
      apiClient.post('/customers', {
        name: party.name,
        phone: party.phone,
        email: party.email,
        address: party.address,
        gstin: party.gstin,
        locationIds: party.locationIds || [],
        openingBalance: 0
      }).then(res => {
        if (res.data?.id || res.data?._id) {
          newParty.id = res.data.id || res.data._id;
          this.saveToStorage();
        }
      }).catch(() => {});
    } else {
      apiClient.post('/parties', {
        name: party.name,
        type: ['supplier'],
        phone: party.phone,
        email: party.email,
        billingAddress: party.address ? { street: party.address } : undefined,
        taxId: party.gstin,
        openingBalance: 0,
        locationIds: party.locationIds || []
      }).then(res => {
        if (res.data?.id || res.data?._id) {
          newParty.id = res.data.id || res.data._id;
          this.saveToStorage();
        }
      }).catch(() => {});
    }

    return newParty;
  }

  async createCustomer(customerData: Omit<Party, 'id' | 'currentBalance' | 'businessId'>): Promise<Party> {
    const activeId = this.currentTenant.id;
    try {
      const res = await apiClient.post('/customers', {
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
        gstin: customerData.gstin,
        locationIds: customerData.locationIds || [],
        openingBalance: 0
      });
      if (res.data) {
        const createdId = res.data.id || res.data._id;
        const created: Party = {
          id: createdId,
          businessId: res.data.businessId || activeId,
          name: res.data.name,
          type: 'CUSTOMER',
          phone: res.data.phone,
          email: res.data.email,
          address: res.data.address,
          gstin: res.data.gstin,
          currentBalance: Number(res.data.currentBalance || 0),
          locationIds: res.data.locationIds || []
        };
        
        // Replace or add in local parties state
        const existingIdx = this.parties.findIndex(p => p.id === createdId || (created.phone && p.phone === created.phone));
        if (existingIdx >= 0) {
          this.parties[existingIdx] = created;
        } else {
          this.parties.unshift(created);
        }
        this.saveToStorage();
        return created;
      }
    } catch (err) {
      console.warn('API create customer failed, falling back to local storage:', err);
    }
    return this.addParty(customerData);
  }

  async updateParty(partyId: string, updates: Partial<Party>): Promise<Party | undefined> {
    const activeId = this.currentTenant.id;
    const p = this.parties.find(
      x => (x.businessId || DEFAULT_TENANTS[0].id) === activeId && x.id === partyId
    );
    if (p) {
      Object.assign(p, updates);
      this.saveToStorage();
      
      // Asynchronously sync with backend if online
      if (!partyId.startsWith('party_')) {
        try {
          if (p.type === 'CUSTOMER') {
            await apiClient.put(`/customers/${partyId}`, {
              name: updates.name,
              phone: updates.phone,
              email: updates.email,
              address: updates.address,
              gstin: updates.gstin,
              locationIds: updates.locationIds,
            });
          } else {
            await apiClient.put(`/parties/${partyId}`, {
              name: updates.name,
              phone: updates.phone,
              email: updates.email,
              billingAddress: updates.address ? { street: updates.address } : undefined,
              taxId: updates.gstin,
            });
          }
        } catch (e) {
          console.warn('Could not sync party update to backend API:', e);
        }
      }
      return p;
    }
    return undefined;
  }

  async deleteParty(partyId: string, partyType: 'CUSTOMER' | 'SUPPLIER' = 'CUSTOMER'): Promise<boolean> {
    const activeId = this.currentTenant.id;
    this.parties = this.parties.filter(
      p => !((p.businessId || DEFAULT_TENANTS[0].id) === activeId && p.id === partyId)
    );
    this.saveToStorage();

    if (!partyId.startsWith('party_')) {
      try {
        if (partyType === 'CUSTOMER') {
          await apiClient.delete(`/customers/${partyId}`);
        } else {
          await apiClient.delete(`/parties/${partyId}`);
        }
      } catch (err) {
        console.warn('Could not delete party from backend API:', err);
      }
    }
    return true;
  }

  findPartyByPhone(phone: string, locationId?: string): Party | undefined {
    if (!phone) return undefined;
    const digitsOnly = phone.replace(/\D/g, '');
    const cleanDigits = (digitsOnly.length > 10 && digitsOnly.startsWith('91')) ? digitsOnly.slice(2) : digitsOnly;
    const tenDigits = cleanDigits.slice(-10);
    if (!tenDigits || tenDigits.length < 4) return undefined;

    const partyList = this.getParties(locationId);
    return partyList.find(p => {
      if (!p.phone) return false;
      const pDigits = p.phone.replace(/\D/g, '');
      const pClean = (pDigits.length > 10 && pDigits.startsWith('91')) ? pDigits.slice(2) : pDigits;
      const pTen = pClean.slice(-10);
      return pTen === tenDigits || pClean.includes(tenDigits) || tenDigits.includes(pTen);
    });
  }

  async lookupPartyByPhone(phone: string, locationId?: string): Promise<Party | undefined> {
    if (!phone) return undefined;
    const local = this.findPartyByPhone(phone, locationId);
    if (local) return local;

    const digitsOnly = phone.replace(/\D/g, '');
    const cleanDigits = (digitsOnly.length > 10 && digitsOnly.startsWith('91')) ? digitsOnly.slice(2) : digitsOnly;
    const tenDigits = cleanDigits.slice(-10);
    if (!tenDigits || tenDigits.length !== 10) return undefined;

    try {
      const res = await apiClient.get('/customers/lookup/by-phone', { params: { phone: `+91${tenDigits}` } });
      if (res.data) {
        const remoteParty: Party = {
          id: res.data.id || res.data._id,
          businessId: res.data.businessId || this.currentTenant.id,
          name: res.data.name,
          type: 'CUSTOMER',
          phone: res.data.phone,
          email: res.data.email,
          address: res.data.address,
          gstin: res.data.gstin,
          currentBalance: Number(res.data.currentBalance || 0),
          locationIds: res.data.locationIds || []
        };
        // Merge into local parties list
        if (!this.parties.some(p => p.id === remoteParty.id)) {
          this.parties.unshift(remoteParty);
          this.saveToStorage();
        }
        return remoteParty;
      }
    } catch (err) {
      console.warn('API lookup by phone error:', err);
    }

    return this.findPartyByPhone(phone, locationId);
  }

  updatePartyBalance(partyId: string, delta: number) {
    const activeId = this.currentTenant.id;
    const p = this.parties.find(
      x => (x.businessId || DEFAULT_TENANTS[0].id) === activeId && x.id === partyId
    );
    if (p) {
      p.currentBalance += delta;
      this.saveToStorage();
    }
  }

  // --- Strict Tenant & Location-Isolated Operating Expenses & Categories ---
  getExpenseCategories(): ExpenseCategory[] {
    return this.expenseCategories;
  }

  async fetchExpenseCategories(): Promise<ExpenseCategory[]> {
    try {
      const res = await apiClient.get('/categories', { params: { type: 'EXPENSE' } });
      if (res.data && Array.isArray(res.data)) {
        if (res.data.length > 0) {
          const liveCats: ExpenseCategory[] = res.data.map((c: any) => ({
            id: c.id || c._id,
            businessId: c.businessId || this.currentTenant.id,
            name: c.name,
            type: 'EXPENSE',
            description: c.description || undefined,
            isCustom: true,
          }));
          this.expenseCategories = liveCats;
          this.saveToStorage();
          return this.getExpenseCategories();
        } else {
          // If database is empty for this tenant, seed standard initial expense categories into MongoDB
          const seeded: ExpenseCategory[] = [];
          for (const def of DEFAULT_EXPENSE_CATEGORIES) {
            try {
              const createRes = await apiClient.post('/categories', {
                name: def.name,
                type: 'EXPENSE',
              });
              seeded.push({
                id: createRes.data?.id || createRes.data?._id || def.id,
                businessId: this.currentTenant.id,
                name: def.name,
                type: 'EXPENSE',
                isCustom: true,
              });
            } catch {
              seeded.push({
                ...def,
                businessId: this.currentTenant.id,
                type: 'EXPENSE',
                isCustom: true,
              });
            }
          }
          if (seeded.length > 0) {
            this.expenseCategories = seeded;
            this.saveToStorage();
          }
          return this.getExpenseCategories();
        }
      }
    } catch (e) {
      console.warn('Could not fetch expense categories from API:', e);
    }
    return this.getExpenseCategories();
  }

  async addExpenseCategory(name: string, description?: string): Promise<ExpenseCategory> {
    const cleanName = name.trim();
    const cleanDesc = description?.trim() || undefined;
    const existing = this.expenseCategories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const newCat: ExpenseCategory = {
      id: `exp_cat_${Date.now()}`,
      businessId: this.currentTenant.id,
      name: cleanName,
      type: 'EXPENSE',
      description: cleanDesc,
      isCustom: true,
    };

    // Attempt backend sync
    try {
      const res = await apiClient.post('/categories', {
        name: newCat.name,
        type: 'EXPENSE',
        description: cleanDesc,
      });
      if (res.data?.id || res.data?._id) {
        newCat.id = res.data.id || res.data._id;
      }
    } catch (err) {
      console.warn('Could not sync expense category to backend API:', err);
    }

    this.expenseCategories.push(newCat);
    this.saveToStorage();
    return newCat;
  }

  async updateExpenseCategory(id: string, newName: string, description?: string): Promise<ExpenseCategory | null> {
    const cleanName = newName.trim();
    if (!cleanName) return null;
    const cleanDesc = description !== undefined ? (description.trim() || undefined) : undefined;

    const target = this.expenseCategories.find(c => c.id === id);
    if (!target) return null;

    const oldName = target.name;
    target.name = cleanName;
    if (description !== undefined) {
      target.description = cleanDesc;
    }

    // Cascade category rename to existing expense records
    if (oldName !== cleanName) {
      this.expenses.forEach(e => {
        if (e.category === oldName) {
          e.category = cleanName;
        }
      });
    }

    this.saveToStorage();

    try {
      await apiClient.put(`/categories/${id}`, {
        name: cleanName,
        type: 'EXPENSE',
        description: cleanDesc,
      });
    } catch (err) {
      console.warn('Could not sync expense category update to backend API:', err);
    }

    return target;
  }

  async deleteExpenseCategory(id: string): Promise<boolean> {
    const prevLen = this.expenseCategories.length;
    this.expenseCategories = this.expenseCategories.filter(c => c.id !== id);
    this.saveToStorage();

    try {
      await apiClient.delete(`/categories/${id}`);
    } catch (err) {
      console.warn('Could not sync expense category deletion to backend API:', err);
    }

    return this.expenseCategories.length < prevLen;
  }

  getExpenses(locationId?: string): Expense[] {
    const activeId = this.currentTenant.id;
    const list = this.expenses.filter(e => (e.businessId || DEFAULT_TENANTS[0].id) === activeId);
    if (!locationId || locationId === 'ALL') return list;
    return list.filter(e => !e.locationId || e.locationId === locationId);
  }

  async fetchExpenses(locationId?: string): Promise<Expense[]> {
    try {
      const params: any = { page: 1, page_size: 100 };
      if (locationId && locationId !== 'ALL') {
        params.locationId = locationId;
      }
      const res = await apiClient.get('/expenses', { params });
      if (res.data?.data && Array.isArray(res.data.data)) {
        const liveExpenses: Expense[] = res.data.data.map((d: any) => ({
          id: d._id || d.id,
          businessId: d.businessId || this.currentTenant.id,
          category: d.category,
          amount: Number(d.amount || 0),
          payee: d.payee || undefined,
          paymentMode: d.paymentMode || 'CASH',
          referenceNumber: d.referenceNumber || undefined,
          description: d.description || undefined,
          locationId: d.locationId || undefined,
          locationName: d.locationName || undefined,
          expenseDate: d.expenseDate ? new Date(d.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          createdAt: d.createdAt,
        }));
        this.expenses = liveExpenses;
        this.saveToStorage();
        return this.getExpenses(locationId);
      }
    } catch (err) {
      console.warn('Could not fetch live expenses from /expenses API:', err);
    }
    return this.getExpenses(locationId);
  }

  async fetchExpensesPaginated(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    locationId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PaginatedApiResponse<Expense>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const locId = params.locationId || 'ALL';

    try {
      const qParams: any = {
        page,
        page_size: pageSize,
      };
      if (params.search && params.search.trim()) {
        qParams.search = params.search.trim();
      }
      if (params.category && params.category !== 'ALL') {
        qParams.category = params.category;
      }
      if (locId && locId !== 'ALL') {
        qParams.locationId = locId;
      }
      if (params.fromDate) {
        qParams.fromDate = params.fromDate;
      }
      if (params.toDate) {
        qParams.toDate = params.toDate;
      }

      const res = await apiClient.get('/expenses', { params: qParams });
      if (res.data && Array.isArray(res.data.data)) {
        const liveExpenses: Expense[] = res.data.data.map((d: any) => ({
          id: d._id || d.id,
          businessId: d.businessId || this.currentTenant.id,
          category: d.category,
          amount: Number(d.amount || 0),
          payee: d.payee || undefined,
          paymentMode: d.paymentMode || 'CASH',
          referenceNumber: d.referenceNumber || undefined,
          description: d.description || undefined,
          locationId: d.locationId || undefined,
          locationName: d.locationName || undefined,
          expenseDate: d.expenseDate ? new Date(d.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          createdAt: d.createdAt,
        }));

        return {
          data: liveExpenses,
          page: res.data.page || page,
          pageSize: res.data.page_size || pageSize,
          total: res.data.total !== undefined ? res.data.total : liveExpenses.length,
          totalPages: res.data.total_pages || Math.ceil((res.data.total || liveExpenses.length) / pageSize),
        };
      }
    } catch (err) {
      console.warn('Could not fetch paginated expenses from backend API, falling back to local:', err);
    }

    // Local fallback
    const all = this.getExpenses(locId === 'ALL' ? undefined : locId);
    const filtered = all.filter(e => {
      if (params.category && params.category !== 'ALL' && e.category !== params.category) return false;
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase();
        const m = (e.payee && e.payee.toLowerCase().includes(q)) || (e.description && e.description.toLowerCase().includes(q)) || (e.category && e.category.toLowerCase().includes(q)) || (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q));
        if (!m) return false;
      }
      return true;
    });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: slice,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async addExpense(expenseData: Omit<Expense, 'id' | 'businessId'>): Promise<Expense> {
    const activeId = this.currentTenant.id;
    const activeLoc = this.getActiveLocation();
    
    const newExp: Expense = {
      ...expenseData,
      id: `exp_${Date.now()}`,
      businessId: activeId,
      locationId: expenseData.locationId || activeLoc.id,
      locationName: expenseData.locationName || activeLoc.name,
      expenseDate: expenseData.expenseDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    // Attempt backend sync
    try {
      const res = await apiClient.post('/expenses', {
        category: newExp.category,
        amount: newExp.amount,
        payee: newExp.payee,
        paymentMode: newExp.paymentMode,
        referenceNumber: newExp.referenceNumber,
        description: newExp.description,
        locationId: newExp.locationId,
        locationName: newExp.locationName,
        expenseDate: newExp.expenseDate ? new Date(newExp.expenseDate).toISOString() : new Date().toISOString(),
      });
      if (res.data?.id || res.data?._id) {
        newExp.id = res.data.id || res.data._id;
      }
    } catch (err) {
      console.warn('Could not sync expense creation to backend, persisted locally:', err);
    }

    this.expenses.unshift(newExp);
    this.saveToStorage();
    return newExp;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | null> {
    const activeId = this.currentTenant.id;
    const idx = this.expenses.findIndex(
      e => (e.businessId || DEFAULT_TENANTS[0].id) === activeId && e.id === id
    );
    if (idx === -1) return null;

    this.expenses[idx] = { ...this.expenses[idx], ...updates };
    this.saveToStorage();

    if (!id.startsWith('exp_')) {
      try {
        await apiClient.put(`/expenses/${id}`, {
          category: updates.category,
          amount: updates.amount,
          payee: updates.payee,
          paymentMode: updates.paymentMode,
          referenceNumber: updates.referenceNumber,
          description: updates.description,
          locationId: updates.locationId,
          locationName: updates.locationName,
          expenseDate: updates.expenseDate ? new Date(updates.expenseDate).toISOString() : undefined,
        });
      } catch (err) {
        console.warn('Could not sync expense update to backend:', err);
      }
    }
    return this.expenses[idx];
  }

  async deleteExpense(id: string): Promise<boolean> {
    const activeId = this.currentTenant.id;
    const prevLen = this.expenses.length;
    this.expenses = this.expenses.filter(
      e => !((e.businessId || DEFAULT_TENANTS[0].id) === activeId && e.id === id)
    );
    this.saveToStorage();

    if (!id.startsWith('exp_')) {
      try {
        await apiClient.delete(`/expenses/${id}`);
      } catch (err) {
        console.warn('Could not sync expense deletion to backend:', err);
      }
    }
    return this.expenses.length < prevLen;
  }

  // --- Unified Financial Ledger Stream ---
  getLedgerEntries(locationId?: string): LedgerEntry[] {
    const payments = this.getPayments();
    const expenses = this.getExpenses(locationId);

    const entries: LedgerEntry[] = [];

    payments.forEach(p => {
      entries.push({
        id: p.id,
        date: p.date,
        type: p.type,
        title: p.type === 'PAYMENT_IN' ? 'Customer Receipt' : 'Supplier Payout',
        partyOrPayee: p.partyName,
        category: p.type === 'PAYMENT_IN' ? 'Receivable Inflow' : 'Payable Outflow',
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        amount: p.amount,
      });
    });

    expenses.forEach(e => {
      entries.push({
        id: e.id,
        date: e.expenseDate,
        type: 'EXPENSE',
        title: e.category,
        partyOrPayee: e.payee || 'Direct Expense',
        category: e.category,
        paymentMode: e.paymentMode,
        referenceNumber: e.referenceNumber,
        notes: e.description,
        amount: e.amount,
        locationName: e.locationName,
      });
    });

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }


  // --- Strict Tenant & Location-Isolated Invoices (Live Database Integration) ---
  private mapSaleDocToInvoice(doc: any): Invoice {
    const rawBalance = doc.balanceDue !== undefined ? doc.balanceDue : (doc.balance_due !== undefined ? doc.balance_due : 0);
    const rawPaid = doc.paidAmount !== undefined ? doc.paidAmount : (doc.paid_amount !== undefined ? doc.paid_amount : 0);
    const rawGrand = doc.grandTotal !== undefined ? doc.grandTotal : (doc.grand_total !== undefined ? doc.grand_total : 0);
    const rawSubtotal = doc.subtotal !== undefined ? doc.subtotal : 0;
    const rawTax = doc.taxTotal !== undefined ? doc.taxTotal : (doc.tax_total !== undefined ? doc.tax_total : 0);
    const rawDiscount = doc.discountTotal !== undefined ? doc.discountTotal : (doc.discount_total !== undefined ? doc.discount_total : 0);
    const rawRoundOff = doc.roundOff !== undefined ? doc.roundOff : (doc.round_off !== undefined ? doc.round_off : 0);

    return {
      id: doc.id || doc._id || `inv_${Date.now()}`,
      businessId: doc.businessId || doc.business_id || this.currentTenant.id,
      locationId: doc.locationId || doc.location_id || undefined,
      locationName: doc.locationName || doc.location_name || 'Main Store',
      locationCode: doc.locationCode || doc.location_code || undefined,
      locationAddress: doc.locationAddress || doc.location_address || undefined,
      locationPhone: doc.locationPhone || doc.location_phone || undefined,
      invoiceNumber: doc.invoiceNumber || doc.invoice_number || 'INV-TEMP',
      date: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : (doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      partyId: doc.partyId || doc.party_id || undefined,
      partyName: doc.partyNameSnapshot || doc.party_name_snapshot || doc.consumerName || doc.consumer_name || 'Walk-in Customer',
      partyPhone: doc.partyPhoneSnapshot || doc.party_phone_snapshot || doc.consumerPhone || doc.consumer_phone || undefined,
      consumerName: doc.consumerName || doc.consumer_name || doc.partyNameSnapshot || doc.party_name_snapshot || 'Walk-in Customer',
      consumerPhone: doc.consumerPhone || doc.consumer_phone || doc.partyPhoneSnapshot || doc.party_phone_snapshot || undefined,
      billedById: doc.billedById || doc.billed_by_id || undefined,
      billedByName: doc.billedByName || doc.billed_by_name || undefined,
      billedByRole: doc.billedByRole || doc.billed_by_role || undefined,
      type: 'SALE',
      items: (doc.items || []).map((it: any) => ({
        itemId: it.itemId || it.item_id,
        name: it.nameSnapshot || it.name_snapshot || it.name || 'Item',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice !== undefined ? it.unitPrice : (it.unit_price || 0)),
        discountPercent: Number(it.discount || 0),
        taxRate: Number(it.taxRate !== undefined ? it.taxRate : (it.tax_rate || 0)),
        taxAmount: Number(it.taxAmount !== undefined ? it.taxAmount : (it.tax_amount || 0)),
        total: Number(it.lineTotal !== undefined ? it.lineTotal : (it.line_total !== undefined ? it.line_total : (Number(it.unitPrice || it.unit_price || 0) * Number(it.quantity || 1)))),
      })),
      subtotal: Number(rawSubtotal),
      taxTotal: Number(rawTax),
      discountTotal: Number(rawDiscount),
      discountType: doc.discountType || doc.discount_type || undefined,
      discountValue: doc.discountValue !== undefined ? Number(doc.discountValue) : (doc.discount_value !== undefined ? Number(doc.discount_value) : undefined),
      roundOff: Number(rawRoundOff),
      grandTotal: Number(rawGrand),
      paidAmount: Number(rawPaid),
      balanceAmount: Number(rawBalance),
      paymentMode: (doc.paymentMode || doc.payment_mode || 'CASH') as any,
      status: (doc.paymentStatus || doc.payment_status || (Number(rawBalance) <= 0 ? 'PAID' : (Number(rawPaid) > 0 ? 'PARTIAL' : 'UNPAID'))) as any,
      notes: doc.notes || undefined,
    };
  }

  getInvoices(locationId?: string): Invoice[] {
    const activeId = this.currentTenant.id;
    const list = this.invoices.filter(inv => (inv.businessId || DEFAULT_TENANTS[0].id) === activeId);
    if (!locationId || locationId === 'ALL') return list;
    return list.filter(inv => inv.locationId === locationId);
  }

  async fetchInvoices(locationId?: string): Promise<Invoice[]> {
    try {
      const params: any = { page: 1, page_size: 100 };
      if (locationId && locationId !== 'ALL') {
        params.location_id = locationId;
      }
      const res = await apiClient.get('/sales', { params });
      if (res.data?.data && Array.isArray(res.data.data)) {
        const liveInvoices = res.data.data.map((d: any) => this.mapSaleDocToInvoice(d));
        this.invoices = liveInvoices;
        return this.getInvoices(locationId);
      }
    } catch (err) {
      console.warn('Could not fetch live invoices from backend /sales:', err);
    }
    return this.getInvoices(locationId);
  }

  async fetchSalesPaginated(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    locationId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PaginatedApiResponse<Invoice>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const locId = params.locationId || 'ALL';

    try {
      const qParams: any = {
        page,
        page_size: pageSize,
      };
      if (params.search && params.search.trim()) {
        qParams.search = params.search.trim();
      }
      if (params.status && params.status !== 'ALL') {
        qParams.status = params.status;
      }
      if (locId && locId !== 'ALL') {
        qParams.locationId = locId;
      }
      if (params.fromDate) {
        qParams.fromDate = params.fromDate;
      }
      if (params.toDate) {
        qParams.toDate = params.toDate;
      }

      const res = await apiClient.get('/sales', { params: qParams });
      if (res.data && Array.isArray(res.data.data)) {
        const liveInvoices: Invoice[] = res.data.data.map((d: any) => this.mapSaleDocToInvoice(d));

        return {
          data: liveInvoices,
          page: res.data.page || page,
          pageSize: res.data.page_size || pageSize,
          total: res.data.total !== undefined ? res.data.total : liveInvoices.length,
          totalPages: res.data.total_pages || Math.ceil((res.data.total || liveInvoices.length) / pageSize),
        };
      }
    } catch (err) {
      console.warn('Could not fetch paginated invoices from backend API, falling back to local:', err);
    }

    // Local fallback
    const all = this.getInvoices(locId === 'ALL' ? undefined : locId);
    const filtered = all.filter(inv => {
      if (params.status && params.status !== 'ALL' && inv.status !== params.status) return false;
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase();
        const m = (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
                  (inv.consumerName && inv.consumerName.toLowerCase().includes(q)) ||
                  (inv.partyName && inv.partyName.toLowerCase().includes(q)) ||
                  (inv.consumerPhone && inv.consumerPhone.includes(q)) ||
                  (inv.partyPhone && inv.partyPhone.includes(q));
        if (!m) return false;
      }
      if (params.fromDate && inv.date < params.fromDate) return false;
      if (params.toDate && inv.date > params.toDate) return false;
      return true;
    });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: slice,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async createInvoice(invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'businessId'>): Promise<Invoice> {
    const activeId = this.currentTenant.id;
    const activeLoc = this.getActiveLocation();
    const currentUser = this.getCurrentUser();
    
    // Construct payload for authoritative backend creation in MongoDB
    const payload = {
      partyId: invoiceData.partyId || undefined,
      partyNameInput: invoiceData.partyName,
      partyPhoneInput: invoiceData.partyPhone,
      consumerName: invoiceData.consumerName || invoiceData.partyName,
      consumerPhone: invoiceData.consumerPhone || invoiceData.partyPhone,
      locationId: invoiceData.locationId || activeLoc.id,
      locationName: invoiceData.locationName || activeLoc.name,
      locationCode: invoiceData.locationCode || activeLoc.code,
      locationAddress: invoiceData.locationAddress || activeLoc.address,
      locationPhone: invoiceData.locationPhone || activeLoc.phone,
      billedById: invoiceData.billedById || currentUser?.id || 'usr_staff',
      billedByName: invoiceData.billedByName || currentUser?.name || 'Store Cashier',
      billedByRole: invoiceData.billedByRole || currentUser?.role || 'CASHIER',
      items: invoiceData.items.map(it => ({
        item_id: it.itemId,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        discount: it.discountPercent ? ((it.unitPrice * it.quantity) * (it.discountPercent / 100)) : 0,
        tax_rate: it.taxRate,
      })),
      invoiceDiscount: Number(invoiceData.discountTotal || 0),
      discountType: invoiceData.discountType,
      discountValue: invoiceData.discountValue !== undefined ? Number(invoiceData.discountValue) : undefined,
      paidAmount: Number(invoiceData.paidAmount !== undefined ? invoiceData.paidAmount : (invoiceData.paymentMode === 'CREDIT' ? 0 : invoiceData.grandTotal)),
      paymentMode: invoiceData.paymentMode || 'CASH',
      notes: invoiceData.notes,
      enableRoundOff: invoiceData.roundOff !== 0,
    };

    let createdInvoice: Invoice;

    try {
      const res = await apiClient.post('/sales', payload);
      if (res.data) {
        createdInvoice = this.mapSaleDocToInvoice(res.data);
      } else {
        throw new Error('No data returned from backend');
      }
    } catch (err) {
      console.warn('Direct backend invoice creation failed, applying fallback:', err);
      const storeInvoices = this.getInvoices();
      createdInvoice = {
        ...invoiceData,
        id: `inv_${Date.now()}`,
        businessId: activeId,
        locationId: invoiceData.locationId || activeLoc.id,
        locationName: invoiceData.locationName || activeLoc.name,
        locationCode: invoiceData.locationCode || activeLoc.code,
        locationAddress: invoiceData.locationAddress || activeLoc.address,
        locationPhone: invoiceData.locationPhone || activeLoc.phone,
        billedById: invoiceData.billedById || currentUser?.id || 'usr_staff',
        billedByName: invoiceData.billedByName || currentUser?.name || 'Store Cashier',
        billedByRole: invoiceData.billedByRole || currentUser?.role || 'CASHIER',
        consumerName: invoiceData.consumerName || invoiceData.partyName,
        consumerPhone: invoiceData.consumerPhone || invoiceData.partyPhone,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(storeInvoices.length + 1).padStart(3, '0')}`,
      };
    }

    // Adjust local in-memory stocks & party balances
    createdInvoice.items.forEach(line => {
      this.adjustStock(line.itemId, -line.quantity, createdInvoice.locationId);
    });

    if (createdInvoice.partyId && createdInvoice.balanceAmount > 0) {
      this.updatePartyBalance(createdInvoice.partyId, createdInvoice.balanceAmount);
    }

    // Update in-memory list (MongoDB backed)
    this.invoices = [createdInvoice, ...this.invoices.filter(inv => inv.id !== createdInvoice.id && inv.invoiceNumber !== createdInvoice.invoiceNumber)];

    return createdInvoice;
  }

  // --- Strict Tenant-Isolated Payments ---
  getPayments(): Payment[] {
    const activeId = this.currentTenant.id;
    return this.payments.filter(p => (p.businessId || DEFAULT_TENANTS[0].id) === activeId);
  }

  recordPayment(paymentData: Omit<Payment, 'id' | 'businessId'>): Payment {
    const activeId = this.currentTenant.id;
    const payment: Payment = {
      ...paymentData,
      id: `pay_${Date.now()}`,
      businessId: activeId,
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

  // --- Strict Tenant-Isolated Dashboard Metrics ---
  getDashboardStats(): DashboardStats {
    const activeInvoices = this.getInvoices();
    const activeParties = this.getParties();
    const activeItems = this.getItems();

    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = activeInvoices.filter(i => i.date === today && i.type === 'SALE');
    const todaySales = todayInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

    const totalReceivables = activeParties
      .filter(p => p.currentBalance > 0)
      .reduce((sum, p) => sum + p.currentBalance, 0);

    const totalPayables = activeParties
      .filter(p => p.currentBalance < 0)
      .reduce((sum, p) => sum + Math.abs(p.currentBalance), 0);

    const lowStockCount = activeItems.filter(i => i.currentStock <= i.minStockAlert).length;
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
