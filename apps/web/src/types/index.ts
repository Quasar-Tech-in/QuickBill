export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'CASHIER' | 'MANAGER';

export interface StoreLocation {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  tenantName?: string;
  token?: string;
  assignedLocationIds?: string[];
  isActive?: boolean;
  createdAt?: string;
}

export interface Business {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency: string;
}

export interface ItemLocationInventory {
  locationId: string;
  locationName?: string;
  mrp?: number; // Base MRP / List Price (defaults to salePrice if not set)
  salePrice: number; // Effective selling price (after discount)
  purchasePrice: number;
  currentStock: number;
  minStockAlert: number;
  isListed: boolean; // whether this item is active/sold at this branch
  hasDiscount?: boolean;
  discountType?: 'PERCENT' | 'FLAT'; // '%' or '₹'
  discountValue?: number;
}

export interface ItemCategory {
  id: string;
  businessId?: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface ItemImage {
  id: string;
  url: string;
  order: number; // 0, 1, 2...
  isPrimary?: boolean;
  name?: string;
  sizeBytes?: number;
  originalSizeBytes?: number;
}

export interface Item {
  id: string;
  businessId?: string;
  publicItemId: string;
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  taxRate: number; // e.g. 5, 12, 18, 0
  unit: string;
  description?: string;
  // Master defaults (fallback)
  mrp?: number;
  salePrice: number;
  purchasePrice: number;
  currentStock: number;
  minStockAlert: number;
  hasDiscount?: boolean;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  // Multi-location specific stock and pricing overrides
  locations?: ItemLocationInventory[];
  // Product image gallery with ordered indexing
  images?: ItemImage[];
  imageUrl?: string;
}

export interface Party {
  id: string;
  businessId?: string;
  name: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  currentBalance: number; // Positive = Receivable, Negative = Payable
  locationIds?: string[]; // Assigned locations (empty/null means Global / All Locations)
  locationId?: string;
  locationName?: string;
}

export interface CartItem {
  item: Item;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  taxRate: number;
  lineTotal: number;
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Invoice {
  id: string;
  businessId?: string;
  locationId?: string;
  locationName?: string;
  locationCode?: string;
  locationAddress?: string;
  locationPhone?: string;
  invoiceNumber: string;
  date: string;
  partyId?: string;
  partyName: string;
  partyPhone?: string;
  consumerName?: string;
  consumerPhone?: string;
  billedById?: string;
  billedByName?: string;
  billedByRole?: string;
  type: 'SALE' | 'PURCHASE';
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER';
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes?: string;
}

export interface Payment {
  id: string;
  businessId?: string;
  date: string;
  partyId: string;
  partyName: string;
  type: 'PAYMENT_IN' | 'PAYMENT_OUT';
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber?: string;
  notes?: string;
}

export interface DashboardStats {
  todaySales: number;
  todayTransactionsCount: number;
  totalReceivables: number;
  totalPayables: number;
  lowStockCount: number;
  netProfit: number;
}

export interface TenantDatabaseConfig {
  isolationMode: 'SHARED' | 'DEDICATED_DATABASE' | 'CUSTOM_CLUSTER';
  mongodbUri?: string;
  databaseName: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED';
  adminEmail: string;
  phone?: string;
  gstin?: string;
  createdAt: string;
  databaseConfig: TenantDatabaseConfig;
  stats: {
    productsCount: number;
    invoicesCount: number;
    monthlyGmv: number;
    usersCount: number;
  };
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  globalCombinedGmv: number;
  totalProducts: number;
  totalInvoices: number;
  databaseClustersCount: number;
}
