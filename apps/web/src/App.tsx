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

import { AlertTriangle, RefreshCw, LogOut, Lock } from 'lucide-react';

// Helper to determine the landing route based on user role
const getDefaultPathForRole = (user: User | null): string => {
  if (!user) return '/login';
  if (user.role === 'SUPER_ADMIN') return '/superadmin';
  if (user.role === 'CASHIER') return '/pos';
  return '/dashboard';
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

  const isStaffNonAdmin = currentUser.role === 'MANAGER' || currentUser.role === 'CASHIER';
  const [activeLocationsList, setActiveLocationsList] = useState<any[]>(() => {
    return isStaffNonAdmin ? store.getLocations() : [];
  });
  const [isRefreshingLocations, setIsRefreshingLocations] = useState(false);

  // Sync and fetch locations on mount or tenant switch
  const checkActiveLocations = async () => {
    if (!isStaffNonAdmin) return;
    setIsRefreshingLocations(true);
    try {
      await store.fetchLocations();
      setActiveLocationsList(store.getLocations());
    } catch (e) {
      console.error('Failed to verify active locations:', e);
    } finally {
      setIsRefreshingLocations(false);
    }
  };

  useEffect(() => {
    if (isStaffNonAdmin) {
      checkActiveLocations();
    }
  }, [currentUser]);

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

  // If non-admin staff has 0 active branch locations available
  const isBranchLockedOut = isStaffNonAdmin && activeLocationsList.length === 0;

  return (
    <div className="app-layout" style={{ position: 'relative' }}>
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

      {/* Non-Admin Branch Deactivated Lockout Overlay */}
      {isBranchLockedOut && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: 20
          }}
        >
          <div 
            style={{
              maxWidth: 480,
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--neutral-200)',
              overflow: 'hidden',
              textAlign: 'center',
              animation: 'fadeIn 0.25s ease-out'
            }}
          >
            {/* Header Banner */}
            <div 
              style={{
                backgroundColor: 'var(--danger-50)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div 
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--danger-600)',
                  boxShadow: '0 0 0 6px rgba(239, 68, 68, 0.08)'
                }}
              >
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                  Store Branch Deactivated
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', margin: '4px 0 0 0', fontWeight: 600 }}>
                  Signed in as {currentUser.name} ({currentUser.role === 'CASHIER' ? 'Cashier' : 'Manager'})
                </p>
              </div>
            </div>

            {/* Lockout Details */}
            <div style={{ padding: '24px 24px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--neutral-700)', lineHeight: 1.55, margin: 0 }}>
                Your assigned store branch outlet has been <strong>deactivated</strong> by the store administrator. Access to billing, POS checkout, inventory lookups, and transactions is restricted while the branch is inactive.
              </p>

              <div 
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  backgroundColor: 'var(--neutral-50)',
                  border: '1px solid var(--neutral-200)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left'
                }}
              >
                <Lock size={18} color="var(--primary-600)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--neutral-700)', fontWeight: 500, lineHeight: 1.4 }}>
                  Please reach out to the <strong>Store Owner or Administrator</strong> to reactivate your branch location.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div 
              style={{
                padding: '16px 24px 24px 24px',
                display: 'flex',
                gap: 12,
                justifyContent: 'center'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={checkActiveLocations}
                disabled={isRefreshingLocations}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}
              >
                <RefreshCw size={15} className={isRefreshingLocations ? 'spin' : ''} />
                <span>{isRefreshingLocations ? 'Checking...' : 'Check Status'}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={onLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', color: 'var(--danger-600)' }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
