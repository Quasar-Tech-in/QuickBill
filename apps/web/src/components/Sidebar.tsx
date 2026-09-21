import React from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Package, 
  Users, 
  FileText, 
  BarChart3, 
  Settings, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { store } from '../services/store';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const activeTenant = store.getActiveTenant();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS Billing', icon: ReceiptText, badge: 'Fast' },
    { id: 'inventory', label: 'Inventory & Items', icon: Package },
    { id: 'parties', label: 'Parties & Ledger', icon: Users },
    { id: 'transactions', label: 'Invoices & Bills', icon: FileText },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'superadmin', label: 'Super Admin', icon: ShieldCheck, badge: 'Multi-Tenant', isSuper: true },
    { id: 'settings', label: 'Settings & DB', icon: Settings },
  ];

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
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
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
          <div className="business-avatar">
            {activeTenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {activeTenant.name}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
              Tenant: {activeTenant.slug}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
