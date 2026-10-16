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
  Linking, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Party, Invoice, PurchaseOrder, LedgerEntry } from '../types';
import { openWhatsAppChat } from '../utils/shareInvoice';

export const PartiesScreen: React.FC = () => {
  const [parties, setParties] = useState<Party[]>(() => store.getParties());
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => store.getPurchaseOrders());
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(() => store.getLedgerEntries());
  const [businessProfile, setBusinessProfile] = useState(() => store.getBusinessProfile());

  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [statementParty, setStatementParty] = useState<Party | null>(null);
  const [statementRange, setStatementRange] = useState<'THIS_MONTH' | 'LAST_30' | 'ALL'>('THIS_MONTH');

  // Form State (Add / Edit)
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formAddress, setFormAddress] = useState('');

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setParties(store.getParties());
      setInvoices(store.getInvoices());
      setPurchaseOrders(store.getPurchaseOrders());
      setLedgerEntries(store.getLedgerEntries());
      setBusinessProfile(store.getBusinessProfile());
    });
    return () => { unsubscribe(); };
  }, []);

  const filteredParties = parties
    .filter(p => p.type === activeTab)
    .filter(p => {
      const q = searchQuery.toLowerCase().trim();
      return !q || p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q));
    });

  const openAddModal = () => {
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormGstin('');
    setFormAddress('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (party: Party) => {
    setEditingParty(party);
    setFormName(party.name);
    setFormPhone(party.phone || '');
    setFormEmail(party.email || '');
    setFormGstin(party.gstin || '');
    setFormAddress(party.address || '');
  };

  const handleSaveNewParty = () => {
    if (!formName.trim()) {
      Alert.alert('Validation Error', 'Party name is required.');
      return;
    }

    store.saveParty({
      id: `pty-${Date.now()}`,
      name: formName.trim(),
      type: activeTab,
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      gstin: formGstin.trim().toUpperCase() || undefined,
      address: formAddress.trim() || undefined,
      currentBalance: 0,
    });

    setIsAddModalOpen(false);
    Alert.alert('Party Saved', `${formName.trim()} added to ${activeTab === 'CUSTOMER' ? 'customers' : 'suppliers'}.`);
  };

  const handleSaveEditParty = () => {
    if (!editingParty || !formName.trim()) {
      Alert.alert('Validation Error', 'Party name is required.');
      return;
    }

    store.updateParty(editingParty.id, {
      name: formName.trim(),
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      gstin: formGstin.trim().toUpperCase() || undefined,
      address: formAddress.trim() || undefined,
    });

    setEditingParty(null);
    Alert.alert('Profile Updated', 'Party details updated successfully.');
  };

  const handleDeleteParty = (party: Party) => {
    if (party.currentBalance !== 0) {
      Alert.alert(
        'Cannot Delete Contact',
        `This party has an unsettled Khata balance of ₹${Math.abs(party.currentBalance).toFixed(2)}. Please settle dues in the financial ledger before deleting.`
      );
      return;
    }

    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${party.name}" (${party.type})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            store.deleteParty(party.id);
            Alert.alert('Deleted', 'Party contact removed.');
          }
        }
      ]
    );
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Phone', 'No phone number registered for this contact.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = (phoneNumber?: string, partyName?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Phone', 'No phone number registered for this contact.');
      return;
    }
    openWhatsAppChat(phoneNumber, `Hello ${partyName || ''}, greetings from ${businessProfile.name}!`);
  };

  // Compile Chronological Khata Statement for Party
  const getPartyTransactions = (party: Party) => {
    const isCust = party.type === 'CUSTOMER';
    let txs: Array<{
      id: string;
      date: string;
      type: 'INVOICE' | 'PAYMENT' | 'PO_INWARD' | 'PO_PAYMENT';
      title: string;
      debit: number; // increases customer balance / decreases supplier payable
      credit: number; // decreases customer balance / increases supplier payable
      reference: string;
      paymentMode?: string;
    }> = [];

    const now = new Date();
    let cutoff: Date | null = null;
    if (statementRange === 'THIS_MONTH') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (statementRange === 'LAST_30') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    if (isCust) {
      // Invoices
      invoices
        .filter(inv => inv.partyId === party.id)
        .forEach(inv => {
          txs.push({
            id: inv.id,
            date: inv.date,
            type: 'INVOICE',
            title: `Sale Invoice #${inv.invoiceNumber}`,
            debit: inv.grandTotal, // customer owes
            credit: inv.paidAmount, // paid upfront
            reference: inv.invoiceNumber,
            paymentMode: inv.paymentMode,
          });
        });

      // Payments in financial ledger
      ledgerEntries
        .filter(e => e.partyId === party.id && e.type === 'PAYMENT_IN' && !e.title.includes('Sale Receipt'))
        .forEach(e => {
          txs.push({
            id: e.id,
            date: e.date,
            type: 'PAYMENT',
            title: e.title || 'Payment Received',
            debit: 0,
            credit: e.amount,
            reference: e.id,
            paymentMode: e.paymentMode,
          });
        });
    } else {
      // Supplier POs
      purchaseOrders
        .filter(po => po.supplierId === party.id && (po.status === 'RECEIVED' || po.status === 'FULLY_RECEIVED' || po.status === 'PARTIALLY_RECEIVED'))
        .forEach(po => {
          const inwardVal = po.totalReceivedAmount !== undefined ? po.totalReceivedAmount : po.grandTotal;
          txs.push({
            id: po.id,
            date: po.orderDate,
            type: 'PO_INWARD',
            title: `PO Inward #${po.poNumber}`,
            debit: 0,
            credit: inwardVal, // business owes supplier
            reference: po.poNumber,
          });

          if (po.payments && po.payments.length > 0) {
            po.payments.forEach(p => {
              txs.push({
                id: p.paymentId,
                date: p.paymentDate,
                type: 'PO_PAYMENT',
                title: `PO Payment (${po.poNumber})`,
                debit: p.amount, // business paid supplier
                credit: 0,
                reference: p.referenceNumber || po.poNumber,
                paymentMode: p.paymentMode,
              });
            });
          }
        });

      // Payments in financial ledger
      ledgerEntries
        .filter(e => e.partyId === party.id && e.type === 'PAYMENT_OUT' && !e.title.includes('PO Payment'))
        .forEach(e => {
          txs.push({
            id: e.id,
            date: e.date,
            type: 'PO_PAYMENT',
            title: e.title || 'Supplier Payment',
            debit: e.amount,
            credit: 0,
            reference: e.id,
            paymentMode: e.paymentMode,
          });
        });
    }

    if (cutoff) {
      txs = txs.filter(t => new Date(t.date) >= cutoff!);
    }

    // Sort chronologically ascending to calculate running balance
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const withRunning = txs.map(t => {
      if (isCust) {
        running += (t.debit - t.credit);
      } else {
        running += (t.credit - t.debit);
      }
      return { ...t, runningBalance: running };
    });

    return withRunning.reverse(); // newest first for display
  };

  const handleShareStatementWhatsApp = (party: Party) => {
    if (!party.phone) {
      Alert.alert('No Phone', 'Please add a phone number for this party to share statements via WhatsApp.');
      return;
    }

    const txs = getPartyTransactions(party);
    const isCust = party.type === 'CUSTOMER';
    const totalBilled = txs.reduce((s, t) => s + (isCust ? t.debit : t.credit), 0);
    const totalPaid = txs.reduce((s, t) => s + (isCust ? t.credit : t.debit), 0);
    const balance = Math.abs(party.currentBalance);

    let msg = `*ACCOUNT STATEMENT - ${businessProfile.name.toUpperCase()}*\n`;
    msg += `Party: *${party.name}* (${isCust ? 'Customer' : 'Supplier'})\n`;
    msg += `Date: ${new Date().toLocaleDateString()}\n\n`;
    msg += `Total ${isCust ? 'Billed' : 'Procured'}: ₹ ${totalBilled.toFixed(2)}\n`;
    msg += `Total Paid / Cleared: ₹ ${totalPaid.toFixed(2)}\n`;
    msg += `*Outstanding Balance: ₹ ${balance.toFixed(2)} ${isCust ? '(Due from Customer)' : '(Payable to Supplier)'}*\n\n`;

    msg += `*Recent Transactions:*\n`;
    txs.slice(0, 5).forEach(t => {
      msg += `• ${new Date(t.date).toLocaleDateString()} - ${t.title}: ₹ ${(isCust ? t.debit || t.credit : t.credit || t.debit).toFixed(2)}\n`;
    });

    msg += `\nThank you for doing business with us!`;
    openWhatsAppChat(party.phone, msg);
  };

  return (
    <View style={styles.container}>
      {/* Search & Top Action Bar */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={`🔍 Search ${activeTab.toLowerCase()}s by name or phone...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ Add {activeTab === 'CUSTOMER' ? 'Customer' : 'Supplier'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'CUSTOMER' && styles.tabActive]}
          onPress={() => setActiveTab('CUSTOMER')}
        >
          <Text style={[styles.tabText, activeTab === 'CUSTOMER' && styles.tabTextActive]}>
            👥 Customers ({parties.filter(p => p.type === 'CUSTOMER').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'SUPPLIER' && styles.tabActive]}
          onPress={() => setActiveTab('SUPPLIER')}
        >
          <Text style={[styles.tabText, activeTab === 'SUPPLIER' && styles.tabTextActive]}>
            🏭 Suppliers ({parties.filter(p => p.type === 'SUPPLIER').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Directory List */}
      <FlatList
        data={filteredParties}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{activeTab === 'CUSTOMER' ? '👥' : '🏭'}</Text>
            <Text style={styles.emptyTitle}>No {activeTab === 'CUSTOMER' ? 'Customers' : 'Suppliers'} Found</Text>
            <Text style={styles.emptySub}>
              Register contacts to link invoices, track Khata dues, and view complete transaction statements.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isReceivable = item.currentBalance > 0;
          const isPayable = item.currentBalance < 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.partyName}>{item.name}</Text>
                  <Text style={styles.partyContact}>
                    {item.phone || 'No phone'} {item.email ? `• ${item.email}` : ''}
                  </Text>
                  {item.gstin ? <Text style={styles.gstinText}>GSTIN: {item.gstin}</Text> : null}
                  <Text style={styles.addressText} numberOfLines={1}>
                    📍 {item.address || 'No address added'}
                  </Text>
                </View>

                <View style={styles.balanceBox}>
                  <Text style={styles.balanceLabel}>
                    {isReceivable ? 'Receivable' : isPayable ? 'Payable' : 'Settled'}
                  </Text>
                  <Text 
                    style={[
                      styles.balanceValue,
                      isReceivable ? styles.balDanger : isPayable ? styles.balWarning : styles.balNeutral
                    ]}
                  >
                    ₹ {Math.abs(item.currentBalance).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.cardFooter}>
                <TouchableOpacity 
                  style={styles.statementBtn}
                  onPress={() => setStatementParty(item)}
                >
                  <Text style={styles.statementBtnText}>📜 Statement</Text>
                </TouchableOpacity>

                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.actionCircle}
                    onPress={() => handleCall(item.phone)}
                  >
                    <Text style={{ fontSize: 13 }}>📞</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionCircle, { backgroundColor: '#dcfce7' }]}
                    onPress={() => handleWhatsApp(item.phone, item.name)}
                  >
                    <Text style={{ fontSize: 13 }}>💬</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionCircle}
                    onPress={() => openEditModal(item)}
                  >
                    <Text style={{ fontSize: 13 }}>✏️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionCircle, { backgroundColor: '#fef2f2' }]}
                    onPress={() => handleDeleteParty(item)}
                  >
                    <Text style={{ fontSize: 13 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Add Party Modal */}
      {isAddModalOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsAddModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxHeight: '88%' }]}>
              <Text style={styles.modalTitle}>Add New {activeTab === 'CUSTOMER' ? 'Customer' : 'Supplier'}</Text>
              <ScrollView style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. Ramesh Kumar" value={formName} onChangeText={setFormName} />

                <Text style={styles.fieldLabel}>Mobile Phone (WhatsApp)</Text>
                <TextInput style={styles.modalInput} placeholder="+91 98765 43210" value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" />

                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput style={styles.modalInput} placeholder="name@example.com" value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" />

                <Text style={styles.fieldLabel}>GSTIN / Tax ID</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. 29ABCDE1234F1Z5" value={formGstin} onChangeText={setFormGstin} autoCapitalize="characters" />

                <Text style={styles.fieldLabel}>Billing Address</Text>
                <TextInput style={styles.modalInput} placeholder="Street, City, Pincode" value={formAddress} onChangeText={setFormAddress} multiline numberOfLines={2} />
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNewParty}>
                  <Text style={styles.saveBtnText}>Save Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Party Modal */}
      {editingParty && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditingParty(null)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxHeight: '88%' }]}>
              <Text style={styles.modalTitle}>Edit {editingParty.type === 'CUSTOMER' ? 'Customer' : 'Supplier'}</Text>
              <ScrollView style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. Ramesh Kumar" value={formName} onChangeText={setFormName} />

                <Text style={styles.fieldLabel}>Mobile Phone (WhatsApp)</Text>
                <TextInput style={styles.modalInput} placeholder="+91 98765 43210" value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" />

                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput style={styles.modalInput} placeholder="name@example.com" value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" />

                <Text style={styles.fieldLabel}>GSTIN / Tax ID</Text>
                <TextInput style={styles.modalInput} placeholder="e.g. 29ABCDE1234F1Z5" value={formGstin} onChangeText={setFormGstin} autoCapitalize="characters" />

                <Text style={styles.fieldLabel}>Billing Address</Text>
                <TextInput style={styles.modalInput} placeholder="Street, City, Pincode" value={formAddress} onChangeText={setFormAddress} multiline numberOfLines={2} />
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingParty(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEditParty}>
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Khata Statement Modal */}
      {statementParty && (() => {
        const txs = getPartyTransactions(statementParty);
        const isCust = statementParty.type === 'CUSTOMER';
        const totalBilled = txs.reduce((s, t) => s + (isCust ? t.debit : t.credit), 0);
        const totalPaid = txs.reduce((s, t) => s + (isCust ? t.credit : t.debit), 0);
        const netDues = Math.abs(statementParty.currentBalance);

        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setStatementParty(null)}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, { maxHeight: '92%' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.modalTitle}>📜 Account Statement</Text>
                  <TouchableOpacity onPress={() => setStatementParty(null)}>
                    <Text style={{ fontSize: 18, color: colors.neutral[600], padding: 4 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSub}>{statementParty.name} • {statementParty.phone || 'No phone'}</Text>

                {/* Date Filter Chips */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                  {[
                    { id: 'THIS_MONTH', label: 'This Month' },
                    { id: 'LAST_30', label: 'Last 30 Days' },
                    { id: 'ALL', label: 'All Time' },
                  ].map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.rangeChip, statementRange === f.id && styles.rangeChipActive]}
                      onPress={() => setStatementRange(f.id as any)}
                    >
                      <Text style={[styles.rangeChipText, statementRange === f.id && styles.rangeChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Statement Financial Metrics */}
                <View style={styles.statementSummaryBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>{isCust ? 'Total Billed' : 'Total Orders'}</Text>
                    <Text style={styles.statVal}>₹ {totalBilled.toFixed(2)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>Total Paid</Text>
                    <Text style={[styles.statVal, { color: colors.success[700] }]}>₹ {totalPaid.toFixed(2)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statLabel}>Net Outstanding</Text>
                    <Text style={[styles.statVal, { color: colors.danger[700] }]}>₹ {netDues.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Chronological Transactions Stream */}
                <ScrollView style={{ marginTop: 8, maxHeight: 280 }}>
                  {txs.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: colors.neutral[500], paddingVertical: 20 }}>
                      No transactions recorded in this period.
                    </Text>
                  ) : (
                    txs.map(t => (
                      <View key={t.id} style={styles.txRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.txTitle}>{t.title}</Text>
                          <Text style={styles.txDate}>
                            {new Date(t.date).toLocaleDateString()} {t.paymentMode ? `• ${t.paymentMode}` : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[
                            styles.txAmount,
                            (isCust ? t.debit > 0 : t.credit > 0) ? styles.txDebit : styles.txCredit
                          ]}>
                            {isCust ? (t.debit > 0 ? `+₹${t.debit.toFixed(2)}` : `-₹${t.credit.toFixed(2)}`) : (t.credit > 0 ? `+₹${t.credit.toFixed(2)}` : `-₹${t.debit.toFixed(2)}`)}
                          </Text>
                          <Text style={styles.txRunning}>Bal: ₹{t.runningBalance.toFixed(2)}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                {/* WhatsApp Share Button & Close */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: '#16a34a' }]}
                    onPress={() => handleShareStatementWhatsApp(statementParty)}
                  >
                    <Text style={styles.saveBtnText}>💬 Share on WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}
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
  addBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tabTextActive: {
    color: colors.primary[600],
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
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
  partyName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  partyContact: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
  },
  gstinText: {
    fontSize: 10,
    color: colors.primary[700],
    fontWeight: '700',
    marginTop: 2,
  },
  addressText: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 4,
  },
  balanceBox: {
    alignItems: 'flex-end',
    backgroundColor: colors.neutral[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  balDanger: { color: colors.danger[600] },
  balWarning: { color: colors.warning[600] },
  balNeutral: { color: colors.neutral[500] },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  statementBtn: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statementBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: 18,
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
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    marginBottom: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  saveBtn: {
    flex: 2,
    backgroundColor: colors.primary[500],
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  rangeChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  rangeChipActive: {
    backgroundColor: colors.primary[600],
  },
  rangeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  rangeChipTextActive: {
    color: '#fff',
  },
  statementSummaryBox: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10,
    color: colors.neutral[500],
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  txTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  txDate: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  txAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  txDebit: { color: colors.danger[700] },
  txCredit: { color: colors.success[700] },
  txRunning: {
    fontSize: 10,
    color: colors.neutral[400],
    marginTop: 2,
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
});
