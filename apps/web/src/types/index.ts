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
  type?: 'PRODUCT' | 'EXPENSE';
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

export interface ItemBatch {
  batchId?: string;
  batchNumber: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  purchasePrice: number;
  salePrice?: number;
  mrp?: number;
  currentStock: number;
  locationId?: string;
  receivedDate?: string;
  receivedAt?: string;
  supplierId?: string;
  supplierName?: string;
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
  averageCostPrice?: number; // Weighted average cost across batches
  currentStock: number;
  minStockAlert: number;
  hasDiscount?: boolean;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  batches?: ItemBatch[]; // FIFO / Lot price tracking
  // Multi-location specific stock and pricing overrides
  locations?: ItemLocationInventory[];
  // Product image gallery with ordered indexing
  images?: ItemImage[];
  imageUrl?: string;
  allowParts?: boolean; // Sell in parts / allow fractional quantity (e.g. 1.506 kg)
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

export interface Customer {
  id: string;
  businessId?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  openingBalance: number;
  currentBalance: number;
  totalSpent: number;
  totalVisits: number;
  lastPurchaseDate?: string;
  tags?: string[];
  marketingConsent?: boolean;
  locationIds?: string[];
  notes?: string;
  createdAt: string;
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
  allowParts?: boolean;
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  unit?: string;
  quantity: number;
  returnedQuantity?: number;
  returnReason?: 'RESTOCKABLE_RETURN' | 'DEFECTIVE_DAMAGED' | 'EXCHANGE' | 'WRONG_ITEM';
  returnNote?: string;
  returnDate?: string;
  returnStatus?: 'NONE' | 'PARTIAL' | 'FULL';
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
  originalGrandTotal?: number;
  returnTotal?: number;
  hasReturns?: boolean;
  returnStatus?: 'NONE' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';
  returnNotes?: string;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER';
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'CONFIRMED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED' | 'REFUNDED';
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
  address?: string;
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

export interface Expense {
  id: string;
  businessId?: string;
  category: string;
  amount: number;
  payee?: string;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber?: string;
  description?: string;
  locationId?: string;
  locationName?: string;
  expenseDate: string;
  createdAt?: string;
}

export interface ExpenseCategory {
  id: string;
  businessId?: string;
  name: string;
  type?: 'PRODUCT' | 'EXPENSE';
  description?: string;
  isCustom?: boolean;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE';
  title: string;
  partyOrPayee: string;
  category?: string;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  amount: number;
  locationName?: string;
}

export interface PaginatedApiResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  itemId: string;
  name: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  updateItemPurchasePrice?: boolean;
}

export interface PurchaseReceiptRecord {
  id: string;
  receivedAt: string;
  receivedBy: string;
  receivedByName?: string;
  locationId: string;
  locationName?: string;
  notes?: string;
  itemsReceived: {
    itemId: string;
    name: string;
    qty: number;
  }[];
  paymentRecorded?: {
    amount: number;
    paymentMode: string;
    referenceNumber?: string;
  };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierGstin?: string;
  supplierAddress?: string;
  locationId: string;
  locationName?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  terms?: string;
  cancellationReason?: string;
  receiptHistory?: PurchaseReceiptRecord[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
}



