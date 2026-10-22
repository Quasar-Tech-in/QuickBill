import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Item, ItemCategory, InventoryMovement } from '../types';
import { PrintLabelModal } from '../components/PrintLabelModal';
import { QRScannerModal } from '../components/QRScannerModal';

const ADJUSTMENT_REASONS = [
  'Physical Stock Count Surplus',
  'Defective / Damaged',
  'Expired',
  'Theft / Loss',
  'Internal Consumption',
  'Restock Inward',
];

export const ItemsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'LEDGER'>('CATALOG');
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [categories, setCategories] = useState<ItemCategory[]>(() => store.getCategories());
  const [movements, setMovements] = useState<InventoryMovement[]>(() => store.getInventoryMovements());
  const [user, setUser] = useState(() => store.getActiveUser());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN'>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical Stock Count Surplus');
  const [adjustCostInput, setAdjustCostInput] = useState('');
  const [adjustNotesInput, setAdjustNotesInput] = useState('');
  const [printingLabelItem, setPrintingLabelItem] = useState<Item | null>(null);
  const [isScanningForField, setIsScanningForField] = useState<'SKU' | 'BARCODE' | null>(null);

  // Form State
  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemCategory, setItemCategory] = useState('Grocery');
  const [itemSalePrice, setItemSalePrice] = useState('');
  const [itemPurchasePrice, setItemPurchasePrice] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemTaxRate, setItemTaxRate] = useState('5');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemAllowParts, setItemAllowParts] = useState(false);

  const canManageItems = user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    store.fetchInventoryMovements();
    const unsubscribe = store.subscribe(() => {
      setItems(store.getItems());
      setCategories(store.getCategories());
      setMovements(store.getInventoryMovements());
      setUser(store.getActiveUser());
    });
    return () => { unsubscribe(); };
  }, []);

  const openCreateModal = () => {
    setItemName('');
    setItemSku('');
    setItemBarcode('');
    setItemCategory(categories[0]?.name || 'Grocery');
    setItemSalePrice('');
    setItemPurchasePrice('');
    setItemStock('');
    setItemMinStock('5');
    setItemTaxRate('5');
    setItemUnit('pcs');
    setItemAllowParts(false);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemSku(item.sku || '');
    setItemBarcode(item.barcode || '');
    setItemCategory(item.category);
    setItemSalePrice(String(item.salePrice));
    setItemPurchasePrice(String(item.purchasePrice));
    setItemStock(String(item.currentStock));
    setItemMinStock(String(item.minStockAlert ?? 5));
    setItemTaxRate(String(item.taxRate));
    setItemUnit(item.unit);
    setItemAllowParts(!!item.allowParts);
  };

  const openAdjustModal = (item: Item) => {
    setAdjustingItem(item);
    setAdjustQtyInput('');
    setAdjustReason('Physical Stock Count Surplus');
    setAdjustCostInput(item.purchasePrice ? String(item.purchasePrice) : '');
    setAdjustNotesInput('');
  };

  const handleAutoGenerateSku = () => {
    const rawCat = (itemCategory || 'GEN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = rawCat.length >= 3 ? rawCat.substring(0, 3) : 'GEN';
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    setItemSku(`INT-SKU-${prefix}-${randSuffix}`);
  };

  const handleAutoGenerateBarcode = () => {
    const middleDigits = String(Math.floor(100000000 + Math.random() * 900000000));
    setItemBarcode(`INT-${middleDigits}`);
  };

  // Collision detection for duplicate SKU and Barcode
  const skuCollision = itemSku.trim()
    ? items.find(i => i.sku?.toLowerCase() === itemSku.trim().toLowerCase() && i.id !== editingItem?.id)
    : null;

  const barcodeCollision = itemBarcode.trim()
    ? items.find(i => i.barcode?.toLowerCase() === itemBarcode.trim().toLowerCase() && i.id !== editingItem?.id)
    : null;

  const filteredItems = items.filter(item => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || 
      item.name.toLowerCase().includes(q) || 
      (item.sku && item.sku.toLowerCase().includes(q)) || 
      (item.barcode && item.barcode.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const filteredMovements = movements.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      m.itemName.toLowerCase().includes(q) || 
      (m.sku && m.sku.toLowerCase().includes(q)) || 
      (m.referenceNumber && m.referenceNumber.toLowerCase().includes(q)) ||
      (m.reason && m.reason.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (ledgerFilter === 'ALL') return true;
    const mType = (m.type || m.movementType || '').toUpperCase();
    if (ledgerFilter === 'SALE') return mType === 'SALE';
    if (ledgerFilter === 'PURCHASE') return mType === 'PURCHASE';
    if (ledgerFilter === 'ADJUSTMENT') return mType === 'MANUAL_ADJUSTMENT' || mType === 'ADJUSTMENT';
    if (ledgerFilter === 'RETURN') return mType.includes('RETURN') || mType === 'DAMAGED';
    return true;
  });

  const handleSaveItem = () => {
    if (!itemName.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }

    if (skuCollision) {
      Alert.alert(
        'Duplicate SKU Detected', 
        `The SKU "${itemSku}" is already assigned to "${skuCollision.name}". Each SKU must be unique.`
      );
      return;
    }

    if (barcodeCollision) {
      Alert.alert(
        'Duplicate Barcode Detected', 
        `The Barcode "${itemBarcode}" is already assigned to "${barcodeCollision.name}". Each Barcode must be unique.`
      );
      return;
    }

    const salePrice = parseFloat(itemSalePrice) || 0;
    const purchasePrice = parseFloat(itemPurchasePrice) || 0;
    const currentStock = parseFloat(itemStock) || 0;
    const minStockAlert = parseFloat(itemMinStock) || 5;
    const taxRate = parseFloat(itemTaxRate) || 0;

    if (editingItem) {
      const updated: Item = {
        ...editingItem,
        name: itemName.trim(),
        sku: itemSku.trim() || undefined,
        barcode: itemBarcode.trim() || undefined,
        category: itemCategory,
        salePrice,
        mrp: salePrice,
        purchasePrice,
        currentStock,
        minStockAlert,
        taxRate,
        unit: itemUnit,
        allowParts: itemAllowParts,
      };
      store.saveItem(updated);
      setEditingItem(null);
      Alert.alert('Item Updated', 'Product catalog record saved successfully.');
    } else {
      const publicItemId = `ITM-${1000 + items.length + 1}`;
      const newItem: Item = {
        id: `itm-${Date.now()}`,
        publicItemId,
        name: itemName.trim(),
        sku: itemSku.trim() || undefined,
        barcode: itemBarcode.trim() || undefined,
        category: itemCategory,
        salePrice,
        mrp: salePrice,
        purchasePrice,
        currentStock,
        minStockAlert,
        taxRate,
        unit: itemUnit,
        allowParts: itemAllowParts,
      };
      store.saveItem(newItem);
      setIsCreateModalOpen(false);
      Alert.alert('Item Created', 'New product added to catalog.');
    }
  };

  const handleDeleteItem = (item: Item) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${item.name}" from the inventory catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            store.deleteItem(item.id);
            Alert.alert('Deleted', 'Item removed from inventory.');
          }
        }
      ]
    );
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    store.addCategory({
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      type: 'PRODUCT',
    });
    setNewCatName('');
  };

  const handleDeleteCategory = (catId: string, catName: string) => {
    Alert.alert(
      'Delete Category',
      `Delete category "${catName}"? Items in this category will remain unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => store.deleteCategory(catId)
        }
      ]
    );
  };

  const handleConfirmStockAdjustment = (isAddition: boolean) => {
    if (!adjustingItem) return;
    const qty = parseFloat(adjustQtyInput) || 0;
    if (qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid stock amount.');
      return;
    }
    const delta = isAddition ? qty : -qty;
    const unitCost = parseFloat(adjustCostInput) || adjustingItem.purchasePrice || 0;
    store.adjustStock(
      adjustingItem.id, 
      delta, 
      adjustReason, 
      unitCost, 
      adjustNotesInput.trim() || undefined
    );
    setAdjustingItem(null);
    setAdjustQtyInput('');
    setAdjustNotesInput('');
    Alert.alert(
      'Stock Ledger Updated', 
      `${isAddition ? 'Added' : 'Deducted'} ${qty} ${adjustingItem.unit} recorded into immutable movement ledger.`
    );
  };

  return (
    <View style={styles.container}>
      {/* Primary Segmented Switcher: Catalog vs Stock Ledger */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'CATALOG' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('CATALOG')}
        >
          <Text style={[styles.segmentBtnText, activeTab === 'CATALOG' && styles.segmentBtnTextActive]}>
            📦 Catalog ({items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'LEDGER' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('LEDGER')}
        >
          <Text style={[styles.segmentBtnText, activeTab === 'LEDGER' && styles.segmentBtnTextActive]}>
            📖 Stock Ledger ({movements.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Top Search & Action Bar */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'CATALOG' 
              ? '🔍 Search catalog by name, SKU, barcode...' 
              : '🔍 Search ledger by product, SKU, invoice #...'
          }
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {activeTab === 'CATALOG' && canManageItems && (
          <>
            <TouchableOpacity style={styles.catBtn} onPress={() => setIsCategoryModalOpen(true)}>
              <Text style={styles.catBtnText}>📁 Cats</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
              <Text style={styles.createBtnText}>+ Add</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* CATALOG VIEW */}
      {activeTab === 'CATALOG' && (
        <>
          {/* Category Pills */}
          <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.surface.border }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {['ALL', ...categories.map(c => c.name)].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Item List */}
          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptySub}>Add products to start inventory tracking and fast barcode billing.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const threshold = item.minStockAlert !== undefined ? item.minStockAlert : 5;
              const isOut = item.currentStock <= 0;
              const isLow = !isOut && item.currentStock <= threshold;
              const margin = item.salePrice > 0 ? (((item.salePrice - item.purchasePrice) / item.salePrice) * 100).toFixed(0) : '0';

              return (
                <View style={styles.itemCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.itemTagsRow}>
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText}>{item.category}</Text>
                        </View>
                        <Text style={styles.itemMeta}>
                          GST {item.taxRate}% • {item.unit} • Alert &lt;= {threshold}
                        </Text>
                      </View>
                      <Text style={styles.itemCodesText}>
                        SKU: {item.sku || 'N/A'} • Barcode: {item.barcode || 'N/A'}
                      </Text>
                    </View>

                    <View style={[
                      styles.stockBadge, 
                      isOut ? styles.stockBadgeOut : (isLow ? styles.stockBadgeLow : styles.stockBadgeNormal)
                    ]}>
                      <Text style={[
                        styles.stockBadgeText, 
                        isOut ? styles.stockTextOut : (isLow ? styles.stockTextLow : styles.stockTextNormal)
                      ]}>
                        {isOut ? 'Out of Stock' : `${item.currentStock} ${item.unit}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.priceLabel}>Selling Price</Text>
                      <Text style={styles.priceValue}>₹ {item.salePrice.toFixed(2)}</Text>
                      {item.mrp !== undefined && item.mrp > item.salePrice ? (
                        <Text style={styles.mrpText}>MRP: ₹{item.mrp.toFixed(2)}</Text>
                      ) : null}
                    </View>

                    <View>
                      <Text style={styles.priceLabel}>Purchase Cost</Text>
                      <Text style={styles.purchasePriceValue}>₹ {item.purchasePrice.toFixed(2)}</Text>
                      <Text style={styles.marginText}>Margin: {margin}%</Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.cardActions}>
                      {canManageItems && (
                        <TouchableOpacity 
                          style={styles.actionIconBtn} 
                          onPress={() => openAdjustModal(item)}
                        >
                          <Text style={styles.actionIconText}>⚖️ Stock</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity 
                        style={styles.actionIconBtn} 
                        onPress={() => setPrintingLabelItem(item)}
                      >
                        <Text style={styles.actionIconText}>🏷️ Label</Text>
                      </TouchableOpacity>

                      {canManageItems && (
                        <>
                          <TouchableOpacity 
                            style={styles.actionIconBtn} 
                            onPress={() => openEditModal(item)}
                          >
                            <Text style={styles.actionIconText}>✏️ Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.actionIconBtn, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]} 
                            onPress={() => handleDeleteItem(item)}
                          >
                            <Text style={[styles.actionIconText, { color: colors.danger[600] }]}>🗑️</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* STOCK LEDGER VIEW */}
      {activeTab === 'LEDGER' && (
        <>
          {/* Movement Filter Chips */}
          <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.surface.border }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {[
                { id: 'ALL', label: 'All Operations' },
                { id: 'SALE', label: '🛒 Sales Outward' },
                { id: 'PURCHASE', label: '📥 Purchases Inward' },
                { id: 'ADJUSTMENT', label: '⚖️ Physical Adjustments' },
                { id: 'RETURN', label: '↩️ Returns & Damage' },
              ].map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.categoryChip,
                    ledgerFilter === f.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setLedgerFilter(f.id as any)}
                >
                  <Text style={[styles.categoryChipText, ledgerFilter === f.id && styles.categoryChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Ledger Stream */}
          <FlatList
            data={filteredMovements}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📖</Text>
                <Text style={styles.emptyTitle}>No Stock Movements</Text>
                <Text style={styles.emptySub}>
                  Stock transactions from Sales, Purchases, Returns, and Adjustments will be recorded here immutably.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mType = (item.type || item.movementType || 'MANUAL_ADJUSTMENT').toUpperCase();
              const isPositive = item.quantityChange > 0;
              const isZero = item.quantityChange === 0;

              let badgeBg = '#ecfdf5';
              let badgeBorder = '#a7f3d0';
              let badgeColor = '#047857';
              let typeLabel = 'MANUAL ADJUSTMENT';

              if (mType === 'SALE') {
                badgeBg = '#fef2f2';
                badgeBorder = '#fecaca';
                badgeColor = '#b91c1c';
                typeLabel = 'SALE OUTWARD';
              } else if (mType === 'PURCHASE') {
                badgeBg = '#ecfdf5';
                badgeBorder = '#a7f3d0';
                badgeColor = '#047857';
                typeLabel = 'PURCHASE INWARD';
              } else if (mType.includes('RETURN')) {
                badgeBg = '#f5f3ff';
                badgeBorder = '#ddd6fe';
                badgeColor = '#6d28d9';
                typeLabel = 'SALES RETURN';
              } else if (mType === 'DAMAGED') {
                badgeBg = '#fffbeb';
                badgeBorder = '#fde68a';
                badgeColor = '#b45309';
                typeLabel = 'DAMAGED (NOT RESTOCKED)';
              }

              return (
                <View style={styles.movementCard}>
                  <View style={styles.movementHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.movementItemName}>{item.itemName}</Text>
                      <Text style={styles.movementItemSku}>SKU: {item.sku || 'N/A'}</Text>
                    </View>

                    <View style={[styles.movementBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                      <Text style={[styles.movementBadgeText, { color: badgeColor }]}>
                        {isPositive ? `+${item.quantityChange}` : (isZero ? '0' : `${item.quantityChange}`)} units
                      </Text>
                    </View>
                  </View>

                  <View style={styles.movementMetaRow}>
                    <View style={[styles.typePill, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.typePillText, { color: badgeColor }]}>{typeLabel}</Text>
                    </View>
                    <Text style={styles.stockTransitionText}>
                      Stock: {item.quantityBefore} ➔ {item.quantityAfter}
                    </Text>
                  </View>

                  <View style={styles.movementDetailBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={styles.movementDetailKey}>Unit Valuation:</Text>
                      <Text style={styles.movementDetailVal}>₹ {item.unitCost.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={styles.movementDetailKey}>Reason / Ref:</Text>
                      <Text style={styles.movementDetailVal}>{item.reason || item.referenceNumber || 'Stock Mutation'}</Text>
                    </View>
                    {item.notes ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={styles.movementDetailKey}>Remarks:</Text>
                        <Text style={[styles.movementDetailVal, { fontStyle: 'italic' }]}>{item.notes}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.movementFooter}>
                    <Text style={styles.movementTimestamp}>
                      🕒 {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    <Text style={styles.movementActor}>
                      👤 {item.createdByName || 'Staff'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAdjustingItem(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>⚖️ Adjust Physical Stock</Text>
              <Text style={styles.modalSub}>
                {adjustingItem.name} • Current Stock: {adjustingItem.currentStock} {adjustingItem.unit}
              </Text>

              <Text style={styles.fieldLabel}>Adjustment Reason</Text>
              <View style={styles.reasonRow}>
                {ADJUSTMENT_REASONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonChip, adjustReason === r && styles.reasonChipActive]}
                    onPress={() => setAdjustReason(r)}
                  >
                    <Text style={[styles.reasonChipText, adjustReason === r && styles.reasonChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Quantity ({adjustingItem.unit}) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 5"
                    value={adjustQtyInput}
                    onChangeText={setAdjustQtyInput}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Unit Valuation Cost (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={String(adjustingItem.purchasePrice || '0')}
                    value={adjustCostInput}
                    onChangeText={setAdjustCostInput}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.quickAdjustChipsRow}>
                {['1', '5', '10', '25', '50'].map(q => (
                  <TouchableOpacity
                    key={q}
                    style={styles.quickAdjustChip}
                    onPress={() => setAdjustQtyInput(q)}
                  >
                    <Text style={styles.quickAdjustChipText}>+{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes / Audit Remarks</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Verified by Store Manager during weekly audit"
                value={adjustNotesInput}
                onChangeText={setAdjustNotesInput}
              />

              <View style={styles.adjustBtnRow}>
                <TouchableOpacity 
                  style={[styles.adjustBtn, { backgroundColor: colors.success[600] }]}
                  onPress={() => handleConfirmStockAdjustment(true)}
                >
                  <Text style={styles.adjustBtnText}>+ Inward / Add Stock</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.adjustBtn, { backgroundColor: colors.danger[600] }]}
                  onPress={() => handleConfirmStockAdjustment(false)}
                >
                  <Text style={styles.adjustBtnText}>- Outward / Reduce</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdjustingItem(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Create / Edit Item Modal */}
      <Modal 
        visible={isCreateModalOpen || !!editingItem} 
        transparent 
        animationType="slide" 
        onRequestClose={() => {
          setIsCreateModalOpen(false);
          setEditingItem(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Product' : 'Add New Product'}</Text>
            
            <ScrollView style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Product Name *</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="e.g. Organic Almond Milk 1L" 
                value={itemName} 
                onChangeText={setItemName} 
              />

              {/* SKU & Barcode with Scan and Collision Alert */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.fieldLabel}>SKU</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => setIsScanningForField('SKU')}>
                        <Text style={styles.formActionLink}>⚡ Scan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleAutoGenerateSku}>
                        <Text style={styles.formActionLink}>⚡ Auto</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput 
                    style={[styles.modalInput, !!skuCollision && styles.inputWarning]} 
                    placeholder="e.g. INT-SKU-GRO-8421" 
                    value={itemSku} 
                    onChangeText={setItemSku} 
                  />
                  {skuCollision && (
                    <Text style={styles.collisionAlertText}>
                      ⚠️ SKU used by "{skuCollision.name}"
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.fieldLabel}>Barcode</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => setIsScanningForField('BARCODE')}>
                        <Text style={styles.formActionLink}>⚡ Scan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleAutoGenerateBarcode}>
                        <Text style={styles.formActionLink}>⚡ Auto</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput 
                    style={[styles.modalInput, !!barcodeCollision && styles.inputWarning]} 
                    placeholder="e.g. INT-123456789" 
                    value={itemBarcode} 
                    onChangeText={setItemBarcode} 
                  />
                  {barcodeCollision && (
                    <Text style={styles.collisionAlertText}>
                      ⚠️ Barcode used by "{barcodeCollision.name}"
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[styles.catSelectChip, itemCategory === c.name && styles.catSelectChipActive]}
                    onPress={() => setItemCategory(c.name)}
                  >
                    <Text style={[styles.catSelectChipText, itemCategory === c.name && styles.catSelectChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Selling Price (₹) *</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="0.00" 
                    value={itemSalePrice} 
                    onChangeText={setItemSalePrice} 
                    keyboardType="decimal-pad" 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Purchase Cost (₹)</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="0.00" 
                    value={itemPurchasePrice} 
                    onChangeText={setItemPurchasePrice} 
                    keyboardType="decimal-pad" 
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Opening / Stock Qty</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="0" 
                    value={itemStock} 
                    onChangeText={setItemStock} 
                    keyboardType="decimal-pad" 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Low Stock Alert Level</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="5" 
                    value={itemMinStock} 
                    onChangeText={setItemMinStock} 
                    keyboardType="decimal-pad" 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    placeholder="pcs / kg" 
                    value={itemUnit} 
                    onChangeText={setItemUnit} 
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>GST Tax Rate (%)</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {['0', '5', '12', '18', '28'].map(tax => (
                  <TouchableOpacity
                    key={tax}
                    style={[styles.taxChip, itemTaxRate === tax && styles.taxChipActive]}
                    onPress={() => setItemTaxRate(tax)}
                  >
                    <Text style={[styles.taxChipText, itemTaxRate === tax && styles.taxChipTextActive]}>
                      {tax}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.partsToggle, itemAllowParts && styles.partsToggleActive]}
                onPress={() => setItemAllowParts(!itemAllowParts)}
              >
                <Text style={styles.partsToggleText}>
                  {itemAllowParts ? '✓ Allow Fractional Sales (e.g. 1.5 kg)' : '○ Allow Fractional Sales (Off)'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setIsCreateModalOpen(false);
                  setEditingItem(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveItemBtn} onPress={handleSaveItem}>
                <Text style={styles.saveItemBtnText}>{editingItem ? 'Save Changes' : 'Save Product'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Master Modal */}
      {isCategoryModalOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsCategoryModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxHeight: '80%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.modalTitle}>📁 Manage Categories</Text>
                <TouchableOpacity onPress={() => setIsCategoryModalOpen(false)}>
                  <Text style={{ fontSize: 18, color: colors.neutral[600], padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="New Category Name (e.g. Beverages)"
                  value={newCatName}
                  onChangeText={setNewCatName}
                />
                <TouchableOpacity style={styles.addCatBtn} onPress={handleCreateCategory}>
                  <Text style={styles.addCatBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 260 }}>
                {categories.map(c => (
                  <View key={c.id} style={styles.catRow}>
                    <Text style={styles.catRowName}>{c.name}</Text>
                    <TouchableOpacity onPress={() => handleDeleteCategory(c.id, c.name)}>
                      <Text style={{ fontSize: 15 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Label Print Modal */}
      {printingLabelItem && (
        <PrintLabelModal
          visible={true}
          itemName={printingLabelItem.name}
          itemSku={printingLabelItem.sku || printingLabelItem.publicItemId}
          itemBarcode={printingLabelItem.barcode || printingLabelItem.sku || printingLabelItem.publicItemId}
          itemPrice={printingLabelItem.salePrice}
          itemMrp={printingLabelItem.mrp || printingLabelItem.salePrice}
          defaultStockCount={Math.floor(printingLabelItem.currentStock)}
          onClose={() => setPrintingLabelItem(null)}
        />
      )}

      {/* Barcode Scanner Modal for Product Form (Primary Barcode Scanner with Camera Toggle) */}
      {isScanningForField && (
        <QRScannerModal
          visible={true}
          initialStandbyMode={false}
          initialMode="SCANNER"
          title={isScanningForField === 'SKU' ? 'Scan Product SKU' : 'Scan Product Barcode'}
          onClose={() => setIsScanningForField(null)}
          onScanSuccess={(scannedCode) => {
            if (isScanningForField === 'SKU') {
              setItemSku(scannedCode);
            } else if (isScanningForField === 'BARCODE') {
              setItemBarcode(scannedCode);
            }
            setIsScanningForField(null);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  segmentBtnActive: {
    backgroundColor: colors.primary[600],
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  segmentBtnTextActive: {
    color: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  catBtn: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  catBtnText: {
    color: colors.neutral[700],
    fontWeight: '700',
    fontSize: 12,
  },
  createBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary[500],
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  itemTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  categoryPill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  itemMeta: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  itemCodesText: {
    fontSize: 10,
    color: colors.neutral[400],
    marginTop: 3,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockBadgeNormal: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  stockBadgeLow: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  stockBadgeOut: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stockTextNormal: { color: '#047857' },
  stockTextLow: { color: '#b45309' },
  stockTextOut: { color: '#b91c1c' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  priceLabel: {
    fontSize: 10,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  mrpText: {
    fontSize: 10,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  purchasePriceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  marginText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  emptySub: {
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  // Movement Cards
  movementCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 10,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  movementItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  movementItemSku: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 1,
  },
  movementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  movementBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  movementMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stockTransitionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  movementDetailBox: {
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  movementDetailKey: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  movementDetailVal: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  movementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 6,
  },
  movementTimestamp: {
    fontSize: 10,
    color: colors.neutral[400],
  },
  movementActor: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  // Modal styles
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  reasonChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  reasonChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  reasonChipText: {
    fontSize: 11,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: colors.primary[700],
    fontWeight: '800',
  },
  quickAdjustChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  quickAdjustChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickAdjustChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  modalSub: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  inputWarning: {
    borderColor: '#f87171',
    backgroundColor: '#fff1f2',
  },
  collisionAlertText: {
    fontSize: 10,
    color: '#b91c1c',
    fontWeight: '700',
    marginBottom: 6,
  },
  formActionLink: {
    fontSize: 11,
    color: colors.primary[600],
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: 4,
  },
  adjustBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  adjustBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  adjustBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  saveItemBtn: {
    flex: 2,
    backgroundColor: colors.primary[500],
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveItemBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  partsToggle: {
    backgroundColor: colors.neutral[100],
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  partsToggleActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  partsToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  catSelectChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  catSelectChipActive: {
    backgroundColor: colors.primary[500],
  },
  catSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  catSelectChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  taxChip: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  taxChipActive: {
    backgroundColor: colors.primary[500],
  },
  taxChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  taxChipTextActive: {
    color: '#fff',
  },
  addCatBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCatBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  catRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[900],
  },
});
