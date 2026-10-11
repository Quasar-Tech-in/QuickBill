import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  QrCode, 
  Trash2, 
  SlidersHorizontal, 
  X,
  MapPin,
  CheckCircle2,
  XCircle,
  Edit3,
  Tag,
  Percent,
  DollarSign,
  Layers,
  FolderPlus,
  Filter,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Upload,
  ArrowLeft,
  ArrowRight,
  Star,
  Loader2,
  Sparkles,
  Eye,
  Check,
  Boxes,
  Printer,
  History,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Scale,
  Scan
} from 'lucide-react';
import { Item, StoreLocation, ItemLocationInventory, ItemCategory, ItemImage, InventoryMovement } from '../types';
import { store } from '../services/store';
import { StatusBadge } from '../components/StatusBadge';
import { PrintLabelModal } from '../components/PrintLabelModal';
import { WebcamScannerModal } from '../components/WebcamScannerModal';
import { CustomSelect } from '../components/CustomSelect';
import { Pagination } from '../components/Pagination';
import { SyncInventoryModal } from '../components/SyncInventoryModal';
import { DateRangePicker, DateRangeValue, calculatePresetDates } from '../components/DateRangePicker';
import { compressImage, formatBytes, CompressionResult } from '../utils/imageCompressor';
import { uploadItemImage, deleteItemImages } from '../services/supabaseStorage';

export interface FormImageItem extends ItemImage {
  pendingCompressed?: CompressionResult;
}

