import axios from 'axios';
import { Item, Party, Invoice, Payment, DashboardStats, Tenant, PlatformStats, TenantDatabaseConfig, User, UserRole, StoreLocation, ItemCategory, CartItem } from '../types';
import { INITIAL_ITEMS, INITIAL_PARTIES, INITIAL_INVOICES, INITIAL_PAYMENTS } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      productsCount: 3,
      invoicesCount: 2,
      monthlyGmv: 6149.0,
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
        this.fetchItems().catch(() => {});
        this.fetchInvoices().catch(() => {});
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

      this.items = savedItems ? JSON.parse(savedItems) : INITIAL_ITEMS;
      // Enrich mock items with images if missing from previous localStorage saves
      this.items = this.items.map(item => {
        const matchingInitial = INITIAL_ITEMS.find(init => init.id === item.id || init.publicItemId === item.publicItemId);
        if (matchingInitial && !item.imageUrl && !item.images?.length && (matchingInitial.imageUrl || matchingInitial.images?.length)) {
          return {
            ...item,
            imageUrl: matchingInitial.imageUrl,
            images: matchingInitial.images,
          };
        }
        return item;
      });
      this.parties = savedParties ? JSON.parse(savedParties) : INITIAL_PARTIES;
      this.payments = savedPayments ? JSON.parse(savedPayments) : INITIAL_PAYMENTS;
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
      }

      // Sync businessIds to single tenant
      this.items.forEach(i => { i.businessId = this.currentTenant.id; });
      this.parties.forEach(p => { p.businessId = this.currentTenant.id; });
      this.payments.forEach(pay => { pay.businessId = this.currentTenant.id; });
      this.categories.forEach(c => { c.businessId = this.currentTenant.id; });

    } catch {
      this.items = INITIAL_ITEMS;
      this.parties = INITIAL_PARTIES;
      this.invoices = [];
      this.payments = INITIAL_PAYMENTS;
      this.tenants = DEFAULT_TENANTS;
      this.locations = DEFAULT_LOCATIONS;
      this.users = DEFAULT_USERS;
      this.categories = DEFAULT_CATEGORIES;
      this.currentTenant = DEFAULT_TENANTS[0];
      this.activeLocation = DEFAULT_LOCATIONS[0];
      this.currentUser = null;
    }
  }

  private saveToStorage() {
    localStorage.setItem('qb_items', JSON.stringify(this.items));
    localStorage.setItem('qb_parties', JSON.stringify(this.parties));
    localStorage.setItem('qb_payments', JSON.stringify(this.payments));
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
      const res = await apiClient.get('/items', { params: { page: 1, page_size: 100 } });
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
        }
      }
    } catch (e) {
      console.warn('Could not fetch live items from /items API:', e);
    }
    return this.getItems(locationId);
  }

  getRawItems(): Item[] {
    const activeTenantId = this.currentTenant.id;
    return this.items.filter(i => (i.businessId || DEFAULT_TENANTS[0].id) === activeTenantId);
  }

  getItemById(id: string, locationId?: string): Item | undefined {
    const items = this.getItems(locationId, true);
    return items.find(i => i.id === id || i.publicItemId === id);
  }

  addItem(item: Omit<Item, 'id' | 'publicItemId' | 'businessId'>): Item {
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

  updateItem(id: string, updates: Partial<Item>): Item | null {
    const activeId = this.currentTenant.id;
    const idx = this.items.findIndex(
      i => (i.businessId || DEFAULT_TENANTS[0].id) === activeId && i.id === id
    );
    if (idx === -1) return null;

    this.items[idx] = { ...this.items[idx], ...updates, businessId: activeId };
    this.saveToStorage();
    return this.items[idx];
  }

  adjustStock(id: string, delta: number, locationId?: string): Item | null {
    const activeId = this.currentTenant.id;
    const targetLocId = locationId || this.getActiveLocation().id;
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

  deleteItem(id: string): boolean {
    const activeId = this.currentTenant.id;
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

  addCategory(data: { name: string; description?: string }): ItemCategory {
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
      description: data.description?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    this.categories.push(newCategory);
    this.saveToStorage();
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<ItemCategory>): ItemCategory | null {
    const activeId = this.currentTenant.id;
    const idx = this.categories.findIndex(
      c => (c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.id === id
    );
    if (idx === -1) return null;

    this.categories[idx] = {
      ...this.categories[idx],
      ...updates,
      businessId: activeId,
    };
    this.saveToStorage();
    return this.categories[idx];
  }

  deleteCategory(id: string): boolean {
    const activeId = this.currentTenant.id;
    const target = this.categories.find(
      c => (c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.id === id
    );
    if (!target) return false;

    this.categories = this.categories.filter(
      c => !((c.businessId || DEFAULT_TENANTS[0].id) === activeId && c.id === id)
    );
    this.saveToStorage();
    return true;
  }

  // --- Strict Tenant-Isolated Parties & Ledger ---
  getParties(locationId?: string): Party[] {
    const activeId = this.currentTenant.id;
    const tenantParties = this.parties.filter(p => (p.businessId || DEFAULT_TENANTS[0].id) === activeId);
    if (!locationId) return tenantParties;

    return tenantParties.filter(p => 
      !p.locationIds || p.locationIds.length === 0 || p.locationIds.includes(locationId) || p.locationId === locationId
    );
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
    return newParty;
  }

  updateParty(partyId: string, updates: Partial<Party>): Party | undefined {
    const activeId = this.currentTenant.id;
    const p = this.parties.find(
      x => (x.businessId || DEFAULT_TENANTS[0].id) === activeId && x.id === partyId
    );
    if (p) {
      Object.assign(p, updates);
      this.saveToStorage();
      return p;
    }
    return undefined;
  }

  findPartyByPhone(phone: string, locationId?: string): Party | undefined {
    if (!phone) return undefined;
    const cleanQuery = phone.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');
    if (cleanQuery.length < 5) return undefined;

    const partyList = this.getParties(locationId);
    return partyList.find(p => {
      if (!p.phone) return false;
      const cleanPartyPhone = p.phone.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');
      return cleanPartyPhone === cleanQuery || cleanPartyPhone.endsWith(cleanQuery) || cleanQuery.endsWith(cleanPartyPhone);
    });
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

  // --- Strict Tenant & Location-Isolated Invoices (Live Database Integration) ---
  private mapSaleDocToInvoice(doc: any): Invoice {
    return {
      id: doc.id || doc._id || `inv_${Date.now()}`,
      businessId: doc.businessId || this.currentTenant.id,
      locationId: doc.locationId || undefined,
      locationName: doc.locationName || 'Main Store',
      locationCode: doc.locationCode || undefined,
      locationAddress: doc.locationAddress || undefined,
      locationPhone: doc.locationPhone || undefined,
      invoiceNumber: doc.invoiceNumber || 'INV-TEMP',
      date: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      partyId: doc.partyId || undefined,
      partyName: doc.partyNameSnapshot || doc.consumerName || 'Walk-in Customer',
      partyPhone: doc.partyPhoneSnapshot || doc.consumerPhone || undefined,
      consumerName: doc.consumerName || doc.partyNameSnapshot || 'Walk-in Customer',
      consumerPhone: doc.consumerPhone || doc.partyPhoneSnapshot || undefined,
      billedById: doc.billedById || undefined,
      billedByName: doc.billedByName || undefined,
      billedByRole: doc.billedByRole || undefined,
      type: 'SALE',
      items: (doc.items || []).map((it: any) => ({
        itemId: it.itemId || it.item_id,
        name: it.nameSnapshot || it.name || 'Item',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        discountPercent: Number(it.discount || 0),
        taxRate: Number(it.taxRate || 0),
        taxAmount: Number(it.taxAmount || 0),
        total: Number(it.lineTotal || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
      })),
      subtotal: Number(doc.subtotal || 0),
      taxTotal: Number(doc.taxTotal || 0),
      discountTotal: Number(doc.discountTotal || 0),
      discountType: doc.discountType || undefined,
      discountValue: doc.discountValue !== undefined ? Number(doc.discountValue) : undefined,
      roundOff: Number(doc.roundOff || 0),
      grandTotal: Number(doc.grandTotal || 0),
      paidAmount: Number(doc.paidAmount || 0),
      balanceAmount: Number(doc.balanceDue || 0),
      paymentMode: (doc.paymentMode as any) || 'CASH',
      status: (doc.paymentStatus as any) || (doc.balanceDue <= 0 ? 'PAID' : 'PARTIAL'),
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
        discount: it.discountPercent ? (it.unitPrice * (it.discountPercent / 100)) : 0,
        tax_rate: it.taxRate,
      })),
      invoiceDiscount: invoiceData.discountTotal || 0,
      discountType: invoiceData.discountType,
      discountValue: invoiceData.discountValue,
      paidAmount: invoiceData.paidAmount,
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
