import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Receipt, 
  Tag, 
  DollarSign, 
  Calendar, 
  Download, 
  Filter, 
  Edit3, 
  Trash2, 
  X, 
  MapPin, 
  CheckCircle,
  Check,
  FolderPlus,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { store } from '../services/store';
import { Expense, ExpenseCategory, LedgerEntry, Party, Payment } from '../types';

export const LedgerView: React.FC = () => {
  const currentUser = store.getCurrentUser();
  const isCashier = currentUser?.role === 'CASHIER';
  const locations = store.getAllLocations();
  const activeLoc = store.getActiveLocation();

  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [parties, setParties] = useState<Party[]>(store.getParties());
  const [expenses, setExpenses] = useState<Expense[]>(store.getExpenses());
  const [categories, setCategories] = useState<ExpenseCategory[]>(store.getExpenseCategories());
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(store.getLedgerEntries());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  // Record Entry Modal Active Tab
  const [activeTab, setActiveTab] = useState<'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE'>('EXPENSE');

  // New Payment Form (Customer Receipt / Supplier Payout)
  const [paymentForm, setPaymentForm] = useState({
    partyId: '',
    amount: '',
    paymentMode: 'UPI' as 'UPI' | 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE',
    referenceNumber: '',
    notes: '',
  });

  // New Expense Form
  const [expenseForm, setExpenseForm] = useState({
    category: 'Electricity Bill',
    customCategoryName: '',
    amount: '',
    payee: '',
    paymentMode: 'CASH' as 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE',
    referenceNumber: '',
    description: '',
    locationId: activeLoc?.id || '',
    expenseDate: new Date().toISOString().split('T')[0],
  });

  // Edit Expense Form
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    category: '',
    amount: '',
    payee: '',
    paymentMode: 'CASH' as 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE',
    referenceNumber: '',
    description: '',
    locationId: '',
    expenseDate: '',
  });

  // Category Manager Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');
  const [editingCatDesc, setEditingCatDesc] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);

  const refreshData = () => {
    const loc = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
    setParties(store.getParties(loc));
    setExpenses(store.getExpenses(loc));
    setCategories(store.getExpenseCategories());
    setLedgerEntries(store.getLedgerEntries(loc));
  };

  useEffect(() => {
    refreshData();
    const loc = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
    Promise.allSettled([
      store.fetchExpenses(loc),
      store.fetchParties(loc),
      store.fetchExpenseCategories(),
    ]).then(() => {
      refreshData();
    });
  }, [selectedLocationId]);

  // Derived Financial Calculations
  const loc = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
  const currentEntries = store.getLedgerEntries(loc);

  const totalInflow = currentEntries
    .filter(e => e.type === 'PAYMENT_IN')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPayouts = currentEntries
    .filter(e => e.type === 'PAYMENT_OUT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpenses = currentEntries
    .filter(e => e.type === 'EXPENSE')
    .reduce((sum, e) => sum + e.amount, 0);

  const netCashFlow = totalInflow - totalPayouts - totalExpenses;

  // Filtered List for Table
  const filteredEntries = ledgerEntries.filter(entry => {
    if (filterType !== 'ALL' && entry.type !== filterType) return false;
    if (filterCategory !== 'ALL' && entry.category !== filterCategory) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchParty = entry.partyOrPayee.toLowerCase().includes(q);
      const matchTitle = entry.title.toLowerCase().includes(q);
      const matchRef = entry.referenceNumber ? entry.referenceNumber.toLowerCase().includes(q) : false;
      const matchNotes = entry.notes ? entry.notes.toLowerCase().includes(q) : false;
      if (!matchParty && !matchTitle && !matchRef && !matchNotes) return false;
    }

    return true;
  });

  // Customers & Suppliers lists for dropdowns
  const customerList = parties.filter(p => p.type === 'CUSTOMER');
  const supplierList = parties.filter(p => p.type === 'SUPPLIER');

  // Record Entry Handler
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (activeTab === 'EXPENSE') {
        const amt = parseFloat(expenseForm.amount);
        if (!amt || amt <= 0) return;

        let finalCategory = expenseForm.category;
        if (expenseForm.category === 'CUSTOM' && expenseForm.customCategoryName.trim()) {
          const addedCat = await store.addExpenseCategory(expenseForm.customCategoryName.trim());
          finalCategory = addedCat.name;
        }

        const chosenLoc = locations.find(l => l.id === expenseForm.locationId);

        await store.addExpense({
          category: finalCategory,
          amount: amt,
          payee: expenseForm.payee.trim() || undefined,
          paymentMode: expenseForm.paymentMode,
          referenceNumber: expenseForm.referenceNumber.trim() || undefined,
          description: expenseForm.description.trim() || undefined,
          locationId: expenseForm.locationId || undefined,
          locationName: chosenLoc ? chosenLoc.name : undefined,
          expenseDate: expenseForm.expenseDate || new Date().toISOString().split('T')[0],
        });

        // Reset expense form
        setExpenseForm({
          category: 'Electricity Bill',
          customCategoryName: '',
          amount: '',
          payee: '',
          paymentMode: 'CASH',
          referenceNumber: '',
          description: '',
          locationId: activeLoc?.id || '',
          expenseDate: new Date().toISOString().split('T')[0],
        });
      } else {
        // Payment In / Payment Out
        const amt = parseFloat(paymentForm.amount);
        if (!amt || amt <= 0 || !paymentForm.partyId) return;

        const targetParty = parties.find(p => p.id === paymentForm.partyId);
        if (!targetParty) return;

        store.recordPayment({
          date: new Date().toISOString().split('T')[0],
          partyId: targetParty.id,
          partyName: targetParty.name,
          type: activeTab,
          amount: amt,
          paymentMode: paymentForm.paymentMode,
          referenceNumber: paymentForm.referenceNumber.trim() || undefined,
          notes: paymentForm.notes.trim() || undefined,
        });

        // Reset payment form
        setPaymentForm({
          partyId: '',
          amount: '',
          paymentMode: 'UPI',
          referenceNumber: '',
          notes: '',
        });
      }

      refreshData();
      setIsRecordModalOpen(false);
    } catch (err) {
      console.error('Error recording ledger entry:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Open Edit Expense Modal
  const handleOpenEditExpense = (expenseId: string) => {
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return;

    setEditingExpense(exp);
    setEditExpenseForm({
      category: exp.category,
      amount: String(exp.amount),
      payee: exp.payee || '',
      paymentMode: exp.paymentMode || 'CASH',
      referenceNumber: exp.referenceNumber || '',
      description: exp.description || '',
      locationId: exp.locationId || '',
      expenseDate: exp.expenseDate,
    });
    setIsEditExpenseOpen(true);
  };

  // Save Edit Expense
  const handleSaveEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    const amt = parseFloat(editExpenseForm.amount);
    if (!amt || amt <= 0) return;

    setIsSaving(true);
    try {
      const chosenLoc = locations.find(l => l.id === editExpenseForm.locationId);

      await store.updateExpense(editingExpense.id, {
        category: editExpenseForm.category,
        amount: amt,
        payee: editExpenseForm.payee.trim() || undefined,
        paymentMode: editExpenseForm.paymentMode,
        referenceNumber: editExpenseForm.referenceNumber.trim() || undefined,
        description: editExpenseForm.description.trim() || undefined,
        locationId: editExpenseForm.locationId || undefined,
        locationName: chosenLoc ? chosenLoc.name : undefined,
        expenseDate: editExpenseForm.expenseDate,
      });

      refreshData();
      setIsEditExpenseOpen(false);
      setEditingExpense(null);
    } catch (err) {
      console.error('Error updating expense:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (expenseId: string) => {
    const isConfirmed = window.confirm('Are you sure you want to delete this expense record? This will immediately update your cash ledger.');
    if (!isConfirmed) return;

    await store.deleteExpense(expenseId);
    refreshData();
  };

  // Category Manager: Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    await store.addExpenseCategory(newCatName.trim(), newCatDesc.trim() || undefined);
    setNewCatName('');
    setNewCatDesc('');
    setCategories(store.getExpenseCategories());
  };

  // Category Manager: Start Inline Edit
  const handleStartEditCat = (cat: ExpenseCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatDesc(cat.description || '');
  };

  // Category Manager: Save Inline Edit
  const handleSaveEditCat = async (catId: string) => {
    if (!editingCatName.trim()) return;
    await store.updateExpenseCategory(catId, editingCatName.trim(), editingCatDesc.trim() || undefined);
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatDesc('');
    setCategories(store.getExpenseCategories());
    refreshData();
  };

  // Category Manager: Cancel Inline Edit
  const handleCancelEditCat = () => {
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatDesc('');
  };

  // Category Manager: Delete Category
  const handleDeleteCategory = async (catId: string) => {
    const target = categories.find(c => c.id === catId);
    const catName = target ? ` "${target.name}"` : '';
    const isConfirmed = window.confirm(`Are you sure you want to delete expense category${catName}? This will permanently remove it from the database.`);
    if (!isConfirmed) return;
    await store.deleteExpenseCategory(catId);
    setCategories(store.getExpenseCategories());
    refreshData();
  };

  const openCategoriesModal = () => {
    setIsCategoriesModalOpen(true);
    store.fetchExpenseCategories().then(() => {
      setCategories(store.getExpenseCategories());
    }).catch(() => {});
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = ['Date', 'Type', 'Category / Title', 'Party / Payee', 'Payment Mode', 'Reference No', 'Notes', 'Amount'];
    const rows = filteredEntries.map(e => [
      `"${e.date}"`,
      `"${e.type}"`,
      `"${e.category || e.title}"`,
      `"${e.partyOrPayee}"`,
      `"${e.paymentMode}"`,
      `"${e.referenceNumber || ''}"`,
      `"${e.notes || ''}"`,
      e.amount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Financial Ledger & Operating Expenses
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Real-time cash flow tracker for Customer Receipts, Supplier Payouts, and Shop Expenses (Electricity, Salary, Rent, etc.).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            onClick={openCategoriesModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FolderPlus size={16} />
            <span>Expense Categories</span>
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button 
            className="btn btn-primary" 
            onClick={() => {
              setActiveTab('EXPENSE');
              setIsRecordModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Record Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase' }}>
              Customer Receipts (Inflow)
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
            +₹{totalInflow.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginTop: 2 }}>
            Received from Customer Dues
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase' }}>
              Supplier Payouts (Outflow)
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>
            -₹{totalPayouts.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginTop: 2 }}>
            Paid to Vendors & Suppliers
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase' }}>
              Operating Expenses
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Receipt size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>
            -₹{totalExpenses.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginTop: 2 }}>
            Electricity, Rent, Wages, etc.
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: `4px solid ${netCashFlow >= 0 ? '#3b82f6' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase' }}>
              Net Cash Flow Balance
            </span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: netCashFlow >= 0 ? '#eff6ff' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: netCashFlow >= 0 ? '#2563eb' : '#dc2626' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: netCashFlow >= 0 ? '#1d4ed8' : '#b91c1c' }}>
            {netCashFlow >= 0 ? `+₹${netCashFlow.toFixed(2)}` : `-₹${Math.abs(netCashFlow).toFixed(2)}`}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginTop: 2 }}>
            Net Inflow vs Outflow
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search by Payee, Category, Ref #, Description..."
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Location Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={15} color="var(--primary-600)" />
              <select
                className="form-select"
                style={{ padding: '5px 10px', fontSize: '0.82rem', width: 'auto' }}
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                <option value="ALL">🌐 All Branch Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Type Buttons */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ALL', 'EXPENSE', 'PAYMENT_IN', 'PAYMENT_OUT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: filterType === t ? 'var(--primary-500)' : 'var(--neutral-200)',
                    backgroundColor: filterType === t ? 'var(--primary-50)' : '#ffffff',
                    color: filterType === t ? 'var(--primary-700)' : 'var(--neutral-600)',
                    cursor: 'pointer',
                  }}
                >
                  {t === 'ALL' ? 'All Entries' : t === 'EXPENSE' ? 'Operating Expenses' : t === 'PAYMENT_IN' ? 'Receipts' : 'Payouts'}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <select
              className="form-select"
              style={{ padding: '5px 10px', fontSize: '0.82rem', width: 'auto' }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Unified Ledger Entries Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date & Branch</th>
                <th>Entry Type</th>
                <th>Category / Purpose</th>
                <th>Party / Payee</th>
                <th>Payment Mode</th>
                <th>Ref No / Details</th>
                <th>Amount</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--neutral-400)' }}>
                    No ledger transactions or expenses found matching filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isInflow = entry.type === 'PAYMENT_IN';
                  const isOutflow = entry.type === 'PAYMENT_OUT';
                  const isExpense = entry.type === 'EXPENSE';

                  return (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{entry.date}</div>
                        {entry.locationName && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                            📍 {entry.locationName}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isInflow ? '#ecfdf5' : isOutflow ? '#fef3c7' : '#fee2e2',
                            color: isInflow ? '#059669' : isOutflow ? '#d97706' : '#dc2626',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isInflow && <ArrowDownLeft size={12} />}
                          {isOutflow && <ArrowUpRight size={12} />}
                          {isExpense && <Receipt size={12} />}
                          {isInflow ? 'Payment In' : isOutflow ? 'Payment Out' : 'Shop Expense'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                          {entry.title}
                        </div>
                        {entry.category && entry.category !== entry.title && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                            {entry.category}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--neutral-800)' }}>
                          {entry.partyOrPayee}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-700)', fontSize: '0.75rem' }}>
                          {entry.paymentMode}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--neutral-700)' }}>
                          {entry.referenceNumber || '—'}
                        </div>
                        {entry.notes && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            color: isInflow ? '#059669' : '#dc2626',
                          }}
                        >
                          {isInflow ? `+₹${entry.amount.toFixed(2)}` : `-₹${entry.amount.toFixed(2)}`}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isExpense ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Edit Expense"
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => handleOpenEditExpense(entry.id)}
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Delete Expense"
                              style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--danger-600)' }}
                              onClick={() => handleDeleteExpense(entry.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Ledger synced</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Entry Modal (Tabs: Payment In / Payment Out / Shop Expense) */}
      {isRecordModalOpen && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsRecordModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="card-header">
              <span className="card-title">Record Financial Transaction</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsRecordModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('EXPENSE')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  borderBottom: activeTab === 'EXPENSE' ? '2px solid var(--danger-600)' : '2px solid transparent',
                  backgroundColor: activeTab === 'EXPENSE' ? '#ffffff' : 'transparent',
                  color: activeTab === 'EXPENSE' ? 'var(--danger-600)' : 'var(--neutral-600)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Receipt size={15} />
                <span>Shop Expense</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PAYMENT_IN')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  borderBottom: activeTab === 'PAYMENT_IN' ? '2px solid #059669' : '2px solid transparent',
                  backgroundColor: activeTab === 'PAYMENT_IN' ? '#ffffff' : 'transparent',
                  color: activeTab === 'PAYMENT_IN' ? '#059669' : 'var(--neutral-600)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <ArrowDownLeft size={15} />
                <span>Customer Receipt</span>
              </button>

              {!isCashier && (
                <button
                  type="button"
                  onClick={() => setActiveTab('PAYMENT_OUT')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: activeTab === 'PAYMENT_OUT' ? '2px solid #d97706' : '2px solid transparent',
                    backgroundColor: activeTab === 'PAYMENT_OUT' ? '#ffffff' : 'transparent',
                    color: activeTab === 'PAYMENT_OUT' ? '#d97706' : 'var(--neutral-600)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <ArrowUpRight size={15} />
                  <span>Supplier Payout</span>
                </button>
              )}
            </div>

            <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {activeTab === 'EXPENSE' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Expense Category *</label>
                      <select
                        className="form-select"
                        value={expenseForm.category}
                        onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="CUSTOM">+ Add Custom Category...</option>
                      </select>
                    </div>

                    {expenseForm.category === 'CUSTOM' && (
                      <div className="form-group">
                        <label className="form-label">New Category Name *</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder="e.g. Generator Fuel, Water Dispenser..."
                          value={expenseForm.customCategoryName}
                          onChange={(e) => setExpenseForm({ ...expenseForm, customCategoryName: e.target.value })}
                          autoFocus
                        />
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Amount (₹) *</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          required
                          className="form-input"
                          placeholder="0.00"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Payment Mode</label>
                        <select
                          className="form-select"
                          value={expenseForm.paymentMode}
                          onChange={(e) => setExpenseForm({ ...expenseForm, paymentMode: e.target.value as any })}
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI (Google Pay / PhonePe)</option>
                          <option value="CARD">Card</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Paid To / Payee Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Electricity Board, Landlord"
                          value={expenseForm.payee}
                          onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Expense Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={expenseForm.expenseDate}
                          onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Reference ID / Bill No</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. EB-BILL-90219"
                          value={expenseForm.referenceNumber}
                          onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Branch Location</label>
                        <select
                          className="form-select"
                          value={expenseForm.locationId}
                          onChange={(e) => setExpenseForm({ ...expenseForm, locationId: e.target.value })}
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description / Remarks</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Electricity bill for September counter operations"
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">
                        {activeTab === 'PAYMENT_IN' ? 'Select Customer *' : 'Select Supplier *'}
                      </label>
                      <select
                        required
                        className="form-select"
                        value={paymentForm.partyId}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setPaymentForm({ ...paymentForm, partyId: pId });
                          const selected = parties.find(p => p.id === pId);
                          if (selected && selected.currentBalance !== 0) {
                            setPaymentForm(prev => ({ ...prev, partyId: pId, amount: String(Math.abs(selected.currentBalance)) }));
                          }
                        }}
                      >
                        <option value="">-- Choose Contact --</option>
                        {(activeTab === 'PAYMENT_IN' ? customerList : supplierList).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.phone ? `(${p.phone})` : ''} - Due: ₹{Math.abs(p.currentBalance).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Amount (₹) *</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          required
                          className="form-input"
                          placeholder="0.00"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Payment Mode</label>
                        <select
                          className="form-select"
                          value={paymentForm.paymentMode}
                          onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value as any })}
                        >
                          <option value="UPI">UPI (Google Pay / PhonePe)</option>
                          <option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                          <option value="CARD">Card</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">UTR / Transaction Reference No</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. UPI/628192839120"
                        value={paymentForm.referenceNumber}
                        onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Payment Notes</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Cleared bill balance"
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRecordModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Recording...' : 'Save & Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {isEditExpenseOpen && editingExpense && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsEditExpenseOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="card-header">
              <span className="card-title">Edit Shop Expense</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsEditExpenseOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditExpense} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Expense Category *</label>
                  <select
                    className="form-select"
                    value={editExpenseForm.category}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      className="form-input"
                      value={editExpenseForm.amount}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      className="form-select"
                      value={editExpenseForm.paymentMode}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, paymentMode: e.target.value as any })}
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Paid To / Payee Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editExpenseForm.payee}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, payee: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expense Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editExpenseForm.expenseDate}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, expenseDate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Reference ID / Bill No</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editExpenseForm.referenceNumber}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, referenceNumber: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Branch Location</label>
                    <select
                      className="form-select"
                      value={editExpenseForm.locationId}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, locationId: e.target.value })}
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editExpenseForm.description}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditExpenseOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Updating...' : 'Update Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Expense Categories Modal */}
      {isCategoriesModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCategoriesModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-header" style={{ flexShrink: 0, padding: '16px 24px', borderBottom: '1px solid var(--neutral-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>Shop Expense Categories</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Create and manage standard operating expense categories for your store
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCategoriesModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Add New Category Form */}
              <div style={{ background: 'var(--neutral-50)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <FolderPlus size={16} color="var(--primary-600)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary-700)' }}>
                    Create New Category
                  </span>
                </div>

                <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                        Category Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Generator Fuel, Water Filter"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                        Description (Optional)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Brief description of expenses under this category"
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={!newCatName.trim()} style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                      <Plus size={14} />
                      <span>Add Category</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Categories Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--neutral-800)' }}>
                    Registered Categories ({categories.length})
                  </span>
                </div>

                <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem', width: '220px' }}>Category Name</th>
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem' }}>Description</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.72rem', width: '150px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(c => {
                        const isEditing = editingCatId === c.id;

                        return (
                          <tr key={c.id}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.85rem' }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="form-input"
                                  value={editingCatName}
                                  onChange={(e) => setEditingCatName(e.target.value)}
                                  placeholder="Category Name"
                                  style={{ padding: '4px 8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }}
                                  autoFocus
                                />
                              ) : (
                                <span>📁 {c.name}</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--neutral-600)', fontSize: '0.8rem' }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="form-input"
                                  value={editingCatDesc}
                                  onChange={(e) => setEditingCatDesc(e.target.value)}
                                  placeholder="Description (optional)"
                                  style={{ padding: '4px 8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }}
                                />
                              ) : (
                                c.description || <span style={{ color: 'var(--neutral-400)', fontStyle: 'italic' }}>No description</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    title="Save Changes"
                                    onClick={() => handleSaveEditCat(c.id)}
                                    style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Check size={14} />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    title="Cancel"
                                    onClick={handleCancelEditCat}
                                    style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <X size={14} />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    title="Edit Category"
                                    onClick={() => handleStartEditCat(c)}
                                    style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <Edit3 size={13} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    title="Delete Category"
                                    onClick={() => handleDeleteCategory(c.id)}
                                    style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger-600, #dc2626)' }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ flexShrink: 0, padding: '14px 24px', borderTop: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}>
              <button type="button" className="btn btn-primary" onClick={() => setIsCategoriesModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
