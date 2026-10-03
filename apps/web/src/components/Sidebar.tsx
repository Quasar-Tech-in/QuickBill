import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Package, 
  ShoppingBag, 
  Users, 
  BookOpen, 
  FileText, 
  BarChart3, 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  LogOut,
  Lock,
  Truck
} from 'lucide-react';
import { store } from '../services/store';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
}

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: any;
  badge?: string;
  isSuper?: boolean;
  roles?: string[];
  isLockedWhenStoreSuspended?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab: _activeTab, onTabChange, onLogout }) => {
  const location = useLocation();

  const activeTenant = store.getActiveTenant();
  const currentUser = store.getCurrentUser();
  const userRole = currentUser?.role || 'TENANT_ADMIN';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isStoreLocked = !isSuperAdmin && store.isStoreLocked();

  // Super Admin dedicated navigation items
  const superAdminNavItems: NavItem[] = [
    {
      id: 'dashboard',
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: 'Analytics',
      isSuper: true
    },
    {
      id: 'superadmin',
      path: '/superadmin',
      label: 'Super Admin Hub',
      icon: ShieldCheck,
      badge: 'Control Plane',
      isSuper: true
    },
    {
      id: 'workspace-preview',
      path: '/workspace-preview',
      label: 'Workspace Preview',
      icon: Sparkles,
      badge: 'Simulator',
      isSuper: true
    }
  ];

  // Tenant operations navigation items
  const tenantNavItems: NavItem[] = [
    { 
      id: 'dashboard', 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: ['TENANT_ADMIN', 'MANAGER'] 
    },
    { 
      id: 'reports', 
      path: '/reports', 
      label: 'Reports & Analytics', 
      icon: BarChart3, 
      roles: ['TENANT_ADMIN', 'MANAGER'] 
    },
    { 
      id: 'transactions', 
      path: '/invoices', 
      label: userRole === 'CASHIER' ? 'Counter Receipts' : 'Invoices & Bills', 
      icon: FileText, 
      roles: ['TENANT_ADMIN', 'MANAGER', 'CASHIER'] 
    },
    { 
      id: 'pos', 
      path: '/pos', 
      label: 'POS Billing', 
      icon: ReceiptText, 
      badge: 'Fast', 
      roles: ['TENANT_ADMIN', 'MANAGER', 'CASHIER'],
      isLockedWhenStoreSuspended: true
    },
    { 
      id: 'inventory', 
      path: '/inventory', 
      label: 'Inventory & Items', 
      icon: Package, 
      roles: ['TENANT_ADMIN', 'MANAGER'],
      isLockedWhenStoreSuspended: true
    },
    { 
      id: 'purchase-orders', 
      path: '/purchase-orders', 
      label: 'Purchase Orders', 
      icon: ShoppingBag, 
      roles: ['TENANT_ADMIN', 'MANAGER'],
      isLockedWhenStoreSuspended: true
    },
    { 
      id: 'shipping', 
      path: '/shipping', 
      label: 'Shipping & Dispatch', 
      icon: Truck, 
      roles: ['TENANT_ADMIN', 'MANAGER', 'CASHIER'],
      isLockedWhenStoreSuspended: true
    },
    { 
      id: 'parties', 
      path: '/parties', 
      label: userRole === 'CASHIER' ? 'Customer Directory' : 'Parties & CRM', 
      icon: Users, 
      roles: ['TENANT_ADMIN', 'MANAGER', 'CASHIER'],
      isLockedWhenStoreSuspended: true
    },
    { 
      id: 'ledger', 
      path: '/ledger', 
      label: 'Ledger & Expenses', 
      icon: BookOpen, 
      roles: ['TENANT_ADMIN', 'MANAGER', 'CASHIER'],
      isLockedWhenStoreSuspended: true
    },
    { 
      id: 'settings', 
      path: '/settings', 
      label: 'Settings & License', 
      icon: Settings, 
      roles: ['TENANT_ADMIN'] 
    },
  ];

  const navItems: NavItem[] = isSuperAdmin 
    ? superAdminNavItems 
    : tenantNavItems.filter(item => item.roles?.includes(userRole));

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">
          <Sparkles size={20} color="#ffffff" />
        </div>
        <div>
          <h1 className="sidebar-brand-title">QuickBill</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isItemLocked = isStoreLocked && item.isLockedWhenStoreSuspended;
          const isItemActive = 
            location.pathname === item.path || 
            (item.id === 'transactions' && location.pathname === '/transactions');

          return (
            <NavLink
              key={item.id}
              to={isItemLocked ? '#' : item.path}
              onClick={(e) => {
                if (isItemLocked) {
                  e.preventDefault();
                  return;
                }
                if (onTabChange) {
                  onTabChange(item.id);
                }
              }}
              className={({ isActive }) => `nav-link ${isActive || isItemActive ? 'active' : ''}`}
              title={isItemLocked ? 'Feature locked: Store is currently suspended / expired' : undefined}
              style={{ 
                width: '100%', 
                textDecoration: 'none',
                opacity: isItemLocked ? 0.55 : 1,
                cursor: isItemLocked ? 'not-allowed' : 'pointer'
              }}
            >
              <Icon size={18} color={item.isSuper ? '#a5b4fc' : undefined} />
              <span style={{ flex: 1, color: item.isSuper && !isItemActive ? '#c7d2fe' : undefined, fontWeight: item.isSuper ? 600 : undefined }}>
                {item.label}
              </span>
              {isItemLocked ? (
                <span
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <Lock size={10} /> Locked
                </span>
              ) : (
                item.badge && (
                  <span
                    style={{
                      backgroundColor: item.isSuper ? 'rgba(79, 70, 229, 0.4)' : 'rgba(239, 68, 68, 0.2)',
                      color: item.isSuper ? '#c7d2fe' : '#f87171',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {item.badge}
                  </span>
                )
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {onLogout && (
        <div className="sidebar-footer">
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  );
};
