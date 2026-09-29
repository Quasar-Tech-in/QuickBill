import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './src/theme/colors';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { POSScreen } from './src/screens/POSScreen';
import { ItemsScreen } from './src/screens/ItemsScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { HubScreen } from './src/screens/HubScreen';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState<'Home' | 'POS' | 'Items' | 'Transactions' | 'Hub'>('Home');

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Top App Bar */}
        <View style={styles.appBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>QB</Text>
            </View>
            <View>
              <Text style={styles.appTitle}>QuickBill POS</Text>
              <Text style={styles.branchSub}>Main Branch • Online 🟢</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.switchUserBtn}
            onPress={() => setIsAuthenticated(false)}
          >
            <Text style={styles.switchUserText}>👤 Switch User</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Screen View Content */}
        <View style={styles.content}>
          {activeTab === 'Home' && <HomeScreen onNavigate={(screen) => setActiveTab(screen as any)} />}
          {activeTab === 'POS' && <POSScreen />}
          {activeTab === 'Items' && <ItemsScreen />}
          {activeTab === 'Transactions' && <TransactionsScreen />}
          {activeTab === 'Hub' && <HubScreen onLogout={() => setIsAuthenticated(false)} />}
        </View>

        {/* 5-Tab Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
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
            <Text style={styles.navIcon}>📷</Text>
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
            <Text style={activeTab === 'Hub' ? styles.navActiveText : styles.navInactiveText}>More Hub</Text>
          </TouchableOpacity>
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
    fontSize: 16,
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
    paddingBottom: 4,
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
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
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
});