export const InventoryView: React.FC = () => {
  const currentUser = store.getCurrentUser();
  const canManage = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TENANT_ADMIN' || currentUser?.role === 'MANAGER';
  const locations = store.getAllLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string>(store.getActiveLocation().id);

  const [items, setItems] = useState<Item[]>([]);
  const [rawItems, setRawItems] = useState<Item[]>([]);
  const [categoriesList, setCategoriesList] = useState<ItemCategory[]>(store.getCategories());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Debounce search query input (300ms) for responsive API searching
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Category Multi-Select Dropdown State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [codeStudioTarget, setCodeStudioTarget] = useState<Item | null>(null);
  const [activeScanField, setActiveScanField] = useState<'sku' | 'barcode' | null>(null);
  const [scanDuplicateItem, setScanDuplicateItem] = useState<Item | null>(null);
  const [scannedCodeValue, setScannedCodeValue] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const handleCodeScanned = (rawCode: string) => {
    const code = rawCode.startsWith('ITEM:') ? rawCode.substring(5).trim() : rawCode.trim();
    if (activeScanField === 'sku') {
      setFormSku(code);
    } else if (activeScanField === 'barcode') {
      setFormBarcode(code);
    }
    setActiveScanField(null);

    // Check if an existing product already uses this code
    const existing = rawItems.find((item) => 
      (editingItem ? item.id !== editingItem.id : true) &&
      ((item.barcode && item.barcode.trim().toLowerCase() === code.toLowerCase()) || 
       (item.sku && item.sku.trim().toLowerCase() === code.toLowerCase()) ||
       (item.publicItemId && item.publicItemId.trim().toLowerCase() === code.toLowerCase()))
    );

    if (existing) {
      setScannedCodeValue(code);
      setScanDuplicateItem(existing);
    }
  };

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<Item | null>(null);
  const [adjustLocationId, setAdjustLocationId] = useState<string>(selectedLocationId);
  const [adjustDelta, setAdjustDelta] = useState<number | string>(10);
  const [adjustType, setAdjustType] = useState<'ADD' | 'REDUCE'>('ADD');
  const [adjustUnitCost, setAdjustUnitCost] = useState<number | string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Physical Stock Count / Surplus');
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  const openStockAdjustment = (item: Item, locationId?: string) => {
    const raw = rawItems.find(r => r.id === item.id) || item;
    setSelectedItemForAdjust(raw);
    setAdjustLocationId(locationId || selectedLocationId);
    setAdjustDelta(raw.allowParts ? '1.000' : '1');
    setAdjustType('ADD');
    const targetLoc = raw.locations?.find(l => l.locationId === (locationId || selectedLocationId));
    const defaultCost = (targetLoc && targetLoc.purchasePrice !== undefined && targetLoc.purchasePrice !== null)
      ? String(targetLoc.purchasePrice)
      : (raw.purchasePrice !== undefined ? String(raw.purchasePrice) : '');
    setAdjustUnitCost(defaultCost);
    setAdjustReason('Physical Stock Count / Surplus');
    setAdjustNotes('');
    setIsAdjustModalOpen(true);
  };


  // Branch Catalog Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Category Master Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');

  // Tab State: Products Catalog vs Stock Movement Ledger
  const [activeMainTab, setActiveMainTab] = useState<'PRODUCTS' | 'LEDGER'>('PRODUCTS');

  // Stock Movement Ledger State
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isMovementsLoading, setIsMovementsLoading] = useState<boolean>(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [movementLocationFilter, setMovementLocationFilter] = useState<string>('ALL');
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>('');
  const [movementKeywords, setMovementKeywords] = useState<string[]>([]);
  const [movementDateRange, setMovementDateRange] = useState<DateRangeValue>(() => {
    const dates = calculatePresetDates('LAST_7_DAYS');
    return {
      preset: 'LAST_7_DAYS',
      fromDate: dates.fromDate,
      toDate: dates.toDate,
    };
  });
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [isProductSuggestionsOpen, setIsProductSuggestionsOpen] = useState<boolean>(false);
  const movementSearchContainerRef = useRef<HTMLDivElement>(null);
  const [movementPage, setMovementPage] = useState<number>(1);
  const [movementPageSize, setMovementPageSize] = useState<number>(25);
  const [movementTotal, setMovementTotal] = useState<number>(0);

  // Add / Edit Modal UI Optimization State
  const [isImagesSectionOpen, setIsImagesSectionOpen] = useState<boolean>(false);
  const [activeModalBranchId, setActiveModalBranchId] = useState<string>('');

  // Modal layout auto-scroll & section refs
  const addModalBodyRef = useRef<HTMLDivElement>(null);
  const imagesSectionRef = useRef<HTMLDivElement>(null);
  const discountSectionRef = useRef<HTMLDivElement>(null);

  const ensureElementVisible = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    setTimeout(() => {
      if (!element) return;
      const modalBody = addModalBodyRef.current || (element.closest('.modal-body') as HTMLElement | null);
      if (modalBody) {
        modalBody.scrollTo({
          top: modalBody.scrollHeight,
          behavior: 'smooth'
        });
      }
      try {
        element.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } catch (_) {}
    }, 60);
  }, []);

  useEffect(() => {
    if (isImagesSectionOpen && imagesSectionRef.current) {
      ensureElementVisible(imagesSectionRef.current);
    }
  }, [isImagesSectionOpen, ensureElementVisible]);



  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Close product search suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (movementSearchContainerRef.current && !movementSearchContainerRef.current.contains(event.target as Node)) {
        setIsProductSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Product suggestions computed from store catalog
  const movementProductSuggestions = useMemo(() => {
    if (!movementSearchQuery || !movementSearchQuery.trim()) return [];
    const q = movementSearchQuery.trim().toLowerCase();
    return rawItems.filter(item => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.barcode && item.barcode.toLowerCase().includes(q)) ||
      (item.publicItemId && item.publicItemId.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [movementSearchQuery, rawItems]);

  // Reset page when search or category filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategories, selectedLocationId]);

  // Close Category Dropdown on Outside Click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form State for Add / Edit Item
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState('Grocery');
  const [formTaxRate, setFormTaxRate] = useState<number>(5);
  const [formUnit, setFormUnit] = useState('pcs');
  const [formAllowParts, setFormAllowParts] = useState(false);
  const [formDescription, setFormDescription] = useState('');

  // Location-specific overrides state in form
  const [locationOverrides, setLocationOverrides] = useState<Record<string, ItemLocationInventory>>({});

  // Item Images & Gallery State
  const [formImages, setFormImages] = useState<FormImageItem[]>([]);
  const [pendingDeletedImageUrls, setPendingDeletedImageUrls] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingImage(true);
    setUploadStatusMsg(`Compressing ${files.length} image(s)...`);

    const newStagedImages: FormImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setUploadStatusMsg(`Compressing ${file.name} (Step 1)...`);
        const compressed = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.82 });

        const currentIndex = formImages.length + newStagedImages.length;
        const tempId = `staged_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

        newStagedImages.push({
          id: tempId,
          url: compressed.dataUrl, // Local in-memory preview with zero network calls
          order: currentIndex,
          isPrimary: formImages.length === 0 && newStagedImages.length === 0,
          name: file.name,
          sizeBytes: compressed.compressedSizeBytes,
          originalSizeBytes: compressed.originalSizeBytes,
          pendingCompressed: compressed, // Staged locally in memory until Save Product is clicked
        });
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }

    setFormImages(prev => {
      const combined = [...prev, ...newStagedImages];
      return combined.map((img, idx) => ({
        ...img,
        order: idx,
        isPrimary: prev.some(p => p.isPrimary) ? img.isPrimary : idx === 0,
      }));
    });

    setIsUploadingImage(false);
    setUploadStatusMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (newStagedImages.length > 0) {
      setIsImagesSectionOpen(true);
      ensureElementVisible(imagesSectionRef.current);
    }
  };

  const moveImage = (index: number, direction: 'LEFT' | 'RIGHT') => {
    const targetIndex = direction === 'LEFT' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formImages.length) return;

    const newArr = [...formImages];
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;

    setFormImages(newArr.map((img, idx) => ({ ...img, order: idx })));
  };

  const setPrimaryImage = (index: number) => {
    setFormImages(formImages.map((img, idx) => ({
      ...img,
      isPrimary: idx === index,
    })));
  };

  const deleteImage = (index: number) => {
    const toRemove = formImages[index];
    // If the image was already persisted remotely (no pendingCompressed), stage for remote deletion upon save
    if (toRemove && toRemove.url && !toRemove.pendingCompressed) {
      setPendingDeletedImageUrls(prev => [...prev, toRemove.url]);
    }
    // If it was just staged locally in this modal session, simply discard from state without any network call
    const filtered = formImages.filter((_, idx) => idx !== index);
    const updated = filtered.map((img, idx) => ({
      ...img,
      order: idx,
      isPrimary: img.isPrimary ? true : (filtered.length > 0 && !filtered.some(f => f.isPrimary) && idx === 0),
    }));
    setFormImages(updated);
  };

  const refreshData = () => {
    const currentLocId = store.getActiveLocation().id;
    // getItems for current branch including unlisted so inventory managers can manage them
    const branchItems = store.getItems(currentLocId, true);
    setItems(branchItems);
    setRawItems(store.getRawItems());
    setCategoriesList(store.getCategories());
    if (selectedLocationId !== currentLocId) {
      setSelectedLocationId(currentLocId);
    }
  };

  const loadPaginatedItems = useCallback(async (
    page: number = currentPage,
    size: number = pageSize,
    locId: string = selectedLocationId,
    search: string = debouncedSearch,
    cats: string[] = selectedCategories
  ) => {
    try {
      const catParam = cats.length > 0 ? cats.join(',') : undefined;
      const res = await store.fetchItemsPaginated({
        page,
        pageSize: size,
        search: search.trim() || undefined,
        category: catParam,
        locationId: locId,
      });
      setItems(res.data);
      setTotalItems(res.total);
      setRawItems(store.getRawItems());
    } catch (e) {
      console.error('Error fetching paginated items:', e);
      const all = store.getItems(locId, true);
      setItems(all.slice((page - 1) * size, page * size));
      setTotalItems(all.length);
    }
  }, [currentPage, pageSize, selectedLocationId, debouncedSearch, selectedCategories]);

  const addMovementKeyword = (keyword: string) => {
    const clean = keyword.trim();
    if (!clean) return;
    if (!movementKeywords.includes(clean)) {
      setMovementKeywords(prev => [...prev, clean]);
    }
    setMovementSearchQuery('');
    setIsProductSuggestionsOpen(false);
    setMovementPage(1);
  };

  const removeMovementKeyword = (keyword: string) => {
    setMovementKeywords(prev => prev.filter(k => k !== keyword));
    setMovementPage(1);
  };

  const clearAllMovementFilters = () => {
    setMovementKeywords([]);
    setMovementSearchQuery('');
    setMovementTypeFilter('ALL');
    setMovementLocationFilter('ALL');
    setMovementDateRange({ preset: 'ALL', fromDate: '', toDate: '' });
    setMovementPage(1);
  };

  const handleApplyMovementFilter = (overrideSearch?: string) => {
    if (overrideSearch && overrideSearch.trim()) {
      addMovementKeyword(overrideSearch);
      return;
    }
    if (movementSearchQuery.trim()) {
      addMovementKeyword(movementSearchQuery);
      return;
    }
    setIsProductSuggestionsOpen(false);
    setMovementPage(1);
  };

  const loadMovements = useCallback(async (
    page: number = movementPage,
    size: number = movementPageSize,
    type: string = movementTypeFilter,
    locId: string = movementLocationFilter,
    keywords: string[] = movementKeywords,
    fromDate: string = movementDateRange.fromDate,
    toDate: string = movementDateRange.toDate
  ) => {
    setIsMovementsLoading(true);
    try {
      const searchParam = keywords.length > 0 ? keywords.join(',') : undefined;
      const res = await store.fetchInventoryMovements({
        page,
        pageSize: size,
        type: type !== 'ALL' ? type : undefined,
        locationId: locId !== 'ALL' ? locId : undefined,
        search: searchParam,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setMovements(res.data);
      setMovementTotal(res.total);
    } catch (err) {
      console.error('Error fetching inventory movements:', err);
    } finally {
      setIsMovementsLoading(false);
    }
  }, [movementPage, movementPageSize, movementTypeFilter, movementLocationFilter, movementKeywords, movementDateRange.fromDate, movementDateRange.toDate]);

  useEffect(() => {
    if (activeMainTab === 'LEDGER') {
      loadMovements(movementPage, movementPageSize, movementTypeFilter, movementLocationFilter, movementKeywords, movementDateRange.fromDate, movementDateRange.toDate);
    }
  }, [activeMainTab, movementPage, movementPageSize, movementTypeFilter, movementLocationFilter, movementKeywords, movementDateRange.fromDate, movementDateRange.toDate, loadMovements]);

  const viewItemMovementLedger = (targetItem: Item) => {
    setActiveMainTab('LEDGER');
    const term = targetItem.name || targetItem.sku || targetItem.publicItemId;
    setMovementKeywords(term ? [term] : []);
    setMovementSearchQuery('');
    setIsProductSuggestionsOpen(false);
    setMovementTypeFilter('ALL');
    setMovementLocationFilter('ALL');
    setMovementDateRange({ preset: 'ALL', fromDate: '', toDate: '' });
    setMovementPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportMovementsToCsv = () => {
    if (movements.length === 0) return;
    const headers = ['Date & Time', 'Product Name', 'SKU', 'Public ID', 'Location', 'Movement Type', 'Reference Type', 'Reference Number', 'Qty Change', 'Stock Before', 'Stock After', 'Unit Cost (INR)', 'Total Valuation (INR)', 'Actor', 'Reason', 'Notes'];
    const rows = movements.map(m => [
      `"${m.createdAt}"`,
      `"${(m.itemName || '').replace(/"/g, '""')}"`,
      `"${m.sku || ''}"`,
      `"${m.publicItemId || ''}"`,
      `"${m.locationName || 'Branch'}"`,
      `"${m.type}"`,
      `"${m.referenceType || ''}"`,
      `"${m.referenceNumber || ''}"`,
      m.quantityChange,
      m.quantityBefore,
      m.quantityAfter,
      m.unitCost,
      m.totalCost || (Math.abs(m.quantityChange) * m.unitCost),
      `"${m.createdByName || 'Staff'}"`,
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Inventory_Stock_Movements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    loadPaginatedItems(currentPage, pageSize, selectedLocationId, debouncedSearch, selectedCategories);
  }, [currentPage, pageSize, selectedLocationId, debouncedSearch, selectedCategories, loadPaginatedItems]);

  useEffect(() => {
    store.fetchCategories().then(() => {
      setCategoriesList(store.getCategories());
    }).catch(() => {});
    setCategoriesList(store.getCategories());

    const interval = setInterval(() => {
      const currentLocId = store.getActiveLocation().id;
      if (currentLocId !== selectedLocationId) {
        setSelectedLocationId(currentLocId);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [selectedLocationId]);

  const activeLocation = locations.find(l => l.id === selectedLocationId) || locations[0] || store.getActiveLocation();

  const availableCategories = Array.from(new Set([
    ...categoriesList.map(c => c.name).filter(Boolean),
    ...rawItems.map(i => i.category).filter(Boolean),
  ]));

  const toggleCategoryFilter = (catName: string) => {
    if (catName === 'ALL') {
      setSelectedCategories([]);
      return;
    }
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    await store.addCategory({
      name: newCatName.trim(),
      description: newCatDesc.trim() || undefined,
    });
    setNewCatName('');
    setNewCatDesc('');
    setCategoriesList(store.getCategories());
    refreshData();
  };

  const handleStartEditCat = (cat: ItemCategory) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatDesc(cat.description || '');
  };

  const handleCancelEditCat = () => {
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatDesc('');
  };

  const handleSaveEditCat = async (catId: string) => {
    if (!editingCatName.trim()) return;
    await store.updateCategory(catId, {
      name: editingCatName.trim(),
      description: editingCatDesc.trim() || undefined,
    });
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatDesc('');
    setCategoriesList(store.getCategories());
    refreshData();
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    const usageCount = rawItems.filter(i => (i.category || '').toLowerCase() === (catName || '').toLowerCase()).length;
    const confirmMsg = usageCount > 0
      ? `Category "${catName}" is currently used by ${usageCount} product(s). Are you sure you want to delete it?`
      : `Delete category "${catName}"?`;

    if (window.confirm(confirmMsg)) {
      await store.deleteCategory(catId);
      setCategoriesList(store.getCategories());
      refreshData();
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormSku('');
    setFormBarcode('');
    setFormCategory(categoriesList[0]?.name || 'Grocery');
    setFormTaxRate(5);
    setFormUnit('pcs');
    setFormAllowParts(false);
    setFormDescription('');
    setFormImages([]);
    setPendingDeletedImageUrls([]);
    setUploadStatusMsg('');

    // Default overrides for every branch
    const initialOverrides: Record<string, ItemLocationInventory> = {};
    locations.forEach(loc => {
      initialOverrides[loc.id] = {
        locationId: loc.id,
        locationName: loc.name,
        mrp: 100,
        salePrice: 100,
        purchasePrice: 80,
        currentStock: 10,
        minStockAlert: 5,
        isListed: true,
        hasDiscount: false,
        discountType: 'PERCENT',
        discountValue: 0,
      };
    });
    setLocationOverrides(initialOverrides);
    setInitialSnapshot('');
    setIsImagesSectionOpen(false);
    setActiveModalBranchId(selectedLocationId !== 'ALL' ? selectedLocationId : (locations[0]?.id || ''));
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    const raw = rawItems.find(r => r.id === item.id) || item;
    setEditingItem(raw);
    setFormName(raw.name || '');
    setFormSku(raw.sku || '');
    setFormBarcode(raw.barcode || '');
    setFormCategory(raw.category || categoriesList[0]?.name || 'Grocery');
    setFormTaxRate(Number(raw.taxRate ?? 5));
    setFormUnit(raw.unit || 'pcs');
    setFormAllowParts(!!raw.allowParts);
    setFormDescription(raw.description || '');
    setPendingDeletedImageUrls([]);
    setUploadStatusMsg('');

    // Load existing images ordered by order index
    let loadedImages: FormImageItem[] = [];
    if (raw.images && raw.images.length > 0) {
      loadedImages = [...raw.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } else if (raw.imageUrl) {
      loadedImages = [{
        id: 'img_0',
        url: raw.imageUrl,
        order: 0,
        isPrimary: true,
        name: 'Cover Image',
      }];
    }
    setFormImages(loadedImages);

    // Map existing locations or fallback
    const initialOverrides: Record<string, ItemLocationInventory> = {};
    locations.forEach(loc => {
      const existing = raw.locations?.find(l => l.locationId === loc.id);
      if (existing) {
        initialOverrides[loc.id] = { 
          locationId: loc.id,
          locationName: loc.name,
          mrp: Number(existing.mrp ?? existing.salePrice ?? raw.mrp ?? raw.salePrice ?? 100),
          salePrice: Number(existing.salePrice ?? raw.salePrice ?? 100),
          purchasePrice: Number(existing.purchasePrice ?? raw.purchasePrice ?? 80),
          currentStock: Number(existing.currentStock ?? 0),
          minStockAlert: Number(existing.minStockAlert ?? raw.minStockAlert ?? 5),
          isListed: existing.isListed !== false,
          hasDiscount: !!existing.hasDiscount,
          discountType: (existing.discountType as 'PERCENT' | 'FLAT') || 'PERCENT',
          discountValue: Number(existing.discountValue || 0),
        };
      } else {
        initialOverrides[loc.id] = {
          locationId: loc.id,
          locationName: loc.name,
          mrp: Number(raw.mrp ?? raw.salePrice ?? 100),
          salePrice: Number(raw.salePrice ?? 100),
          purchasePrice: Number(raw.purchasePrice ?? 80),
          currentStock: 0,
          minStockAlert: Number(raw.minStockAlert ?? 5),
          isListed: true,
          hasDiscount: false,
          discountType: 'PERCENT',
          discountValue: 0,
        };
      }
    });
    setLocationOverrides(initialOverrides);

    const snapshot = JSON.stringify({
      name: (raw.name || '').trim(),
      sku: (raw.sku || '').trim(),
      barcode: (raw.barcode || '').trim(),
      category: (raw.category || categoriesList[0]?.name || 'Grocery').trim(),
      taxRate: Number(raw.taxRate ?? 5),
      unit: raw.unit || 'pcs',
      allowParts: !!raw.allowParts,
      description: (raw.description || '').trim(),
      images: loadedImages.map(img => ({ id: img.id, url: img.url, order: img.order, isPrimary: img.isPrimary, hasPending: false })),
      locationOverrides: initialOverrides,
    });
    setInitialSnapshot(snapshot);
    setIsImagesSectionOpen(loadedImages.length > 0);
    setActiveModalBranchId(selectedLocationId !== 'ALL' ? selectedLocationId : (locations[0]?.id || ''));
    setIsAddModalOpen(true);
  };

  const calculateEffectiveSalePrice = (locInv?: Partial<ItemLocationInventory> | null): number => {
    if (!locInv) return 0;
    const baseMrp = parseFloat(String(locInv.mrp || 0)) || 0;
    if (!locInv.hasDiscount || !locInv.discountValue || parseFloat(String(locInv.discountValue)) <= 0) {
      return baseMrp;
    }
    const discVal = parseFloat(String(locInv.discountValue)) || 0;
    if (locInv.discountType === 'PERCENT') {
      const disc = (baseMrp * discVal) / 100;
      return Math.max(0, Number((baseMrp - disc).toFixed(2)));
    } else {
      return Math.max(0, Number((baseMrp - discVal).toFixed(2)));
    }
  };

  // Determine if changes have been made to the product in the edit modal
  const hasChanges = useMemo(() => {
    if (!editingItem) return true;
    if (!initialSnapshot) return false;
    const current = JSON.stringify({
      name: formName.trim(),
      sku: formSku.trim(),
      barcode: formBarcode.trim(),
      category: formCategory.trim(),
      taxRate: Number(formTaxRate || 0),
      unit: formUnit || 'pcs',
      allowParts: !!formAllowParts,
      description: formDescription.trim(),
      images: formImages.map(img => ({
        id: img.id,
        url: img.url,
        order: img.order,
        isPrimary: img.isPrimary,
        hasPending: !!img.pendingCompressed,
      })),
      locationOverrides,
    });
    return current !== initialSnapshot;
  }, [
    editingItem,
    initialSnapshot,
    formName,
    formSku,
    formBarcode,
    formCategory,
    formTaxRate,
    formUnit,
    formAllowParts,
    formDescription,
    formImages,
    locationOverrides,
  ]);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isSaving) return;

    setIsSaving(true);
    setUploadStatusMsg('Saving product and processing images...');

    try {
      const businessId = currentUser?.businessId || '';
      const itemId = editingItem?.id || `itm_${Date.now()}`;

      // 1. Upload newly staged images (only those with pendingCompressed) to Supabase Storage
      const finalImages: ItemImage[] = [];
      const sortedFormImages = [...formImages].sort((a, b) => a.order - b.order);

      for (let i = 0; i < sortedFormImages.length; i++) {
        const img = sortedFormImages[i];
        if (img.pendingCompressed) {
          setUploadStatusMsg(`Uploading image #${i + 1} to storage...`);
          const uploadRes = await uploadItemImage(businessId, itemId, img.pendingCompressed, i);
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
          // Already uploaded remotely, update order and primary designation
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

      // Ensure at least one image is marked primary if images exist
      if (finalImages.length > 0 && !finalImages.some(img => img.isPrimary)) {
        finalImages[0].isPrimary = true;
      }

      const primaryImg = finalImages.find(img => img.isPrimary) || finalImages[0];
      const primaryImageUrl = primaryImg ? primaryImg.url : undefined;

      const locArray: ItemLocationInventory[] = Object.values(locationOverrides).map(loc => ({
        locationId: loc.locationId,
        locationName: loc.locationName,
        mrp: parseFloat(String(loc.mrp)) || 0,
        salePrice: calculateEffectiveSalePrice(loc),
        purchasePrice: parseFloat(String(loc.purchasePrice)) || 0,
        currentStock: parseFloat(String(loc.currentStock)) || 0,
        minStockAlert: parseFloat(String(loc.minStockAlert)) || 5,
        isListed: loc.isListed !== false,
        hasDiscount: !!loc.hasDiscount,
        discountType: loc.discountType || 'PERCENT',
        discountValue: parseFloat(String(loc.discountValue)) || 0,
      }));

      // Master fallback defaults
      const currentLocInv = locationOverrides[selectedLocationId] || locArray[0];
      const masterMrp = currentLocInv ? Number(currentLocInv.mrp || 100) : 100;
      const masterSalePrice = currentLocInv ? calculateEffectiveSalePrice(currentLocInv) : 100;
      const masterPurchasePrice = currentLocInv ? Number(currentLocInv.purchasePrice || 80) : 80;
      const masterStock = currentLocInv ? Number(currentLocInv.currentStock || 0) : 0;
      const masterMinAlert = currentLocInv ? Number(currentLocInv.minStockAlert ?? 5) : 5;

      if (editingItem) {
        await store.updateItem(editingItem.id, {
          name: formName.trim(),
          sku: formSku.trim() || undefined,
          barcode: formBarcode.trim() || undefined,
          category: formCategory.trim() || 'General',
          taxRate: Number(formTaxRate || 0),
          unit: formUnit || 'pcs',
          allowParts: !!formAllowParts,
          description: formDescription.trim() || undefined,
          mrp: masterMrp,
          salePrice: masterSalePrice,
          purchasePrice: masterPurchasePrice,
          currentStock: masterStock,
          minStockAlert: masterMinAlert,
          locations: locArray,
          images: finalImages,
          imageUrl: primaryImageUrl,
        });
      } else {
        await store.addItem({
          name: formName.trim(),
          sku: formSku.trim() || undefined,
          barcode: formBarcode.trim() || undefined,
          category: formCategory.trim() || 'General',
          taxRate: Number(formTaxRate || 0),
          unit: formUnit || 'pcs',
          allowParts: !!formAllowParts,
          description: formDescription.trim() || undefined,
          mrp: masterMrp,
          salePrice: masterSalePrice,
          purchasePrice: masterPurchasePrice,
          currentStock: masterStock,
          minStockAlert: masterMinAlert,
          locations: locArray,
          images: finalImages,
          imageUrl: primaryImageUrl,
        });
      }

      // 2. Purge removed images from Supabase storage ONLY upon confirming and saving product
      if (pendingDeletedImageUrls.length > 0) {
        deleteItemImages(businessId, pendingDeletedImageUrls);
        setPendingDeletedImageUrls([]);
      }

      await loadPaginatedItems();
      refreshData();
      setIsAddModalOpen(false);
      setEditingItem(null);
      setFormImages([]);
      setPendingDeletedImageUrls([]);
    } catch (err) {
      console.error('Error saving item and uploading images:', err);
    } finally {
      setIsSaving(false);
      setUploadStatusMsg('');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;
    const numDelta = parseFloat(String(adjustDelta)) || 0;
    const delta = adjustType === 'ADD' ? Math.abs(numDelta) : -Math.abs(numDelta);
    const customCost = adjustType === 'ADD' && adjustUnitCost !== '' ? parseFloat(String(adjustUnitCost)) : undefined;

    await store.adjustStock(
      selectedItemForAdjust.id,
      delta,
      adjustLocationId,
      customCost,
      adjustReason,
      adjustNotes.trim() || undefined
    );
    await loadPaginatedItems();
    refreshData();
    setIsAdjustModalOpen(false);
    setSelectedItemForAdjust(null);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete product "${name}"?`)) {
      const itemToDelete = rawItems.find(r => r.id === id) || items.find(i => i.id === id);
      if (itemToDelete) {
        const urlsToDelete: string[] = [];
        if (itemToDelete.images && itemToDelete.images.length > 0) {
          urlsToDelete.push(...itemToDelete.images.map(img => img.url));
        } else if (itemToDelete.imageUrl) {
          urlsToDelete.push(itemToDelete.imageUrl);
        }
        if (urlsToDelete.length > 0) {
          const businessId = currentUser?.businessId || '';
          deleteItemImages(businessId, urlsToDelete);
        }
      }

      await store.deleteItem(id);
      await loadPaginatedItems();
      refreshData();
    }
  };

  return (
    <div className="page-container" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
            Item Catalog & Inventory
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', margin: '3px 0 0 0' }}>
            Manage master items, branch MRP, discounts, selling prices, stock levels, and QR barcodes.
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsSyncModalOpen(true)}
              title="Synchronize and configure catalog items for active branch"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary-700)', fontWeight: 600 }}
            >
              <Boxes size={16} color="var(--primary-600)" />
              <span>Sync Branch Items</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(true)}>
              <Layers size={16} />
              <span>Categories</span>
            </button>
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} />
              <span>Add New Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tab Switcher */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid var(--neutral-200)', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveMainTab('PRODUCTS')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeMainTab === 'PRODUCTS' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeMainTab === 'PRODUCTS' ? 'var(--primary-700)' : 'var(--neutral-600)',
            fontWeight: activeMainTab === 'PRODUCTS' ? 800 : 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease'
          }}
        >
          <Package size={16} color={activeMainTab === 'PRODUCTS' ? 'var(--primary-600)' : 'var(--neutral-400)'} />
          <span>Products Catalog ({totalItems || items.length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveMainTab('LEDGER');
            loadMovements(1);
          }}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeMainTab === 'LEDGER' ? '3px solid var(--primary-600)' : '3px solid transparent',
            color: activeMainTab === 'LEDGER' ? 'var(--primary-700)' : 'var(--neutral-600)',
            fontWeight: activeMainTab === 'LEDGER' ? 800 : 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease'
          }}
        >
          <History size={16} color={activeMainTab === 'LEDGER' ? 'var(--primary-600)' : 'var(--neutral-400)'} />
          <span>Stock Movement Ledger & Audit Trail</span>
        </button>
      </div>

      {activeMainTab === 'PRODUCTS' && (
        <>
          {/* Filters Card */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 16, overflow: 'visible', position: 'relative', zIndex: 5 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              {/* Main Product Search Bar */}
              <div style={{ position: 'relative', flex: '1 1 300px', minWidth: 240 }}>
                <Search size={17} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
                <input
                  type="text"
                  placeholder="Search by name, SKU, QR barcode, or public ID..."
                  className="form-input"
                  style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 9,
                  background: 'none',
                  border: 'none',
                  color: 'var(--neutral-400)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '2px 6px',
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Filter Actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            {/* Multi-Select Category Dropdown */}
            <div style={{ position: 'relative' }} ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCategoryDropdownOpen(prev => !prev);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${selectedCategories.length > 0 ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                  backgroundColor: selectedCategories.length > 0 ? 'var(--primary-50)' : '#ffffff',
                  color: selectedCategories.length > 0 ? 'var(--primary-700)' : 'var(--neutral-700)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: 'var(--shadow-sm)',
                  minWidth: 160,
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={14} color={selectedCategories.length > 0 ? 'var(--primary-600)' : 'var(--neutral-500)'} />
                  <span>
                    {selectedCategories.length === 0
                      ? 'All Categories'
                      : selectedCategories.length === 1
                      ? selectedCategories[0]
                      : `${selectedCategories.length} Categories`}
                  </span>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {selectedCategories.length > 0 && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 18,
                      height: 18,
                      padding: '0 4px',
                      borderRadius: 9,
                      backgroundColor: 'var(--primary-600)',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                    }}>
                      {selectedCategories.length}
                    </span>
                  )}
                  <ChevronDown size={14} style={{ transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </button>

              {/* Dropdown Menu Popover */}
              {isCategoryDropdownOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 1000,
                    width: 300,
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-lg, 8px)',
                    border: '1px solid var(--neutral-200)',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.06)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Search inside Category Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--neutral-400)' }} />
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', paddingLeft: 26, paddingRight: 24, paddingTop: 5, paddingBottom: 5, fontSize: '0.78rem', boxSizing: 'border-box' }}
                    />
                    {dropdownSearch && (
                      <button
                        type="button"
                        onClick={() => setDropdownSearch('')}
                        style={{
                          position: 'absolute',
                          right: 6,
                          top: 5,
                          background: 'none',
                          border: 'none',
                          color: 'var(--neutral-400)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Header Actions: Show All / Select All */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid var(--neutral-100)' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.75rem',
                        color: selectedCategories.length === 0 ? 'var(--primary-600)' : 'var(--neutral-500)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      Clear / Show All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(availableCategories)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.75rem',
                        color: 'var(--primary-600)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      Select All ({availableCategories.length})
                    </button>
                  </div>

                  {/* Checkbox Category Items */}
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {availableCategories
                      .filter(cat => cat.toLowerCase().includes(dropdownSearch.toLowerCase()))
                      .map(cat => {
                        const isChecked = selectedCategories.includes(cat);
                        const count = rawItems.filter(i => i.category.toLowerCase() === cat.toLowerCase()).length;
                        return (
                          <div
                            key={cat}
                            onClick={() => toggleCategoryFilter(cat)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              borderRadius: 'var(--radius-sm, 6px)',
                              backgroundColor: isChecked ? 'var(--primary-50)' : '#ffffff',
                              border: `1px solid ${isChecked ? 'var(--primary-200)' : 'transparent'}`,
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              color: isChecked ? 'var(--primary-800)' : 'var(--neutral-800)',
                              fontWeight: isChecked ? 700 : 500,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Handled by outer div onClick
                                style={{ cursor: 'pointer', pointerEvents: 'none' }}
                              />
                              <span>{cat}</span>
                            </div>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: 10,
                              backgroundColor: isChecked ? 'var(--primary-100)' : 'var(--neutral-100)',
                              color: isChecked ? 'var(--primary-700)' : 'var(--neutral-500)',
                              fontWeight: 700,
                            }}>
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    {availableCategories.filter(cat => cat.toLowerCase().includes(dropdownSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--neutral-400)', fontSize: '0.78rem' }}>
                        No categories found matching "{dropdownSearch}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Filters Button if any selected */}
            {selectedCategories.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: '1px dashed var(--danger-300, #fca5a5)',
                  backgroundColor: 'var(--danger-50, #fef2f2)',
                  color: 'var(--danger-600, #dc2626)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Clear category filter"
              >
                Clear Filters ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '85px', padding: '10px 12px' }}>Code</th>
                <th style={{ padding: '10px 12px' }}>Product Name</th>
                <th style={{ width: '100px', padding: '10px 12px' }}>Category</th>
                <th style={{ width: '120px', padding: '10px 12px' }}>MRP</th>
                <th style={{ width: '110px', padding: '10px 12px' }}>Purchase Cost</th>
                <th style={{ width: '70px', padding: '10px 12px' }}>GST</th>
                <th style={{ width: '100px', padding: '10px 12px' }}>Stock</th>
                <th style={{ width: '95px', padding: '10px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '150px', padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const raw = rawItems.find(r => r.id === item.id) || item;
                const branchInv = raw.locations?.find(l => l.locationId === selectedLocationId);
                const isListed = branchInv ? branchInv.isListed !== false : true;

                const mrp = branchInv?.mrp ?? item.mrp ?? item.salePrice;
                const effectiveSalePrice = branchInv?.salePrice !== undefined ? Number(branchInv.salePrice) : Number(item.salePrice || 0);
                const hasDiscount = branchInv?.hasDiscount && (branchInv?.discountValue || 0) > 0;
                const discountText = branchInv?.discountType === 'PERCENT'
                  ? `${branchInv.discountValue}% OFF`
                  : `₹${branchInv?.discountValue} OFF`;

                const isConsolidated = !selectedLocationId || selectedLocationId === 'ALL';
                const effectiveStock = isConsolidated
                  ? (raw.locations && raw.locations.length > 0
                      ? raw.locations.reduce((sum, l) => sum + (Number(l.currentStock) || 0), 0)
                      : Number(item.currentStock || 0))
                  : (branchInv && branchInv.currentStock !== undefined
                      ? Number(branchInv.currentStock || 0)
                      : Number(item.currentStock || 0));

                const effectivePurchasePrice = (!isConsolidated && branchInv?.purchasePrice !== undefined && branchInv?.purchasePrice !== null)
                  ? Number(branchInv.purchasePrice)
                  : Number(item.purchasePrice || 0);

                const effectiveMinStock = isConsolidated
                  ? Number(item.minStockAlert ?? 5)
                  : (branchInv && branchInv.minStockAlert !== undefined
                      ? Number(branchInv.minStockAlert)
                      : Number(item.minStockAlert ?? 5));

                const stockStatus = 
                  effectiveStock === 0 ? 'OUT_OF_STOCK' : (effectiveStock <= effectiveMinStock ? 'LOW_STOCK' : 'IN_STOCK');

                return (
                  <tr key={item.id} style={{ opacity: isListed ? 1 : 0.6 }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.78rem', padding: '10px 12px' }}>
                      {item.publicItemId}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          backgroundColor: 'var(--neutral-100)',
                          border: '1px solid var(--neutral-200)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {item.imageUrl || (item.images && item.images.length > 0 && item.images[0].url) ? (
                            <img
                              src={item.imageUrl || item.images![0].url}
                              alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Package size={17} color="var(--neutral-400)" />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.88rem' }}>{item.name}</span>
                            {raw.allowParts && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 4, backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontWeight: 700, border: '1px solid var(--primary-200)', whiteSpace: 'nowrap' }}>
                                ⚖️ Parts Allowed
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            {item.sku && <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>SKU: {item.sku}</span>}
                            {item.barcode && <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>BAR: {item.barcode}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ backgroundColor: 'var(--neutral-100)', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}>
                        {item.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary-600)' }}>
                          ₹{Number(effectiveSalePrice).toFixed(2)}
                        </span>
                        {hasDiscount ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <del style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>₹{Number(mrp || 0).toFixed(2)}</del>
                            <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: 3, background: 'var(--success-50)', color: 'var(--success-700)', fontWeight: 700 }}>
                              {discountText}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                            MRP ₹{Number(mrp || 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--neutral-600)', fontSize: '0.85rem', padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>₹{effectivePurchasePrice.toFixed(2)}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem', padding: '10px 12px' }}>{Number(item.taxRate || 0)}%</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: stockStatus === 'OUT_OF_STOCK' ? 'var(--danger-600)' : 'var(--neutral-900)' }}>
                        {effectiveStock} {item.unit || 'pcs'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)', marginLeft: 3 }}>
                        (Min: {effectiveMinStock})
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isListed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 600, color: 'var(--success-700)' }}>
                          <CheckCircle2 size={12} />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontWeight: 600, color: 'var(--neutral-400)' }}>
                          <XCircle size={12} />
                          <span>Unlisted</span>
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="View Stock Movement Audit Trail in Ledger"
                          onClick={() => viewItemMovementLedger(item)}
                          style={{ padding: 5 }}
                        >
                          <History size={14} color="var(--primary-600)" />
                        </button>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="Barcode & QR Studio / Print Labels"
                          onClick={() => setCodeStudioTarget(item)}
                          style={{ padding: 5 }}
                        >
                          <QrCode size={14} color="var(--primary-600)" />
                        </button>
                        {canManage && (
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Edit Product & Branch Settings"
                            onClick={() => openEditModal(item)}
                            style={{ padding: 5 }}
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="Adjust Branch Stock Quantity"
                          onClick={() => openStockAdjustment(item)}
                          style={{ padding: 5 }}
                        >
                          <SlidersHorizontal size={14} />
                        </button>
                        {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TENANT_ADMIN') && (
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Delete Item"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            style={{ color: 'var(--danger-500)', padding: 5 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="products"
        />
      </div>
      </>
      )}

      {/* Stock Movement Ledger & Audit Trail Tab */}
      {activeMainTab === 'LEDGER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Movement KPI Summary Cards */}
          {(() => {
            let totalIn = 0;
            let totalOut = 0;
            movements.forEach(m => {
              if (m.quantityChange > 0) totalIn += m.quantityChange;
              else totalOut += Math.abs(m.quantityChange);
            });
            const netShift = totalIn - totalOut;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div className="card" style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>
                    Total Movement Logs
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    {movementTotal}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={14} /> Total Inward Volume
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065f46', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    +{totalIn.toFixed(2)}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px 16px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingDown size={14} /> Total Outward Volume
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e40af', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    -{totalOut.toFixed(2)}
                  </div>
                </div>

                <div className="card" style={{ padding: '14px 16px', background: netShift >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${netShift >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: netShift >= 0 ? '#15803d' : '#b91c1c', textTransform: 'uppercase' }}>
                    Net Stock Shift
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: netShift >= 0 ? '#15803d' : '#b91c1c', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    {netShift >= 0 ? `+${netShift.toFixed(2)}` : netShift.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Movements Filters Card */}
          <div className="card" style={{ padding: '12px 16px', overflow: 'visible', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Line 1: All Primary Controls in a Single Row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              {/* Product Search with Multi-Item Autocomplete */}
              <div ref={movementSearchContainerRef} style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--neutral-400)' }} />
                <input
                  type="text"
                  placeholder="Search & select multiple items / SKUs / keywords..."
                  className="form-input"
                  style={{ paddingLeft: 32, paddingRight: movementSearchQuery ? 28 : 10, height: 35, fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }}
                  value={movementSearchQuery}
                  onChange={(e) => {
                    setMovementSearchQuery(e.target.value);
                    setIsProductSuggestionsOpen(true);
                  }}
                  onFocus={() => {
                    if (movementSearchQuery.trim()) {
                      setIsProductSuggestionsOpen(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyMovementFilter();
                    }
                  }}
                />
                {movementSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMovementSearchQuery('')}
                    style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer', fontSize: '0.85rem' }}
                    title="Clear input"
                  >
                    ✕
                  </button>
                )}

                {/* Autocomplete Dropdown with Multi-Selection Support */}
                {isProductSuggestionsOpen && movementProductSuggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1px solid var(--neutral-200)',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.14), 0 4px 10px rgba(0, 0, 0, 0.06)',
                      maxHeight: 280,
                      overflowY: 'auto',
                      zIndex: 1100,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Click to Select Multiple Items
                    </div>
                    {movementProductSuggestions.map(item => {
                      const isAlreadySelected = movementKeywords.includes(item.name) || (item.sku && movementKeywords.includes(item.sku));
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            addMovementKeyword(item.name);
                          }}
                          style={{
                            padding: '7px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            background: isAlreadySelected ? 'var(--primary-50)' : 'transparent',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isAlreadySelected) e.currentTarget.style.background = 'var(--neutral-100)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isAlreadySelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: isAlreadySelected ? 'var(--primary-800)' : 'var(--neutral-900)' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', display: 'flex', gap: 6, alignItems: 'center' }}>
                              {item.sku && <span style={{ fontFamily: 'var(--font-mono)' }}>SKU: {item.sku}</span>}
                              {item.category && <span>&bull; {item.category}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: Number(item.currentStock || 0) > 0 ? '#ecfdf5' : '#fef2f2', color: Number(item.currentStock || 0) > 0 ? '#047857' : '#b91c1c' }}>
                              {Number(item.currentStock || 0).toFixed(item.allowParts ? 3 : 0)} {item.unit || 'pcs'}
                            </span>
                            {isAlreadySelected ? (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary-600)', background: 'var(--primary-100)', padding: '2px 6px', borderRadius: 4 }}>
                                ✓ Added
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-600)', background: 'var(--neutral-100)', padding: '2px 6px', borderRadius: 4 }}>
                                + Add
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add / Search Button */}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleApplyMovementFilter()}
                style={{ height: 35, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, flexShrink: 0, fontSize: '0.8rem' }}
              >
                <Search size={13} /> Add
              </button>

              {/* Movement Type Filter */}
              <select
                className="form-select"
                style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 140 }}
                value={movementTypeFilter}
                onChange={(e) => { setMovementTypeFilter(e.target.value); setMovementPage(1); }}
              >
                <option value="ALL">All Types</option>
                <option value="PURCHASE">🛒 Inward (PO)</option>
                <option value="SALE">🛍️ Sales Outward</option>
                <option value="SALE_RETURN">🔄 Sales Returns</option>
                <option value="MANUAL_ADJUSTMENT">⚙️ Manual Adjustments</option>
                <option value="PRICE_CHANGE">🏷️ Price Changes</option>
                <option value="PRODUCT_UPDATE">📝 Product & Store Settings</option>
                <option value="DAMAGED_WRITE_OFF">⚠️ Damaged/Expired</option>
                <option value="OPENING_STOCK">📦 Opening Stock</option>
              </select>

              {/* Location Filter */}
              <select
                className="form-select"
                style={{ height: 35, fontSize: '0.8rem', width: 'auto', minWidth: 125 }}
                value={movementLocationFilter}
                onChange={(e) => { setMovementLocationFilter(e.target.value); setMovementPage(1); }}
              >
                <option value="ALL">All Branches</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>

              {/* Date Range Dropdown Button */}
              <DateRangePicker
                value={movementDateRange}
                onChange={(dr) => {
                  setMovementDateRange(dr);
                  setMovementPage(1);
                }}
                variant="dropdown"
                allowAllTime={true}
              />

              {/* Refresh Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadMovements(movementPage)}
                disabled={isMovementsLoading}
                style={{ height: 35, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: '0.8rem' }}
                title="Refresh Ledger"
              >
                <RefreshCw size={13} className={isMovementsLoading ? 'spin-animation' : ''} />
                <span>Refresh</span>
              </button>

              {/* Export CSV Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={exportMovementsToCsv}
                disabled={movements.length === 0}
                style={{ height: 35, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--primary-700)', fontWeight: 600, flexShrink: 0, fontSize: '0.8rem' }}
                title="Export movements to CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Line 2: Active Keywords & Filter Chips in Small Font */}
            {(movementKeywords.length > 0 || movementTypeFilter !== 'ALL' || movementLocationFilter !== 'ALL' || movementDateRange.preset !== 'ALL') && (
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
                  <Filter size={11} /> Keywords & Filters:
                </span>

                {/* Product Keywords Chips */}
                {movementKeywords.map(kw => (
                  <span
                    key={kw}
                    style={{
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
                    }}
                  >
                    <Tag size={10} />
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => removeMovementKeyword(kw)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', fontSize: '0.75rem', marginLeft: 2 }}
                      title={`Remove ${kw}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}

                {/* Type Chip */}
                {movementTypeFilter !== 'ALL' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontWeight: 600,
                      fontSize: '0.74rem'
                    }}
                  >
                    <span>Type: {movementTypeFilter}</span>
                    <button
                      type="button"
                      onClick={() => { setMovementTypeFilter('ALL'); setMovementPage(1); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1d4ed8', display: 'flex', alignItems: 'center', fontSize: '0.75rem', marginLeft: 2 }}
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Location Chip */}
                {movementLocationFilter !== 'ALL' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: '#f5f3ff',
                      color: '#6d28d9',
                      border: '1px solid #ddd6fe',
                      fontWeight: 600,
                      fontSize: '0.74rem'
                    }}
                  >
                    <span>Branch: {locations.find(l => l.id === movementLocationFilter)?.name || movementLocationFilter}</span>
                    <button
                      type="button"
                      onClick={() => { setMovementLocationFilter('ALL'); setMovementPage(1); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#6d28d9', display: 'flex', alignItems: 'center', fontSize: '0.75rem', marginLeft: 2 }}
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Date Range Chip */}
                {movementDateRange.preset !== 'ALL' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                      fontWeight: 600,
                      fontSize: '0.74rem'
                    }}
                  >
                    <span>Date: {movementDateRange.preset === 'CUSTOM' ? `${movementDateRange.fromDate} to ${movementDateRange.toDate}` : movementDateRange.preset}</span>
                    <button
                      type="button"
                      onClick={() => { setMovementDateRange({ preset: 'ALL', fromDate: '', toDate: '' }); setMovementPage(1); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#047857', display: 'flex', alignItems: 'center', fontSize: '0.75rem', marginLeft: 2 }}
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* Clear All Button */}
                <button
                  type="button"
                  onClick={clearAllMovementFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    color: 'var(--danger-600)',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textDecoration: 'underline'
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* Movements Data Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '135px', padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Product & SKU</th>
                    <th style={{ width: '100px', padding: '10px 12px' }}>Branch</th>
                    <th style={{ width: '130px', padding: '10px 12px' }}>Type</th>
                    <th style={{ width: '130px', padding: '10px 12px' }}>Reference</th>
                    <th style={{ width: '90px', padding: '10px 12px', textAlign: 'right' }}>Qty Shift</th>
                    <th style={{ width: '120px', padding: '10px 12px', textAlign: 'right' }}>Stock Impact</th>
                    <th style={{ width: '100px', padding: '10px 12px', textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ width: '110px', padding: '10px 12px' }}>User</th>
                    <th style={{ padding: '10px 12px' }}>Reason / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {isMovementsLoading ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--neutral-500)' }}>
                        <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--primary-600)' }} />
                        Loading stock movements...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--neutral-500)' }}>
                        <Package size={28} style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--neutral-300)' }} />
                        No inventory movements found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m, idx) => {
                      const isPositive = m.quantityChange > 0;
                      let badgeBg = '#f1f5f9';
                      let badgeColor = '#475569';
                      let badgeLabel = m.type;

                      if (m.type === 'PURCHASE') {
                        badgeBg = '#ecfdf5';
                        badgeColor = '#047857';
                        badgeLabel = '🛒 PURCHASE';
                      } else if (m.type === 'SALE') {
                        badgeBg = '#eff6ff';
                        badgeColor = '#1d4ed8';
                        badgeLabel = '🛍️ SALE';
                      } else if (m.type === 'SALE_RETURN') {
                        badgeBg = '#faf5ff';
                        badgeColor = '#7e22ce';
                        badgeLabel = '🔄 RETURN';
                      } else if (m.type === 'MANUAL_ADJUSTMENT') {
                        badgeBg = '#fffbeb';
                        badgeColor = '#b45309';
                        badgeLabel = '⚙️ ADJUSTMENT';
                      } else if (m.type === 'PRICE_CHANGE') {
                        badgeBg = '#f0f9ff';
                        badgeColor = '#0369a1';
                        badgeLabel = '🏷️ PRICE REVISION';
                      } else if (m.type === 'PRODUCT_UPDATE') {
                        badgeBg = '#faf5ff';
                        badgeColor = '#7e22ce';
                        badgeLabel = '📝 SETTINGS UPDATE';
                      } else if (m.type === 'DAMAGED_WRITE_OFF') {
                        badgeBg = '#fef2f2';
                        badgeColor = '#b91c1c';
                        badgeLabel = '⚠️ DAMAGED';
                      } else if (m.type === 'OPENING_STOCK') {
                        badgeBg = '#f0fdfa';
                        badgeColor = '#0f766e';
                        badgeLabel = '📦 OPENING';
                      }

                      const isZero = Math.abs(m.quantityChange) < 0.0001;

                      return (
                        <tr key={m.id || idx}>
                          <td style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            {new Date(m.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.85rem' }}>{m.itemName}</div>
                            <div style={{ display: 'flex', gap: 6, fontSize: '0.7rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                              {m.sku && <span>SKU: {m.sku}</span>}
                              {m.publicItemId && <span>[{m.publicItemId}]</span>}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.78rem', padding: '10px 12px', color: 'var(--neutral-700)' }}>
                            {m.locationName || 'Branch'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: badgeBg, color: badgeColor, fontSize: '0.72rem', fontWeight: 800 }}>
                              {badgeLabel}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', padding: '10px 12px', fontWeight: 600 }}>
                            {m.referenceNumber || m.referenceType || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: isZero ? 'var(--neutral-500)' : (isPositive ? '#059669' : '#dc2626') }}>
                            {isZero ? '0.00' : (isPositive ? `+${m.quantityChange.toFixed(2)}` : m.quantityChange.toFixed(2))}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: 'var(--neutral-400)' }}>{m.quantityBefore.toFixed(1)}</span>
                            <span style={{ margin: '0 4px', color: 'var(--neutral-400)' }}>→</span>
                            <strong style={{ color: 'var(--neutral-900)' }}>{m.quantityAfter.toFixed(1)}</strong>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>
                            ₹{Number(m.unitCost || 0).toFixed(2)}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', padding: '10px 12px' }}>
                            {m.createdByName || 'System'}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', padding: '10px 12px' }}>
                            <div>{m.reason || '—'}</div>
                            {m.notes && <div style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>{m.notes}</div>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={movementPage}
              totalItems={movementTotal}
              pageSize={movementPageSize}
              onPageChange={(p) => { setMovementPage(p); loadMovements(p); }}
              onPageSizeChange={(s) => { setMovementPageSize(s); setMovementPage(1); loadMovements(1, s); }}
              itemLabel="movements"
            />
          </div>
        </div>
      )}

      {/* All-in-One Barcode & QR Studio / Label Printer Modal */}
      <PrintLabelModal
        isOpen={!!codeStudioTarget}
        onClose={() => setCodeStudioTarget(null)}
        itemName={codeStudioTarget?.name}
        itemSku={codeStudioTarget?.sku}
        itemBarcode={codeStudioTarget?.barcode}
        itemPrice={codeStudioTarget?.salePrice}
        itemMrp={codeStudioTarget?.mrp}
        publicItemId={codeStudioTarget?.publicItemId}
        defaultStockCount={codeStudioTarget?.currentStock}
      />

      {/* Camera Scanner Modal for SKU / Barcode */}
      <WebcamScannerModal
        isOpen={!!activeScanField}
        onClose={() => setActiveScanField(null)}
        onScanSuccess={handleCodeScanned}
        title={activeScanField === 'sku' ? 'Scan Product SKU Code' : 'Scan Product Barcode'}
      />

      {/* Existing Product Found Modal */}
      {scanDuplicateItem && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 460, padding: 24, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ 
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                backgroundColor: 'var(--primary-50)', 
                color: 'var(--primary-600)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0 
              }}>
                <Package size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Existing Product Found
                </h4>
                <p style={{ margin: '6px 0 10px 0', fontSize: '0.82rem', color: 'var(--neutral-600)', lineHeight: 1.5 }}>
                  Code <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{scannedCodeValue}</strong> is already registered to:
                  <br />
                  <strong style={{ color: 'var(--primary-700)', fontSize: '0.88rem' }}>{scanDuplicateItem.name}</strong> ({scanDuplicateItem.sku || scanDuplicateItem.barcode})
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                  Do you want to load that existing product into the editor or continue creating a new one?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScanDuplicateItem(null)}
              >
                Continue Creating New
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const itemToLoad = scanDuplicateItem;
                  setScanDuplicateItem(null);
                  openEditModal(itemToLoad);
                }}
              >
                Load Existing Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 920, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-header" style={{ flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid var(--neutral-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>
                    {editingItem ? 'Edit Product & Branch Settings' : 'Add New Product'}
                  </h3>
                  <p style={{ fontSize: '0.73rem', color: 'var(--neutral-500)', margin: '1px 0 0 0' }}>
                    Master product details, pricing, stock, and location discounts
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAddModalOpen(false)} style={{ padding: 6 }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
              <div ref={addModalBodyRef} className="modal-body" style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, maxHeight: 'calc(90vh - 120px)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 1. Common Product Details */}
                <div style={{ background: 'var(--neutral-50)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      1. Common Product Details
                    </span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.76rem', color: 'var(--neutral-800)', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={formAllowParts}
                        onChange={(e) => setFormAllowParts(e.target.checked)}
                        style={{ accentColor: 'var(--primary-600)', width: 14, height: 14, cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600 }}>Allow Fractional / Decimal Qty</span>
                      {formAllowParts && (
                        <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 3, backgroundColor: 'var(--primary-600)', color: '#ffffff', fontWeight: 700 }}>
                          ✓ Fractional POS
                        </span>
                      )}
                    </label>
                  </div>

                  {/* Row 1: Name & Category */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 10, marginBottom: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                        Product / Item Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Basmati Rice (1kg Pack)"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        autoFocus
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                        Category *
                      </label>
                      <CustomSelect
                        value={formCategory}
                        onChange={(val) => setFormCategory(String(val))}
                        options={categoriesList.map(cat => ({
                          value: cat.name,
                          label: cat.name,
                          badge: `${rawItems.filter(i => (i.category || '').toLowerCase() === (cat.name || '').toLowerCase()).length}`,
                          icon: <Layers size={13} />,
                        }))}
                        placeholder="Select Category"
                      />
                    </div>
                  </div>

                  {/* Row 2: SKU, Barcode, GST Rate, Unit */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--neutral-700)' }}>
                          SKU Code
                        </label>
                        <button
                          type="button"
                          onClick={() => setActiveScanField('sku')}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: '0 4px',
                            color: 'var(--primary-600)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                          title="Scan SKU using camera or barcode gun"
                        >
                          <Scan size={12} />
                          <span>Scan</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="RICE-001"
                        value={formSku}
                        onChange={(e) => setFormSku(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--neutral-700)' }}>
                          Barcode Number
                        </label>
                        <button
                          type="button"
                          onClick={() => setActiveScanField('barcode')}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: '0 4px',
                            color: 'var(--primary-600)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                          title="Scan Barcode using camera or barcode gun"
                        >
                          <Scan size={12} />
                          <span>Scan</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="8901234567890"
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                        GST Tax Rate (%)
                      </label>
                      <CustomSelect
                        value={formTaxRate}
                        onChange={(val) => setFormTaxRate(Number(val))}
                        options={[
                          { value: 0, label: '0% (Exempt)', badge: '0%' },
                          { value: 5, label: '5% GST', badge: '5%' },
                          { value: 12, label: '12% GST', badge: '12%' },
                          { value: 18, label: '18% GST', badge: '18%' },
                          { value: 28, label: '28% GST', badge: '28%' },
                        ]}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                        Unit of Measure
                      </label>
                      <CustomSelect
                        value={formUnit}
                        onChange={(val) => setFormUnit(String(val))}
                        options={[
                          { value: 'pcs', label: 'Pieces (pcs)', badge: 'Units' },
                          { value: 'kg', label: 'Kilograms (kg)', badge: 'Weight' },
                          { value: 'gm', label: 'Grams (gm)', badge: 'Weight' },
                          { value: 'ltr', label: 'Liters (ltr)', badge: 'Volume' },
                          { value: 'box', label: 'Box (box)', badge: 'Pack' },
                          { value: 'set', label: 'Set (set)', badge: 'Bundle' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Branch-Wise Pricing & Stock (Streamlined with Branch Tabs) */}
                {(() => {
                  const currentLocId = activeModalBranchId || locations[0]?.id || '';
                  const activeLoc = locations.find(l => l.id === currentLocId) || locations[0];
                  
                  if (!activeLoc) return null;

                  const currentLocData: ItemLocationInventory = locationOverrides[activeLoc.id] || {
                    locationId: activeLoc.id,
                    locationName: activeLoc.name,
                    mrp: 100,
                    salePrice: 100,
                    purchasePrice: 80,
                    currentStock: 10,
                    minStockAlert: 5,
                    isListed: true,
                    hasDiscount: false,
                    discountType: 'PERCENT',
                    discountValue: 0,
                  };

                  const effectivePrice = calculateEffectiveSalePrice(currentLocData);

                  return (
                    <div style={{ background: 'var(--neutral-50)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                      {/* Section Title & Branch Tabs */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                          2. Branch Pricing & Stock
                        </span>

                        {/* Branch Tabs if more than 1 location */}
                        {locations.length > 1 && (
                          <div style={{ display: 'inline-flex', background: 'var(--neutral-200)', padding: 2, borderRadius: 6, gap: 2 }}>
                            {locations.map((loc) => {
                              const isSelected = loc.id === activeLoc.id;
                              const locData = locationOverrides[loc.id];
                              const isLocListed = locData ? locData.isListed : true;
                              const mrpDisplay = locData?.mrp ? `₹${locData.mrp}` : '';
                              return (
                                <button
                                  key={loc.id}
                                  type="button"
                                  onClick={() => setActiveModalBranchId(loc.id)}
                                  style={{
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '4px 10px',
                                    fontSize: '0.74rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    backgroundColor: isSelected ? '#ffffff' : 'transparent',
                                    color: isSelected ? 'var(--primary-700)' : 'var(--neutral-700)',
                                    boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <MapPin size={12} color={isSelected ? 'var(--primary-600)' : 'var(--neutral-500)'} />
                                  <span>{loc.name}</span>
                                  {mrpDisplay && (
                                    <span style={{ fontSize: '0.68rem', opacity: isSelected ? 0.9 : 0.7 }}>
                                      ({mrpDisplay})
                                    </span>
                                  )}
                                  {!isLocListed && (
                                    <span style={{ fontSize: '0.62rem', color: 'var(--danger-600)', fontWeight: 700 }}>• Unlisted</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Active Branch Card */}
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${currentLocData.isListed ? 'var(--neutral-300)' : 'var(--neutral-200)'}`,
                          backgroundColor: currentLocData.isListed ? '#ffffff' : 'var(--neutral-100)',
                        }}
                      >
                        {/* Branch Bar: Branch identity + Listed toggle */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--neutral-100)', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={15} color="var(--primary-600)" />
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-900)' }}>
                              {activeLoc.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 3, background: 'var(--neutral-100)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {activeLoc.code}
                            </span>
                          </div>

                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={currentLocData.isListed}
                              onChange={(e) => {
                                setLocationOverrides({
                                  ...locationOverrides,
                                  [activeLoc.id]: {
                                    ...currentLocData,
                                    isListed: e.target.checked,
                                  },
                                });
                              }}
                            />
                            <span style={{ color: currentLocData.isListed ? 'var(--success-700)' : 'var(--neutral-500)' }}>
                              {currentLocData.isListed ? '✓ Listed at this Branch' : '✕ Unlisted (Hidden in POS)'}
                            </span>
                          </label>
                        </div>

                        {currentLocData.isListed ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* 4-column compact Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                                  Selling Price ₹ (MRP) *
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input"
                                  placeholder="100.00"
                                  value={currentLocData.mrp ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const updatedLoc = { ...currentLocData, mrp: raw as any };
                                    updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                    setLocationOverrides({
                                      ...locationOverrides,
                                      [activeLoc.id]: updatedLoc,
                                    });
                                  }}
                                  required
                                  style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                                  Purchase Cost (₹)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input"
                                  placeholder="80.00"
                                  value={currentLocData.purchasePrice ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    setLocationOverrides({
                                      ...locationOverrides,
                                      [activeLoc.id]: {
                                        ...currentLocData,
                                        purchasePrice: raw as any,
                                      },
                                    });
                                  }}
                                  style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                              </div>

                              <div style={{ minWidth: 0 }}>
                                {editingItem ? (
                                  <>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                      <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neutral-700)', margin: 0 }}>
                                        Stock ({formUnit})
                                      </label>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--primary-700)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Lock size={9} /> Locked
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                      <div
                                        style={{
                                          flex: 1,
                                          padding: '5px 8px',
                                          backgroundColor: 'var(--neutral-100)',
                                          border: '1px solid var(--neutral-300)',
                                          borderRadius: 'var(--radius-sm)',
                                          fontWeight: 700,
                                          fontSize: '0.82rem',
                                          color: 'var(--neutral-800)',
                                        }}
                                      >
                                        {Number(currentLocData.currentStock ?? 0).toFixed(formAllowParts ? 3 : 0)}
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        style={{ whiteSpace: 'nowrap', padding: '5px 7px', fontSize: '0.71rem', fontWeight: 600 }}
                                        title="Adjust Stock for this branch"
                                        onClick={() => {
                                          setIsAddModalOpen(false);
                                          openStockAdjustment(editingItem, activeLoc.id);
                                        }}
                                      >
                                        <SlidersHorizontal size={11} style={{ marginRight: 2 }} /> Adjust
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                                      Opening Stock ({formUnit}) *
                                    </label>
                                    <input
                                      type="number"
                                      step={formAllowParts ? "0.001" : "1"}
                                      min="0"
                                      className="form-input"
                                      placeholder={formAllowParts ? "10.000" : "10"}
                                      value={currentLocData.currentStock ?? ''}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setLocationOverrides({
                                          ...locationOverrides,
                                          [activeLoc.id]: {
                                            ...currentLocData,
                                            currentStock: raw as any,
                                          },
                                        });
                                      }}
                                      required
                                      style={{ width: '100%', boxSizing: 'border-box' }}
                                    />
                                  </>
                                )}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 3 }}>
                                  Low Stock Alert
                                </label>
                                <input
                                  type="number"
                                  step={formAllowParts ? "0.001" : "1"}
                                  min="0"
                                  className="form-input"
                                  placeholder={formAllowParts ? "5.000" : "5"}
                                  value={currentLocData.minStockAlert ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    setLocationOverrides({
                                      ...locationOverrides,
                                      [activeLoc.id]: {
                                        ...currentLocData,
                                        minStockAlert: raw as any,
                                      },
                                    });
                                  }}
                                  style={{ width: '100%', boxSizing: 'border-box' }}
                                />
                              </div>
                            </div>

                            {/* Inline Branch Discount Toggle & Fields */}
                            <div
                              ref={discountSectionRef}
                              style={{ background: 'var(--neutral-50)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', color: 'var(--neutral-800)', userSelect: 'none' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!currentLocData.hasDiscount}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      const updatedLoc = {
                                        ...currentLocData,
                                        hasDiscount: isChecked,
                                      };
                                      updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                      setLocationOverrides({
                                        ...locationOverrides,
                                        [activeLoc.id]: updatedLoc,
                                      });
                                      if (isChecked) {
                                        ensureElementVisible(discountSectionRef.current);
                                      }
                                    }}
                                  />
                                  <Tag size={13} color="var(--primary-600)" />
                                  <span>Apply Branch Discount</span>
                                </label>

                                {currentLocData.hasDiscount && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem' }}>
                                    <span style={{ color: 'var(--neutral-600)' }}>Final POS Price:</span>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--success-700)' }}>
                                      ₹{effectivePrice.toFixed(2)}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                                      (MRP: <del>₹{Number(currentLocData.mrp || 0).toFixed(2)}</del>)
                                    </span>
                                  </div>
                                )}
                              </div>

                              {currentLocData.hasDiscount && (
                                <div
                                  style={{
                                    marginTop: 8,
                                    paddingTop: 8,
                                    borderTop: '1px dashed var(--neutral-200)',
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--neutral-600)', display: 'block', marginBottom: 3 }}>
                                      Discount Type
                                    </label>
                                    <CustomSelect
                                      value={currentLocData.discountType || 'PERCENT'}
                                      onChange={(val) => {
                                        const updatedLoc = {
                                          ...currentLocData,
                                          discountType: val as 'PERCENT' | 'FLAT',
                                        };
                                        updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                        setLocationOverrides({
                                          ...locationOverrides,
                                          [activeLoc.id]: updatedLoc,
                                        });
                                      }}
                                      options={[
                                        { value: 'PERCENT', label: '% Percentage Off MRP', icon: <Percent size={12} />, badge: '%' },
                                        { value: 'FLAT', label: '₹ Flat Amount Off MRP', icon: <DollarSign size={12} />, badge: '₹' },
                                      ]}
                                    />
                                  </div>

                                  <div style={{ minWidth: 0 }}>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--neutral-600)', display: 'block', marginBottom: 3 }}>
                                      Discount Value {currentLocData.discountType === 'PERCENT' ? '(%)' : '(₹)'}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="form-input"
                                      placeholder={currentLocData.discountType === 'PERCENT' ? 'e.g. 10' : 'e.g. 20'}
                                      value={currentLocData.discountValue ?? ''}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const updatedLoc = {
                                          ...currentLocData,
                                          discountValue: raw as any,
                                        };
                                        updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                        setLocationOverrides({
                                          ...locationOverrides,
                                          [activeLoc.id]: updatedLoc,
                                        });
                                      }}
                                      style={{ width: '100%', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '8px 12px', background: 'var(--neutral-200)', borderRadius: 4, fontSize: '0.76rem', color: 'var(--neutral-600)' }}>
                            This product is unlisted for {activeLoc.name} and will not appear in POS billing or branch catalogs.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Product Photos & Gallery (Collapsible / On-Demand) */}
                <div
                  ref={imagesSectionRef}
                  style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', overflow: 'hidden', flexShrink: 0 }}
                >
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  {/* Header Bar / Toggle */}
                  <div
                    onClick={() => {
                      const willOpen = !isImagesSectionOpen;
                      setIsImagesSectionOpen(willOpen);
                      if (willOpen) {
                        ensureElementVisible(imagesSectionRef.current);
                      }
                    }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: isImagesSectionOpen ? '#ffffff' : 'transparent',
                      borderBottom: isImagesSectionOpen ? '1px solid var(--neutral-200)' : 'none',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ImageIcon size={15} color="var(--primary-600)" />
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                          3. Product Photos & Gallery (Optional)
                        </span>
                      </div>

                      {/* Mini Thumbnail Strip if images exist */}
                      {formImages.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
                          {formImages.slice(0, 4).map((img, i) => (
                            <div key={img.id || i} style={{ width: 24, height: 24, borderRadius: 4, overflow: 'hidden', border: `1px solid ${img.isPrimary ? 'var(--primary-500)' : 'var(--neutral-300)'}`, backgroundColor: '#ffffff' }}>
                              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--neutral-600)', background: 'var(--neutral-200)', padding: '1px 6px', borderRadius: 10 }}>
                            {formImages.length} {formImages.length === 1 ? 'photo' : 'photos'}
                          </span>
                        </div>
                      )}

                      {formImages.length === 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                          No photos added
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const willOpen = !isImagesSectionOpen;
                          setIsImagesSectionOpen(willOpen);
                          if (willOpen) {
                            ensureElementVisible(imagesSectionRef.current);
                          }
                        }}
                      >
                        {isImagesSectionOpen ? (
                          <><span>Collapse</span><ChevronUp size={13} /></>
                        ) : (
                          <><span>{formImages.length > 0 ? 'Manage Photos' : '+ Add Photos'}</span><ChevronDown size={13} /></>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Image Management Content */}
                  {isImagesSectionOpen && (
                    <div style={{ padding: '12px 14px', backgroundColor: '#ffffff', maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Compact Drop Zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: '1.5px dashed var(--neutral-300)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 16px',
                          backgroundColor: 'var(--neutral-50)',
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary-500)';
                          e.currentTarget.style.backgroundColor = 'var(--primary-50)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--neutral-300)';
                          e.currentTarget.style.backgroundColor = 'var(--neutral-50)';
                        }}
                      >
                        <Upload size={18} color="var(--primary-600)" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--neutral-800)' }}>
                          Click to upload or drag & drop product photos
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                          (JPG, PNG, WebP • Auto-compressed &lt;100KB)
                        </span>
                      </div>

                      {/* Upload Status */}
                      {isUploadingImage && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-sm)', fontSize: '0.76rem', color: 'var(--primary-800)', fontWeight: 600 }}>
                          <Loader2 size={14} className="spin" />
                          <span>{uploadStatusMsg || 'Processing image...'}</span>
                        </div>
                      )}

                      {/* Thumbnails Grid */}
                      {formImages.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, maxHeight: 260, overflowY: 'auto', padding: '2px 4px 4px 2px' }}>
                          {formImages.map((img, index) => {
                            const isPrimary = !!img.isPrimary;
                            return (
                              <div
                                key={img.id || index}
                                style={{
                                  borderRadius: 'var(--radius-sm)',
                                  border: `1.5px solid ${isPrimary ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                                  backgroundColor: '#ffffff',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  boxShadow: isPrimary ? '0 0 0 2px var(--primary-glow)' : 'var(--shadow-xs)',
                                  position: 'relative',
                                }}
                              >
                                <div style={{ position: 'relative', width: '100%', height: 90, backgroundColor: 'var(--neutral-100)' }}>
                                  <img
                                    src={img.url}
                                    alt={img.name || `Image #${index + 1}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    backgroundColor: isPrimary ? 'var(--primary-600)' : 'rgba(15, 23, 42, 0.75)',
                                    color: '#ffffff',
                                    fontSize: '0.64rem',
                                    fontWeight: 800,
                                  }}>
                                    #{index + 1} {isPrimary ? '• Cover' : ''}
                                  </div>
                                  {img.sizeBytes && (
                                    <div style={{
                                      position: 'absolute',
                                      bottom: 4,
                                      right: 4,
                                      padding: '1px 4px',
                                      borderRadius: 3,
                                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                      color: '#ffffff',
                                      fontSize: '0.62rem',
                                      fontWeight: 600,
                                    }}>
                                      {formatBytes(img.sizeBytes)}
                                    </div>
                                  )}
                                </div>

                                <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => setPrimaryImage(index)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        color: isPrimary ? 'var(--primary-600)' : 'var(--neutral-500)',
                                        cursor: isPrimary ? 'default' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        padding: 0,
                                      }}
                                    >
                                      <Star size={11} fill={isPrimary ? 'var(--primary-600)' : 'none'} color={isPrimary ? 'var(--primary-600)' : 'var(--neutral-400)'} />
                                      <span>{isPrimary ? 'Cover' : 'Set Cover'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteImage(index)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--danger-500)',
                                        cursor: 'pointer',
                                        padding: '1px 3px',
                                      }}
                                      title="Delete"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>

                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => moveImage(index, 'LEFT')}
                                      style={{
                                        flex: 1,
                                        padding: '2px 0',
                                        fontSize: '0.66rem',
                                        borderRadius: 3,
                                        border: '1px solid var(--neutral-200)',
                                        backgroundColor: index === 0 ? 'var(--neutral-100)' : '#ffffff',
                                        color: index === 0 ? 'var(--neutral-400)' : 'var(--neutral-700)',
                                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                      }}
                                    >
                                      <ArrowLeft size={10} />
                                      <span>Left</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === formImages.length - 1}
                                      onClick={() => moveImage(index, 'RIGHT')}
                                      style={{
                                        flex: 1,
                                        padding: '2px 0',
                                        fontSize: '0.66rem',
                                        borderRadius: 3,
                                        border: '1px solid var(--neutral-200)',
                                        backgroundColor: index === formImages.length - 1 ? 'var(--neutral-100)' : '#ffffff',
                                        color: index === formImages.length - 1 ? 'var(--neutral-400)' : 'var(--neutral-700)',
                                        cursor: index === formImages.length - 1 ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                      }}
                                    >
                                      <span>Right</span>
                                      <ArrowRight size={10} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid var(--neutral-200)', background: 'var(--neutral-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: '0.8rem', color: isSaving ? 'var(--primary-700)' : 'var(--neutral-500)', fontWeight: 600 }}>
                  {uploadStatusMsg || (formImages.some(img => img.pendingCompressed) ? `📸 ${formImages.filter(img => img.pendingCompressed).length} new image(s) staged to upload on save` : '')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSaving} style={{ padding: '8px 14px' }}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={isSaving || isUploadingImage || (editingItem ? !hasChanges : !formName.trim())}
                    title={editingItem && !hasChanges ? 'No changes made to product or branch settings' : undefined}
                    style={{
                      padding: '8px 16px',
                      opacity: (isSaving || isUploadingImage || (editingItem ? !hasChanges : !formName.trim())) ? 0.6 : 1,
                      cursor: (isSaving || isUploadingImage || (editingItem ? !hasChanges : !formName.trim())) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSaving ? 'Uploading & Saving...' : (editingItem ? 'Save Product & Pricing' : 'Create Product')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedItemForAdjust && (() => {
        const raw = rawItems.find(r => r.id === selectedItemForAdjust.id) || selectedItemForAdjust;
        const bInv = raw.locations?.find(l => l.locationId === adjustLocationId);
        const prevStock = bInv && bInv.currentStock !== undefined ? Number(bInv.currentStock) : Number(selectedItemForAdjust.currentStock || 0);
        const locPurchaseCost = Number(bInv?.purchasePrice ?? raw.purchasePrice ?? selectedItemForAdjust.purchasePrice ?? 0);
        const oldAvgCost = locPurchaseCost;
        const inwardQty = parseFloat(String(adjustDelta)) || 0;
        const inwardCost = adjustUnitCost !== '' ? (parseFloat(String(adjustUnitCost)) || 0) : locPurchaseCost;
        const resultingStock = adjustType === 'ADD' ? (Math.max(0, prevStock) + inwardQty) : Math.max(0, prevStock - inwardQty);
        const newWac = adjustType === 'ADD' && resultingStock > 0 ? (((Math.max(0, prevStock) * locPurchaseCost) + (inwardQty * inwardCost)) / resultingStock) : locPurchaseCost;

        return (
          <div className="modal-overlay" onClick={() => setIsAdjustModalOpen(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 560,
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-lg, 12px)',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div className="card-header" style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: adjustType === 'ADD' ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: adjustType === 'ADD' ? '#059669' : '#dc2626' }}>
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}>Stock Adjustment & Valuation</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                      Audited inventory movement with cost averaging
                    </p>
                  </div>
                </div>
                <button className="btn btn-secondary btn-icon" onClick={() => setIsAdjustModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleStockAdjustment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'var(--neutral-50)', padding: '10px 14px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--neutral-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--neutral-900)', margin: 0 }}>
                        {selectedItemForAdjust.name}
                      </p>
                      <p style={{ fontSize: '0.74rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                        SKU: <strong>{selectedItemForAdjust.sku || selectedItemForAdjust.publicItemId}</strong> &bull; Purchase Price: <strong>₹{oldAvgCost.toFixed(2)}</strong>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', background: '#ffffff', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--neutral-200)' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Branch Stock</span>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: prevStock > 0 ? '#15803d' : '#dc2626' }}>
                        {prevStock.toFixed(selectedItemForAdjust.allowParts ? 3 : 0)} {selectedItemForAdjust.unit}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>
                        Target Branch Location
                      </label>
                      <select
                        className="form-input"
                        style={{ width: '100%', height: 38, fontSize: '0.85rem', cursor: 'pointer', background: '#fff' }}
                        value={adjustLocationId}
                        onChange={(e) => setAdjustLocationId(e.target.value)}
                      >
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} {loc.code ? `(${loc.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>
                        Adjustment Flow
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, height: 38 }}>
                        <button
                          type="button"
                          className={`btn ${adjustType === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => {
                            setAdjustType('ADD');
                            setAdjustReason('Physical Stock Count / Surplus');
                          }}
                          style={{ justifyContent: 'center', fontSize: '0.78rem', padding: '4px 6px', fontWeight: 600 }}
                        >
                          + Add Stock
                        </button>
                        <button
                          type="button"
                          className={`btn ${adjustType === 'REDUCE' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => {
                            setAdjustType('REDUCE');
                            setAdjustReason('Damaged / Broken Goods');
                          }}
                          style={{ justifyContent: 'center', fontSize: '0.78rem', padding: '4px 6px', fontWeight: 600 }}
                        >
                          - Reduce
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: adjustType === 'ADD' ? '1fr 1fr' : '1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>
                        Quantity ({selectedItemForAdjust.unit}) *
                      </label>
                      <input
                        type="number"
                        step={selectedItemForAdjust.allowParts ? "0.001" : "1"}
                        min={selectedItemForAdjust.allowParts ? "0.001" : "1"}
                        required
                        className="form-input"
                        placeholder="1"
                        style={{ height: 38, fontSize: '0.85rem' }}
                        value={adjustDelta ?? ''}
                        onChange={(e) => setAdjustDelta(e.target.value)}
                      />
                    </div>

                    {adjustType === 'ADD' && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>
                          Inward Unit Cost (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ height: 38, fontSize: '0.85rem' }}
                          placeholder={oldAvgCost > 0 ? oldAvgCost.toFixed(2) : "0.00"}
                          value={adjustUnitCost ?? ''}
                          onChange={(e) => setAdjustUnitCost(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Real-time Weighted Average Cost Preview on Inflow */}
                  {adjustType === 'ADD' && (
                    <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md, 8px)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Scale size={14} /> Weighted Average Cost Preview
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>
                          New Cost: ₹{newWac.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.73rem', color: '#374151' }}>
                        <div>Prior: <strong>{prevStock.toFixed(selectedItemForAdjust.allowParts ? 3 : 0)}</strong> @ ₹{oldAvgCost.toFixed(2)}</div>
                        <div>Adding: <strong>+{inwardQty.toFixed(selectedItemForAdjust.allowParts ? 3 : 0)}</strong> @ ₹{inwardCost.toFixed(2)}</div>
                        <div>New Total Stock: <strong>{resultingStock.toFixed(selectedItemForAdjust.allowParts ? 3 : 0)}</strong> {selectedItemForAdjust.unit}</div>
                        <div style={{ color: '#166534', fontWeight: 700 }}>Auto-syncs catalog purchase price</div>
                      </div>
                    </div>
                  )}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>
                      Reason for Adjustment *
                    </label>
                    <select
                      className="form-input"
                      style={{ width: '100%', height: 38, fontSize: '0.85rem', cursor: 'pointer', background: '#fff' }}
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      required
                    >
                      {adjustType === 'ADD' ? (
                        <>
                          <option value="Physical Stock Count / Surplus">Physical Stock Count / Surplus</option>
                          <option value="Supplier Direct Restock (No PO)">Supplier Direct Restock (No PO)</option>
                          <option value="Found Inventory / Warehouse Discovery">Found Inventory / Warehouse Discovery</option>
                          <option value="Opening Balance Correction">Opening Balance Correction</option>
                          <option value="Customer Return (Manual / Unlinked)">Customer Return (Manual / Unlinked)</option>
                          <option value="Other Inward Stock Adjustment">Other Inward Stock Adjustment</option>
                        </>
                      ) : (
                        <>
                          <option value="Damaged / Broken Goods">Damaged / Broken Goods</option>
                          <option value="Expired / Past Date Goods">Expired / Past Date Goods</option>
                          <option value="Stock Count Deficit / Shrinkage">Stock Count Deficit / Shrinkage</option>
                          <option value="Internal Store Usage / Testing">Internal Store Usage / Testing</option>
                          <option value="Lost / Theft Write-off">Lost / Theft Write-off</option>
                          <option value="Other Outward Stock Reduction">Other Outward Stock Reduction</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4, display: 'block' }}>
                      Audit Notes / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: 38, fontSize: '0.85rem' }}
                      placeholder="e.g. Verified by Store Manager during monthly physical count"
                      value={adjustNotes}
                      onChange={(e) => setAdjustNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer" style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid var(--neutral-200)', background: 'var(--neutral-50)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={`btn ${adjustType === 'ADD' ? 'btn-primary' : 'btn-danger'}`}
                    disabled={inwardQty <= 0}
                    style={{
                      opacity: inwardQty <= 0 ? 0.6 : 1,
                      cursor: inwardQty <= 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {adjustType === 'ADD' ? `Confirm Inward Stock (+${inwardQty})` : `Confirm Stock Reduction (-${inwardQty})`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Category Master Management Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 680, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-header" style={{ flexShrink: 0, padding: '16px 24px', borderBottom: '1px solid var(--neutral-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>Product Categories Master</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Create and manage standard catalog categories for your store
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCategoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Add New Category Form (Admin / Manager) */}
              {canManage && (
                <div style={{ background: 'var(--neutral-50)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <FolderPlus size={16} color="var(--primary-600)" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary-700)' }}>
                      Create New Category
                    </span>
                  </div>

                  <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                          Category Name *
                        </label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder="e.g. Frozen Foods, Fresh Produce"
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
                          placeholder="Brief description of items in this category"
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
              )}

              {/* Categories Table / List */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--neutral-800)' }}>
                    Registered Categories ({categoriesList.length})
                  </span>
                  <div style={{ position: 'relative', width: 220 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: 'var(--neutral-400)' }} />
                    <input
                      type="text"
                      placeholder="Filter categories..."
                      className="form-input"
                      style={{ paddingLeft: 30, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: '0.78rem', width: '100%', boxSizing: 'border-box' }}
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem', width: '220px' }}>Category Name</th>
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem' }}>Description</th>
                        {canManage && <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.72rem', width: '150px' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {categoriesList
                        .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()) || (c.description && c.description.toLowerCase().includes(categorySearch.toLowerCase())))
                        .map((cat) => {
                          const isEditing = editingCatId === cat.id;

                          return (
                            <tr key={cat.id}>
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
                                  <span>📁 {cat.name}</span>
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
                                  cat.description || <span style={{ color: 'var(--neutral-400)', fontStyle: 'italic' }}>No description</span>
                                )}
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                                  {isEditing ? (
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        title={(editingCatName.trim() === cat.name && editingCatDesc.trim() === (cat.description || '')) ? 'No changes made' : 'Save Changes'}
                                        disabled={!editingCatName.trim() || (editingCatName.trim() === cat.name && editingCatDesc.trim() === (cat.description || ''))}
                                        onClick={() => handleSaveEditCat(cat.id)}
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
                                        onClick={() => handleStartEditCat(cat)}
                                        style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        <Edit3 size={13} />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        title="Delete Category"
                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                        style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger-600, #dc2626)' }}
                                      >
                                        <Trash2 size={13} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ flexShrink: 0, padding: '14px 24px', borderTop: '1px solid var(--neutral-200)', background: 'var(--neutral-50)' }}>
              <button type="button" className="btn btn-primary" onClick={() => setIsCategoryModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Catalog & Inventory to Branch Modal */}
      <SyncInventoryModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        targetLocation={activeLocation}
        onSuccess={async () => {
          await loadPaginatedItems();
          refreshData();
        }}
      />


    </div>
  );
};

