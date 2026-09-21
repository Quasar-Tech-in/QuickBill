import { Item, Party, Invoice, Payment, DashboardStats } from '../types';

export const INITIAL_ITEMS: Item[] = [
  {
    id: 'item_1',
    publicItemId: 'ITM-1001',
    name: 'Basmati Rice (1kg Pack)',
    sku: 'RICE-001',
    category: 'Grocery',
    salePrice: 120.0,
    purchasePrice: 95.0,
    taxRate: 5,
    unit: 'kg',
    currentStock: 45,
    minStockAlert: 10,
  },
  {
    id: 'item_2',
    publicItemId: 'ITM-1002',
    name: 'Refined Sunflower Oil (1L)',
    sku: 'OIL-002',
    category: 'Grocery',
    salePrice: 145.0,
    purchasePrice: 120.0,
    taxRate: 5,
    unit: 'ltr',
    currentStock: 8,
    minStockAlert: 15,
  },
  {
    id: 'item_3',
    publicItemId: 'ITM-1003',
    name: 'Wireless Optical Mouse',
    sku: 'ACC-003',
    category: 'Electronics',
    salePrice: 499.0,
    purchasePrice: 320.0,
    taxRate: 18,
    unit: 'pcs',
    currentStock: 24,
    minStockAlert: 5,
  },
  {
    id: 'item_4',
    publicItemId: 'ITM-1004',
    name: 'USB-C Fast Charging Cable',
    sku: 'ACC-004',
    category: 'Electronics',
    salePrice: 249.0,
    purchasePrice: 110.0,
    taxRate: 18,
    unit: 'pcs',
    currentStock: 3,
    minStockAlert: 10,
  },
  {
    id: 'item_5',
    publicItemId: 'ITM-1005',
    name: 'Dairy Milk Silk Chocolate',
    sku: 'SNK-005',
    category: 'Confectionery',
    salePrice: 90.0,
    purchasePrice: 72.0,
    taxRate: 12,
    unit: 'pcs',
    currentStock: 50,
    minStockAlert: 12,
  },
  {
    id: 'item_6',
    publicItemId: 'ITM-1006',
    name: 'Organic Green Tea (25 Bags)',
    sku: 'BEV-006',
    category: 'Beverages',
    salePrice: 185.0,
    purchasePrice: 135.0,
    taxRate: 5,
    unit: 'box',
    currentStock: 19,
    minStockAlert: 8,
  }
];

export const INITIAL_PARTIES: Party[] = [
  {
    id: 'party_1',
    name: 'Walk-in Retail Customer',
    type: 'CUSTOMER',
    phone: '+91 9876543210',
    currentBalance: 0,
  },
  {
    id: 'party_2',
    name: 'Sharma Traders & Supermart',
    type: 'CUSTOMER',
    phone: '+91 9811223344',
    email: 'sharma.traders@gmail.com',
    gstin: '07AAAAA0000A1Z5',
    currentBalance: 8450.0, // Receivable
  },
  {
    id: 'party_3',
    name: 'Apex Wholesale Distributors',
    type: 'SUPPLIER',
    phone: '+91 9988776655',
    email: 'orders@apexwholesale.in',
    gstin: '07BBBBB1111B2Z6',
    currentBalance: -15200.0, // Payable
  },
  {
    id: 'party_4',
    name: 'Metro Tech Suppliers',
    type: 'SUPPLIER',
    phone: '+91 9123456780',
    currentBalance: -4500.0,
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv_101',
    invoiceNumber: 'INV-2026-001',
    date: new Date().toISOString().split('T')[0],
    partyName: 'Walk-in Retail Customer',
    type: 'SALE',
    items: [
      {
        itemId: 'item_1',
        name: 'Basmati Rice (1kg Pack)',
        quantity: 2,
        unitPrice: 120.0,
        discountPercent: 0,
        taxRate: 5,
        taxAmount: 12.0,
        total: 252.0
      },
      {
        itemId: 'item_5',
        name: 'Dairy Milk Silk Chocolate',
        quantity: 3,
        unitPrice: 90.0,
        discountPercent: 0,
        taxRate: 12,
        taxAmount: 32.4,
        total: 302.4
      }
    ],
    subtotal: 510.0,
    taxTotal: 44.4,
    discountTotal: 0,
    roundOff: 0.6,
    grandTotal: 555.0,
    paidAmount: 555.0,
    balanceAmount: 0,
    paymentMode: 'UPI',
    status: 'PAID',
    notes: 'Counter POS sale via PhonePe QR'
  },
  {
    id: 'inv_102',
    invoiceNumber: 'INV-2026-002',
    date: new Date().toISOString().split('T')[0],
    partyId: 'party_2',
    partyName: 'Sharma Traders & Supermart',
    type: 'SALE',
    items: [
      {
        itemId: 'item_3',
        name: 'Wireless Optical Mouse',
        quantity: 10,
        unitPrice: 499.0,
        discountPercent: 5,
        taxRate: 18,
        taxAmount: 853.29,
        total: 5593.79
      }
    ],
    subtotal: 4740.5,
    taxTotal: 853.29,
    discountTotal: 249.5,
    roundOff: 0.21,
    grandTotal: 5594.0,
    paidAmount: 2000.0,
    balanceAmount: 3594.0,
    paymentMode: 'CREDIT',
    status: 'PARTIAL',
    notes: 'Partial payment received via NEFT'
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay_1',
    date: new Date().toISOString().split('T')[0],
    partyId: 'party_2',
    partyName: 'Sharma Traders & Supermart',
    type: 'PAYMENT_IN',
    amount: 2000.0,
    paymentMode: 'UPI',
    referenceNumber: 'UPI/628491823901',
    notes: 'Invoice INV-2026-002 advance part payment'
  }
];
