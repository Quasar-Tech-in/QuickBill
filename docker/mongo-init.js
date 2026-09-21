// MongoDB Initialization Script for QuickBill & Inventory System
// Seeds collections, unique indexes, and a default demo business tenant

const dbName = 'quickbill_db';
const db = db.getSiblingDB(dbName);

print('Initializing collections and compound tenant indexes for ' + dbName + '...');

// 1. Users Collection
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true });

// 2. Businesses Collection
db.createCollection('businesses');

// 3. Business Members (RBAC & Multi-tenancy Mapping)
db.createCollection('business_members');
db.business_members.createIndex({ businessId: 1, userId: 1 }, { unique: true });
db.business_members.createIndex({ userId: 1 });

// 4. Items (Products) Collection
db.createCollection('items');
db.items.createIndex({ businessId: 1, publicItemId: 1 }, { unique: true });
db.items.createIndex({ businessId: 1, sku: 1 }, { unique: true, sparse: true });
db.items.createIndex({ businessId: 1, name: 'text' });
db.items.createIndex({ businessId: 1, categoryId: 1, isActive: 1 });

// 5. Invoices (Sales) Collection
db.createCollection('invoices');
db.invoices.createIndex({ businessId: 1, invoiceNumber: 1 }, { unique: true });
db.invoices.createIndex({ businessId: 1, createdAt: -1 });
db.invoices.createIndex({ businessId: 1, partyId: 1, createdAt: -1 });
db.invoices.createIndex({ businessId: 1, paymentStatus: 1 });

// 6. Inventory Movements (Immutable Stock Ledger)
db.createCollection('inventory_movements');
db.inventory_movements.createIndex({ businessId: 1, itemId: 1, createdAt: -1 });
db.inventory_movements.createIndex({ businessId: 1, referenceType: 1, referenceId: 1 });

// 7. Parties (Customers & Suppliers)
db.createCollection('parties');
db.parties.createIndex({ businessId: 1, phone: 1 });
db.parties.createIndex({ businessId: 1, name: 1 });

// 8. Payments Collection
db.createCollection('payments');
db.payments.createIndex({ businessId: 1, partyId: 1, paidAt: -1 });
db.payments.createIndex({ businessId: 1, invoiceId: 1 });

// 9. Expenses Collection
db.createCollection('expenses');
db.expenses.createIndex({ businessId: 1, expenseDate: -1 });
db.expenses.createIndex({ businessId: 1, categoryId: 1 });

print('Indexes successfully initialized.');
