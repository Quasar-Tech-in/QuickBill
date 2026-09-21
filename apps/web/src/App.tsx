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
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { store } from './services/store';
import { Invoice, Tenant } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [, setTenantStateKey] = useState<number>(0);

  useEffect(() => {
    store.checkHealth().then((online) => setIsBackendOnline(online));
  }, []);

  const handleTenantSwitched = (_tenant: Tenant) => {
    // Force rerender so that child views read the updated store context
    setTenantStateKey(prev => prev + 1);
  };

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
      <Sidebar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header 
          title={getPageTitle()} 
          isBackendOnline={isBackendOnline} 
          onQuickSale={() => setActiveTab('pos')} 
          onNavigate={(tab) => setActiveTab(tab)}
          onTenantChange={handleTenantSwitched}
        />

        <main style={{ flex: 1 }}>
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
