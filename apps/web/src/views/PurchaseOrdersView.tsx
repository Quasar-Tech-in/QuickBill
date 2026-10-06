import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Filter, 
  Truck, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  Printer, 
  Trash2, 
  X, 
  AlertCircle, 
  Building2, 
  Calendar, 
  DollarSign, 
  PackageCheck, 
  Check, 
  UserPlus, 
  PackagePlus,
  RefreshCw,
  MapPin,
  Eye,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { PurchaseOrder, PurchaseOrderStatus, Party, Item, StoreLocation } from '../types';
import { store } from '../services/store';
import { Pagination } from '../components/Pagination';
import { DateRangePicker, DateRangeValue, formatIsoToDisplay } from '../components/DateRangePicker';

export const PurchaseOrdersView: React.FC = () => {
  const currentUser = store.getCurrentUser();
  const activeTenant = store.getActiveTenant();
  const locations = store.getAllLocations();
  const activeLocation = store.getActiveLocation();

  // Primary Data State
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [parties, setParties] = useState<Party[]>(store.getParties());
  const [items, setItems] = useState<Item[]>(store.getItems());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filters & Pagination State
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: 'ALL',
    fromDate: '',
    toDate: '',
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Modal Visibility States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState<boolean>(false);
  const [isQuickItemModalOpen, setIsQuickItemModalOpen] = useState<boolean>(false);

  // Active PO for Actions (Receive / Cancel / View)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form State: Create Purchase Order
  const [newPO, setNewPO] = useState<{
    supplierId: string;
    locationId: string;
    expectedDeliveryDate: string;
    notes: string;
    terms: string;
    items: {
      itemId: string;
      orderedQty: number;
      unitPrice: number;
      taxRate: number;
    }[];
  }>({
    supplierId: '',
    locationId: activeLocation?.id || (locations[0]?.id || ''),
    expectedDeliveryDate: '',
    notes: '',
    terms: 'Payment due within 30 days of goods receipt.',
    items: [],
  });

  // PO Form Search & Autocomplete States
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');
  const [isItemSearchFocused, setIsItemSearchFocused] = useState<boolean>(false);

  // Form State: Receive Goods
  const [receiveForm, setReceiveForm] = useState<{
    items: { itemId: string; name: string; orderedQty: number; alreadyReceived: number; qtyToReceive: number }[];
    notes: string;
    recordImmediatePayment: boolean;
    paymentAmount: number;
    paymentMode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
    paymentReference: string;
  }>({
    items: [],
    notes: '',
    recordImmediatePayment: false,
    paymentAmount: 0,
    paymentMode: 'BANK_TRANSFER',
    paymentReference: '',
  });

  // Form State: Cancel PO
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');

  // Quick Add Supplier Form State
  const [quickSupplier, setQuickSupplier] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
  });

  // Quick Add Item Form State
  const [quickItem, setQuickItem] = useState({
    name: '',
    category: 'General Store',
    unit: 'pcs',
    purchasePrice: 0,
    salePrice: 0,
    taxRate: 18,
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Search Debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, locationFilter, supplierFilter, dateRange]);

  // Load PO List
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setParties(store.getParties());
      setItems(store.getItems());

      const res = await store.fetchPurchaseOrders({
        search: debouncedSearch || undefined,
        status: statusFilter,
        location_id: locationFilter,
        supplier_id: supplierFilter,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        page: currentPage,
        page_size: pageSize,
      });

      setPurchaseOrders(res.data);
      setTotalItems(res.total);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, locationFilter, supplierFilter, dateRange, currentPage, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Line Item Handlers
  const handleSelectProductToAdd = (itemToAdd: Item) => {
    setNewPO(prev => {
      const existingIndex = prev.items.findIndex(it => it.itemId === itemToAdd.id);
      if (existingIndex >= 0) {
        const updated = [...prev.items];
        updated[existingIndex] = {
          ...updated[existingIndex],
          orderedQty: Number(updated[existingIndex].orderedQty || 0) + 1,
        };
        return { ...prev, items: updated };
      } else {
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              itemId: itemToAdd.id,
              orderedQty: 1,
              unitPrice: itemToAdd.purchasePrice || itemToAdd.salePrice || 0,
              taxRate: itemToAdd.taxRate || 0,
            },
          ],
        };
      }
    });
    setItemSearchQuery('');
    setIsItemSearchFocused(false);
    showNotification('success', `Added "${itemToAdd.name}" to order lines`);
  };

  const handleAddLineItem = () => {
    if (items.length === 0) {
      showNotification('error', 'No catalog products available. Add one first!');
      return;
    }
    const firstItem = items[0];
    setNewPO(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemId: firstItem.id,
          orderedQty: 1,
          unitPrice: firstItem.purchasePrice || firstItem.salePrice || 0,
          taxRate: firstItem.taxRate || 0,
        },
      ],
    }));
  };

  const handleUpdateLineItem = (index: number, field: string, value: any) => {
    setNewPO(prev => {
      const updated = [...prev.items];
      const target = { ...updated[index] };

      if (field === 'itemId') {
        const selected = items.find(i => i.id === value);
        if (selected) {
          target.itemId = selected.id;
          target.unitPrice = selected.purchasePrice || selected.salePrice || 0;
          target.taxRate = selected.taxRate || 0;
        }
      } else {
        (target as any)[field] = value;
      }

      updated[index] = target;
      return { ...prev, items: updated };
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setNewPO(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculatePOTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;
    newPO.items.forEach(it => {
      const lineSub = (parseFloat(String(it.orderedQty)) || 0) * (parseFloat(String(it.unitPrice)) || 0);
      const lineTax = (lineSub * (parseFloat(String(it.taxRate)) || 0)) / 100;
      subtotal += lineSub;
      taxTotal += lineTax;
    });
    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      grandTotal: Number((subtotal + taxTotal).toFixed(2)),
    };
  };

  const openCreateModal = () => {
    const defaultLocation = activeLocation?.id || (locations[0]?.id || '');

    setNewPO({
      supplierId: '',
      locationId: defaultLocation,
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      notes: '',
      terms: 'Payment due within 30 days of goods receipt.',
      items: [], // Start empty with NO default products added
    });
    setSupplierSearchQuery('');
    setIsSupplierDropdownOpen(false);
    setItemSearchQuery('');
    setIsItemSearchFocused(false);
    setIsCreateModalOpen(true);
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPO.supplierId) {
      showNotification('error', 'Please select a supplier or create one.');
      return;
    }
    if (newPO.items.length === 0) {
      showNotification('error', 'Please add at least one line item to the order.');
      return;
    }
    const parsedItems = newPO.items.map(it => ({
      ...it,
      orderedQty: parseFloat(String(it.orderedQty)) || 0,
      unitPrice: parseFloat(String(it.unitPrice)) || 0,
      taxRate: parseFloat(String(it.taxRate)) || 0,
    }));

    for (const line of parsedItems) {
      if (line.orderedQty <= 0) {
        showNotification('error', 'Item ordered quantity must be greater than 0.');
        return;
      }
      if (line.unitPrice < 0) {
        showNotification('error', 'Unit purchase price cannot be negative.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await store.createPurchaseOrder({
        supplierId: newPO.supplierId,
        locationId: newPO.locationId,
        expectedDeliveryDate: newPO.expectedDeliveryDate || undefined,
        items: parsedItems,
        notes: newPO.notes || undefined,
        terms: newPO.terms || undefined,
      });

      showNotification('success', 'Purchase Order placed successfully!');
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to create purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  const openReceiveModal = async (po: PurchaseOrder) => {
    let targetPO = po;
    // If items array is empty or not fully loaded, fetch full PO details
    if (!targetPO.items || targetPO.items.length === 0) {
      try {
        const fullPO = await store.getPurchaseOrder(po.id);
        if (fullPO && fullPO.items && fullPO.items.length > 0) {
          targetPO = fullPO;
        }
      } catch (err) {
        console.warn('Could not fetch full PO details for receive modal:', err);
      }
    }

    setSelectedPO(targetPO);

    const catalogItems = store.getItems();
    const recItems = (targetPO.items || []).map(it => {
      const itAny = it as any;
      const catItem = catalogItems.find(i => i.id === (it.itemId || itAny.item_id));
      const itemName = it.name || itAny.itemName || itAny.item_name || catItem?.name || 'Item';
      const orderedQty = Number(it.orderedQty ?? itAny.orderedQuantity ?? itAny.ordered_qty ?? itAny.quantity ?? 0);
      const alreadyReceived = Number(it.receivedQty ?? itAny.receivedQuantity ?? itAny.received_qty ?? 0);
      const remaining = Math.max(0, orderedQty - alreadyReceived);
      return {
        itemId: it.itemId || itAny.item_id || '',
        name: itemName,
        orderedQty,
        alreadyReceived,
        qtyToReceive: remaining,
      };
    });

    setReceiveForm({
      items: recItems,
      notes: '',
      recordImmediatePayment: false,
      paymentAmount: 0,
      paymentMode: 'BANK_TRANSFER',
      paymentReference: '',
    });
    setIsReceiveModalOpen(true);
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    const itemsToReceive = receiveForm.items
      .filter(i => i.qtyToReceive > 0)
      .map(i => ({ itemId: i.itemId, qty: Number(i.qtyToReceive) }));

    if (itemsToReceive.length === 0) {
      showNotification('error', 'Please specify a receiving quantity greater than 0 for at least one item.');
      return;
    }

    setIsSaving(true);
    try {
      await store.receivePurchaseOrder(selectedPO.id, {
        items: itemsToReceive,
        notes: receiveForm.notes || undefined,
        payment: receiveForm.recordImmediatePayment && receiveForm.paymentAmount > 0 ? {
          amount: Number(receiveForm.paymentAmount),
          paymentMode: receiveForm.paymentMode,
          referenceNumber: receiveForm.paymentReference || undefined,
          notes: `Immediate payment on PO receipt ${selectedPO.poNumber}`,
        } : undefined,
      });

      showNotification('success', `Stock updated and shipment received for ${selectedPO.poNumber}!`);
      setIsReceiveModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to receive goods');
    } finally {
      setIsSaving(false);
    }
  };

  const openCancelModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setCancellationReason('');
    setCancelError('');
    setIsCancelModalOpen(true);
  };

  const handleCancelPO = async () => {
    if (!selectedPO) return;
    if (!cancellationReason.trim() || cancellationReason.trim().length < 5) {
      setCancelError('Please provide a reason with at least 5 characters.');
      return;
    }

    setIsSaving(true);
    try {
      await store.cancelPurchaseOrder(selectedPO.id, cancellationReason.trim());
      showNotification('success', `Purchase order ${selectedPO.poNumber} has been cancelled.`);
      setIsCancelModalOpen(false);
      loadData();
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplier.name.trim()) {
      showNotification('error', 'Supplier name is required');
      return;
    }

    setIsSaving(true);
    try {
      const created = store.addParty({
        name: quickSupplier.name.trim(),
        type: 'SUPPLIER',
        phone: quickSupplier.phone.trim() || 'N/A',
        email: quickSupplier.email.trim() || undefined,
        gstin: quickSupplier.gstin.trim() || undefined,
        address: quickSupplier.address.trim() || undefined,
        locationIds: [activeLocation?.id || ''],
      });

      setParties(store.getParties());
      setNewPO(prev => ({ ...prev, supplierId: created.id }));
      setSupplierSearchQuery('');
      setIsSupplierDropdownOpen(false);
      setIsQuickSupplierModalOpen(false);
      setQuickSupplier({ name: '', phone: '', email: '', gstin: '', address: '' });
      showNotification('success', `Supplier "${created.name}" created and selected!`);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to create supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItem.name.trim()) {
      showNotification('error', 'Product name is required');
      return;
    }

    setIsSaving(true);
    try {
      const created = await store.addItem({
        name: quickItem.name.trim(),
        category: quickItem.category,
        unit: quickItem.unit,
        purchasePrice: Number(quickItem.purchasePrice) || 0,
        salePrice: Number(quickItem.salePrice) || Number(quickItem.purchasePrice) * 1.2 || 0,
        taxRate: Number(quickItem.taxRate) || 0,
        currentStock: 0,
        minStockAlert: 5,
      });

      const updatedItems = store.getItems();
      setItems(updatedItems);
      
      setNewPO(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            itemId: created.id,
            orderedQty: 1,
            unitPrice: created.purchasePrice || 0,
            taxRate: created.taxRate || 0,
          },
        ],
      }));

      setItemSearchQuery('');
      setIsItemSearchFocused(false);
      setIsQuickItemModalOpen(false);
      setQuickItem({ name: '', category: 'General Store', unit: 'pcs', purchasePrice: 0, salePrice: 0, taxRate: 18 });
      showNotification('success', `Product "${created.name}" added to order!`);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to create item');
    } finally {
      setIsSaving(false);
    }
  };

  // KPI Calculations
  const allPOs = store.getPurchaseOrders(locationFilter).filter(p => {
    if (dateRange.fromDate && p.orderDate < dateRange.fromDate) return false;
    if (dateRange.toDate && p.orderDate > dateRange.toDate) return false;
    return true;
  });
  const totalCount = allPOs.length;
  const pendingCount = allPOs.filter(p => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED').length;
  const receivedCount = allPOs.filter(p => p.status === 'RECEIVED' || p.status === 'FULLY_RECEIVED').length;
  const totalSpend = allPOs
    .filter(p => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + p.grandTotal, 0);

  // Status Badge UI
  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'ORDERED':
        return (
          <span className="badge" style={{ backgroundColor: 'var(--warning-50)', color: 'var(--warning-700)', border: '1px solid var(--warning-200)' }}>
            <Clock size={12} style={{ marginRight: 4 }} /> Ordered
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="badge" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', border: '1px solid var(--primary-200)' }}>
            <Truck size={12} style={{ marginRight: 4 }} /> Partially Received
          </span>
        );
      case 'RECEIVED':
      case 'FULLY_RECEIVED':
        return (
          <span className="badge" style={{ backgroundColor: 'var(--success-50)', color: 'var(--success-700)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Fully Received
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge" style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-700)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <XCircle size={12} style={{ marginRight: 4 }} /> Cancelled
          </span>
        );
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="page-container">
      {/* Toast Notification */}
      {notification && (
        <div 
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            backgroundColor: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: notification.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '0.88rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {notification.type === 'success' ? <Check size={18} color="#059669" /> : <AlertCircle size={18} color="#dc2626" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={24} color="var(--primary-600)" />
            Purchase Orders
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Place orders with suppliers, receive incoming stock directly into branches, and manage vendor payables.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            className="btn btn-secondary" 
            onClick={loadData} 
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Refresh from database"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            className="btn btn-primary" 
            onClick={openCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Orders</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--neutral-900)' }}>{totalCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--warning-50)', color: 'var(--warning-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Inward</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--warning-700)' }}>{pendingCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PackageCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fully Received</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>{receivedCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Spend Volume</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-700)' }}>
              ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search by PO Number, Supplier name, phone or notes..."
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Location & Supplier Filters & Date Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <DateRangePicker value={dateRange} onChange={setDateRange} compact={true} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={15} color="var(--primary-600)" />
              <select
                className="form-select"
                style={{ padding: '7px 12px', fontSize: '0.82rem', width: 'auto' }}
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="ALL">🌐 All Branch Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={15} color="var(--primary-600)" />
              <select
                className="form-select"
                style={{ padding: '7px 12px', fontSize: '0.82rem', width: 'auto' }}
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              >
                <option value="ALL">👥 All Suppliers</option>
                {parties.filter(p => p.type === 'SUPPLIER').map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--neutral-200)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
            <Filter size={13} /> Filter Status:
          </span>
          {[
            { key: 'ALL', label: 'All Orders' },
            { key: 'ORDERED', label: 'Ordered' },
            { key: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
            { key: 'RECEIVED', label: 'Fully Received' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`btn btn-sm ${statusFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main PO Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number &amp; Date</th>
                <th>Supplier (Vendor)</th>
                <th>Receiving Branch</th>
                <th>Inward Fulfillment</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--neutral-500)' }}>
                    <div className="spin-animation" style={{ display: 'inline-block', marginBottom: 8 }}>
                      <RefreshCw size={24} color="var(--primary-600)" />
                    </div>
                    <div>Loading purchase orders...</div>
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--neutral-400)' }}>
                    <ShoppingBag size={36} color="var(--neutral-300)" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontWeight: 700, color: 'var(--neutral-700)', fontSize: '0.95rem' }}>No purchase orders found</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: 4 }}>
                      {searchQuery || statusFilter !== 'ALL' || locationFilter !== 'ALL' || supplierFilter !== 'ALL'
                        ? 'No purchase orders match your filter criteria.'
                        : 'Create your first vendor purchase order to replenish stock.'}
                    </div>
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={openCreateModal}
                      style={{ marginTop: 14 }}
                    >
                      <Plus size={14} />
                      <span>Create PO Now</span>
                    </button>
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => {
                  const totalOrdered = po.items.reduce((s, i) => s + i.orderedQty, 0);
                  const totalReceived = po.items.reduce((s, i) => s + i.receivedQty, 0);
                  const percent = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
                  const canReceive = po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';
                  const canCancel = po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && po.status !== 'FULLY_RECEIVED';

                  return (
                    <tr key={po.id}>
                      {/* PO Number & Date */}
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                          {po.poNumber}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Calendar size={12} color="var(--neutral-400)" />
                          <span>{formatIsoToDisplay(po.orderDate)}</span>
                          {po.expectedDeliveryDate && (
                            <span style={{ color: 'var(--neutral-400)' }}>• Exp: {formatIsoToDisplay(po.expectedDeliveryDate)}</span>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{po.supplierName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {po.supplierPhone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{po.supplierPhone}</span>
                          )}
                          {po.supplierGstin && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: 4, background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontFamily: 'var(--font-mono)' }}>
                              GST: {po.supplierGstin}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td>
                        <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--neutral-100)', color: 'var(--neutral-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={12} color="var(--primary-600)" />
                          <span>{po.locationName || 'Main Branch'}</span>
                        </span>
                      </td>

                      {/* Fulfillment Progress */}
                      <td>
                        <div style={{ minWidth: 160 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                            <span style={{ color: 'var(--neutral-500)' }}>{po.items.length} item{po.items.length > 1 ? 's' : ''}</span>
                            <span style={{ fontWeight: 700, color: 'var(--neutral-800)' }}>{totalReceived} / {totalOrdered} ({percent}%)</span>
                          </div>
                          <div style={{ width: '100%', height: 6, backgroundColor: 'var(--neutral-200)', borderRadius: 3, overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${percent}%`, 
                                height: '100%', 
                                backgroundColor: percent === 100 ? 'var(--success-500)' : percent > 0 ? 'var(--primary-500)' : 'transparent',
                                transition: 'width 0.3s ease'
                              }} 
                            />
                          </div>
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                          ₹{po.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                          Tax: ₹{po.taxTotal.toFixed(2)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {renderStatusBadge(po.status)}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {canReceive && (
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="btn btn-sm btn-success"
                              title="Receive Goods into branch inventory"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <Truck size={13} />
                              <span>Receive</span>
                            </button>
                          )}

                          <button
                            onClick={() => { setSelectedPO(po); setIsViewModalOpen(true); }}
                            className="btn btn-sm btn-secondary btn-icon"
                            title="View & Print PO Document"
                          >
                            <FileText size={14} />
                          </button>

                          {canCancel && (
                            <button
                              onClick={() => openCancelModal(po)}
                              className="btn btn-sm btn-secondary btn-icon"
                              style={{ color: 'var(--danger-600)', borderColor: 'var(--danger-200)' }}
                              title="Cancel Order"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="purchase orders"
        />
      </div>

      {/* ========================================================================= */}
      {/* 1. CREATE PURCHASE ORDER MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingBag size={18} color="var(--primary-600)" />
                  Create New Purchase Order
                </span>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                  Issue an official stock procurement order with item-level cost &amp; GST tax breakdown.
                </p>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCreateModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePO} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header Inputs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  {/* Searchable Supplier */}
                  <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>Supplier (Vendor) *</label>
                      <button
                        type="button"
                        onClick={() => setIsQuickSupplierModalOpen(true)}
                        style={{ fontSize: '0.75rem', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                      >
                        + Quick Add Supplier
                      </button>
                    </div>

                    {newPO.supplierId ? (
                      (() => {
                        const selSup = parties.find(p => p.id === newPO.supplierId);
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'var(--primary-50)',
                            border: '1px solid var(--primary-200)',
                            borderRadius: 'var(--radius-sm)',
                            minHeight: 38
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                              <Building2 size={16} color="var(--primary-600)" style={{ flexShrink: 0 }} />
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary-900)' }}>
                                  {selSup?.name || 'Selected Supplier'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--primary-700)' }}>
                                  {selSup?.phone && selSup.phone !== 'N/A' ? `📞 ${selSup.phone}` : ''}
                                  {selSup?.gstin ? ` | GST: ${selSup.gstin}` : ''}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNewPO(prev => ({ ...prev, supplierId: '' }));
                                setSupplierSearchQuery('');
                                setIsSupplierDropdownOpen(true);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '2px 8px', height: 26, flexShrink: 0 }}
                            >
                              Change
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--neutral-400)', pointerEvents: 'none' }} />
                          <input
                            type="text"
                            className="form-input"
                            style={{ paddingLeft: 32, fontSize: '0.82rem', height: 38 }}
                            placeholder="Search supplier by name, phone, GST..."
                            value={supplierSearchQuery}
                            onChange={(e) => {
                              setSupplierSearchQuery(e.target.value);
                              setIsSupplierDropdownOpen(true);
                            }}
                            onFocus={() => setIsSupplierDropdownOpen(true)}
                            required={!newPO.supplierId}
                          />
                          {supplierSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setSupplierSearchQuery('')}
                              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer', padding: 2 }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {/* Supplier Autocomplete Dropdown */}
                        {isSupplierDropdownOpen && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            maxHeight: 220,
                            overflowY: 'auto',
                            zIndex: 110,
                            marginTop: 4,
                          }}>
                            {(() => {
                              const filteredSuppliers = parties
                                .filter(p => p.type === 'SUPPLIER')
                                .filter(p => {
                                  if (!supplierSearchQuery.trim()) return true;
                                  const q = supplierSearchQuery.toLowerCase();
                                  return (
                                    p.name.toLowerCase().includes(q) ||
                                    (p.phone && p.phone.includes(q)) ||
                                    (p.gstin && p.gstin.toLowerCase().includes(q))
                                  );
                                });

                              if (filteredSuppliers.length === 0) {
                                return (
                                  <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--neutral-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>No matching supplier found.</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQuickSupplier(prev => ({ ...prev, name: supplierSearchQuery.trim() }));
                                        setIsSupplierDropdownOpen(false);
                                        setIsQuickSupplierModalOpen(true);
                                      }}
                                      style={{ fontSize: '0.75rem', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                      + Create "{supplierSearchQuery.trim()}"
                                    </button>
                                  </div>
                                );
                              }

                              return filteredSuppliers.map(sup => (
                                <div
                                  key={sup.id}
                                  onClick={() => {
                                    setNewPO(prev => ({ ...prev, supplierId: sup.id }));
                                    setSupplierSearchQuery('');
                                    setIsSupplierDropdownOpen(false);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderBottom: '1px solid var(--neutral-100)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'background-color 0.1s ease',
                                    backgroundColor: '#ffffff',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-50)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                                >
                                  <div>
                                    <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--neutral-900)' }}>
                                      {sup.name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                                      {sup.phone && sup.phone !== 'N/A' ? `Phone: ${sup.phone}` : ''}
                                      {sup.gstin ? ` | GST: ${sup.gstin}` : ''}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', fontWeight: 600 }}>
                                    Select →
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Destination Location */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Destination Branch *</label>
                    <select
                      className="form-select"
                      value={newPO.locationId}
                      onChange={(e) => setNewPO({ ...newPO, locationId: e.target.value })}
                      required
                      style={{ height: 38, fontSize: '0.82rem' }}
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>📍 {loc.name} ({loc.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Expected Delivery Date */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Expected Delivery Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newPO.expectedDeliveryDate}
                      onChange={(e) => setNewPO({ ...newPO, expectedDeliveryDate: e.target.value })}
                      style={{ height: 38, fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 14, backgroundColor: 'var(--neutral-50)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--neutral-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Ordered Products</span>
                      <span className="badge" style={{ background: 'var(--neutral-200)', color: 'var(--neutral-700)' }}>
                        {newPO.items.length} lines
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setIsQuickItemModalOpen(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem' }}
                      >
                        <PackagePlus size={13} />
                        <span>+ Quick Add Product</span>
                      </button>
                    </div>
                  </div>

                  {/* Product Search & Autocomplete Input Bar */}
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--neutral-400)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: 34, paddingRight: itemSearchQuery ? 30 : 10, height: 38, fontSize: '0.82rem', backgroundColor: '#ffffff' }}
                        placeholder="Type product name, SKU, or barcode to search and add to order..."
                        value={itemSearchQuery}
                        onChange={(e) => {
                          setItemSearchQuery(e.target.value);
                          setIsItemSearchFocused(true);
                        }}
                        onFocus={() => setIsItemSearchFocused(true)}
                      />
                      {itemSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setItemSearchQuery('')}
                          style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer', padding: 2 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Dropdown for Items */}
                    {isItemSearchFocused && itemSearchQuery.trim().length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        maxHeight: 240,
                        overflowY: 'auto',
                        zIndex: 100,
                        marginTop: 4,
                      }}>
                        {(() => {
                          const q = itemSearchQuery.toLowerCase();
                          const filteredCatalogItems = items.filter(it => {
                            const nameMatch = it.name?.toLowerCase().includes(q);
                            const skuMatch = it.sku?.toLowerCase().includes(q);
                            const barcodeMatch = it.barcode?.toLowerCase().includes(q);
                            const catMatch = it.category?.toLowerCase().includes(q);
                            return nameMatch || skuMatch || barcodeMatch || catMatch;
                          });

                          if (filteredCatalogItems.length === 0) {
                            return (
                              <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--neutral-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>No matching product found in catalog.</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickItem(prev => ({ ...prev, name: itemSearchQuery.trim() }));
                                    setIsItemSearchFocused(false);
                                    setIsQuickItemModalOpen(true);
                                  }}
                                  style={{ fontSize: '0.75rem', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  + Create "{itemSearchQuery.trim()}"
                                </button>
                              </div>
                            );
                          }

                          return filteredCatalogItems.map(it => {
                            const isAlreadyAdded = newPO.items.some(line => line.itemId === it.id);
                            return (
                              <div
                                key={it.id}
                                onClick={() => handleSelectProductToAdd(it)}
                                style={{
                                  padding: '8px 12px',
                                  borderBottom: '1px solid var(--neutral-100)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background-color 0.1s ease',
                                  backgroundColor: '#ffffff',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-50)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                              >
                                <div>
                                  <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--neutral-850)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{it.name}</span>
                                    {it.sku && <span className="badge" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>SKU: {it.sku}</span>}
                                    {it.category && <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>• {it.category}</span>}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                                    Unit: {it.unit || 'pcs'} | Cost: ₹{it.purchasePrice || it.salePrice || 0} | Stock: {it.currentStock || 0}
                                  </div>
                                </div>
                                <div>
                                  {isAlreadyAdded ? (
                                    <span className="badge" style={{ backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', fontSize: '0.72rem' }}>
                                      + Incr Qty
                                    </span>
                                  ) : (
                                    <span className="badge" style={{ backgroundColor: 'var(--success-50)', color: 'var(--success-700)', fontSize: '0.72rem' }}>
                                      + Add to PO
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {newPO.items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 16px', background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--neutral-300)', color: 'var(--neutral-500)', fontSize: '0.85rem' }}>
                      <PackagePlus size={28} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--neutral-400)' }} />
                      No items added to this purchase order yet.<br />
                      Use the <strong>product search bar above</strong> to find and add products, or click <strong>"Quick Add Product"</strong>.
                    </div>
                  ) : (
                    <div style={{ background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', borderBottom: '1px solid var(--neutral-200)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 10px', width: '38%' }}>Product Description</th>
                            <th style={{ padding: '8px 10px', width: '15%' }}>Quantity</th>
                            <th style={{ padding: '8px 10px', width: '16%' }}>Unit Cost (₹)</th>
                            <th style={{ padding: '8px 10px', width: '12%' }}>GST %</th>
                            <th style={{ padding: '8px 10px', width: '15%', textAlign: 'right' }}>Total (₹)</th>
                            <th style={{ padding: '8px 6px', width: '4%', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {newPO.items.map((line, idx) => {
                            const lineSub = line.orderedQty * line.unitPrice;
                            const lineTax = (lineSub * line.taxRate) / 100;
                            const lineTot = lineSub + lineTax;
                            const targetItem = items.find(it => it.id === line.itemId);

                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                                <td style={{ padding: '8px 10px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.83rem' }}>
                                      {targetItem?.name || 'Catalog Item'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--neutral-500)', flexWrap: 'wrap' }}>
                                      {targetItem?.sku && <span className="badge" style={{ fontSize: '0.66rem', padding: '1px 5px' }}>SKU: {targetItem.sku}</span>}
                                      <span>Unit: {targetItem?.unit || 'pcs'}</span>
                                      {targetItem?.category && <span>• {targetItem.category}</span>}
                                    </div>
                                  </div>
                                </td>

                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    className="form-input"
                                    style={{ height: 32, padding: '4px 8px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                                    value={line.orderedQty ?? ''}
                                    onChange={(e) => handleUpdateLineItem(idx, 'orderedQty', e.target.value)}
                                  />
                                </td>

                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="form-input"
                                    style={{ height: 32, padding: '4px 8px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                                    value={line.unitPrice ?? ''}
                                    onChange={(e) => handleUpdateLineItem(idx, 'unitPrice', e.target.value)}
                                  />
                                </td>

                                <td style={{ padding: '8px 10px' }}>
                                  <select
                                    className="form-select"
                                    style={{ height: 32, padding: '4px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                                    value={line.taxRate}
                                    onChange={(e) => handleUpdateLineItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                                  >
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18">18%</option>
                                    <option value="28">28%</option>
                                  </select>
                                </td>

                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                  ₹{lineTot.toFixed(2)}
                                </td>

                                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLineItem(idx)}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: 4 }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bottom Calculation & Notes Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Order Notes / Internal Instructions</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="e.g. Urgent stock replenishment for store branch..."
                        value={newPO.notes}
                        onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })}
                        style={{ height: 'auto', padding: 8 }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Purchase Terms</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newPO.terms}
                        onChange={(e) => setNewPO({ ...newPO, terms: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Summary Box */}
                  {(() => {
                    const totals = calculatePOTotals();
                    return (
                      <div style={{ background: 'var(--neutral-100)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                          <span>Items Subtotal:</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                          <span>Total GST / Tax:</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{totals.taxTotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)', borderTop: '1px solid var(--neutral-300)', paddingTop: 8 }}>
                          <span>Grand Total:</span>
                          <span style={{ color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>₹{totals.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? <RefreshCw size={14} className="spin-animation" /> : <Check size={16} />}
                  <span>Place Purchase Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RECEIVE GOODS MODAL */}
      {/* ========================================================================= */}
      {isReceiveModalOpen && selectedPO && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsReceiveModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="card-header" style={{ backgroundColor: 'var(--success-50)', borderBottomColor: 'rgba(16, 185, 129, 0.2)' }}>
              <div>
                <span className="card-title" style={{ color: 'var(--success-700)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Truck size={18} />
                  Receive Shipment: {selectedPO.poNumber}
                </span>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  Receiving into <strong>{selectedPO.locationName}</strong> from <strong>{selectedPO.supplierName}</strong>
                </p>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsReceiveModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReceiveGoods} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                    Specify received quantities to immediately increment branch stock.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiveForm(prev => ({
                        ...prev,
                        items: prev.items.map(it => ({
                          ...it,
                          qtyToReceive: Math.max(0, it.orderedQty - it.alreadyReceived),
                        })),
                      }));
                    }}
                    style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success-700)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Receive All Remaining
                  </button>
                </div>

                {/* Items Inward Table */}
                <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)', borderBottom: '1px solid var(--neutral-200)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Product</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ordered</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Received</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Remaining</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: 120 }}>Receive Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiveForm.items.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--neutral-500)' }}>
                            No line items found for this purchase order.
                          </td>
                        </tr>
                      ) : (
                        receiveForm.items.map((item, idx) => {
                          const remaining = Math.max(0, item.orderedQty - item.alreadyReceived);
                          return (
                            <tr key={item.itemId || idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--neutral-800)' }}>{item.name}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{item.orderedQty}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{item.alreadyReceived}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--warning-700)' }}>{remaining}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="any"
                                  className="form-input"
                                  style={{ height: 30, padding: '4px 8px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                                  value={item.qtyToReceive ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    setReceiveForm(prev => {
                                      const updated = [...prev.items];
                                      updated[idx] = { ...updated[idx], qtyToReceive: raw as any };
                                      return { ...prev, items: updated };
                                    });
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Inward Notes / Delivery Challan Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Received via Delivery Partner, Challan #CH-99201"
                    value={receiveForm.notes}
                    onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  />
                </div>

                {/* Immediate Payment Section */}
                <div style={{ background: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--neutral-800)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={receiveForm.recordImmediatePayment}
                      onChange={(e) => setReceiveForm({ ...receiveForm, recordImmediatePayment: e.target.checked })}
                    />
                    <span>Record immediate vendor payout for this receipt (Payment Out)</span>
                  </label>

                  {receiveForm.recordImmediatePayment && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--neutral-200)' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Amount Paid (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="form-input"
                          style={{ height: 32, fontFamily: 'var(--font-mono)' }}
                          value={receiveForm.paymentAmount ?? ''}
                          onChange={(e) => setReceiveForm({ ...receiveForm, paymentAmount: e.target.value as any })}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Mode</label>
                        <select
                          className="form-select"
                          style={{ height: 32, fontSize: '0.8rem' }}
                          value={receiveForm.paymentMode}
                          onChange={(e: any) => setReceiveForm({ ...receiveForm, paymentMode: e.target.value })}
                        >
                          <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                          <option value="UPI">UPI / QR Code</option>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Debit / Credit Card</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Reference / UTR #</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ height: 32 }}
                          placeholder="e.g. UTR-98210"
                          value={receiveForm.paymentReference}
                          onChange={(e) => setReceiveForm({ ...receiveForm, paymentReference: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsReceiveModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={isSaving}>
                  {isSaving ? <RefreshCw size={14} className="spin-animation" /> : <CheckCircle2 size={16} />}
                  <span>Confirm Inward Shipment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CANCEL PO MODAL */}
      {/* ========================================================================= */}
      {isCancelModalOpen && selectedPO && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsCancelModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-header" style={{ backgroundColor: 'var(--danger-50)', borderBottomColor: 'rgba(239, 68, 68, 0.2)' }}>
              <span className="card-title" style={{ color: 'var(--danger-700)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={18} />
                Cancel Purchase Order
              </span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCancelModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-700)', margin: 0 }}>
                Are you sure you want to cancel order <strong>{selectedPO.poNumber}</strong>? Any inventory already received into branches will be preserved, and the pending balance will be cancelled.
              </p>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Reason for Cancellation <span style={{ color: 'var(--danger-600)' }}>*</span>
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Supplier out of stock, rate renegotiation, ordered in error..."
                  value={cancellationReason}
                  onChange={(e) => { setCancellationReason(e.target.value); setCancelError(''); }}
                  style={{ height: 'auto', padding: 8 }}
                />
                {cancelError && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger-600)', marginTop: 4 }}>
                    {cancelError}
                  </span>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--neutral-50)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsCancelModalOpen(false)} disabled={isSaving}>
                Close
              </button>
              <button type="button" className="btn btn-danger" onClick={handleCancelPO} disabled={isSaving}>
                {isSaving ? <RefreshCw size={14} className="spin-animation" /> : <XCircle size={16} />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PO PRINT & PREVIEW MODAL */}
      {/* ========================================================================= */}
      {isViewModalOpen && selectedPO && (
        <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 840, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ background: 'var(--neutral-50)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--primary-600)" />
                Purchase Order Document: {selectedPO.poNumber}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
                <button className="btn btn-secondary btn-icon" onClick={() => setIsViewModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: 32, background: '#ffffff' }} id="po-printable-area">
              {/* Paper Layout */}
              <div style={{ borderBottom: '2px solid var(--neutral-200)', paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--neutral-900)' }}>
                    {activeTenant?.name || 'QuickBill Enterprise'}
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', marginTop: 2 }}>{activeTenant?.address || '101, Retail Business Center'}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>GSTIN: {activeTenant?.gstin || '07AABCB1234F1Z5'} • Phone: {activeTenant?.phone || '+91 9876543210'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontSize: '0.78rem', fontWeight: 800 }}>
                    PURCHASE ORDER
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', marginTop: 6 }}>
                    {selectedPO.poNumber}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>Date: {formatIsoToDisplay(selectedPO.orderDate)}</div>
                  {selectedPO.expectedDeliveryDate && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>Expected: {formatIsoToDisplay(selectedPO.expectedDeliveryDate)}</div>
                  )}
                </div>
              </div>

              {/* Parties Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '20px 0' }}>
                <div style={{ background: 'var(--neutral-50)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-500)', marginBottom: 4 }}>Vendor / Supplier</div>
                  <div style={{ fontWeight: 800, color: 'var(--neutral-900)', fontSize: '0.95rem' }}>{selectedPO.supplierName}</div>
                  {selectedPO.supplierAddress && <div style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', marginTop: 2 }}>{selectedPO.supplierAddress}</div>}
                  {selectedPO.supplierPhone && <div style={{ fontSize: '0.78rem', color: 'var(--neutral-600)' }}>Phone: {selectedPO.supplierPhone}</div>}
                  {selectedPO.supplierGstin && <div style={{ fontSize: '0.78rem', color: 'var(--neutral-600)' }}>GSTIN: {selectedPO.supplierGstin}</div>}
                </div>

                <div style={{ background: 'var(--neutral-50)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-500)', marginBottom: 4 }}>Ship To Branch Outlet</div>
                  <div style={{ fontWeight: 800, color: 'var(--neutral-900)', fontSize: '0.95rem' }}>{selectedPO.locationName || 'Main Counter'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', marginTop: 2 }}>{activeLocation?.address || 'Corporate Facility'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--neutral-600)' }}>Attention: Inward Store Operations</div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', margin: '16px 0' }}>
                <thead>
                  <tr style={{ background: 'var(--neutral-100)', borderTop: '1px solid var(--neutral-200)', borderBottom: '1px solid var(--neutral-200)', color: 'var(--neutral-700)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ordered</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Received</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>GST %</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPO.items.map((it, idx) => {
                    const lineSub = it.orderedQty * it.unitPrice;
                    const lineTax = (lineSub * it.taxRate) / 100;
                    return (
                      <tr key={it.itemId} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--neutral-400)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--neutral-800)' }}>
                          {it.name}
                          {it.sku && <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>[{it.sku}]</span>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{it.orderedQty} {it.unit}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success-700)', fontWeight: 700 }}>{it.receivedQty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{it.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{it.taxRate}%</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>₹{(lineSub + lineTax).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
                <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600)' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{selectedPO.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600)' }}>
                    <span>Total Tax / GST:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{selectedPO.taxTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', color: 'var(--neutral-900)', borderTop: '1px solid var(--neutral-300)', paddingTop: 6 }}>
                    <span>Grand Total:</span>
                    <span style={{ color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>₹{selectedPO.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Receipt History Log */}
              {selectedPO.receiptHistory && selectedPO.receiptHistory.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-600)', marginBottom: 8 }}>
                    Goods Receipt History Batches
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedPO.receiptHistory.map((rec, i) => (
                      <div key={rec.id || i} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>Batch #{i + 1}</strong> • {new Date(rec.receivedAt).toLocaleString()} by {rec.receivedByName || 'Staff'}
                          {rec.notes && <span style={{ color: 'var(--neutral-500)', marginLeft: 8 }}>({rec.notes})</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: 'var(--success-700)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {rec.itemsReceived.reduce((s, it) => s + it.qty, 0)} units received
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--neutral-200)', fontSize: '0.8rem' }}>
                <div>
                  <strong>Terms &amp; Conditions:</strong>
                  <p style={{ color: 'var(--neutral-600)', marginTop: 4 }}>{selectedPO.terms || 'Standard vendor purchasing terms apply.'}</p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{ borderBottom: '1px solid var(--neutral-400)', width: 180, marginLeft: 'auto', marginBottom: 4 }} />
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Authorized Signatory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. INLINE QUICK ADD SUPPLIER MODAL */}
      {/* ========================================================================= */}
      {isQuickSupplierModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={() => !isSaving && setIsQuickSupplierModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={16} color="var(--primary-600)" />
                Quick Add Supplier
              </span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsQuickSupplierModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickSupplier}>
              <div className="modal-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Supplier / Business Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Apex Wholesale Supplies"
                    value={quickSupplier.name}
                    onChange={(e) => setQuickSupplier({ ...quickSupplier, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+91 98765..."
                      value={quickSupplier.phone}
                      onChange={(e) => setQuickSupplier({ ...quickSupplier, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">GSTIN</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                      placeholder="07AAB..."
                      value={quickSupplier.gstin}
                      onChange={(e) => setQuickSupplier({ ...quickSupplier, gstin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address / Logistics Hub</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Phase 2, Industrial Hub"
                    value={quickSupplier.address}
                    onChange={(e) => setQuickSupplier({ ...quickSupplier, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsQuickSupplierModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? <RefreshCw size={14} className="spin-animation" /> : <Check size={14} />}
                  <span>Save &amp; Select</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. INLINE QUICK ADD PRODUCT MODAL */}
      {/* ========================================================================= */}
      {isQuickItemModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={() => !isSaving && setIsQuickItemModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PackagePlus size={16} color="var(--primary-600)" />
                Quick Add Catalog Product
              </span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsQuickItemModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickItem}>
              <div className="modal-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Basmati Rice 5kg Premium"
                    value={quickItem.name}
                    onChange={(e) => setQuickItem({ ...quickItem, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={quickItem.category}
                      onChange={(e) => setQuickItem({ ...quickItem, category: e.target.value })}
                    >
                      <option value="Grocery">Grocery</option>
                      <option value="Dairy & Eggs">Dairy &amp; Eggs</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Snacks & Sweets">Snacks &amp; Sweets</option>
                      <option value="Personal Care">Personal Care</option>
                      <option value="Household & Cleaning">Household &amp; Cleaning</option>
                      <option value="Electronics & Gadgets">Electronics &amp; Gadgets</option>
                      <option value="General Store">General Store</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Unit</label>
                    <select
                      className="form-select"
                      value={quickItem.unit}
                      onChange={(e) => setQuickItem({ ...quickItem, unit: e.target.value })}
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="gm">gm</option>
                      <option value="ltr">ltr</option>
                      <option value="box">box</option>
                      <option value="pack">pack</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Cost Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                      value={quickItem.purchasePrice ?? ''}
                      onChange={(e) => setQuickItem({ ...quickItem, purchasePrice: e.target.value as any })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Sale Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                      value={quickItem.salePrice ?? ''}
                      onChange={(e) => setQuickItem({ ...quickItem, salePrice: e.target.value as any })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">GST %</label>
                    <select
                      className="form-select"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      value={quickItem.taxRate}
                      onChange={(e) => setQuickItem({ ...quickItem, taxRate: parseFloat(e.target.value) || 0 })}
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsQuickItemModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? <RefreshCw size={14} className="spin-animation" /> : <Check size={14} />}
                  <span>Add to PO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
