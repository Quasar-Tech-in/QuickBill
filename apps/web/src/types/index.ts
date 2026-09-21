export interface Business {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency: string;
}

export interface Item {
  id: string;
  publicItemId: string;
  name: string;
  sku?: string;
  category: string;
  salePrice: number;
  purchasePrice: number;
  taxRate: number; // e.g. 5, 12, 18, 0
  unit: string;
  currentStock: number;
  minStockAlert: number;
}

export interface Party {
  id: string;
  name: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  phone?: string;
  email?: string;
  gstin?: string;
  currentBalance: number; // Positive = Receivable, Negative = Payable
}

export interface CartItem {
  item: Item;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
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
  invoiceNumber: string;
  date: string;
  partyId?: string;
  partyName: string;
  type: 'SALE' | 'PURCHASE';
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
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
  date: string;
  partyId: string;
  partyName: string;
  type: 'PAYMENT_IN' | 'PAYMENT_OUT';
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
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
