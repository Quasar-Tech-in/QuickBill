import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';

interface LoginScreenProps {
  onLoginSuccess: (token?: string, businessId?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Server URL Configuration State
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(store.getApiBaseUrl());
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleTestConnection = async (urlToTest?: string) => {
    const target = urlToTest || serverUrl;
    setIsTestingConn(true);
    setConnStatus(null);
    try {
      const res = await store.testConnection(target);
      setIsTestingConn(false);
      setConnStatus(res);
      if (res.success) {
        store.setApiBaseUrl(target);
        setServerUrl(store.getApiBaseUrl());
      }
    } catch (e: any) {
      setIsTestingConn(false);
      setConnStatus({ success: false, message: e?.message || 'Connection failed' });
    }
  };

  const handleApplyPreset = (presetUrl: string) => {
    setServerUrl(presetUrl);
    store.setApiBaseUrl(presetUrl);
    handleTestConnection(presetUrl);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter both your work email and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await store.login(email, password);
      setLoading(false);
      if (result.success && result.user) {
        onLoginSuccess(result.user.token, result.user.businessId);
      } else {
        Alert.alert('Authentication Failed', result.error || 'Invalid work email or password.');
      }
    } catch (e: any) {
      setLoading(false);
      const isNetworkErr = e?.message?.includes('Network') || e?.code === 'ERR_NETWORK' || !e?.response;
      if (isNetworkErr) {
        setShowServerConfig(true);
        Alert.alert(
          '🌐 Network Connection Error',
          `Could not reach the backend server at:\n${store.getApiBaseUrl()}\n\nTip: Ensure your phone and computer are on the same Wi-Fi network and select your computer's Wi-Fi IP in the Server Settings below.`
        );
      } else {
        Alert.alert('Login Error', e.message || 'Could not connect to store server.');
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>QB</Text>
            </View>
            <Text style={styles.brandTitle}>QuickBill Mobile</Text>
            <Text style={styles.subtitle}>Sign in to your store workspace</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Work Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="e.g. cashier@quickbill.local"
              placeholderTextColor={colors.neutral[400]}
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter your store password"
              placeholderTextColor={colors.neutral[400]}
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleLogin} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In to Store</Text>
            )}
          </TouchableOpacity>

          {/* Server Connection Toggle */}
          <TouchableOpacity 
            style={styles.serverToggleBtn}
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <Text style={styles.serverToggleText}>
              ⚙️ Server URL: <Text style={{ fontWeight: '700', color: colors.primary[600] }}>{store.getApiBaseUrl()}</Text>
            </Text>
          </TouchableOpacity>

          {/* Server Configuration Panel */}
          {showServerConfig && (
            <View style={styles.serverConfigCard}>
              <Text style={styles.serverConfigTitle}>Backend Server Connection</Text>
              <Text style={styles.serverConfigDesc}>
                Enter the IP address of your host machine running FastAPI backend (port 8000).
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, fontSize: 13 }]}
                  value={serverUrl}
                  onChangeText={(val) => {
                    setServerUrl(val);
                    store.setApiBaseUrl(val);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="http://192.168.x.x:8000/api/v1"
                />
                <TouchableOpacity 
                  style={styles.testBtn}
                  onPress={() => handleTestConnection()}
                  disabled={isTestingConn}
                >
                  {isTestingConn ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.testBtnText}>Test</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Status Banner */}
              {connStatus && (
                <View style={[styles.statusBox, connStatus.success ? styles.statusSuccess : styles.statusError]}>
                  <Text style={connStatus.success ? styles.statusTextSuccess : styles.statusTextError}>
                    {connStatus.success ? '✅ ' : '❌ '}{connStatus.message}
                  </Text>
                </View>
              )}

              {/* IP Presets */}
              <Text style={styles.presetLabel}>Quick Presets:</Text>
              <View style={styles.presetRow}>
                <TouchableOpacity 
                  style={styles.presetChip} 
                  onPress={() => handleApplyPreset('http://192.168.6.4:8000/api/v1')}
                >
                  <Text style={styles.presetChipText}>📡 Wi-Fi (192.168.6.4)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.presetChip} 
                  onPress={() => handleApplyPreset('http://192.168.6.2:8000/api/v1')}
                >
                  <Text style={styles.presetChipText}>🔌 LAN (192.168.6.2)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.presetChip} 
                  onPress={() => handleApplyPreset('http://10.0.2.2:8000/api/v1')}
                >
                  <Text style={styles.presetChipText}>🤖 Android Emulator</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { 
    backgroundColor: colors.surface.card, 
    padding: 24, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: colors.surface.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  header: { marginBottom: 24, alignItems: 'center' },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoBadgeText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandTitle: { fontSize: 24, fontWeight: '800', color: colors.neutral[900] },
  subtitle: { fontSize: 13, color: colors.neutral[500], marginTop: 4, fontWeight: '500' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.neutral[700], marginBottom: 6 },
  input: { 
    borderWidth: 1, 
    borderColor: colors.neutral[200], 
    borderRadius: 10, 
    padding: 12, 
    fontSize: 15, 
    color: colors.neutral[900],
    backgroundColor: colors.neutral[50] 
  },
  button: { 
    backgroundColor: colors.primary[500], 
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 12,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  serverToggleBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  serverToggleText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  serverConfigCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  serverConfigTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  serverConfigDesc: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
    lineHeight: 15,
  },
  testBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
  },
  statusSuccess: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  statusError: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  statusTextSuccess: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  statusTextError: {
    fontSize: 11,
    color: '#991b1b',
    fontWeight: '600',
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[600],
    marginTop: 10,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: colors.neutral[200],
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.neutral[800],
    fontWeight: '600',
  },
});
