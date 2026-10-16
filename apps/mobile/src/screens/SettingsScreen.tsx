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
  Alert,
  Switch
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Business, User, StoreLocation, UserRole } from '../types';

interface SettingsScreenProps {
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const [activeSubTab, setActiveSubTab] = useState<'PROFILE' | 'STAFF' | 'BRANCHES' | 'LICENSE'>('PROFILE');
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.getActiveUser());
  const [users, setUsers] = useState<User[]>(() => store.getUsers());
  const [locations, setLocations] = useState<StoreLocation[]>(() => store.getLocations());
  const [activeLoc, setActiveLoc] = useState<StoreLocation>(() => store.getActiveLocation());
  const [tenant, setTenant] = useState(() => store.getActiveTenant());

  // Profile Form States
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone || '');
  const [gstin, setGstin] = useState(business.gstin || '');
  const [email, setEmail] = useState(business.email || '');
  const [address, setAddress] = useState(business.address || '');
  const [tagline, setTagline] = useState(business.tagline || '');
  const [receiptFooterNote, setReceiptFooterNote] = useState(business.receiptFooterNote || '');
  const [printerPaperSize, setPrinterPaperSize] = useState<'58mm' | '80mm'>(business.printerPaperSize || '80mm');
  const [upiQrEnabled, setUpiQrEnabled] = useState<boolean>(business.upiQrEnabled !== false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('CASHIER');
  const [newUserAssignedLocs, setNewUserAssignedLocs] = useState<string[]>([]);

  // Edit User Modal State
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('CASHIER');
  const [editUserAssignedLocs, setEditUserAssignedLocs] = useState<string[]>([]);
  const [editUserIsActive, setEditUserIsActive] = useState<boolean>(true);

  // Add Location Modal State
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');
  const [newLocGstin, setNewLocGstin] = useState('');

  // Edit Location Modal State
  const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<StoreLocation | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocCode, setEditLocCode] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');
  const [editLocPhone, setEditLocPhone] = useState('');
  const [editLocGstin, setEditLocGstin] = useState('');
  const [editLocIsActive, setEditLocIsActive] = useState<boolean>(true);

  // Health Ping State
  const [isPinging, setIsPinging] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingStatus, setPingStatus] = useState<string>('Online');

  const canManage = currentUser?.role === 'TENANT_ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    store.fetchUsers();
    store.fetchLocations();
    store.fetchBusinessProfile();

    const unsubscribe = store.subscribe(() => {
      const b = store.getBusinessProfile();
      setBusiness(b);
      setName(b.name);
      setPhone(b.phone || '');
      setGstin(b.gstin || '');
      setEmail(b.email || '');
      setAddress(b.address || '');
      setTagline(b.tagline || '');
      setReceiptFooterNote(b.receiptFooterNote || '');
      setPrinterPaperSize(b.printerPaperSize || '80mm');
      setUpiQrEnabled(b.upiQrEnabled !== false);
      setCurrentUser(store.getActiveUser());
      setUsers(store.getUsers());
      setLocations(store.getLocations());
      setActiveLoc(store.getActiveLocation());
      setTenant(store.getActiveTenant());
    });
    return () => { unsubscribe(); };
  }, []);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Store name cannot be empty.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await store.updateBusinessProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        email: email.trim().toLowerCase() || undefined,
        address: address.trim() || undefined,
        tagline: tagline.trim() || undefined,
        receiptFooterNote: receiptFooterNote.trim() || undefined,
        printerPaperSize,
        upiQrEnabled,
      });
      Alert.alert('Settings Saved', 'Business branding, profile, and POS receipt configuration updated.');
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not update store profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Staff Management Handlers ---
  const handleOpenAddUser = () => {
    const activeTenant = store.getActiveTenant();
    const maxUsers = activeTenant?.subscription?.maxUsers ?? 5;
    const currentActiveUsers = users.filter(u => u.isActive !== false).length;
    if (currentActiveUsers >= maxUsers && currentUser?.role !== 'SUPER_ADMIN') {
      Alert.alert(
        'Staff Quota Reached',
        `Your current plan allows maximum ${maxUsers} staff members (${currentActiveUsers}/${maxUsers} in use). Please upgrade your subscription.`
      );
      return;
    }
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('CASHIER');
    setNewUserAssignedLocs([activeLoc.id]);
    setIsAddUserModalOpen(true);
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      Alert.alert('Validation Error', 'Full name and work email are required.');
      return;
    }
    try {
      await store.createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        password: newUserPassword.trim() || 'QuickBill@123',
        role: newUserRole,
        assignedLocationIds: newUserAssignedLocs,
      });
      setIsAddUserModalOpen(false);
      Alert.alert('Staff Created', `User account for ${newUserName} (${newUserRole}) added successfully.`);
    } catch (e: any) {
      Alert.alert('Create Error', e?.message || 'Failed to create staff account.');
    }
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserRole(u.role);
    setEditUserAssignedLocs(u.assignedLocationIds || []);
    setEditUserIsActive(u.isActive !== false);
    setIsEditUserModalOpen(true);
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    if (!editUserName.trim()) {
      Alert.alert('Validation Error', 'Staff name is required.');
      return;
    }
    try {
      await store.updateUser(editingUser.id, {
        name: editUserName.trim(),
        role: editUserRole,
        assignedLocationIds: editUserAssignedLocs,
        isActive: editUserIsActive,
      });
      setIsEditUserModalOpen(false);
      Alert.alert('Staff Updated', `Settings for ${editUserName} updated.`);
    } catch (e: any) {
      Alert.alert('Update Failed', e?.message || 'Could not update staff member.');
    }
  };

  const handleDeleteUser = (u: User) => {
    Alert.alert(
      'Revoke Staff Access',
      `Are you sure you want to delete access for ${u.name} (${u.email})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            await store.deleteUser(u.id);
            Alert.alert('Staff Removed', 'Account has been removed.');
          }
        }
      ]
    );
  };

  // --- Branch Location Handlers ---
  const handleOpenAddLocation = () => {
    const activeTenant = store.getActiveTenant();
    const maxLocs = activeTenant?.subscription?.maxLocations ?? 3;
    if (locations.length >= maxLocs && currentUser?.role !== 'SUPER_ADMIN') {
      Alert.alert(
        'Branch Quota Reached',
        `Your plan allows up to ${maxLocs} branch counters (${locations.length}/${maxLocs} active). Contact support to add more branches.`
      );
      return;
    }
    setNewLocName('');
    setNewLocCode(`BR-0${locations.length + 1}`);
    setNewLocAddress('');
    setNewLocPhone('');
    setNewLocGstin(business.gstin || '');
    setIsAddLocationModalOpen(true);
  };

  const handleCreateLocation = async () => {
    if (!newLocName.trim()) {
      Alert.alert('Validation Error', 'Branch name is required.');
      return;
    }
    const code = newLocCode.trim() || `BR-${locations.length + 1}`;
    try {
      await store.createLocation({
        name: newLocName.trim(),
        code,
        address: newLocAddress.trim() || undefined,
        phone: newLocPhone.trim() || undefined,
        gstin: newLocGstin.trim().toUpperCase() || undefined,
        isActive: true,
        isDefault: locations.length === 0,
      });
      setIsAddLocationModalOpen(false);
      Alert.alert('Branch Added', `Store branch "${newLocName}" added successfully.`);
    } catch (e: any) {
      Alert.alert('Branch Error', e?.message || 'Could not create store branch.');
    }
  };

  const handleOpenEditLocation = (loc: StoreLocation) => {
    setEditingLoc(loc);
    setEditLocName(loc.name);
    setEditLocCode(loc.code);
    setEditLocAddress(loc.address || '');
    setEditLocPhone(loc.phone || '');
    setEditLocGstin(loc.gstin || '');
    setEditLocIsActive(loc.isActive !== false);
    setIsEditLocationModalOpen(true);
  };

  const handleSaveEditLocation = async () => {
    if (!editingLoc) return;
    if (!editLocName.trim()) {
      Alert.alert('Validation Error', 'Branch name is required.');
      return;
    }
    try {
      await store.updateLocation(editingLoc.id, {
        name: editLocName.trim(),
        code: editLocCode.trim() || editingLoc.code,
        address: editLocAddress.trim() || undefined,
        phone: editLocPhone.trim() || undefined,
        gstin: editLocGstin.trim().toUpperCase() || undefined,
        isActive: editLocIsActive,
      });
      setIsEditLocationModalOpen(false);
      Alert.alert('Branch Updated', `Branch "${editLocName}" details updated.`);
    } catch (e: any) {
      Alert.alert('Update Failed', e?.message || 'Could not update branch.');
    }
  };

  const handleDeleteLocation = (loc: StoreLocation) => {
    if (locations.length <= 1) {
      Alert.alert('Cannot Delete', 'At least one active store branch must remain.');
      return;
    }
    if (activeLoc.id === loc.id) {
      Alert.alert('Cannot Delete Active Counter', 'Please switch to another active counter before deleting this branch.');
      return;
    }

    Alert.alert(
      'Remove Store Branch',
      `Are you sure you want to delete branch "${loc.name}" (${loc.code})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await store.deleteLocation(loc.id);
            Alert.alert('Branch Deleted', `Branch "${loc.name}" has been removed.`);
          }
        }
      ]
    );
  };

  const handleSelectActiveLocation = (loc: StoreLocation) => {
    if (!loc.isActive) {
      Alert.alert('Branch Inactive', 'This branch location is currently inactive. Please enable it first.');
      return;
    }
    store.setActiveLocation(loc);
    Alert.alert('Counter Switched', `Active billing counter set to "${loc.name}".`);
  };

  // --- Health Ping Test ---
  const handleTestBackendPing = async () => {
    setIsPinging(true);
    const start = Date.now();
    try {
      await store.fetchBusinessProfile();
      const latency = Date.now() - start;
      setPingLatency(latency);
      setPingStatus('Healthy (Connected)');
      Alert.alert('Connection Healthy', `Connected to QuickBill API. Response latency: ${latency}ms.`);
    } catch (e) {
      setPingLatency(null);
      setPingStatus('Offline / Degraded');
      Alert.alert('Connection Offline', 'Unable to reach backend API. Operating in offline cached mode.');
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current User Card */}
      <View style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TENANT_ADMIN' ? '👑' : currentUser?.role === 'MANAGER' ? '👔' : '⚡'}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName}>{currentUser?.name || 'QuickBill User'}</Text>
          <Text style={styles.userRole}>
            {currentUser?.role} • {currentUser?.email || 'N/A'}
          </Text>
          <View style={styles.counterPill}>
            <Text style={styles.counterPillText}>📍 Active: {activeLoc?.name || 'Main Counter'}</Text>
          </View>
        </View>
      </View>

      {/* Settings Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeSubTab === 'PROFILE' && styles.tabBtnActive]} 
          onPress={() => setActiveSubTab('PROFILE')}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'PROFILE' && styles.tabBtnTextActive]}>🏪 Profile</Text>
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

        <TouchableOpacity 
          style={[styles.tabBtn, activeSubTab === 'LICENSE' && styles.tabBtnActive]} 
          onPress={() => setActiveSubTab('LICENSE')}
        >
          <Text style={[styles.tabBtnText, activeSubTab === 'LICENSE' && styles.tabBtnTextActive]}>🛡️ License</Text>
        </TouchableOpacity>
      </View>

      {/* ================= TAB 1: PROFILE & TAX ================= */}
      {activeSubTab === 'PROFILE' && (
        <>
          <Text style={styles.sectionHeading}>🏪 Store Profile & Invoicing Branding</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Business / Store Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.fieldLabel}>GSTIN / Tax Identification</Text>
            <TextInput style={styles.input} value={gstin} onChangeText={setGstin} autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>Store Contact Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>Store Contact Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

            <Text style={styles.fieldLabel}>Physical Store Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} multiline numberOfLines={2} />

            <Text style={styles.fieldLabel}>Brand Tagline / Slogan</Text>
            <TextInput style={styles.input} value={tagline} onChangeText={setTagline} placeholder="e.g. Quality You Can Trust" />
          </View>

          <Text style={styles.sectionHeading}>🖨️ POS Receipts & Printing Configuration</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Thermal Printer Paper Size</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 6 }}>
              <TouchableOpacity
                style={[styles.paperOption, printerPaperSize === '80mm' && styles.paperOptionActive]}
                onPress={() => setPrinterPaperSize('80mm')}
              >
                <Text style={[styles.paperOptionTitle, printerPaperSize === '80mm' && styles.paperOptionTitleActive]}>
                  80mm Standard
                </Text>
                <Text style={styles.paperOptionSub}>Desktop Thermal POS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperOption, printerPaperSize === '58mm' && styles.paperOptionActive]}
                onPress={() => setPrinterPaperSize('58mm')}
              >
                <Text style={[styles.paperOptionTitle, printerPaperSize === '58mm' && styles.paperOptionTitleActive]}>
                  58mm Pocket
                </Text>
                <Text style={styles.paperOptionSub}>Bluetooth Wireless POS</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingSwitchRow, { marginTop: 12 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.switchTitle}>Dynamic UPI QR on Receipts</Text>
                <Text style={styles.switchDesc}>Prints UPI payment QR code automatically on thermal and A4 bills.</Text>
              </View>
              <Switch
                value={upiQrEnabled}
                onValueChange={setUpiQrEnabled}
                trackColor={{ false: colors.neutral[300], true: colors.primary[600] }}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Receipt Footer Policy / Note</Text>
            <TextInput 
              style={styles.input} 
              value={receiptFooterNote} 
              onChangeText={setReceiptFooterNote} 
              placeholder="e.g. Please keep receipt for warranty & returns within 7 days"
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity 
              style={[styles.saveBtn, isSavingProfile && { opacity: 0.7 }]} 
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>💾 Save Profile & Receipt Settings</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ================= TAB 2: STAFF TEAM ================= */}
      {activeSubTab === 'STAFF' && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionHeading}>👥 Staff Team ({users.length})</Text>
            {canManage && (
              <TouchableOpacity style={styles.addMiniBtn} onPress={handleOpenAddUser}>
                <Text style={styles.addMiniBtnText}>+ Add Staff</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            {users.map((u) => {
              const isMe = u.id === currentUser?.id || u.email === currentUser?.email;
              const roleColor = u.role === 'SUPER_ADMIN' || u.role === 'TENANT_ADMIN' ? colors.primary[700] : u.role === 'MANAGER' ? colors.warning[700] : colors.neutral[700];

              return (
                <View key={u.id} style={styles.userListRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.userListName}>{u.name} {isMe && '(You)'}</Text>
                      {u.isActive === false && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userListMeta}>
                      {u.email} • <Text style={{ fontWeight: '800', color: roleColor }}>{u.role}</Text>
                    </Text>
                  </View>

                  {canManage && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={() => handleOpenEditUser(u)}>
                        <Text style={{ fontSize: 16 }}>✏️</Text>
                      </TouchableOpacity>
                      {!isMe && (
                        <TouchableOpacity onPress={() => handleDeleteUser(u)}>
                          <Text style={{ fontSize: 16 }}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ================= TAB 3: STORE BRANCHES ================= */}
      {activeSubTab === 'BRANCHES' && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionHeading}>🏢 Store Branches ({locations.length})</Text>
            {canManage && (
              <TouchableOpacity style={styles.addMiniBtn} onPress={handleOpenAddLocation}>
                <Text style={styles.addMiniBtnText}>+ Add Branch</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            {locations.map(loc => {
              const isActive = activeLoc.id === loc.id;
              return (
                <View key={loc.id} style={[styles.branchCard, isActive && styles.branchCardActive]}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => handleSelectActiveLocation(loc)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.branchName, isActive && styles.branchNameActive]}>
                        {isActive ? '✓ ' : '○ '} {loc.name}
                      </Text>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE COUNTER</Text>
                        </View>
                      )}
                      {loc.isActive === false && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveBadgeText}>DISABLED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.branchSubText}>
                      Code: {loc.code} {loc.gstin ? `• GSTIN: ${loc.gstin}` : ''}
                    </Text>
                    {loc.address && (
                      <Text style={styles.branchAddressText}>{loc.address}</Text>
                    )}
                  </TouchableOpacity>

                  {canManage && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                      <TouchableOpacity onPress={() => handleOpenEditLocation(loc)}>
                        <Text style={{ fontSize: 16 }}>✏️</Text>
                      </TouchableOpacity>
                      {!isActive && locations.length > 1 && (
                        <TouchableOpacity onPress={() => handleDeleteLocation(loc)}>
                          <Text style={{ fontSize: 16 }}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ================= TAB 4: SUBSCRIPTION LICENSE & SYSTEM ================= */}
      {activeSubTab === 'LICENSE' && (
        <>
          <Text style={styles.sectionHeading}>🛡️ Multi-Tenant Subscription & Health</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Organization / Store</Text>
              <Text style={[styles.rowVal, { fontWeight: '800' }]}>{tenant?.name || 'QuickBill Store'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Subscription Tier</Text>
              <Text style={[styles.rowVal, { fontWeight: '800', color: colors.primary[700] }]}>
                {tenant?.plan || 'ENTERPRISE'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>License Validity</Text>
              <Text style={[styles.rowVal, { fontWeight: '800', color: colors.success[700] }]}>
                Active • {tenant?.subscription?.daysRemaining ?? 'Unlimited'} Days Remaining
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Staff User Limit</Text>
              <Text style={styles.rowVal}>
                {users.length} / {tenant?.subscription?.maxUsers ?? 5} Accounts
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Store Branch Limit</Text>
              <Text style={styles.rowVal}>
                {locations.length} / {tenant?.subscription?.maxLocations ?? 3} Branches
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View>
                <Text style={styles.rowLabel}>API Server Status</Text>
                <Text style={{ fontSize: 10, color: colors.neutral[500] }}>
                  {pingLatency ? `Latency: ${pingLatency}ms` : 'Ready to test'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.pingBtn, isPinging && { opacity: 0.6 }]} 
                onPress={handleTestBackendPing}
                disabled={isPinging}
              >
                {isPinging ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.pingBtnText}>⚡ Ping API</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ================= MODAL: ADD STAFF ================= */}
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
              <TextInput style={styles.input} placeholder="e.g. Rahul Sharma" value={newUserName} onChangeText={setNewUserName} />

              <Text style={styles.fieldLabel}>Work Email *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. rahul@quickbill.local" 
                value={newUserEmail} 
                onChangeText={setNewUserEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
              />

              <Text style={styles.fieldLabel}>Initial Password</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Default: QuickBill@123" 
                value={newUserPassword} 
                onChangeText={setNewUserPassword} 
                secureTextEntry 
              />

              <Text style={styles.fieldLabel}>Assign Role</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                {(['CASHIER', 'MANAGER', 'TENANT_ADMIN'] as UserRole[]).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleSelectChip, newUserRole === role && styles.roleSelectChipActive]}
                    onPress={() => setNewUserRole(role)}
                  >
                    <Text style={[styles.roleSelectChipText, newUserRole === role && styles.roleSelectChipTextActive]}>
                      {role === 'CASHIER' ? '⚡ Cashier' : role === 'MANAGER' ? '👔 Manager' : '👑 Admin'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={handleCreateUser}>
                <Text style={styles.saveBtnText}>Create Staff Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= MODAL: EDIT STAFF ================= */}
      {isEditUserModalOpen && editingUser && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsEditUserModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Edit Staff: {editingUser.email}</Text>
                <TouchableOpacity onPress={() => setIsEditUserModalOpen(false)}>
                  <Text style={{ fontSize: 18, color: colors.neutral[600], padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput style={styles.input} value={editUserName} onChangeText={setEditUserName} />

              <Text style={styles.fieldLabel}>Assigned Role</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                {(['CASHIER', 'MANAGER', 'TENANT_ADMIN'] as UserRole[]).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleSelectChip, editUserRole === role && styles.roleSelectChipActive]}
                    onPress={() => setEditUserRole(role)}
                  >
                    <Text style={[styles.roleSelectChipText, editUserRole === role && styles.roleSelectChipTextActive]}>
                      {role === 'CASHIER' ? '⚡ Cashier' : role === 'MANAGER' ? '👔 Manager' : '👑 Admin'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.settingSwitchRow, { marginVertical: 10 }]}>
                <Text style={styles.switchTitle}>Account Active Status</Text>
                <Switch
                  value={editUserIsActive}
                  onValueChange={setEditUserIsActive}
                  trackColor={{ false: colors.neutral[300], true: colors.primary[600] }}
                />
              </View>

              <TouchableOpacity style={[styles.saveBtn, { marginTop: 10 }]} onPress={handleSaveEditUser}>
                <Text style={styles.saveBtnText}>Update Staff Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= MODAL: ADD BRANCH ================= */}
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

              <Text style={styles.fieldLabel}>Branch Outlet Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Sector 18 Express Outlet" value={newLocName} onChangeText={setNewLocName} />

              <Text style={styles.fieldLabel}>Branch Code</Text>
              <TextInput style={styles.input} placeholder="e.g. BR-02" value={newLocCode} onChangeText={setNewLocCode} />

              <Text style={styles.fieldLabel}>Branch Address</Text>
              <TextInput style={styles.input} placeholder="e.g. Shop 14, Central Market" value={newLocAddress} onChangeText={setNewLocAddress} />

              <Text style={styles.fieldLabel}>Branch Phone</Text>
              <TextInput style={styles.input} placeholder="e.g. +91 98765 43210" value={newLocPhone} onChangeText={setNewLocPhone} keyboardType="phone-pad" />

              <Text style={styles.fieldLabel}>Branch GSTIN (Optional)</Text>
              <TextInput style={styles.input} placeholder="Branch specific GSTIN" autoCapitalize="characters" value={newLocGstin} onChangeText={setNewLocGstin} />

              <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={handleCreateLocation}>
                <Text style={styles.saveBtnText}>Save Store Branch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= MODAL: EDIT BRANCH ================= */}
      {isEditLocationModalOpen && editingLoc && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIsEditLocationModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Edit Branch: {editingLoc.name}</Text>
                <TouchableOpacity onPress={() => setIsEditLocationModalOpen(false)}>
                  <Text style={{ fontSize: 18, color: colors.neutral[600], padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Branch Outlet Name</Text>
              <TextInput style={styles.input} value={editLocName} onChangeText={setEditLocName} />

              <Text style={styles.fieldLabel}>Branch Code</Text>
              <TextInput style={styles.input} value={editLocCode} onChangeText={setEditLocCode} />

              <Text style={styles.fieldLabel}>Branch Address</Text>
              <TextInput style={styles.input} value={editLocAddress} onChangeText={setEditLocAddress} />

              <Text style={styles.fieldLabel}>Branch Phone</Text>
              <TextInput style={styles.input} value={editLocPhone} onChangeText={setEditLocPhone} keyboardType="phone-pad" />

              <Text style={styles.fieldLabel}>Branch GSTIN</Text>
              <TextInput style={styles.input} value={editLocGstin} onChangeText={setEditLocGstin} autoCapitalize="characters" />

              <View style={[styles.settingSwitchRow, { marginVertical: 10 }]}>
                <Text style={styles.switchTitle}>Branch Operational Status</Text>
                <Switch
                  value={editLocIsActive}
                  onValueChange={setEditLocIsActive}
                  trackColor={{ false: colors.neutral[300], true: colors.primary[600] }}
                />
              </View>

              <TouchableOpacity style={[styles.saveBtn, { marginTop: 10 }]} onPress={handleSaveEditLocation}>
                <Text style={styles.saveBtnText}>Update Branch Details</Text>
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
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  userRole: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
  },
  counterPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 4,
  },
  counterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary[800],
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[200],
    borderRadius: 10,
    padding: 3,
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
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.neutral[900],
  },
  paperOption: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
  },
  paperOptionActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  paperOptionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  paperOptionTitleActive: {
    color: colors.primary[800],
  },
  paperOptionSub: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  switchDesc: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  addMiniBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addMiniBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  userListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
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
    color: colors.neutral[600],
    marginTop: 2,
  },
  inactiveBadge: {
    backgroundColor: colors.danger[50],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.danger[700],
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.neutral[50],
    marginBottom: 8,
  },
  branchCardActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  branchName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  branchNameActive: {
    color: colors.primary[900],
    fontWeight: '800',
  },
  branchSubText: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  branchAddressText: {
    fontSize: 10,
    color: colors.neutral[600],
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.neutral[700],
  },
  rowVal: {
    fontSize: 12,
    color: colors.neutral[900],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: 8,
  },
  pingBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pingBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
    color: colors.danger[600],
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  roleSelectChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  roleSelectChipActive: {
    backgroundColor: colors.primary[600],
  },
  roleSelectChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  roleSelectChipTextActive: {
    color: '#fff',
  },
});
