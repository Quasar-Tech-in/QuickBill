import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export const ReportsScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profit & Loss Summary</Text>
      <Text style={styles.subtitle}>Current Month: September 2026</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Gross Sales</Text>
          <Text style={styles.val}>₹ 1,45,200.00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Less: Sales Returns</Text>
          <Text style={styles.val}>- ₹ 1,200.00</Text>
        </View>
        <View style={[styles.row, styles.highlightRow]}>
          <Text style={styles.boldLabel}>Net Sales</Text>
          <Text style={styles.boldVal}>₹ 1,44,000.00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Less: Cost of Goods Sold (COGS)</Text>
          <Text style={styles.val}>- ₹ 86,400.00</Text>
        </View>
        <View style={[styles.row, styles.highlightRow]}>
          <Text style={styles.boldLabel}>Gross Profit</Text>
          <Text style={[styles.boldVal, { color: colors.success[700] }]}>₹ 57,600.00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Operating Expenses (Rent, Bills)</Text>
          <Text style={styles.val}>- ₹ 18,500.00</Text>
        </View>
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.netProfitLabel}>Net Business Profit</Text>
          <Text style={styles.netProfitVal}>₹ 39,100.00</Text>
        </View>
      </View>

      <Text style={[styles.title, { marginTop: 24 }]}>Inventory Stock Valuation</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Total Active SKUs</Text>
          <Text style={styles.val}>142 Items</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Units on Hand</Text>
          <Text style={styles.val}>1,840 pcs</Text>
        </View>
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.boldLabel}>Total Inventory Asset Value</Text>
          <Text style={styles.boldVal}>₹ 3,24,650.00</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16 },
  title: { fontSize: 16, fontWeight: '800', color: colors.neutral[900] },
  subtitle: { fontSize: 12, color: colors.neutral[400], marginBottom: 12 },
  card: { backgroundColor: colors.surface.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.surface.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 13, color: colors.neutral[600] },
  val: { fontSize: 13, fontWeight: '600', color: colors.neutral[900] },
  highlightRow: { backgroundColor: colors.neutral[50], paddingHorizontal: 8, borderRadius: 6, marginVertical: 4 },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.neutral[200], paddingTop: 10, marginTop: 6 },
  boldLabel: { fontSize: 14, fontWeight: '700', color: colors.neutral[900] },
  boldVal: { fontSize: 14, fontWeight: '700', color: colors.neutral[900] },
  netProfitLabel: { fontSize: 15, fontWeight: '800', color: colors.success[700] },
  netProfitVal: { fontSize: 16, fontWeight: '800', color: colors.success[700] },
});
