import React, { useState, useEffect, useMemo } from 'react';
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
import { LedgerEntry, Party, ItemCategory } from '../types';

export const LedgerScreen: React.FC = () => {
  const [entries, setEntries] = useState<LedgerEntry[]>(() => store.getLedgerEntries());
  const [parties, setParties] = useState<Party[]>(() => store.getParties());
  const [expenseCategories, setExpenseCategories] = useState<ItemCategory[]>(() => store.getExpenseCategories());
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE'>('ALL');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'ALL'>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Recording Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordType, setRecordType] = useState<'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE'>('PAYMENT_IN');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [partySearch, setPartySearch] = useState('');
  const [customPayeeName, setCustomPayeeName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('General Expense');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    store.fetchParties();
    store.fetchExpenseCategories();
    const unsubscribe = store.subscribe(() => {
      setEntries(store.getLedgerEntries());
      setParties(store.getParties());
      setExpenseCategories(store.getExpenseCategories());
    });
    return () => { unsubscribe(); };
  }, []);

  const customers = useMemo(() => parties.filter(p => p.type === 'CUSTOMER'), [parties]);
  const suppliers = useMemo(() => parties.filter(p => p.type === 'SUPPLIER'), [parties]);

  const candidateParties = recordType === 'PAYMENT_IN' ? customers : suppliers;
  const filteredCandidateParties = useMemo(() => {
    if (!partySearch.trim()) return candidateParties.slice(0, 5);
    const q = partySearch.toLowerCase().trim();
    return candidateParties.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.phone && p.phone.includes(q))
    ).slice(0, 6);
  }, [candidateParties, partySearch]);

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Filtered entries computation
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    return entries.filter(e => {
      // Type filter
      if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;

      // Date filter
      const entryDate = e.date ? e.date.split('T')[0] : '';
      if (dateFilter === 'TODAY' && entryDate !== todayStr) return false;
      if (dateFilter === 'WEEK' && entryDate < sevenDaysAgo) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = e.title?.toLowerCase().includes(q);
        const matchParty = e.partyOrPayee?.toLowerCase().includes(q);
        const matchNotes = e.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchParty && !matchNotes) return false;
      }

      return true;
    });
  }, [entries, typeFilter, dateFilter, searchQuery]);

  const totalIn = filteredEntries.filter(e => e.type === 'PAYMENT_IN').reduce((acc, e) => acc + e.amount, 0);
  const totalOut = filteredEntries.filter(e => e.type === 'PAYMENT_OUT' || e.type === 'EXPENSE').reduce((acc, e) => acc + e.amount, 0);
  const netCashflow = totalIn - totalOut;

  const handleOpenRecordModal = (type: 'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE' = 'PAYMENT_IN') => {
    setRecordType(type);
    setSelectedPartyId(null);
    setPartySearch('');
    setCustomPayeeName('');
    setSelectedCategory('General Expense');
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setAmount('');
    setPaymentMode('CASH');
    setReferenceNumber('');
    setNotes('');
    setIsRecordModalOpen(true);
  };

  const handleSelectParty = (p: Party) => {
    setSelectedPartyId(p.id);
    setPartySearch(p.name);
    // If party has outstanding dues, suggest that amount
    if (recordType === 'PAYMENT_IN' && p.currentBalance > 0) {
      setAmount(String(p.currentBalance));
    } else if (recordType === 'PAYMENT_OUT' && p.currentBalance < 0) {
      setAmount(String(Math.abs(p.currentBalance)));
    }
  };

  const handleSaveEntry = async () => {
    const numAmt = parseFloat(amount) || 0;
    if (numAmt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }

    let finalPartyOrPayee = '';
    let finalPartyId: string | undefined = undefined;

    if (recordType === 'PAYMENT_IN' || recordType === 'PAYMENT_OUT') {
      if (selectedParty) {
        finalPartyOrPayee = selectedParty.name;
        finalPartyId = selectedParty.id;
      } else if (partySearch.trim()) {
        finalPartyOrPayee = partySearch.trim();
      } else {
        Alert.alert(
          'Party Required',
          recordType === 'PAYMENT_IN' 
            ? 'Please select or enter the customer name paying this amount.'
            : 'Please select or enter the supplier receiving this payment.'
        );
        return;
      }
    } else {
      // EXPENSE
      if (!customPayeeName.trim() && !partySearch.trim()) {
        Alert.alert('Payee Required', 'Please enter who received this expense payment (payee name).');
        return;
      }
      finalPartyOrPayee = (customPayeeName || partySearch).trim();
    }

    let resolvedCategory = selectedCategory;
    if (recordType === 'EXPENSE' && isAddingNewCategory && newCategoryName.trim()) {
      resolvedCategory = newCategoryName.trim();
      await store.addExpenseCategory(resolvedCategory);
    }

    const title = recordType === 'PAYMENT_IN' 
      ? `Customer Payment (${finalPartyOrPayee})` 
      : recordType === 'PAYMENT_OUT' 
        ? `Supplier Payout (${finalPartyOrPayee})` 
        : `Expense: ${resolvedCategory}`;

    setIsSaving(true);
    try {
      await store.addPayment({
        type: recordType,
        title,
        partyOrPayee: finalPartyOrPayee,
        partyId: finalPartyId,
        category: recordType === 'EXPENSE' ? resolvedCategory : undefined,
        paymentMode,
        referenceNumber: referenceNumber.trim() || undefined,
        amount: numAmt,
        notes: notes.trim() || undefined,
      });

      setIsRecordModalOpen(false);
      Alert.alert(
        'Entry Saved', 
        finalPartyId 
          ? `Recorded ₹${numAmt.toFixed(2)} and updated Khata balance for ${finalPartyOrPayee}.`
          : `Financial daybook entry recorded successfully.`
      );
    } catch (e: any) {
      Alert.alert('Save Error', e?.message || 'Could not record ledger entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const defaultExpenseCategories = [
    'Rent',
    'Electricity & Water',
    'Staff Salaries',
    'Tea & Food Snacks',
    'Packaging & Bags',
    'Transportation & Fuel',
    'Store Maintenance',
    'General Expense'
  ];

  const allExpenseCategoryNames = Array.from(
    new Set([...defaultExpenseCategories, ...expenseCategories.map(c => c.name)])
  );

  return (
    <View style={styles.container}>
      {/* 1. Cash Balance & Summary Section */}
      <View style={styles.summarySection}>
        <View style={styles.balanceHeader}>
          <View>
            <Text style={styles.headerLabel}>Daybook Cashflow ({dateFilter})</Text>
            <Text style={[styles.headerAmount, netCashflow >= 0 ? styles.amtGreen : styles.amtRed]}>
              {netCashflow >= 0 ? '+ ' : '- '}₹ {Math.abs(netCashflow).toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity style={styles.recordBtn} onPress={() => handleOpenRecordModal('PAYMENT_IN')}>
            <Text style={styles.recordBtnText}>+ Record Entry</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flowRow}>
          <View style={[styles.flowCard, { borderLeftColor: colors.success[500] }]}>
            <Text style={styles.flowLabel}>Money In (Collections)</Text>
            <Text style={[styles.flowVal, { color: colors.success[700] }]}>+ ₹{totalIn.toFixed(2)}</Text>
          </View>

          <View style={[styles.flowCard, { borderLeftColor: colors.danger[500] }]}>
            <Text style={styles.flowLabel}>Money Out (Paid / Exp)</Text>
            <Text style={[styles.flowVal, { color: colors.danger[700] }]}>- ₹{totalOut.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* 2. Filters & Search Bar */}
      <View style={styles.filtersBar}>
        {/* Date presets */}
        <View style={styles.presetRow}>
          {(['TODAY', 'WEEK', 'ALL'] as const).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.presetChip, dateFilter === d && styles.presetChipActive]}
              onPress={() => setDateFilter(d)}
            >
              <Text style={[styles.presetChipText, dateFilter === d && styles.presetChipTextActive]}>
                {d === 'TODAY' ? 'Today' : d === 'WEEK' ? 'Last 7 Days' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type filters */}
        <View style={styles.typeFilterRow}>
          {(['ALL', 'PAYMENT_IN', 'PAYMENT_OUT', 'EXPENSE'] as const).map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfChip, typeFilter === tf && styles.tfChipActive]}
              onPress={() => setTypeFilter(tf)}
            >
              <Text style={[styles.tfChipText, typeFilter === tf && styles.tfChipTextActive]}>
                {tf === 'ALL' ? 'All Entries' : tf === 'PAYMENT_IN' ? '📥 Money In' : tf === 'PAYMENT_OUT' ? '📤 Payouts' : '💸 Expenses'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search entries by party, title, or reference..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* 3. Transactions Feed */}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>
          Filtered Entries ({filteredEntries.length})
        </Text>
        <FlatList
          data={filteredEntries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>📖</Text>
              <Text style={styles.emptyTitle}>No matching ledger entries</Text>
              <Text style={styles.emptySub}>Tap "+ Record Entry" above to add collections, payouts, or store expenses.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isCredit = item.type === 'PAYMENT_IN';
            const isPO = Boolean(item.purchaseOrderId || item.purchaseOrderNumber || item.referenceType === 'PURCHASE_ORDER');
            const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }) : 'Recent';

            return (
              <View style={styles.entryCard}>
                <View style={[styles.entryIconBox, isCredit ? styles.iconCredit : isPO ? styles.iconPO : styles.iconDebit]}>
                  <Text style={{ fontSize: 18 }}>
                    {isCredit ? '📥' : isPO ? '📦' : item.type === 'EXPENSE' ? '💸' : '📤'}
                  </Text>
                </View>

                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
                    {isPO && (
                      <View style={styles.poBadge}>
                        <Text style={styles.poBadgeText}>PO PAY</Text>
                      </View>
                    )}
                    {item.category && item.type === 'EXPENSE' && (
                      <View style={styles.catBadge}>
                        <Text style={styles.catBadgeText}>{item.category}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.entryParty} numberOfLines={1}>
                    👤 {item.partyOrPayee} • <Text style={{ fontWeight: '700' }}>{item.paymentMode}</Text>
                    {item.referenceNumber ? ` • Ref: ${item.referenceNumber}` : ''}
                  </Text>
                  <Text style={styles.entryDate}>{dateStr}</Text>
                  {item.notes ? (
                    <Text style={styles.entryNotes} numberOfLines={1}>💬 {item.notes}</Text>
                  ) : null}
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

      {/* 4. Record Payment / Expense Modal */}
      <Modal visible={isRecordModalOpen} transparent animationType="slide" onRequestClose={() => setIsRecordModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Record Financial Entry</Text>
              <TouchableOpacity onPress={() => setIsRecordModalOpen(false)}>
                <Text style={{ fontSize: 18, color: colors.neutral[500], fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <View style={styles.typeRow}>
              {(['PAYMENT_IN', 'PAYMENT_OUT', 'EXPENSE'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, recordType === t && styles.typeBtnActive]}
                  onPress={() => {
                    setRecordType(t);
                    setSelectedPartyId(null);
                    setPartySearch('');
                  }}
                >
                  <Text style={[styles.typeBtnText, recordType === t && styles.typeBtnTextActive]}>
                    {t === 'PAYMENT_IN' && '📥 Money In'}
                    {t === 'PAYMENT_OUT' && '📤 Payout'}
                    {t === 'EXPENSE' && '💸 Expense'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ marginTop: 8, maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {/* Amount Field */}
              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 22, fontWeight: '900', color: recordType === 'PAYMENT_IN' ? colors.success[700] : colors.danger[700] }]}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />

              {/* Customer / Supplier Party Selection for PAYMENT_IN and PAYMENT_OUT */}
              {(recordType === 'PAYMENT_IN' || recordType === 'PAYMENT_OUT') ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.fieldLabel}>
                    {recordType === 'PAYMENT_IN' ? 'Customer (Khata Account) *' : 'Supplier (Payable Account) *'}
                  </Text>

                  {selectedParty ? (
                    <View style={styles.selectedPartyCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedPartyName}>👤 {selectedParty.name}</Text>
                        <Text style={styles.selectedPartyMeta}>
                          {selectedParty.phone || 'No phone'} • Current Balance:{' '}
                          <Text style={{ fontWeight: '800', color: selectedParty.currentBalance > 0 ? colors.danger[700] : selectedParty.currentBalance < 0 ? colors.warning[700] : colors.success[700] }}>
                            ₹{Math.abs(selectedParty.currentBalance).toFixed(2)} ({selectedParty.currentBalance > 0 ? 'Receivable Due' : selectedParty.currentBalance < 0 ? 'Payable Due' : 'Settled'})
                          </Text>
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.clearPartyBtn}
                        onPress={() => {
                          setSelectedPartyId(null);
                          setPartySearch('');
                        }}
                      >
                        <Text style={styles.clearPartyBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <TextInput
                        style={styles.modalInput}
                        placeholder={recordType === 'PAYMENT_IN' ? 'Type customer name or search...' : 'Type supplier name or search...'}
                        value={partySearch}
                        onChangeText={setPartySearch}
                      />

                      {/* Suggestions List */}
                      {filteredCandidateParties.length > 0 && (
                        <View style={styles.suggestionBox}>
                          <Text style={styles.suggestionTitle}>Quick Select Registered Contact:</Text>
                          {filteredCandidateParties.map(p => (
                            <TouchableOpacity
                              key={p.id}
                              style={styles.suggestionRow}
                              onPress={() => handleSelectParty(p)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.suggName}>{p.name}</Text>
                                <Text style={styles.suggSub}>{p.phone || 'No phone'}</Text>
                              </View>
                              <Text style={[styles.suggBal, p.currentBalance > 0 ? { color: colors.danger[700] } : { color: colors.neutral[600] }]}>
                                ₹{Math.abs(p.currentBalance).toFixed(2)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                /* EXPENSE Form Fields */
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.fieldLabel}>Expense Category *</Text>
                  
                  {!isAddingNewCategory ? (
                    <View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                        {allExpenseCategoryNames.map(cat => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                            onPress={() => setSelectedCategory(cat)}
                          >
                            <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      <TouchableOpacity onPress={() => setIsAddingNewCategory(true)}>
                        <Text style={styles.addCatLink}>+ Add New Category</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.newCatBox}>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Enter category name (e.g. Tea & Snacks)"
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                      />
                      <TouchableOpacity 
                        style={{ marginTop: 6 }} 
                        onPress={() => {
                          setIsAddingNewCategory(false);
                          setNewCategoryName('');
                        }}
                      >
                        <Text style={styles.cancelCatText}>Cancel new category</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Payee Name (Who was paid) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Landlord, BESCOM Power, Delivery Boy"
                    value={customPayeeName}
                    onChangeText={setCustomPayeeName}
                  />
                </View>
              )}

              {/* Payment Mode Selector */}
              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Payment Mode</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.mChip, paymentMode === m && styles.mChipActive]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text style={[styles.mChipText, paymentMode === m && styles.mChipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reference / Txn Number */}
              <Text style={styles.fieldLabel}>Reference / Cheque / Voucher # (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. UPI Ref 3091024 or Voucher #04"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes / Settlement Details</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Cleared bill due or monthly office supplies"
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRecordModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]} 
                onPress={handleSaveEntry}
                disabled={isSaving}
              >
                <Text style={styles.saveBtnText}>
                  {isSaving ? 'Saving...' : 'Save Entry'}
                </Text>
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
    fontWeight: '700',
  },
  headerAmount: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
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
  filtersBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
  },
  presetChipActive: {
    backgroundColor: colors.primary[500],
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  presetChipTextActive: {
    color: '#fff',
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  tfChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: '#fff',
  },
  tfChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  tfChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tfChipTextActive: {
    color: colors.primary[700],
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    backgroundColor: colors.surface.background,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[600],
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCredit: { backgroundColor: '#dcfce7' },
  iconDebit: { backgroundColor: '#fee2e2' },
  iconPO: { backgroundColor: '#ede9fe' },
  entryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  poBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  poBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6d28d9',
  },
  catBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  entryParty: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
  },
  entryDate: {
    fontSize: 10,
    color: colors.neutral[400],
    marginTop: 1,
  },
  entryNotes: {
    fontSize: 10,
    color: colors.neutral[500],
    fontStyle: 'italic',
    marginTop: 2,
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  amtGreen: { color: colors.success[700] },
  amtRed: { color: colors.danger[700] },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  emptySub: {
    fontSize: 11,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, maxHeight: '90%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  typeRow: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.neutral[100], alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.primary[500] },
  typeBtnText: { fontSize: 11, fontWeight: '700', color: colors.neutral[700] },
  typeBtnTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.neutral[700], marginTop: 8, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: colors.surface.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  selectedPartyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    padding: 10,
    borderRadius: 8,
  },
  selectedPartyName: { fontSize: 13, fontWeight: '800', color: colors.neutral[900] },
  selectedPartyMeta: { fontSize: 10, color: colors.neutral[600], marginTop: 2 },
  clearPartyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  clearPartyBtnText: { fontSize: 10, fontWeight: '800', color: colors.primary[700] },
  suggestionBox: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#fff',
    maxHeight: 150,
  },
  suggestionTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.neutral[400],
    paddingHorizontal: 8,
    paddingTop: 6,
    textTransform: 'uppercase',
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  suggName: { fontSize: 12, fontWeight: '700', color: colors.neutral[900] },
  suggSub: { fontSize: 10, color: colors.neutral[500] },
  suggBal: { fontSize: 11, fontWeight: '800' },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
    marginRight: 6,
  },
  catChipActive: { backgroundColor: colors.primary[500] },
  catChipText: { fontSize: 10, fontWeight: '700', color: colors.neutral[700] },
  catChipTextActive: { color: '#fff' },
  addCatLink: { fontSize: 11, fontWeight: '800', color: colors.primary[600], marginTop: 4 },
  newCatBox: { padding: 4 },
  cancelCatText: { fontSize: 10, fontWeight: '700', color: colors.danger[600] },
  mChip: { flex: 1, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.neutral[100], alignItems: 'center' },
  mChipActive: { backgroundColor: colors.primary[500] },
  mChipText: { fontSize: 10, fontWeight: '700', color: colors.neutral[700] },
  mChipTextActive: { color: '#fff' },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.surface.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.neutral[600] },
  saveBtn: { flex: 2, backgroundColor: colors.primary[500], paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
