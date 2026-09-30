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
import { Item, ItemCategory } from '../types';
import { PrintLabelModal } from '../components/PrintLabelModal';

export const ItemsScreen: React.FC = () => {
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [categories, setCategories] = useState<ItemCategory[]>(() => store.getCategories());
  const [user, setUser] = useState(() => store.getActiveUser());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('Restock');
  const [printingLabelItem, setPrintingLabelItem] = useState<Item | null>(null);

  // Form State
  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemCategory, setItemCategory] = useState('Grocery');
  const [itemSalePrice, setItemSalePrice] = useState('');
  const [itemPurchasePrice, setItemPurchasePrice] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemTaxRate, setItemTaxRate] = useState('5');
  const [itemUnit, setItemUnit] = useState('pcs');
  const [itemAllowParts, setItemAllowParts] = useState(false);

  const canManageItems = user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setItems(store.getItems());
      setCategories(store.getCategories());
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
    setItemTaxRate(String(item.taxRate));
    setItemUnit(item.unit);
    setItemAllowParts(!!item.allowParts);
  };

  const filteredItems = items.filter(item => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || 
      item.name.toLowerCase().includes(q) || 
      (item.sku && item.sku.toLowerCase().includes(q)) || 
      (item.barcode && item.barcode.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const handleSaveItem = () => {
    if (!itemName.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }
    const salePrice = parseFloat(itemSalePrice) || 0;
    const purchasePrice = parseFloat(itemPurchasePrice) || 0;
    const currentStock = parseFloat(itemStock) || 0;
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
        taxRate,
        unit: itemUnit,
        minStockAlert: 5,
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
    store.adjustStock(adjustingItem.id, delta, adjustReason);
    setAdjustingItem(null);
    setAdjustQtyInput('');
  };

  return (
    <View style={styles.container}>
      {/* Top Search & Action Bar */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search inventory by name, SKU, barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {canManageItems && (
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
        renderItem={({ item }) => {
          const isLowStock = item.currentStock <= item.minStockAlert;
          return (
            <View style={styles.itemCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    SKU: {item.sku || 'N/A'} • Barcode: {item.barcode || 'N/A'} • {item.category} • GST {item.taxRate}%
                  </Text>
                </View>
                <View style={[styles.stockBadge, isLowStock ? styles.stockBadgeLow : styles.stockBadgeNormal]}>
                  <Text style={[styles.stockBadgeText, isLowStock ? styles.stockTextLow : styles.stockTextNormal]}>
                    {item.currentStock} {item.unit}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.priceLabel}>Selling Price (MRP)</Text>
                  <Text style={styles.priceValue}>₹ {item.salePrice.toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={styles.priceLabel}>Purchase Price</Text>
                  <Text style={styles.priceValue}>₹ {item.purchasePrice.toFixed(2)}</Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  {canManageItems && (
                    <TouchableOpacity 
                      style={styles.actionIconBtn} 
                      onPress={() => setAdjustingItem(item)}
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
                        style={[styles.actionIconBtn, { borderColor: '#fca5a5' }]} 
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

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAdjustingItem(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Adjust Stock: {adjustingItem.name}</Text>
              <Text style={styles.modalSub}>Current Stock: {adjustingItem.currentStock} {adjustingItem.unit}</Text>

              <TextInput
                style={styles.modalInput}
                placeholder={`Enter quantity in ${adjustingItem.unit}`}
                value={adjustQtyInput}
                onChangeText={setAdjustQtyInput}
                keyboardType="decimal-pad"
              />

              <View style={styles.adjustBtnRow}>
                <TouchableOpacity 
                  style={[styles.adjustBtn, { backgroundColor: colors.success[500] }]}
                  onPress={() => handleConfirmStockAdjustment(true)}
                >
                  <Text style={styles.adjustBtnText}>+ Inward / Add Stock</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.adjustBtn, { backgroundColor: colors.danger[500] }]}
                  onPress={() => handleConfirmStockAdjustment(false)}
                >
                  <Text style={styles.adjustBtnText}>- Outward / Damage</Text>
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
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Product' : 'Add New Product'}</Text>
            <ScrollView style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Product Name *</Text>
              <TextInput style={styles.modalInput} placeholder="e.g. Organic Almond Milk 1L" value={itemName} onChangeText={setItemName} />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>SKU</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. ALM-01" value={itemSku} onChangeText={setItemSku} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Barcode</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. 8901030381001" value={itemBarcode} onChangeText={setItemBarcode} />
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
                  <Text style={styles.fieldLabel}>MRP / Selling Price (₹) *</Text>
                  <TextInput style={styles.modalInput} placeholder="0.00" value={itemSalePrice} onChangeText={setItemSalePrice} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Purchase Price (₹)</Text>
                  <TextInput style={styles.modalInput} placeholder="0.00" value={itemPurchasePrice} onChangeText={setItemPurchasePrice} keyboardType="decimal-pad" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Stock Quantity</Text>
                  <TextInput style={styles.modalInput} placeholder="0" value={itemStock} onChangeText={setItemStock} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput style={styles.modalInput} placeholder="pcs / kg / ltr" value={itemUnit} onChangeText={setItemUnit} />
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
          itemPrice={printingLabelItem.salePrice}
          itemMrp={printingLabelItem.mrp || printingLabelItem.salePrice}
          defaultStockCount={Math.floor(printingLabelItem.currentStock)}
          onClose={() => setPrintingLabelItem(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
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
  itemMeta: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockBadgeNormal: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  stockBadgeLow: {
    backgroundColor: colors.danger[50],
    borderWidth: 1,
    borderColor: colors.danger[100],
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stockTextNormal: { color: colors.success[700] },
  stockTextLow: { color: colors.danger[700] },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  priceLabel: {
    fontSize: 10,
    color: colors.neutral[600],
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
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
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionIconText: {
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
    marginBottom: 10,
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
  catBtn: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  catBtnText: {
    color: colors.neutral[800],
    fontWeight: '700',
    fontSize: 12,
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
