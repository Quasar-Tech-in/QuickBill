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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [adjustQtyInput, setAdjustQtyInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('Restock');
  const [printingLabelItem, setPrintingLabelItem] = useState<Item | null>(null);

  // New Item State
  const [newItemName, setNewItemName] = useState('');
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Grocery');
  const [newItemSalePrice, setNewItemSalePrice] = useState('');
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState('');
  const [newItemStock, setNewItemStock] = useState('');
  const [newItemTaxRate, setNewItemTaxRate] = useState('5');
  const [newItemUnit, setNewItemUnit] = useState('pcs');
  const [newItemAllowParts, setNewItemAllowParts] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setItems(store.getItems());
      setCategories(store.getCategories());
    });
    return () => { unsubscribe(); };
  }, []);

  const filteredItems = items.filter(item => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || 
      item.name.toLowerCase().includes(q) || 
      (item.sku && item.sku.toLowerCase().includes(q)) || 
      (item.barcode && item.barcode.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const handleSaveNewItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }
    const salePrice = parseFloat(newItemSalePrice) || 0;
    const purchasePrice = parseFloat(newItemPurchasePrice) || 0;
    const currentStock = parseFloat(newItemStock) || 0;
    const taxRate = parseFloat(newItemTaxRate) || 0;

    const publicItemId = `ITM-${1000 + items.length + 1}`;

    const newItem: Item = {
      id: `itm-${Date.now()}`,
      publicItemId,
      name: newItemName.trim(),
      sku: newItemSku.trim() || undefined,
      barcode: newItemBarcode.trim() || undefined,
      category: newItemCategory,
      salePrice,
      purchasePrice,
      currentStock,
      taxRate,
      unit: newItemUnit,
      minStockAlert: 5,
      allowParts: newItemAllowParts,
    };

    store.saveItem(newItem);
    setIsCreateModalOpen(false);
    // Reset
    setNewItemName('');
    setNewItemSku('');
    setNewItemBarcode('');
    setNewItemSalePrice('');
    setNewItemPurchasePrice('');
    setNewItemStock('');
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
      {/* Top Search & Create Bar */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search inventory by name, SKU, barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateModalOpen(true)}>
          <Text style={styles.createBtnText}>+ Add Item</Text>
        </TouchableOpacity>
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
                    SKU: {item.sku || 'N/A'} • Barcode: {item.barcode || 'N/A'} • {item.category}
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
                  <Text style={styles.priceLabel}>Selling Price</Text>
                  <Text style={styles.priceValue}>₹ {item.salePrice.toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={styles.priceLabel}>Purchase Price</Text>
                  <Text style={styles.priceValue}>₹ {item.purchasePrice.toFixed(2)}</Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={styles.actionIconBtn} 
                    onPress={() => setAdjustingItem(item)}
                  >
                    <Text style={styles.actionIconText}>⚖️ Stock</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionIconBtn} 
                    onPress={() => setPrintingLabelItem(item)}
                  >
                    <Text style={styles.actionIconText}>🏷️ Label</Text>
                  </TouchableOpacity>
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

      {/* Create New Item Modal */}
      <Modal visible={isCreateModalOpen} transparent animationType="slide" onRequestClose={() => setIsCreateModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Add New Product</Text>
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Product Name *</Text>
              <TextInput style={styles.modalInput} placeholder="e.g. Organic Almond Milk 1L" value={newItemName} onChangeText={setNewItemName} />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>SKU</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. ALM-01" value={newItemSku} onChangeText={setNewItemSku} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Barcode</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. 8901030381001" value={newItemBarcode} onChangeText={setNewItemBarcode} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Sale Price (₹) *</Text>
                  <TextInput style={styles.modalInput} placeholder="0.00" value={newItemSalePrice} onChangeText={setNewItemSalePrice} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Purchase Price (₹)</Text>
                  <TextInput style={styles.modalInput} placeholder="0.00" value={newItemPurchasePrice} onChangeText={setNewItemPurchasePrice} keyboardType="decimal-pad" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Opening Stock</Text>
                  <TextInput style={styles.modalInput} placeholder="0" value={newItemStock} onChangeText={setNewItemStock} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput style={styles.modalInput} placeholder="pcs / kg / ltr" value={newItemUnit} onChangeText={setNewItemUnit} />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.partsToggle, newItemAllowParts && styles.partsToggleActive]}
                onPress={() => setNewItemAllowParts(!newItemAllowParts)}
              >
                <Text style={styles.partsToggleText}>
                  {newItemAllowParts ? '✓ Allow Fractional Sales (e.g. 1.506 kg)' : '○ Allow Fractional Sales (Off)'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveItemBtn} onPress={handleSaveNewItem}>
                <Text style={styles.saveItemBtnText}>Save Product</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
});
