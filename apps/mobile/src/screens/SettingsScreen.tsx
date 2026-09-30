import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Business, User, StoreLocation } from '../types';

interface SettingsScreenProps {
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const [activeSubTab, setActiveSubTab] = useState<'PROFILE' | 'STAFF' | 'BRANCHES'>('PROFILE');
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.getActiveUser());
  const [users, setUsers] = useState<User[]>(() => store.getUsers());
  const [locations, setLocations] = useState<StoreLocation[]>(() => store.getLocations());
  const [activeLoc, setActiveLoc] = useState<StoreLocation>(() => store.getActiveLocation());

  // Profile Form States
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone || '');
  const [gstin, setGstin] = useState(business.gstin || '');
  const [email, setEmail] = useState(business.email || '');
  const [address, setAddress] = useState(business.address || '');

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'MANAGER' | 'CASHIER'>('CASHIER');

  // Add Location Modal State
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');

  const isOwner = currentUser?.role === 'TENANT_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    store.fetchUsers();
    store.fetchLocations();

    const unsubscribe = store.subscribe(() => {
      setBusiness(store.getBusinessProfile());
      setCurrentUser(store.getActiveUser());
      setUsers(store.getUsers());
      setLocations(store.getLocations());
      setActiveLoc(store.getActiveLocation());
    });
    return () => { unsubscribe(); };
  }, []);

  const handleSaveProfile = () => {
    store.updateBusinessProfile({
      name: name.trim(),
      phone: phone.trim() || undefined,
      gstin: gstin.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    });
    Alert.alert('Settings Saved', 'Business profile and tax info updated successfully.');
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      Alert.alert('Validation Error', 'Name and work email are required.');
      return;
    }
    await store.createUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword.trim() || 'QuickBill@123',
      role: newUserRole,
    });
    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    Alert.alert('Staff Created', `User account for ${newUserName} (${newUserRole}) added successfully.`);
  };

  const handleDeleteUser = (u: User) => {
    Alert.alert(
      'Remove Staff User',
      `Are you sure you want to revoke access for ${u.name} (${u.email})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            store.deleteUser(u.id);
            Alert.alert('User Removed', 'Staff access has been revoked.');
          }
        }
      ]
    );
  };

  const handleCreateLocation = async () => {
    if (!newLocName.trim()) {
      Alert.alert('Validation Error', 'Branch name is required.');
      return;
    }
    const code = newLocCode.trim() || `BR-${locations.length + 1}`;
    await store.createLocation({
      name: newLocName.trim(),
      code,
      address: newLocAddress.trim() || undefined,
      isActive: true,
      isDefault: false,
    });
    setIsAddLocationModalOpen(false);
    setNewLocName('');
    setNewLocCode('');
    setNewLocAddress('');
    Alert.alert('Branch Added', `Store branch "${newLocName}" added.`);
  };

  const handleSelectActiveLocation = (loc: StoreLocation) => {
    store.setActiveLocation(loc);
    Alert.alert('Store Location Switched', `Active billing counter switched to "${loc.name}".`);
  };

  if (!isOwner) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>🔒</Text>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.neutral[900] }}>Store Owner Access Required</Text>
        <Text style={{ fontSize: 13, color: colors.neutral[600], textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
          Staff Management, Store Profile, and Multi-Branch configuration require Store Administrator permissions.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current User Card */}
      <View style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>👑</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName}>{currentUser?.name || 'Store Owner'}</Text>
          <Text style={styles.userRole}>Role: {currentUser?.role} • {currentUser?.email || 'N/A'}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>✓ Platform License Active</Text>
          </View>
        </View>
      </View>

      {/* Settings Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeSubTab === 'PROFILE' && styles.tabBtnActive]} 
          onPress={() => setActiveSubTab('PROFILE')}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'PROFILE' && styles.tabBtnTextActive]}>🏪 Profile & Tax</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeSubTab === 'STAFF' && styles.tabBtnActive]} 
          onPress={() => setActiveSubTab('STAFF')}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'STAFF' && styles.tabBtnTextActive]}>👥 Staff ({users.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeSubTab === 'BRANCHES' && styles.tabBtnActive]} 
          onPress={() => setActiveSubTab('BRANCHES')}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'BRANCHES' && styles.tabBtnTextActive]}>🏢 Branches</Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Profile & Tax Settings */}
      {activeSubTab === 'PROFILE' && (
        <>
          <Text style={styles.sectionHeading}>🏪 Store Profile & Invoicing Info</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Business / Store Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.fieldLabel}>GSTIN / Tax ID</Text>
            <TextInput style={styles.input} value={gstin} onChangeText={setGstin} autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>Store Contact Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Store Contact Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

            <Text style={styles.fieldLabel}>Physical Store Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} multiline numberOfLines={2} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Save Profile Settings</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeading}>🖨️ Receipt & Hardware Defaults</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Default Thermal POS Paper Size</Text>
              <Text style={styles.settingVal}>80mm (Standard)</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Tax Standard</Text>
              <Text style={[styles.settingVal, { color: colors.primary[700] }]}>Tax-Inclusive MRP (GST)</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto WhatsApp Share Prompt</Text>
              <Text style={[styles.settingVal, { color: colors.success[700] }]}>Active</Text>
            </View>
          </View>
        </>
      )}

      {/* Tab 2: Staff & Team Management */}
      {activeSubTab === 'STAFF' && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionHeading}>👥 Staff Team ({users.length})</Text>
            <TouchableOpacity style={styles.addMiniBtn} onPress={() => setIsAddUserModalOpen(true)}>
              <Text style={styles.addMiniBtnText}>+ Add Staff</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {users.map((u) => {
              const isMe = u.id === currentUser?.id || u.email === currentUser?.email;
              return (
                <View key={u.id} style={styles.userListRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userListName}>{u.name} {isMe && '(You)'}</Text>
                    <Text style={styles.userListMeta}>{u.email} • <Text style={{ fontWeight: '800', color: colors.primary[600] }}>{u.role}</Text></Text>
                  </View>
                  {!isMe && (
                    <TouchableOpacity onPress={() => handleDeleteUser(u)}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Tab 3: Multi-Location Branches */}
      {activeSubTab === 'BRANCHES' && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionHeading}>🏢 Store Branches ({locations.length})</Text>
            <TouchableOpacity style={styles.addMiniBtn} onPress={() => setIsAddLocationModalOpen(true)}>
              <Text style={styles.addMiniBtnText}>+ Add Branch</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {locations.map(loc => {
              const isActive = activeLoc.id === loc.id || activeLoc.name === loc.name;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[styles.branchRow, isActive && styles.branchRowActive]}
                  onPress={() => handleSelectActiveLocation(loc)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.branchName, isActive && styles.branchNameActive]}>
                      {isActive ? '✓ ' : '○ '} {loc.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.neutral[500], marginTop: 2 }}>
                      Code: {loc.code} {loc.address ? `• ${loc.address}` : ''}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE COUNTER</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsAddUserModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Add Staff Member</Text>
                <TouchableOpacity onPress={() => setIsAddUserModalOpen(false)}>
                  <Text style={{ fontSize: 18, color: colors.neutral[600], padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. John Doe" value={newUserName} onChangeText={setNewUserName} />

              <Text style={styles.fieldLabel}>Work Email *</Text>
              <TextInput style={styles.input} placeholder="e.g. cashier2@quickbill.local" value={newUserEmail} onChangeText={setNewUserEmail} autoCapitalize="none" keyboardType="email-address" />

              <Text style={styles.fieldLabel}>Initial Password</Text>
              <TextInput style={styles.input} placeholder="Default: QuickBill@123" value={newUserPassword} onChangeText={setNewUserPassword} secureTextEntry />

              <Text style={styles.fieldLabel}>Assigned Role</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 14 }}>
                <TouchableOpacity 
                  style={[styles.roleSelectChip, newUserRole === 'CASHIER' && styles.roleSelectChipActive]}
                  onPress={() => setNewUserRole('CASHIER')}
                >
                  <Text style={[styles.roleSelectChipText, newUserRole === 'CASHIER' && styles.roleSelectChipTextActive]}>
                    ⚡ Cashier (Billing & Receipts)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.roleSelectChip, newUserRole === 'MANAGER' && styles.roleSelectChipActive]}
                  onPress={() => setNewUserRole('MANAGER')}
                >
                  <Text style={[styles.roleSelectChipText, newUserRole === 'MANAGER' && styles.roleSelectChipTextActive]}>
                    👔 Manager (Full Ops)
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateUser}>
                <Text style={styles.saveBtnText}>Create Staff Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Add Location Modal */}
      {isAddLocationModalOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsAddLocationModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Add Store Branch</Text>
                <TouchableOpacity onPress={() => setIsAddLocationModalOpen(false)}>
                  <Text style={{ fontSize: 18, color: colors.neutral[600], padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Branch Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Downtown Pop-up Counter" value={newLocName} onChangeText={setNewLocName} />

              <Text style={styles.fieldLabel}>Branch Code</Text>
              <TextInput style={styles.input} placeholder="e.g. BR-03" value={newLocCode} onChangeText={setNewLocCode} />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput style={styles.input} placeholder="e.g. Unit 4, Market Complex" value={newLocAddress} onChangeText={setNewLocAddress} />

              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateLocation}>
                <Text style={styles.saveBtnText}>Save Store Branch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Logout / Switch User */}
      {onLogout && (
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>🚪 Switch Store User / Logout</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 40 },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surface.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 24 },
  userName: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  userRole: { fontSize: 12, color: colors.neutral[600], marginTop: 2 },
  rolePill: {
    backgroundColor: colors.success[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  rolePillText: { fontSize: 10, fontWeight: '700', color: colors.success[700] },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tabBtnTextActive: {
    color: colors.primary[700],
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 8,
    marginTop: 4,
  },
  addMiniBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addMiniBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 16,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  branchRowActive: {
    backgroundColor: colors.primary[50],
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  branchName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  branchNameActive: {
    color: colors.primary[700],
    fontWeight: '800',
  },
  activeBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  userListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  userListName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  userListMeta: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.neutral[900],
  },
  saveBtn: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  settingLabel: { fontSize: 12, color: colors.neutral[700] },
  settingVal: { fontSize: 12, fontWeight: '700', color: colors.neutral[900] },
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
  roleSelectChip: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  roleSelectChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  roleSelectChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[700],
    textAlign: 'center',
  },
  roleSelectChipTextActive: {
    color: colors.primary[700],
  },
  logoutBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.danger[500],
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutBtnText: {
    color: colors.danger[500],
    fontWeight: '800',
    fontSize: 13,
  },
});
