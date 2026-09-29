import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { PurchaseOrder, Party, Item } from '../types';

export const PurchaseOrdersScreen: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => store.getPurchaseOrders());
  const [suppliers, setSuppliers] = useState<Party[]>(() => store.getSuppliers());
  const [items, setItems] = useState<Item[]>(() => store.getItems());

  // Create PO Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [poItems, setPoItems] = useState<{ item: Item; qty: number; rate: number }[]>([]);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setPurchaseOrders(store.getPurchaseOrders());
      setSuppliers(store.getSuppliers());
      setItems(store.getItems());
    });
    return () => { unsubscribe(); };
  }, []);

  const handleReceivePO = (po: PurchaseOrder) => {
    Alert.alert(
      'Receive Goods / Inward Stock',
      `Inward all items from PO #${po.poNumber} into inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm & Inward', 
          onPress: () => {
            store.receivePurchaseOrder(po.id);
            Alert.alert('Stock Inwarded', `Inventory updated for PO #${po.poNumber}.`);
          } 
        }
      ]
    );
  };

  const handleCreatePO = () => {
    const sup = suppliers.find(s => s.id === selectedSupplierId);
    if (!sup) {
      Alert.alert('Validation Error', 'Please select a supplier.');
      return;
    }
    if (poItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one line item to the PO.');
      return;
    }

    const subtotal = poItems.reduce((acc, p) => acc + (p.qty * p.rate), 0);
    const taxTotal = poItems.reduce((acc, p) => acc + (p.qty * p.rate * (p.item.taxRate / 100)), 0);
    const grandTotal = subtotal + taxTotal;

    const formattedItems = poItems.map(p => ({
      itemId: p.item.id,
      name: p.item.name,
      sku: p.item.sku,
      unit: p.item.unit,
      orderedQty: p.qty,
      receivedQty: 0,
      unitPrice: p.rate,
      taxRate: p.item.taxRate,
      taxAmount: Number((p.qty * p.rate * (p.item.taxRate / 100)).toFixed(2)),
      totalAmount: Number((p.qty * p.rate * (1 + p.item.taxRate / 100)).toFixed(2)),
    }));

    store.createPurchaseOrder({
      supplierId: sup.id,
      supplierName: sup.name,
      supplierPhone: sup.phone,
      supplierGstin: sup.gstin,
      orderDate: new Date().toISOString(),
      status: 'ORDERED',
      items: formattedItems,
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
    });

    setIsCreateOpen(false);
    setPoItems([]);
    setSelectedSupplierId('');
  };

  return (
    <View style={styles.container}>
      {/* Top Header & New PO CTA */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>Purchase Orders & Inwarding</Text>
          <Text style={styles.topSub}>{purchaseOrders.length} Orders Active</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateOpen(true)}>
          <Text style={styles.createBtnText}>+ New PO</Text>
        </TouchableOpacity>
      </View>

      {/* PO List */}
      <FlatList
        data={purchaseOrders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isReceived = item.status === 'RECEIVED' || item.status === 'FULLY_RECEIVED';
          return (
            <View style={styles.poCard}>
              <View style={styles.poHeader}>
                <View>
                  <Text style={styles.poNumber}>{item.poNumber}</Text>
                  <Text style={styles.supplierName}>🏭 {item.supplierName}</Text>
                </View>
                <View style={[styles.statusBadge, isReceived ? styles.statusBadgeReceived : styles.statusBadgePending]}>
                  <Text style={[styles.statusText, isReceived ? styles.statusTextReceived : styles.statusTextPending]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.poItemsBox}>
                {item.items.map((it, idx) => (
                  <View key={idx} style={styles.poItemRow}>
                    <Text style={styles.itName}>{it.name}</Text>
                    <Text style={styles.itQty}>{it.orderedQty} {it.unit} (₹{it.totalAmount.toFixed(2)})</Text>
                  </View>
                ))}
              </View>

              <View style={styles.poFooter}>
                <View>
                  <Text style={styles.totLabel}>Total PO Amount</Text>
                  <Text style={styles.totVal}>₹ {item.grandTotal.toFixed(2)}</Text>
                </View>
                {!isReceived && (
                  <TouchableOpacity 
                    style={styles.receiveBtn}
                    onPress={() => handleReceivePO(item)}
                  >
                    <Text style={styles.receiveBtnText}>📥 Inward Stock</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Create PO Modal */}
      <Modal visible={isCreateOpen} transparent animationType="slide" onRequestClose={() => setIsCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Create Purchase Order</Text>
            <ScrollView style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Select Supplier *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {suppliers.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, selectedSupplierId === s.id && styles.chipActive]}
                    onPress={() => setSelectedSupplierId(s.id)}
                  >
                    <Text style={[styles.chipText, selectedSupplierId === s.id && styles.chipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Add Products to Purchase</Text>
              {items.map(item => {
                const existing = poItems.find(p => p.item.id === item.id);
                return (
                  <View key={item.id} style={styles.addItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemRate}>Purchase Rate: ₹{item.purchasePrice.toFixed(2)}</Text>
                    </View>
                    {existing ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity 
                          style={styles.qtyModBtn}
                          onPress={() => {
                            if (existing.qty <= 10) {
                              setPoItems(poItems.filter(p => p.item.id !== item.id));
                            } else {
                              setPoItems(poItems.map(p => p.item.id === item.id ? { ...p, qty: p.qty - 10 } : p));
                            }
                          }}
                        >
                          <Text style={styles.qtyModText}>-10</Text>
                        </TouchableOpacity>
                        <Text style={{ fontWeight: '800', minWidth: 36, textAlign: 'center' }}>{existing.qty}</Text>
                        <TouchableOpacity 
                          style={styles.qtyModBtn}
                          onPress={() => {
                            setPoItems(poItems.map(p => p.item.id === item.id ? { ...p, qty: p.qty + 10 } : p));
                          }}
                        >
                          <Text style={styles.qtyModText}>+10</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={styles.addPOItemBtn}
                        onPress={() => {
                          setPoItems([...poItems, { item, qty: 50, rate: item.purchasePrice }]);
                        }}
                      >
                        <Text style={styles.addPOItemBtnText}>+ Add 50</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.savePOBtn} onPress={handleCreatePO}>
                <Text style={styles.savePOBtnText}>Create PO ({poItems.length} items)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  topTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  topSub: { fontSize: 11, color: colors.neutral[600], marginTop: 2 },
  createBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  listContent: { padding: 12, paddingBottom: 40 },
  poCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 10,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  poNumber: { fontSize: 14, fontWeight: '800', color: colors.neutral[900] },
  supplierName: { fontSize: 12, fontWeight: '600', color: colors.neutral[600], marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgePending: { backgroundColor: colors.warning[50] },
  statusBadgeReceived: { backgroundColor: colors.success[50] },
  statusText: { fontSize: 10, fontWeight: '800' },
  statusTextPending: { color: colors.warning[700] },
  statusTextReceived: { color: colors.success[700] },
  poItemsBox: {
    backgroundColor: colors.neutral[50],
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  poItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  itName: { fontSize: 12, color: colors.neutral[700] },
  itQty: { fontSize: 12, fontWeight: '700', color: colors.neutral[900] },
  poFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  totLabel: { fontSize: 10, color: colors.neutral[600], textTransform: 'uppercase' },
  totVal: { fontSize: 15, fontWeight: '900', color: colors.primary[700] },
  receiveBtn: {
    backgroundColor: colors.success[500],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  receiveBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.neutral[700], marginTop: 10, marginBottom: 6 },
  chip: { backgroundColor: colors.neutral[100], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary[500] },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.neutral[700] },
  chipTextActive: { color: '#fff' },
  addItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  itemName: { fontSize: 13, fontWeight: '600', color: colors.neutral[900] },
  itemRate: { fontSize: 11, color: colors.neutral[600] },
  qtyModBtn: { backgroundColor: colors.neutral[100], paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  qtyModText: { fontSize: 11, fontWeight: '700', color: colors.neutral[800] },
  addPOItemBtn: { backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[200], paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addPOItemBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary[700] },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.surface.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.neutral[600] },
  savePOBtn: { flex: 2, backgroundColor: colors.primary[500], paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  savePOBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
