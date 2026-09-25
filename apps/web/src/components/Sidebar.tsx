import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Package, 
  Users, 
  BookOpen, 
  FileText, 
  BarChart3, 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  LogOut 
} from 'lucide-react';
import { store } from '../services/store';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTenant = store.getActiveTenant();
  const currentUser = store.getCurrentUser();
  const userRole = currentUser?.role || 'TENANT_ADMIN';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const allNavItems = [
    { 
      id: 'dashboard', 
      path: '/dashboard',
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'] 
    },
    { 
      id: 'pos', 
      path: '/pos',
      label: 'POS Billing', 
      icon: ReceiptText, 
      badge: 'Fast', 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CASHIER'] 
    },
    { 
      id: 'inventory', 
      path: '/inventory',
      label: 'Inventory & Items', 
      icon: Package, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'] 
    },
    { 
      id: 'parties', 
      path: '/parties',
      label: userRole === 'CASHIER' ? 'Customer Directory' : 'Parties & CRM', 
      icon: Users, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CASHIER'] 
    },
    { 
      id: 'ledger', 
      path: '/ledger',
      label: 'Ledger & Expenses', 
      icon: BookOpen, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CASHIER'] 
    },
    { 
      id: 'transactions', 
      path: '/invoices',
      label: userRole === 'CASHIER' ? 'Counter Receipts' : 'Invoices & Bills', 
      icon: FileText, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CASHIER'] 
    },
    { 
      id: 'reports', 
      path: '/reports',
      label: 'Reports & Analytics', 
      icon: BarChart3, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER'] 
    },
    { 
      id: 'superadmin', 
      path: '/superadmin',
      label: 'Super Admin', 
      icon: ShieldCheck, 
      badge: 'Multi-Tenant', 
      isSuper: true, 
      roles: ['SUPER_ADMIN'] 
    },
    { 
      id: 'settings', 
      path: '/settings',
      label: 'Settings & DB', 
      icon: Settings, 
      roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] 
    },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(userRole));

  const handleItemClick = (item: typeof allNavItems[0]) => {
    if (onTabChange) {
      onTabChange(item.id);
    }
    navigate(item.path);
  };

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
          const isActive = 
            location.pathname === item.path || 
            (item.id === 'transactions' && location.pathname === '/transactions') ||
            (activeTab && (activeTab === item.id || (activeTab === 'invoices' && item.id === 'transactions')));

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`nav-link ${isActive ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: isActive ? undefined : 'transparent', textAlign: 'left' }}
            >
              <Icon size={18} color={item.isSuper ? '#a5b4fc' : undefined} />
              <span style={{ flex: 1, color: item.isSuper && !isActive ? '#c7d2fe' : undefined, fontWeight: item.isSuper ? 600 : undefined }}>
                {item.label}
              </span>
              {item.badge && (
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
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="business-pill">
          <div className="business-avatar" style={{ backgroundColor: isSuperAdmin ? '#7c3aed' : undefined }}>
            {isSuperAdmin ? '⚡' : activeTenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {isSuperAdmin ? 'Root Super Admin' : activeTenant.name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ 
                fontSize: '0.68rem', 
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                backgroundColor: userRole === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.4)' :
                                 userRole === 'TENANT_ADMIN' ? 'rgba(79, 70, 229, 0.4)' :
                                 userRole === 'MANAGER' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                color: userRole === 'SUPER_ADMIN' ? '#d8b4fe' :
                       userRole === 'TENANT_ADMIN' ? '#c7d2fe' :
                       userRole === 'MANAGER' ? '#a7f3d0' : '#fde68a'
              }}>
                {userRole === 'SUPER_ADMIN' ? '⚡ Super Admin' :
                 userRole === 'TENANT_ADMIN' ? '👑 Store Admin' :
                 userRole === 'MANAGER' ? '🏪 Manager' : '🧾 Cashier'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>
                {isSuperAdmin ? 'Platform' : activeTenant.slug}
              </span>
            </div>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 10,
              padding: '8px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
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
        )}
      </div>
    </aside>
  );
};
