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
import { DashboardStats, Item, Business, Invoice } from '../types';

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats>(() => store.getDashboardStats());
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [user, setUser] = useState(() => store.getActiveUser());
  const [refreshing, setRefreshing] = useState(false);

  const activeLoc = store.getActiveLocation();
  const isCashier = user?.role === 'CASHIER';

  const loadData = () => {
    setStats(store.getDashboardStats());
    setBusiness(store.getBusinessProfile());
    setItems(store.getItems());
    setInvoices(store.getInvoices());
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
  const recentInvoices = [...invoices].reverse().slice(0, 5);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 1. Store Header Banner */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{business.name || 'QuickBill Store'}</Text>
          <View style={styles.storeMetaRow}>
            <Text style={styles.storeBranch}>📍 {activeLoc.name || 'Main Branch'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role || 'STAFF'}</Text>
            </View>
            <View style={styles.onlinePill}>
              <Text style={styles.onlinePillText}>🟢 Online</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.quickSaleBtn} onPress={() => onNavigate('POS')}>
          <Text style={styles.quickSaleBtnText}>⚡ Start POS</Text>
        </TouchableOpacity>
      </View>

      {/* 2. 6 Rich KPI Metric Cards Grid */}
      <Text style={styles.sectionTitle}>📈 Business Performance</Text>
      {!isCashier ? (
        <View style={styles.metricGrid}>
          {/* Card 1: Today's Revenue */}
          <View style={[styles.metricCard, { borderTopColor: colors.primary[500] }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Today's Sales</Text>
              <Text style={styles.metricIcon}>💰</Text>
            </View>
            <Text style={styles.metricValue}>₹ {stats.todaySales.toFixed(2)}</Text>
            <Text style={styles.metricSub}>{stats.todayTransactionsCount} bills issued</Text>
          </View>

          {/* Card 2: Net Profit */}
          <View style={[styles.metricCard, { borderTopColor: colors.success[500] }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Net Profit (Est.)</Text>
              <Text style={styles.metricIcon}>📈</Text>
            </View>
            <Text style={[styles.metricValue, { color: colors.success[700] }]}>₹ {stats.netProfit.toFixed(2)}</Text>
            <Text style={styles.metricSub}>~28% gross margin</Text>
          </View>

          {/* Card 3: Total Invoices */}
          <View style={[styles.metricCard, { borderTopColor: colors.neutral[600] }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Total Invoices</Text>
              <Text style={styles.metricIcon}>🧾</Text>
            </View>
            <Text style={styles.metricValue}>{stats.todayTransactionsCount}</Text>
            <Text style={styles.metricSub}>Billed today</Text>
          </View>

          {/* Card 4: Low Stock Alerts */}
          <View style={[styles.metricCard, { borderTopColor: colors.warning[500] }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Stock Alerts</Text>
              <Text style={styles.metricIcon}>⚠️</Text>
            </View>
            <Text style={[styles.metricValue, lowStockItems.length > 0 && { color: colors.warning[700] }]}>
              {lowStockItems.length}
            </Text>
            <Text style={styles.metricSub}>{lowStockItems.length > 0 ? 'Need reorder' : 'All stocks healthy'}</Text>
          </View>

          {/* Card 5: Customer Receivables */}
          <View style={[styles.metricCard, { borderTopColor: colors.danger[500] }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Receivables</Text>
              <Text style={styles.metricIcon}>👥</Text>
            </View>
            <Text style={[styles.metricValue, { color: colors.danger[700] }]}>₹ {stats.totalReceivables.toFixed(2)}</Text>
            <Text style={styles.metricSub}>Customer credit dues</Text>
          </View>

          {/* Card 6: Supplier Payables */}
          <View style={[styles.metricCard, { borderTopColor: '#d97706' }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Payables</Text>
              <Text style={styles.metricIcon}>📦</Text>
            </View>
            <Text style={styles.metricValue}>₹ {stats.totalPayables.toFixed(2)}</Text>
            <Text style={styles.metricSub}>Pending PO dues</Text>
          </View>
        </View>
      ) : (
        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { width: '100%', borderTopColor: colors.primary[500] }]}>
            <View style={styles.metricHeaderRow}>
              <Text style={styles.metricLabel}>Counter Billed Today</Text>
              <Text style={styles.metricIcon}>⚡</Text>
            </View>
            <Text style={styles.metricValue}>₹ {stats.todaySales.toFixed(2)}</Text>
            <Text style={styles.metricSub}>{stats.todayTransactionsCount} receipts issued • Active Shift</Text>
          </View>
        </View>
      )}

      {/* 3. Quick Action Navigation Grid */}
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
            <Text style={styles.actionSub}>Stock & Label Studio</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate('Transactions')}>
          <View style={[styles.actionIconBg, { backgroundColor: colors.success[50] }]}>
            <Text style={styles.actionEmoji}>🧾</Text>
          </View>
          <Text style={styles.actionTitle}>{isCashier ? 'Receipts' : 'Invoices'}</Text>
          <Text style={styles.actionSub}>Print & WhatsApp Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => onNavigate(isCashier ? 'Parties' : 'Hub')}>
          <View style={[styles.actionIconBg, { backgroundColor: colors.neutral[100] }]}>
            <Text style={styles.actionEmoji}>{isCashier ? '👥' : '🏢'}</Text>
          </View>
          <Text style={styles.actionTitle}>{isCashier ? 'Customers' : 'Business Hub'}</Text>
          <Text style={styles.actionSub}>{isCashier ? 'Khata Balances' : 'POs, Ledger, Reports'}</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Critical Stock Replenishment Watchlist */}
      {!isCashier && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionCardTitle}>⚠️ Critical Stock Replenishment</Text>
              {lowStockItems.length > 0 && (
                <View style={styles.warningCountBadge}>
                  <Text style={styles.warningCountBadgeText}>{lowStockItems.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => onNavigate('Items')}>
              <Text style={styles.sectionCardLink}>Inventory &gt;</Text>
            </TouchableOpacity>
          </View>

          {lowStockItems.length === 0 ? (
            <View style={styles.healthyStockBox}>
              <Text style={{ fontSize: 20 }}>✅</Text>
              <Text style={styles.healthyStockText}>All product inventory levels are healthy.</Text>
            </View>
          ) : (
            lowStockItems.slice(0, 4).map(item => (
              <View key={item.id} style={styles.criticalStockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.criticalStockName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.criticalStockMeta}>
                    {item.category} • SKU: {item.sku || item.publicItemId}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={styles.stockLevelPill}>
                    <Text style={styles.stockLevelPillText}>
                      {item.currentStock} / {item.minStockAlert} {item.unit}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.adjustStockBtn}
                    onPress={() => onNavigate('Items')}
                  >
                    <Text style={styles.adjustStockBtnText}>Restock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* 5. Recent Sales Invoices Preview */}
      <View style={[styles.sectionCard, { marginTop: 14 }]}>
        <View style={styles.sectionCardHeader}>
          <Text style={styles.sectionCardTitle}>🧾 Recent Sales Invoices</Text>
          <TouchableOpacity onPress={() => onNavigate('Transactions')}>
            <Text style={styles.sectionCardLink}>All Bills &gt;</Text>
          </TouchableOpacity>
        </View>

        {recentInvoices.length === 0 ? (
          <View style={styles.emptyRecentBox}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🛍️</Text>
            <Text style={styles.emptyRecentText}>No invoices billed today yet.</Text>
          </View>
        ) : (
          recentInvoices.map(inv => {
            const timeStr = new Date(inv.date).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={inv.id}
                style={styles.recentInvoiceRow}
                onPress={() => onNavigate('Transactions')}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.recentInvNum}>{inv.invoiceNumber}</Text>
                    <View style={[
                      styles.statusPill, 
                      inv.status === 'PAID' ? styles.statusPillPaid : styles.statusPillPartial
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        inv.status === 'PAID' ? styles.statusTextPaid : styles.statusTextPartial
                      ]}>
                        {inv.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recentInvParty} numberOfLines={1}>
                    👤 {inv.partyName || 'Counter Customer'} • {timeStr}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recentInvTotal}>₹ {inv.grandTotal.toFixed(2)}</Text>
                  <Text style={styles.recentInvMode}>{inv.paymentMode}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 36 },
  
  // Header
  header: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  storeName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  storeBranch: {
    fontSize: 11,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  roleBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary[700],
  },
  onlinePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onlinePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  quickSaleBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  quickSaleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // KPI Grid
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 10,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderTopWidth: 3,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  metricIcon: {
    fontSize: 13,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.neutral[900],
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 10,
    color: colors.neutral[500],
    fontWeight: '600',
  },

  // Quick Action Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  actionIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  actionSub: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 14,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  warningCountBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b91c1c',
  },
  sectionCardLink: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[600],
  },
  healthyStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
  },
  healthyStockText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
  },
  criticalStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  criticalStockName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  criticalStockMeta: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  stockLevelPill: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  stockLevelPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  adjustStockBtn: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  adjustStockBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary[700],
  },

  // Recent Invoices
  emptyRecentBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyRecentText: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  recentInvoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  recentInvNum: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  statusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusPillPaid: { backgroundColor: '#ecfdf5' },
  statusPillPartial: { backgroundColor: '#fffbeb' },
  statusPillText: { fontSize: 9, fontWeight: '800' },
  statusTextPaid: { color: '#047857' },
  statusTextPartial: { color: '#b45309' },
  recentInvParty: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  recentInvTotal: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  recentInvMode: {
    fontSize: 10,
    color: colors.neutral[500],
    fontWeight: '600',
    marginTop: 2,
  },
});
