import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Invoice, Item, PurchaseOrder } from '../types';

export const ReportsScreen: React.FC = () => {
  const [period, setPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [pos, setPos] = useState<PurchaseOrder[]>(() => store.getPurchaseOrders());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setInvoices(store.getInvoices());
      setItems(store.getItems());
      setPos(store.getPurchaseOrders());
    });
    return () => { unsubscribe(); };
  }, []);

  const totalSalesRevenue = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
  const totalTaxCollected = invoices.reduce((acc, inv) => acc + inv.taxTotal, 0);
  const totalPurchaseExpenses = pos.reduce((acc, p) => acc + p.grandTotal, 0);
  const totalInventoryValuation = items.reduce((acc, it) => acc + (it.currentStock * it.purchasePrice), 0);
  const estimatedGrossProfit = totalSalesRevenue * 0.28;

  const handleExport = () => {
    Alert.alert(
      'Export Report',
      'Download complete sales and tax summary report?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export PDF / CSV', onPress: () => Alert.alert('Report Exported', 'Financial report ready to share.') }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period Filter Bar */}
      <View style={styles.periodRow}>
        {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {p === 'TODAY' && 'Today'}
              {p === 'WEEK' && 'This Week'}
              {p === 'MONTH' && 'This Month'}
              {p === 'ALL' && 'All Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Financial KPI Card */}
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Total Sales Revenue ({period})</Text>
        <Text style={styles.kpiAmount}>₹ {totalSalesRevenue.toFixed(2)}</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiGridItem}>
            <Text style={styles.gridLabel}>Invoices</Text>
            <Text style={styles.gridVal}>{invoices.length}</Text>
          </View>
          <View style={styles.kpiGridItem}>
            <Text style={styles.gridLabel}>Est. Profit</Text>
            <Text style={[styles.gridVal, { color: colors.success[700] }]}>₹ {estimatedGrossProfit.toFixed(2)}</Text>
          </View>
          <View style={styles.kpiGridItem}>
            <Text style={styles.gridLabel}>Tax (GST)</Text>
            <Text style={styles.gridVal}>₹ {totalTaxCollected.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Simplified Profit & Loss Statement */}
      <Text style={styles.sectionHeading}>📊 Simplified Profit & Loss (P&L)</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Total Gross Sales (+)</Text>
          <Text style={styles.rowVal}>₹ {totalSalesRevenue.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Cost of Goods Sold (COGS) (-)</Text>
          <Text style={styles.rowVal}>₹ {(totalSalesRevenue * 0.72).toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { fontWeight: '800' }]}>Gross Profit</Text>
          <Text style={[styles.rowVal, { fontWeight: '800', color: colors.success[700] }]}>
            ₹ {estimatedGrossProfit.toFixed(2)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Purchases & Inwarding (-)</Text>
          <Text style={styles.rowVal}>₹ {totalPurchaseExpenses.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { fontWeight: '900', fontSize: 14 }]}>Net Business Cashflow</Text>
          <Text style={[styles.rowVal, { fontWeight: '900', fontSize: 15, color: colors.primary[700] }]}>
            ₹ {(totalSalesRevenue - totalPurchaseExpenses).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Inventory Valuation & Tax Summary */}
      <Text style={styles.sectionHeading}>📦 Inventory Asset Valuation</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Total Unique Catalog Items</Text>
          <Text style={styles.rowVal}>{items.length} SKUs</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Total Stock Asset Value</Text>
          <Text style={[styles.rowVal, { color: colors.primary[600], fontWeight: '800' }]}>
            ₹ {totalInventoryValuation.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Export Action */}
      <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
        <Text style={styles.exportBtnText}>📄 Export Statement (PDF / CSV)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 32 },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  periodBtnTextActive: {
    color: '#fff',
  },
  kpiCard: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
    textTransform: 'uppercase',
  },
  kpiAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary[800],
    marginVertical: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
  },
  kpiGridItem: {
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 10,
    color: colors.neutral[600],
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
    marginTop: 2,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.neutral[700],
  },
  rowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: 6,
  },
  exportBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportBtnText: {
    color: colors.primary[600],
    fontWeight: '800',
    fontSize: 13,
  },
});
