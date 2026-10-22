import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform, LogBox } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './src/theme/colors';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { POSScreen } from './src/screens/POSScreen';
import { ItemsScreen } from './src/screens/ItemsScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { PartiesScreen } from './src/screens/PartiesScreen';
import { HubScreen } from './src/screens/HubScreen';
import { store } from './src/services/store';

// Suppress transient Metro HMR disconnect warnings on physical devices
LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Disconnected from Metro',
  'Expo CLI has restarted',
]);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => store.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => store.getActiveUser());
  const [cart, setCart] = useState(() => store.getCart());
  const isCashier = currentUser?.role === 'CASHIER';
  const [activeTab, setActiveTab] = useState<string>(isCashier ? 'POS' : 'Home');
  const [isCheckingBranch, setIsCheckingBranch] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      store.syncAllData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setIsAuthenticated(store.isAuthenticated());
      const user = store.getActiveUser();
      setCurrentUser(user);
      setCart(store.getCart());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    store.logout();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated || !currentUser) {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoginSuccess={() => {
          setIsAuthenticated(true);
          const user = store.getActiveUser();
          setCurrentUser(user);
          setActiveTab(user?.role === 'CASHIER' ? 'POS' : 'Home');
        }} />
      </SafeAreaProvider>
    );
  }

  const tenantDisplayName = currentUser.tenantName || 'QuickBill Store';
  const activeLocation = store.getActiveLocation();
  const activeTenant = store.getActiveTenant();
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const isTenantAdmin = currentUser.role === 'TENANT_ADMIN';
  const isStaffNonAdmin = isCashier || currentUser.role === 'MANAGER';

  const sub = activeTenant?.subscription;
  const daysRemaining = sub?.daysRemaining ?? 365;
  const isExpiringSoon = !isSuperAdmin && daysRemaining <= 14;

  const isBranchLockedOut = isStaffNonAdmin && activeLocation && activeLocation.isActive === false;

  const handleCheckBranchStatus = async () => {
    setIsCheckingBranch(true);
    try {
      await store.fetchLocations();
      await store.fetchBusinessProfile();
    } catch {}
    setIsCheckingBranch(false);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Top App Bar */}
        <View style={styles.appBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>QB</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.appTitle} numberOfLines={1}>{tenantDisplayName}</Text>
              <Text style={styles.branchSub} numberOfLines={1}>
                📍 {activeLocation.name} • <Text style={{ fontWeight: '700', color: isCashier ? colors.primary[600] : colors.neutral[800] }}>{currentUser.role}</Text> • Online 🟢
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.switchUserBtn}
            onPress={handleLogout}
          >
            <Text style={styles.switchUserText}>🚪 Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Store Subscription License Expiration Banner */}
        {isExpiringSoon && (
          <View style={[styles.licenseBanner, daysRemaining < 0 ? styles.bannerDanger : styles.bannerWarning]}>
            <Text style={[styles.licenseBannerText, daysRemaining < 0 ? styles.bannerTextDanger : styles.bannerTextWarning]}>
              {daysRemaining < 0 
                ? `⚠️ License expired ${Math.abs(daysRemaining)} day(s) ago. Contact Super Admin to renew.`
                : `⏳ Store subscription expires in ${daysRemaining} day(s) (${sub?.endDate ? new Date(sub.endDate).toLocaleDateString() : ''}). Contact Super Admin.`}
            </Text>
          </View>
        )}

        {/* Dynamic Screen View Content */}
        <View style={styles.content}>
          {activeTab === 'Home' && !isCashier && <HomeScreen onNavigate={(screen) => setActiveTab(screen)} />}
          {activeTab === 'POS' && <POSScreen />}
          {activeTab === 'Items' && !isCashier && <ItemsScreen />}
          {activeTab === 'Transactions' && <TransactionsScreen />}
          {activeTab === 'Parties' && isCashier && <PartiesScreen />}
          {activeTab === 'Hub' && <HubScreen onLogout={handleLogout} />}
        </View>

        {/* Non-Admin Branch Deactivated Fullscreen Lockout Overlay */}
        {isBranchLockedOut && (
          <View style={styles.lockoutBackdrop}>
            <View style={styles.lockoutCard}>
              <View style={styles.lockoutIconCircle}>
                <Text style={{ fontSize: 32 }}>⚠️</Text>
              </View>
              <Text style={styles.lockoutTitle}>Store Branch Deactivated</Text>
              <Text style={styles.lockoutSub}>
                Signed in as {currentUser.name} ({currentUser.role})
              </Text>

              <Text style={styles.lockoutMsg}>
                Your assigned store branch outlet (📍 {activeLocation.name}) has been deactivated by the store administrator. Access to billing, POS checkout, inventory lookups, and transactions is restricted while the branch is inactive.
              </Text>

              <View style={styles.lockoutBtnRow}>
                <TouchableOpacity 
                  style={styles.lockoutCheckBtn}
                  onPress={handleCheckBranchStatus}
                  disabled={isCheckingBranch}
                >
                  <Text style={styles.lockoutCheckBtnText}>
                    {isCheckingBranch ? '🔄 Checking...' : '🔄 Check Status'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.lockoutSignOutBtn}
                  onPress={handleLogout}
                >
                  <Text style={styles.lockoutSignOutBtnText}>🚪 Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Dynamic Role-Based Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
          {!isCashier ? (
            <>
              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Home' && styles.navItemActive]} 
                onPress={() => setActiveTab('Home')}
              >
                <Text style={styles.navIcon}>🏠</Text>
                <Text style={activeTab === 'Home' ? styles.navActiveText : styles.navInactiveText}>Home</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'POS' && styles.navItemActive]} 
                onPress={() => setActiveTab('POS')}
              >
                <View style={styles.iconBadgeWrapper}>
                  <Text style={styles.navIcon}>⚡</Text>
                  {cart.length > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cart.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={activeTab === 'POS' ? styles.navActiveText : styles.navInactiveText}>POS Billing</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Items' && styles.navItemActive]} 
                onPress={() => setActiveTab('Items')}
              >
                <Text style={styles.navIcon}>📦</Text>
                <Text style={activeTab === 'Items' ? styles.navActiveText : styles.navInactiveText}>Inventory</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Transactions' && styles.navItemActive]} 
                onPress={() => setActiveTab('Transactions')}
              >
                <Text style={styles.navIcon}>🧾</Text>
                <Text style={activeTab === 'Transactions' ? styles.navActiveText : styles.navInactiveText}>Invoices</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Hub' && styles.navItemActive]} 
                onPress={() => setActiveTab('Hub')}
              >
                <Text style={styles.navIcon}>🏢</Text>
                <Text style={activeTab === 'Hub' ? styles.navActiveText : styles.navInactiveText}>Business Hub</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'POS' && styles.navItemActive]} 
                onPress={() => setActiveTab('POS')}
              >
                <View style={styles.iconBadgeWrapper}>
                  <Text style={styles.navIcon}>⚡</Text>
                  {cart.length > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cart.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={activeTab === 'POS' ? styles.navActiveText : styles.navInactiveText}>Fast POS</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Transactions' && styles.navItemActive]} 
                onPress={() => setActiveTab('Transactions')}
              >
                <Text style={styles.navIcon}>🧾</Text>
                <Text style={activeTab === 'Transactions' ? styles.navActiveText : styles.navInactiveText}>Receipts</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Parties' && styles.navItemActive]} 
                onPress={() => setActiveTab('Parties')}
              >
                <Text style={styles.navIcon}>👥</Text>
                <Text style={activeTab === 'Parties' ? styles.navActiveText : styles.navInactiveText}>Customers</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navItem, activeTab === 'Hub' && styles.navItemActive]} 
                onPress={() => setActiveTab('Hub')}
              >
                <Text style={styles.navIcon}>🏢</Text>
                <Text style={activeTab === 'Hub' ? styles.navActiveText : styles.navInactiveText}>Shift Hub</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  appBar: {
    height: 56,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  appTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  branchSub: {
    fontSize: 10,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  switchUserBtn: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  switchUserText: {
    fontSize: 11,
    color: colors.neutral[700],
    fontWeight: '700',
  },
  content: { flex: 1 },
  bottomNav: {
    height: 64,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: colors.primary[500],
  },
  iconBadgeWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.danger[500],
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 16,
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  navActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary[600],
  },
  navInactiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  licenseBanner: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  bannerWarning: {
    backgroundColor: '#fffbeb',
    borderBottomColor: '#fde68a',
  },
  bannerDanger: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fca5a5',
  },
  licenseBannerText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  bannerTextWarning: {
    color: '#92400e',
  },
  bannerTextDanger: {
    color: '#991b1b',
  },
  lockoutBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  lockoutCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  lockoutIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  lockoutTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.neutral[900],
    marginBottom: 4,
    textAlign: 'center',
  },
  lockoutSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: 14,
    textAlign: 'center',
  },
  lockoutMsg: {
    fontSize: 13,
    color: colors.neutral[700],
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  lockoutBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  lockoutCheckBtn: {
    flex: 1,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  lockoutCheckBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[700],
  },
  lockoutSignOutBtn: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  lockoutSignOutBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger[700],
  },
});
