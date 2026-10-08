import React, { useState, useEffect, useCallback } from 'react';
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
  TrendingDown,
  Sparkles,
  Clock,
  User,
  Building,
  CreditCard,
  Smartphone,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { DateRangePicker, DateRangeValue, calculatePresetDates, formatIsoToDisplay, getLocalDateString, getYesterdayLocalDateString } from '../components/DateRangePicker';
import { store } from '../services/store';
import { Expense, ExpenseCategory, LedgerEntry, Party, Payment } from '../types';
import { Pagination } from '../components/Pagination';
import { SearchablePartySelect } from '../components/SearchablePartySelect';
import { SearchableCategorySelect } from '../components/SearchableCategorySelect';

export const LedgerView: React.FC = () => {
  const currentUser = store.getCurrentUser();
  const isCashier = currentUser?.role === 'CASHIER';
  const locations = store.getAllLocations();
  const activeLoc = store.getActiveLocation();

  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: 'ALL',
    fromDate: '',
    toDate: '',
  });
  const [parties, setParties] = useState<Party[]>(store.getParties());
  const [expenses, setExpenses] = useState<Expense[]>(store.getExpenses());
  const [categories, setCategories] = useState<ExpenseCategory[]>(store.getExpenseCategories());
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(store.getLedgerEntries());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAYMENT_IN' | 'PAYMENT_OUT' | 'PO_PAYMENT' | 'EXPENSE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Debounce search query input (300ms) for responsive API searching
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Reset pagination when filters or date range change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterType, filterCategory, selectedLocationId, dateRange]);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: 'EXPENSE' | 'CATEGORY';
    id: string;
    title: string;
    description: string;
    amount?: number;
  } | null>(null);

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
    expenseDate: getLocalDateString(),
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

  const refreshData = useCallback(async () => {
    const loc = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
    try {
      if (filterType === 'EXPENSE') {
        const res = await store.fetchExpensesPaginated({
          page: currentPage,
          pageSize,
          search: debouncedSearch.trim() || undefined,
          category: filterCategory !== 'ALL' ? filterCategory : undefined,
          locationId: loc,
          fromDate: dateRange.fromDate || undefined,
          toDate: dateRange.toDate || undefined,
        });
        setExpenses(res.data);
        setTotalItems(res.total);
        setLedgerEntries(res.data.map(e => ({
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
        })));
      } else {
        await Promise.allSettled([
          store.fetchExpenses(loc),
          store.fetchPayments(loc),
          store.fetchParties(loc),
          store.fetchExpenseCategories(),
        ]);
        const entries = store.getLedgerEntries(loc);
        const filtered = entries.filter(entry => {
          const isPO = Boolean(entry.purchaseOrderId || entry.purchaseOrderNumber || entry.referenceType === 'PURCHASE_ORDER');
          if (filterType === 'PO_PAYMENT') {
            if (!isPO) return false;
          } else if (filterType === 'PAYMENT_OUT') {
            if (entry.type !== 'PAYMENT_OUT') return false;
          } else if (filterType !== 'ALL' && entry.type !== filterType) {
            return false;
          }
          if (filterCategory !== 'ALL' && entry.category !== filterCategory) return false;
          if (dateRange.fromDate && (entry.date || '') < dateRange.fromDate) return false;
          if (dateRange.toDate && (entry.date || '') > dateRange.toDate) return false;
          if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            const matchParty = entry.partyOrPayee.toLowerCase().includes(q);
            const matchTitle = entry.title.toLowerCase().includes(q);
            const matchRef = entry.referenceNumber ? entry.referenceNumber.toLowerCase().includes(q) : false;
            const matchPO = entry.purchaseOrderNumber ? entry.purchaseOrderNumber.toLowerCase().includes(q) : false;
            const matchNotes = entry.notes ? entry.notes.toLowerCase().includes(q) : false;
            if (!matchParty && !matchTitle && !matchRef && !matchPO && !matchNotes) return false;
          }
          return true;
        });
        setTotalItems(filtered.length);
        setLedgerEntries(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize));
        setExpenses(store.getExpenses(loc));
      }
      setCategories(store.getExpenseCategories());
    } catch (e) {
      console.error('Error refreshing ledger data:', e);
      let entries = store.getLedgerEntries(loc);
      if (dateRange.fromDate) {
        entries = entries.filter(e => (e.date || '') >= dateRange.fromDate);
      }
      if (dateRange.toDate) {
        entries = entries.filter(e => (e.date || '') <= dateRange.toDate);
      }
      setTotalItems(entries.length);
      setLedgerEntries(entries.slice((currentPage - 1) * pageSize, currentPage * pageSize));
      setExpenses(store.getExpenses(loc));
    }
  }, [currentPage, pageSize, selectedLocationId, filterType, filterCategory, debouncedSearch, dateRange]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Derived Financial Calculations respecting dateRange
  const loc = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
  const rawEntries = store.getLedgerEntries(loc);
  const currentEntries = rawEntries.filter(e => {
    if (dateRange.fromDate && (e.date || '') < dateRange.fromDate) return false;
    if (dateRange.toDate && (e.date || '') > dateRange.toDate) return false;
    return true;
  });

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

  const hasActiveFilters = searchQuery.trim() !== '' || filterType !== 'ALL' || filterCategory !== 'ALL' || selectedLocationId !== 'ALL' || dateRange.preset !== 'ALL';

  const clearAllFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setFilterType('ALL');
    setFilterCategory('ALL');
    setSelectedLocationId('ALL');
    setDateRange({ preset: 'ALL', fromDate: '', toDate: '' });
  };

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
          expenseDate: expenseForm.expenseDate || getLocalDateString(),
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
          expenseDate: getLocalDateString(),
        });
      } else {
        // Payment In / Payment Out
        const amt = parseFloat(paymentForm.amount);
        if (!amt || amt <= 0 || !paymentForm.partyId) return;

        const targetParty = parties.find(p => p.id === paymentForm.partyId);
        if (!targetParty) return;

        store.recordPayment({
          date: getLocalDateString(),
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
    let exp = expenses.find(e => e.id === expenseId);
    if (!exp) {
      exp = store.getExpenses().find(e => e.id === expenseId);
    }
    if (!exp) {
      const entry = ledgerEntries.find(e => e.id === expenseId && e.type === 'EXPENSE');
      if (entry) {
        exp = {
          id: entry.id,
          category: entry.category || entry.title,
          amount: entry.amount,
          payee: entry.partyOrPayee === 'Direct Expense' ? '' : entry.partyOrPayee,
          paymentMode: (entry.paymentMode as any) || 'CASH',
          referenceNumber: entry.referenceNumber,
          description: entry.notes,
          locationId: entry.locationId,
          locationName: entry.locationName,
          expenseDate: entry.date,
        };
      }
    }
    if (!exp) {
      console.warn('Expense record not found for editing:', expenseId);
      return;
    }

    setEditingExpense(exp);
    setEditExpenseForm({
      category: exp.category,
      amount: String(exp.amount),
      payee: exp.payee || '',
      paymentMode: exp.paymentMode || 'CASH',
      referenceNumber: exp.referenceNumber || '',
      description: exp.description || '',
      locationId: exp.locationId || activeLoc?.id || '',
      expenseDate: exp.expenseDate ? (exp.expenseDate.includes('T') ? exp.expenseDate.split('T')[0] : exp.expenseDate) : getLocalDateString(),
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

  // Trigger Delete Expense Modal
  const handleDeleteExpenseClick = (expenseId: string) => {
    const exp = expenses.find(e => e.id === expenseId) || store.getExpenses().find(e => e.id === expenseId);
    const entry = ledgerEntries.find(e => e.id === expenseId);
    const categoryName = exp?.category || entry?.category || entry?.title || 'Expense';
    const amountVal = exp?.amount || entry?.amount || 0;

    setDeleteConfirmModal({
      isOpen: true,
      type: 'EXPENSE',
      id: expenseId,
      title: 'Delete Expense Record?',
      description: `Are you sure you want to delete the "${categoryName}" expense of ₹${amountVal.toFixed(2)}? This action cannot be undone and will immediately update your cash ledger balances.`,
      amount: amountVal,
    });
  };

  // Trigger Delete Category Modal
  const handleDeleteCategoryClick = (catId: string) => {
    const target = categories.find(c => c.id === catId);
    const catName = target ? `"${target.name}"` : 'this category';
    setDeleteConfirmModal({
      isOpen: true,
      type: 'CATEGORY',
      id: catId,
      title: 'Delete Expense Category?',
      description: `Are you sure you want to delete category ${catName}? This will permanently remove it from the registered categories list.`,
    });
  };

  // Perform Confirmed Deletion
  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal) return;
    setIsSaving(true);
    try {
      if (deleteConfirmModal.type === 'EXPENSE') {
        await store.deleteExpense(deleteConfirmModal.id);
        setExpenses(store.getExpenses(loc));
        await refreshData();
      } else if (deleteConfirmModal.type === 'CATEGORY') {
        await store.deleteExpenseCategory(deleteConfirmModal.id);
        setCategories(store.getExpenseCategories());
        await refreshData();
      }
      setDeleteConfirmModal(null);
    } catch (err) {
      console.error('Delete action failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle adding new custom category from SearchableCategorySelect
  const handleAddNewCategory = async (catName: string) => {
    const added = await store.addExpenseCategory(catName);
    setCategories(store.getExpenseCategories());
    return added.name;
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

  const openCategoriesModal = () => {
    setIsCategoriesModalOpen(true);
    store.fetchExpenseCategories().then(() => {
      setCategories(store.getExpenseCategories());
    }).catch(() => {});
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = ['Date', 'Type', 'Category / Title', 'PO Number', 'Party / Payee', 'Payment Mode', 'Reference No', 'Notes', 'Amount'];
    const rows = filteredEntries.map(e => [
      `"${e.date}"`,
      `"${e.type}"`,
      `"${e.category || e.title}"`,
      `"${e.purchaseOrderNumber || ''}"`,
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

      {/* Filter & Search Bar - Single Line with Active Chips */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'visible', position: 'relative', zIndex: 10 }}>
        {/* Line 1: Single Line Controls Bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search by Payee, Category, Ref #, Description..."
              className="form-input"
              style={{ paddingLeft: 30, paddingRight: searchQuery ? 28 : 10, width: '100%', height: 35, fontSize: '0.8rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 8, top: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: 0 }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Entry Type Filter */}
          <select
            className="form-select"
            style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 140 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="ALL">All Entry Types</option>
            <option value="EXPENSE">Operating Expenses</option>
            <option value="PAYMENT_IN">Receipts (Inflow)</option>
            <option value="PAYMENT_OUT">Payouts (Outflow)</option>
            <option value="PO_PAYMENT">PO Payments (Vendor)</option>
          </select>

          {/* Category Dropdown */}
          <select
            className="form-select"
            style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 130 }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Location Selector */}
          <select
            className="form-select"
            style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 130 }}
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
          >
            <option value="ALL">🌐 All Branches</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                📍 {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          {/* Single Date Range Button */}
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            variant="dropdown"
            allowAllTime={true}
          />

          {/* Refresh Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshData}
            style={{ height: 35, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: '0.8rem' }}
            title="Refresh Ledger"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Line 2: Active Filter Chips */}
        {hasActiveFilters && (
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            paddingTop: 8,
            borderTop: '1px solid var(--neutral-200)',
            fontSize: '0.74rem'
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Filter size={11} /> Active Filters:
            </span>

            {/* Search Chip */}
            {searchQuery.trim() !== '' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'var(--neutral-100)',
                color: 'var(--neutral-700)',
                border: '1px solid var(--neutral-200)',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                <span>Keyword: &quot;{searchQuery}&quot;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--neutral-400)', display: 'inline-flex', alignItems: 'center' }}
                  title="Remove search query filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Type Chip */}
            {filterType !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                background: filterType === 'PAYMENT_IN' ? '#ecfdf5' : filterType === 'PO_PAYMENT' ? '#ede9fe' : filterType === 'PAYMENT_OUT' ? '#fef3c7' : '#fee2e2',
                color: filterType === 'PAYMENT_IN' ? '#047857' : filterType === 'PO_PAYMENT' ? '#6d28d9' : filterType === 'PAYMENT_OUT' ? '#b45309' : '#b91c1c',
                border: '1px solid var(--neutral-200)',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                <span>Type: {filterType === 'EXPENSE' ? 'Operating Expense' : filterType === 'PAYMENT_IN' ? 'Receipt (Inflow)' : filterType === 'PO_PAYMENT' ? 'PO Payment' : 'Payout (Outflow)'}</span>
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex', alignItems: 'center', opacity: 0.7 }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Category Chip */}
            {filterCategory !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'var(--primary-50)',
                color: 'var(--primary-700)',
                border: '1px solid var(--primary-200)',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                <span>Category: {filterCategory}</span>
                <button
                  type="button"
                  onClick={() => setFilterCategory('ALL')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-500)', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Location Chip */}
            {selectedLocationId !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'var(--neutral-100)',
                color: 'var(--neutral-700)',
                border: '1px solid var(--neutral-200)',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                <span>Branch: {locations.find(l => l.id === selectedLocationId)?.name || selectedLocationId}</span>
                <button
                  type="button"
                  onClick={() => setSelectedLocationId('ALL')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--neutral-400)', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Date Range Chip */}
            {dateRange.preset !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'var(--primary-50)',
                color: 'var(--primary-700)',
                border: '1px solid var(--primary-200)',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                <span>Date: {dateRange.preset !== 'CUSTOM' ? dateRange.preset.replace('_', ' ') : `${dateRange.fromDate} to ${dateRange.toDate}`}</span>
                <button
                  type="button"
                  onClick={() => setDateRange({ preset: 'ALL', fromDate: '', toDate: '' })}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-500)', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Clear All Button */}
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger-600)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                marginLeft: 4
              }}
              title="Reset all filters"
            >
              Clear All
            </button>
          </div>
        )}
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
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--neutral-400)' }}>
                    No ledger transactions or expenses found matching filters.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry) => {
                  const isInflow = entry.type === 'PAYMENT_IN';
                  const isOutflow = entry.type === 'PAYMENT_OUT';
                  const isExpense = entry.type === 'EXPENSE';
                  const isPO = Boolean(entry.purchaseOrderId || entry.purchaseOrderNumber || entry.referenceType === 'PURCHASE_ORDER');

                  return (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{formatIsoToDisplay(entry.date)}</div>
                        {entry.locationName && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                            📍 {entry.locationName}
                          </div>
                        )}
                      </td>
                      <td>
                        {isPO ? (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#ede9fe',
                              color: '#6d28d9',
                              border: '1px solid #ddd6fe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <ArrowUpRight size={12} />
                            PO Payment
                          </span>
                        ) : (
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
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                          {entry.title}
                        </div>
                        {entry.purchaseOrderNumber && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: '#f3e8ff',
                              color: '#7e22ce',
                              fontWeight: 700
                            }}>
                              #{entry.purchaseOrderNumber}
                            </span>
                          </div>
                        )}
                        {entry.category && !entry.purchaseOrderNumber && entry.category !== entry.title && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                            {entry.category}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--neutral-800)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{entry.partyOrPayee}</span>
                          {isPO && (
                            <span style={{ fontSize: '0.66rem', padding: '1px 5px', borderRadius: 4, backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-600)', fontWeight: 600 }}>
                              Supplier
                            </span>
                          )}
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
                              onClick={() => handleDeleteExpenseClick(entry.id)}
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
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="transactions"
        />
      </div>

      {/* Record Entry Modal (Tabs: Payment In / Payment Out / Shop Expense) */}
      {isRecordModalOpen && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsRecordModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: '100%' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--neutral-200, #e2e8f0)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: activeTab === 'EXPENSE' ? '#fee2e2' : activeTab === 'PAYMENT_IN' ? '#ecfdf5' : '#fef3c7',
                    color: activeTab === 'EXPENSE' ? '#dc2626' : activeTab === 'PAYMENT_IN' ? '#059669' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {activeTab === 'EXPENSE' && <Receipt size={20} />}
                  {activeTab === 'PAYMENT_IN' && <ArrowDownLeft size={20} />}
                  {activeTab === 'PAYMENT_OUT' && <ArrowUpRight size={20} />}
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.1rem', margin: 0 }}>Record Financial Transaction</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    {activeTab === 'EXPENSE' && 'Log an operating store expense (Electricity, Rent, Staff Wages, etc.)'}
                    {activeTab === 'PAYMENT_IN' && 'Record payment collected from a customer towards due balances'}
                    {activeTab === 'PAYMENT_OUT' && 'Record payment sent to a supplier/vendor towards bills'}
                  </p>
                </div>
              </div>
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
                  padding: '12px 10px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  border: 'none',
                  borderBottom: activeTab === 'EXPENSE' ? '3px solid var(--danger-600, #dc2626)' : '3px solid transparent',
                  backgroundColor: activeTab === 'EXPENSE' ? '#ffffff' : 'transparent',
                  color: activeTab === 'EXPENSE' ? 'var(--danger-600, #dc2626)' : 'var(--neutral-600, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Receipt size={16} />
                <span>Shop Expense</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PAYMENT_IN')}
                style={{
                  flex: 1,
                  padding: '12px 10px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  border: 'none',
                  borderBottom: activeTab === 'PAYMENT_IN' ? '3px solid #059669' : '3px solid transparent',
                  backgroundColor: activeTab === 'PAYMENT_IN' ? '#ffffff' : 'transparent',
                  color: activeTab === 'PAYMENT_IN' ? '#059669' : 'var(--neutral-600, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowDownLeft size={16} />
                <span>Customer Receipt</span>
              </button>

              {!isCashier && (
                <button
                  type="button"
                  onClick={() => setActiveTab('PAYMENT_OUT')}
                  style={{
                    flex: 1,
                    padding: '12px 10px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: activeTab === 'PAYMENT_OUT' ? '3px solid #d97706' : '3px solid transparent',
                    backgroundColor: activeTab === 'PAYMENT_OUT' ? '#ffffff' : 'transparent',
                    color: activeTab === 'PAYMENT_OUT' ? '#d97706' : 'var(--neutral-600, #64748b)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ArrowUpRight size={16} />
                  <span>Supplier Payout</span>
                </button>
              )}
            </div>

            <form onSubmit={handleRecordSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px' }}>
                {activeTab === 'EXPENSE' ? (
                  <>
                    {/* Expense Category with Searchable Category Dropdown */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem' }}>
                          Expense Category *
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                          Search or create custom
                        </span>
                      </div>
                      <SearchableCategorySelect
                        categories={categories}
                        selectedCategory={expenseForm.category}
                        onSelectCategory={(cat) => setExpenseForm({ ...expenseForm, category: cat })}
                        onAddNewCategory={handleAddNewCategory}
                      />
                    </div>

                    {/* Amount & Quick Chips */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Amount (₹) *</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: 9, fontWeight: 700, color: 'var(--neutral-400)', fontSize: '0.9rem' }}>₹</span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              className="form-input"
                              placeholder="0.00"
                              style={{ paddingLeft: 28, fontSize: '1rem', fontWeight: 700 }}
                              value={expenseForm.amount}
                              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Payment Mode</label>
                          <select
                            className="form-select"
                            style={{ height: 38 }}
                            value={expenseForm.paymentMode}
                            onChange={(e) => setExpenseForm({ ...expenseForm, paymentMode: e.target.value as any })}
                          >
                            <option value="CASH">💵 Cash</option>
                            <option value="UPI">📱 UPI (GPay / PhonePe / Paytm)</option>
                            <option value="CARD">💳 Card (Debit / Credit)</option>
                            <option value="BANK_TRANSFER">🏦 Bank Transfer (NEFT / IMPS)</option>
                            <option value="CHEQUE">📝 Cheque</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Amount Chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)', fontWeight: 600 }}>Quick:</span>
                        {[100, 500, 1000, 2000, 5000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              const cur = parseFloat(expenseForm.amount) || 0;
                              setExpenseForm({ ...expenseForm, amount: String(cur > 0 ? cur + preset : preset) });
                            }}
                            style={{
                              border: '1px solid var(--neutral-200)',
                              borderRadius: 4,
                              backgroundColor: 'var(--neutral-50)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--neutral-700)',
                              padding: '2px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            +₹{preset}
                          </button>
                        ))}
                        {expenseForm.amount && (
                          <button
                            type="button"
                            onClick={() => setExpenseForm({ ...expenseForm, amount: '' })}
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              fontSize: '0.7rem',
                              color: 'var(--danger-600)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Payee & Date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Paid To / Payee Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Electricity Board, Landlord, Ramesh (Driver)"
                          value={expenseForm.payee}
                          onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem' }}>Expense Date</label>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setExpenseForm({ ...expenseForm, expenseDate: getLocalDateString() })}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '0.68rem',
                                color: 'var(--primary-600)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                padding: 0,
                              }}
                            >
                              Today
                            </button>
                            <span style={{ fontSize: '0.68rem', color: 'var(--neutral-300)' }}>|</span>
                            <button
                              type="button"
                              onClick={() => setExpenseForm({ ...expenseForm, expenseDate: getYesterdayLocalDateString() })}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '0.68rem',
                                color: 'var(--primary-600)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                padding: 0,
                              }}
                            >
                              Yesterday
                            </button>
                          </div>
                        </div>
                        <input
                          type="date"
                          className="form-input"
                          value={expenseForm.expenseDate}
                          onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Reference ID & Location */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Reference ID / Bill No</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. EB-BILL-90219, RCP-5521"
                          value={expenseForm.referenceNumber}
                          onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Branch Location</label>
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

                    {/* Description */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Description / Remarks (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Electricity bill for counter operations & backup inverter"
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Customer / Supplier Searchable Contact Selector */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem' }}>
                          {activeTab === 'PAYMENT_IN' ? 'Search Customer *' : 'Search Supplier *'}
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                          Filter by name or phone
                        </span>
                      </div>

                      <SearchablePartySelect
                        parties={activeTab === 'PAYMENT_IN' ? customerList : supplierList}
                        selectedPartyId={paymentForm.partyId}
                        partyType={activeTab === 'PAYMENT_IN' ? 'CUSTOMER' : 'SUPPLIER'}
                        onSelect={(party) => {
                          if (party) {
                            setPaymentForm(prev => ({
                              ...prev,
                              partyId: party.id,
                              amount: party.currentBalance !== 0 ? String(Math.abs(party.currentBalance)) : prev.amount
                            }));
                          } else {
                            setPaymentForm(prev => ({ ...prev, partyId: '' }));
                          }
                        }}
                        onAutoFillBalance={(bal) => {
                          setPaymentForm(prev => ({ ...prev, amount: String(bal) }));
                        }}
                      />
                    </div>

                    {/* Amount & Payment Mode */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Amount (₹) *</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: 9, fontWeight: 700, color: 'var(--neutral-400)', fontSize: '0.9rem' }}>₹</span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              className="form-input"
                              placeholder="0.00"
                              style={{ paddingLeft: 28, fontSize: '1rem', fontWeight: 700 }}
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Payment Mode</label>
                          <select
                            className="form-select"
                            style={{ height: 38 }}
                            value={paymentForm.paymentMode}
                            onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value as any })}
                          >
                            <option value="UPI">📱 UPI (Google Pay / PhonePe / Paytm)</option>
                            <option value="CASH">💵 Cash</option>
                            <option value="BANK_TRANSFER">🏦 Bank Transfer (NEFT / IMPS)</option>
                            <option value="CARD">💳 Card (Debit / Credit)</option>
                            <option value="CHEQUE">📝 Cheque</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Amount Chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)', fontWeight: 600 }}>Quick:</span>
                        {[500, 1000, 2000, 5000, 10000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              const cur = parseFloat(paymentForm.amount) || 0;
                              setPaymentForm({ ...paymentForm, amount: String(cur > 0 ? cur + preset : preset) });
                            }}
                            style={{
                              border: '1px solid var(--neutral-200)',
                              borderRadius: 4,
                              backgroundColor: 'var(--neutral-50)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--neutral-700)',
                              padding: '2px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            +₹{preset}
                          </button>
                        ))}
                        {paymentForm.amount && (
                          <button
                            type="button"
                            onClick={() => setPaymentForm({ ...paymentForm, amount: '' })}
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              fontSize: '0.7rem',
                              color: 'var(--danger-600)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* UTR / Transaction Reference */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>UTR / Transaction Reference No (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. UPI/628192839120, NEFT-HDFC-99210"
                        value={paymentForm.referenceNumber}
                        onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                      />
                    </div>

                    {/* Payment Notes */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Payment Notes / Remarks (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Cleared bill invoice balance, advance token payment"
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--neutral-200, #e2e8f0)', padding: '14px 20px', background: 'var(--neutral-50, #f8fafc)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRecordModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || (activeTab !== 'EXPENSE' && !paymentForm.partyId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 20px',
                    fontWeight: 700,
                  }}
                >
                  <Check size={16} />
                  <span>{isSaving ? 'Recording...' : 'Save & Record Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {isEditExpenseOpen && editingExpense && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsEditExpenseOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '100%' }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--neutral-200, #e2e8f0)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <span className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>Edit Shop Expense</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Update details for this recorded expense entry
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsEditExpenseOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditExpense} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Expense Category *</label>
                  <SearchableCategorySelect
                    categories={categories}
                    selectedCategory={editExpenseForm.category}
                    onSelectCategory={(cat) => setEditExpenseForm({ ...editExpenseForm, category: cat })}
                    onAddNewCategory={handleAddNewCategory}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Amount (₹) *</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: 9, fontWeight: 700, color: 'var(--neutral-400)', fontSize: '0.9rem' }}>₹</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        className="form-input"
                        style={{ paddingLeft: 28, fontSize: '1rem', fontWeight: 700 }}
                        value={editExpenseForm.amount}
                        onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Payment Mode</label>
                    <select
                      className="form-select"
                      style={{ height: 38 }}
                      value={editExpenseForm.paymentMode}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, paymentMode: e.target.value as any })}
                    >
                      <option value="CASH">💵 Cash</option>
                      <option value="UPI">📱 UPI</option>
                      <option value="CARD">💳 Card</option>
                      <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                      <option value="CHEQUE">📝 Cheque</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Paid To / Payee Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editExpenseForm.payee}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, payee: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem' }}>Expense Date</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => setEditExpenseForm({ ...editExpenseForm, expenseDate: getLocalDateString() })}
                          style={{
                            border: 'none',
                            background: 'none',
                            fontSize: '0.68rem',
                            color: 'var(--primary-600)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            padding: 0,
                          }}
                        >
                          Today
                        </button>
                        <span style={{ fontSize: '0.68rem', color: 'var(--neutral-300)' }}>|</span>
                        <button
                          type="button"
                          onClick={() => setEditExpenseForm({ ...editExpenseForm, expenseDate: getYesterdayLocalDateString() })}
                          style={{
                            border: 'none',
                            background: 'none',
                            fontSize: '0.68rem',
                            color: 'var(--primary-600)',
                            cursor: 'pointer',
                            fontWeight: 700,
                            padding: 0,
                          }}
                        >
                          Yesterday
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      className="form-input"
                      value={editExpenseForm.expenseDate}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, expenseDate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Reference ID / Bill No</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editExpenseForm.referenceNumber}
                      onChange={(e) => setEditExpenseForm({ ...editExpenseForm, referenceNumber: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Branch Location</label>
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

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>Description / Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editExpenseForm.description}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--neutral-200, #e2e8f0)', padding: '14px 20px', background: 'var(--neutral-50, #f8fafc)' }}>
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
                                    onClick={() => handleDeleteCategoryClick(c.id)}
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

      {/* Delete Confirmation Modal Popup */}
      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => !isSaving && setDeleteConfirmModal(null)} style={{ zIndex: 1100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: '100%', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 18px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)', margin: '0 0 6px 0' }}>
                  {deleteConfirmModal.title}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--neutral-600)', margin: 0, lineHeight: 1.5 }}>
                  {deleteConfirmModal.description}
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              padding: '14px 20px',
              backgroundColor: 'var(--neutral-50)',
              borderTop: '1px solid var(--neutral-200)'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmModal(null)}
                disabled={isSaving}
                style={{ fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmDelete}
                disabled={isSaving}
                style={{
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700
                }}
              >
                <Trash2 size={14} />
                <span>{isSaving ? 'Deleting...' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
