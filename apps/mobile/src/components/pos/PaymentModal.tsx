import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { colors } from '../../theme/colors';
import { Party } from '../../types';

interface PaymentModalProps {
  visible: boolean;
  grandTotal: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  parties: Party[];
  onClose: () => void;
  onCompleteSale: (saleDetails: {
    customerName: string;
    customerPhone: string;
    partyId?: string;
    paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'SPLIT';
    paidAmount: number;
    balanceAmount: number;
    notes?: string;
  }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  grandTotal,
  subtotal,
  taxTotal,
  discountTotal,
  parties,
  onClose,
  onCompleteSale,
}) => {
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'SPLIT'>('UPI');
  const [customerName, setCustomerName] = useState('Counter Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string | undefined>(undefined);
  const [paidInput, setPaidInput] = useState<string>(String(grandTotal));
  const [notes, setNotes] = useState('');

  // Split amounts
  const [cashSplit, setCashSplit] = useState('');
  const [upiSplit, setUpiSplit] = useState('');
  const [cardSplit, setCardSplit] = useState('');

  const customers = parties.filter(p => p.type === 'CUSTOMER');

  const handleSelectCustomer = (party: Party) => {
    setSelectedPartyId(party.id);
    setCustomerName(party.name);
    setCustomerPhone(party.phone || '');
  };

  const currentPaid = selectedPaymentMode === 'SPLIT'
    ? (parseFloat(cashSplit) || 0) + (parseFloat(upiSplit) || 0) + (parseFloat(cardSplit) || 0)
    : (paidInput !== '' ? parseFloat(paidInput) || 0 : grandTotal);

  const balanceDue = Math.max(0, Number((grandTotal - currentPaid).toFixed(2)));
  const changeToReturn = currentPaid > grandTotal ? Number((currentPaid - grandTotal).toFixed(2)) : 0;

  const handleQuickCash = (amount: number) => {
    setPaidInput(String(amount));
  };

  const handleCheckout = () => {
    onCompleteSale({
      customerName: customerName.trim() || 'Counter Customer',
      customerPhone: customerPhone.trim(),
      partyId: selectedPartyId,
      paymentMode: selectedPaymentMode,
      paidAmount: Math.min(currentPaid, grandTotal),
      balanceAmount: balanceDue,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.backdrop}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Collect Payment</Text>
              <Text style={styles.headerSub}>Complete billing & finalize receipt</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Grand Total Highlight */}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Grand Total Payable</Text>
              <Text style={styles.totalAmount}>₹ {grandTotal.toFixed(2)}</Text>
              <View style={styles.totalBreakdown}>
                <Text style={styles.breakdownText}>Subtotal: ₹{subtotal.toFixed(2)}</Text>
                <Text style={styles.breakdownText}>Tax: ₹{taxTotal.toFixed(2)}</Text>
                {discountTotal > 0 && (
                  <Text style={[styles.breakdownText, { color: '#16a34a' }]}>Disc: -₹{discountTotal.toFixed(2)}</Text>
                )}
              </View>
            </View>

            {/* Customer Details */}
            <Text style={styles.sectionHeading}>Customer Details</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1.2, marginRight: 8 }]}
                placeholder="Customer Name"
                value={customerName}
                onChangeText={setCustomerName}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Phone (WhatsApp)"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Quick Customer Picks */}
            {customers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerChipsRow}>
                {customers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.customerChip,
                      selectedPartyId === c.id && styles.customerChipActive,
                    ]}
                    onPress={() => handleSelectCustomer(c)}
                  >
                    <Text style={[styles.chipText, selectedPartyId === c.id && styles.chipTextActive]}>
                      👤 {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Payment Mode Selector */}
            <Text style={styles.sectionHeading}>Payment Tender</Text>
            <View style={styles.modeGrid}>
              {(['UPI', 'CASH', 'CARD', 'CREDIT', 'SPLIT'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.modeBtn,
                    selectedPaymentMode === mode && styles.modeBtnActive,
                  ]}
                  onPress={() => {
                    setSelectedPaymentMode(mode);
                    if (mode !== 'SPLIT') {
                      setPaidInput(String(grandTotal));
                    }
                  }}
                >
                  <Text style={[styles.modeBtnText, selectedPaymentMode === mode && styles.modeBtnTextActive]}>
                    {mode === 'UPI' && '📱 UPI / QR'}
                    {mode === 'CASH' && '💵 Cash'}
                    {mode === 'CARD' && '💳 Card'}
                    {mode === 'CREDIT' && '⏳ Credit'}
                    {mode === 'SPLIT' && '🔀 Split'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mode Specific Inputs */}
            {selectedPaymentMode === 'CASH' && (
              <View style={styles.cashBox}>
                <Text style={styles.subHeading}>Cash Tender Received</Text>
                <TextInput
                  style={styles.amountInput}
                  value={paidInput}
                  onChangeText={setPaidInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
                {/* Cash shortcuts */}
                <View style={styles.shortcutsRow}>
                  {[grandTotal, 100, 200, 500, 1000, 2000].map((amt) => {
                    if (amt < grandTotal && amt !== grandTotal) return null;
                    return (
                      <TouchableOpacity
                        key={amt}
                        style={styles.shortcutChip}
                        onPress={() => handleQuickCash(amt)}
                      >
                        <Text style={styles.shortcutText}>₹{amt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {changeToReturn > 0 && (
                  <View style={styles.changeBox}>
                    <Text style={styles.changeLabel}>Change to Return to Customer:</Text>
                    <Text style={styles.changeValue}>₹ {changeToReturn.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}

            {selectedPaymentMode === 'SPLIT' && (
              <View style={styles.splitBox}>
                <Text style={styles.subHeading}>Split Tender Breakdown</Text>
                <View style={styles.splitRow}>
                  <Text style={styles.splitLabel}>💵 Cash:</Text>
                  <TextInput
                    style={styles.splitInput}
                    placeholder="0.00"
                    value={cashSplit}
                    onChangeText={setCashSplit}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.splitRow}>
                  <Text style={styles.splitLabel}>📱 UPI:</Text>
                  <TextInput
                    style={styles.splitInput}
                    placeholder="0.00"
                    value={upiSplit}
                    onChangeText={setUpiSplit}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.splitRow}>
                  <Text style={styles.splitLabel}>💳 Card:</Text>
                  <TextInput
                    style={styles.splitInput}
                    placeholder="0.00"
                    value={cardSplit}
                    onChangeText={setCardSplit}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            {balanceDue > 0 && (
              <View style={styles.dueAlert}>
                <Text style={styles.dueAlertText}>
                  ⚠️ Balance of ₹{balanceDue.toFixed(2)} will be marked as Customer Outstanding.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Checkout CTA */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
              <Text style={styles.checkoutBtnText}>Complete Sale (₹{grandTotal.toFixed(2)})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  headerSub: {
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.neutral[600],
    fontWeight: '700',
  },
  scrollBody: {
    padding: 16,
  },
  totalBox: {
    backgroundColor: colors.primary[50],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[700],
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary[700],
    marginVertical: 4,
  },
  totalBreakdown: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  breakdownText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
    marginBottom: 8,
    marginTop: 8,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  customerChipsRow: {
    marginBottom: 12,
  },
  customerChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  customerChipActive: {
    backgroundColor: colors.primary[500],
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  chipTextActive: {
    color: '#fff',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  cashBox: {
    backgroundColor: colors.surface.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 12,
  },
  amountInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary[500],
    borderRadius: 8,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    justifyContent: 'center',
  },
  shortcutChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[600],
  },
  changeBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: colors.success[50],
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success[700],
  },
  changeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.success[700],
  },
  splitBox: {
    backgroundColor: colors.surface.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 12,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  splitLabel: {
    width: 80,
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  splitInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  dueAlert: {
    backgroundColor: colors.warning[50],
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning[100],
    marginTop: 8,
  },
  dueAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning[700],
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  checkoutBtn: {
    backgroundColor: colors.success[500],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
