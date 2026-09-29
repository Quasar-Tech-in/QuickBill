import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  ScrollView, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { LedgerEntry, Party } from '../types';

export const LedgerScreen: React.FC = () => {
  const [entries, setEntries] = useState<LedgerEntry[]>(() => store.getLedgerEntries());
  const [parties, setParties] = useState<Party[]>(() => store.getParties());

  // Payment Recording Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordType, setRecordType] = useState<'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE'>('PAYMENT_IN');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setEntries(store.getLedgerEntries());
      setParties(store.getParties());
    });
    return () => { unsubscribe(); };
  }, []);

  const totalIn = entries.filter(e => e.type === 'PAYMENT_IN').reduce((acc, e) => acc + e.amount, 0);
  const totalOut = entries.filter(e => e.type === 'PAYMENT_OUT' || e.type === 'EXPENSE').reduce((acc, e) => acc + e.amount, 0);
  const netCashflow = totalIn - totalOut;

  const handleSaveEntry = () => {
    const numAmt = parseFloat(amount) || 0;
    if (numAmt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount.');
      return;
    }
    if (!partyName.trim()) {
      Alert.alert('Validation Error', 'Party or Payee name is required.');
      return;
    }

    store.addPayment({
      type: recordType,
      title: recordType === 'PAYMENT_IN' ? 'Payment Received' : recordType === 'PAYMENT_OUT' ? 'Payment Paid' : 'Store Expense',
      partyOrPayee: partyName.trim(),
      paymentMode,
      amount: numAmt,
      notes: notes.trim() || undefined,
    });

    setIsRecordModalOpen(false);
    setPartyName('');
    setAmount('');
    setNotes('');
  };

  return (
    <View style={styles.container}>
      {/* Cash Balance Cards */}
      <View style={styles.summarySection}>
        <View style={styles.balanceHeader}>
          <View>
            <Text style={styles.headerLabel}>Net Daybook Balance</Text>
            <Text style={styles.headerAmount}>₹ {netCashflow.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.recordBtn} onPress={() => setIsRecordModalOpen(true)}>
            <Text style={styles.recordBtnText}>+ Record Entry</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flowRow}>
          <View style={[styles.flowCard, { borderLeftColor: colors.success[500] }]}>
            <Text style={styles.flowLabel}>Money In (Cash/UPI)</Text>
            <Text style={[styles.flowVal, { color: colors.success[700] }]}>+ ₹{totalIn.toFixed(2)}</Text>
          </View>

          <View style={[styles.flowCard, { borderLeftColor: colors.danger[500] }]}>
            <Text style={styles.flowLabel}>Money Out (Paid/Exp)</Text>
            <Text style={[styles.flowVal, { color: colors.danger[700] }]}>- ₹{totalOut.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Transactions Feed */}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>Daybook & Register Entries ({entries.length})</Text>
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isCredit = item.type === 'PAYMENT_IN';
            const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.entryCard}>
                <View style={styles.entryIconBox}>
                  <Text style={{ fontSize: 18 }}>
                    {isCredit ? '📥' : '📤'}
                  </Text>
                </View>

                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={styles.entryTitle}>{item.title}</Text>
                  <Text style={styles.entryParty}>
                    {item.partyOrPayee} • {item.paymentMode}
                  </Text>
                  <Text style={styles.entryDate}>{dateStr}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.entryAmount, isCredit ? styles.amtGreen : styles.amtRed]}>
                    {isCredit ? '+' : '-'} ₹{item.amount.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* Record Payment / Expense Modal */}
      <Modal visible={isRecordModalOpen} transparent animationType="slide" onRequestClose={() => setIsRecordModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Financial Entry</Text>

            {/* Type Selector */}
            <View style={styles.typeRow}>
              {(['PAYMENT_IN', 'PAYMENT_OUT', 'EXPENSE'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, recordType === t && styles.typeBtnActive]}
                  onPress={() => setRecordType(t)}
                >
                  <Text style={[styles.typeBtnText, recordType === t && styles.typeBtnTextActive]}>
                    {t === 'PAYMENT_IN' && '📥 Payment In'}
                    {t === 'PAYMENT_OUT' && '📤 Payment Out'}
                    {t === 'EXPENSE' && '💸 Expense'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ marginTop: 10 }}>
              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 20, fontWeight: '800' }]}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>Party / Payee Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Ramesh Kumar or Electricity Board"
                value={partyName}
                onChangeText={setPartyName}
              />

              <Text style={styles.fieldLabel}>Payment Mode</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.mChip, paymentMode === m && styles.mChipActive]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text style={[styles.mChipText, paymentMode === m && styles.mChipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes / Reference Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Inv #102 settlement or Receipt #"
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRecordModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEntry}>
                <Text style={styles.saveBtnText}>Save Entry</Text>
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
  summarySection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 11,
    color: colors.neutral[600],
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  headerAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary[700],
  },
  recordBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  recordBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  flowRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flowCard: {
    flex: 1,
    backgroundColor: colors.surface.card,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderLeftWidth: 3,
  },
  flowLabel: { fontSize: 10, color: colors.neutral[600], fontWeight: '600' },
  flowVal: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[700],
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  entryParty: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 1,
  },
  entryDate: {
    fontSize: 10,
    color: colors.neutral[400],
    marginTop: 1,
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  amtGreen: { color: colors.success[700] },
  amtRed: { color: colors.danger[700] },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  typeRow: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.neutral[100], alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primary[500] },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: colors.neutral[700] },
  typeBtnTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.neutral[700], marginTop: 8, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: colors.surface.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  mChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.neutral[100] },
  mChipActive: { backgroundColor: colors.primary[500] },
  mChipText: { fontSize: 11, fontWeight: '700', color: colors.neutral[700] },
  mChipTextActive: { color: '#fff' },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.surface.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.neutral[600] },
  saveBtn: { flex: 2, backgroundColor: colors.primary[500], paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
