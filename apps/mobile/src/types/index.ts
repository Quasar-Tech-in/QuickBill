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

export interface InvoiceItem {
  itemId: string;
  name: string;
  unit?: string;
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
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'BANK_TRANSFER' | 'SPLIT';
  splitPayments?: {
    cash?: number;
    upi?: number;
    card?: number;
  };
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'CANCELLED';
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
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  createdAt: string;
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
