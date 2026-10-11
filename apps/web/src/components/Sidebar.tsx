import React, { useState, useEffect } from 'react';
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
  Building,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { store } from '../services/store';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab: _activeTab, 
  onTabChange: _onTabChange, 
  onLogout,
  isCollapsed: propIsCollapsed,
  onToggleCollapse
}) => {
  const location = useLocation();
  const [, setTick] = useState(0);

  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('quickbill_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(prev => {
        const next = !prev;
        try {
          localStorage.setItem('quickbill_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick(t => t + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const activeTenant = store.getActiveTenant();
  const currentUser = store.getCurrentUser();
  const userRole = currentUser?.role || 'TENANT_ADMIN';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isStoreLocked = !isSuperAdmin && store.isStoreLocked();

  const brandTitle = isSuperAdmin 
    ? 'QuickBill Control' 
    : (activeTenant?.name || currentUser?.tenantName || 'Store Portal');
  const brandTagline = !isSuperAdmin ? activeTenant?.tagline : undefined;

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
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div 
          className="sidebar-brand-icon" 
          style={{ 
            overflow: 'hidden', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: isCollapsed ? 'pointer' : 'default',
            flexShrink: 0
          }}
          title={isCollapsed ? `${brandTitle} (Click to expand sidebar)` : brandTitle}
          onClick={isCollapsed ? toggleCollapse : undefined}
        >
          {!isSuperAdmin && activeTenant?.logoUrl ? (
            <img 
              src={activeTenant.logoUrl} 
              alt="Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : isSuperAdmin ? (
            <Sparkles size={20} color="#ffffff" />
          ) : (
            <Building size={20} color="#ffffff" />
          )}
        </div>

        {!isCollapsed && (
          <>
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <h1 className="sidebar-brand-title" style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={brandTitle}>
                {brandTitle}
              </h1>
              {brandTagline && (
                <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {brandTagline}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleCollapse}
              className="sidebar-toggle-btn"
              title="Minimize sidebar (Ctrl+B)"
              aria-label="Minimize sidebar"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
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
              }}
              className={({ isActive }) => `nav-link ${isActive || isItemActive ? 'active' : ''}`}
              title={isCollapsed 
                ? `${item.label}${isItemLocked ? ' (Feature locked: Store suspended)' : ''}`
                : (isItemLocked ? 'Feature locked: Store is currently suspended / expired' : undefined)
              }
              style={{ 
                width: isCollapsed ? 44 : '100%', 
                textDecoration: 'none',
                opacity: isItemLocked ? 0.55 : 1,
                cursor: isItemLocked ? 'not-allowed' : 'pointer',
                position: 'relative'
              }}
            >
              <Icon size={18} color={item.isSuper ? '#a5b4fc' : undefined} />
              {!isCollapsed && (
                <span style={{ flex: 1, color: item.isSuper && !isItemActive ? '#c7d2fe' : undefined, fontWeight: item.isSuper ? 600 : undefined }}>
                  {item.label}
                </span>
              )}
              {isCollapsed ? (
                isItemLocked && (
                  <span 
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 4px rgba(0,0,0,0.4)'
                    }}
                  />
                )
              ) : (
                isItemLocked ? (
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
                )
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Toggle Collapse/Expand Button in Footer Rail */}
        <button
          type="button"
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Minimize sidebar (Ctrl+B)"}
          aria-label={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
          style={{
            width: isCollapsed ? 44 : '100%',
            height: 36,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: isCollapsed ? 0 : '0 12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md)',
            color: '#94a3b8',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!isCollapsed && <span>Minimize Sidebar</span>}
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            aria-label="Sign Out"
            style={{
              width: isCollapsed ? 44 : '100%',
              height: 36,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: isCollapsed ? 0 : '8px 12px',
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
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
