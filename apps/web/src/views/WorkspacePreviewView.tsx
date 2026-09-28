import React, { useState, useEffect } from 'react';
import { 
  Building, 
  ShieldCheck, 
  Smartphone, 
  Tablet, 
  Monitor, 
  User, 
  Users, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  Sparkles, 
  Search, 
  Filter, 
  Eye, 
  Layers, 
  Database, 
  Settings, 
  Receipt, 
  BookOpen, 
  BarChart3, 
  RefreshCw, 
  Lock, 
  Unlock,
  AlertTriangle,
  Zap,
  Tag,
  Check
} from 'lucide-react';
import { store } from '../services/store';
import { Tenant, PlanTier, UserRole } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface WorkspacePreviewViewProps {
  onTenantSwitched?: (tenant: Tenant) => void;
}

export const WorkspacePreviewView: React.FC<WorkspacePreviewViewProps> = ({ onTenantSwitched }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenants = store.getTenants();
  
  const initialTenantId = searchParams.get('tenantId') || store.getActiveTenant()?.id || tenants[0]?.id;
  const [selectedTenantId, setSelectedTenantId] = useState<string>(initialTenantId);
  const [selectedRole, setSelectedRole] = useState<UserRole>('TENANT_ADMIN');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewTab, setPreviewTab] = useState<'dashboard' | 'pos' | 'inventory' | 'parties' | 'features'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cart simulation for POS preview
  const [testCart, setTestCart] = useState<Array<{ name: string; price: number; qty: number }>>([
    { name: 'Basmati Rice 5kg', price: 420, qty: 2 },
    { name: 'Sunflower Oil 1L', price: 165, qty: 1 }
  ]);

  const currentTenant = tenants.find(t => t.id === selectedTenantId) || tenants[0] || store.getActiveTenant();
  const sub = currentTenant.subscription;
  const daysRemaining = sub?.daysRemaining ?? 365;

  const handleSelectTenant = (id: string) => {
    setSelectedTenantId(id);
    const t = tenants.find(item => item.id === id);
    if (t && onTenantSwitched) {
      store.switchActiveTenant(id);
      onTenantSwitched(t);
    }
  };

  const handleLaunchImpersonation = () => {
    store.switchActiveTenant(currentTenant.id);
    if (onTenantSwitched) {
      onTenantSwitched(currentTenant);
    }
    navigate('/dashboard');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await store.fetchTenants();
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Plan badges styling
  const getPlanBadge = (plan: PlanTier | string) => {
    switch (plan) {
      case 'ENTERPRISE':
        return { bg: '#fdf4ff', color: '#9333ea', border: '#f0abfc', label: 'Enterprise Hypermarket' };
      case 'PROFESSIONAL':
        return { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe', label: 'Professional Multi-Store' };
      case 'CUSTOM':
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'Custom Tailored' };
      default:
        return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'Starter Standard' };
    }
  };

  const planStyle = getPlanBadge(currentTenant.plan);

  // Role permissions matrix calculation
  const rolePermissions: Record<string, {
    title: string;
    desc: string;
    allowedRoutes: string[];
    canCreateUsers: boolean;
    canCreateLocations: boolean;
    canViewProfit: boolean;
    canAdjustStock: boolean;
    canDeleteInvoices: boolean;
  }> = {
    SUPER_ADMIN: {
      title: 'Global Super Admin',
      desc: 'System root privilege across all multi-tenant stores, clusters, and subscription licenses.',
      allowedRoutes: ['Super Admin Hub', 'Workspace Preview', 'Store Control Plane'],
      canCreateUsers: true,
      canCreateLocations: true,
      canViewProfit: true,
      canAdjustStock: true,
      canDeleteInvoices: true,
    },
    TENANT_ADMIN: {
      title: 'Store Owner / Admin',
      desc: 'Full unrestricted governance, multi-location management, staff permissions, financial ledgers, and database configurations.',
      allowedRoutes: ['Dashboard', 'POS Billing', 'Inventory & Items', 'Purchase Orders', 'Parties & CRM', 'Ledger & Expenses', 'Invoices & Bills', 'Reports', 'Settings & License'],
      canCreateUsers: true,
      canCreateLocations: true,
      canViewProfit: true,
      canAdjustStock: true,
      canDeleteInvoices: false,
    },
    MANAGER: {
      title: 'Store Manager',
      desc: 'Operational oversight over billing, inventory management, purchase orders, customer CRM, and expense entries.',
      allowedRoutes: ['Dashboard', 'POS Billing', 'Inventory & Items', 'Purchase Orders', 'Parties & CRM', 'Ledger & Expenses', 'Invoices & Bills', 'Reports'],
      canCreateUsers: false,
      canCreateLocations: false,
      canViewProfit: true,
      canAdjustStock: true,
      canDeleteInvoices: false,
    },
    CASHIER: {
      title: 'Cashier / Counter Staff',
      desc: 'High-speed counter checkout, receipt printing, customer directory lookup, and personal shift receipt logs.',
      allowedRoutes: ['POS Billing', 'Customer Directory', 'Counter Receipts', 'Ledger Entries'],
      canCreateUsers: false,
      canCreateLocations: false,
      canViewProfit: false,
      canAdjustStock: false,
      canDeleteInvoices: false,
    }
  };

  const activeRoleData = rolePermissions[selectedRole] || rolePermissions.TENANT_ADMIN;

  // Device frame styles
  const getDeviceFrameStyle = () => {
    switch (deviceMode) {
      case 'mobile':
        return {
          width: '390px',
          minHeight: '740px',
          borderRadius: '36px',
          border: '12px solid #1e293b',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          margin: '0 auto',
          backgroundColor: '#ffffff'
        };
      case 'tablet':
        return {
          width: '100%',
          maxWidth: '860px',
          minHeight: '680px',
          borderRadius: '24px',
          border: '10px solid #1e293b',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          margin: '0 auto',
          backgroundColor: '#ffffff'
        };
      default:
        return {
          width: '100%',
          minHeight: '620px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          backgroundColor: '#ffffff'
        };
    }
  };

  const cartSubtotal = testCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartGst = cartSubtotal * 0.18;
  const cartGrandTotal = Math.round(cartSubtotal + cartGst);

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* Top Hero Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          borderRadius: '16px',
          padding: '24px 32px',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(79, 70, 229, 0.4)'
            }}
          >
            <Sparkles size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Multi-Tenant Workspace Preview
              </h1>
              <span 
                style={{
                  backgroundColor: 'rgba(79, 70, 229, 0.35)',
                  border: '1px solid rgba(165, 180, 252, 0.4)',
                  color: '#c7d2fe',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  textTransform: 'uppercase'
                }}
              >
                Safe Sandbox Simulator
              </span>
            </div>
            <p style={{ fontSize: '0.86rem', color: '#cbd5e1', margin: '4px 0 0 0' }}>
              Inspect and simulate any tenant store experience, test responsive layouts across devices, and audit role-based access without altering production ledgers.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button" 
            className="btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              padding: '8px 16px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            <span>Sync Data</span>
          </button>

          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleLaunchImpersonation}
            style={{
              backgroundColor: '#4f46e5',
              border: 'none',
              padding: '8px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
            }}
          >
            <span>Launch Full Workspace</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Interactive Controls Bar: Store Picker, Persona Selector & Device Emulators */}
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}
      >
        {/* Left: Tenant Store Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} color="#4f46e5" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Active Store:</span>
          </div>

          <select
            value={selectedTenantId}
            onChange={(e) => handleSelectTenant(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: '#0f172a',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '220px'
            }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.plan} • {t.slug})
              </option>
            ))}
          </select>

          {/* Plan & Expiry Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span 
              style={{
                backgroundColor: planStyle.bg,
                color: planStyle.color,
                border: `1px solid ${planStyle.border}`,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              {planStyle.label}
            </span>

            <span 
              style={{
                backgroundColor: daysRemaining < 0 ? '#fef2f2' : daysRemaining <= 14 ? '#fffbeb' : '#ecfdf5',
                color: daysRemaining < 0 ? '#991b1b' : daysRemaining <= 14 ? '#92400e' : '#065f46',
                border: `1px solid ${daysRemaining < 0 ? '#fca5a5' : daysRemaining <= 14 ? '#fde68a' : '#a7f3d0'}`,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Clock size={12} />
              <span>{daysRemaining < 0 ? 'Expired' : `${daysRemaining}d Left`}</span>
            </span>
          </div>
        </div>

        {/* Center: Role Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', padding: '0 8px' }}>Role View:</span>
          
          {(['TENANT_ADMIN', 'MANAGER', 'CASHIER'] as UserRole[]).map((r) => {
            const isSelected = selectedRole === r;
            const labels: Record<UserRole, string> = {
              SUPER_ADMIN: 'Super Admin',
              TENANT_ADMIN: 'Owner (Admin)',
              MANAGER: 'Manager',
              CASHIER: 'Cashier'
            };

            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? 700 : 600,
                  backgroundColor: isSelected ? '#4f46e5' : 'transparent',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 2px 6px rgba(79, 70, 229, 0.3)' : 'none'
                }}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>

        {/* Right: Device Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            title="Desktop Mode (Full Width)"
            onClick={() => setDeviceMode('desktop')}
            style={{
              border: 'none',
              padding: '6px 10px',
              borderRadius: '7px',
              backgroundColor: deviceMode === 'desktop' ? '#ffffff' : 'transparent',
              color: deviceMode === 'desktop' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: deviceMode === 'desktop' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.76rem',
              fontWeight: 600
            }}
          >
            <Monitor size={15} />
            <span>Desktop</span>
          </button>

          <button
            type="button"
            title="Tablet POS Mode (860px)"
            onClick={() => setDeviceMode('tablet')}
            style={{
              border: 'none',
              padding: '6px 10px',
              borderRadius: '7px',
              backgroundColor: deviceMode === 'tablet' ? '#ffffff' : 'transparent',
              color: deviceMode === 'tablet' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: deviceMode === 'tablet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.76rem',
              fontWeight: 600
            }}
          >
            <Tablet size={15} />
            <span>Tablet POS</span>
          </button>

          <button
            type="button"
            title="Mobile Terminal Mode (390px)"
            onClick={() => setDeviceMode('mobile')}
            style={{
              border: 'none',
              padding: '6px 10px',
              borderRadius: '7px',
              backgroundColor: deviceMode === 'mobile' ? '#ffffff' : 'transparent',
              color: deviceMode === 'mobile' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: deviceMode === 'mobile' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.76rem',
              fontWeight: 600
            }}
          >
            <Smartphone size={15} />
            <span>Mobile</span>
          </button>
        </div>
      </div>

      {/* Role Access Ribbon & Permissions Overview */}
      <div 
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 34, height: 34, borderRadius: '8px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                Simulating: {activeRoleData.title}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>— {activeRoleData.desc}</span>
            </div>
          </div>
        </div>

        {/* Enabled Nav Modules for this Role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Visible Modules:</span>
          {activeRoleData.allowedRoutes.map((m: string) => (
            <span 
              key={m}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '3px 8px',
                borderRadius: '5px',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Check size={11} color="#10b981" />
              <span>{m}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Device Emulation Outer Container */}
      <div style={{ backgroundColor: '#f1f5f9', padding: deviceMode === 'desktop' ? '0' : '24px', borderRadius: '16px', marginBottom: '24px' }}>
        <div style={getDeviceFrameStyle()}>
          
          {/* Mock Store Window Header */}
          <div 
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #334155'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginLeft: '6px' }}>
                {currentTenant.name} • {currentTenant.slug}.quickbill.app
              </span>
            </div>

            {/* Sandbox Tab Switcher inside the device */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setPreviewTab('dashboard')}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: previewTab === 'dashboard' ? '#312e81' : 'transparent',
                  color: previewTab === 'dashboard' ? '#c7d2fe' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('pos')}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: previewTab === 'pos' ? '#312e81' : 'transparent',
                  color: previewTab === 'pos' ? '#c7d2fe' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                POS Counter
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('inventory')}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: previewTab === 'inventory' ? '#312e81' : 'transparent',
                  color: previewTab === 'inventory' ? '#c7d2fe' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                Catalog & Stock
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('features')}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: previewTab === 'features' ? '#312e81' : 'transparent',
                  color: previewTab === 'features' ? '#c7d2fe' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                Plan Limits
              </button>
            </div>
          </div>

          {/* Mock Window Content */}
          <div style={{ padding: '20px', backgroundColor: '#ffffff', minHeight: '520px' }}>
            
            {/* TAB 1: DASHBOARD PREVIEW */}
            {previewTab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Store Operational Overview
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>
                      Live metrics for {currentTenant.name} ({currentTenant.address || 'Main Branch'})
                    </p>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    ● POS Register Open
                  </span>
                </div>

                {/* Metric Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: deviceMode === 'mobile' ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Today's Sales</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>₹28,450</div>
                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>↑ +14.2% from yesterday</div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Invoices Generated</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>42</div>
                    <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 600 }}>Avg. ₹677 / bill</div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Low Stock Items</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e11d48', margin: '4px 0' }}>3 Alerts</div>
                    <div style={{ fontSize: '0.72rem', color: '#e11d48', fontWeight: 600 }}>Reorder required</div>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cash Register Balance</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>₹14,800</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Cash & UPI reconciled</div>
                  </div>
                </div>

                {/* Recent Invoices Table Preview */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
                    Recent Billed Invoices
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#ffffff', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                        <th style={{ padding: '8px 16px' }}>Invoice #</th>
                        <th style={{ padding: '8px 16px' }}>Customer</th>
                        <th style={{ padding: '8px 16px' }}>Items</th>
                        <th style={{ padding: '8px 16px' }}>Amount</th>
                        <th style={{ padding: '8px 16px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 16px', fontWeight: 700, color: '#4f46e5' }}>INV-2026-0891</td>
                        <td style={{ padding: '8px 16px' }}>Walk-in Retail</td>
                        <td style={{ padding: '8px 16px' }}>3 items</td>
                        <td style={{ padding: '8px 16px', fontWeight: 700 }}>₹1,250</td>
                        <td style={{ padding: '8px 16px' }}><span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.7rem' }}>PAID</span></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 16px', fontWeight: 700, color: '#4f46e5' }}>INV-2026-0890</td>
                        <td style={{ padding: '8px 16px' }}>Rajesh Sharma</td>
                        <td style={{ padding: '8px 16px' }}>5 items</td>
                        <td style={{ padding: '8px 16px', fontWeight: 700 }}>₹3,400</td>
                        <td style={{ padding: '8px 16px' }}><span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.7rem' }}>PAID</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: POS COUNTER SIMULATOR */}
            {previewTab === 'pos' && (
              <div style={{ display: 'grid', gridTemplateColumns: deviceMode === 'mobile' ? '1fr' : '1.2fr 1fr', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                {/* Left: Product Selector */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Quick Product Scan</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Simulated Barcode Scanner</span>
                  </div>

                  <div style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', display: 'grid', gap: '8px' }}>
                    {[
                      { name: 'Basmati Rice 5kg', price: 420 },
                      { name: 'Sunflower Oil 1L', price: 165 },
                      { name: 'Aashirvaad Atta 10kg', price: 440 },
                      { name: 'Tata Salt 1kg', price: 28 },
                      { name: 'Toor Dal 1kg', price: 175 },
                      { name: 'Amul Butter 500g', price: 275 }
                    ].map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          const existing = testCart.find(c => c.name === item.name);
                          if (existing) {
                            setTestCart(testCart.map(c => c.name === item.name ? { ...c, qty: c.qty + 1 } : c));
                          } else {
                            setTestCart([...testCart, { name: item.name, price: item.price, qty: 1 }]);
                          }
                        }}
                        style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '10px',
                          textAlign: 'left',
                          backgroundColor: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>{item.name}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4f46e5' }}>₹{item.price}</span>
                        <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>+ Add to Bill</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Simulated Receipt Cart */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', backgroundColor: '#fcfcfd', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Active Bill #{Math.floor(Math.random()*9000 + 1000)}</span>
                      <button 
                        type="button" 
                        onClick={() => setTestCart([])}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Clear Cart
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                      {testCart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.8rem' }}>Cart is empty. Click products on the left.</div>
                      ) : (
                        testCart.map((c, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.name}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.qty} × ₹{c.price}</div>
                            </div>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{c.price * c.qty}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Calculations */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Subtotal:</span>
                      <span>₹{cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>GST (18%):</span>
                      <span>₹{cartGst.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: '#0f172a', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                      <span>Grand Total:</span>
                      <span style={{ color: '#4f46e5' }}>₹{cartGrandTotal}</span>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-primary"
                      style={{ marginTop: '10px', width: '100%', padding: '10px', fontSize: '0.84rem', fontWeight: 700 }}
                    >
                      ⚡ Quick Checkout (Cash / UPI)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: INVENTORY CATALOG PREVIEW */}
            {previewTab === 'inventory' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>Catalog & Multi-Location Stock</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>34 Total Products Registered</span>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px' }}>Product</th>
                        <th style={{ padding: '8px 12px' }}>Category</th>
                        <th style={{ padding: '8px 12px' }}>Cost</th>
                        <th style={{ padding: '8px 12px' }}>Selling Price</th>
                        <th style={{ padding: '8px 12px' }}>Stock Level</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>Basmati Rice 5kg</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Grains</span></td>
                        <td style={{ padding: '8px 12px' }}>₹340</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#4f46e5' }}>₹420</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>48 Units</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.7rem' }}>IN STOCK</span></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>Sunflower Oil 1L</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Oils</span></td>
                        <td style={{ padding: '8px 12px' }}>₹130</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#4f46e5' }}>₹165</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#e11d48' }}>4 Units (Low)</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ backgroundColor: '#fff1f2', color: '#e11d48', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.7rem' }}>LOW STOCK</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: PLAN LIMITS & CAPABILITIES */}
            {previewTab === 'features' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>Subscription Quotas & Entitlements</span>
                  <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 700 }}>Tier: {currentTenant.plan}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Staff User Quota</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                      2 / {sub?.maxUsers ?? 5} Users
                    </div>
                    <div style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(2 / (sub?.maxUsers || 5)) * 100}%`, height: '100%', backgroundColor: '#4f46e5' }} />
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Branch Locations Quota</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                      1 / {sub?.maxLocations ?? 3} Branches
                    </div>
                    <div style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(1 / (sub?.maxLocations || 3)) * 100}%`, height: '100%', backgroundColor: '#10b981' }} />
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Database Cluster</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                      {currentTenant.databaseConfig?.isolationMode === 'DEDICATED_DATABASE' ? 'Isolated Tenant DB' : 'Shared Multi-Tenant'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>● Operational (Ping: 4ms)</div>
                  </div>
                </div>

                {/* Feature Chips */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', backgroundColor: '#ffffff' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Active Feature Unlocks</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      'Fast POS Checkout',
                      'Multi-Location Realtime Sync',
                      'A4 & Thermal 80mm PDF Invoicing',
                      'WhatsApp / SMS Invoice Sharing',
                      'Customer CRM & Khata Ledger',
                      'Stock Low-Level Alerts',
                      'Automated Round-off Engine',
                      'Multi-Payment Split Allocation'
                    ].map((f) => (
                      <span 
                        key={f} 
                        style={{
                          backgroundColor: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <CheckCircle2 size={13} color="#10b981" />
                        <span>{f}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

    </div>
  );
};
