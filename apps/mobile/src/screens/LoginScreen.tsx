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
      Alert.alert('Connection Error', e.message || 'Could not connect to store server.');
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
});
