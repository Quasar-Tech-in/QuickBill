import React, { useState, useRef, useEffect } from 'react';
import { 
  Building, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon,
  ChevronDown,
  Settings,
  Receipt,
  Database,
  Check,
  MapPin,
  AlertTriangle,
  X
} from 'lucide-react';
import { store } from '../services/store';
import { Tenant, StoreLocation } from '../types';

interface HeaderProps {
  title?: string;
  isBackendOnline: boolean;
  onQuickSale: () => void;
  onNavigate: (tab: string) => void;
  onTenantChange?: (tenant: Tenant) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  title: _title, 
  isBackendOnline, 
  onQuickSale: _onQuickSale, 
  onNavigate,
  onTenantChange,
  onLogout
}) => {
  const tenants = store.getTenants();
  const activeTenant = store.getActiveTenant();
  const currentUser = store.getCurrentUser();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isStoreAdmin = currentUser?.role === 'TENANT_ADMIN';

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);

  const [locations, setLocations] = useState<StoreLocation[]>(store.getLocations());
  const [activeLocation, setActiveLocationState] = useState<StoreLocation>(store.getActiveLocation());
  const [pendingLocationChange, setPendingLocationChange] = useState<StoreLocation | null>(null);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const tenantMenuRef = useRef<HTMLDivElement>(null);
  const locationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocations(store.getLocations());
    setActiveLocationState(store.getActiveLocation());
  }, [currentUser, activeTenant]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(event.target as Node)) {
        setIsTenantMenuOpen(false);
      }
      if (locationMenuRef.current && !locationMenuRef.current.contains(event.target as Node)) {
        setIsLocationMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTenant = (tenantId: string) => {
    const selected = store.switchActiveTenant(tenantId);
    if (selected && onTenantChange) {
      onTenantChange(selected);
    }
    setIsTenantMenuOpen(false);
  };

  const handleSwitchLocation = (loc: StoreLocation) => {
    setIsLocationMenuOpen(false);
    if (loc.id === activeLocation.id) return;

    const currentCart = store.getPosCart();
    if (currentCart && currentCart.length > 0) {
      // Cart is not empty: prompt user with warning popup
      setPendingLocationChange(loc);
    } else {
      // Cart is empty: switch immediately
      store.setActiveLocation(loc);
      setActiveLocationState(loc);
    }
  };

  const handleConfirmLocationChange = () => {
    if (pendingLocationChange) {
      store.setActiveLocation(pendingLocationChange);
      setActiveLocationState(pendingLocationChange);
      setPendingLocationChange(null);
    }
  };

  const handleCancelLocationChange = () => {
    setPendingLocationChange(null);
  };

  const canSwitchLocation = isSuperAdmin || isStoreAdmin || locations.length > 1;

  return (
    <header className="top-header">
      <div className="header-left">
        {/* Store Context Display: Interactive Switcher for SuperAdmin, Static Isolated Badge for Tenants */}
        {isSuperAdmin ? (
          <div className="header-tenant-selector" ref={tenantMenuRef}>
            <button
              type="button"
              className={`tenant-select-trigger ${isTenantMenuOpen ? 'open' : ''}`}
              onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
              title="Switch Active Store / Business Tenant (Super Admin Only)"
            >
              <div className="tenant-trigger-icon">
                <Building size={14} />
              </div>
              <div className="tenant-trigger-text">
                <span className="tenant-trigger-label">Store</span>
                <span className="tenant-trigger-name">{activeTenant.name}</span>
              </div>
              <span className="tenant-slug-badge">{activeTenant.slug}</span>
              <ChevronDown size={14} className={`chevron-indicator ${isTenantMenuOpen ? 'rotated' : ''}`} />
            </button>

            {/* Tenant Dropdown Popover */}
            {isTenantMenuOpen && (
              <div className="tenant-dropdown-popover">
                <div className="tenant-popover-header">
                  <span className="popover-heading">Switch Active Business Store</span>
                  <span className="popover-count">{tenants.length} provisioned</span>
                </div>
                <div className="tenant-list-scroll">
                  {tenants.map((t) => {
                    const isCurrent = t.id === activeTenant.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`tenant-list-item ${isCurrent ? 'selected' : ''}`}
                        onClick={() => handleSelectTenant(t.id)}
                      >
                        <div className="tenant-item-avatar">
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="tenant-item-details">
                          <div className="tenant-item-name-row">
                            <span className="tenant-item-name">{t.name}</span>
                            {isCurrent && <Check size={14} className="tenant-check-icon" />}
                          </div>
                          <div className="tenant-item-meta">
                            <span className="tenant-item-slug">{t.slug}</span>
                            <span className="tenant-item-db">
                              {t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? '⚡ Cluster' :
                               t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? '🗄️ Isolated DB' : '🔗 Shared'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="tenant-popover-footer">
                  <button 
                    className="popover-manage-link"
                    onClick={() => {
                      setIsTenantMenuOpen(false);
                      onNavigate('superadmin');
                    }}
                  >
                    <ShieldCheck size={13} />
                    <span>Manage All Stores in Governance Plane</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Static Tenant Badge (Isolated Customer Store View - No Cross-tenant Leaks) */
          <div className="header-tenant-badge-static" title={`Logged in to isolated store: ${activeTenant.name}`}>
            <div className="tenant-static-icon">
              <Building size={14} />
            </div>
            <div className="tenant-static-text">
              <span className="tenant-static-label">Store</span>
              <span className="tenant-static-name">{activeTenant.name}</span>
            </div>
            <span className="tenant-slug-badge">{activeTenant.slug}</span>
          </div>
        )}

        {/* Visual Separator */}
        {!isSuperAdmin && (
          <div style={{ width: 1, height: 26, backgroundColor: 'var(--neutral-200)', margin: '0 4px' }} />
        )}

        {/* Location / Branch Context Badge & Dropdown */}
        {!isSuperAdmin && (
          <div className="header-location-selector" ref={locationMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="tenant-static-icon-btn"
              onClick={() => canSwitchLocation && setIsLocationMenuOpen(!isLocationMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--neutral-50)',
                border: '1px solid var(--neutral-200)',
                cursor: canSwitchLocation ? 'pointer' : 'default',
              }}
              title={canSwitchLocation ? "Click to switch active branch location" : "Current assigned location"}
            >
              <MapPin size={13} color="var(--primary-600)" />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--neutral-500)', lineHeight: 1 }}>
                  Branch
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
                  {activeLocation.name}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: 4, background: 'var(--neutral-200)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                {activeLocation.code}
              </span>
              {canSwitchLocation && (
                <ChevronDown size={13} color="var(--neutral-400)" style={{ transform: isLocationMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              )}
            </button>

            {/* Location Switcher Dropdown */}
            {isLocationMenuOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: 260,
                  background: 'white',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xl)',
                  border: '1px solid var(--neutral-200)',
                  zIndex: 9999,
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '8px 12px', background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                  Switch Active Branch
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                  {locations
                    .filter((loc) => isSuperAdmin || isStoreAdmin || loc.isActive !== false)
                    .map((loc) => {
                      const isCurrent = loc.id === activeLocation.id;
                      const isLocInactive = loc.isActive === false;
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => handleSwitchLocation(loc)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            border: 'none',
                            background: isCurrent ? 'var(--primary-50)' : 'transparent',
                            borderRadius: 6,
                            cursor: 'pointer',
                            textAlign: 'left',
                            opacity: isLocInactive ? 0.7 : 1
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--primary-700)' : 'var(--neutral-800)' }}>
                                {loc.name}
                              </span>
                              {isLocInactive && (
                                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 4, background: 'var(--danger-100)', color: 'var(--danger-700)', fontWeight: 600 }}>
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                              {loc.code}
                            </div>
                          </div>
                          {isCurrent && <Check size={14} color="var(--primary-600)" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-right">
        {/* Only Display the User Name / Login Name on Top Right */}
        {currentUser && (
          <div className="account-dropdown-container" ref={accountMenuRef}>
            <button
              type="button"
              className={`account-dropdown-trigger ${isAccountMenuOpen ? 'active' : ''}`}
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              aria-expanded={isAccountMenuOpen}
              title="Account profile and settings"
            >
              <div className={`account-trigger-avatar ${isSuperAdmin ? 'superadmin' : ''}`}>
                {isSuperAdmin ? '⚡' : currentUser.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="account-trigger-name">{currentUser.name}</span>
              <ChevronDown size={14} className={`account-chevron ${isAccountMenuOpen ? 'rotated' : ''}`} />
            </button>

            {/* Account Popover Menu */}
            {isAccountMenuOpen && (
              <div className="account-dropdown-menu">
                {/* User Info Header */}
                <div className="account-menu-header">
                  <div className={`account-menu-avatar-lg ${isSuperAdmin ? 'superadmin' : ''}`}>
                    {isSuperAdmin ? '⚡' : currentUser.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="account-menu-user-info">
                    <span className="account-menu-name">{currentUser.name}</span>
                    <span className="account-menu-email">{currentUser.email}</span>
                    <div className={`account-menu-role-tag ${isSuperAdmin ? 'superadmin' : ''}`}>
                      {isSuperAdmin ? (
                        <>
                          <ShieldCheck size={12} />
                          <span>⚡ Super Administrator</span>
                        </>
                      ) : currentUser.role === 'TENANT_ADMIN' ? (
                        <>
                          <UserIcon size={12} />
                          <span>👑 Store Admin</span>
                        </>
                      ) : currentUser.role === 'MANAGER' ? (
                        <>
                          <UserIcon size={12} />
                          <span>🏪 Store Manager</span>
                        </>
                      ) : (
                        <>
                          <UserIcon size={12} />
                          <span>🧾 Cashier</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* System & DB Status Pill in Menu */}
                <div style={{ padding: '8px 16px 2px 16px' }}>
                  <div className={`status-pill ${isBackendOnline ? 'online' : 'offline'}`} style={{ width: '100%', justifyContent: 'center' }}>
                    <span className="pulse-dot" />
                    <Database size={13} style={{ marginRight: 2 }} />
                    <span>Database Status: {isBackendOnline ? 'Connected' : 'Standalone Mode'}</span>
                  </div>
                </div>

                {/* Active Store Context Card */}
                <div className="account-menu-store-card">
                  <div className="account-store-card-header">
                    <span className="account-store-card-label">Active Store</span>
                    <span className="account-store-card-plan">{activeTenant.plan}</span>
                  </div>
                  <div className="account-store-card-body">
                    <div className="account-store-avatar">
                      <Building size={14} />
                    </div>
                    <div className="account-store-text">
                      <p className="account-store-name">{activeTenant.name}</p>
                      <p className="account-store-slug">Slug: {activeTenant.slug}</p>
                    </div>
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="account-menu-section-title">Navigation & Tools</div>

                {isSuperAdmin && (
                  <button
                    type="button"
                    className="account-menu-item superadmin-highlight"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigate('superadmin');
                    }}
                  >
                    <ShieldCheck size={16} color="#7c3aed" />
                    <div className="account-item-text">
                      <span className="account-item-title">Super Admin Governance</span>
                      <span className="account-item-desc">Multi-tenant stores & DB configs</span>
                    </div>
                  </button>
                )}

                {(isSuperAdmin || currentUser.role === 'TENANT_ADMIN') && (
                  <button
                    type="button"
                    className="account-menu-item"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigate('settings');
                    }}
                  >
                    <Settings size={16} color="var(--neutral-500)" />
                    <div className="account-item-text">
                      <span className="account-item-title">Settings & Database</span>
                      <span className="account-item-desc">Staff, locations, system config</span>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  className="account-menu-item"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onNavigate('pos');
                  }}
                >
                  <Receipt size={16} color="var(--neutral-500)" />
                  <div className="account-item-text">
                    <span className="account-item-title">POS Counter & Billing</span>
                    <span className="account-item-desc">Launch checkout terminal</span>
                  </div>
                </button>

                <div className="account-menu-divider" />

                {/* Sign Out Action */}
                <button
                  type="button"
                  className="account-menu-logout-btn"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    onLogout();
                  }}
                  title="Sign out of QuickBill POS"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Location Switch & Empty Cart Warning Confirmation Modal */}
      {pendingLocationChange && (
        <div className="modal-overlay" onClick={handleCancelLocationChange} style={{ zIndex: 99999 }}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: 460, 
              width: '100%', 
              backgroundColor: '#ffffff', 
              borderRadius: 'var(--radius-lg, 12px)', 
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'var(--warning-50, #fffbeb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning-600, #d97706)' }}>
                  <AlertTriangle size={18} />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Change Store Location?
                </span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={handleCancelLocationChange}
                style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)' }}
                title="Stay on Current Location"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ backgroundColor: 'var(--warning-50, #fffbeb)', border: '1px solid var(--warning-200, #fde68a)', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--warning-800, #92400e)', lineHeight: 1.45 }}>
                  You currently have <strong>{store.getPosCart().reduce((sum, item) => sum + item.quantity, 0)} item(s)</strong> in your POS billing cart.
                </p>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--neutral-700)', lineHeight: 1.4 }}>
                  Switching branch from <strong>{activeLocation.name}</strong> to <strong>{pendingLocationChange.name}</strong> will <strong>empty your active cart</strong> because product pricing and stock availability are branch-specific.
                </p>
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                Would you like to stay on <strong>{activeLocation.name}</strong> or continue and empty the cart?
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCancelLocationChange}
                  style={{ fontSize: '0.84rem', fontWeight: 700, padding: '8px 16px' }}
                >
                  Stay on Current Location
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleConfirmLocationChange}
                  style={{ fontSize: '0.84rem', fontWeight: 800, padding: '8px 16px' }}
                >
                  Continue & Empty Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
