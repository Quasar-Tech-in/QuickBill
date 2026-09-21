import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './src/theme/colors';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { NewSaleScreen } from './src/screens/NewSaleScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { ItemsScreen } from './src/screens/ItemsScreen';
import { PartiesScreen } from './src/screens/PartiesScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState<'Home' | 'NewSale' | 'Transactions' | 'Items' | 'Parties' | 'Reports'>('Home');

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Top App Bar */}
        <View style={styles.appBar}>
          <Text style={styles.appTitle}>QuickBill POS</Text>
          <TouchableOpacity onPress={() => setIsAuthenticated(false)}>
            <Text style={styles.logoutText}>Switch User</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Screen View Content */}
        <View style={styles.content}>
          {activeTab === 'Home' && <HomeScreen onNavigate={(screen) => setActiveTab(screen as any)} />}
          {activeTab === 'NewSale' && <NewSaleScreen onComplete={() => setActiveTab('Transactions')} />}
          {activeTab === 'Transactions' && <TransactionsScreen />}
          {activeTab === 'Items' && <ItemsScreen />}
          {activeTab === 'Parties' && <PartiesScreen />}
          {activeTab === 'Reports' && <ReportsScreen />}
        </View>

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Home')}>
            <Text style={activeTab === 'Home' ? styles.navActive : styles.navInactive}>🏠 Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('NewSale')}>
            <Text style={activeTab === 'NewSale' ? styles.navActive : styles.navInactive}>🧾 +Sale</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Transactions')}>
            <Text style={activeTab === 'Transactions' ? styles.navActive : styles.navInactive}>📋 Bills</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Items')}>
            <Text style={activeTab === 'Items' ? styles.navActive : styles.navInactive}>📦 Items</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('Reports')}>
            <Text style={activeTab === 'Reports' ? styles.navActive : styles.navInactive}>📊 Reports</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  appBar: { height: 54, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.surface.border },
  appTitle: { fontSize: 17, fontWeight: '800', color: colors.primary[500] },
  logoutText: { fontSize: 13, color: colors.neutral[600], fontWeight: '600' },
  content: { flex: 1 },
  bottomNav: { height: 60, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.surface.border },
  navItem: { padding: 6 },
  navActive: { fontSize: 12, fontWeight: '800', color: colors.primary[500] },
  navInactive: { fontSize: 12, fontWeight: '500', color: colors.neutral[400] },
});
