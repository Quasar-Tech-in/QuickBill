import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ArrowRight,
  Upload,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Star,
  PlusCircle
} from 'lucide-react';
import { PurchaseOrder, PurchaseOrderStatus, Party, Item, StoreLocation, ItemCategory, ItemImage } from '../types';
import { store } from '../services/store';
import { Pagination } from '../components/Pagination';
import { DateRangePicker, DateRangeValue, formatIsoToDisplay } from '../components/DateRangePicker';
import { compressImage, formatBytes, CompressionResult } from '../utils/imageCompressor';
import { uploadItemImage } from '../services/supabaseStorage';

export interface FormImageItem extends ItemImage {
  pendingCompressed?: CompressionResult;
}

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

  // Active PO for Actions (Receive / Cancel / View / Pay)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentTargetPO, setPaymentTargetPO] = useState<PurchaseOrder | null>(null);

  // Form State: Create Purchase Order
  const [newPO, setNewPO] = useState<{
    supplierId: string;
    locationId: string;
    orderDate: string;
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
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    notes: '',
    terms: 'Payment due within 30 days of goods receipt.',
    items: [],
  });

  // Form State: Record Standalone Supplier Payment
  const [poPaymentForm, setPoPaymentForm] = useState<{
    amount: number;
    paymentMode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
    referenceNumber: string;
    notes: string;
  }>({
    amount: 0,
    paymentMode: 'BANK_TRANSFER',
    referenceNumber: '',
    notes: '',
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

  // Dynamic Categories & Quick Add Item Form State
  const [categoriesList, setCategoriesList] = useState<ItemCategory[]>(store.getCategories());
  const [quickItemImages, setQuickItemImages] = useState<FormImageItem[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const [isAddingNewCat, setIsAddingNewCat] = useState<boolean>(false);
  const [newCatNameInput, setNewCatNameInput] = useState<string>('');
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  const [quickItem, setQuickItem] = useState({
    name: '',
    category: store.getCategories()[0]?.name || 'General Store',
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

  // Initial category fetch
  useEffect(() => {
    store.fetchCategories().then(() => {
      const cats = store.getCategories();
      setCategoriesList(cats);
      if (cats.length > 0) {
        setQuickItem(prev => ({
          ...prev,
          category: prev.category === 'General Store' && !cats.some(c => c.name === 'General Store') ? cats[0].name : prev.category
        }));
      }
    }).catch(() => {});
  }, []);

  // Load PO List
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setParties(store.getParties());
      setItems(store.getItems());
      setCategoriesList(store.getCategories());
      store.fetchCategories().then(() => {
        setCategoriesList(store.getCategories());
      }).catch(() => {});

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
      orderDate: new Date().toISOString().split('T')[0],
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
        orderDate: newPO.orderDate || undefined,
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

  const openPaymentModal = (po: PurchaseOrder) => {
    setPaymentTargetPO(po);
    const balance = (po.balanceDue !== undefined && po.balanceDue > 0)
      ? po.balanceDue
      : ((po.totalReceivedAmount !== undefined && po.totalReceivedAmount > 0) ? po.totalReceivedAmount : po.grandTotal);
    setPoPaymentForm({
      amount: balance,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: '',
      notes: `Payment for PO ${po.poNumber}`,
    });
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetPO) return;

    if (poPaymentForm.amount <= 0) {
      showNotification('error', 'Please specify a payment amount greater than 0.');
      return;
    }

    setIsSaving(true);
    try {
      await store.recordPurchaseOrderPayment(paymentTargetPO.id, {
        amount: Number(poPaymentForm.amount),
        paymentMode: poPaymentForm.paymentMode,
        referenceNumber: poPaymentForm.referenceNumber || undefined,
        notes: poPaymentForm.notes || undefined,
      });

      showNotification('success', `Payment of ₹${Number(poPaymentForm.amount).toFixed(2)} recorded for ${paymentTargetPO.poNumber}!`);
      setIsPaymentModalOpen(false);
      setPaymentTargetPO(null);
      loadData();
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to record payment');
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

  const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    const newStagedImages: FormImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setUploadStatusMsg(`Compressing ${file.name}...`);
        const compressed = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.82 });

        const currentIndex = quickItemImages.length + newStagedImages.length;
        const tempId = `staged_po_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

        newStagedImages.push({
          id: tempId,
          url: compressed.dataUrl, // Local in-memory preview with zero network calls
          order: currentIndex,
          isPrimary: quickItemImages.length === 0 && newStagedImages.length === 0,
          name: file.name,
          sizeBytes: compressed.compressedSizeBytes,
          originalSizeBytes: compressed.originalSizeBytes,
          pendingCompressed: compressed,
        });
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }

    setQuickItemImages(prev => {
      const combined = [...prev, ...newStagedImages];
      return combined.map((img, idx) => ({
        ...img,
        order: idx,
        isPrimary: prev.some(p => p.isPrimary) ? img.isPrimary : idx === 0,
      }));
    });

    setIsUploadingImage(false);
    setUploadStatusMsg('');
    if (quickFileInputRef.current) quickFileInputRef.current.value = '';
  };

  const handleRemoveQuickImage = (index: number) => {
    const filtered = quickItemImages.filter((_, idx) => idx !== index);
    const updated = filtered.map((img, idx) => ({
      ...img,
      order: idx,
      isPrimary: img.isPrimary ? true : (filtered.length > 0 && !filtered.some(f => f.isPrimary) && idx === 0),
    }));
    setQuickItemImages(updated);
  };

  const handleSetPrimaryQuickImage = (index: number) => {
    setQuickItemImages(quickItemImages.map((img, idx) => ({
      ...img,
      isPrimary: idx === index,
    })));
  };

  const handleAddNewCategory = async () => {
    if (!newCatNameInput.trim()) return;
    try {
      await store.addCategory({
        name: newCatNameInput.trim(),
      });
      const updatedCats = store.getCategories();
      setCategoriesList(updatedCats);
      setQuickItem(prev => ({ ...prev, category: newCatNameInput.trim() }));
      setNewCatNameInput('');
      setIsAddingNewCat(false);
      showNotification('success', `Category "${newCatNameInput.trim()}" created!`);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to add category');
    }
  };

  const handleSaveQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItem.name.trim()) {
      showNotification('error', 'Product name is required');
      return;
    }

    setIsSaving(true);
    setUploadStatusMsg('Saving product and processing images...');
    try {
      const businessId = currentUser?.businessId || '';
      const tempItemId = `itm_${Date.now()}`;

      // 1. Upload staged images to Supabase storage if present
      const finalImages: ItemImage[] = [];
      const sortedImages = [...quickItemImages].sort((a, b) => a.order - b.order);

      for (let i = 0; i < sortedImages.length; i++) {
        const img = sortedImages[i];
        if (img.pendingCompressed) {
          setUploadStatusMsg(`Uploading image #${i + 1} to storage...`);
          const uploadRes = await uploadItemImage(businessId, tempItemId, img.pendingCompressed, i);
          finalImages.push({
            id: uploadRes.id || img.id,
            url: uploadRes.url,
            order: i,
            isPrimary: img.isPrimary,
            name: img.name,
            sizeBytes: uploadRes.sizeBytes || img.sizeBytes,
            originalSizeBytes: uploadRes.originalSizeBytes || img.originalSizeBytes,
          });
        } else {
          finalImages.push({
            id: img.id,
            url: img.url,
            order: i,
            isPrimary: img.isPrimary,
            name: img.name,
            sizeBytes: img.sizeBytes,
            originalSizeBytes: img.originalSizeBytes,
          });
        }
      }

      if (finalImages.length > 0 && !finalImages.some(img => img.isPrimary)) {
        finalImages[0].isPrimary = true;
      }

      const primaryImg = finalImages.find(img => img.isPrimary) || finalImages[0];
      const primaryImageUrl = primaryImg ? primaryImg.url : undefined;

      const created = await store.addItem({
        name: quickItem.name.trim(),
        category: quickItem.category || categoriesList[0]?.name || 'General',
        unit: quickItem.unit,
        purchasePrice: Number(quickItem.purchasePrice) || 0,
        salePrice: Number(quickItem.salePrice) || Number(quickItem.purchasePrice) * 1.2 || 0,
        taxRate: Number(quickItem.taxRate) || 0,
        currentStock: 0,
        minStockAlert: 5,
        images: finalImages,
        imageUrl: primaryImageUrl,
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
      setQuickItemImages([]);
      setQuickItem({
        name: '',
        category: categoriesList[0]?.name || 'General Store',
        unit: 'pcs',
        purchasePrice: 0,
        salePrice: 0,
        taxRate: 18
      });
      showNotification('success', `Product "${created.name}" added to order!`);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to create item');
    } finally {
      setIsSaving(false);
      setUploadStatusMsg('');
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
    .reduce((sum, p) => sum + (p.grandTotal || 0), 0);
  const totalReceivedSpend = allPOs
    .filter(p => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + (p.totalReceivedAmount !== undefined ? p.totalReceivedAmount : (p.status === 'RECEIVED' || p.status === 'FULLY_RECEIVED' ? p.grandTotal : 0)), 0);
  const totalPaidSpend = allPOs
    .filter(p => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + (p.totalPaidAmount || 0), 0);
  const totalPendingBalance = allPOs
    .filter(p => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + (p.balanceDue !== undefined ? p.balanceDue : Math.max(0, (p.totalReceivedAmount || 0) - (p.totalPaidAmount || 0))), 0);

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

  const renderPaymentStatusBadge = (po: PurchaseOrder) => {
    const status = po.paymentStatus || (po.balanceDue !== undefined && po.totalReceivedAmount !== undefined ? (po.balanceDue === 0 && po.totalReceivedAmount > 0 ? 'PAID' : (po.totalPaidAmount && po.totalPaidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID')) : 'UNPAID');
    switch (status) {
      case 'PAID':
        return (
          <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.7rem' }}>
            Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="badge" style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.7rem' }}>
            Partially Paid
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '0.7rem' }}>
            Unpaid
          </span>
        );
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
            Purchase Orders & Vendor Payables
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Place purchase orders, inward stock directly into branches, and track supplier ledger payments & pending dues.
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
            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Ordered: ₹{totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PackageCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inwarded Stock Value</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>
              ₹{totalReceivedSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669' }}>{receivedCount} fully received</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid to Vendors</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-700)' }}>
              ₹{totalPaidSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Recorded payment out</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: totalPendingBalance > 0 ? 'var(--danger-50)' : '#ecfdf5', color: totalPendingBalance > 0 ? 'var(--danger-600)' : '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outstanding Payables</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: totalPendingBalance > 0 ? 'var(--danger-700)' : '#059669' }}>
              ₹{totalPendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Pending vendor settlement</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar - Single Line with Active Chips */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'visible', position: 'relative', zIndex: 10 }}>
        {/* Line 1: Single Line Controls Bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search by PO Number, Supplier name, phone or notes..."
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

          {/* PO Status Filter */}
          <select
            className="form-select"
            style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 130 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ORDERED">📦 Ordered</option>
            <option value="PARTIALLY_RECEIVED">⏳ Partial Inward</option>
            <option value="RECEIVED">✅ Fully Received</option>
            <option value="CANCELLED">❌ Cancelled</option>
          </select>

          {/* Location / Branch Filter */}
          <select
            className="form-select"
            style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 130 }}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="ALL">🌐 All Branches</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                📍 {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          {/* Supplier Filter */}
          <select
            className="form-select"
            style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 130 }}
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="ALL">👥 All Suppliers</option>
            {parties.filter(p => p.type === 'SUPPLIER').map(sup => (
              <option key={sup.id} value={sup.id}>{sup.name}</option>
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
            onClick={() => loadData()}
            disabled={isLoading}
            style={{ height: 35, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: '0.8rem' }}
            title="Refresh Orders"
          >
            <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Line 2: Active Filter Chips */}
        {(searchQuery.trim() !== '' || statusFilter !== 'ALL' || locationFilter !== 'ALL' || supplierFilter !== 'ALL' || dateRange.preset !== 'ALL') && (
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

            {/* Search Query Chip */}
            {searchQuery.trim() !== '' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: 'var(--primary-50)',
                color: 'var(--primary-700)',
                border: '1px solid var(--primary-200)',
                fontWeight: 600,
                fontSize: '0.74rem'
              }}>
                <Search size={10} />
                <span>"{searchQuery.trim()}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary-700)' }}
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {/* Status Chip */}
            {statusFilter !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                fontWeight: 600,
                fontSize: '0.74rem'
              }}>
                <PackageCheck size={10} />
                <span>Status: {statusFilter.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {/* Branch Chip */}
            {locationFilter !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontWeight: 600,
                fontSize: '0.74rem'
              }}>
                <MapPin size={10} />
                <span>Branch: {locations.find(l => l.id === locationFilter)?.name || locationFilter}</span>
                <button
                  type="button"
                  onClick={() => setLocationFilter('ALL')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' }}
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {/* Supplier Chip */}
            {supplierFilter !== 'ALL' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                fontWeight: 600,
                fontSize: '0.74rem'
              }}>
                <Building2 size={10} />
                <span>Supplier: {parties.find(p => p.id === supplierFilter)?.name || supplierFilter}</span>
                <button
                  type="button"
                  onClick={() => setSupplierFilter('ALL')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#92400e' }}
                >
                  <X size={10} />
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
                borderRadius: 12,
                backgroundColor: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                fontWeight: 600,
                fontSize: '0.74rem'
              }}>
                <Calendar size={10} />
                <span>
                  {dateRange.preset === 'CUSTOM'
                    ? `${formatIsoToDisplay(dateRange.fromDate)} to ${formatIsoToDisplay(dateRange.toDate)}`
                    : dateRange.preset.replace(/_/g, ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setDateRange({ preset: 'ALL', fromDate: '', toDate: '' })}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#166534' }}
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {/* Clear All Filters Button */}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setLocationFilter('ALL');
                setSupplierFilter('ALL');
                setDateRange({ preset: 'ALL', fromDate: '', toDate: '' });
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger-600)',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                marginLeft: 4,
                padding: '2px 6px',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--danger-50)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <RotateCcw size={10} />
              <span>Clear All</span>
            </button>
          </div>
        )}
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
                <th style={{ textAlign: 'right' }}>Order Value</th>
                <th style={{ textAlign: 'right' }}>Inward &amp; Settlement</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--neutral-500)' }}>
                    <div className="spin-animation" style={{ display: 'inline-block', marginBottom: 8 }}>
                      <RefreshCw size={24} color="var(--primary-600)" />
                    </div>
                    <div>Loading purchase orders...</div>
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--neutral-400)' }}>
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
                  const totalOrdered = (po.items || []).reduce((s, i) => s + (i.orderedQty || 0), 0);
                  const totalReceived = (po.items || []).reduce((s, i) => s + (i.receivedQty || 0), 0);
                  const percent = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
                  const canReceive = po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';
                  const canCancel = po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && po.status !== 'FULLY_RECEIVED';
                  const receivedAmt = po.totalReceivedAmount !== undefined ? po.totalReceivedAmount : (po.status === 'RECEIVED' || po.status === 'FULLY_RECEIVED' ? po.grandTotal : 0);
                  const paidAmt = po.totalPaidAmount || 0;
                  const balanceDue = po.balanceDue !== undefined ? po.balanceDue : Math.max(0, receivedAmt - paidAmt);
                  const canPay = po.status !== 'CANCELLED' && (balanceDue > 0 || (receivedAmt === 0 && paidAmt < po.grandTotal));

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
                        <div style={{ minWidth: 150 }}>
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
                        <div style={{ fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>
                          ₹{po.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                          Tax: ₹{po.taxTotal.toFixed(2)}
                        </div>
                      </td>

                      {/* Inward & Settlement */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                          Inward: ₹{receivedAmt.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 1 }}>
                          <span>Paid: ₹{paidAmt.toFixed(2)}</span>
                          {balanceDue > 0 ? (
                            <span style={{ color: 'var(--danger-600)', fontWeight: 700 }}>• Due: ₹{balanceDue.toFixed(2)}</span>
                          ) : (
                            <span style={{ color: '#059669', fontWeight: 600 }}>• Settled</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          {renderStatusBadge(po.status)}
                          {po.status !== 'CANCELLED' && renderPaymentStatusBadge(po)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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

                          {canPay && (
                            <button
                              onClick={() => openPaymentModal(po)}
                              className="btn btn-sm btn-secondary"
                              title="Record vendor payment towards this PO"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--primary-700)', borderColor: 'var(--primary-200)', backgroundColor: 'var(--primary-50)' }}
                            >
                              <DollarSign size={13} />
                              <span>Pay</span>
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

                  {/* Order Date */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Order Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newPO.orderDate}
                      onChange={(e) => setNewPO({ ...newPO, orderDate: e.target.value })}
                      required
                      style={{ height: 38, fontSize: '0.82rem' }}
                    />
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
                            const itemImgUrl = it.imageUrl || (it.images && it.images[0]?.url);
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
                                  gap: 10,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-50)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                  {itemImgUrl ? (
                                    <img
                                      src={itemImgUrl}
                                      alt={it.name}
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 'var(--radius-sm)',
                                        objectFit: 'cover',
                                        border: '1px solid var(--neutral-200)',
                                        flexShrink: 0,
                                        backgroundColor: '#ffffff'
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: 'var(--neutral-100)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--neutral-400)',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <ImageIcon size={18} />
                                    </div>
                                  )}
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--neutral-850)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <span>{it.name}</span>
                                      {it.sku && <span className="badge" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>SKU: {it.sku}</span>}
                                      {it.category && <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>• {it.category}</span>}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                                      Unit: {it.unit || 'pcs'} | Cost: ₹{it.purchasePrice || it.salePrice || 0} | Stock: {it.currentStock || 0}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ flexShrink: 0 }}>
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
                            const lineImgUrl = targetItem?.imageUrl || (targetItem?.images && targetItem?.images[0]?.url);

                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                                <td style={{ padding: '8px 10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {lineImgUrl ? (
                                      <img
                                        src={lineImgUrl}
                                        alt={targetItem?.name}
                                        style={{
                                          width: 34,
                                          height: 34,
                                          borderRadius: 'var(--radius-sm)',
                                          objectFit: 'cover',
                                          border: '1px solid var(--neutral-200)',
                                          flexShrink: 0,
                                          backgroundColor: '#ffffff'
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: 34,
                                          height: 34,
                                          borderRadius: 'var(--radius-sm)',
                                          backgroundColor: 'var(--neutral-100)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: 'var(--neutral-400)',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <ImageIcon size={16} />
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                      <span style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.83rem' }}>
                                        {targetItem?.name || 'Catalog Item'}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--neutral-500)', flexWrap: 'wrap' }}>
                                        {targetItem?.sku && <span className="badge" style={{ fontSize: '0.66rem', padding: '1px 5px' }}>SKU: {targetItem.sku}</span>}
                                        <span>Unit: {targetItem?.unit || 'pcs'}</span>
                                        {targetItem?.category && <span>• {targetItem.category}</span>}
                                      </div>
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
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Product & Inward Cost</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Ordered / Rec'd</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Remaining</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: 110 }}>Receive Now</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: 140 }}>New WAC / Stock</th>
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
                          const poLine = (selectedPO?.items || []).find(x => x.itemId === item.itemId);
                          const inwardPrice = poLine?.unitPrice || 0;

                          const catalogItem = items.find(i => i.id === item.itemId);
                          const currStock = Number(catalogItem?.currentStock || 0);
                          const currAvgCost = Number(catalogItem?.averageCostPrice !== undefined && catalogItem?.averageCostPrice > 0 ? catalogItem.averageCostPrice : (catalogItem?.purchasePrice || inwardPrice));
                          const qtyToRec = Number(item.qtyToReceive || 0);
                          const newStock = currStock + qtyToRec;
                          const newAvgCost = newStock > 0 ? ((Math.max(0, currStock) * currAvgCost) + (qtyToRec * inwardPrice)) / newStock : inwardPrice;

                          return (
                            <tr key={item.itemId || idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{item.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', display: 'flex', gap: 6 }}>
                                  <span>Inward: <strong>₹{inwardPrice.toFixed(2)}</strong></span>
                                  <span>• Cur Avg: ₹{currAvgCost.toFixed(2)}</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                <span>{item.orderedQty}</span>
                                <span style={{ color: 'var(--neutral-400)', margin: '0 3px' }}>/</span>
                                <span style={{ color: 'var(--neutral-600)' }}>{item.alreadyReceived}</span>
                              </td>
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
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                {qtyToRec > 0 ? (
                                  <div>
                                    <div style={{ color: '#059669', fontWeight: 800 }}>
                                      Avg: ₹{newAvgCost.toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>
                                      Stock: {currStock} → {newStock}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--neutral-400)' }}>—</span>
                                )}
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
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let estVal = 0;
                        if (checked && selectedPO) {
                          receiveForm.items.forEach(it => {
                            const poLine = (selectedPO.items || []).find(x => x.itemId === it.itemId);
                            const price = poLine?.unitPrice || 0;
                            const tax = poLine?.taxRate || 0;
                            const sub = Number(it.qtyToReceive || 0) * price;
                            estVal += sub + (sub * tax / 100);
                          });
                        }
                        setReceiveForm(prev => ({
                          ...prev,
                          recordImmediatePayment: checked,
                          paymentAmount: checked ? Number(estVal.toFixed(2)) : 0,
                        }));
                      }}
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

                {/* Live Inward & Settlement Preview */}
                {(() => {
                  let estInwardVal = 0;
                  receiveForm.items.forEach(it => {
                    const poLine = (selectedPO.items || []).find(x => x.itemId === it.itemId);
                    const price = poLine?.unitPrice || 0;
                    const tax = poLine?.taxRate || 0;
                    const sub = Number(it.qtyToReceive || 0) * price;
                    estInwardVal += sub + (sub * tax / 100);
                  });
                  const paid = receiveForm.recordImmediatePayment ? Number(receiveForm.paymentAmount || 0) : 0;
                  const netPayableAdded = Math.max(0, estInwardVal - paid);

                  return (
                    <div style={{ background: '#f8fafc', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span style={{ color: 'var(--neutral-500)' }}>Batch Inward Value: </span>
                        <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>₹{estInwardVal.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--neutral-500)' }}>Immediate Payout: </span>
                        <strong style={{ color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>₹{paid.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--neutral-500)' }}>Net Vendor Payable Increase: </span>
                        <strong style={{ color: netPayableAdded > 0 ? 'var(--danger-700)' : '#059669', fontFamily: 'var(--font-mono)' }}>
                          ₹{netPayableAdded.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
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
                      <tr key={it.itemId || idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
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

              {/* Totals & Settlement Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '16px 0' }}>
                <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600)' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{selectedPO.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600)' }}>
                    <span>Total Tax / GST:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{selectedPO.taxTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: 'var(--neutral-900)', borderTop: '1px solid var(--neutral-300)', paddingTop: 6 }}>
                    <span>Grand Total (Ordered):</span>
                    <span style={{ color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>₹{selectedPO.grandTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontSize: '0.84rem', fontWeight: 700 }}>
                    <span>Inwarded Stock Value:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{(selectedPO.totalReceivedAmount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary-700)', fontSize: '0.84rem', fontWeight: 700 }}>
                    <span>Paid to Vendor:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{(selectedPO.totalPaidAmount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: (selectedPO.balanceDue || 0) > 0 ? 'var(--danger-700)' : '#059669', fontWeight: 800, fontSize: '0.95rem', borderTop: '1px dashed var(--neutral-300)', paddingTop: 6 }}>
                    <span>Outstanding Balance Due:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{(selectedPO.balanceDue || 0).toFixed(2)}</span>
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

              {/* Payments Log */}
              {selectedPO.payments && selectedPO.payments.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DollarSign size={14} />
                    Vendor Payment Records
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedPO.payments.map((pmt, i) => (
                      <div key={pmt.paymentId || i} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>Payment #{i + 1}</strong> • {formatIsoToDisplay(pmt.paymentDate || pmt.paidAt)} via <strong>{pmt.paymentMode}</strong>
                          {pmt.referenceNumber && <span style={{ color: 'var(--neutral-600)', marginLeft: 6 }}>[Ref: {pmt.referenceNumber}]</span>}
                          {pmt.notes && <span style={{ color: 'var(--neutral-500)', marginLeft: 6 }}>({pmt.notes})</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: '#059669', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                            ₹{pmt.amount.toFixed(2)}
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
      {/* 5. RECORD STANDALONE PO PAYMENT MODAL */}
      {/* ========================================================================= */}
      {isPaymentModalOpen && paymentTargetPO && (
        <div className="modal-overlay" style={{ zIndex: 100000 }} onClick={() => !isSaving && setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="card-header" style={{ backgroundColor: 'var(--primary-50)', borderBottomColor: 'var(--primary-200)' }}>
              <div>
                <span className="card-title" style={{ color: 'var(--primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={18} />
                  Record Supplier Payment: {paymentTargetPO.poNumber}
                </span>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  Paying vendor <strong>{paymentTargetPO.supplierName}</strong> for procurement order.
                </p>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsPaymentModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Financial Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 10, background: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Inward Value</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                      ₹{(paymentTargetPO.totalReceivedAmount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Already Paid</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      ₹{(paymentTargetPO.totalPaidAmount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Balance Due</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--danger-600)', fontFamily: 'var(--font-mono)' }}>
                      ₹{(paymentTargetPO.balanceDue || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    className="form-input"
                    style={{ height: 38, fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700 }}
                    value={poPaymentForm.amount ?? ''}
                    onChange={(e) => setPoPaymentForm({ ...poPaymentForm, amount: e.target.value as any })}
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Mode *</label>
                  <select
                    className="form-select"
                    style={{ height: 38 }}
                    value={poPaymentForm.paymentMode}
                    onChange={(e: any) => setPoPaymentForm({ ...poPaymentForm, paymentMode: e.target.value })}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">UTR / Reference / Cheque #</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. UTR-98210398231"
                    value={poPaymentForm.referenceNumber}
                    onChange={(e) => setPoPaymentForm({ ...poPaymentForm, referenceNumber: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Partial settlement for invoice #992"
                    value={poPaymentForm.notes}
                    onChange={(e) => setPoPaymentForm({ ...poPaymentForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? <RefreshCw size={14} className="spin-animation" /> : <CheckCircle2 size={16} />}
                  <span>Confirm Payment Out</span>
                </button>
              </div>
            </form>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>Category</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                        style={{ fontSize: '0.72rem', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                      >
                        {isAddingNewCat ? 'Choose Existing' : '+ New Category'}
                      </button>
                    </div>

                    {isAddingNewCat ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="New category name..."
                          value={newCatNameInput}
                          onChange={(e) => setNewCatNameInput(e.target.value)}
                          style={{ height: 36, fontSize: '0.82rem' }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewCategory();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleAddNewCategory}
                          disabled={!newCatNameInput.trim()}
                          style={{ height: 36, padding: '0 10px', fontSize: '0.78rem' }}
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <select
                        className="form-select"
                        value={quickItem.category}
                        onChange={(e) => setQuickItem({ ...quickItem, category: e.target.value })}
                      >
                        {categoriesList.map(cat => (
                          <option key={cat.id || cat.name} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                        {categoriesList.length === 0 && (
                          <option value="General Store">General Store</option>
                        )}
                      </select>
                    )}
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

                {/* Product Photos & Image Upload Section */}
                <div style={{ background: 'var(--neutral-50)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary-700)' }}>
                        Product Photos
                      </span>
                      <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 10, backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={11} />
                        Auto-Optimized
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                      {quickItemImages.length} photo{quickItemImages.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={quickFileInputRef}
                    onChange={handleQuickImageUpload}
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  {/* Upload Drop Zone Trigger */}
                  <div
                    onClick={() => quickFileInputRef.current?.click()}
                    style={{
                      border: '1.5px dashed var(--neutral-300)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 12px',
                      backgroundColor: '#ffffff',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: quickItemImages.length > 0 ? 10 : 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-500)';
                      e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--neutral-300)';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                        <Upload size={16} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--neutral-800)' }}>
                        Click to Upload Product Photos
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>
                        JPG, PNG, WebP (Images are automatically resized &amp; saved to cloud)
                      </div>
                    </div>
                  </div>

                  {/* Loading indicator */}
                  {isUploadingImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-sm)', marginBottom: 10, fontSize: '0.75rem', color: 'var(--primary-800)', fontWeight: 600 }}>
                      <Loader2 size={13} className="spin-animation" />
                      <span>{uploadStatusMsg || 'Processing image...'}</span>
                    </div>
                  )}

                  {/* Uploaded Images Gallery */}
                  {quickItemImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                      {quickItemImages.map((img, idx) => {
                        const isPrimary = !!img.isPrimary;
                        return (
                          <div
                            key={img.id || idx}
                            style={{
                              borderRadius: 'var(--radius-sm)',
                              border: `1.5px solid ${isPrimary ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                              backgroundColor: '#ffffff',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              position: 'relative',
                            }}
                          >
                            {isPrimary && (
                              <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: 'var(--primary-600)', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Star size={10} fill="#fff" /> Cover
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveQuickImage(idx)}
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                zIndex: 2,
                                background: 'rgba(239, 68, 68, 0.85)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 20,
                                height: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              title="Remove photo"
                            >
                              <X size={12} />
                            </button>
                            <div style={{ height: 80, backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <img
                                src={img.url}
                                alt={img.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                            <div style={{ padding: '4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--neutral-50)', fontSize: '0.68rem' }}>
                              <span style={{ color: 'var(--neutral-500)', fontSize: '0.65rem' }}>
                                {formatBytes(img.sizeBytes || 0)}
                              </span>
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryQuickImage(idx)}
                                  style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                >
                                  Make Cover
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
