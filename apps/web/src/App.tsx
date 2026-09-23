import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { PosBillingView } from './views/PosBillingView';
import { InventoryView } from './views/InventoryView';
import { PartiesView } from './views/PartiesView';
import { TransactionsView } from './views/TransactionsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { SuperAdminView } from './views/SuperAdminView';
import { TenantLoginView } from './views/TenantLoginView';
import { SuperAdminLoginView } from './views/SuperAdminLoginView';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { store } from './services/store';
import { Invoice, Tenant, User } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(store.getCurrentUser());
  const [authView, setAuthView] = useState<'tenant_login' | 'superadmin_login'>('tenant_login');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [, setTenantStateKey] = useState<number>(0);

  useEffect(() => {
    store.checkHealth().then((online) => setIsBackendOnline(online));
  }, []);

  // Enforce role-based route access guard
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role;

    if (role === 'CASHIER') {
      const allowedCashierTabs = ['pos', 'transactions', 'parties'];
      if (!allowedCashierTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    } else if (role === 'MANAGER') {
      const restrictedManagerTabs = ['settings', 'superadmin'];
      if (restrictedManagerTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else if (role === 'TENANT_ADMIN') {
      if (activeTab === 'superadmin') {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'SUPER_ADMIN') {
      setActiveTab('superadmin');
    } else if (user.role === 'CASHIER') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    store.logout();
    setCurrentUser(null);
    setAuthView('tenant_login');
    setActiveTab('dashboard');
  };

  const handleTenantSwitched = (_tenant: Tenant) => {
    // Force rerender so that child views read the updated store context
    setTenantStateKey((prev) => prev + 1);
  };

  // If user is not authenticated, render the dedicated login screen
  if (!currentUser) {
    if (authView === 'superadmin_login') {
      return (
        <SuperAdminLoginView
          onLoginSuccess={handleLoginSuccess}
          onNavigateToTenantLogin={() => setAuthView('tenant_login')}
        />
      );
    }
    return (
      <TenantLoginView
        onLoginSuccess={handleLoginSuccess}
        onNavigateToSuperAdmin={() => setAuthView('superadmin_login')}
      />
    );
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Executive Dashboard';
      case 'pos':
        return 'POS Counter & Billing';
      case 'inventory':
        return 'Item Catalog & Inventory';
      case 'parties':
        return 'Parties & Contact Ledger';
      case 'transactions':
        return 'Invoices & Bills';
      case 'reports':
        return 'Financial Reports & Analytics';
      case 'superadmin':
        return 'Super Admin Multi-Tenant Governance';
      case 'settings':
        return 'Settings & Database Config';
      default:
        return 'QuickBill';
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tab) => setActiveTab(tab)} 
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header 
          title={getPageTitle()} 
          isBackendOnline={isBackendOnline} 
          onQuickSale={() => setActiveTab('pos')} 
          onNavigate={(tab) => setActiveTab(tab)}
          onTenantChange={handleTenantSwitched}
          onLogout={handleLogout}
        />

        <main className="main-content-scroll">
          {activeTab === 'dashboard' && (
            <DashboardView 
              onNavigate={(tab) => setActiveTab(tab)} 
              onViewInvoice={(inv) => setViewingInvoice(inv)} 
            />
          )}
          {activeTab === 'pos' && (
            <PosBillingView 
              onInvoiceCreated={(inv) => setViewingInvoice(inv)} 
            />
          )}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'parties' && <PartiesView />}
          {activeTab === 'transactions' && (
            <TransactionsView 
              onViewInvoice={(inv) => setViewingInvoice(inv)} 
            />
          )}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'superadmin' && (
            <SuperAdminView 
              onTenantSwitched={(tenant) => {
                handleTenantSwitched(tenant);
                setActiveTab('dashboard');
              }} 
            />
          )}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Invoice Print & Preview Modal */}
      {viewingInvoice && (
        <InvoicePrintModal 
          invoice={viewingInvoice} 
          onClose={() => setViewingInvoice(null)} 
        />
      )}
    </div>
  );
};

export default App;
