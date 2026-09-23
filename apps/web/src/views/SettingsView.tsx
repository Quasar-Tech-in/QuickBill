import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Building, 
  Database, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Server, 
  RefreshCw, 
  FileCode, 
  ShieldCheck, 
  UserCheck, 
  Lock, 
  Mail, 
  Phone, 
  AlertCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { store } from '../services/store';
import { User, StoreLocation, UserRole } from '../types';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'staff' | 'locations' | 'profile' | 'system'>('staff');
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Health check state
  const [isChecking, setIsChecking] = useState(false);
  const [backendStatus, setBackendStatus] = useState<boolean>(store.getOnlineStatus());
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString());

  // User modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('CASHIER');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [userFormError, setUserFormError] = useState('');

  // Location modal state
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');
  const [locFormError, setLocFormError] = useState('');

  const currentUser = store.getCurrentUser();
  const canManage = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TENANT_ADMIN';

  const loadData = async () => {
    setLoading(true);
    try {
      const uList = await store.getUsers();
      const lList = store.getAllLocations();
      setUsers(uList);
      setLocations(lList);
    } catch (e) {
      console.error('Failed loading staff and locations:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsChecking(true);
    const ok = await store.checkHealth();
    setBackendStatus(ok);
    setLastCheckTime(new Date().toLocaleTimeString());
    setIsChecking(false);
  };

  useEffect(() => {
    loadData();
    handleTestConnection();
  }, []);

  const handleToggleLocationSelection = (locId: string) => {
    if (selectedLocationIds.includes(locId)) {
      setSelectedLocationIds(selectedLocationIds.filter(id => id !== locId));
    } else {
      setSelectedLocationIds([...selectedLocationIds, locId]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setUserFormError('Please fill in all required fields (Name, Email, Password).');
      return;
    }

    if (newUserPassword.length < 6) {
      setUserFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const created = await store.addUser({
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        password: newUserPassword,
        role: newUserRole,
        assignedLocationIds: selectedLocationIds.length > 0 ? selectedLocationIds : [],
      });

      if (created) {
        setIsUserModalOpen(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('CASHIER');
        setSelectedLocationIds([]);
        loadData();
      }
    } catch (err: any) {
      setUserFormError(err.response?.data?.detail || err.message || 'Failed to create user.');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('You cannot delete your own active account.');
      return;
    }
    if (!confirm(`Are you sure you want to remove staff member "${user.name}"?`)) return;

    await store.deleteUser(user.id);
    loadData();
  };

  const handleToggleUserActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('You cannot deactivate your own active account.');
      return;
    }
    await store.updateUser(user.id, { isActive: !user.isActive });
    loadData();
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocFormError('');

    if (!newLocCode.trim() || !newLocName.trim()) {
      setLocFormError('Branch Code and Branch Name are required.');
      return;
    }

    try {
      const created = await store.addLocation({
        code: newLocCode.trim().toUpperCase(),
        name: newLocName.trim(),
        address: newLocAddress.trim() || 'Store Branch',
        phone: newLocPhone.trim() || '',
      });

      if (created) {
        setIsLocModalOpen(false);
        setNewLocCode('');
        setNewLocName('');
        setNewLocAddress('');
        setNewLocPhone('');
        loadData();
      }
    } catch (err: any) {
      setLocFormError(err.response?.data?.detail || err.message || 'Failed to create branch location.');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="badge badge-purple">⚡ Super Admin</span>;
      case 'TENANT_ADMIN':
        return <span className="badge badge-primary">👑 Store Admin</span>;
      case 'MANAGER':
        return <span className="badge badge-warning">🏪 Manager</span>;
      case 'CASHIER':
      default:
        return <span className="badge badge-success">🧾 Cashier</span>;
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Store Management & Settings
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Manage staff credentials, role permissions, multi-branch store locations, and system configuration.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--neutral-100)', padding: 4, borderRadius: 'var(--radius-md)', gap: 4 }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'staff' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('staff')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={14} />
            <span>Staff & Users</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'locations' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('locations')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MapPin size={14} />
            <span>Locations & Branches</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('profile')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Building size={14} />
            <span>Store Profile</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'system' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('system')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Database size={14} />
            <span>System & DB</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Staff & Team Management */}
      {activeTab === 'staff' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} />
              </div>
              <div>
                <h3 className="card-title">Staff Members & Roles</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                  Authorize Store Admins, Managers, and Cashiers to operate within designated branch locations.
                </p>
              </div>
            </div>

            {canManage && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setUserFormError('');
                  setIsUserModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} />
                <span>Add New Staff</span>
              </button>
            )}
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User / Name</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Assigned Locations</th>
                    <th>Status</th>
                    {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const assignedNames = (u.assignedLocationIds || []).map(id => {
                      const found = locations.find(l => l.id === id);
                      return found ? found.name : id;
                    });

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: u.role === 'TENANT_ADMIN' ? 'var(--primary-100)' : 'var(--neutral-200)',
                              color: u.role === 'TENANT_ADMIN' ? 'var(--primary-700)' : 'var(--neutral-700)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}>
                              {u.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>{u.name}</div>
                              {u.id === currentUser?.id && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--primary-600)', fontWeight: 600 }}>(Current Session)</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{u.email}</td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td>
                          {u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN' ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', fontStyle: 'italic' }}>
                              All Store Branches (Global)
                            </span>
                          ) : assignedNames.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {assignedNames.map((name, idx) => (
                                <span key={idx} style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  background: 'var(--neutral-100)',
                                  border: '1px solid var(--neutral-200)',
                                  color: 'var(--neutral-700)'
                                }}>
                                  📍 {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>Default Branch</span>
                          )}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: u.isActive ? 'var(--success-700)' : 'var(--neutral-400)',
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: u.isActive ? 'var(--success-500)' : 'var(--neutral-300)'
                            }} />
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                title={u.isActive ? 'Deactivate account' : 'Activate account'}
                                onClick={() => handleToggleUserActive(u)}
                                disabled={u.id === currentUser?.id}
                              >
                                {u.isActive ? <ToggleRight size={18} color="var(--success-600)" /> : <ToggleLeft size={18} color="var(--neutral-400)" />}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-danger"
                                title="Delete user"
                                onClick={() => handleDeleteUser(u)}
                                disabled={u.id === currentUser?.id}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Locations & Branches Management */}
      {activeTab === 'locations' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} />
              </div>
              <div>
                <h3 className="card-title">Store Locations & Counter Branches</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                  Manage physical store outlets, warehouses, and checkout counters within your tenant business.
                </p>
              </div>
            </div>

            {canManage && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setLocFormError('');
                  setIsLocModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} />
                <span>Add Branch Location</span>
              </button>
            )}
          </div>

          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {locations.map((loc) => {
                const assignedStaff = users.filter(u => 
                  u.role !== 'TENANT_ADMIN' && u.role !== 'SUPER_ADMIN' && (u.assignedLocationIds || []).includes(loc.id)
                );

                return (
                  <div 
                    key={loc.id} 
                    style={{
                      padding: 16,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--neutral-200)',
                      backgroundColor: 'var(--neutral-50)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--neutral-200)',
                          color: 'var(--neutral-800)'
                        }}>
                          {loc.code}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Live Outlet</span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--neutral-900)', marginBottom: 4 }}>
                        {loc.name}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', marginBottom: 6 }}>
                        📍 {loc.address || 'Address not specified'}
                      </p>
                      {loc.phone && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginBottom: 12 }}>
                          📞 {loc.phone}
                        </p>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: 10, marginTop: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Assigned Staff:</span>
                        <span style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>
                          {assignedStaff.length} Member{assignedStaff.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Store Profile */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building size={18} color="var(--primary-500)" />
              <h3 className="card-title">Business & Store Profile</h3>
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={(e) => { e.preventDefault(); alert('Settings saved successfully!'); }}>
              <div className="form-group">
                <label className="form-label">Store / Company Name</label>
                <input type="text" className="form-input" defaultValue="QuickBill Enterprise Superstore" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">GSTIN / Tax Number</label>
                  <input type="text" className="form-input" defaultValue="07AABCB1234F1Z5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency Symbol</label>
                  <input type="text" className="form-input" defaultValue="₹ (INR)" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Store Main Address</label>
                <input type="text" className="form-input" defaultValue="Plot 42, Tech Park, New Delhi, 110001" />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone & Email</label>
                <input type="text" className="form-input" defaultValue="+91 9876543210 | info@quickbill.com" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
                Save Store Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: System & DB Connectivity */}
      {activeTab === 'system' && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="var(--primary-500)" />
              <h3 className="card-title">MongoDB & Backend Server Connectivity</h3>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleTestConnection}
              disabled={isChecking}
            >
              <RefreshCw size={14} className={isChecking ? 'pulse-dot' : ''} />
              <span>{isChecking ? 'Pinging...' : 'Test Connection'}</span>
            </button>
          </div>
          <div className="card-body">
            {/* Status Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 'var(--radius-md)',
                backgroundColor: backendStatus ? 'var(--success-50)' : 'var(--warning-50)',
                border: `1px solid ${backendStatus ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                marginBottom: 20,
              }}
            >
              {backendStatus ? (
                <CheckCircle2 size={24} color="var(--success-700)" />
              ) : (
                <Server size={24} color="var(--warning-700)" />
              )}
              <div>
                <p style={{ fontWeight: 700, color: backendStatus ? 'var(--success-700)' : 'var(--warning-700)', fontSize: '0.92rem' }}>
                  {backendStatus ? 'FastAPI & MongoDB Services Connected' : 'Local Web POS Standalone Mode'}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)' }}>
                  {backendStatus 
                    ? `Live REST endpoints active at http://localhost:8000/api/v1 (Checked: ${lastCheckTime})`
                    : `Backend not running on port 8000. Operating in offline storage mode.`}
                </p>
              </div>
            </div>

            {/* .env Guide Box */}
            <div style={{ backgroundColor: 'var(--neutral-50)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileCode size={16} color="var(--primary-600)" />
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Database Configuration (.env)</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', marginBottom: 12 }}>
                Configure your isolated MongoDB databases in <code>apps/api/.env</code>:
              </p>
              <pre
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  backgroundColor: 'var(--neutral-900)',
                  color: '#e2e8f0',
                  padding: 12,
                  borderRadius: 6,
                  overflowX: 'auto',
                  lineHeight: 1.6,
                }}
              >
{`# Primary Master Database (Tenants & Master Users)
MONGODB_URI=mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin

# Dedicated Tenant Store Database
DATABASE_NAME=quickbill_main_db
REDIS_URL=redis://localhost:6379/0`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Staff Member */}
      {isUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} color="var(--primary-600)" />
                <span>Create New Staff Member</span>
              </h3>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setIsUserModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {userFormError && (
                  <div style={{
                    padding: 10,
                    borderRadius: 6,
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-700)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <AlertCircle size={15} />
                    <span>{userFormError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Email Address (Login Username) *</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 12 }} />
                    <input
                      type="email"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      placeholder="e.g. rahul@quickbill.local"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Password *</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 12 }} />
                    <input
                      type="password"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      placeholder="Min. 6 characters"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>System Role & Permissions *</label>
                  <select
                    className="form-select"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  >
                    <option value="CASHIER">🧾 Cashier (POS Billing, Receipts, Customer Orders)</option>
                    <option value="MANAGER">🏪 Store Manager (Stock Inventory, Reports, Counter Ops)</option>
                    <option value="TENANT_ADMIN">👑 Store Admin (Full Store Control, Staff & Locations)</option>
                  </select>
                </div>

                {newUserRole !== 'TENANT_ADMIN' && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Assign Store Locations / Branches</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginBottom: 8 }}>
                      Select the specific branch outlets this staff member is authorized to access.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', padding: 8, background: 'var(--neutral-50)', borderRadius: 6, border: '1px solid var(--neutral-200)' }}>
                      {locations.map((loc) => (
                        <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedLocationIds.includes(loc.id)}
                            onChange={() => handleToggleLocationSelection(loc.id)}
                          />
                          <span style={{ fontWeight: 600 }}>{loc.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>({loc.code})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Branch Location */}
      {isLocModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="var(--primary-600)" />
                <span>Add New Store Branch Location</span>
              </h3>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setIsLocModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLocation}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {locFormError && (
                  <div style={{
                    padding: 10,
                    borderRadius: 6,
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-700)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <AlertCircle size={15} />
                    <span>{locFormError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Branch Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. BR-03"
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Branch / Outlet Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Airport Kiosk Counter"
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Physical Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Terminal 3 Arrivals, New Delhi"
                    value={newLocAddress}
                    onChange={(e) => setNewLocAddress(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Phone / Contact Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 12 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      placeholder="+91 98765 00000"
                      value={newLocPhone}
                      onChange={(e) => setNewLocPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsLocModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Branch Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
