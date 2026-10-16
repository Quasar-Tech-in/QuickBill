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
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Invoice, Business } from '../types';
import { shareInvoiceOnWhatsApp } from '../utils/shareInvoice';
import { printThermalReceipt, printA4Invoice } from '../utils/printInvoice';

type StatusFilter = 'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'RETURNS';

export const TransactionsScreen: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [user, setUser] = useState(() => store.getActiveUser());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnMap, setReturnMap] = useState<{ [itemId: string]: { qty: string; reason: string } }>({});
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // Settle Outstanding Invoice Dues State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [settleRef, setSettleRef] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [isProcessingSettle, setIsProcessingSettle] = useState(false);

  const canProcessReturn = user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setInvoices(store.getInvoices());
      setBusiness(store.getBusinessProfile());
      setUser(store.getActiveUser());
    });
    return () => { unsubscribe(); };
  }, []);

  // Summary Metrics
  const totalBilled = invoices.reduce((acc, inv) => acc + (inv.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
  const totalDue = invoices.reduce((acc, inv) => acc + (inv.balanceAmount || 0), 0);
  const rawReturns = invoices.reduce((acc, inv) => acc + (inv.returnTotal || 0), 0);
  const totalReturns = Math.max(0, rawReturns);

  const filteredInvoices = invoices.filter(inv => {
    // Status Filter
    if (selectedStatus === 'PAID' && inv.status !== 'PAID') return false;
    if (selectedStatus === 'PARTIAL' && inv.status !== 'PARTIAL') return false;
    if (selectedStatus === 'UNPAID' && inv.status !== 'UNPAID') return false;
    if (selectedStatus === 'RETURNS' && !(inv.hasReturns || (inv.returnTotal && inv.returnTotal > 0) || inv.status === 'RETURNS')) return false;

    // Search Query
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      inv.invoiceNumber.toLowerCase().includes(q) || 
      (inv.partyName && inv.partyName.toLowerCase().includes(q)) || 
      (inv.partyPhone && inv.partyPhone.includes(q));
  });

  const handleOpenReturnModal = () => {
    if (!selectedInvoice) return;
    const initialMap: { [itemId: string]: { qty: string; reason: string } } = {};
    selectedInvoice.items.forEach(it => {
      initialMap[it.itemId] = { qty: '0', reason: 'RESTOCKABLE_RETURN' };
    });
    setReturnMap(initialMap);
    setIsReturnModalOpen(true);
  };

  const handleConfirmSettlePayment = async () => {
    if (!selectedInvoice) return;
    const amount = parseFloat(settleAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }

    setIsProcessingSettle(true);
    try {
      const updated = await store.recordInvoicePayment(selectedInvoice.id, {
        amount,
        paymentMode: settleMode,
        referenceNumber: settleRef.trim() || undefined,
        notes: settleNotes.trim() || undefined,
      });

      if (updated) {
        setSelectedInvoice({ ...updated });
      }
      setIsSettleModalOpen(false);
      Alert.alert(
        'Payment Collected', 
        `₹${amount.toFixed(2)} recorded for Invoice #${selectedInvoice.invoiceNumber}. Customer Khata dues updated.`
      );
    } catch (e: any) {
      Alert.alert('Payment Failed', e?.message || 'Could not record invoice payment.');
    } finally {
      setIsProcessingSettle(false);
    }
  };

  // Compute Return Totals with Proportional Item Discounts
  const computeReturnCalculations = () => {
    if (!selectedInvoice) return { grossReturn: 0, discountDeducted: 0, netRefund: 0, revisedTotal: 0 };

    let grossReturn = 0;
    let discountDeducted = 0;

    selectedInvoice.items.forEach(it => {
      const entry = returnMap[it.itemId];
      const retQty = Math.min(it.quantity, Math.max(0, parseFloat(entry?.qty || '0') || 0));
      if (retQty > 0) {
        const lineGross = retQty * it.unitPrice;
        grossReturn += lineGross;

        // Proportional discount deduction
        const itemDiscountPerUnit = it.discountPercent ? (it.unitPrice * (it.discountPercent / 100)) : 0;
        discountDeducted += (itemDiscountPerUnit * retQty);
      }
    });

    const netRefund = Math.max(0, grossReturn - discountDeducted);
    const revisedTotal = Math.max(0, selectedInvoice.grandTotal - netRefund);

    return {
      grossReturn: Number(grossReturn.toFixed(2)),
      discountDeducted: Number(discountDeducted.toFixed(2)),
      netRefund: Number(netRefund.toFixed(2)),
      revisedTotal: Number(revisedTotal.toFixed(2)),
    };
  };

  const handleConfirmReturn = async () => {
    if (!selectedInvoice) return;
    setIsProcessingReturn(true);

    try {
      const itemsToUpdate = selectedInvoice.items.map(it => {
        const entry = returnMap[it.itemId];
        const retQty = Math.min(it.quantity, Math.max(0, parseFloat(entry?.qty || '0') || 0));
        return {
          itemId: it.itemId,
          quantity: it.quantity,
          returnedQuantity: retQty,
          returnReason: entry?.reason || 'CUSTOMER_RETURN',
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          discount: it.discountPercent ? (it.unitPrice * (it.discountPercent / 100)) : 0,
        };
      });

      const hasAnyReturns = itemsToUpdate.some(i => i.returnedQuantity > 0);
      if (!hasAnyReturns) {
        Alert.alert('No Items Returned', 'Please enter at least 1 unit to return.');
        setIsProcessingReturn(false);
        return;
      }

      await store.updateInvoiceWithReturn(selectedInvoice.id, {
        items: itemsToUpdate,
        notes: `Return processed by ${user?.name || 'Staff'} (${user?.role})`,
        paymentMode: selectedInvoice.paymentMode,
      });

      setIsProcessingReturn(false);
      setIsReturnModalOpen(false);
      setSelectedInvoice(null);
      Alert.alert('Return Processed', 'Invoice updated, inventory restocked, and customer balance adjusted.');
    } catch (e: any) {
      setIsProcessingReturn(false);
      Alert.alert('Return Failed', e?.message || 'Could not process sales return.');
    }
  };

  const handleShareWhatsApp = async (inv: Invoice) => {
    setIsSharing(true);
    try {
      await shareInvoiceOnWhatsApp({
        invoice: inv,
        business,
        format: 'A4',
        customerPhone: inv.partyPhone || inv.consumerPhone,
        mode: 'DIRECT_WHATSAPP',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrintThermal = async (inv: Invoice) => {
    setIsPrinting(true);
    try {
      await printThermalReceipt(inv, business);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print thermal receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintA4 = async (inv: Invoice) => {
    setIsPrinting(true);
    try {
      await printA4Invoice(inv, business);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not print A4 invoice.');
    } finally {
      setIsPrinting(false);
    }
  };

  const returnSummary = computeReturnCalculations();

  return (
    <View style={styles.container}>
      {/* 1. Top Financial KPI Summary Strip */}
      <View style={styles.kpiStrip}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Total Sales</Text>
          <Text style={styles.kpiValue}>₹ {totalBilled.toFixed(0)}</Text>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Collected</Text>
          <Text style={[styles.kpiValue, { color: colors.success[700] }]}>₹ {totalPaid.toFixed(0)}</Text>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Due / Khata</Text>
          <Text style={[styles.kpiValue, totalDue > 0 && { color: colors.danger[700] }]}>₹ {totalDue.toFixed(0)}</Text>
        </View>

        <View style={styles.kpiDivider} />

        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>Returns</Text>
          <Text style={[styles.kpiValue, totalReturns > 0 && { color: colors.warning[700] }]}>
            ₹ {totalReturns.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* 2. Search & Status Filter Section */}
      <View style={styles.filterSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search Invoice #, customer name, phone..."
          placeholderTextColor={colors.neutral[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusChipsRow}>
          {(['ALL', 'PAID', 'PARTIAL', 'UNPAID', 'RETURNS'] as const).map(st => (
            <TouchableOpacity
              key={st}
              style={[styles.statusChip, selectedStatus === st && styles.statusChipActive]}
              onPress={() => setSelectedStatus(st)}
            >
              <Text style={[styles.statusChipText, selectedStatus === st && styles.statusChipTextActive]}>
                {st === 'ALL' && 'All Invoices'}
                {st === 'PAID' && '✓ Paid'}
                {st === 'PARTIAL' && '⏳ Partial'}
                {st === 'UNPAID' && '⚠️ Unpaid'}
                {st === 'RETURNS' && '🔄 Returns / Credits'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3. Invoice List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🧾</Text>
            <Text style={styles.emptyTitle}>No Invoices Found</Text>
            <Text style={styles.emptySub}>
              No bills match the selected status filter or search query.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
          const hasReturn = Boolean(item.hasReturns || (item.returnTotal !== undefined && item.returnTotal > 0));

          return (
            <TouchableOpacity 
              style={styles.invoiceCard}
              onPress={() => setSelectedInvoice(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                    {hasReturn ? (
                      <View style={styles.returnBadge}>
                        <Text style={styles.returnBadgeText}>🔄 Returned</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.customerName}>
                    👤 {item.partyName || 'Counter Customer'} {item.partyPhone ? `(${item.partyPhone})` : ''}
                  </Text>
                </View>

                <View style={styles.amountBox}>
                  <Text style={styles.grandTotalText}>₹ {item.grandTotal.toFixed(2)}</Text>
                  <View style={[
                    styles.statusBadge, 
                    item.status === 'PAID' ? styles.statusPaid : (item.status === 'PARTIAL' ? styles.statusPartial : styles.statusUnpaid)
                  ]}>
                    <Text style={[
                      styles.statusText,
                      item.status === 'PAID' ? styles.statusTextPaid : (item.status === 'PARTIAL' ? styles.statusTextPartial : styles.statusTextUnpaid)
                    ]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  🕒 {dateStr} • <Text style={{ fontWeight: '700' }}>{item.paymentMode}</Text>
                </Text>

                <View style={styles.quickActions}>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handleShareWhatsApp(item)}
                  >
                    <Text style={styles.actionBtnText}>📄 Share PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handlePrintThermal(item)}
                  >
                    <Text style={styles.actionBtnText}>🖨️ Receipt</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* 4. Invoice Detail Modal */}
      {selectedInvoice ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.detailTitle}>{selectedInvoice.invoiceNumber}</Text>
                    {Boolean(selectedInvoice.hasReturns || (selectedInvoice.returnTotal !== undefined && selectedInvoice.returnTotal > 0)) ? (
                      <View style={[styles.returnBadge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                        <Text style={[styles.returnBadgeText, { color: colors.danger[700], fontWeight: '800' }]}>
                          🔄 {selectedInvoice.status === 'RETURNED' || selectedInvoice.returnStatus === 'FULLY_RETURNED' ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.detailSub}>
                    {selectedInvoice.partyName || 'Counter Customer'} • {selectedInvoice.partyPhone || 'No Phone'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Branding Info Banner */}
              <View style={styles.brandingHeaderBanner}>
                <Text style={styles.brandingStoreName}>{business.name || 'QuickBill Store'}</Text>
                {business.tagline ? <Text style={styles.brandingTagline}>{business.tagline}</Text> : null}
                <Text style={styles.brandingBranchText}>
                  📍 {selectedInvoice.locationName || 'Main Counter'}{business.address ? ` • ${business.address}` : ''}
                </Text>
                {business.gstin ? (
                  <Text style={styles.brandingGstinText}>GSTIN: {business.gstin}</Text>
                ) : null}
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                <Text style={styles.sectionHeading}>Items Billed ({selectedInvoice.items.length})</Text>
                {selectedInvoice.items.map((it, idx) => {
                  const retQty = Number(it.returnedQuantity || 0);
                  const hasRet = retQty > 0;
                  const activeQty = Math.max(0, it.quantity - retQty);
                  const hasDisc = Boolean((it.discountAmount !== undefined && it.discountAmount > 0) || (it.discountPercent !== undefined && it.discountPercent > 0));

                  return (
                    <View key={idx} style={styles.itemRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.itName}>{it.name}</Text>
                        <Text style={styles.itSub}>
                          {hasRet ? `${activeQty}/${it.quantity}` : it.quantity} {it.unit || 'pcs'} @ ₹{it.unitPrice.toFixed(2)} (GST {it.taxRate}%)
                        </Text>
                        {hasDisc ? (
                          <Text style={{ fontSize: 9, color: colors.success[600], fontWeight: '700', marginTop: 1 }}>
                            🏷️ Disc: {it.discountAmount ? `-₹${it.discountAmount.toFixed(2)}` : `${it.discountPercent}%`}
                          </Text>
                        ) : null}
                        {hasRet ? (
                          <Text style={{ fontSize: 9, color: colors.danger[600], fontWeight: '800', marginTop: 1 }}>
                            🔄 [RET: ${retQty} ${it.returnReason === 'DEFECTIVE_DAMAGED' ? 'DEFECTIVE' : 'RETURN'}${it.returnNote ? ` - ${it.returnNote}` : ''}]
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {hasDisc && it.originalTotal !== undefined && Math.abs(it.originalTotal - it.total) > 0.01 ? (
                          <Text style={{ fontSize: 9, textDecorationLine: 'line-through', color: colors.neutral[400] }}>
                            ₹{it.originalTotal.toFixed(2)}
                          </Text>
                        ) : null}
                        <Text style={styles.itTotal}>₹ {it.total.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.totalsBox}>
                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Total Quantity:</Text>
                    <Text style={styles.totVal}>
                      {selectedInvoice.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)}
                      {selectedInvoice.items.reduce((acc, it) => acc + (Number(it.returnedQuantity) || 0), 0) > 0 ? (
                        <Text style={{ color: colors.danger[600] }}>
                          {` (Ret: ${selectedInvoice.items.reduce((acc, it) => acc + (Number(it.returnedQuantity) || 0), 0)})`}
                        </Text>
                      ) : null}
                    </Text>
                  </View>

                  {Boolean(selectedInvoice.originalGrandTotal !== undefined && selectedInvoice.originalGrandTotal > 0 && selectedInvoice.originalGrandTotal !== selectedInvoice.grandTotal) ? (
                    <View style={styles.totRow}>
                      <Text style={styles.totLabel}>Original Billed Total:</Text>
                      <Text style={styles.totVal}>₹ {Number(selectedInvoice.originalGrandTotal).toFixed(2)}</Text>
                    </View>
                  ) : null}

                  {Boolean(selectedInvoice.returnTotal !== undefined && selectedInvoice.returnTotal > 0) ? (
                    <View style={styles.totRow}>
                      <Text style={[styles.totLabel, { color: colors.danger[600], fontWeight: '800' }]}>Less Returns:</Text>
                      <Text style={[styles.totVal, { color: colors.danger[600], fontWeight: '800' }]}>
                        - ₹ {Number(selectedInvoice.returnTotal).toFixed(2)}
                      </Text>
                    </View>
                  ) : null}

                  {Boolean(selectedInvoice.discountTotal !== undefined && selectedInvoice.discountTotal > 0) ? (
                    <View style={styles.totRow}>
                      <Text style={[styles.totLabel, { color: colors.danger[600] }]}>Discounts:</Text>
                      <Text style={[styles.totVal, { color: colors.danger[600] }]}>- ₹ {selectedInvoice.discountTotal.toFixed(2)}</Text>
                    </View>
                  ) : null}

                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Subtotal (Taxable):</Text>
                    <Text style={styles.totVal}>₹ {selectedInvoice.subtotal.toFixed(2)}</Text>
                  </View>

                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Tax Total (GST):</Text>
                    <Text style={styles.totVal}>₹ {selectedInvoice.taxTotal.toFixed(2)}</Text>
                  </View>

                  {Boolean(selectedInvoice.roundOff !== undefined && selectedInvoice.roundOff !== 0) ? (
                    <View style={styles.totRow}>
                      <Text style={styles.totLabel}>Round Off:</Text>
                      <Text style={styles.totVal}>
                        {selectedInvoice.roundOff > 0 ? `+₹ ${selectedInvoice.roundOff.toFixed(2)}` : `-₹ ${Math.abs(selectedInvoice.roundOff).toFixed(2)}`}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.totRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: colors.neutral[200], paddingTop: 6 }]}>
                    <Text style={[styles.totLabel, { fontWeight: '900', color: colors.neutral[900] }]}>Grand Total:</Text>
                    <Text style={[styles.totVal, { fontWeight: '900', color: colors.primary[700], fontSize: 16 }]}>
                      ₹ {selectedInvoice.grandTotal.toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.totRow, { marginTop: 4 }]}>
                    <Text style={styles.totLabel}>Payment Mode:</Text>
                    <Text style={[styles.totVal, { fontWeight: '700' }]}>{selectedInvoice.paymentMode} ({selectedInvoice.status})</Text>
                  </View>

                  <View style={styles.totRow}>
                    <Text style={styles.totLabel}>Amount Paid:</Text>
                    <Text style={styles.totVal}>₹ {selectedInvoice.paidAmount.toFixed(2)}</Text>
                  </View>

                  {Boolean(selectedInvoice.balanceAmount !== undefined && selectedInvoice.balanceAmount > 0) ? (
                    <View style={styles.totRow}>
                      <Text style={[styles.totLabel, { color: colors.danger[600], fontWeight: '800' }]}>Balance Due:</Text>
                      <Text style={[styles.totVal, { color: colors.danger[600], fontWeight: '800' }]}>
                        ₹ {selectedInvoice.balanceAmount.toFixed(2)}
                      </Text>
                    </View>
                  ) : null}

                  {business.receiptFooterNote ? (
                    <Text style={{ fontSize: 9, color: colors.neutral[500], textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
                      {business.receiptFooterNote}
                    </Text>
                  ) : null}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.detailActions}>
                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: '#22c55e' }]}
                  onPress={() => handleShareWhatsApp(selectedInvoice)}
                  disabled={isSharing}
                >
                  <Text style={styles.modalActionText}>📄 Share PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: colors.neutral[800] }]}
                  onPress={() => handlePrintThermal(selectedInvoice)}
                  disabled={isPrinting}
                >
                  <Text style={styles.modalActionText}>🖨️ Thermal</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalActionBtn, { backgroundColor: colors.primary[600] }]}
                  onPress={() => handlePrintA4(selectedInvoice)}
                  disabled={isPrinting}
                >
                  <Text style={styles.modalActionText}>📄 A4 PDF</Text>
                </TouchableOpacity>

                {canProcessReturn ? (
                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: colors.danger[500] }]}
                    onPress={handleOpenReturnModal}
                  >
                    <Text style={styles.modalActionText}>🔄 Return</Text>
                  </TouchableOpacity>
                ) : null}

                {Boolean(selectedInvoice.balanceAmount !== undefined && selectedInvoice.balanceAmount > 0) ? (
                  <TouchableOpacity 
                    style={[styles.modalActionBtn, { backgroundColor: colors.warning[600] }]}
                    onPress={() => {
                      setSettleAmount(String(selectedInvoice.balanceAmount.toFixed(2)));
                      setSettleMode('CASH');
                      setSettleRef('');
                      setSettleNotes('');
                      setIsSettleModalOpen(true);
                    }}
                  >
                    <Text style={styles.modalActionText}>💳 Settle Dues (₹{selectedInvoice.balanceAmount.toFixed(0)})</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* 5. Invoice Return & Credit Note Modal */}
      {Boolean(isReturnModalOpen && selectedInvoice) ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsReturnModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.detailCard, { maxHeight: '90%' }]}>
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailTitle}>🔄 Process Sales Return</Text>
                  <Text style={styles.detailSub}>{selectedInvoice!.invoiceNumber} • {selectedInvoice!.partyName}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsReturnModalOpen(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ marginTop: 8 }}>
                <View style={styles.returnNoticeBanner}>
                  <Text style={styles.returnNoticeText}>
                    ℹ️ Restocked items return to branch inventory. Proportional discounts are deducted automatically from refund.
                  </Text>
                </View>

                {selectedInvoice!.items.map((it) => {
                  const currentRet = returnMap[it.itemId] || { qty: '0', reason: 'CUSTOMER_RETURN' };
                  const retQtyNum = parseFloat(currentRet.qty) || 0;
                  const itemDiscountPerUnit = it.discountPercent ? (it.unitPrice * (it.discountPercent / 100)) : 0;
                  const lineRefund = Math.max(0, retQtyNum * (it.unitPrice - itemDiscountPerUnit));

                  return (
                    <View key={it.itemId} style={styles.returnItemCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.neutral[900], flex: 1 }}>{it.name}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary[700] }}>₹{it.unitPrice.toFixed(2)}/unit</Text>
                      </View>
                      
                      <Text style={{ fontSize: 10, color: colors.neutral[500], marginTop: 2 }}>
                        Billed: {it.quantity} {it.unit || 'pcs'} • GST {it.taxRate}%
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.neutral[600] }}>Return Quantity</Text>
                          <TextInput
                            style={styles.returnQtyInput}
                            placeholder="0"
                            value={currentRet.qty}
                            onChangeText={(val) => {
                              setReturnMap(prev => ({
                                ...prev,
                                [it.itemId]: { ...currentRet, qty: val }
                              }));
                            }}
                            keyboardType="decimal-pad"
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.neutral[600] }}>Refund Payable</Text>
                          <View style={styles.refundValBox}>
                            <Text style={styles.refundValText}>₹ {lineRefund.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Restockable vs Defective/Damaged Selector */}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <TouchableOpacity
                          style={[
                            styles.returnReasonChip,
                            currentRet.reason === 'RESTOCKABLE_RETURN' && styles.returnReasonChipActive
                          ]}
                          onPress={() => {
                            setReturnMap(prev => ({
                              ...prev,
                              [it.itemId]: { ...currentRet, reason: 'RESTOCKABLE_RETURN' }
                            }));
                          }}
                        >
                          <Text style={[
                            styles.returnReasonText,
                            currentRet.reason === 'RESTOCKABLE_RETURN' && styles.returnReasonTextActive
                          ]}>
                            ✓ Restockable (+Stock)
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.returnReasonChip,
                            currentRet.reason === 'DEFECTIVE_DAMAGED' && styles.returnReasonChipDamagedActive
                          ]}
                          onPress={() => {
                            setReturnMap(prev => ({
                              ...prev,
                              [it.itemId]: { ...currentRet, reason: 'DEFECTIVE_DAMAGED' }
                            }));
                          }}
                        >
                          <Text style={[
                            styles.returnReasonText,
                            currentRet.reason === 'DEFECTIVE_DAMAGED' && styles.returnReasonTextDamagedActive
                          ]}>
                            ⚠️ Defective (No Restock)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Return Calculation Financial Summary */}
                {Boolean(returnSummary.grossReturn > 0) ? (
                  <View style={styles.returnSummaryCard}>
                    <Text style={styles.returnSummaryTitle}>Return Breakdown</Text>
                    
                    <View style={styles.retSummaryRow}>
                      <Text style={styles.retSummaryLabel}>Gross Item Value:</Text>
                      <Text style={styles.retSummaryVal}>₹ {returnSummary.grossReturn.toFixed(2)}</Text>
                    </View>

                    {Boolean(returnSummary.discountDeducted > 0) ? (
                      <View style={styles.retSummaryRow}>
                        <Text style={[styles.retSummaryLabel, { color: colors.danger[600] }]}>Discounts Adjusted:</Text>
                        <Text style={[styles.retSummaryVal, { color: colors.danger[600] }]}>- ₹ {returnSummary.discountDeducted.toFixed(2)}</Text>
                      </View>
                    ) : null}

                    <View style={styles.retSummaryDivider} />

                    <View style={styles.retSummaryRow}>
                      <Text style={[styles.retSummaryLabel, { fontWeight: '900', color: colors.neutral[900] }]}>Net Refund Payable:</Text>
                      <Text style={[styles.retSummaryVal, { fontWeight: '900', color: colors.success[700], fontSize: 15 }]}>
                        ₹ {returnSummary.netRefund.toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.retSummaryRow}>
                      <Text style={styles.retSummaryLabel}>Revised Bill Total:</Text>
                      <Text style={styles.retSummaryVal}>₹ {returnSummary.revisedTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity 
                  style={styles.cancelReturnBtn} 
                  onPress={() => setIsReturnModalOpen(false)}
                >
                  <Text style={styles.cancelReturnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.confirmReturnBtn} 
                  onPress={handleConfirmReturn}
                  disabled={isProcessingReturn}
                >
                  {isProcessingReturn ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmReturnText}>
                      ✓ Refund ₹{returnSummary.netRefund.toFixed(2)} & Restock
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* 6. Settle Outstanding Invoice Dues Modal */}
      {isSettleModalOpen && selectedInvoice ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setIsSettleModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.settleCard}>
              <Text style={styles.detailTitle}>💳 Settle Outstanding Dues</Text>
              <Text style={styles.detailSub}>
                {selectedInvoice.invoiceNumber} • {selectedInvoice.partyName || 'Customer'}
              </Text>

              <View style={styles.settleDuesBanner}>
                <Text style={styles.settleDuesBannerLabel}>Current Invoice Dues</Text>
                <Text style={styles.settleDuesBannerVal}>₹ {selectedInvoice.balanceAmount.toFixed(2)}</Text>
              </View>
              
              <Text style={styles.fieldLabel}>Payment Amount (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                value={settleAmount}
                onChangeText={setSettleAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              <Text style={styles.fieldLabel}>Payment Mode</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                {(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'] as const).map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.settleModeChip, settleMode === mode && styles.settleModeChipActive]}
                    onPress={() => setSettleMode(mode)}
                  >
                    <Text style={[styles.settleModeText, settleMode === mode && styles.settleModeTextActive]}>
                      {mode.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Reference # (UTR / Cheque)</Text>
              <TextInput
                style={styles.modalInput}
                value={settleRef}
                onChangeText={setSettleRef}
                placeholder="Optional transaction reference"
              />

              <Text style={styles.fieldLabel}>Notes / Remarks</Text>
              <TextInput
                style={styles.modalInput}
                value={settleNotes}
                onChangeText={setSettleNotes}
                placeholder="e.g. Settle customer Khata dues at counter"
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsSettleModalOpen(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalConfirmBtn} 
                  onPress={handleConfirmSettlePayment}
                  disabled={isProcessingSettle}
                >
                  <Text style={styles.modalConfirmText}>{isProcessingSettle ? 'Recording...' : 'Confirm Payment'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },

  // KPI Strip
  kpiStrip: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.neutral[900],
    marginTop: 2,
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.surface.border,
  },

  // Filter Section
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  searchInput: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: colors.neutral[900],
    marginBottom: 8,
  },
  statusChipsRow: {
    paddingVertical: 2,
  },
  statusChip: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
  },
  statusChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  statusChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // List
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  invoiceCard: {
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
  invoiceNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  returnBadge: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  returnBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
  },
  customerName: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  grandTotalText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  statusPaid: { backgroundColor: '#ecfdf5' },
  statusPartial: { backgroundColor: '#fffbeb' },
  statusUnpaid: { backgroundColor: '#fef2f2' },
  statusText: { fontSize: 9, fontWeight: '800' },
  statusTextPaid: { color: '#047857' },
  statusTextPartial: { color: '#b45309' },
  statusTextUnpaid: { color: '#b91c1c' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  dateText: {
    fontSize: 10,
    color: colors.neutral[500],
  },
  quickActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[700],
  },

  // Modal Common
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 440,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  detailSub: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  brandingHeaderBanner: {
    backgroundColor: colors.surface.background,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  brandingStoreName: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[900],
    textTransform: 'uppercase',
  },
  brandingTagline: {
    fontSize: 9,
    fontStyle: 'italic',
    color: colors.neutral[500],
    marginTop: 1,
  },
  brandingBranchText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[700],
    marginTop: 2,
  },
  brandingGstinText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral[800],
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.neutral[400],
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[700],
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  itName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  itSub: {
    fontSize: 10,
    color: colors.neutral[500],
  },
  itTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  totalsBox: {
    backgroundColor: colors.surface.background,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  totRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totLabel: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  totVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  modalActionBtn: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Return Modal Specific
  returnNoticeBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  returnNoticeText: {
    fontSize: 10,
    color: '#1d4ed8',
    lineHeight: 14,
  },
  returnItemCard: {
    backgroundColor: colors.surface.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  returnQtyInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  refundValBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginTop: 3,
  },
  refundValText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[700],
  },
  returnSummaryCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    marginTop: 8,
  },
  returnSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 6,
  },
  retSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  retSummaryLabel: {
    fontSize: 11,
    color: '#78350f',
  },
  retSummaryVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  retSummaryDivider: {
    height: 1,
    backgroundColor: '#fcd34d',
    marginVertical: 4,
  },
  cancelReturnBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  cancelReturnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  confirmReturnBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.danger[600],
    alignItems: 'center',
  },
  confirmReturnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  returnReasonChip: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  returnReasonChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  returnReasonChipDamagedActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  returnReasonText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  returnReasonTextActive: {
    color: '#047857',
  },
  returnReasonTextDamagedActive: {
    color: '#b45309',
  },
  settleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  settleDuesBanner: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settleDuesBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
  },
  settleDuesBannerVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#b91c1c',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
    marginTop: 6,
    marginBottom: 3,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    marginBottom: 4,
  },
  settleModeChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  settleModeChipActive: {
    backgroundColor: colors.primary[600],
  },
  settleModeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  settleModeTextActive: {
    color: '#fff',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
});
