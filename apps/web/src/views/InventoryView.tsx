import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  Upload,
  ArrowLeft,
  ArrowRight,
  Star,
  Loader2,
  Sparkles,
  Eye
} from 'lucide-react';
import { Item, StoreLocation, ItemLocationInventory, ItemCategory, ItemImage } from '../types';
import { store } from '../services/store';
import { StatusBadge } from '../components/StatusBadge';
import { QRModal } from '../components/QRModal';
import { CustomSelect } from '../components/CustomSelect';
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Category Multi-Select Dropdown State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [selectedItemForQR, setSelectedItemForQR] = useState<Item | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<Item | null>(null);
  const [adjustLocationId, setAdjustLocationId] = useState<string>(selectedLocationId);
  const [adjustDelta, setAdjustDelta] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<'ADD' | 'REDUCE'>('ADD');

  // Category Master Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

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

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      const currentLocId = store.getActiveLocation().id;
      if (currentLocId !== selectedLocationId) {
        setSelectedLocationId(currentLocId);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [selectedLocationId]);

  const activeLocation = locations.find(l => l.id === selectedLocationId) || locations[0] || store.getActiveLocation();

  const availableCategories = Array.from(new Set([...categoriesList.map(c => c.name), ...rawItems.map(i => i.category)]));

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

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.publicItemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = 
      selectedCategories.length === 0 || 
      selectedCategories.includes(item.category);

    return matchesSearch && matchesCategory;
  });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    store.addCategory({
      name: newCatName.trim(),
      description: newCatDesc.trim() || undefined,
    });
    setNewCatName('');
    setNewCatDesc('');
    setCategoriesList(store.getCategories());
  };

  const handleDeleteCategory = (catId: string, catName: string) => {
    const usageCount = rawItems.filter(i => i.category.toLowerCase() === catName.toLowerCase()).length;
    const confirmMsg = usageCount > 0
      ? `Category "${catName}" is currently used by ${usageCount} product(s). Are you sure you want to delete it?`
      : `Delete category "${catName}"?`;

    if (window.confirm(confirmMsg)) {
      store.deleteCategory(catId);
      setCategoriesList(store.getCategories());
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
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    const raw = rawItems.find(r => r.id === item.id) || item;
    setEditingItem(raw);
    setFormName(raw.name);
    setFormSku(raw.sku || '');
    setFormBarcode(raw.barcode || '');
    setFormCategory(raw.category);
    setFormTaxRate(raw.taxRate);
    setFormUnit(raw.unit);
    setFormDescription(raw.description || '');
    setPendingDeletedImageUrls([]);
    setUploadStatusMsg('');

    // Load existing images ordered by order index
    if (raw.images && raw.images.length > 0) {
      setFormImages([...raw.images].sort((a, b) => a.order - b.order));
    } else if (raw.imageUrl) {
      setFormImages([{
        id: 'img_0',
        url: raw.imageUrl,
        order: 0,
        isPrimary: true,
        name: 'Cover Image',
      }]);
    } else {
      setFormImages([]);
    }

    // Map existing locations or fallback
    const initialOverrides: Record<string, ItemLocationInventory> = {};
    locations.forEach(loc => {
      const existing = raw.locations?.find(l => l.locationId === loc.id);
      if (existing) {
        initialOverrides[loc.id] = { 
          ...existing,
          mrp: existing.mrp ?? existing.salePrice ?? raw.mrp ?? raw.salePrice,
          hasDiscount: !!existing.hasDiscount,
          discountType: existing.discountType || 'PERCENT',
          discountValue: existing.discountValue || 0,
        };
      } else {
        initialOverrides[loc.id] = {
          locationId: loc.id,
          locationName: loc.name,
          mrp: raw.mrp ?? raw.salePrice,
          salePrice: raw.salePrice,
          purchasePrice: raw.purchasePrice,
          currentStock: 0,
          minStockAlert: raw.minStockAlert,
          isListed: true,
          hasDiscount: false,
          discountType: 'PERCENT',
          discountValue: 0,
        };
      }
    });
    setLocationOverrides(initialOverrides);
    setIsAddModalOpen(true);
  };

  const calculateEffectiveSalePrice = (locInv: ItemLocationInventory): number => {
    const baseMrp = Number(locInv.mrp || 0);
    if (!locInv.hasDiscount || !locInv.discountValue || locInv.discountValue <= 0) {
      return baseMrp;
    }
    if (locInv.discountType === 'PERCENT') {
      const disc = (baseMrp * locInv.discountValue) / 100;
      return Math.max(0, Number((baseMrp - disc).toFixed(2)));
    } else {
      return Math.max(0, Number((baseMrp - locInv.discountValue).toFixed(2)));
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isSaving) return;

    setIsSaving(true);
    setUploadStatusMsg('Saving product and processing images...');

    try {
      const businessId = currentUser?.businessId || 'default_tenant';
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
        ...loc,
        salePrice: calculateEffectiveSalePrice(loc),
      }));

      // Master fallback defaults
      const currentLocInv = locationOverrides[selectedLocationId] || locArray[0];
      const masterMrp = currentLocInv ? currentLocInv.mrp : 100;
      const masterSalePrice = currentLocInv ? calculateEffectiveSalePrice(currentLocInv) : 100;
      const masterPurchasePrice = currentLocInv ? currentLocInv.purchasePrice : 80;
      const masterStock = currentLocInv ? currentLocInv.currentStock : 10;
      const masterMinAlert = currentLocInv ? currentLocInv.minStockAlert : 5;

      if (editingItem) {
        store.updateItem(editingItem.id, {
          name: formName.trim(),
          sku: formSku.trim() || undefined,
          barcode: formBarcode.trim() || undefined,
          category: formCategory.trim(),
          taxRate: formTaxRate,
          unit: formUnit,
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
        store.addItem({
          name: formName.trim(),
          sku: formSku.trim() || undefined,
          barcode: formBarcode.trim() || undefined,
          category: formCategory.trim(),
          taxRate: formTaxRate,
          unit: formUnit,
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

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;
    const delta = adjustType === 'ADD' ? Math.abs(adjustDelta) : -Math.abs(adjustDelta);
    store.adjustStock(selectedItemForAdjust.id, delta, adjustLocationId);
    refreshData();
    setIsAdjustModalOpen(false);
    setSelectedItemForAdjust(null);
  };

  const handleDeleteItem = (id: string, name: string) => {
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
          const businessId = currentUser?.businessId || 'default_tenant';
          deleteItemImages(businessId, urlsToDelete);
        }
      }

      store.deleteItem(id);
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
          <div style={{ display: 'flex', gap: 8 }}>
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
                <th style={{ width: '90px', padding: '10px 12px' }}>Purchase</th>
                <th style={{ width: '70px', padding: '10px 12px' }}>GST</th>
                <th style={{ width: '100px', padding: '10px 12px' }}>Stock</th>
                <th style={{ width: '95px', padding: '10px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '125px', padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const raw = rawItems.find(r => r.id === item.id) || item;
                const branchInv = raw.locations?.find(l => l.locationId === selectedLocationId);
                const isListed = branchInv ? branchInv.isListed !== false : true;

                const mrp = branchInv?.mrp ?? item.mrp ?? item.salePrice;
                const hasDiscount = branchInv?.hasDiscount && (branchInv?.discountValue || 0) > 0;
                const discountText = branchInv?.discountType === 'PERCENT'
                  ? `${branchInv.discountValue}% OFF`
                  : `₹${branchInv?.discountValue} OFF`;

                const stockStatus = 
                  item.currentStock === 0 ? 'OUT_OF_STOCK' : (item.currentStock <= item.minStockAlert ? 'LOW_STOCK' : 'IN_STOCK');

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
                          <div style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.88rem' }}>{item.name}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            {item.sku && <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>SKU: {item.sku}</span>}
                            {item.barcode && <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>BAR: {item.barcode}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ backgroundColor: 'var(--neutral-100)', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary-600)' }}>
                          ₹{item.salePrice.toFixed(2)}
                        </span>
                        {hasDiscount ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <del style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>₹{mrp.toFixed(2)}</del>
                            <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: 3, background: 'var(--success-50)', color: 'var(--success-700)', fontWeight: 700 }}>
                              {discountText}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                            MRP ₹{mrp.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--neutral-600)', fontSize: '0.85rem', padding: '10px 12px' }}>
                      ₹{item.purchasePrice.toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.85rem', padding: '10px 12px' }}>{item.taxRate}%</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: stockStatus === 'OUT_OF_STOCK' ? 'var(--danger-600)' : 'var(--neutral-900)' }}>
                        {item.currentStock} {item.unit}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)', marginLeft: 3 }}>
                        (Min: {item.minStockAlert})
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
                          title="Generate QR Barcode"
                          onClick={() => setSelectedItemForQR(item)}
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
                          onClick={() => {
                            setSelectedItemForAdjust(item);
                            setAdjustLocationId(selectedLocationId);
                            setIsAdjustModalOpen(true);
                          }}
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
      </div>

      {/* QR Modal */}
      {selectedItemForQR && (
        <QRModal item={selectedItemForQR} onClose={() => setSelectedItemForQR(null)} />
      )}

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-header" style={{ flexShrink: 0, padding: '16px 24px', borderBottom: '1px solid var(--neutral-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                    {editingItem ? 'Edit Product & Branch Settings' : 'Add New Product'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Configure master details and branch-wise MRP, discounts, final selling prices, and stock
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAddModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. General Master Info */}
                <div style={{ background: 'var(--neutral-50)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      1. Common Product Details
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Product / Item Name *</label>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
                    <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                        Category *
                      </label>
                      <CustomSelect
                        value={formCategory}
                        onChange={(val) => setFormCategory(String(val))}
                        options={categoriesList.map(cat => ({
                          value: cat.name,
                          label: cat.name,
                          badge: `${rawItems.filter(i => i.category.toLowerCase() === cat.name.toLowerCase()).length}`,
                          icon: <Layers size={13} />,
                        }))}
                        placeholder="Select Category"
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                        SKU Code
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="RICE-001"
                        value={formSku}
                        onChange={(e) => setFormSku(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                        Barcode Number
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="8901234567890"
                        value={formBarcode}
                        onChange={(e) => setFormBarcode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                    <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                        GST Tax Rate (%)
                      </label>
                      <CustomSelect
                        value={formTaxRate}
                        onChange={(val) => setFormTaxRate(Number(val))}
                        options={[
                          { value: 0, label: '0% (Exempt / Nil Rated)', badge: '0%' },
                          { value: 5, label: '5% GST (Standard Essentials)', badge: '5%' },
                          { value: 12, label: '12% GST (Processed Foods / Apparel)', badge: '12%' },
                          { value: 18, label: '18% GST (Standard Commercial)', badge: '18%' },
                          { value: 28, label: '28% GST (Luxury / High Slab)', badge: '28%' },
                        ]}
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 5 }}>
                        Unit of Measurement
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

                {/* 2. Product Images & Gallery (Auto-Compression & Order Index) */}
                <div style={{ background: 'var(--neutral-50)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                        2. Product Images & Gallery
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 12, backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={12} />
                        Auto-Compression & Supabase Cloud
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                      {formImages.length} image{formImages.length !== 1 ? 's' : ''} uploaded
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginBottom: 14 }}>
                    Upload item photos. Images are automatically resized/compressed under 100KB (Step 1) and stored in Supabase (Step 2). Maintain order index to determine cover and gallery sequence.
                  </p>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  {/* Upload Drop Zone Trigger */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--neutral-300)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px 16px',
                      backgroundColor: '#ffffff',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: formImages.length > 0 ? 14 : 0,
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                        <Upload size={20} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-800)' }}>
                        Click to Upload or Drag & Drop Product Photos
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                        Supports JPG, PNG, WebP (Automatically reduced & optimized for lightning-fast POS loading)
                      </div>
                    </div>
                  </div>

                  {/* Uploading Status Progress */}
                  {isUploadingImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-sm)', marginBottom: 12, fontSize: '0.78rem', color: 'var(--primary-800)', fontWeight: 600 }}>
                      <Loader2 size={15} className="spin" />
                      <span>{uploadStatusMsg || 'Processing image...'}</span>
                    </div>
                  )}

                  {/* Uploaded Images Ordered Gallery */}
                  {formImages.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                      {formImages.map((img, index) => {
                        const isPrimary = !!img.isPrimary;
                        return (
                          <div
                            key={img.id || index}
                            style={{
                              borderRadius: 'var(--radius-md)',
                              border: `1.5px solid ${isPrimary ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                              backgroundColor: '#ffffff',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              boxShadow: isPrimary ? '0 0 0 2px var(--primary-glow)' : 'var(--shadow-sm)',
                              position: 'relative',
                            }}
                          >
                            {/* Image Header Badges */}
                            <div style={{ position: 'relative', width: '100%', height: 115, backgroundColor: 'var(--neutral-100)' }}>
                              <img
                                src={img.url}
                                alt={img.name || `Image #${index + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              {/* Order Badge */}
                              <div style={{
                                position: 'absolute',
                                top: 6,
                                left: 6,
                                padding: '2px 7px',
                                borderRadius: 4,
                                backgroundColor: isPrimary ? 'var(--primary-600)' : 'rgba(15, 23, 42, 0.75)',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                backdropFilter: 'blur(4px)',
                              }}>
                                #{index + 1} {isPrimary ? '• Primary' : ''}
                              </div>

                              {/* Size Badge */}
                              {img.sizeBytes && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 6,
                                  right: 6,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                                  color: '#ffffff',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                }}>
                                  {formatBytes(img.sizeBytes)}
                                </div>
                              )}
                            </div>

                            {/* Card Controls & Index Ordering */}
                            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {/* Primary Star Toggle */}
                                <button
                                  type="button"
                                  onClick={() => setPrimaryImage(index)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: isPrimary ? 'var(--primary-600)' : 'var(--neutral-500)',
                                    cursor: isPrimary ? 'default' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: 0,
                                  }}
                                  title={isPrimary ? 'Current primary photo' : 'Set as primary photo'}
                                >
                                  <Star size={13} fill={isPrimary ? 'var(--primary-600)' : 'none'} color={isPrimary ? 'var(--primary-600)' : 'var(--neutral-400)'} />
                                  <span>{isPrimary ? 'Cover Photo' : 'Set Cover'}</span>
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => deleteImage(index)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--danger-500)',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                  }}
                                  title="Delete image"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              {/* Order Movement Controls */}
                              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveImage(index, 'LEFT')}
                                  style={{
                                    flex: 1,
                                    padding: '3px 0',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    borderRadius: 4,
                                    border: '1px solid var(--neutral-200)',
                                    backgroundColor: index === 0 ? 'var(--neutral-100)' : '#ffffff',
                                    color: index === 0 ? 'var(--neutral-400)' : 'var(--neutral-700)',
                                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2,
                                  }}
                                  title="Move Left (Earlier in Order)"
                                >
                                  <ArrowLeft size={12} />
                                  <span>Left</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={index === formImages.length - 1}
                                  onClick={() => moveImage(index, 'RIGHT')}
                                  style={{
                                    flex: 1,
                                    padding: '3px 0',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    borderRadius: 4,
                                    border: '1px solid var(--neutral-200)',
                                    backgroundColor: index === formImages.length - 1 ? 'var(--neutral-100)' : '#ffffff',
                                    color: index === formImages.length - 1 ? 'var(--neutral-400)' : 'var(--neutral-700)',
                                    cursor: index === formImages.length - 1 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2,
                                  }}
                                  title="Move Right (Later in Order)"
                                >
                                  <span>Right</span>
                                  <ArrowRight size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Branch-Wise Inventory & Pricing Configuration */}
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      3. Branch-Wise Pricing, Stock & Location Discounts
                    </span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                      Set MRP, cost price, and optional branch discounts (% or ₹ amount) to calculate final POS sale price per branch.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {locations.map((loc) => {
                      const currentLocData: ItemLocationInventory = locationOverrides[loc.id] || {
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

                      const effectivePrice = calculateEffectiveSalePrice(currentLocData);

                      return (
                        <div
                          key={loc.id}
                          style={{
                            padding: 16,
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${currentLocData.isListed ? 'var(--neutral-300)' : 'var(--neutral-200)'}`,
                            backgroundColor: currentLocData.isListed ? '#ffffff' : 'var(--neutral-50)',
                            boxShadow: currentLocData.isListed ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                          }}
                        >
                          {/* Branch Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <MapPin size={17} color="var(--primary-600)" />
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--neutral-900)' }}>
                                {loc.name}
                              </span>
                              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'var(--neutral-100)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {loc.code}
                              </span>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={currentLocData.isListed}
                                onChange={(e) => {
                                  setLocationOverrides({
                                    ...locationOverrides,
                                    [loc.id]: {
                                      ...currentLocData,
                                      isListed: e.target.checked,
                                    },
                                  });
                                }}
                              />
                              <span style={{ color: currentLocData.isListed ? 'var(--success-700)' : 'var(--neutral-500)' }}>
                                {currentLocData.isListed ? '✓ Listed for Sale at this Branch' : '✕ Unlisted (Hidden in POS)'}
                              </span>
                            </label>
                          </div>

                          {currentLocData.isListed ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {/* Pricing & Stock Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                                    Base MRP / List Price (₹) *
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input"
                                    placeholder="100.00"
                                    value={currentLocData.mrp}
                                    onChange={(e) => {
                                      const newMrp = Number(e.target.value);
                                      const updatedLoc = { ...currentLocData, mrp: newMrp };
                                      updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                      setLocationOverrides({
                                        ...locationOverrides,
                                        [loc.id]: updatedLoc,
                                      });
                                    }}
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                                    Purchase / Cost Price (₹)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input"
                                    placeholder="80.00"
                                    value={currentLocData.purchasePrice}
                                    onChange={(e) => {
                                      setLocationOverrides({
                                        ...locationOverrides,
                                        [loc.id]: {
                                          ...currentLocData,
                                          purchasePrice: Number(e.target.value),
                                        },
                                      });
                                    }}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                                    Stock ({formUnit}) *
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    className="form-input"
                                    placeholder="10"
                                    value={currentLocData.currentStock}
                                    onChange={(e) => {
                                      setLocationOverrides({
                                        ...locationOverrides,
                                        [loc.id]: {
                                          ...currentLocData,
                                          currentStock: Number(e.target.value),
                                        },
                                      });
                                    }}
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)', display: 'block', marginBottom: 4 }}>
                                    Low Stock Alert
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    className="form-input"
                                    placeholder="5"
                                    value={currentLocData.minStockAlert}
                                    onChange={(e) => {
                                      setLocationOverrides({
                                        ...locationOverrides,
                                        [loc.id]: {
                                          ...currentLocData,
                                          minStockAlert: Number(e.target.value),
                                        },
                                      });
                                    }}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>
                              </div>

                              {/* Optional Discount Section */}
                              <div style={{ background: 'var(--neutral-50)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', color: 'var(--neutral-800)' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!currentLocData.hasDiscount}
                                    onChange={(e) => {
                                      const updatedLoc = {
                                        ...currentLocData,
                                        hasDiscount: e.target.checked,
                                      };
                                      updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                      setLocationOverrides({
                                        ...locationOverrides,
                                        [loc.id]: updatedLoc,
                                      });
                                    }}
                                  />
                                  <Tag size={15} color="var(--primary-600)" />
                                  <span>Apply Branch Discount (Optional)</span>
                                </label>

                                {currentLocData.hasDiscount && (
                                  <div
                                    style={{
                                      marginTop: 10,
                                      padding: '12px 14px',
                                      background: '#ffffff',
                                      border: '1px solid var(--neutral-200)',
                                      borderRadius: 'var(--radius-sm)',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                                      gap: 14,
                                      alignItems: 'end',
                                    }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 5 }}>
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
                                            [loc.id]: updatedLoc,
                                          });
                                        }}
                                        options={[
                                          { value: 'PERCENT', label: '% Percentage Off MRP', icon: <Percent size={13} />, badge: '%' },
                                          { value: 'FLAT', label: '₹ Flat Amount Off MRP', icon: <DollarSign size={13} />, badge: '₹' },
                                        ]}
                                      />
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)', display: 'block', marginBottom: 5 }}>
                                        Discount Value {currentLocData.discountType === 'PERCENT' ? '(%)' : '(₹)'}
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder={currentLocData.discountType === 'PERCENT' ? 'e.g. 10 (%)' : 'e.g. 20 (₹)'}
                                        value={currentLocData.discountValue || ''}
                                        onChange={(e) => {
                                          const updatedLoc = {
                                            ...currentLocData,
                                            discountValue: Number(e.target.value),
                                          };
                                          updatedLoc.salePrice = calculateEffectiveSalePrice(updatedLoc);
                                          setLocationOverrides({
                                            ...locationOverrides,
                                            [loc.id]: updatedLoc,
                                          });
                                        }}
                                      />
                                    </div>

                                    {/* Real-time Calculation Badge */}
                                    <div
                                      style={{
                                        minWidth: 0,
                                        padding: '8px 12px',
                                        background: 'var(--success-50, #f0fdf4)',
                                        border: '1px solid var(--success-200, #bbf7d0)',
                                        borderRadius: 'var(--radius-sm)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.7rem', color: 'var(--success-800)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                                        Final POS Selling Price
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success-700)' }}>
                                          ₹{effectivePrice.toFixed(2)}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                                          (MRP: <del>₹{Number(currentLocData.mrp || 0).toFixed(2)}</del>)
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '8px 12px', background: 'var(--neutral-100)', borderRadius: 4, fontSize: '0.78rem', color: 'var(--neutral-600)' }}>
                              This product is marked as unlisted for this branch and will not appear in POS billing or branch catalogs.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ flexShrink: 0, padding: '14px 24px', borderTop: '1px solid var(--neutral-200)', background: 'var(--neutral-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: '0.82rem', color: isSaving ? 'var(--primary-700)' : 'var(--neutral-500)', fontWeight: 600 }}>
                  {uploadStatusMsg || (formImages.some(img => img.pendingCompressed) ? `📸 ${formImages.filter(img => img.pendingCompressed).length} new image(s) staged to upload on save` : '')}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving || isUploadingImage}>
                    {isSaving ? 'Uploading & Saving...' : (editingItem ? 'Save Product & Pricing' : 'Create Product')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedItemForAdjust && (
        <div className="modal-overlay" onClick={() => setIsAdjustModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="card-header">
              <h3 className="card-title">Adjust Stock Level</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAdjustModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleStockAdjustment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--neutral-900)' }}>
                    {selectedItemForAdjust.name}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>
                    Code: {selectedItemForAdjust.publicItemId} | Current Stock: {selectedItemForAdjust.currentStock} {selectedItemForAdjust.unit}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 5 }}>
                    Branch Location
                  </label>
                  <CustomSelect
                    value={adjustLocationId}
                    onChange={(val) => setAdjustLocationId(String(val))}
                    options={locations.map((loc) => ({
                      value: loc.id,
                      label: loc.name,
                      badge: loc.code,
                      icon: <MapPin size={13} />,
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Adjustment Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      className={`btn ${adjustType === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setAdjustType('ADD')}
                    >
                      + Add Stock (In)
                    </button>
                    <button
                      type="button"
                      className={`btn ${adjustType === 'REDUCE' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => setAdjustType('REDUCE')}
                    >
                      - Reduce (Damaged/Lost)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Quantity ({selectedItemForAdjust.unit}) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem' }}>Category Name</th>
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem' }}>Description</th>
                        <th style={{ padding: '8px 12px', fontSize: '0.72rem', width: '110px' }}>Tagged Items</th>
                        {canManage && <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.72rem', width: '70px' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {categoriesList
                        .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()) || (c.description && c.description.toLowerCase().includes(categorySearch.toLowerCase())))
                        .map((cat) => {
                          const itemCount = rawItems.filter(i => i.category.toLowerCase() === cat.name.toLowerCase()).length;
                          return (
                            <tr key={cat.id}>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.85rem' }}>
                                📁 {cat.name}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--neutral-600)', fontSize: '0.8rem' }}>
                                {cat.description || <span style={{ color: 'var(--neutral-400)', fontStyle: 'italic' }}>No description</span>}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: itemCount > 0 ? 'var(--primary-50)' : 'var(--neutral-100)', color: itemCount > 0 ? 'var(--primary-700)' : 'var(--neutral-500)', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                </span>
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                                  <button
                                    className="btn btn-secondary btn-icon btn-sm"
                                    title="Delete Category"
                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                    style={{ color: 'var(--danger-500)', padding: 4 }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
    </div>
  );
};
