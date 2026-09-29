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
import { Party } from '../types';
import { openWhatsAppChat } from '../utils/shareInvoice';

export const PartiesScreen: React.FC = () => {
  const [parties, setParties] = useState<Party[]>(() => store.getParties());
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Party Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setParties(store.getParties());
    });
    return () => { unsubscribe(); };
  }, []);

  const filteredParties = parties
    .filter(p => p.type === activeTab)
    .filter(p => {
      const q = searchQuery.toLowerCase().trim();
      return !q || p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q));
    });

  const handleSaveParty = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Party name is required.');
      return;
    }

    store.saveParty({
      id: `pty-${Date.now()}`,
      name: name.trim(),
      type: activeTab,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      gstin: gstin.trim() || undefined,
      address: address.trim() || undefined,
      currentBalance: 0,
    });

    setIsAddModalOpen(false);
    setName('');
    setPhone('');
    setEmail('');
    setGstin('');
    setAddress('');
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Phone', 'No phone number is registered for this contact.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = (phoneNumber?: string, partyName?: string) => {
    if (!phoneNumber) {
      Alert.alert('No Phone', 'No phone number is registered for this contact.');
      return;
    }
    openWhatsAppChat(phoneNumber, `Hello ${partyName || ''}, greeting from QuickBill store!`);
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
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalOpen(true)}>
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
        renderItem={({ item }) => {
          const isReceivable = item.currentBalance > 0;
          const isPayable = item.currentBalance < 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partyName}>{item.name}</Text>
                  <Text style={styles.partyContact}>
                    {item.phone || 'No phone'} {item.email ? `• ${item.email}` : ''}
                  </Text>
                  {item.gstin ? <Text style={styles.gstinText}>GSTIN: {item.gstin}</Text> : null}
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

              <View style={styles.cardFooter}>
                <Text style={styles.addressText} numberOfLines={1}>
                  📍 {item.address || 'No address added'}
                </Text>
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
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Add Party Modal */}
      <Modal visible={isAddModalOpen} transparent animationType="slide" onRequestClose={() => setIsAddModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Add New {activeTab === 'CUSTOMER' ? 'Customer' : 'Supplier'}</Text>
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput style={styles.modalInput} placeholder="e.g. Ramesh Kumar" value={name} onChangeText={setName} />

              <Text style={styles.fieldLabel}>Mobile Phone (WhatsApp)</Text>
              <TextInput style={styles.modalInput} placeholder="+91 98765 43210" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput style={styles.modalInput} placeholder="name@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />

              <Text style={styles.fieldLabel}>GSTIN / Tax ID</Text>
              <TextInput style={styles.modalInput} placeholder="e.g. 29ABCDE1234F1Z5" value={gstin} onChangeText={setGstin} autoCapitalize="characters" />

              <Text style={styles.fieldLabel}>Billing Address</Text>
              <TextInput style={styles.modalInput} placeholder="Street, City, Pincode" value={address} onChangeText={setAddress} multiline numberOfLines={2} />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveParty}>
                <Text style={styles.saveBtnText}>Save Contact</Text>
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
    fontWeight: '600',
    color: colors.neutral[600],
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: '800',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  partyContact: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
  },
  gstinText: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
    fontWeight: '500',
  },
  balanceBox: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 10,
    color: colors.neutral[600],
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  balDanger: { color: colors.danger[500] },
  balWarning: { color: colors.warning[500] },
  balNeutral: { color: colors.neutral[400] },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  addressText: {
    fontSize: 11,
    color: colors.neutral[600],
    flex: 1,
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.neutral[700], marginTop: 8, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: colors.surface.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.surface.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.neutral[600] },
  saveBtn: { flex: 2, backgroundColor: colors.primary[500], paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
