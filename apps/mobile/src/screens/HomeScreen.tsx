import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.storeName}>Cosmetic Solution</Text>
          <Text style={styles.storeBranch}>Main Branch • Cashier Desk</Text>
        </View>
        <TouchableOpacity style={styles.quickSaleButton} onPress={() => onNavigate('NewSale')}>
          <Text style={styles.quickSaleText}>+ New Sale</Text>
        </TouchableOpacity>
      </View>

      {/* Primary KPI Metrics */}
      <View style={styles.metricGrid}>
        <View style={[styles.metricCard, { borderLeftColor: colors.primary[500] }]}>
          <Text style={styles.metricLabel}>Today's Sales</Text>
          <Text style={styles.metricValue}>₹ 14,850.00</Text>
          <Text style={styles.metricSub}>18 Invoices</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: colors.success[500] }]}>
          <Text style={styles.metricLabel}>Money Received</Text>
          <Text style={styles.metricValue}>₹ 12,200.00</Text>
          <Text style={styles.metricSub}>Cash & UPI</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: colors.danger[500] }]}>
          <Text style={styles.metricLabel}>Customer Dues</Text>
          <Text style={styles.metricValue}>₹ 2,650.00</Text>
          <Text style={styles.metricSub}>3 Customers</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: colors.warning[500] }]}>
          <Text style={styles.metricLabel}>Low Stock Alert</Text>
          <Text style={styles.metricValue}>4 Items</Text>
          <Text style={styles.metricSub}>Needs reorder</Text>
        </View>
      </View>

      {/* Quick Action Hub */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('NewSale')}>
          <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
            <Text style={{ fontSize: 20 }}>🧾</Text>
          </View>
          <Text style={styles.actionLabel}>New Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('Items')}>
          <View style={[styles.actionIcon, { backgroundColor: colors.warning[50] }]}>
            <Text style={{ fontSize: 20 }}>📦</Text>
          </View>
          <Text style={styles.actionLabel}>Add Item</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('Parties')}>
          <View style={[styles.actionIcon, { backgroundColor: colors.success[50] }]}>
            <Text style={{ fontSize: 20 }}>👥</Text>
          </View>
          <Text style={styles.actionLabel}>Customers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('Reports')}>
          <View style={[styles.actionIcon, { backgroundColor: colors.neutral[100] }]}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </View>
          <Text style={styles.actionLabel}>Reports</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  storeName: { fontSize: 20, fontWeight: '800', color: colors.neutral[900] },
  storeBranch: { fontSize: 13, color: colors.neutral[400], marginTop: 2 },
  quickSaleButton: { backgroundColor: colors.primary[500], paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  quickSaleText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  metricCard: { width: '48%', backgroundColor: colors.surface.card, padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.surface.border, borderLeftWidth: 4 },
  metricLabel: { fontSize: 12, color: colors.neutral[400], fontWeight: '500' },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.neutral[900], marginVertical: 4 },
  metricSub: { fontSize: 11, color: colors.neutral[600] },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral[900], marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  actionItem: { alignItems: 'center', width: '22%' },
  actionIcon: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.neutral[700], textAlign: 'center' },
});
