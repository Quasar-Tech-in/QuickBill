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
import { PurchaseOrder, Party, Item } from '../types';

export const PurchaseOrdersScreen: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => store.getPurchaseOrders());
  const [suppliers, setSuppliers] = useState<Party[]>(() => store.getSuppliers());
  const [items, setItems] = useState<Item[]>(() => store.getItems());

  // Create PO Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [poItems, setPoItems] = useState<{ item: Item; qty: number; rate: number }[]>([]);

  // Receive Goods Modal State
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<Array<{
    itemId: string;
    name: string;
    unit: string;
    orderedQty: number;
    alreadyReceived: number;
    qtyToReceive: string;
    unitPrice: number;
    taxRate: number;
  }>>([]);
  const [recordImmediatePayment, setRecordImmediatePayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');

  // Settle Outstanding PO Balance Modal State
  const [payingPO, setPayingPO] = useState<PurchaseOrder | null>(null);
  const [payingAmount, setPayingAmount] = useState('');
  const [payingMode, setPayingMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('UPI');
  const [payingRef, setPayingRef] = useState('');
  const [payingNotes, setPayingNotes] = useState('');

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setPurchaseOrders(store.getPurchaseOrders());
      setSuppliers(store.getSuppliers());
      setItems(store.getItems());
    });
    return () => { unsubscribe(); };
  }, []);

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    const mapped = po.items.map(it => {
      const already = it.receivedQty || 0;
      const remaining = Math.max(0, it.orderedQty - already);
      return {
        itemId: it.itemId,
        name: it.name,
        unit: it.unit || 'pcs',
        orderedQty: it.orderedQty,
        alreadyReceived: already,
        qtyToReceive: String(remaining),
        unitPrice: it.unitPrice,
        taxRate: it.taxRate || 0,
      };
    });
    setReceiveItems(mapped);

    // Calculate initial estimated value of remaining goods
    const initialRemainingVal = mapped.reduce((s, it) => {
      const q = parseFloat(it.qtyToReceive) || 0;
      return s + (q * it.unitPrice * (1 + it.taxRate / 100));
    }, 0);

    setRecordImmediatePayment(false);
    setPaymentAmount(initialRemainingVal > 0 ? initialRemainingVal.toFixed(2) : '');
    setPaymentMode('BANK_TRANSFER');
    setPaymentRef('');
    setReceiveNotes('');
  };

  const handleConfirmReceiveGoods = () => {
    if (!receivingPO) return;

    const itemsToInward = receiveItems.map(it => ({
      itemId: it.itemId,
      qty: parseFloat(it.qtyToReceive) || 0,
    })).filter(it => it.qty > 0);

    if (itemsToInward.length === 0) {
      Alert.alert('Validation Error', 'Please specify a quantity greater than 0 to inward for at least one item.');
      return;
    }

    const payVal = parseFloat(paymentAmount) || 0;
    const paymentOptions = recordImmediatePayment && payVal > 0 ? {
      amount: payVal,
      paymentMode,
      referenceNumber: paymentRef.trim() || undefined,
      notes: receiveNotes.trim() || undefined,
    } : undefined;

    store.receivePurchaseOrder(receivingPO.id, {
      items: itemsToInward,
      payment: paymentOptions,
      notes: receiveNotes.trim() || undefined,
    });

    setReceivingPO(null);
    Alert.alert(
      'Stock Inwarded Successfully', 
      `Stock updated for PO #${receivingPO.poNumber}. Recorded into stock movement ledger.`
    );
  };

  const openPayModal = (po: PurchaseOrder) => {
    setPayingPO(po);
    const balance = po.balanceDue !== undefined ? po.balanceDue : Math.max(0, (po.totalReceivedAmount || po.grandTotal) - (po.totalPaidAmount || 0));
    setPayingAmount(String(balance.toFixed(2)));
    setPayingMode('UPI');
    setPayingRef('');
    setPayingNotes('');
  };

  const handleConfirmPOPayment = () => {
    if (!payingPO) return;
    const amount = parseFloat(payingAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }

    store.recordPurchaseOrderPayment(payingPO.id, {
      amount,
      paymentMode: payingMode,
      referenceNumber: payingRef.trim() || undefined,
      notes: payingNotes.trim() || undefined,
    });

    setPayingPO(null);
    Alert.alert('Payment Recorded', `₹${amount.toFixed(2)} paid to ${payingPO.supplierName}. Khata updated.`);
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
          <Text style={styles.topSub}>{purchaseOrders.length} Orders Recorded</Text>
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📥</Text>
            <Text style={styles.emptyTitle}>No Purchase Orders</Text>
            <Text style={styles.emptySub}>
              Create purchase orders to procure items, receive vendor shipments into stock, and track payable Khatas.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isFullyReceived = item.status === 'RECEIVED' || item.status === 'FULLY_RECEIVED';
          const isPartial = item.status === 'PARTIALLY_RECEIVED';
          const isOrdered = item.status === 'ORDERED';
          
          const receivedAmt = item.totalReceivedAmount !== undefined ? item.totalReceivedAmount : (isFullyReceived ? item.grandTotal : 0);
          const paidAmt = item.totalPaidAmount || 0;
          const balanceDue = item.balanceDue !== undefined ? item.balanceDue : Math.max(0, receivedAmt - paidAmt);
          const isPaid = balanceDue === 0 && receivedAmt > 0;
          const isPartPaid = paidAmt > 0 && balanceDue > 0;

          return (
            <View style={styles.poCard}>
              <View style={styles.poHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.poNumber}>{item.poNumber}</Text>
                  <Text style={styles.supplierName}>🏭 {item.supplierName}</Text>
                  <Text style={styles.orderDateText}>
                    📅 {new Date(item.orderDate).toLocaleDateString()}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {/* Status Badge */}
                  <View style={[
                    styles.statusBadge, 
                    isFullyReceived ? styles.statusBadgeReceived : (isPartial ? styles.statusBadgePartial : styles.statusBadgePending)
                  ]}>
                    <Text style={[
                      styles.statusText, 
                      isFullyReceived ? styles.statusTextReceived : (isPartial ? styles.statusTextPartial : styles.statusTextPending)
                    ]}>
                      {isFullyReceived ? '✓ Fully Received' : (isPartial ? '⏳ Partial Inward' : '○ Ordered')}
                    </Text>
                  </View>

                  {/* Payment Badge */}
                  {receivedAmt > 0 && (
                    <View style={[
                      styles.statusBadge, 
                      isPaid ? styles.statusBadgeReceived : (isPartPaid ? styles.statusBadgePartial : styles.statusBadgePending)
                    ]}>
                      <Text style={[
                        styles.statusText, 
                        isPaid ? styles.statusTextReceived : (isPartPaid ? styles.statusTextPartial : styles.statusTextPending)
                      ]}>
                        {isPaid ? 'PAID' : (isPartPaid ? 'PARTIAL PAID' : 'UNPAID')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Items Inwarding Breakdown */}
              <View style={styles.poItemsBox}>
                {item.items.map((it, idx) => {
                  const rec = it.receivedQty || 0;
                  const ord = it.orderedQty;
                  const itemInwardDone = rec >= ord;

                  return (
                    <View key={idx} style={styles.poItemRow}>
                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.itName}>{it.name}</Text>
                        <Text style={styles.itSub}>
                          Inwarded: {rec} / {ord} {it.unit || 'pcs'} {itemInwardDone ? '✅' : ''}
                        </Text>
                      </View>
                      <Text style={styles.itQty}>₹ {it.totalAmount.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Financial Metrics Row */}
              <View style={styles.financialRow}>
                <View>
                  <Text style={styles.finLabel}>PO Value</Text>
                  <Text style={styles.finVal}>₹ {item.grandTotal.toFixed(2)}</Text>
                </View>
                <View>
                  <Text style={styles.finLabel}>Inwarded Value</Text>
                  <Text style={[styles.finVal, { color: colors.neutral[800] }]}>
                    ₹ {receivedAmt.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.finLabel}>Paid</Text>
                  <Text style={[styles.finVal, { color: colors.success[700] }]}>
                    ₹ {paidAmt.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.finLabel}>Balance Due</Text>
                  <Text style={[styles.finVal, { color: balanceDue > 0 ? colors.danger[700] : colors.neutral[500] }]}>
                    ₹ {balanceDue.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.poFooter}>
                <View style={{ flex: 1 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {!isFullyReceived && (
                    <TouchableOpacity 
                      style={styles.receiveBtn}
                      onPress={() => openReceiveModal(item)}
                    >
                      <Text style={styles.receiveBtnText}>📥 Inward Goods</Text>
                    </TouchableOpacity>
                  )}

                  {balanceDue > 0 && receivedAmt > 0 && (
                    <TouchableOpacity 
                      style={styles.payBtn}
                      onPress={() => openPayModal(item)}
                    >
                      <Text style={styles.payBtnText}>💳 Pay Vendor</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Receive Goods Inwarding Modal */}
      {receivingPO && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setReceivingPO(null)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <Text style={styles.modalTitle}>📥 Inward Stock: {receivingPO.poNumber}</Text>
              <Text style={styles.modalSub}>Supplier: {receivingPO.supplierName}</Text>

              <ScrollView style={{ marginTop: 10 }}>
                <Text style={styles.fieldLabel}>Line Items Receiving Quantity</Text>
                {receiveItems.map((item, idx) => {
                  const rem = Math.max(0, item.orderedQty - item.alreadyReceived);
                  return (
                    <View key={item.itemId} style={styles.receiveItemCard}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.receiveItemName}>{item.name}</Text>
                        <Text style={styles.receiveItemSub}>
                          Ordered: {item.orderedQty} | Already: {item.alreadyReceived} | Rem: {rem} {item.unit}
                        </Text>
                      </View>

                      <View style={{ width: 100 }}>
                        <TextInput
                          style={styles.receiveQtyInput}
                          placeholder="0"
                          value={item.qtyToReceive}
                          onChangeText={(val) => {
                            const updated = [...receiveItems];
                            updated[idx] = { ...item, qtyToReceive: val };
                            setReceiveItems(updated);
                          }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  );
                })}

                {/* Delivery Notes / Challan Number */}
                <Text style={styles.fieldLabel}>Delivery Challan / GRN Notes</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Challan #DC-4821 via DTDC courier"
                  value={receiveNotes}
                  onChangeText={setReceiveNotes}
                />

                {/* Immediate Vendor Payment Option */}
                <TouchableOpacity 
                  style={[styles.paymentToggleBox, recordImmediatePayment && styles.paymentToggleBoxActive]}
                  onPress={() => setRecordImmediatePayment(!recordImmediatePayment)}
                >
                  <Text style={styles.paymentToggleText}>
                    {recordImmediatePayment ? '✓ Record Immediate Payment to Supplier' : '○ Record Immediate Payment (Off)'}
                  </Text>
                </TouchableOpacity>

                {recordImmediatePayment && (
                  <View style={styles.immediatePaymentSection}>
                    <Text style={styles.fieldLabel}>Payment Amount (₹)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0.00"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="decimal-pad"
                    />

                    <Text style={styles.fieldLabel}>Payment Mode</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                      {(['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'] as const).map(mode => (
                        <TouchableOpacity
                          key={mode}
                          style={[styles.payModeChip, paymentMode === mode && styles.payModeChipActive]}
                          onPress={() => setPaymentMode(mode)}
                        >
                          <Text style={[styles.payModeText, paymentMode === mode && styles.payModeTextActive]}>
                            {mode.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>Transaction / Reference #</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. UTR-9842104"
                      value={paymentRef}
                      onChangeText={setPaymentRef}
                    />
                  </View>
                )}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setReceivingPO(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.savePOBtn} onPress={handleConfirmReceiveGoods}>
                  <Text style={styles.savePOBtnText}>Confirm Inwarding</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Pay Outstanding PO Vendor Balance Modal */}
      {payingPO && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPayingPO(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>💳 Vendor Payment: {payingPO.poNumber}</Text>
              <Text style={styles.modalSub}>
                Supplier: {payingPO.supplierName} • Dues: ₹{(payingPO.balanceDue || 0).toFixed(2)}
              </Text>

              <Text style={styles.fieldLabel}>Payment Amount (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                value={payingAmount}
                onChangeText={setPayingAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Payment Mode</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE'] as const).map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.payModeChip, payingMode === mode && styles.payModeChipActive]}
                    onPress={() => setPayingMode(mode)}
                  >
                    <Text style={[styles.payModeText, payingMode === mode && styles.payModeTextActive]}>
                      {mode.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Transaction Reference # (UTR / Cheque)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. UPI-REF-89410"
                value={payingRef}
                onChangeText={setPayingRef}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Part payment against PO invoice"
                value={payingNotes}
                onChangeText={setPayingNotes}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPayingPO(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.savePOBtn} onPress={handleConfirmPOPayment}>
                  <Text style={styles.savePOBtnText}>Record Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Create PO Modal */}
      <Modal visible={isCreateOpen} transparent animationType="slide" onRequestClose={() => setIsCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
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
                    <View style={{ flex: 1, marginRight: 8 }}>
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
    marginBottom: 8,
  },
  poNumber: { fontSize: 14, fontWeight: '800', color: colors.neutral[900] },
  supplierName: { fontSize: 12, fontWeight: '600', color: colors.neutral[700], marginTop: 2 },
  orderDateText: { fontSize: 10, color: colors.neutral[400], marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgePending: { backgroundColor: colors.warning[50], borderWidth: 1, borderColor: colors.warning[200] },
  statusBadgePartial: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  statusBadgeReceived: { backgroundColor: colors.success[50], borderWidth: 1, borderColor: colors.success[200] },
  statusText: { fontSize: 10, fontWeight: '800' },
  statusTextPending: { color: colors.warning[800] },
  statusTextPartial: { color: '#1d4ed8' },
  statusTextReceived: { color: colors.success[800] },
  poItemsBox: {
    backgroundColor: colors.neutral[50],
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  poItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itName: { fontSize: 12, fontWeight: '600', color: colors.neutral[800] },
  itSub: { fontSize: 10, color: colors.neutral[500], marginTop: 1 },
  itQty: { fontSize: 12, fontWeight: '700', color: colors.neutral[900] },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    marginBottom: 4,
  },
  finLabel: { fontSize: 9, color: colors.neutral[500], textTransform: 'uppercase' },
  finVal: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  poFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  receiveBtn: {
    backgroundColor: colors.success[600],
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  receiveBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  payBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  modalSub: { fontSize: 12, color: colors.neutral[600], marginTop: 2, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.neutral[700], marginTop: 8, marginBottom: 4 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    marginBottom: 6,
  },
  receiveItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  receiveItemName: { fontSize: 12, fontWeight: '700', color: colors.neutral[900] },
  receiveItemSub: { fontSize: 10, color: colors.neutral[500], marginTop: 2 },
  receiveQtyInput: {
    borderWidth: 1,
    borderColor: colors.primary[300],
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  paymentToggleBox: {
    backgroundColor: colors.neutral[100],
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  paymentToggleBoxActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  paymentToggleText: { fontSize: 12, fontWeight: '700', color: colors.neutral[800] },
  immediatePaymentSection: {
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  payModeChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  payModeChipActive: {
    backgroundColor: colors.primary[600],
  },
  payModeText: { fontSize: 10, fontWeight: '700', color: colors.neutral[700] },
  payModeTextActive: { color: '#fff' },
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
  emptyContainer: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 42, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[800] },
  emptySub: { fontSize: 12, color: colors.neutral[500], textAlign: 'center', marginTop: 4, maxWidth: 260 },
});
