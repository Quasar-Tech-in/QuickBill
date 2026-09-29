import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Business, User } from '../types';

interface SettingsScreenProps {
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [user, setUser] = useState<User>(() => store.getActiveUser());

  // Form states
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone || '');
  const [gstin, setGstin] = useState(business.gstin || '');
  const [email, setEmail] = useState(business.email || '');
  const [address, setAddress] = useState(business.address || '');

  // Branch
  const [selectedBranch, setSelectedBranch] = useState('Main Flagship Counter');

  const handleSaveProfile = () => {
    store.updateBusinessProfile({
      name: name.trim(),
      phone: phone.trim() || undefined,
      gstin: gstin.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    });
    Alert.alert('Settings Saved', 'Business profile updated successfully.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User & Role Badge */}
      <View style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>Role: {user.role} • {user.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>✓ Full Manager & Cashier Permissions</Text>
          </View>
        </View>
      </View>

      {/* Active Branch / Store Location Selector */}
      <Text style={styles.sectionHeading}>🏢 Active Store Branch</Text>
      <View style={styles.card}>
        {['Main Flagship Counter', 'Warehouse Depot 02', 'Downtown Pop-up'].map(branch => (
          <TouchableOpacity
            key={branch}
            style={[styles.branchRow, selectedBranch === branch && styles.branchRowActive]}
            onPress={() => setSelectedBranch(branch)}
          >
            <Text style={[styles.branchName, selectedBranch === branch && styles.branchNameActive]}>
              {selectedBranch === branch ? '✓ ' : '○ '} {branch}
            </Text>
            {selectedBranch === branch && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Business Details Form */}
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

      {/* Hardware & Printer Settings */}
      <Text style={styles.sectionHeading}>🖨️ Receipt & Printer Defaults</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Default Thermal POS Paper Size</Text>
          <Text style={styles.settingVal}>80mm (3-inch standard)</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto-trigger WhatsApp Share after checkout</Text>
          <Text style={[styles.settingVal, { color: colors.success[700] }]}>Enabled</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Camera Haptic Feedback</Text>
          <Text style={[styles.settingVal, { color: colors.success[700] }]}>Active</Text>
        </View>
      </View>

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
    marginBottom: 20,
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
    borderRadius: 6,
    paddingHorizontal: 8,
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
