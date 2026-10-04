import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { colors } from '../theme/colors';
import { PurchaseOrdersScreen } from './PurchaseOrdersScreen';
import { PartiesScreen } from './PartiesScreen';
import { LedgerScreen } from './LedgerScreen';
import { ReportsScreen } from './ReportsScreen';
import { SettingsScreen } from './SettingsScreen';

import { store } from '../services/store';

type HubModule = 'MENU' | 'PO' | 'PARTIES' | 'LEDGER' | 'REPORTS' | 'SETTINGS';

export const HubScreen: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const [activeModule, setActiveModule] = useState<HubModule>('MENU');
  const user = store.getActiveUser();
  const role = user?.role || 'CASHIER';
  const isCashier = role === 'CASHIER';
  const isManager = role === 'MANAGER';
  const isOwner = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';

  if (activeModule === 'PO' && !isCashier) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backHeader} onPress={() => setActiveModule('MENU')}>
          <Text style={styles.backHeaderText}>&larr; Back to Business Hub</Text>
        </TouchableOpacity>
        <PurchaseOrdersScreen />
      </View>
    );
  }

  if (activeModule === 'PARTIES') {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backHeader} onPress={() => setActiveModule('MENU')}>
          <Text style={styles.backHeaderText}>&larr; Back to Business Hub</Text>
        </TouchableOpacity>
        <PartiesScreen />
      </View>
    );
  }

  if (activeModule === 'LEDGER') {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backHeader} onPress={() => setActiveModule('MENU')}>
          <Text style={styles.backHeaderText}>&larr; Back to Business Hub</Text>
        </TouchableOpacity>
        <LedgerScreen />
      </View>
    );
  }

  if (activeModule === 'REPORTS' && !isCashier) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backHeader} onPress={() => setActiveModule('MENU')}>
          <Text style={styles.backHeaderText}>&larr; Back to Business Hub</Text>
        </TouchableOpacity>
        <ReportsScreen />
      </View>
    );
  }

  if (activeModule === 'SETTINGS' && isOwner) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backHeader} onPress={() => setActiveModule('MENU')}>
          <Text style={styles.backHeaderText}>&larr; Back to Business Hub</Text>
        </TouchableOpacity>
        <SettingsScreen onLogout={onLogout} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hubTitle}>{isCashier ? '📋 Shift Operations Hub' : '🏢 Business Operations Hub'}</Text>
      <Text style={styles.hubSub}>
        {isCashier ? 'Counter customer directory and cash drawer operations' : 'Access all store workflows, financials, and inventory operations'}
      </Text>

      <View style={styles.moduleGrid}>
        {!isCashier && (
          <TouchableOpacity style={styles.moduleCard} onPress={() => setActiveModule('PO')}>
            <View style={[styles.iconBox, { backgroundColor: '#e0e7ff' }]}>
              <Text style={{ fontSize: 24 }}>📥</Text>
            </View>
            <Text style={styles.moduleName}>Purchase Orders</Text>
            <Text style={styles.moduleDesc}>Supplier POs, Inwarding & Stock Receipts</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.moduleCard} onPress={() => setActiveModule('PARTIES')}>
          <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
            <Text style={{ fontSize: 24 }}>👥</Text>
          </View>
          <Text style={styles.moduleName}>{isCashier ? 'Customer Directory' : 'Parties Directory'}</Text>
          <Text style={styles.moduleDesc}>{isCashier ? 'Look up customer profiles & dues' : 'Customers, Suppliers & Balances'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moduleCard} onPress={() => setActiveModule('LEDGER')}>
          <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
            <Text style={{ fontSize: 24 }}>📖</Text>
          </View>
          <Text style={styles.moduleName}>{isCashier ? 'Cash Register' : 'Financial Ledger'}</Text>
          <Text style={styles.moduleDesc}>{isCashier ? 'Daily cash drawer inflows/outflows' : 'Payment In/Out, Daybook & Expenses'}</Text>
        </TouchableOpacity>

        {!isCashier && (
          <TouchableOpacity style={styles.moduleCard} onPress={() => setActiveModule('REPORTS')}>
            <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
              <Text style={{ fontSize: 24 }}>📊</Text>
            </View>
            <Text style={styles.moduleName}>Reports & Analytics</Text>
            <Text style={styles.moduleDesc}>Sales, P&L Statement, Tax GST & Export</Text>
          </TouchableOpacity>
        )}

        {isOwner && (
          <TouchableOpacity style={styles.moduleCard} onPress={() => setActiveModule('SETTINGS')}>
            <View style={[styles.iconBox, { backgroundColor: '#e2e8f0' }]}>
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            </View>
            <Text style={styles.moduleName}>Store Settings</Text>
            <Text style={styles.moduleDesc}>Staff Management, Branches & Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 32 },
  backHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  backHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary[600],
  },
  hubTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  hubSub: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
    marginBottom: 16,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moduleCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  moduleDesc: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 4,
    lineHeight: 15,
  },
});
