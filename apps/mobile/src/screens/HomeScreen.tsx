import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { DashboardStats, Item, Business } from '../types';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats>(() => store.getDashboardStats());
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [user, setUser] = useState(() => store.getActiveUser());
  const [refreshing, setRefreshing] = useState(false);

  const activeLoc = store.getActiveLocation();
  const isCashier = user?.role === 'CASHIER';

  const loadData = () => {
    setStats(store.getDashboardStats());
    setBusiness(store.getBusinessProfile());
    setItems(store.getItems());
    setUser(store.getActiveUser());
  };

  useEffect(() => {
    const unsubscribe = store.subscribe(loadData);
    return () => { unsubscribe(); };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const lowStockItems = items.filter(i => i.currentStock <= i.minStockAlert);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Store Header Banner */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{business.name}</Text>
          <Text style={styles.storeBranch}>📍 {activeLoc.name} • {user?.role} Session</Text>
        </View>
        <TouchableOpacity style={styles.quickSaleBtn} onPress={() => onNavigate('POS')}>
          <Text style={styles.quickSaleBtnText}>⚡ Start POS</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Metric Grid */}
      {!isCashier ? (
        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { borderLeftColor: colors.primary[500] }]}>
            <Text style={styles.metricLabel}>Today's Sales</Text>
            <Text style={styles.metricValue}>₹ {stats.todaySales.toFixed(2)}</Text>
            <Text style={styles.metricSub}>{stats.todayTransactionsCount} Invoices Created</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: colors.success[500] }]}>
            <Text style={styles.metricLabel}>Net Profit (Est.)</Text>
            <Text style={styles.metricValue}>₹ {stats.netProfit.toFixed(2)}</Text>
            <Text style={styles.metricSub}>28% Avg Gross Margin</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: colors.danger[500] }]}>
            <Text style={styles.metricLabel}>Customer Receivables</Text>
            <Text style={styles.metricValue}>₹ {stats.totalReceivables.toFixed(2)}</Text>
            <Text style={styles.metricSub}>Outstanding Credit</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: colors.warning[500] }]}>
            <Text style={styles.metricLabel}>Supplier Payables</Text>
            <Text style={styles.metricValue}>₹ {stats.totalPayables.toFixed(2)}</Text>
            <Text style={styles.metricSub}>Pending PO Dues</Text>
          </View>
        </View>
      ) : (
        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { width: '100%', borderLeftColor: colors.primary[500] }]}>
            <Text style={styles.metricLabel}>Today's Counter Billed</Text>
            <Text style={styles.metricValue}>₹ {stats.todaySales.toFixed(2)}</Text>
            <Text style={styles.metricSub}>{stats.todayTransactionsCount} Receipts Issued Today • Shift Active</Text>
          </View>
        </View>
      )}

      {/* Quick Action Navigation Grid */}
      <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('POS')}>
          <View style={[styles.actionIconBg, { backgroundColor: colors.primary[50] }]}>
            <Text style={styles.actionEmoji}>📷</Text>
          </View>
          <Text style={styles.actionTitle}>Camera POS</Text>
          <Text style={styles.actionSub}>Fast Barcode Billing</Text>
        </TouchableOpacity>

        {!isCashier && (
          <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('Items')}>
            <View style={[styles.actionIconBg, { backgroundColor: colors.warning[50] }]}>
              <Text style={styles.actionEmoji}>📦</Text>
            </View>
            <Text style={styles.actionTitle}>Inventory</Text>
            <Text style={styles.actionSub}>Stock & Labels</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('Transactions')}>
          <View style={[styles.actionIconBg, { backgroundColor: colors.success[50] }]}>
            <Text style={styles.actionEmoji}>🧾</Text>
          </View>
          <Text style={styles.actionTitle}>{isCashier ? 'Receipts' : 'Invoices'}</Text>
          <Text style={styles.actionSub}>Print & WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate(isCashier ? 'Parties' : 'Hub')}>
          <View style={[styles.actionIconBg, { backgroundColor: colors.neutral[100] }]}>
            <Text style={styles.actionEmoji}>{isCashier ? '👥' : '🏢'}</Text>
          </View>
          <Text style={styles.actionTitle}>{isCashier ? 'Customers' : 'Business Hub'}</Text>
          <Text style={styles.actionSub}>{isCashier ? 'Lookup & Balances' : 'POs, Parties, Reports'}</Text>
        </TouchableOpacity>
      </View>

      {/* Low Stock Watchlist for Managers/Owners */}
      {!isCashier && lowStockItems.length > 0 && (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertTitle}>⚠️ Low Stock Alerts ({lowStockItems.length})</Text>
            <TouchableOpacity onPress={() => onNavigate('Items')}>
              <Text style={styles.alertLink}>View All &gt;</Text>
            </TouchableOpacity>
          </View>
          {lowStockItems.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.lowStockRow}>
              <View>
                <Text style={styles.lowStockName}>{item.name}</Text>
                <Text style={styles.lowStockSku}>SKU: {item.sku || item.publicItemId}</Text>
              </View>
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>{item.currentStock} {item.unit} left</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  storeName: { fontSize: 18, fontWeight: '800', color: colors.neutral[900] },
  storeBranch: { fontSize: 12, color: colors.neutral[600], marginTop: 2 },
  quickSaleBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  quickSaleBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.surface.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderLeftWidth: 4,
  },
  metricLabel: { fontSize: 11, color: colors.neutral[600], fontWeight: '600', textTransform: 'uppercase' },
  metricValue: { fontSize: 18, fontWeight: '900', color: colors.neutral[900], marginVertical: 4 },
  metricSub: { fontSize: 11, color: colors.neutral[600] },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral[900], marginBottom: 12 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionEmoji: { fontSize: 20 },
  actionTitle: { fontSize: 14, fontWeight: '800', color: colors.neutral[900] },
  actionSub: { fontSize: 11, color: colors.neutral[600], marginTop: 2 },
  alertCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  alertLink: { fontSize: 12, fontWeight: '700', color: colors.primary[600] },
  lowStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  lowStockName: { fontSize: 13, fontWeight: '600', color: colors.neutral[900] },
  lowStockSku: { fontSize: 11, color: colors.neutral[600] },
  stockBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  stockBadgeText: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },
});
