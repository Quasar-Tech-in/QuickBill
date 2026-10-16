export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'CASHIER' | 'MANAGER';

export interface StoreLocation {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  gstin?: string;
  isDefault?: boolean;
  isActive: boolean;
  createdAt?: string;
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
  logoUrl?: string;
  tagline?: string;
  receiptFooterNote?: string;
  printerPaperSize?: '58mm' | '80mm';
  upiQrEnabled?: boolean;
}

export interface ItemLocationInventory {
  locationId: string;
  locationName?: string;
  mrp?: number;
  salePrice: number;
  purchasePrice: number;
  currentStock: number;
  minStockAlert: number;
  isListed: boolean;
  hasDiscount?: boolean;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
}

export interface ItemCategory {
  id: string;
  businessId?: string;
  name: string;
  type?: 'PRODUCT' | 'EXPENSE';
  description?: string;
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
}

export interface Item {
  id: string;
  businessId?: string;
  publicItemId: string;
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  taxRate: number; // 0, 5, 12, 18, 28
  unit: string; // pcs, kg, g, ltr, ml, box, meter
  description?: string;
  mrp?: number;
  salePrice: number;
  purchasePrice: number;
  currentStock: number;
  minStockAlert: number;
  hasDiscount?: boolean;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  allowParts?: boolean; // Sell in parts / fractional quantity
  imageUrl?: string;
  locations?: ItemLocationInventory[];
  batches?: ItemBatch[];
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
  locationIds?: string[];
  locationName?: string;
  totalSpent?: number;
  totalVisits?: number;
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

export interface StagedOrder {
  id: string;
  businessId?: string;
  locationId?: string;
  locationName?: string;
  label: string; // e.g. "Table 4", "Rohan (Cold Coffee)", "Order #1"
  customerName?: string;
  customerPhone?: string;
  partyId?: string;
  selectedPartyId?: string;
  cart: CartItem[];
  items?: CartItem[];
  itemCount?: number;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  discountAmount?: number;
  orderDiscountType?: 'PERCENT' | 'FLAT';
  orderDiscountValue?: string;
  paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER' | 'SPLIT';
  subtotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  unit?: string;
  quantity: number;
  returnedQuantity?: number;
  returnReason?: string;
  returnNote?: string;
  returnDate?: string;
  returnStatus?: 'NONE' | 'PARTIAL' | 'FULL';
  unitPrice: number;
  discount?: number;
  discountPercent: number;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  discountAmount?: number;
  taxRate: number;
  taxAmount: number;
  taxableAmount?: number;
  total: number;
  originalTotal?: number;
}

export interface Invoice {
  id: string;
  businessId?: string;
  locationId?: string;
  locationName?: string;
  locationCode?: string;
  locationAddress?: string;
  locationPhone?: string;
  locationGstin?: string;
  invoiceNumber: string;
  date: string;
  partyId?: string;
  partyName: string;
  partyPhone?: string;
  consumerName?: string;
  consumerPhone?: string;
  billedById?: string;
  billedByName?: string;
  type: 'SALE' | 'PURCHASE';
  items: InvoiceItem[];
  grossTotal?: number;
  subtotal: number;
  taxTotal: number;
  itemDiscountTotal?: number;
  orderDiscountAmount?: number;
  invoiceDiscount?: number;
  discountTotal: number;
  roundOff: number;
  grandTotal: number;
  originalGrandTotal?: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER' | 'SPLIT';
  splitPayments?: {
    cash?: number;
    upi?: number;
    card?: number;
  };
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'CANCELLED' | 'RETURNS' | 'RETURNED' | 'PARTIALLY_RETURNED';
  hasReturns?: boolean;
  returnTotal?: number;
  returnStatus?: 'NONE' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';
  returnNotes?: string;
  returns?: any[];
  notes?: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  itemId: string;
  name: string;
  sku?: string;
  unit?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export interface PurchaseOrderPayment {
  paymentId: string;
  amount: number;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  paymentDate: string;
  recordedBy?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  businessId?: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierGstin?: string;
  supplierAddress?: string;
  locationId?: string;
  locationName?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: PurchaseOrderStatus;
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  totalReceivedAmount?: number;
  totalPaidAmount?: number;
  balanceDue?: number;
  payments?: PurchaseOrderPayment[];
  notes?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE';
  title: string;
  partyOrPayee: string;
  partyId?: string;
  category?: string;
  paymentMode: string;
  referenceNumber?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  amount: number;
  locationName?: string;
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
}

export interface DashboardStats {
  todaySales: number;
  todayTransactionsCount: number;
  totalReceivables: number;
  totalPayables: number;
  lowStockCount: number;
  netProfit: number;
}

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export interface TenantSubscription {
  planId: PlanTier;
  planName: string;
  status: SubscriptionStatus;
  maxUsers: number;
  maxLocations: number;
  billingCycle: BillingCycle;
  startDate: string;
  endDate: string;
  daysRemaining?: number;
  gracePeriodDays?: number;
  pricePerCycle?: number;
  currency?: string;
  autoRenew?: boolean;
  features?: string[];
  notes?: string;
}

export interface TenantDatabaseConfig {
  isolationMode: 'SHARED' | 'DEDICATED_DATABASE' | 'CUSTOM_CLUSTER';
  mongodbUri?: string;
  databaseName: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug?: string;
  plan: PlanTier;
  status: 'ACTIVE' | 'SUSPENDED';
  adminEmail: string;
  phone?: string;
  gstin?: string;
  address?: string;
  logoUrl?: string;
  tagline?: string;
  receiptFooterNote?: string;
  createdAt?: string;
  databaseConfig?: TenantDatabaseConfig;
  subscription?: TenantSubscription;
  stats?: {
    productsCount: number;
    invoicesCount: number;
    monthlyGmv: number;
    usersCount: number;
    locationsCount?: number;
  };
}

export type InventoryMovementType = 
  | 'PURCHASE' 
  | 'SALE' 
  | 'SALE_RETURN' 
  | 'MANUAL_ADJUSTMENT' 
  | 'DAMAGED_WRITE_OFF' 
  | 'OPENING_STOCK' 
  | 'PO_CANCEL' 
  | 'PRICE_CHANGE' 
  | 'PRODUCT_UPDATE';

export interface InventoryMovement {
  id: string;
  businessId?: string;
  itemId: string;
  publicItemId?: string;
  itemName: string;
  sku?: string;
  locationId?: string;
  locationName?: string;
  type: InventoryMovementType | string;
  movementType?: InventoryMovementType | string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  quantity?: number;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  resultingStock?: number;
  unitCost: number;
  totalCost?: number;
  reason?: string;
  notes?: string;
  createdByUserId?: string;
  createdByName?: string;
  createdAt: string;
}

