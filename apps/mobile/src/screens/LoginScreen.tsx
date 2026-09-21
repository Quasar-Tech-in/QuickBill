import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors } from '../theme/colors';

interface LoginScreenProps {
  onLoginSuccess: (token: string, businessId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@quickbill.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Direct mock / local backend test
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess('mock_jwt_token_admin', '65f2a1b9a000000000000001');
      }, 600);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Login Failed', e.message || 'Please check your credentials.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>QuickBill</Text>
          <Text style={styles.subtitle}>POS Billing & Inventory Management</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In to Store</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.surface.card, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.surface.border },
  header: { marginBottom: 24, alignItems: 'center' },
  brandTitle: { fontSize: 28, fontWeight: '800', color: colors.primary[500] },
  subtitle: { fontSize: 14, color: colors.neutral[400], marginTop: 4 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.neutral[700], marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.neutral[200], borderRadius: 8, padding: 12, fontSize: 15, color: colors.neutral[900] },
  button: { backgroundColor: colors.primary[500], padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
