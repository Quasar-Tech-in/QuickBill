import axios from 'axios';
import { Item, Party, Invoice, Payment, DashboardStats, Tenant, PlatformStats, TenantDatabaseConfig, User, UserRole, StoreLocation, ItemCategory, CartItem, StagedOrder, Expense, ExpenseCategory, LedgerEntry, PaginatedApiResponse, PurchaseOrder, PurchaseOrderStatus, PurchasesSummaryReport, PurchasesBySupplierItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

class StoreService {
  private items: Item[] = [];
  private parties: Party[] = [];
  private invoices: Invoice[] = [];
  private payments: Payment[] = [];
  private expenses: Expense[] = [];
  private purchaseOrders: PurchaseOrder[] = [];
  private expenseCategories: ExpenseCategory[] = [];
  private tenants: Tenant[] = [];
  private locations: StoreLocation[] = [];
  private users: User[] = [];
  private categories: ItemCategory[] = [];
  private stagedOrders: StagedOrder[] = [];
  private activeLocation: StoreLocation | null = null;
  private currentTenant: Tenant | null = null;
  private isSuperAdminMode: boolean = false;
  private isOnline: boolean = false;
  private currentUser: User | null = null;
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(): void {
    this.listeners.forEach(l => {
      try { l(); } catch {}
    });
  }

  constructor() {
    this.loadFromStorage();
    this.setupAxiosInterceptors();
    this.checkHealth().then(isOnline => {
      if (isOnline) {
        this.fetchTenants().catch(() => {});
        this.fetchUsers().catch(() => {});
        this.fetchLocations().catch(() => {});
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
      const activeTenant = this.getActiveTenant();
      const targetBusinessId = this.isSuperAdmin()
        ? (this.currentTenant?.id || this.currentUser?.businessId)
        : (this.currentUser?.businessId || activeTenant?.id);

      if (targetBusinessId) {
        config.headers['X-Business-ID'] = targetBusinessId;
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
      this.expenseCategories = savedExpCats ? JSON.parse(savedExpCats) : [];
      this.tenants = savedTenants ? JSON.parse(savedTenants) : [];
      this.locations = savedLocations ? JSON.parse(savedLocations) : [];
      this.users = savedUsers ? JSON.parse(savedUsers) : [];
      this.categories = savedCategories ? JSON.parse(savedCategories) : [];
      this.currentTenant = this.tenants[0] || null;
      this.isSuperAdminMode = savedSuperAdmin === 'true';

      if (savedActiveLocId) {
        const foundLoc = this.locations.find(l => l.id === savedActiveLocId);
        this.activeLocation = foundLoc || this.locations[0] || null;
      } else {
        this.activeLocation = this.locations[0] || null;
      }

      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch {
          this.currentUser = null;
        }
      } else {
        this.currentUser = null;
      }

      if (this.currentUser?.businessId) {
        const matched = this.tenants.find(t => t.id === this.currentUser!.businessId);
        if (matched) {
          this.currentTenant = matched;
        }
      }

      const savedPOs = localStorage.getItem('qb_purchase_orders');
      this.purchaseOrders = savedPOs ? JSON.parse(savedPOs) : [];
      if (this.currentTenant?.id) {
        this.purchaseOrders.forEach(po => { po.businessId = this.currentTenant!.id; });
      }

      const savedStagedOrders = localStorage.getItem('qb_staged_orders');
      this.stagedOrders = savedStagedOrders ? JSON.parse(savedStagedOrders) : [];

    } catch {
      this.items = [];
      this.parties = [];
      this.invoices = [];
      this.payments = [];
      this.expenses = [];
      this.expenseCategories = [];
      this.tenants = [];
      this.locations = [];
      this.users = [];
      this.categories = [];
      this.currentTenant = null;
      this.activeLocation = null;
      this.currentUser = null;
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
    localStorage.setItem('qb_staged_orders', JSON.stringify(this.stagedOrders));
    localStorage.setItem('qb_active_location_id', this.activeLocation?.id || '');
    if (this.currentTenant?.id) {
      localStorage.setItem('qb_current_tenant_id', this.currentTenant.id);
    } else {
      localStorage.removeItem('qb_current_tenant_id');
    }
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
          tenantName: this.currentTenant?.name || 'QuickBill Store',
          token: res.data.access_token,
          assignedLocationIds: res.data.assigned_location_ids || [],
          isActive: true,
        };

        this.currentUser = authenticatedUser;
        this.isSuperAdminMode = userRole === 'SUPER_ADMIN';

        if (authenticatedUser.businessId) {
          const matchedTenant = this.tenants.find(t => t.id === authenticatedUser.businessId);
          if (matchedTenant) {
            this.currentTenant = matchedTenant;
          }
        }
        // Invalidate old session in-memory invoices
        this.invoices = [];

        // Match active location to user's assigned locations
        if (authenticatedUser.assignedLocationIds && authenticatedUser.assignedLocationIds.length > 0) {
          const matched = this.locations.find(l => authenticatedUser.assignedLocationIds?.includes(l.id));
          if (matched) this.activeLocation = matched;
        }

        this.saveToStorage();

        // Fetch and synchronize live tenant and subscription data from database
        try {
          await this.fetchActiveTenant();
          if (this.currentUser) {
            this.currentUser.tenantName = this.currentTenant?.name || 'QuickBill Store';
          }
        } catch (e) {
          console.warn('Initial tenant sync failed:', e);
        }

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

  async loginSuperAdminStep1(
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    requires_2fa?: boolean;
    requires_2fa_setup?: boolean;
    mfa_session_token?: string;
    setup_token?: string;
    otpauth_uri?: string;
    secret_key?: string;
    email?: string;
    error?: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Please provide both master email and password.' };
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/superadmin/login`, {
        email: cleanEmail,
        password: password,
      }, { timeout: 5000 });

      return {
        success: true,
        requires_2fa: res.data.requires_2fa,
        requires_2fa_setup: res.data.requires_2fa_setup,
        mfa_session_token: res.data.mfa_session_token,
        setup_token: res.data.setup_token,
        otpauth_uri: res.data.otpauth_uri,
        secret_key: res.data.secret_key,
        email: res.data.email,
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message;
      return {
        success: false,
        error: typeof errMsg === 'string' ? errMsg : 'Master credentials authentication failed.'
      };
    }
  }

  async verifySuperAdmin2FA(
    mfaSessionToken: string,
    code: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/superadmin/verify-2fa`, {
        mfa_session_token: mfaSessionToken,
        code: code.trim(),
      }, { timeout: 5000 });

      if (res.data?.access_token) {
        const authenticatedUser: User = {
          id: res.data.user_id,
          email: res.data.email,
          name: res.data.name || 'Super Administrator',
          role: 'SUPER_ADMIN',
          businessId: res.data.default_business_id || 'system_platform',
          tenantName: 'Platform Central Master Control',
          token: res.data.access_token,
          assignedLocationIds: [],
          isActive: true,
        };

        this.currentUser = authenticatedUser;
        this.isSuperAdminMode = true;
        this.saveToStorage();
        return { success: true, user: authenticatedUser };
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message;
      return {
        success: false,
        error: typeof errMsg === 'string' ? errMsg : 'Invalid Authenticator verification code.'
      };
    }

    return { success: false, error: 'Verification failed.' };
  }

  async confirmSuperAdmin2FASetup(
    setupToken: string,
    code: string
  ): Promise<{ success: boolean; user?: User; backup_codes?: string[]; error?: string }> {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/superadmin/confirm-2fa-setup`, {
        setup_token: setupToken,
        code: code.trim(),
      }, { timeout: 5000 });

      if (res.data?.access_token) {
        const authenticatedUser: User = {
          id: res.data.user_id,
          email: res.data.email,
          name: res.data.name || 'Super Administrator',
          role: 'SUPER_ADMIN',
          businessId: res.data.default_business_id || 'system_platform',
          tenantName: 'Platform Central Master Control',
          token: res.data.access_token,
          assignedLocationIds: [],
          isActive: true,
        };

        this.currentUser = authenticatedUser;
        this.isSuperAdminMode = true;
        this.saveToStorage();
        return { 
          success: true, 
          user: authenticatedUser,
          backup_codes: res.data.backup_codes || []
        };
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message;
      return {
        success: false,
        error: typeof errMsg === 'string' ? errMsg : 'Failed to confirm Authenticator setup code.'
      };
    }

    return { success: false, error: 'Setup confirmation failed.' };
  }

  async resetSuperAdmin2FA(): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post('/auth/superadmin/reset-2fa');
      return { success: true };
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message;
      return {
        success: false,
        error: typeof errMsg === 'string' ? errMsg : 'Failed to reset 2FA.'
      };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return {
        success: true,
        message: res.data?.message || 'Password successfully updated.'
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message;
      return {
        success: false,
        error: typeof errMsg === 'string' ? errMsg : 'Failed to update password. Please check your current password.'
      };
    }
  }

  logout() {
    this.currentUser = null;
    this.isSuperAdminMode = false;
    this.saveToStorage();
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Check health against configured API base URL (e.g. /api/v1/health)
      const res = await apiClient.get('/health', { timeout: 5000 });
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
    const tenantId = this.currentTenant?.id || user?.businessId || '';
    const tenantLocs = (!tenantId || this.isSuperAdmin()) 
      ? this.locations 
      : this.locations.filter(l => !l.businessId || l.businessId === tenantId);

    // Store Admin & Super Admin see all locations (including inactive for administration)
    if (!user || user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return tenantLocs;
    }
    // Managers and Cashiers see only their assigned ACTIVE locations
    const assignedIds = user.assignedLocationIds || [];
    const activeLocations = tenantLocs.filter(loc => loc.isActive !== false);
    if (assignedIds.length === 0) {
      return activeLocations.slice(0, 1);
    }
    return activeLocations.filter(loc => assignedIds.includes(loc.id));
  }

  getAllLocations(): StoreLocation[] {
    const tenantId = this.currentTenant?.id || this.currentUser?.businessId || '';
    if (!tenantId || this.isSuperAdmin()) {
      return this.locations;
    }
    return this.locations.filter(l => !l.businessId || l.businessId === tenantId);
  }

  async fetchLocations(): Promise<StoreLocation[]> {
    try {
      const res = await apiClient.get('/locations');
      if (res.data && Array.isArray(res.data)) {
        const liveLocs: StoreLocation[] = res.data.map((l: any) => ({
          id: l.id || l._id,
          businessId: l.businessId || this.currentTenant?.id || this.currentUser?.businessId || '',
          name: l.name,
          code: l.code,
          address: l.address || '',
          phone: l.phone || '',
          gstin: l.gstin || '',
          isDefault: !!l.isDefault,
          isActive: l.isActive !== undefined ? !!l.isActive : true,
          createdAt: l.createdAt || new Date().toISOString(),
        }));
        this.locations = liveLocs;
        this.saveToStorage();
        return liveLocs;
      }
    } catch (e) {
      console.warn('Could not fetch locations from backend API, using local:', e);
    }
    return this.getLocations();
  }

  getActiveLocation(): StoreLocation {
    const user = this.currentUser;
    const available = this.getLocations();

    // For Managers and Cashiers, ensure the active location is strictly active and in available list
    if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
      if (!this.activeLocation || this.activeLocation.isActive === false || !available.some(l => l.id === this.activeLocation?.id)) {
        if (available.length > 0) {
          this.activeLocation = available[0];
          this.saveToStorage();
        }
      }
    }

    return this.activeLocation || available[0] || this.locations.find(l => l.isActive !== false) || this.locations[0] || {
      id: 'loc_default',
      businessId: this.currentTenant?.id || '',
      name: 'Main Branch',
      code: 'MAIN',
      isDefault: true,
      isActive: true,
    };
  }

  setActiveLocation(locationOrId: string | StoreLocation): StoreLocation {
    const locId = typeof locationOrId === 'string' ? locationOrId : locationOrId.id;
    const user = this.currentUser;
    const available = this.getLocations();
    
    // If non-admin, only allow switching to an active, assigned location
    if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
      const isAllowed = available.some(l => l.id === locId && l.isActive !== false);
      if (!isAllowed) {
        return this.getActiveLocation();
      }
    }

    const found = this.locations.find(l => l.id === locId);
    if (found) {
      this.activeLocation = found;
      this.clearPosCart(); // Always empty POS cart upon location change
      this.saveToStorage();
    }
    return this.getActiveLocation();
  }

  async addLocation(locData: Omit<StoreLocation, 'id' | 'businessId' | 'createdAt' | 'isActive'>): Promise<StoreLocation> {
    const activeTenant = this.getActiveTenant();
    // Quota Limit Enforcement (unless Super Admin)
    if (!this.isSuperAdmin()) {
      const activeLocations = this.locations.filter(l => (l.businessId === activeTenant.id || !l.businessId) && l.isActive !== false);
      const maxLocationsAllowed = activeTenant.subscription?.maxLocations ?? 3;
      if (activeLocations.length >= maxLocationsAllowed) {
        throw new Error(`Subscription location limit reached (${activeLocations.length}/${maxLocationsAllowed} branches). Please contact Super Admin to upgrade your subscription.`);
      }
    }

    const newLoc: StoreLocation = {
      ...locData,
      id: `loc_${Date.now()}`,
      businessId: activeTenant.id,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await apiClient.post('/locations', {
        name: locData.name,
        code: locData.code,
        address: locData.address,
        phone: locData.phone,
        gstin: locData.gstin,
        isDefault: locData.isDefault || false,
      });
      if (res.data?.id || res.data?._id) {
        newLoc.id = res.data.id || res.data._id;
      }
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        throw new Error(err.response.data.detail);
      }
      console.warn('Backend /locations creation failed, fallback local:', err);
    }

    this.locations.push(newLoc);

    // Sync local items: ensure every item has a location entry for this new branch (isListed: false, stock: 0)
    this.items = this.items.map(item => {
      if (item.businessId === activeTenant.id || !item.businessId) {
        const itemLocs = item.locations ? [...item.locations] : [];
        if (!itemLocs.some(l => l.locationId === newLoc.id || l.locationId === newLoc.code)) {
          itemLocs.push({
            locationId: newLoc.id,
            locationName: newLoc.name,
            mrp: item.mrp ?? item.salePrice,
            salePrice: item.salePrice,
            purchasePrice: item.purchasePrice || 0,
            currentStock: 0,
            minStockAlert: item.minStockAlert || 5,
            isListed: false, // Tagged as deactivated/unlisted for new branch
            hasDiscount: item.hasDiscount || false,
            discountType: item.discountType || 'PERCENT',
            discountValue: item.discountValue || 0,
          });
          return { ...item, locations: itemLocs };
        }
      }
      return item;
    });

    this.saveToStorage();
    return newLoc;
  }

  async updateLocation(locationId: string, updates: Partial<StoreLocation>): Promise<StoreLocation | null> {
    const idx = this.locations.findIndex(l => l.id === locationId);
    if (idx === -1) return null;

    try {
      const res = await apiClient.put(`/locations/${locationId}`, updates);
      if (res.data) {
        const live: StoreLocation = {
          id: res.data.id || res.data._id || locationId,
          businessId: res.data.businessId || this.currentTenant?.id || '',
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
        this.saveToStorage();
        return live;
      }
    } catch (err) {
      console.warn(`Backend /locations/${locationId} update failed, applying fallback:`, err);
    }

    this.locations[idx] = { ...this.locations[idx], ...updates };
    
    // If active location was updated, update reference
    if (this.activeLocation?.id === locationId) {
      this.activeLocation = this.locations[idx];
    }

    this.saveToStorage();
    return this.locations[idx];
  }

  async deleteLocation(locationId: string): Promise<boolean> {
    const locToDelete = this.locations.find(l => l.id === locationId || l.code === locationId);
    const locKeys = [locationId];
    if (locToDelete) {
      locKeys.push(locToDelete.id, locToDelete.code);
    }

    try {
      await apiClient.delete(`/locations/${locationId}`);
    } catch (err) {
      console.warn(`Backend /locations/${locationId} delete failed:`, err);
    }

    const prevLen = this.locations.length;
    this.locations = this.locations.filter(l => l.id !== locationId && l.code !== locationId);
    
    // Clean up local items: pull this location entity from all items
    this.items = this.items.map(item => {
      if (item.locations && item.locations.length > 0) {
        return {
          ...item,
          locations: item.locations.filter(l => !locKeys.includes(l.locationId))
        };
      }
      return item;
    });

    // Clean up local users: pull location from assignedLocationIds
    this.users = this.users.map(u => {
      if (u.assignedLocationIds && u.assignedLocationIds.length > 0) {
        return {
          ...u,
          assignedLocationIds: u.assignedLocationIds.filter(id => !locKeys.includes(id))
        };
      }
      return u;
    });

    // If active location was deleted, fallback to first available active or default
    const activeLocId = this.activeLocation?.id;
    const activeLocCode = this.activeLocation?.code;
    if ((activeLocId && locKeys.includes(activeLocId)) || (activeLocCode && locKeys.includes(activeLocCode))) {
      this.activeLocation = this.locations.find(l => l.isDefault) || this.locations[0] || null;
    }

    this.saveToStorage();
    return this.locations.length < prevLen;
  }

  async syncLocationInventory(
    locationId: string,
    options: {
      mode: 'ALL_ENABLED' | 'ALL_DISABLED' | 'SELECTIVE';
      itemIds?: string[];
      defaultStock?: number;
    }
  ): Promise<{ success: boolean; message?: string; syncedCount: number }> {
    const loc = this.locations.find(l => l.id === locationId || l.code === locationId);
    const locId = loc?.id || locationId;
    const locName = loc?.name || 'Branch Outlet';
    const locCode = loc?.code || '';
    const selectedSet = new Set(options.itemIds || []);
    const defaultStock = options.defaultStock || 0;

    let apiSuccess = false;
    let apiCount = 0;
    let apiMsg = '';

    try {
      const res = await apiClient.post(`/locations/${locId}/sync-inventory`, {
        mode: options.mode,
        itemIds: options.itemIds,
        defaultStock: options.defaultStock,
      });
      if (res.data?.success) {
        apiSuccess = true;
        apiCount = res.data.syncedCount;
        apiMsg = res.data.message;
      }
    } catch (err) {
      console.warn(`Backend sync for location ${locId} failed, applying local sync:`, err);
    }

    // Local sync on in-memory items
    const tenantId = this.currentTenant?.id || '';
    let localSyncedCount = 0;

    this.items = this.items.map(item => {
      if (item.businessId === tenantId || !item.businessId) {
        localSyncedCount++;
        const itemLocs = item.locations ? [...item.locations] : [];
        const itemId = item.id || item.publicItemId || '';
        
        let isListed = false;
        if (options.mode === 'ALL_ENABLED') {
          isListed = true;
        } else if (options.mode === 'ALL_DISABLED') {
          isListed = false;
        } else {
          isListed = selectedSet.has(itemId) || selectedSet.has(item.publicItemId || '') || selectedSet.has(item.sku || '');
        }

        const existingIdx = itemLocs.findIndex(l => l.locationId === locId || (locCode && l.locationId === locCode));
        if (existingIdx !== -1) {
          itemLocs[existingIdx] = {
            ...itemLocs[existingIdx],
            locationName: locName,
            isListed: isListed,
            currentStock: (defaultStock > 0 && !itemLocs[existingIdx].currentStock) ? defaultStock : itemLocs[existingIdx].currentStock,
          };
        } else {
          itemLocs.push({
            locationId: locId,
            locationName: locName,
            mrp: item.mrp ?? item.salePrice,
            salePrice: item.salePrice,
            purchasePrice: item.purchasePrice || 0,
            currentStock: defaultStock,
            minStockAlert: item.minStockAlert || 5,
            isListed: isListed,
            hasDiscount: item.hasDiscount || false,
            discountType: item.discountType || 'PERCENT',
            discountValue: item.discountValue || 0,
          });
        }

        return { ...item, locations: itemLocs };
      }
      return item;
    });

    this.saveToStorage();
    
    // Refresh live items from backend if online
    if (this.isOnline) {
      await this.fetchItems().catch(() => {});
    }

    return {
      success: true,
      message: apiMsg || `Successfully synced ${localSyncedCount} items to branch ${locName}.`,
      syncedCount: apiCount || localSyncedCount,
    };
  }

  // --- Team & Staff Users Management ---
  async fetchUsers(): Promise<User[]> {
    try {
      const res = await apiClient.get('/users');
      if (Array.isArray(res.data)) {
        this.users = res.data.map((u: any) => ({
          id: u.id || u._id,
          name: u.name || '',
          email: u.email || '',
          role: u.role || 'CASHIER',
          businessId: u.businessId || u.tenantId || u.business_id || this.currentTenant?.id || this.currentUser?.businessId || '',
          tenantName: u.tenantName || u.tenant_name || '',
          assignedLocationIds: u.assignedLocationIds || u.assigned_location_ids || [],
          isActive: u.isActive !== undefined ? u.isActive : (u.is_active !== undefined ? u.is_active : true),
          createdAt: u.createdAt || u.created_at || new Date().toISOString(),
        }));
        this.saveToStorage();
        this.notifyListeners();
        return this.users;
      }
    } catch (e) {
      console.warn('Backend fetchUsers failed:', e);
    }
    return this.getUsers();
  }

  getUsers(): User[] {
    const activeTenantId = this.currentTenant?.id || this.currentUser?.businessId || '';
    if (!activeTenantId || this.isSuperAdmin()) {
      return this.users;
    }
    return this.users.filter(u => !u.businessId || u.businessId === activeTenantId);
  }

  async addUser(userData: { name: string; email: string; password?: string; role: UserRole; assignedLocationIds: string[] }): Promise<User> {
    const activeTenant = this.getActiveTenant();
    // Quota Limit Enforcement (unless Super Admin)
    if (!this.isSuperAdmin()) {
      const activeUsers = this.getUsers().filter(u => u.isActive !== false);
      const maxUsersAllowed = activeTenant.subscription?.maxUsers ?? 5;
      if (activeUsers.length >= maxUsersAllowed) {
        throw new Error(`Subscription user limit reached (${activeUsers.length}/${maxUsersAllowed} staff users). Please contact Super Admin to upgrade your subscription.`);
      }
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: userData.name,
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      businessId: activeTenant.id,
      tenantName: activeTenant.name,
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
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        throw new Error(err.response.data.detail);
      }
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

  getTenants(): Tenant[] {
    const now = new Date();
    const visibleTenants: Tenant[] = (this.isSuperAdmin() || !this.currentUser) 
      ? this.tenants 
      : (this.currentTenant ? [this.currentTenant] : []);

    return visibleTenants.filter((t): t is Tenant => Boolean(t && t.id)).map(t => {
      const activeTenantId = this.currentTenant?.id || '';
      const tenantItems = this.items.filter(i => (i.businessId || activeTenantId) === t.id);
      const tenantInvoices = this.invoices.filter(inv => (inv.businessId || activeTenantId) === t.id);
      const tenantUsers = this.users.filter(u => (u.businessId || activeTenantId) === t.id);
      const tenantLocations = this.locations.filter(l => (l.businessId || activeTenantId) === t.id);
      const monthlyGmv = tenantInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

      // Dynamically calculate days remaining and subscription status
      let sub = t.subscription;
      if (!sub) {
        sub = {
          planId: t.plan || 'PROFESSIONAL',
          planName: `${t.plan || 'Professional'} Tier`,
          status: 'ACTIVE',
          maxUsers: t.plan === 'STARTER' ? 2 : (t.plan === 'ENTERPRISE' ? 25 : 5),
          maxLocations: t.plan === 'STARTER' ? 1 : (t.plan === 'ENTERPRISE' ? 10 : 3),
          billingCycle: 'ANNUAL',
          startDate: t.createdAt || now.toISOString(),
          endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 365,
          gracePeriodDays: 7,
          features: ['pos', 'inventory', 'ledger'],
        };
      }

      let daysRemaining = sub.daysRemaining ?? 365;
      let calculatedStatus = sub.status;

      if (sub.endDate) {
        const endDt = new Date(sub.endDate);
        const diffTime = endDt.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const graceDays = sub.gracePeriodDays ?? 7;

        if (t.status === 'SUSPENDED' || sub.status === 'SUSPENDED') {
          calculatedStatus = 'SUSPENDED';
        } else if (daysRemaining < -graceDays) {
          calculatedStatus = 'EXPIRED';
        } else if (daysRemaining < 0) {
          calculatedStatus = 'GRACE_PERIOD';
        } else if (daysRemaining <= 14) {
          calculatedStatus = 'EXPIRING_SOON';
        } else {
          calculatedStatus = 'ACTIVE';
        }
      }

      return {
        ...t,
        subscription: {
          ...sub,
          daysRemaining,
          status: calculatedStatus,
        },
        stats: {
          productsCount: tenantItems.length,
          invoicesCount: tenantInvoices.length,
          monthlyGmv: monthlyGmv,
          usersCount: tenantUsers.length,
          locationsCount: tenantLocations.length,
        }
      };
    });
  }

  async fetchTenants(): Promise<Tenant[]> {
    try {
      const res = await apiClient.get('/tenants');
      if (Array.isArray(res.data)) {
        this.tenants = res.data.map((t: any) => ({
          id: t.id || t._id,
          name: t.name,
          slug: t.slug,
          plan: t.plan || t.subscription?.planId || 'PROFESSIONAL',
          status: t.status || 'ACTIVE',
          adminEmail: t.admin_email || t.adminEmail || '',
          phone: t.phone,
          gstin: t.gstin,
          address: t.address,
          logoUrl: t.logo_url || t.logoUrl,
          tagline: t.tagline,
          receiptFooterNote: t.receipt_footer || t.receiptFooterNote || t.receiptFooter,
          createdAt: t.created_at || t.createdAt || new Date().toISOString(),
          databaseConfig: {
            isolationMode: t.database_config?.isolation_mode || t.databaseConfig?.isolationMode || 'SHARED',
            mongodbUri: t.database_config?.mongodb_uri || t.databaseConfig?.mongodbUri,
            databaseName: t.database_config?.database_name || t.databaseConfig?.databaseName || 'quickbill_db',
          },
          subscription: {
            planId: t.subscription?.plan_id || t.subscription?.planId || 'PROFESSIONAL',
            planName: t.subscription?.plan_name || t.subscription?.planName || 'Professional Tier',
            status: t.subscription?.status || 'ACTIVE',
            maxUsers: t.subscription?.max_users || t.subscription?.maxUsers || 5,
            maxLocations: t.subscription?.max_locations || t.subscription?.maxLocations || 3,
            billingCycle: t.subscription?.billing_cycle || t.subscription?.billingCycle || 'ANNUAL',
            startDate: t.subscription?.start_date || t.subscription?.startDate || t.created_at,
            endDate: t.subscription?.end_date || t.subscription?.endDate || new Date(Date.now() + 365*24*3600*1000).toISOString(),
            daysRemaining: t.subscription?.days_remaining ?? 365,
            gracePeriodDays: t.subscription?.grace_period_days || 7,
            pricePerCycle: t.subscription?.price_per_cycle || 1999,
            currency: '₹',
            autoRenew: t.subscription?.auto_renew || false,
            features: t.subscription?.features || ['pos', 'inventory', 'ledger'],
            renewalHistory: t.subscription?.renewal_history || [],
            notes: t.subscription?.notes,
          },
          stats: t.stats || {
            productsCount: 0,
            invoicesCount: 0,
            monthlyGmv: 0,
            usersCount: 0,
            locationsCount: 0,
          }
        }));

        if (this.tenants.length === 0) {
          this.currentTenant = null;
        } else if (!this.currentTenant || !this.tenants.some(t => t.id === this.currentTenant?.id)) {
          this.currentTenant = this.tenants[0];
        }

        this.saveToStorage();
        this.notifyListeners();
      }
    } catch (e) {
      console.warn('Backend fetchTenants failed:', e);
    }
    return this.getTenants();
  }

  async fetchActiveTenant(): Promise<Tenant> {
    try {
      const res = await apiClient.get('/tenants/current');
      if (res.data && (res.data.id || res.data._id)) {
        const t = res.data;
        const normalizedTenant: Tenant = {
          id: t.id || t._id,
          name: t.name,
          slug: t.slug,
          plan: t.plan || t.subscription?.plan_id || t.subscription?.planId || 'PROFESSIONAL',
          status: t.status || t.subscription?.status || 'ACTIVE',
          adminEmail: t.admin_email || t.adminEmail || '',
          phone: t.phone,
          gstin: t.gstin,
          address: t.address,
          logoUrl: t.logo_url || t.logoUrl,
          tagline: t.tagline,
          receiptFooterNote: t.receipt_footer || t.receiptFooterNote || t.receiptFooter,
          createdAt: t.created_at || t.createdAt || new Date().toISOString(),
          databaseConfig: {
            isolationMode: t.database_config?.isolation_mode || t.databaseConfig?.isolationMode || 'SHARED',
            mongodbUri: t.database_config?.mongodb_uri || t.databaseConfig?.mongodbUri,
            databaseName: t.database_config?.database_name || t.databaseConfig?.databaseName || 'quickbill_db',
          },
          subscription: {
            planId: t.subscription?.plan_id || t.subscription?.planId || 'PROFESSIONAL',
            planName: t.subscription?.plan_name || t.subscription?.planName || 'Professional Tier',
            status: t.subscription?.status || 'ACTIVE',
            maxUsers: t.subscription?.max_users !== undefined ? t.subscription.max_users : (t.subscription?.maxUsers !== undefined ? t.subscription.maxUsers : 3),
            maxLocations: t.subscription?.max_locations !== undefined ? t.subscription.max_locations : (t.subscription?.maxLocations !== undefined ? t.subscription.maxLocations : 3),
            billingCycle: t.subscription?.billing_cycle || t.subscription?.billingCycle || 'ANNUAL',
            startDate: t.subscription?.start_date || t.subscription?.startDate || t.created_at,
            endDate: t.subscription?.end_date || t.subscription?.endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
            daysRemaining: t.subscription?.days_remaining !== undefined ? t.subscription.days_remaining : 365,
            gracePeriodDays: t.subscription?.grace_period_days || 7,
            pricePerCycle: t.subscription?.price_per_cycle || 1999,
            currency: '₹',
            autoRenew: t.subscription?.auto_renew || false,
            features: t.subscription?.features || ['pos', 'inventory', 'ledger'],
            renewalHistory: t.subscription?.renewal_history || [],
            notes: t.subscription?.notes,
          },
          stats: t.stats || {
            productsCount: 0,
            invoicesCount: 0,
            monthlyGmv: 0,
            usersCount: 0,
            locationsCount: 0,
          }
        };

        this.currentTenant = normalizedTenant;
        if (this.currentUser) {
          this.currentUser.tenantName = normalizedTenant.name;
        }
        const idx = this.tenants.findIndex(x => x.id === normalizedTenant.id);
        if (idx >= 0) {
          this.tenants[idx] = normalizedTenant;
        } else {
          this.tenants.unshift(normalizedTenant);
        }
        this.saveToStorage();
        this.notifyListeners();
        return normalizedTenant;
      }
    } catch (e) {
      console.warn('fetchActiveTenant failed, fallback to local currentTenant:', e);
    }
    return this.getActiveTenant();
  }

  getActiveTenant(): Tenant {
    if (this.currentTenant && this.currentTenant.id) {
      const all = this.getTenants();
      const found = all.find(t => t.id === this.currentTenant?.id);
      if (found) {
        this.currentTenant = found;
      }
      return this.currentTenant;
    }
    if (this.currentUser?.businessId) {
      const all = this.getTenants();
      const found = all.find(t => t.id === this.currentUser?.businessId);
      if (found) {
        this.currentTenant = found;
        return this.currentTenant;
      }
    }
    if (this.tenants.length > 0) {
      this.currentTenant = this.tenants[0];
      return this.currentTenant;
    }
    return {
      id: this.currentUser?.businessId || '',
      name: this.currentUser?.tenantName || 'Store Portal',
      slug: '',
      adminEmail: this.currentUser?.email || '',
      plan: 'STARTER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      databaseConfig: {
        isolationMode: 'SHARED',
        databaseName: '',
      },
      subscription: {
        planId: 'STARTER',
        planName: 'Starter Plan',
        status: 'ACTIVE',
        maxUsers: 5,
        maxLocations: 3,
        billingCycle: 'MONTHLY',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 365,
        features: ['pos', 'inventory', 'ledger'],
      },
      stats: {
        productsCount: 0,
        invoicesCount: 0,
        monthlyGmv: 0,
        usersCount: 0,
        locationsCount: 0,
      }
    };
  }

  async updateTenantProfile(updates: {
    tenantId?: string;
    name?: string;
    gstin?: string;
    phone?: string;
    email?: string;
    address?: string;
    currency?: string;
    logoUrl?: string;
    tagline?: string;
    receiptFooterNote?: string;
    status?: 'ACTIVE' | 'SUSPENDED';
    plan?: any;
    databaseConfig?: TenantDatabaseConfig;
  }): Promise<Tenant> {
    const targetId = updates.tenantId || this.getActiveTenant().id;
    const current = this.tenants.find(t => t.id === targetId) || this.getActiveTenant();
    const updatedTenant: Tenant = {
      ...current,
      name: updates.name ? updates.name.trim() : current.name,
      gstin: updates.gstin !== undefined ? updates.gstin.trim() : current.gstin,
      phone: updates.phone !== undefined ? updates.phone.trim() : current.phone,
      adminEmail: updates.email !== undefined ? updates.email.trim().toLowerCase() : current.adminEmail,
      address: updates.address !== undefined ? updates.address.trim() : current.address,
      logoUrl: updates.logoUrl !== undefined ? updates.logoUrl.trim() : current.logoUrl,
      tagline: updates.tagline !== undefined ? updates.tagline.trim() : current.tagline,
      receiptFooterNote: updates.receiptFooterNote !== undefined ? updates.receiptFooterNote.trim() : current.receiptFooterNote,
      status: updates.status || current.status,
      plan: updates.plan || current.plan,
      databaseConfig: updates.databaseConfig || current.databaseConfig,
    };

    // Update in local array
    const idx = this.tenants.findIndex(t => t.id === targetId);
    if (idx !== -1) {
      this.tenants[idx] = updatedTenant;
    }
    if (this.currentTenant?.id === targetId || !this.currentTenant) {
      this.currentTenant = updatedTenant;
    }
    if (this.currentUser && updates.name) {
      this.currentUser.tenantName = updates.name.trim();
    }
    this.saveToStorage();
    this.notifyListeners();

    // Sync to backend if online
    if (targetId) {
      try {
        await apiClient.put(`/tenants/${targetId}`, {
          name: updates.name,
          gstin: updates.gstin,
          phone: updates.phone,
          admin_email: updates.email,
          address: updates.address,
          logo_url: updates.logoUrl,
          tagline: updates.tagline,
          receipt_footer: updates.receiptFooterNote,
          status: updates.status,
          plan: updates.plan,
          database_config: updates.databaseConfig ? {
            isolation_mode: updates.databaseConfig.isolationMode,
            mongodb_uri: updates.databaseConfig.mongodbUri,
            database_name: updates.databaseConfig.databaseName
          } : undefined
        });
      } catch (e) {
        console.warn('Backend tenant profile update error:', e);
      }
    }

    await this.fetchTenants();
    this.notifyListeners();
    return updatedTenant;
  }

  async updateTenantSubscription(
    tenantId: string,
    updates: {
      planId?: any;
      maxUsers?: number;
      maxLocations?: number;
      billingCycle?: any;
      endDate?: string;
      status?: any;
      notes?: string;
    }
  ): Promise<Tenant | null> {
    const idx = this.tenants.findIndex(t => t.id === tenantId);
    if (idx === -1) return null;

    const t = this.tenants[idx];
    const sub = t.subscription || {
      planId: 'PROFESSIONAL',
      planName: 'Professional Tier',
      status: 'ACTIVE',
      maxUsers: 5,
      maxLocations: 3,
      billingCycle: 'ANNUAL',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      daysRemaining: 365,
      gracePeriodDays: 7,
      features: ['pos', 'inventory', 'ledger'],
    };

    const newEndDate = updates.endDate || sub.endDate;
    const newPlan = updates.planId || sub.planId;
    const updatedSub = {
      ...sub,
      planId: newPlan,
      planName: `${newPlan} Tier`,
      maxUsers: updates.maxUsers !== undefined ? updates.maxUsers : sub.maxUsers,
      maxLocations: updates.maxLocations !== undefined ? updates.maxLocations : sub.maxLocations,
      billingCycle: updates.billingCycle || sub.billingCycle,
      endDate: newEndDate,
      status: updates.status || sub.status,
      notes: updates.notes !== undefined ? updates.notes : sub.notes,
    };

    this.tenants[idx] = {
      ...t,
      plan: newPlan,
      subscription: updatedSub,
    };

    if (this.currentTenant?.id === tenantId) {
      this.currentTenant = this.tenants[idx];
    }
    this.saveToStorage();

    try {
      await apiClient.post(`/tenants/${tenantId}/renew-subscription`, {
        new_end_date: newEndDate,
        plan: newPlan,
        max_users: updatedSub.maxUsers,
        max_locations: updatedSub.maxLocations,
        billing_cycle: updatedSub.billingCycle,
        notes: updates.notes,
      });
    } catch (e) {
      console.warn('Backend subscription update error:', e);
    }

    return this.tenants[idx];
  }

  async renewTenantSubscription(
    tenantId: string,
    options: {
      extendDays?: number;
      newEndDate?: string;
      plan?: any;
      maxUsers?: number;
      maxLocations?: number;
      amount?: number;
      billingCycle?: any;
      notes?: string;
    }
  ): Promise<{ success: boolean; message: string; tenant?: Tenant }> {
    const idx = this.tenants.findIndex(t => t.id === tenantId);
    if (idx === -1) {
      return { success: false, message: 'Tenant store not found.' };
    }

    const t = this.tenants[idx];
    const sub = t.subscription;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let targetEndDate: string;
    if (options.newEndDate) {
      targetEndDate = options.newEndDate;
    } else if (options.extendDays) {
      const curEndMs = sub?.endDate ? new Date(sub.endDate).getTime() : now;
      const baseMs = Math.max(now, curEndMs);
      targetEndDate = new Date(baseMs + options.extendDays * dayMs).toISOString();
    } else {
      targetEndDate = new Date(now + 365 * dayMs).toISOString();
    }

    const planTier = options.plan || t.plan || 'PROFESSIONAL';
    const renewalRecord = {
      date: new Date().toISOString(),
      extendedUntil: targetEndDate,
      renewedBy: this.currentUser?.email || 'superadmin@quickbill.local',
      amount: options.amount,
      billingCycle: options.billingCycle || sub?.billingCycle || 'ANNUAL',
      notes: options.notes || `Subscription extended until ${new Date(targetEndDate).toLocaleDateString()}`,
    };

    const history = [...(sub?.renewalHistory || []), renewalRecord];

    const updatedSub = {
      ...sub,
      planId: planTier,
      planName: `${planTier} Tier`,
      status: 'ACTIVE' as const,
      endDate: targetEndDate,
      maxUsers: options.maxUsers !== undefined ? options.maxUsers : (sub?.maxUsers || 5),
      maxLocations: options.maxLocations !== undefined ? options.maxLocations : (sub?.maxLocations || 3),
      billingCycle: options.billingCycle || sub?.billingCycle || 'ANNUAL',
      renewalHistory: history,
    };

    this.tenants[idx] = {
      ...t,
      status: 'ACTIVE',
      plan: planTier,
      subscription: updatedSub,
    };

    if (this.currentTenant?.id === tenantId) {
      this.currentTenant = this.tenants[idx];
    }
    this.saveToStorage();

    try {
      await apiClient.post(`/tenants/${tenantId}/renew-subscription`, {
        extend_days: options.extendDays,
        new_end_date: options.newEndDate,
        plan: planTier,
        max_users: updatedSub.maxUsers,
        max_locations: updatedSub.maxLocations,
        amount: options.amount,
        billing_cycle: options.billingCycle,
        notes: options.notes,
      });
    } catch (e) {
      console.warn('Backend renew subscription API error:', e);
    }

    return {
      success: true,
      message: `Successfully renewed license for ${t.name} until ${new Date(targetEndDate).toLocaleDateString()}!`,
      tenant: this.tenants[idx],
    };
  }

  async resetTenantAdminPassword(tenantId: string, newPass: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiClient.post(`/tenants/${tenantId}/reset-password`, {
        new_password: newPass,
      });
      return { success: true, message: res.data?.message || 'Password successfully updated!' };
    } catch {
      return { success: true, message: 'Password reset completed (Local).' };
    }
  }

  async toggleTenantStatus(tenantId: string): Promise<Tenant | null> {
    const idx = this.tenants.findIndex(t => t.id === tenantId);
    if (idx === -1) return null;

    const currentStatus = this.tenants[idx].status;
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    this.tenants[idx] = {
      ...this.tenants[idx],
      status: nextStatus,
      subscription: {
        ...this.tenants[idx].subscription,
        status: nextStatus,
      }
    };

    if (this.currentTenant?.id === tenantId) {
      this.currentTenant = this.tenants[idx];
    }
    this.saveToStorage();

    try {
      await apiClient.patch(`/tenants/${tenantId}/status`, { status: nextStatus });
    } catch (e) {
      try {
        await apiClient.put(`/tenants/${tenantId}`, { status: nextStatus });
      } catch (err) {
        console.warn('Backend status toggle failed:', err);
      }
    }

    await this.fetchTenants();
    return this.getActiveTenant();
  }

  isStoreSuspended(): boolean {
    if (this.isSuperAdmin()) return false;
    const t = this.getActiveTenant();
    return t.status === 'SUSPENDED' || t.subscription?.status === 'SUSPENDED';
  }

  isSubscriptionExpired(): boolean {
    if (this.isSuperAdmin()) return false;
    const t = this.getActiveTenant();
    if (t.status === 'SUSPENDED') return false; // Suspended takes precedence
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
      const sub = this.getActiveTenant().subscription;
      const endStr = sub?.endDate ? new Date(sub.endDate).toLocaleDateString() : 'recently';
      return `Store subscription license expired on ${endStr}.`;
    }
    return null;
  }

  switchActiveTenant(tenantId: string): Tenant | null {
    if (!this.isSuperAdmin()) {
      return null;
    }
    const found = this.tenants.find(t => t.id === tenantId);
    if (!found) return null;
    this.currentTenant = found;
    // Invalidate old tenant in-memory records so new tenant data is loaded freshly
    this.invoices = [];
    this.items = [];
    this.payments = [];
    this.parties = [];
    this.locations = [];
    this.activeLocation = null;
    this.saveToStorage();
    this.notifyListeners();
    return this.currentTenant;
  }

  addTenant(tenantData: Omit<Tenant, 'id' | 'createdAt' | 'stats' | 'status' | 'subscription'> & {
    initialPassword?: string;
    maxUsers?: number;
    maxLocations?: number;
    durationDays?: number;
    billingCycle?: any;
  }): Tenant {
    const now = new Date();
    const durationDays = tenantData.durationDays || 365;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const planTier = tenantData.plan || 'PROFESSIONAL';
    const defaultMaxUsers = planTier === 'STARTER' ? 2 : (planTier === 'ENTERPRISE' ? 25 : 5);
    const defaultMaxLocations = planTier === 'STARTER' ? 1 : (planTier === 'ENTERPRISE' ? 10 : 3);

    const newTenant: Tenant = {
      ...tenantData,
      id: `tenant_${Date.now()}`,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      subscription: {
        planId: planTier,
        planName: `${planTier} Tier`,
        status: 'ACTIVE',
        maxUsers: tenantData.maxUsers || defaultMaxUsers,
        maxLocations: tenantData.maxLocations || defaultMaxLocations,
        billingCycle: tenantData.billingCycle || 'ANNUAL',
        startDate: now.toISOString(),
        endDate: endDate,
        daysRemaining: durationDays,
        gracePeriodDays: 7,
        pricePerCycle: planTier === 'ENTERPRISE' ? 49999 : (planTier === 'PROFESSIONAL' ? 2499 : 999),
        currency: '₹',
        autoRenew: false,
        features: ['pos', 'inventory', 'ledger', 'purchase_orders', 'reports'],
        renewalHistory: [{
          date: now.toISOString(),
          extendedUntil: endDate,
          renewedBy: this.currentUser?.email || 'superadmin@quickbill.local',
          notes: 'Initial store provisioning',
        }],
      },
      stats: {
        productsCount: 0,
        invoicesCount: 0,
        monthlyGmv: 0,
        usersCount: 1,
        locationsCount: 1,
      },
    };

    this.tenants.unshift(newTenant);
    this.saveToStorage();

    // Trigger API creation in background if online
    apiClient.post('/tenants', {
      name: tenantData.name,
      slug: tenantData.slug,
      admin_email: tenantData.adminEmail,
      admin_password: tenantData.initialPassword || 'StoreAdmin@2026',
      plan: planTier,
      phone: tenantData.phone,
      gstin: tenantData.gstin,
      max_users: tenantData.maxUsers || defaultMaxUsers,
      max_locations: tenantData.maxLocations || defaultMaxLocations,
      duration_days: durationDays,
      database_config: {
        isolation_mode: tenantData.databaseConfig.isolationMode,
        mongodb_uri: tenantData.databaseConfig.mongodbUri,
        database_name: tenantData.databaseConfig.databaseName,
      }
    }).catch(err => console.warn('Backend tenant create failed:', err));

    return newTenant;
  }

  async testMongoConnection(uri: string, dbName: string): Promise<{ success: boolean; message: string; latencyMs?: number; status?: string }> {
    try {
      const res = await apiClient.post('/tenants/test-db-connection', {
        mongodb_uri: uri,
        database_name: dbName,
      }, { timeout: 6000 });
      return res.data;
    } catch (err: any) {
      if (err?.response?.data?.message) {
        return {
          success: false,
          message: err.response.data.message,
          status: err.response.data.status || 'FAILED'
        };
      }
      if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
        return {
          success: false,
          message: 'Unable to reach backend server to verify connection string.',
        };
      }
      return {
        success: false,
        message: 'Invalid MongoDB connection URI format. Must start with mongodb:// or mongodb+srv://',
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
    const totalUsers = tenantsWithLiveStats.reduce((sum, t) => sum + t.stats.usersCount, 0);
    const totalLocations = tenantsWithLiveStats.reduce((sum, t) => sum + (t.stats.locationsCount || 0), 0);

    const expiringSubscriptionsCount = tenantsWithLiveStats.filter(t => {
      const days = t.subscription?.daysRemaining ?? 365;
      return days >= 0 && days <= 14;
    }).length;

    const expiredSubscriptionsCount = tenantsWithLiveStats.filter(t => {
      const days = t.subscription?.daysRemaining ?? 365;
      return days < 0;
    }).length;
    
    return {
      totalTenants,
      activeTenants,
      globalCombinedGmv,
      totalProducts,
      totalInvoices,
      totalUsers,
      totalLocations,
      expiringSubscriptionsCount,
      expiredSubscriptionsCount,
      databaseClustersCount: 1,
    };
  }

  // --- Strict Tenant & Location-Isolated Items ---
  getItems(locationId?: string, includeUnlisted: boolean = false): Item[] {
    const activeTenantId = this.currentTenant?.id || '';
    const isConsolidated = !locationId || locationId === 'ALL';
    const tenantItems = this.items.filter(i => (i.businessId || activeTenantId) === activeTenantId);

    const result: Item[] = [];

    for (const item of tenantItems) {
      if (isConsolidated) {
        // Consolidated across all branches: sum stock across all locations if available
        let consolidatedStock = item.currentStock || 0;
        if (item.locations && item.locations.length > 0) {
          consolidatedStock = item.locations.reduce((sum, l) => sum + (Number(l.currentStock) || 0), 0);
        }

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
          currentStock: Number(consolidatedStock.toFixed(3)),
          mrp,
          salePrice: effectiveSalePrice,
          purchasePrice: Number(item.purchasePrice || 0),
        });
      } else {
        const targetLocId = locationId;
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
    }

    return result;
  }

  async fetchItems(locationId?: string): Promise<Item[]> {
    try {
      const qParams: any = { page: 1, page_size: 500 };
      if (locationId && locationId !== 'ALL') {
        qParams.locationId = locationId;
      }
      const res = await apiClient.get('/items', { params: qParams });
      if (res.data?.data && Array.isArray(res.data.data)) {
        const liveItems: Item[] = res.data.data.map((d: any) => ({
          id: d._id || d.id || d.publicItemId,
          businessId: d.businessId || this.currentTenant?.id || '',
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
          averageCostPrice: d.averageCostPrice !== undefined ? Number(d.averageCostPrice) : Number(d.purchasePrice || 0),
          currentStock: Number(d.currentStock || 0),
          minStockAlert: Number(d.minStockAlert || 5),
          hasDiscount: d.hasDiscount,
          discountType: d.discountType,
          discountValue: d.discountValue ? Number(d.discountValue) : undefined,
          batches: Array.isArray(d.batches) ? d.batches : [],
          locations: d.locations,
          images: d.images,
          imageUrl: d.imageUrl,
          allowParts: !!d.allowParts,
        }));
        this.items = liveItems;
        this.saveToStorage();
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
    const locId = params.locationId;

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
        const liveItems: Item[] = res.data.data.map((d: any) => {
          const locInv = (locId && locId !== 'ALL' && Array.isArray(d.locations))
            ? d.locations.find((l: any) => l.locationId === locId)
            : undefined;

          const mrp = locInv?.mrp !== undefined ? Number(locInv.mrp) : (d.mrp !== undefined ? Number(d.mrp) : Number(d.salePrice || 0));
          let salePrice = locInv?.salePrice !== undefined ? Number(locInv.salePrice) : Number(d.salePrice || 0);
          const hasDiscount = locInv ? (locInv.hasDiscount || false) : d.hasDiscount;
          const discountType = locInv ? locInv.discountType : d.discountType;
          const discountValue = locInv?.discountValue !== undefined ? Number(locInv.discountValue) : (d.discountValue !== undefined ? Number(d.discountValue) : undefined);

          if (hasDiscount && discountValue && discountValue > 0) {
            if (discountType === 'PERCENT') {
              salePrice = Number((mrp - (mrp * discountValue / 100)).toFixed(2));
            } else {
              salePrice = Math.max(0, Number((mrp - discountValue).toFixed(2)));
            }
          }

          const currentStock = (locId && locId !== 'ALL')
            ? (locInv && locInv.currentStock !== undefined ? Number(locInv.currentStock) : Number(d.currentStock || 0))
            : (Array.isArray(d.locations) && d.locations.length > 0
                ? d.locations.reduce((sum: number, l: any) => sum + (Number(l.currentStock) || 0), 0)
                : Number(d.currentStock || 0));

          const minStockAlert = (locId && locId !== 'ALL')
            ? (locInv && locInv.minStockAlert !== undefined ? Number(locInv.minStockAlert) : Number(d.minStockAlert || 5))
            : Number(d.minStockAlert || 5);

          const purchasePrice = locInv && locInv.purchasePrice !== undefined
            ? Number(locInv.purchasePrice)
            : Number(d.purchasePrice || 0);

          return {
            id: d._id || d.id || d.publicItemId,
            businessId: d.businessId || this.currentTenant?.id || '',
            publicItemId: d.publicItemId || d.sku || 'ITM-TEMP',
            name: d.name,
            sku: d.sku,
            barcode: d.barcode,
            category: d.category || 'General',
            taxRate: Number(d.taxRate || 0),
            unit: d.unit || 'pcs',
            description: d.description,
            mrp,
            salePrice,
            purchasePrice,
            averageCostPrice: d.averageCostPrice !== undefined ? Number(d.averageCostPrice) : purchasePrice,
            currentStock,
            minStockAlert,
            hasDiscount,
            discountType,
            discountValue,
            batches: Array.isArray(d.batches) ? d.batches : [],
            locations: d.locations,
            images: d.images,
            imageUrl: d.imageUrl,
            allowParts: !!d.allowParts,
          };
        });

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
    const activeTenantId = this.currentTenant?.id || '';
    return this.items.filter(i => (i.businessId || activeTenantId) === activeTenantId);
  }

  getItemById(id: string, locationId?: string): Item | undefined {
    const items = this.getItems(locationId, true);
    return items.find(i => i.id === id || i.publicItemId === id);
  }

  async addItem(item: Omit<Item, 'id' | 'publicItemId' | 'businessId'>): Promise<Item> {
    const activeId = this.currentTenant?.id || '';
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
          averageCostPrice: d.averageCostPrice !== undefined ? Number(d.averageCostPrice) : Number(d.purchasePrice || 0),
          currentStock: Number(d.currentStock || 0),
          minStockAlert: Number(d.minStockAlert || 5),
          hasDiscount: !!d.hasDiscount,
          discountType: d.discountType,
          discountValue: d.discountValue ? Number(d.discountValue) : undefined,
          batches: Array.isArray(d.batches) ? d.batches : [],
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
    const activeId = this.currentTenant?.id || '';
    const idx = this.items.findIndex(
      i => (i.businessId || activeId) === activeId && i.id === id
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
          averageCostPrice: d.averageCostPrice !== undefined ? Number(d.averageCostPrice) : Number(d.purchasePrice || 0),
          currentStock: Number(d.currentStock || 0),
          minStockAlert: Number(d.minStockAlert || 5),
          hasDiscount: !!d.hasDiscount,
          discountType: d.discountType,
          discountValue: d.discountValue ? Number(d.discountValue) : undefined,
          batches: Array.isArray(d.batches) ? d.batches : [],
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
    const activeId = this.currentTenant?.id || '';
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
      i => (i.businessId || activeId) === activeId && i.id === id
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
    const activeId = this.currentTenant?.id || '';
    try {
      await apiClient.delete(`/items/${id}`);
    } catch (e) {
      console.warn(`Backend /items/${id} delete failed:`, e);
    }
    const prevLen = this.items.length;
    this.items = this.items.filter(
      i => !((i.businessId || activeId) === activeId && i.id === id)
    );
    this.saveToStorage();
    return this.items.length < prevLen;
  }

  // --- Strict Tenant-Isolated Product Categories ---
  getCategories(): ItemCategory[] {
    const activeId = this.currentTenant?.id || '';
    return this.categories.filter(c => (c.businessId || activeId) === activeId);
  }

  async fetchCategories(): Promise<ItemCategory[]> {
    try {
      const res = await apiClient.get('/categories', { params: { type: 'PRODUCT' } });
      if (res.data && Array.isArray(res.data)) {
        const liveCats: ItemCategory[] = res.data.map((c: any) => ({
          id: c.id || c._id,
          businessId: c.businessId || this.currentTenant?.id || '',
          name: c.name,
          type: 'PRODUCT',
          description: c.description || undefined,
          createdAt: c.createdAt || new Date().toISOString(),
        }));
        this.categories = liveCats;
        this.saveToStorage();
        return this.getCategories();
      }
    } catch (e) {
      console.warn('Could not fetch product categories from API:', e);
    }
    return this.getCategories();
  }

  async addCategory(data: { name: string; description?: string }): Promise<ItemCategory> {
    const activeId = this.currentTenant?.id || '';
    const cleanName = data.name.trim();
    
    // Check if category name already exists
    const existing = this.categories.find(
      c => (c.businessId || activeId) === activeId && c.name.toLowerCase() === cleanName.toLowerCase()
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
    const activeId = this.currentTenant?.id || '';
    const idx = this.categories.findIndex(
      c => (c.businessId || activeId) === activeId && c.id === id
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
    const activeId = this.currentTenant?.id || '';
    const target = this.categories.find(
      c => (c.businessId || activeId) === activeId && c.id === id
    );
    if (!target) return false;

    this.categories = this.categories.filter(
      c => !((c.businessId || activeId) === activeId && c.id === id)
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
    const activeId = this.currentTenant?.id || '';
    const tenantParties = this.parties.filter(p => (p.businessId || activeId) === activeId);
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
            businessId: c.businessId || this.currentTenant?.id || '',
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
              businessId: p.businessId || this.currentTenant?.id || '',
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

      if (custRes.status === 'fulfilled' || partyRes.status === 'fulfilled') {
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
          businessId: p.businessId || this.currentTenant?.id || '',
          name: p.name,
          type: Array.isArray(p.type) 
            ? (p.type.some((t: string) => String(t).toLowerCase().includes('supplier')) ? 'SUPPLIER' : 'CUSTOMER') 
            : (String(p.type || '').toUpperCase() === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER'),
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
    const activeId = this.currentTenant?.id || '';
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
    const activeId = this.currentTenant?.id || '';
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
    const activeId = this.currentTenant?.id || '';
    const p = this.parties.find(
      x => (x.businessId || activeId) === activeId && x.id === partyId
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
    const activeId = this.currentTenant?.id || '';
    this.parties = this.parties.filter(
      p => !((p.businessId || activeId) === activeId && p.id === partyId)
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
          businessId: res.data.businessId || this.currentTenant?.id || '',
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
    const activeId = this.currentTenant?.id || '';
    const p = this.parties.find(
      x => (x.businessId || activeId) === activeId && x.id === partyId
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
        const liveCats: ExpenseCategory[] = res.data.map((c: any) => ({
          id: c.id || c._id,
          businessId: c.businessId || this.currentTenant?.id || '',
          name: c.name,
          type: 'EXPENSE',
          description: c.description || undefined,
          isCustom: true,
        }));
        this.expenseCategories = liveCats;
        this.saveToStorage();
        return this.getExpenseCategories();
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
      businessId: this.currentTenant?.id || '',
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
    const activeId = this.currentTenant?.id || '';
    const list = this.expenses.filter(e => (e.businessId || activeId) === activeId);
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
          businessId: d.businessId || this.currentTenant?.id || '',
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
          businessId: d.businessId || this.currentTenant?.id || '',
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
    const activeId = this.currentTenant?.id || '';
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
    const activeId = this.currentTenant?.id || '';
    const idx = this.expenses.findIndex(
      e => (e.businessId || activeId) === activeId && e.id === id
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
    const activeId = this.currentTenant?.id || '';
    const prevLen = this.expenses.length;
    this.expenses = this.expenses.filter(
      e => !((e.businessId || activeId) === activeId && e.id === id)
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
      businessId: doc.businessId || doc.business_id || this.currentTenant?.id || '',
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
      items: (doc.items || []).map((it: any) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unitPrice !== undefined ? it.unitPrice : (it.unit_price || 0));
        const gross = qty * price;
        const discAmt = Number(it.discount !== undefined ? it.discount : (it.discount_amount || 0));
        const discType = it.discountType || it.discount_type || (it.discountPercent > 0 ? 'PERCENT' : 'FLAT');
        const discVal = Number(it.discountValue !== undefined ? it.discountValue : (it.discount_value !== undefined ? it.discount_value : (discType === 'PERCENT' ? (it.discountPercent || (gross > 0 ? (discAmt / gross) * 100 : 0)) : discAmt)));
        const discPct = Number(it.discountPercent !== undefined ? it.discountPercent : (it.discount_percent !== undefined ? it.discount_percent : (discType === 'PERCENT' ? discVal : (gross > 0 ? (discAmt / gross) * 100 : 0))));

        return {
          itemId: it.itemId || it.item_id,
          name: it.nameSnapshot || it.name_snapshot || it.name || 'Item',
          unit: it.unit || it.unit_snapshot || 'pcs',
          quantity: qty,
          returnedQuantity: Number(it.returnedQuantity !== undefined ? it.returnedQuantity : (it.returned_quantity || 0)),
          returnReason: it.returnReason || it.return_reason || undefined,
          returnNote: it.returnNote || it.return_note || undefined,
          returnDate: it.returnDate || it.return_date || undefined,
          returnStatus: it.returnStatus || it.return_status || undefined,
          unitPrice: price,
          discountPercent: Number(discPct.toFixed(2)),
          discountType: discType as 'PERCENT' | 'FLAT',
          discountValue: Number(discVal.toFixed(2)),
          discountAmount: Number(discAmt.toFixed(2)),
          taxRate: Number(it.taxRate !== undefined ? it.taxRate : (it.tax_rate || 0)),
          taxAmount: Number(it.taxAmount !== undefined ? it.taxAmount : (it.tax_amount || 0)),
          taxableAmount: it.taxableAmount !== undefined ? Number(it.taxableAmount) : (it.taxable_amount !== undefined ? Number(it.taxable_amount) : undefined),
          total: Number(it.lineTotal !== undefined ? it.lineTotal : (it.line_total !== undefined ? it.line_total : (gross - discAmt))),
          originalTotal: Number(gross.toFixed(2)),
        };
      }),
      subtotal: Number(rawSubtotal),
      taxTotal: Number(rawTax),
      itemDiscountTotal: doc.itemDiscountTotal !== undefined ? Number(doc.itemDiscountTotal) : (doc.item_discount_total !== undefined ? Number(doc.item_discount_total) : undefined),
      orderDiscountAmount: doc.orderDiscountTotal !== undefined ? Number(doc.orderDiscountTotal) : (doc.invoiceDiscount !== undefined ? Number(doc.invoiceDiscount) : (doc.invoice_discount !== undefined ? Number(doc.invoice_discount) : undefined)),
      discountTotal: Number(rawDiscount),
      discountType: doc.discountType || doc.discount_type || undefined,
      discountValue: doc.discountValue !== undefined ? Number(doc.discountValue) : (doc.discount_value !== undefined ? Number(doc.discount_value) : undefined),
      roundOff: Number(rawRoundOff),
      grandTotal: Number(rawGrand),
      originalGrandTotal: doc.originalGrandTotal !== undefined ? Number(doc.originalGrandTotal) : (doc.original_grand_total !== undefined ? Number(doc.original_grand_total) : undefined),
      returnTotal: doc.returnTotal !== undefined ? Number(doc.returnTotal) : (doc.return_total !== undefined ? Number(doc.return_total) : 0),
      hasReturns: !!(doc.hasReturns || doc.has_returns || (doc.returnTotal && Number(doc.returnTotal) > 0)),
      returnStatus: (doc.returnStatus || doc.return_status || 'NONE') as any,
      returnNotes: doc.returnNotes || doc.return_notes || undefined,
      paidAmount: Number(rawPaid),
      balanceAmount: Number(rawBalance),
      paymentMode: (doc.paymentMode || doc.payment_mode || 'CASH') as any,
      status: (doc.status || doc.paymentStatus || doc.payment_status || (Number(rawBalance) <= 0 ? 'PAID' : (Number(rawPaid) > 0 ? 'PARTIAL' : 'UNPAID'))) as any,
      notes: doc.notes || undefined,
    };
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
      refundAmount?: number;
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
        updatedInvoice = this.mapSaleDocToInvoice(res.data);
      }
    } catch (err) {
      console.warn('Backend PUT /sales/{id} failed, applying local calculation fallback:', err);
    }

    if (!updatedInvoice) {
      if (!existing) {
        throw new Error('Invoice not found');
      }

      const origGrand = existing.originalGrandTotal || existing.grandTotal;
      let netSubtotal = 0;
      let netTax = 0;
      let anyReturn = false;
      let allReturned = true;

      const updatedItems = existing.items.map(item => {
        const up = updateData.items.find(u => u.itemId === item.itemId);
        const retQty = up ? up.returnedQuantity : (item.returnedQuantity || 0);
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
          returnedQuantity: retQty,
          returnReason: up?.returnReason as any || item.returnReason,
          returnNote: up?.returnNote || item.returnNote,
          returnDate: retQty > 0 ? (item.returnDate || new Date().toISOString()) : undefined,
          returnStatus: retQty >= item.quantity ? 'FULL' : (retQty > 0 ? 'PARTIAL' : 'NONE'),
          total: Number(lineTotal.toFixed(2)),
        };
      });

      const netGrand = Number((netSubtotal + netTax).toFixed(2));
      const retTotal = Math.max(0, Number((origGrand - netGrand).toFixed(2)));
      const newStatus = allReturned && anyReturn ? 'RETURNED' : (anyReturn ? 'PARTIALLY_RETURNED' : existing.status);

      updatedInvoice = {
        ...existing,
        items: updatedItems as any,
        subtotal: Number(netSubtotal.toFixed(2)),
        taxTotal: Number(netTax.toFixed(2)),
        grandTotal: netGrand,
        originalGrandTotal: origGrand,
        returnTotal: retTotal,
        hasReturns: anyReturn,
        returnStatus: allReturned && anyReturn ? 'FULLY_RETURNED' : (anyReturn ? 'PARTIALLY_RETURNED' : 'NONE'),
        returnNotes: updateData.returnNotes || existing.returnNotes,
        status: newStatus as any,
        notes: updateData.notes !== undefined ? updateData.notes : existing.notes,
      };
    }

    // Restock returned quantities into local store inventory state (backend already restocked via PUT /sales/{id})
    if (existing) {
      updateData.items.forEach(up => {
        const prevSnap = existing.items.find(i => i.itemId === up.itemId);
        const prevRet = prevSnap?.returnedQuantity || 0;
        const deltaRet = up.returnedQuantity - prevRet;
        if (deltaRet > 0 && up.returnReason !== 'DEFECTIVE_DAMAGED') {
          const it = this.items.find(i => i.id === up.itemId || i.publicItemId === up.itemId);
          if (it) {
            it.currentStock = Number((it.currentStock + deltaRet).toFixed(3));
            if (it.locations && existing.locationId) {
              const loc = it.locations.find(l => l.locationId === existing.locationId);
              if (loc) {
                loc.currentStock = Number((loc.currentStock + deltaRet).toFixed(3));
              }
            }
          }
        }
      });

      const deltaReturnTotal = (updatedInvoice.returnTotal || 0) - (existing.returnTotal || 0);
      if (deltaReturnTotal > 0 && existing.partyId && existing.balanceAmount > 0) {
        const balanceDeduction = Math.min(deltaReturnTotal, existing.balanceAmount);
        this.updatePartyBalance(existing.partyId, -balanceDeduction);
      }
    }

    this.invoices = this.invoices.map(inv => inv.id === invoiceId ? updatedInvoice! : inv);
    this.saveToStorage();
    return updatedInvoice;
  }

  getInvoices(locationId?: string): Invoice[] {
    const activeTenant = this.getActiveTenant();
    const activeId = this.isSuperAdmin() 
      ? (this.currentTenant?.id || this.currentUser?.businessId || '') 
      : (this.currentUser?.businessId || activeTenant?.id || '');

    const list = this.invoices.filter(inv => inv.businessId === activeId);
    if (!locationId || locationId === 'ALL') return list;

    return list.filter(inv => inv.locationId === locationId);
  }

  async fetchInvoices(locationId?: string): Promise<Invoice[]> {
    try {
      const params: any = { page: 1, page_size: 100 };
      if (locationId && locationId !== 'ALL') {
        params.locationId = locationId;
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
    const activeTenant = this.getActiveTenant();
    const activeId = this.isSuperAdmin()
      ? (this.currentTenant?.id || this.currentUser?.businessId || '')
      : (this.currentUser?.businessId || activeTenant?.id || '');
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
      locationGstin: invoiceData.locationGstin || activeTenant?.gstin || undefined,
      billedById: invoiceData.billedById || currentUser?.id || 'usr_staff',
      billedByName: invoiceData.billedByName || currentUser?.name || 'Store Cashier',
      billedByRole: invoiceData.billedByRole || currentUser?.role || 'CASHIER',
      items: invoiceData.items.map(it => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unitPrice || 0);
        const gross = qty * price;
        let discAmount = 0;
        if (it.discountAmount !== undefined && it.discountAmount > 0) {
          discAmount = it.discountAmount;
        } else if (it.discountType === 'PERCENT' && it.discountValue !== undefined) {
          discAmount = (gross * Math.min(100, it.discountValue)) / 100;
        } else if (it.discountType === 'FLAT' && it.discountValue !== undefined) {
          discAmount = Math.min(gross, it.discountValue);
        } else if (it.discountPercent) {
          discAmount = (gross * it.discountPercent) / 100;
        }

        return {
          itemId: it.itemId,
          item_id: it.itemId,
          quantity: qty,
          unitPrice: price,
          unit_price: price,
          discount: Number(discAmount.toFixed(2)),
          discountType: it.discountType || (it.discountPercent ? 'PERCENT' : 'FLAT'),
          discountValue: it.discountValue !== undefined ? Number(it.discountValue) : (it.discountPercent || discAmount),
          discountPercent: it.discountType === 'PERCENT' ? Number(it.discountValue || 0) : Number(it.discountPercent || (gross > 0 ? (discAmount / gross) * 100 : 0)),
          taxRate: Number(it.taxRate || 0),
          tax_rate: Number(it.taxRate || 0),
        };
      }),
      invoiceDiscount: Number((
        invoiceData.orderDiscountAmount !== undefined 
          ? invoiceData.orderDiscountAmount 
          : (invoiceData.itemDiscountTotal !== undefined
              ? Math.max(0, Number(invoiceData.discountTotal || 0) - Number(invoiceData.itemDiscountTotal || 0))
              : Math.max(0, Number(invoiceData.discountTotal || 0) - invoiceData.items.reduce((s, it) => s + (it.discountAmount || 0), 0)))
      ).toFixed(2)),
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

    // Update in-memory stock cache locally for instantaneous UI response (Backend already decremented stock and logged movements atomically)
    createdInvoice.items.forEach(line => {
      const it = this.items.find(i => i.id === line.itemId || i.publicItemId === line.itemId);
      if (it) {
        it.currentStock = Math.max(0, Number((it.currentStock - line.quantity).toFixed(3)));
        if (it.locations && createdInvoice.locationId) {
          const loc = it.locations.find(l => l.locationId === createdInvoice.locationId);
          if (loc) {
            loc.currentStock = Math.max(0, Number((loc.currentStock - line.quantity).toFixed(3)));
          }
        }
      }
    });

    if (createdInvoice.partyId && createdInvoice.balanceAmount > 0) {
      this.updatePartyBalance(createdInvoice.partyId, createdInvoice.balanceAmount);
    }

    // Update in-memory list (MongoDB backed)
    this.invoices = [createdInvoice, ...this.invoices.filter(inv => inv.id !== createdInvoice.id && inv.invoiceNumber !== createdInvoice.invoiceNumber)];
    this.saveToStorage();
    this.notifyListeners();

    return createdInvoice;
  }

  // --- Strict Tenant-Isolated Payments ---
  getPayments(): Payment[] {
    const activeId = this.currentTenant?.id || '';
    return this.payments.filter(p => (p.businessId || activeId) === activeId);
  }

  recordPayment(paymentData: Omit<Payment, 'id' | 'businessId'>): Payment {
    const activeId = this.currentTenant?.id || '';
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

  // --- Purchase Orders Management ---
  private mapPoDocToPurchaseOrder(doc: any): PurchaseOrder {
    const rawItems = doc.items || doc.orderItems || [];
    const createdAtStr = doc.createdAt ? String(doc.createdAt) : new Date().toISOString();
    const orderDateStr = doc.orderDate || doc.order_date || (createdAtStr ? createdAtStr.split('T')[0] : new Date().toISOString().split('T')[0]);
    const totRec = Number(doc.totalReceivedAmount ?? doc.total_received_amount ?? 0);
    const totPaid = Number(doc.totalPaidAmount ?? doc.total_paid_amount ?? 0);
    const balDue = Number(doc.balanceDue ?? doc.balance_due ?? Math.max(0, totRec - totPaid));

    let pmtStatus = doc.paymentStatus || doc.payment_status;
    if (!pmtStatus) {
      if (totRec <= 0) pmtStatus = 'NO_DUES';
      else if (totPaid >= (totRec - 0.01)) pmtStatus = 'PAID';
      else if (totPaid > 0) pmtStatus = 'PARTIALLY_PAID';
      else pmtStatus = 'UNPAID';
    }

    return {
      id: String(doc.id || doc._id || ''),
      poNumber: doc.poNumber || doc.po_number || '',
      businessId: String(doc.businessId || doc.business_id || this.currentTenant?.id || ''),
      supplierId: String(doc.supplierId || doc.supplier_id || ''),
      supplierName: doc.supplierName || doc.supplier_name || '',
      supplierPhone: doc.supplierPhone || doc.supplier_phone,
      supplierGstin: doc.supplierGstin || doc.supplier_gstin,
      supplierAddress: doc.supplierAddress || doc.supplier_address,
      locationId: String(doc.locationId || doc.location_id || ''),
      locationName: doc.locationName || doc.location_name,
      orderDate: orderDateStr,
      expectedDeliveryDate: doc.expectedDeliveryDate || doc.expected_delivery_date,
      status: (doc.status === 'FULLY_RECEIVED' ? 'RECEIVED' : (doc.status || 'ORDERED')),
      items: Array.isArray(rawItems) ? rawItems.map((it: any) => {
        const catItem = this.items.find(i => i.id === (it.itemId || it.item_id));
        const itemName = it.name || it.itemName || it.item_name || catItem?.name || 'Item';
        const orderedQty = Number(it.orderedQty ?? it.ordered_qty ?? it.orderedQuantity ?? it.quantity ?? 0);
        const receivedQty = Number(it.receivedQty ?? it.received_qty ?? it.receivedQuantity ?? 0);
        const unitPrice = Number(it.unitPrice ?? it.unit_price ?? it.unitCost ?? it.unit_cost ?? catItem?.purchasePrice ?? 0);
        const taxRate = Number(it.taxRate ?? it.tax_rate ?? catItem?.taxRate ?? 0);
        const lineSub = orderedQty * unitPrice;
        const lineTax = (lineSub * taxRate) / 100;
        const taxAmount = Number(it.taxAmount ?? it.tax_amount ?? lineTax);
        const totalAmount = Number(it.totalAmount ?? it.total_amount ?? it.totalCost ?? it.total_cost ?? (lineSub + taxAmount));

        return {
          itemId: String(it.itemId || it.item_id || ''),
          name: itemName,
          sku: it.sku || catItem?.sku,
          barcode: it.barcode || catItem?.barcode,
          unit: it.unit || catItem?.unit || 'pcs',
          orderedQty,
          receivedQty,
          unitPrice,
          taxRate,
          taxAmount: Number(taxAmount.toFixed(2)),
          totalAmount: Number(totalAmount.toFixed(2)),
          updateItemPurchasePrice: it.updateItemPurchasePrice || it.update_item_purchase_price,
        };
      }) : [],
      subtotal: Number(doc.subtotal || 0),
      taxTotal: Number(doc.taxTotal ?? doc.tax_total ?? doc.taxAmount ?? doc.tax_amount ?? 0),
      grandTotal: Number(doc.grandTotal ?? doc.grand_total ?? 0),
      totalReceivedAmount: totRec,
      totalPaidAmount: totPaid,
      balanceDue: balDue,
      paymentStatus: pmtStatus,
      notes: doc.notes,
      terms: doc.terms,
      cancellationReason: doc.cancellationReason || doc.cancellation_reason,
      receiptHistory: Array.isArray(doc.receiptHistory || doc.receipt_history || doc.receipts) ? (doc.receiptHistory || doc.receipt_history || doc.receipts).map((rh: any) => ({
        id: rh.id || rh._id || rh.receiptId,
        receivedAt: rh.receivedAt || rh.received_at,
        receivedBy: rh.receivedBy || rh.received_by || rh.receivedByUserId,
        receivedByName: rh.receivedByName || rh.received_by_name,
        locationId: rh.locationId || rh.location_id,
        locationName: rh.locationName || rh.location_name,
        notes: rh.notes,
        itemsReceived: Array.isArray(rh.itemsReceived || rh.items_received || rh.items) ? (rh.itemsReceived || rh.items_received || rh.items).map((ir: any) => ({
          itemId: ir.itemId || ir.item_id,
          name: ir.name || ir.itemName || ir.item_name || 'Item',
          qty: Number(ir.qty ?? ir.quantityReceived ?? ir.quantity_received ?? 0),
        })) : [],
        paymentRecorded: (rh.paymentRecorded || rh.payment_recorded || (rh.amountPaid > 0 ? { amount: rh.amountPaid, paymentMode: rh.paymentMode } : null)) ? {
          amount: Number((rh.paymentRecorded || rh.payment_recorded)?.amount ?? rh.amountPaid ?? 0),
          paymentMode: (rh.paymentRecorded || rh.payment_recorded)?.paymentMode || (rh.paymentRecorded || rh.payment_recorded)?.payment_mode || rh.paymentMode || 'CASH',
          referenceNumber: (rh.paymentRecorded || rh.payment_recorded)?.referenceNumber || (rh.paymentRecorded || rh.payment_recorded)?.reference_number,
        } : undefined,
      })) : [],
      payments: Array.isArray(doc.payments) ? doc.payments.map((p: any) => ({
        paymentId: p.paymentId || p.payment_id || p.id,
        paymentNumber: p.paymentNumber || p.payment_number,
        amount: Number(p.amount || 0),
        paymentMode: p.paymentMode || p.payment_mode || 'BANK_TRANSFER',
        referenceNumber: p.referenceNumber || p.reference_number,
        notes: p.notes,
        paidAt: p.paidAt || p.paid_at || new Date().toISOString(),
      })) : [],
      createdAt: createdAtStr,
      updatedAt: doc.updatedAt || doc.updated_at,
      createdBy: doc.createdBy || doc.created_by || doc.createdByUserId,
      createdByName: doc.createdByName || doc.created_by_name,
    };
  }

  getPurchaseOrders(locationId?: string): PurchaseOrder[] {
    const activeId = this.currentTenant?.id || '';
    const list = this.purchaseOrders.filter(po => (po.businessId || activeId) === activeId);
    if (!locationId || locationId === 'ALL') return list;
    return list.filter(po => po.locationId === locationId);
  }

  async fetchPurchaseOrders(params: { search?: string; status?: string; supplier_id?: string; location_id?: string; fromDate?: string; toDate?: string; from_date?: string; to_date?: string; page?: number; page_size?: number } = {}): Promise<PaginatedApiResponse<PurchaseOrder>> {
    const page = params.page || 1;
    const pageSize = params.page_size || 20;

    try {
      const qParams: Record<string, any> = { page, page_size: pageSize };
      if (params.search) qParams.search = params.search;
      if (params.status && params.status !== 'ALL') qParams.status = params.status;
      if (params.supplier_id && params.supplier_id !== 'ALL') qParams.supplier_id = params.supplier_id;
      if (params.location_id && params.location_id !== 'ALL') qParams.location_id = params.location_id;
      if (params.fromDate || params.from_date) qParams.fromDate = params.fromDate || params.from_date;
      if (params.toDate || params.to_date) qParams.toDate = params.toDate || params.to_date;

      const res = await apiClient.get('/purchase-orders', { params: qParams });
      if (res.data && Array.isArray(res.data.data)) {
        const livePOs = res.data.data.map((d: any) => this.mapPoDocToPurchaseOrder(d));
        // Merge into local state
        const liveIds = new Set(livePOs.map((p: PurchaseOrder) => p.id));
        this.purchaseOrders = [...livePOs, ...this.purchaseOrders.filter(p => !liveIds.has(p.id))];
        try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}

        return {
          data: livePOs,
          page: res.data.page || page,
          pageSize: res.data.page_size || pageSize,
          total: res.data.total !== undefined ? res.data.total : livePOs.length,
          totalPages: res.data.total_pages || Math.ceil((res.data.total || livePOs.length) / pageSize),
        };
      }
    } catch (err) {
      console.warn('Could not fetch purchase orders from API, falling back to local state:', err);
    }

    // Local fallback filter
    const all = this.getPurchaseOrders(params.location_id);
    const fromDate = params.fromDate || params.from_date;
    const toDate = params.toDate || params.to_date;
    const filtered = all.filter(po => {
      if (params.status && params.status !== 'ALL') {
        const queryStatus = params.status === 'FULLY_RECEIVED' ? 'RECEIVED' : params.status;
        const currentStatus = po.status === 'FULLY_RECEIVED' ? 'RECEIVED' : po.status;
        if (currentStatus !== queryStatus) return false;
      }
      if (params.supplier_id && params.supplier_id !== 'ALL' && po.supplierId !== params.supplier_id) return false;
      const poDate = po.orderDate || (po.createdAt ? po.createdAt.split('T')[0] : '');
      if (fromDate && poDate && poDate < fromDate) return false;
      if (toDate && poDate && poDate > toDate) return false;
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase();
        const m = (po.poNumber && po.poNumber.toLowerCase().includes(q)) ||
                  (po.supplierName && po.supplierName.toLowerCase().includes(q)) ||
                  (po.supplierPhone && po.supplierPhone.includes(q)) ||
                  (po.notes && po.notes.toLowerCase().includes(q));
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

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    try {
      const res = await apiClient.get(`/purchase-orders/${id}`);
      if (res.data) {
        const po = this.mapPoDocToPurchaseOrder(res.data);
        this.purchaseOrders = [po, ...this.purchaseOrders.filter(p => p.id !== po.id)];
        return po;
      }
    } catch (err) {
      console.warn(`Could not get PO ${id} from API:`, err);
    }

    const localPo = this.purchaseOrders.find(p => p.id === id);
    if (!localPo) throw new Error('Purchase Order not found');
    return localPo;
  }

  async createPurchaseOrder(poData: {
    supplierId: string;
    locationId: string;
    orderDate?: string;
    expectedDeliveryDate?: string;
    items: { itemId: string; orderedQty: number; unitPrice: number; taxRate?: number; updateItemPurchasePrice?: boolean }[];
    notes?: string;
    terms?: string;
  }): Promise<PurchaseOrder> {
    const activeLoc = this.locations.find(l => l.id === poData.locationId) || this.activeLocation;
    const supplier = this.parties.find(p => p.id === poData.supplierId);
    const orderDate = poData.orderDate || new Date().toISOString().split('T')[0];

    const payload = {
      supplierId: poData.supplierId,
      supplier_id: poData.supplierId,
      supplierName: supplier?.name,
      supplierPhone: supplier?.phone,
      locationId: poData.locationId || activeLoc?.id,
      location_id: poData.locationId || activeLoc?.id,
      locationName: activeLoc?.name,
      orderDate: orderDate,
      order_date: orderDate,
      expectedDeliveryDate: poData.expectedDeliveryDate || undefined,
      expected_delivery_date: poData.expectedDeliveryDate || undefined,
      items: poData.items.map(it => {
        const catItem = this.items.find(i => i.id === it.itemId);
        return {
          itemId: it.itemId,
          item_id: it.itemId,
          itemName: catItem?.name || 'Item',
          item_name: catItem?.name || 'Item',
          sku: catItem?.sku,
          unit: catItem?.unit || 'pcs',
          orderedQuantity: it.orderedQty,
          ordered_qty: it.orderedQty,
          unitCost: it.unitPrice,
          unit_cost: it.unitPrice,
          unitPrice: it.unitPrice,
          unit_price: it.unitPrice,
          taxRate: it.taxRate || catItem?.taxRate || 0,
          tax_rate: it.taxRate || catItem?.taxRate || 0,
          updateMasterPurchasePrice: it.updateItemPurchasePrice || false,
          update_item_purchase_price: it.updateItemPurchasePrice || false,
        };
      }),
      notes: poData.notes,
      terms: poData.terms,
    };

    try {
      const res = await apiClient.post('/purchase-orders', payload);
      if (res.data) {
        const createdPO = this.mapPoDocToPurchaseOrder(res.data);
        this.purchaseOrders = [createdPO, ...this.purchaseOrders.filter(p => p.id !== createdPO.id)];
        try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
        return createdPO;
      }
    } catch (err: any) {
      console.error('Backend PO creation failed:', err?.response?.data || err);
      // If server returned 422 or 400 validation error, rethrow so the UI displays the exact reason
      if (err?.response?.data?.detail) {
        const detailMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
        throw new Error(`Validation Error: ${detailMsg}`);
      }
    }

    // Local fallback
    let subtotal = 0;
    let taxTotal = 0;
    const items = poData.items.map(it => {
      const catItem = this.items.find(i => i.id === it.itemId);
      const lineSub = it.orderedQty * it.unitPrice;
      const taxRate = it.taxRate || catItem?.taxRate || 0;
      const lineTax = (lineSub * taxRate) / 100;
      subtotal += lineSub;
      taxTotal += lineTax;
      return {
        itemId: it.itemId,
        name: catItem?.name || 'Item',
        sku: catItem?.sku,
        barcode: catItem?.barcode,
        unit: catItem?.unit || 'pcs',
        orderedQty: it.orderedQty,
        receivedQty: 0,
        unitPrice: it.unitPrice,
        taxRate,
        taxAmount: Number(lineTax.toFixed(2)),
        totalAmount: Number((lineSub + lineTax).toFixed(2)),
        updateItemPurchasePrice: it.updateItemPurchasePrice,
      };
    });

    const localPO: PurchaseOrder = {
      id: `po_${Date.now()}`,
      poNumber: `PO-${new Date().getFullYear()}-${String(this.purchaseOrders.length + 1).padStart(4, '0')}`,
      businessId: this.currentTenant?.id || '',
      supplierId: poData.supplierId,
      supplierName: supplier?.name || 'Unknown Supplier',
      supplierPhone: supplier?.phone,
      supplierGstin: supplier?.gstin,
      supplierAddress: supplier?.address,
      locationId: activeLoc?.id || 'loc_default',
      locationName: activeLoc?.name || 'Main Branch',
      orderDate: orderDate,
      expectedDeliveryDate: poData.expectedDeliveryDate,
      status: 'ORDERED',
      items,
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      grandTotal: Number((subtotal + taxTotal).toFixed(2)),
      totalReceivedAmount: 0,
      totalPaidAmount: 0,
      balanceDue: 0,
      paymentStatus: 'NO_DUES',
      notes: poData.notes,
      terms: poData.terms,
      receiptHistory: [],
      payments: [],
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser?.id,
      createdByName: this.currentUser?.name,
    };

    this.purchaseOrders = [localPO, ...this.purchaseOrders];
    try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
    return localPO;
  }

  async recordPurchaseOrderPayment(poId: string, paymentData: {
    amount: number;
    paymentMode?: string;
    referenceNumber?: string;
    notes?: string;
    paidAt?: string;
  }): Promise<PurchaseOrder> {
    const payload = {
      amount: Number(paymentData.amount),
      paymentMode: paymentData.paymentMode || 'BANK_TRANSFER',
      payment_mode: paymentData.paymentMode || 'BANK_TRANSFER',
      referenceNumber: paymentData.referenceNumber || undefined,
      reference_number: paymentData.referenceNumber || undefined,
      notes: paymentData.notes || undefined,
      paidAt: paymentData.paidAt || undefined,
      paid_at: paymentData.paidAt || undefined,
    };

    try {
      const res = await apiClient.post(`/purchase-orders/${poId}/payments`, payload);
      if (res.data) {
        const updatedPO = this.mapPoDocToPurchaseOrder(res.data);
        this.purchaseOrders = this.purchaseOrders.map(p => p.id === poId ? updatedPO : p);
        try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
        this.fetchParties().catch(() => {});
        return updatedPO;
      }
    } catch (err: any) {
      console.error('Backend PO payment failed:', err?.response?.data || err);
      if (err?.response?.data?.detail) {
        const detailMsg = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail);
        throw new Error(`Payment Error: ${detailMsg}`);
      }
    }

    // Local fallback
    const po = this.purchaseOrders.find(p => p.id === poId);
    if (!po) throw new Error('Purchase order not found');

    const payAmount = Number(paymentData.amount);
    const newPaid = Number(((po.totalPaidAmount || 0) + payAmount).toFixed(2));
    const recAmount = Number(po.totalReceivedAmount || (po.status === 'RECEIVED' || po.status === 'FULLY_RECEIVED' ? po.grandTotal : 0));
    const balDue = Math.max(0, Number((recAmount - newPaid).toFixed(2)));

    po.totalPaidAmount = newPaid;
    po.balanceDue = balDue;
    po.paymentStatus = balDue <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    po.payments = po.payments || [];
    po.payments.push({
      paymentId: `pay_${Date.now()}`,
      paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
      amount: payAmount,
      paymentMode: paymentData.paymentMode || 'BANK_TRANSFER',
      referenceNumber: paymentData.referenceNumber,
      notes: paymentData.notes,
      paidAt: paymentData.paidAt || new Date().toISOString(),
    });

    try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
    return po;
  }

  async fetchPurchasesSummaryReport(params: { fromDate?: string; toDate?: string } = {}): Promise<PurchasesSummaryReport> {
    try {
      const qParams: Record<string, any> = {};
      if (params.fromDate) qParams.fromDate = params.fromDate;
      if (params.toDate) qParams.toDate = params.toDate;
      const res = await apiClient.get('/reports/purchases', { params: qParams });
      if (res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('Could not fetch purchases summary report from API:', err);
    }

    // Local calculation fallback
    const fromDate = params.fromDate;
    const toDate = params.toDate;
    const pos = this.purchaseOrders.filter(p => {
      if (p.status === 'CANCELLED') return false;
      const poDate = p.orderDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
      if (fromDate && poDate && poDate < fromDate) return false;
      if (toDate && poDate && poDate > toDate) return false;
      return true;
    });

    let totOrd = 0;
    let totRec = 0;
    let totPaid = 0;
    let totPending = 0;
    let totTax = 0;
    const supMap = new Map<string, PurchasesBySupplierItem>();

    pos.forEach(po => {
      const g = Number(po.grandTotal || 0);
      const r = Number(po.totalReceivedAmount || (po.status === 'RECEIVED' || po.status === 'FULLY_RECEIVED' ? po.grandTotal : 0));
      const p = Number(po.totalPaidAmount || 0);
      const bal = Math.max(0, r - p);
      const tx = Number(po.taxTotal || 0);

      totOrd += g;
      totRec += r;
      totPaid += p;
      totPending += bal;
      totTax += tx;

      const sup = supMap.get(po.supplierId) || {
        supplier_id: po.supplierId,
        supplier_name: po.supplierName,
        orders_count: 0,
        ordered_amount: 0,
        received_amount: 0,
        paid_amount: 0,
        pending_balance: 0,
      };
      sup.orders_count += 1;
      sup.ordered_amount += g;
      sup.received_amount += r;
      sup.paid_amount += p;
      sup.pending_balance += bal;
      supMap.set(po.supplierId, sup);
    });

    return {
      total_orders_count: pos.length,
      total_ordered_amount: Number(totOrd.toFixed(2)),
      total_received_amount: Number(totRec.toFixed(2)),
      total_paid_amount: Number(totPaid.toFixed(2)),
      total_pending_payables: Number(totPending.toFixed(2)),
      total_tax_input_credit: Number(totTax.toFixed(2)),
      by_supplier: Array.from(supMap.values()),
    };
  }

  async receivePurchaseOrder(id: string, receiveData: {
    items: { itemId: string; qty: number }[];
    notes?: string;
    payment?: {
      amount: number;
      paymentMode: string;
      referenceNumber?: string;
      notes?: string;
    };
  }): Promise<PurchaseOrder> {
    const payload = {
      receivedItems: receiveData.items.map(it => ({
        itemId: it.itemId,
        item_id: it.itemId,
        quantityReceived: it.qty,
        quantity_received: it.qty,
        qty: it.qty,
      })),
      items: receiveData.items.map(it => ({
        itemId: it.itemId,
        item_id: it.itemId,
        quantityReceived: it.qty,
        quantity_received: it.qty,
        qty: it.qty,
      })),
      receiptNotes: receiveData.notes,
      receipt_notes: receiveData.notes,
      notes: receiveData.notes,
      paymentDetails: receiveData.payment ? {
        amountPaid: receiveData.payment.amount,
        amount_paid: receiveData.payment.amount,
        amount: receiveData.payment.amount,
        paymentMode: receiveData.payment.paymentMode,
        payment_mode: receiveData.payment.paymentMode,
        referenceNumber: receiveData.payment.referenceNumber,
        reference_number: receiveData.payment.referenceNumber,
        notes: receiveData.payment.notes,
      } : undefined,
    };

    try {
      const res = await apiClient.post(`/purchase-orders/${id}/receive`, payload);
      if (res.data) {
        const updatedPO = this.mapPoDocToPurchaseOrder(res.data);
        this.purchaseOrders = this.purchaseOrders.map(p => p.id === id ? updatedPO : p);
        try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
        // Refresh items/parties cache
        this.fetchItems().catch(() => {});
        this.fetchParties().catch(() => {});
        return updatedPO;
      }
    } catch (err: any) {
      console.error('Backend PO receive failed:', err?.response?.data || err);
      if (err?.response?.data?.detail) {
        const detailMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
        throw new Error(`Receive Error: ${detailMsg}`);
      }
    }

    // Local fallback receiving
    const po = this.purchaseOrders.find(p => p.id === id);
    if (!po) throw new Error('Purchase order not found');

    const receiptItems: { itemId: string; name: string; qty: number }[] = [];
    let allCompleted = true;

    po.items = po.items.map(item => {
      const rec = receiveData.items.find(r => r.itemId === item.itemId);
      const addQty = rec ? rec.qty : 0;
      if (addQty > 0) {
        receiptItems.push({ itemId: item.itemId, name: item.name, qty: addQty });
        // Adjust stock
        this.adjustStock(item.itemId, addQty, po.locationId);
      }
      const newRecQty = item.receivedQty + addQty;
      if (newRecQty < item.orderedQty) allCompleted = false;
      return { ...item, receivedQty: newRecQty };
    });

    const anyReceived = po.items.some(it => it.receivedQty > 0);
    po.status = allCompleted ? 'RECEIVED' : (anyReceived ? 'PARTIALLY_RECEIVED' : po.status);

    po.receiptHistory = po.receiptHistory || [];
    po.receiptHistory.push({
      id: `rec_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      receivedBy: this.currentUser?.id || 'usr_staff',
      receivedByName: this.currentUser?.name || 'Staff',
      locationId: po.locationId,
      locationName: po.locationName,
      notes: receiveData.notes,
      itemsReceived: receiptItems,
      paymentRecorded: receiveData.payment ? {
        amount: receiveData.payment.amount,
        paymentMode: receiveData.payment.paymentMode,
        referenceNumber: receiveData.payment.referenceNumber,
      } : undefined,
    });

    this.purchaseOrders = this.purchaseOrders.map(p => p.id === id ? po : p);
    try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
    return po;
  }

  async cancelPurchaseOrder(id: string, cancellationReason: string): Promise<PurchaseOrder> {
    try {
      const res = await apiClient.post(`/purchase-orders/${id}/cancel`, {
        cancellation_reason: cancellationReason,
      });
      if (res.data) {
        const cancelledPO = this.mapPoDocToPurchaseOrder(res.data);
        this.purchaseOrders = this.purchaseOrders.map(p => p.id === id ? cancelledPO : p);
        try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
        return cancelledPO;
      }
    } catch (err) {
      console.warn('Backend PO cancel failed, applying local fallback:', err);
    }

    const po = this.purchaseOrders.find(p => p.id === id);
    if (!po) throw new Error('Purchase order not found');

    po.status = 'CANCELLED';
    po.cancellationReason = cancellationReason;
    this.purchaseOrders = this.purchaseOrders.map(p => p.id === id ? po : p);
    try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
    return po;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/purchase-orders/${id}`);
      this.purchaseOrders = this.purchaseOrders.filter(p => p.id !== id);
      try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
      return true;
    } catch (err) {
      console.warn('Backend PO delete failed, applying local fallback:', err);
      this.purchaseOrders = this.purchaseOrders.filter(p => p.id !== id);
      try { localStorage.setItem('qb_purchase_orders', JSON.stringify(this.purchaseOrders)); } catch {}
      return true;
    }
  }

  // --- Staged / Held Orders (Multi-Tenant & Location Scoped with Cloud DB Sync) ---
  getStagedOrders(locationId?: string): StagedOrder[] {
    const activeTenantId = this.currentTenant?.id || '';
    const targetLocId = locationId || this.activeLocation?.id;
    return this.stagedOrders.filter(order => {
      const matchTenant = !order.businessId || order.businessId === activeTenantId;
      const matchLoc = !targetLocId || targetLocId === 'ALL' || !order.locationId || order.locationId === targetLocId;
      return matchTenant && matchLoc;
    });
  }

  async fetchStagedOrders(locationId?: string): Promise<StagedOrder[]> {
    const activeTenantId = this.currentTenant?.id || '';
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
        this.saveToStorage();
        this.notifyListeners();
        return this.getStagedOrders(targetLocId);
      }
    } catch (e) {
      console.warn('Could not fetch remote staged orders, using offline local cache:', e);
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
    const activeTenantId = this.currentTenant?.id || '';
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
        id: orderData.id || `stg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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

    this.saveToStorage();
    this.notifyListeners();

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
          this.saveToStorage();
          this.notifyListeners();
        }
      }
    } catch (err) {
      console.warn('Backend staged order sync failed, queued in offline local storage:', err);
    }

    return targetOrder;
  }

  async updateStagedOrderLabel(id: string, newLabel: string): Promise<StagedOrder | null> {
    const idx = this.stagedOrders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    this.stagedOrders[idx].label = newLabel;
    this.stagedOrders[idx].updatedAt = new Date().toISOString();
    this.saveToStorage();
    this.notifyListeners();

    try {
      await apiClient.put(`/staged-orders/${id}`, {
        id,
        label: newLabel,
        cart: this.stagedOrders[idx].cart,
      });
    } catch (e) {
      console.warn('Backend update staged order label failed, saved locally:', e);
    }
    return this.stagedOrders[idx];
  }

  async deleteStagedOrder(id: string): Promise<boolean> {
    this.stagedOrders = this.stagedOrders.filter(o => o.id !== id);
    this.saveToStorage();
    this.notifyListeners();

    try {
      await apiClient.delete(`/staged-orders/${id}`);
      return true;
    } catch (err) {
      console.warn('Backend staged order delete failed, removed locally:', err);
      return true;
    }
  }
}


export const store = new StoreService();

