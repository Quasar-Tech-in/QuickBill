import React from 'react';
import { Plus, Database, Building, ShieldCheck } from 'lucide-react';
import { store } from '../services/store';
import { Tenant } from '../types';

interface HeaderProps {
  title: string;
  isBackendOnline: boolean;
  onQuickSale: () => void;
  onNavigate: (tab: string) => void;
  onTenantChange?: (tenant: Tenant) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  isBackendOnline, 
  onQuickSale, 
  onNavigate,
  onTenantChange 
}) => {
  const tenants = store.getTenants();
  const activeTenant = store.getActiveTenant();

  const handleSelectTenant = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = store.switchActiveTenant(e.target.value);
    if (selected && onTenantChange) {
      onTenantChange(selected);
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <h2 className="header-title">{title}</h2>

        {/* Store Context Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, backgroundColor: 'var(--neutral-100)', padding: '4px 10px', borderRadius: 'var(--radius-md)' }}>
          <Building size={14} color="var(--primary-600)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)' }}>Store:</span>
          <select
            value={activeTenant.id}
            onChange={handleSelectTenant}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--neutral-900)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="header-right">
        {/* Super Admin Control Plane Shortcut */}
        <button
          onClick={() => onNavigate('superadmin')}
          className="btn btn-secondary btn-sm"
          style={{
            backgroundColor: '#ede9fe',
            color: '#6d28d9',
            borderColor: '#ddd6fe',
            fontSize: '0.78rem',
            padding: '5px 10px',
          }}
          title="Open Super Admin Multi-Tenant Governance"
        >
          <ShieldCheck size={14} />
          <span>Super Admin</span>
        </button>

        {/* Backend & DB Status indicator */}
        <div className={`status-pill ${isBackendOnline ? 'online' : 'offline'}`} title="MongoDB & FastAPI Connection Status">
          <span className="pulse-dot" />
          <Database size={13} style={{ marginRight: 2 }} />
          <span>{isBackendOnline ? 'FastAPI & DB Connected' : 'Local Standalone Mode'}</span>
        </div>

        {/* Quick Sale POS Action */}
        <button className="btn btn-primary btn-sm" onClick={onQuickSale}>
          <Plus size={16} />
          <span>+ New Sale</span>
        </button>
      </div>
    </header>
  );
};
