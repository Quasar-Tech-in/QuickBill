import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useLocation, 
  Outlet 
} from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { PosBillingView } from './views/PosBillingView';
import { InventoryView } from './views/InventoryView';
import { PartiesView } from './views/PartiesView';
import { LedgerView } from './views/LedgerView';
import { TransactionsView } from './views/TransactionsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { SuperAdminView } from './views/SuperAdminView';
import { TenantLoginView } from './views/TenantLoginView';
import { SuperAdminLoginView } from './views/SuperAdminLoginView';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { store } from './services/store';
import { Invoice, Tenant, User } from './types';

// Helper to determine the landing route based on user role
const getDefaultPathForRole = (user: User | null): string => {
  if (!user) return '/login';
  if (user.role === 'SUPER_ADMIN') return '/superadmin';
  if (user.role === 'CASHIER') return '/pos';
  return '/dashboard';
};

// Route title resolver
const getRouteTitle = (pathname: string): string => {
  if (pathname.startsWith('/dashboard')) return 'Executive Dashboard';
  if (pathname.startsWith('/pos')) return 'POS Counter & Billing';
  if (pathname.startsWith('/inventory')) return 'Item Catalog & Inventory';
  if (pathname.startsWith('/parties')) return 'Parties & Contact Directory';
  if (pathname.startsWith('/ledger')) return 'Financial Ledger & Operating Expenses';
  if (pathname.startsWith('/invoices') || pathname.startsWith('/transactions')) return 'Invoices & Bills';
  if (pathname.startsWith('/reports')) return 'Financial Reports & Analytics';
  if (pathname.startsWith('/superadmin')) return 'Super Admin Multi-Tenant Governance';
  if (pathname.startsWith('/settings')) return 'Settings & Database Config';
  return 'QuickBill POS';
};

// Authenticated Main Layout Component
interface AppLayoutProps {
  currentUser: User;
  isBackendOnline: boolean;
  onLogout: () => void;
  onTenantSwitched: (tenant: Tenant) => void;
  viewingInvoice: Invoice | null;
  setViewingInvoice: (inv: Invoice | null) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser,
  isBackendOnline,
  onLogout,
  onTenantSwitched,
  viewingInvoice,
  setViewingInvoice
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Enforce role-based route access guard
  useEffect(() => {
    const role = currentUser.role;
    const path = location.pathname;

    if (role === 'CASHIER') {
      const allowedCashierPaths = ['/pos', '/invoices', '/transactions', '/parties', '/ledger'];
      const isAllowed = allowedCashierPaths.some(p => path === p || path.startsWith(p + '/'));
      if (!isAllowed) {
        navigate('/pos', { replace: true });
      }
    } else if (role === 'MANAGER') {
      if (path.startsWith('/settings') || path.startsWith('/superadmin')) {
        navigate('/dashboard', { replace: true });
      }
    } else if (role === 'TENANT_ADMIN') {
      if (path.startsWith('/superadmin')) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [currentUser, location.pathname, navigate]);

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={location.pathname.replace('/', '') || 'dashboard'} 
        onTabChange={(tab) => {
          if (tab === 'transactions') {
            navigate('/invoices');
          } else {
            navigate(`/${tab}`);
          }
        }} 
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header 
          title={getRouteTitle(location.pathname)} 
          isBackendOnline={isBackendOnline} 
          onQuickSale={() => navigate('/pos')} 
          onNavigate={(tab) => {
            if (tab === 'transactions') {
              navigate('/invoices');
            } else {
              navigate(`/${tab}`);
            }
          }}
          onTenantChange={onTenantSwitched}
          onLogout={onLogout}
        />

        <main className="main-content-scroll">
          <Outlet />
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

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(store.getCurrentUser());
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [, setTenantStateKey] = useState<number>(0);

  useEffect(() => {
    store.checkHealth().then((online) => setIsBackendOnline(online));
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    store.logout();
    setCurrentUser(null);
  };

  const handleTenantSwitched = (_tenant: Tenant) => {
    setTenantStateKey((prev) => prev + 1);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Unauthenticated / Login Routes */}
        <Route 
          path="/login" 
          element={
            currentUser ? (
              <Navigate to={getDefaultPathForRole(currentUser)} replace />
            ) : (
              <TenantLoginView 
                onLoginSuccess={handleLoginSuccess}
                onNavigateToSuperAdmin={() => {}}
              />
            )
          } 
        />
        
        <Route 
          path="/superadmin/login" 
          element={
            currentUser && currentUser.role === 'SUPER_ADMIN' ? (
              <Navigate to="/superadmin" replace />
            ) : (
              <SuperAdminLoginView 
                onLoginSuccess={handleLoginSuccess}
                onNavigateToTenantLogin={() => {}}
              />
            )
          } 
        />

        {/* Protected Authenticated Routes */}
        {currentUser ? (
          <Route 
            element={
              <AppLayout 
                currentUser={currentUser}
                isBackendOnline={isBackendOnline}
                onLogout={handleLogout}
                onTenantSwitched={handleTenantSwitched}
                viewingInvoice={viewingInvoice}
                setViewingInvoice={setViewingInvoice}
              />
            }
          >
            <Route 
              path="/dashboard" 
              element={
                <DashboardView 
                  onNavigate={() => {}} 
                  onViewInvoice={(inv) => setViewingInvoice(inv)} 
                />
              } 
            />
            <Route 
              path="/pos" 
              element={
                <PosBillingView 
                  onInvoiceCreated={(inv) => setViewingInvoice(inv)} 
                />
              } 
            />
            <Route path="/inventory" element={<InventoryView />} />
            <Route path="/parties" element={<PartiesView />} />
            <Route path="/ledger" element={<LedgerView />} />
            <Route 
              path="/invoices" 
              element={
                <TransactionsView 
                  onViewInvoice={(inv) => setViewingInvoice(inv)} 
                />
              } 
            />
            {/* Alias /transactions to /invoices */}
            <Route path="/transactions" element={<Navigate to="/invoices" replace />} />
            <Route path="/reports" element={<ReportsView />} />
            <Route 
              path="/superadmin" 
              element={
                <SuperAdminView 
                  onTenantSwitched={(tenant) => {
                    handleTenantSwitched(tenant);
                  }} 
                />
              } 
            />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/" element={<Navigate to={getDefaultPathForRole(currentUser)} replace />} />
            <Route path="*" element={<Navigate to={getDefaultPathForRole(currentUser)} replace />} />
          </Route>
        ) : (
          /* Redirect any unauthenticated path to /login */
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
