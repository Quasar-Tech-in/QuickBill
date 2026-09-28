import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  Building, 
  Activity, 
  Plus, 
  Trash2, 
  Edit3,
  CheckCircle2, 
  Server, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  UserPlus,
  Store,
  Lock, 
  Mail, 
  Phone, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Save,
  Check,
  Power,
  Info,
  AlertTriangle,
  Layers,
  Sparkles,
  Boxes,
  CreditCard,
  Clock,
  Calendar
} from 'lucide-react';
import { store } from '../services/store';
import { User, StoreLocation, UserRole, Tenant } from '../types';
import { SyncInventoryModal } from '../components/SyncInventoryModal';

interface ConfirmModalState {
  isOpen: boolean;
  type: 'LOCATION_TOGGLE' | 'LOCATION_DELETE' | 'USER_TOGGLE' | 'USER_DELETE' | 'ALERT_NOTICE';
  title: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  confirmBtnClass?: string;
  targetLocation?: StoreLocation;
  targetUser?: User;
}

export const SettingsView: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedTab = (location.state as any)?.tab || searchParams.get('tab');
  const isInitiallyLocked = store.isStoreLocked();
  const defaultTab = (requestedTab as any) || (isInitiallyLocked ? 'subscription' : 'staff');

  const [activeTab, setActiveTab] = useState<'staff' | 'locations' | 'profile' | 'subscription' | 'health'>(defaultTab);

  useEffect(() => {
    const qTab = (new URLSearchParams(location.search)).get('tab') || (location.state as any)?.tab;
    if (qTab && ['staff', 'locations', 'profile', 'subscription', 'health'].includes(qTab)) {
      setActiveTab(qTab as any);
    }
  }, [location.search, location.state]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Sync Inventory Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncTargetLocation, setSyncTargetLocation] = useState<StoreLocation | null>(null);

  // Custom Confirmation & Alert Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: 'ALERT_NOTICE',
    title: '',
    message: '',
  });
  
  // Health check state
  const [isChecking, setIsChecking] = useState(false);
  const [backendStatus, setBackendStatus] = useState<boolean>(store.getOnlineStatus());
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString());

  // User Add modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('CASHIER');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [userFormError, setUserFormError] = useState('');

  // User Edit modal state
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('CASHIER');
  const [editUserLocationIds, setEditUserLocationIds] = useState<string[]>([]);
  const [editUserNewPassword, setEditUserNewPassword] = useState('');
  const [editUserFormError, setEditUserFormError] = useState('');

  // Location Add modal state
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');
  const [locFormError, setLocFormError] = useState('');

  // Location Edit modal state
  const [isEditLocModalOpen, setIsEditLocModalOpen] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editLocCode, setEditLocCode] = useState('');
  const [editLocName, setEditLocName] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');
  const [editLocPhone, setEditLocPhone] = useState('');
  const [editLocFormError, setEditLocFormError] = useState('');

  // Store Profile State
  const activeTenant = store.getActiveTenant();
  const [profileName, setProfileName] = useState(activeTenant?.name || '');
  const [profileGstin, setProfileGstin] = useState(activeTenant?.gstin || '');
  const [profilePhone, setProfilePhone] = useState(activeTenant?.phone || '');
  const [profileEmail, setProfileEmail] = useState(activeTenant?.adminEmail || '');
  const [profileAddress, setProfileAddress] = useState('Ground Floor, Metro Retail Plaza, Sector 18, New Delhi');
  const [profileCurrency, setProfileCurrency] = useState('₹ (INR)');
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const currentUser = store.getCurrentUser();
  const canManage = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'TENANT_ADMIN';

  // Quota & Limits Calculation
  const sub = activeTenant?.subscription;
  const maxUsersAllowed = sub?.maxUsers ?? (activeTenant?.plan === 'STARTER' ? 2 : (activeTenant?.plan === 'ENTERPRISE' ? 25 : 5));
  const activeUsersCount = users.filter(u => u.isActive !== false).length;
  const isUsersCapped = activeUsersCount >= maxUsersAllowed && currentUser?.role !== 'SUPER_ADMIN';

  const maxLocationsAllowed = sub?.maxLocations ?? (activeTenant?.plan === 'STARTER' ? 1 : (activeTenant?.plan === 'ENTERPRISE' ? 10 : 3));
  const activeLocationsCount = locations.filter(l => l.isActive !== false).length;
  const isLocationsCapped = activeLocationsCount >= maxLocationsAllowed && currentUser?.role !== 'SUPER_ADMIN';

  const daysRemaining = sub?.daysRemaining ?? 365;
  const isStoreLocked = store.isStoreLocked();

  const loadData = async () => {
    setLoading(true);
    try {
      const uList = await store.getUsers();
      const lList = await store.fetchLocations();
      setUsers(uList);
      setLocations(lList);
      
      const t = store.getActiveTenant();
      if (t) {
        setProfileName(t.name || '');
        setProfileGstin(t.gstin || '');
        setProfilePhone(t.phone || '');
        setProfileEmail(t.adminEmail || '');
      }
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

  const handleToggleLocationSelection = (locId: string, isEdit: boolean = false) => {
    if (isEdit) {
      if (editUserLocationIds.includes(locId)) {
        setEditUserLocationIds(editUserLocationIds.filter(id => id !== locId));
      } else {
        setEditUserLocationIds([...editUserLocationIds, locId]);
      }
    } else {
      if (selectedLocationIds.includes(locId)) {
        setSelectedLocationIds(selectedLocationIds.filter(id => id !== locId));
      } else {
        setSelectedLocationIds([...selectedLocationIds, locId]);
      }
    }
  };

  // --- User Handlers ---
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

  const handleOpenEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
    setEditUserLocationIds(user.assignedLocationIds || []);
    setEditUserNewPassword('');
    setEditUserFormError('');
    setIsEditUserModalOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setEditUserFormError('');

    if (!editUserName.trim()) {
      setEditUserFormError('Full Name is required.');
      return;
    }

    if (editUserNewPassword && editUserNewPassword.length < 6) {
      setEditUserFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const updates: any = {
        name: editUserName.trim(),
        role: editUserRole,
        assignedLocationIds: editUserRole === 'TENANT_ADMIN' ? [] : editUserLocationIds,
      };

      if (editUserNewPassword) {
        updates.password = editUserNewPassword;
      }

      await store.updateUser(editingUserId, updates);
      setIsEditUserModalOpen(false);
      loadData();
    } catch (err: any) {
      setEditUserFormError(err.response?.data?.detail || err.message || 'Failed to update user.');
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      setConfirmModal({
        isOpen: true,
        type: 'ALERT_NOTICE',
        title: 'Action Not Allowed',
        message: 'You cannot delete your own active logged-in account.',
        confirmText: 'Understood',
        confirmBtnClass: 'btn-primary',
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'USER_DELETE',
      title: 'Remove Staff Member?',
      message: `Are you sure you want to permanently remove "${user.name}" (${user.email})?`,
      subMessage: 'This action will revoke access immediately and remove the staff profile from the system.',
      confirmText: 'Remove Staff Member',
      confirmBtnClass: 'btn-danger',
      targetUser: user,
    });
  };

  const handleToggleUserActive = (user: User) => {
    if (user.id === currentUser?.id) {
      setConfirmModal({
        isOpen: true,
        type: 'ALERT_NOTICE',
        title: 'Action Not Allowed',
        message: 'You cannot deactivate your own active logged-in account.',
        confirmText: 'Understood',
        confirmBtnClass: 'btn-primary',
      });
      return;
    }
    const newStatus = !user.isActive;
    setConfirmModal({
      isOpen: true,
      type: 'USER_TOGGLE',
      title: newStatus ? 'Activate Staff Account?' : 'Deactivate Staff Account?',
      message: newStatus
        ? `Are you sure you want to activate account for "${user.name}" (${user.email})?`
        : `Are you sure you want to deactivate account for "${user.name}" (${user.email})?`,
      subMessage: newStatus
        ? 'The user will be able to log in and access their assigned store branch immediately.'
        : 'The user will be immediately barred from logging in and accessing any store operations.',
      confirmText: newStatus ? 'Activate Account' : 'Deactivate Account',
      confirmBtnClass: newStatus ? 'btn-primary' : 'btn-danger',
      targetUser: user,
    });
  };

  // --- Location Handlers ---
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
        await loadData();
        // Automatically pop up the Sync Inventory Modal for the newly created branch!
        setSyncTargetLocation(created);
        setIsSyncModalOpen(true);
      }
    } catch (err: any) {
      setLocFormError(err.response?.data?.detail || err.message || 'Failed to create branch location.');
    }
  };

  const handleOpenEditLocation = (loc: StoreLocation) => {
    setEditingLocId(loc.id);
    setEditLocCode(loc.code);
    setEditLocName(loc.name);
    setEditLocAddress(loc.address || '');
    setEditLocPhone(loc.phone || '');
    setEditLocFormError('');
    setIsEditLocModalOpen(true);
  };

  const handleSaveEditLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocId) return;
    setEditLocFormError('');

    if (!editLocName.trim()) {
      setLocFormError('Branch Name is required.');
      return;
    }

    try {
      await store.updateLocation(editingLocId, {
        name: editLocName.trim(),
        code: editLocCode.trim().toUpperCase(),
        address: editLocAddress.trim(),
        phone: editLocPhone.trim(),
      });
      setIsEditLocModalOpen(false);
      loadData();
    } catch (err: any) {
      setEditLocFormError(err.response?.data?.detail || err.message || 'Failed to update location.');
    }
  };

  const handleToggleLocationActive = (loc: StoreLocation) => {
    const isCurrentlyActive = loc.isActive !== false;
    const newStatus = !isCurrentlyActive;
    
    // Check if trying to deactivate the default location
    if (loc.isDefault && isCurrentlyActive) {
      setConfirmModal({
        isOpen: true,
        type: 'ALERT_NOTICE',
        title: 'Default Branch Cannot Be Deactivated',
        message: `"${loc.name}" (${loc.code}) is designated as your primary flagship branch.`,
        subMessage: 'To deactivate this branch, please designate another branch as the default flagship branch first in order to prevent store-wide checkout interruption.',
        confirmText: 'Understood',
        confirmBtnClass: 'btn-primary',
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'LOCATION_TOGGLE',
      title: newStatus ? 'Activate Branch Outlet?' : 'Deactivate Branch Outlet?',
      message: newStatus 
        ? `Are you sure you want to activate branch outlet "${loc.name}" (${loc.code})?`
        : `Are you sure you want to deactivate branch outlet "${loc.name}" (${loc.code})?`,
      subMessage: newStatus
        ? 'Staff members assigned to this location will regain access to billing, inventory, and transactions.'
        : 'Non-admin staff members assigned exclusively to this branch will be restricted from selecting it and entering sales until it is reactivated.',
      confirmText: newStatus ? 'Activate Branch' : 'Deactivate Branch',
      confirmBtnClass: newStatus ? 'btn-primary' : 'btn-danger',
      targetLocation: loc,
    });
  };

  const handleDeleteLocation = (loc: StoreLocation) => {
    if (loc.isDefault) {
      setConfirmModal({
        isOpen: true,
        type: 'ALERT_NOTICE',
        title: 'Default Branch Cannot Be Deleted',
        message: `"${loc.name}" (${loc.code}) is designated as your primary flagship branch.`,
        subMessage: 'To delete this branch, please designate another branch as default first in order to prevent store-wide checkout interruption.',
        confirmText: 'Understood',
        confirmBtnClass: 'btn-primary',
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'LOCATION_DELETE',
      title: 'Delete Branch Location?',
      message: `Are you sure you want to permanently delete branch outlet "${loc.name}" (${loc.code})?`,
      subMessage: 'This action will remove branch inventory entities across all tenant products and unlink assigned staff members.',
      confirmText: 'Delete Branch Location',
      confirmBtnClass: 'btn-danger',
      targetLocation: loc,
    });
  };

  const handleExecuteConfirm = async () => {
    const { type, targetLocation, targetUser } = confirmModal;
    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      if (type === 'LOCATION_TOGGLE' && targetLocation) {
        const isCurrentlyActive = targetLocation.isActive !== false;
        await store.updateLocation(targetLocation.id, { isActive: !isCurrentlyActive });
        await loadData();
      } else if (type === 'LOCATION_DELETE' && targetLocation) {
        await store.deleteLocation(targetLocation.id);
        await loadData();
      } else if (type === 'USER_TOGGLE' && targetUser) {
        await store.updateUser(targetUser.id, { isActive: !targetUser.isActive });
        await loadData();
      } else if (type === 'USER_DELETE' && targetUser) {
        await store.deleteUser(targetUser.id);
        await loadData();
      }
    } catch (err: any) {
      console.error('Action failed:', err);
    }
  };

  // --- Store Profile Save Handler ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await store.updateTenantProfile({
        name: profileName.trim(),
        gstin: profileGstin.trim(),
        phone: profilePhone.trim(),
        email: profileEmail.trim().toLowerCase(),
        address: profileAddress.trim(),
        currency: profileCurrency.trim(),
      });
      setProfileSavedMsg(true);
      setTimeout(() => setProfileSavedMsg(false), 3500);
    } catch (err) {
      console.error('Error saving store profile:', err);
    } finally {
      setIsSavingProfile(false);
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
            Manage staff credentials, role permissions, multi-branch store locations, and business profile.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--neutral-100)', padding: 4, borderRadius: 'var(--radius-md)', gap: 4, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'staff' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('staff')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={14} />
            <span>Staff & Users ({activeUsersCount}/{maxUsersAllowed})</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'locations' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('locations')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MapPin size={14} />
            <span>Locations & Branches ({activeLocationsCount}/{maxLocationsAllowed})</span>
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
            className={`btn btn-sm ${activeTab === 'subscription' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('subscription')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CreditCard size={14} />
            <span>Subscription & License</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'health' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('health')}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Activity size={14} />
            <span>System Health</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Staff & Team Management */}
      {activeTab === 'staff' && (
        <div className="card">
          {/* Store Locked Warning if suspended/expired */}
          {isStoreLocked && (
            <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={18} color="#dc2626" />
              <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
                Staff and user management actions are locked because this store is currently suspended or subscription expired.
              </span>
            </div>
          )}

          {/* Quota Cap Warning if at limit */}
          {!isStoreLocked && isUsersCapped && (
            <div style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} color="#d97706" />
                <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                  Staff user limit reached ({activeUsersCount} / {maxUsersAllowed} active users). Upgrade your subscription plan to add more staff.
                </span>
              </div>
              <button 
                className="btn btn-xs btn-primary"
                onClick={() => setActiveTab('subscription')}
              >
                View Plan & Quotas
              </button>
            </div>
          )}

          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} />
              </div>
              <div>
                <h3 className="card-title">Staff Members & Role Privileges</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: 0 }}>
                  Plan Quota: <strong>{activeUsersCount} of {maxUsersAllowed} Seats Used</strong>
                </p>
              </div>
            </div>

            {canManage && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                disabled={isUsersCapped || isStoreLocked}
                onClick={() => {
                  if (isStoreLocked) return;
                  setUserFormError('');
                  setIsUserModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: (isUsersCapped || isStoreLocked) ? 0.6 : 1 }}
                title={isStoreLocked ? "Staff management is locked while store is suspended" : isUsersCapped ? "Staff limit reached for current plan tier" : "Add new staff user"}
              >
                <Plus size={15} />
                <span>{isStoreLocked ? 'Management Locked' : isUsersCapped ? 'User Limit Reached' : 'Add New Staff'}</span>
              </button>
            )}
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User / Name</th>
                    <th>Email (Username)</th>
                    <th>Role & Access</th>
                    <th>Assigned Locations</th>
                    <th>Account Status</th>
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
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--neutral-700)' }}>
                          {u.email}
                        </td>
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
                            gap: 6,
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            backgroundColor: u.isActive ? 'var(--success-50)' : 'var(--danger-50)',
                            color: u.isActive ? 'var(--success-700)' : 'var(--danger-700)',
                            border: `1px solid ${u.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: u.isActive ? 'var(--success-600)' : 'var(--danger-500)'
                            }} />
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              {/* Edit Permissions Button */}
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                title="Edit Name, Role & Location Permissions"
                                onClick={() => handleOpenEditUser(u)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.75rem' }}
                              >
                                <Edit3 size={12} />
                                <span>Edit</span>
                              </button>

                              {/* Visible Deactivate / Activate Button */}
                              <button
                                type="button"
                                className={`btn btn-xs ${u.isActive ? 'btn-secondary text-danger' : 'btn-secondary text-success'}`}
                                title={u.isActive ? 'Deactivate staff account' : 'Activate staff account'}
                                onClick={() => handleToggleUserActive(u)}
                                disabled={u.id === currentUser?.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  borderColor: u.isActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                                  backgroundColor: u.isActive ? 'var(--danger-50)' : 'var(--success-50)'
                                }}
                              >
                                <Power size={12} />
                                <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-danger"
                                title="Remove User"
                                onClick={() => handleDeleteUser(u)}
                                disabled={u.id === currentUser?.id}
                                style={{ padding: 4 }}
                              >
                                <Trash2 size={14} />
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
          {/* Store Locked Warning if suspended/expired */}
          {isStoreLocked && (
            <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={18} color="#dc2626" />
              <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
                Branch and counter location management is locked because this store is currently suspended or subscription expired.
              </span>
            </div>
          )}

          {/* Quota Cap Warning if at limit */}
          {!isStoreLocked && isLocationsCapped && (
            <div style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} color="#d97706" />
                <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                  Store branch location limit reached ({activeLocationsCount} / {maxLocationsAllowed} active branches). Upgrade your subscription to add more branch outlets.
                </span>
              </div>
              <button 
                className="btn btn-xs btn-primary"
                onClick={() => setActiveTab('subscription')}
              >
                View Plan & Quotas
              </button>
            </div>
          )}

          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} />
              </div>
              <div>
                <h3 className="card-title">Store Locations & Counter Branches</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: 0 }}>
                  Plan Quota: <strong>{activeLocationsCount} of {maxLocationsAllowed} Branches Used</strong>
                </p>
              </div>
            </div>

            {canManage && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                disabled={isLocationsCapped || isStoreLocked}
                onClick={() => {
                  if (isStoreLocked) return;
                  setLocFormError('');
                  setIsLocModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: (isLocationsCapped || isStoreLocked) ? 0.6 : 1 }}
                title={isStoreLocked ? "Branch management is locked while store is suspended" : isLocationsCapped ? "Branch limit reached for current plan tier" : "Add new branch location"}
              >
                <Plus size={15} />
                <span>{isStoreLocked ? 'Management Locked' : isLocationsCapped ? 'Branch Limit Reached' : 'Add Branch Location'}</span>
              </button>
            )}
          </div>

          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {locations.map((loc) => {
                const isLocActive = loc.isActive !== false;
                const assignedStaff = users.filter(u => 
                  u.role !== 'TENANT_ADMIN' && u.role !== 'SUPER_ADMIN' && (u.assignedLocationIds || []).includes(loc.id)
                );

                return (
                  <div 
                    key={loc.id} 
                    style={{
                      padding: 16,
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isLocActive ? 'var(--neutral-200)' : 'var(--danger-200)'}`,
                      backgroundColor: isLocActive ? 'var(--neutral-50)' : 'var(--danger-50)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: isLocActive ? 1 : 0.85
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
                        
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {loc.isDefault && (
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>Default</span>
                          )}
                          <span className={`badge ${isLocActive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                            {isLocActive ? 'Active Outlet' : 'Inactive Outlet'}
                          </span>
                        </div>
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span>Assigned Staff:</span>
                        <span style={{ fontWeight: 600, color: 'var(--neutral-800)' }}>
                          {assignedStaff.length} Member{assignedStaff.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {canManage && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              setSyncTargetLocation(loc);
                              setIsSyncModalOpen(true);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', color: 'var(--primary-700)', fontWeight: 600 }}
                            title="Synchronize and configure catalog items for this branch"
                          >
                            <Boxes size={12} color="var(--primary-600)" />
                            <span>Sync Items</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenEditLocation(loc)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                          >
                            <Edit3 size={12} />
                            <span>Edit Details</span>
                          </button>

                          <button
                            type="button"
                            className={`btn btn-xs ${isLocActive ? 'btn-secondary text-danger' : 'btn-secondary text-success'}`}
                            onClick={() => handleToggleLocationActive(loc)}
                            disabled={loc.isDefault && isLocActive}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              fontWeight: 600
                            }}
                            title={loc.isDefault && isLocActive ? 'Default location cannot be deactivated' : undefined}
                          >
                            <Power size={12} />
                            <span>{isLocActive ? 'Deactivate' : 'Activate'}</span>
                          </button>

                          {/* Delete Branch Button */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-danger"
                            onClick={() => handleDeleteLocation(loc)}
                            disabled={loc.isDefault}
                            style={{ padding: 4, opacity: loc.isDefault ? 0.35 : 1, cursor: loc.isDefault ? 'not-allowed' : 'pointer' }}
                            title={loc.isDefault ? "Default location cannot be deleted" : "Delete branch location"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
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
              <div>
                <h3 className="card-title">Business & Store Profile</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                  Update your retail company branding, tax registration, address, and contact details.
                </p>
              </div>
            </div>
          </div>

          <div className="card-body">
            {profileSavedMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--success-50)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--success-700)',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 20
              }}>
                <CheckCircle2 size={18} />
                <span>Store profile details updated and saved successfully!</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Store Name */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Store / Company Business Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={profileName} 
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. QuickBill Enterprise Retail"
                  required 
                />
              </div>

              {/* Tax & Currency */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">GSTIN / Tax Identification Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileGstin} 
                    onChange={(e) => setProfileGstin(e.target.value)}
                    placeholder="e.g. 07AABCB1234F1Z5" 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Billing Currency Symbol</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={profileCurrency} 
                    onChange={(e) => setProfileCurrency(e.target.value)}
                    placeholder="₹ (INR)" 
                  />
                </div>
              </div>

              {/* Separated Contact Info: Phone & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {/* Contact Phone */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Official Contact Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ paddingLeft: 36 }}
                      value={profilePhone} 
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+91 98765 43210" 
                    />
                  </div>
                </div>

                {/* Contact Email */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Official Business Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input 
                      type="email" 
                      className="form-input" 
                      style={{ paddingLeft: 36 }}
                      value={profileEmail} 
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="info@quickbill.com" 
                    />
                  </div>
                </div>
              </div>

              {/* Store Main Address */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Store Head Office / Main Address</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={profileAddress} 
                  onChange={(e) => setProfileAddress(e.target.value)}
                  placeholder="Plot 42, Tech Park, Sector 18, New Delhi, 110001" 
                />
              </div>

              <div style={{ marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={isSavingProfile} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Save size={16} />
                  <span>{isSavingProfile ? 'Saving Changes...' : 'Save Store Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Simplified Non-Technical System Health */}
      {activeTab === 'health' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="var(--primary-500)" />
              <div>
                <h3 className="card-title">System & Cloud Connectivity</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                  Real-time synchronization status between your store terminal and cloud services.
                </p>
              </div>
            </div>
            
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleTestConnection}
              disabled={isChecking}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={isChecking ? 'spin' : ''} />
              <span>{isChecking ? 'Testing...' : 'Check Connection'}</span>
            </button>
          </div>

          <div className="card-body">
            {/* Friendly Status Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 18,
                borderRadius: 'var(--radius-md)',
                backgroundColor: backendStatus ? 'var(--success-50)' : 'var(--warning-50)',
                border: `1px solid ${backendStatus ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                marginBottom: 20,
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: backendStatus ? '#d1fae5' : '#fef3c7',
                color: backendStatus ? 'var(--success-700)' : 'var(--warning-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {backendStatus ? (
                  <CheckCircle2 size={28} />
                ) : (
                  <Server size={28} />
                )}
              </div>
              <div>
                <h4 style={{ fontWeight: 800, color: backendStatus ? 'var(--success-800)' : 'var(--warning-800)', fontSize: '1rem', marginBottom: 2 }}>
                  {backendStatus ? '🟢 Cloud Backend Connected & Operational' : '🟡 Standalone Local Offline Mode'}
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                  {backendStatus 
                    ? `Live billing services, multi-device sync, and inventory ledger are synchronized. (Last verified: ${lastCheckTime})`
                    : `Operating securely on local storage. Invoices and transactions are queued locally.`}
                </p>
              </div>
            </div>

            {/* Quick Status Highlights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--neutral-50)', border: '1px solid var(--neutral-200)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', textTransform: 'uppercase', fontWeight: 600 }}>Billing Engine</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--success-700)', marginTop: 2 }}>✓ High Precision Math Ready</p>
              </div>

              <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--neutral-50)', border: '1px solid var(--neutral-200)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', textTransform: 'uppercase', fontWeight: 600 }}>Local Storage Cache</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-600)', marginTop: 2 }}>✓ Encrypted & Active</p>
              </div>

              <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--neutral-50)', border: '1px solid var(--neutral-200)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', textTransform: 'uppercase', fontWeight: 600 }}>Multi-Branch Routing</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--neutral-900)', marginTop: 2 }}>✓ {locations.length} Outlets Configured</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Subscription & License Plan */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main License Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="card-title">Store License & Active Subscription Plan</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: 0 }}>
                    Current active tier, license expiration dates, and quota limit allocations.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span 
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 6,
                    backgroundColor: activeTenant?.plan === 'ENTERPRISE' ? '#ede9fe' : (activeTenant?.plan === 'PROFESSIONAL' ? '#e0e7ff' : '#fef3c7'),
                    color: activeTenant?.plan === 'ENTERPRISE' ? '#6d28d9' : (activeTenant?.plan === 'PROFESSIONAL' ? '#3730a3' : '#92400e')
                  }}
                >
                  {activeTenant?.plan || 'PROFESSIONAL'} TIER
                </span>
                <span 
                  className={`badge ${daysRemaining <= 7 ? (daysRemaining < 0 ? 'badge-danger' : 'badge-partial') : 'badge-paid'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {daysRemaining < 0 ? `License Expired (${Math.abs(daysRemaining)}d past)` : (daysRemaining <= 14 ? `Expiring Soon (${daysRemaining}d left)` : `Active (${daysRemaining}d remaining)`)}
                </span>
              </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Expiration Timeline Banner */}
              <div 
                style={{
                  padding: '18px 22px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: daysRemaining <= 7 ? (daysRemaining < 0 ? '#fef2f2' : '#fffbeb') : 'var(--neutral-50)',
                  border: `1px solid ${daysRemaining <= 7 ? (daysRemaining < 0 ? '#fca5a5' : '#fde68a') : 'var(--neutral-200)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--neutral-500)' }}>License Expiration</span>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: daysRemaining <= 7 ? '#b91c1c' : 'var(--neutral-900)', margin: '4px 0 0 0' }}>
                    {sub?.endDate ? new Date(sub.endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Continuous'}
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', margin: '4px 0 0 0' }}>
                    Billing Cycle: <strong>{sub?.billingCycle || 'Annual'}</strong> • Start Date: <strong>{sub?.startDate ? new Date(sub.startDate).toLocaleDateString() : 'N/A'}</strong>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Need more staff seats or branches?</span>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-600)', marginTop: 2 }}>
                    Contact your Super Administrator to upgrade plan.
                  </div>
                </div>
              </div>

              {/* Quotas & Limits Progress Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* User Seats Quota */}
                <div style={{ padding: 18, borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} color="var(--primary-600)" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Staff Users Quota</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isUsersCapped ? '#dc2626' : 'var(--neutral-800)' }}>
                      {activeUsersCount} / {maxUsersAllowed} Seats Used
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 8, backgroundColor: 'var(--neutral-200)', borderRadius: 4, overflow: 'hidden', margin: '10px 0' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, (activeUsersCount / maxUsersAllowed) * 100)}%`, 
                        height: '100%', 
                        backgroundColor: isUsersCapped ? '#ef4444' : 'var(--primary-600)',
                        borderRadius: 4 
                      }} 
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                    {isUsersCapped ? '⚠️ Quota limit reached. To add additional staff, request a license upgrade.' : `${maxUsersAllowed - activeUsersCount} additional staff seat(s) available.`}
                  </span>
                </div>

                {/* Locations / Branches Quota */}
                <div style={{ padding: 18, borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', border: '1px solid var(--neutral-200)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} color="#10b981" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Store Branches Quota</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: isLocationsCapped ? '#dc2626' : 'var(--neutral-800)' }}>
                      {activeLocationsCount} / {maxLocationsAllowed} Outlets Used
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 8, backgroundColor: 'var(--neutral-200)', borderRadius: 4, overflow: 'hidden', margin: '10px 0' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, (activeLocationsCount / maxLocationsAllowed) * 100)}%`, 
                        height: '100%', 
                        backgroundColor: isLocationsCapped ? '#ef4444' : '#10b981',
                        borderRadius: 4 
                      }} 
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                    {isLocationsCapped ? '⚠️ Branch limit reached. To configure more outlets, request a license upgrade.' : `${maxLocationsAllowed - activeLocationsCount} additional outlet branch(es) available.`}
                  </span>
                </div>
              </div>

              {/* Enabled Modules Matrix */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--neutral-600)', letterSpacing: '0.04em' }}>
                  Included Capabilities in Current Plan
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 10 }}>
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>POS Counter & Fast Checkout</span>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Item Catalog & Price Tiers</span>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Double-Entry Expense Ledger</span>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Party & CRM Directory</span>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>P&L Financial Reports</span>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Multi-Branch Stock Synchronization</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Add New Staff Member */}
      {isUserModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 600, padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
                }}>
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                    Create New Staff Member
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Set up credentials, assign role privileges, and specify branch outlet access.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--neutral-400)', padding: 4 }}
                onClick={() => setIsUserModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}>
                {userFormError && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-700)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{userFormError}</span>
                  </div>
                )}

                {/* Section 1: Credentials */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-700)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} />
                    <span>1. Basic Profile & Credentials</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Full Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Rahul Sharma"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Email (Login ID) *</label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
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
                  </div>

                  <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Account Password *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                      <input
                        type="password"
                        className="form-input"
                        style={{ paddingLeft: 36 }}
                        placeholder="Minimum 6 characters"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                      />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginTop: 4, display: 'block' }}>
                      Staff member will use this password alongside their email to sign in.
                    </span>
                  </div>
                </div>

                {/* Section 2: Role Selector Cards */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-700)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} />
                    <span>2. Select Access Role & Permissions</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {/* Role 1: Cashier */}
                    <div
                      onClick={() => setNewUserRole('CASHIER')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${newUserRole === 'CASHIER' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        backgroundColor: newUserRole === 'CASHIER' ? 'var(--primary-50)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: newUserRole === 'CASHIER' ? '0 4px 12px var(--primary-glow)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>🧾</span>
                          {newUserRole === 'CASHIER' && <CheckCircle2 size={16} color="var(--primary-600)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Cashier</div>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--success-100)', color: 'var(--success-700)', fontWeight: 700, display: 'inline-block', margin: '4px 0 6px 0' }}>
                          POS & Checkout
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--neutral-600)', lineHeight: 1.35, margin: 0 }}>
                          Fast POS sales, customer receipts, and invoice returns.
                        </p>
                      </div>
                    </div>

                    {/* Role 2: Manager */}
                    <div
                      onClick={() => setNewUserRole('MANAGER')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${newUserRole === 'MANAGER' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        backgroundColor: newUserRole === 'MANAGER' ? 'var(--primary-50)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: newUserRole === 'MANAGER' ? '0 4px 12px var(--primary-glow)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>🏪</span>
                          {newUserRole === 'MANAGER' && <CheckCircle2 size={16} color="var(--primary-600)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Manager</div>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--warning-100)', color: 'var(--warning-700)', fontWeight: 700, display: 'inline-block', margin: '4px 0 6px 0' }}>
                          Stock & Ops
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--neutral-600)', lineHeight: 1.35, margin: 0 }}>
                          Inventory stocks, reports, ledger entries, and counter ops.
                        </p>
                      </div>
                    </div>

                    {/* Role 3: Store Admin */}
                    <div
                      onClick={() => setNewUserRole('TENANT_ADMIN')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${newUserRole === 'TENANT_ADMIN' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        backgroundColor: newUserRole === 'TENANT_ADMIN' ? 'var(--primary-50)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: newUserRole === 'TENANT_ADMIN' ? '0 4px 12px var(--primary-glow)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>👑</span>
                          {newUserRole === 'TENANT_ADMIN' && <CheckCircle2 size={16} color="var(--primary-600)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Store Admin</div>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--primary-100)', color: 'var(--primary-700)', fontWeight: 700, display: 'inline-block', margin: '4px 0 6px 0' }}>
                          Full Control
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--neutral-600)', lineHeight: 1.35, margin: 0 }}>
                          Global access across all branches, staff settings, & billing.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Branch Location Permissions */}
                {newUserRole !== 'TENANT_ADMIN' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={14} />
                        <span>3. Assigned Store Outlets ({selectedLocationIds.length} Selected)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSelectedLocationIds(locations.map(l => l.id))}
                          style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSelectedLocationIds([])}
                          style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 150, overflowY: 'auto', padding: 4 }}>
                      {locations.map((loc) => {
                        const isSelected = selectedLocationIds.includes(loc.id);
                        const isLocActive = loc.isActive !== false;
                        return (
                          <div
                            key={loc.id}
                            onClick={() => handleToggleLocationSelection(loc.id, false)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                              backgroundColor: isSelected ? 'var(--primary-50)' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <MapPin size={15} color={isSelected ? 'var(--primary-600)' : 'var(--neutral-400)'} style={{ flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {loc.name}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                                  {loc.code} {loc.isDefault ? '• Default' : ''} {!isLocActive ? '• (Inactive)' : ''}
                                </div>
                              </div>
                            </div>
                            <div style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--neutral-300)'}`,
                              backgroundColor: isSelected ? 'var(--primary-600)' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              flexShrink: 0
                            }}>
                              {isSelected && <Check size={12} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'var(--neutral-50)',
                borderTop: '1px solid var(--neutral-200)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={16} />
                  <span>Create Staff Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Staff Member & Permissions (Immutable Email) */}
      {isEditUserModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 600, padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)'
                }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                    Edit Staff & Role Permissions
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Modify staff details, change security role, and update branch access.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--neutral-400)', padding: 4 }}
                onClick={() => setIsEditUserModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser}>
              <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}>
                {editUserFormError && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-700)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{editUserFormError}</span>
                  </div>
                )}

                {/* Section 1: Identity & Credentials */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-700)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} />
                    <span>1. Basic Profile & Login ID</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Full Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editUserName}
                        onChange={(e) => setEditUserName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Email Address</label>
                        <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Lock size={11} color="var(--neutral-400)" />
                          <span>Fixed Login ID</span>
                        </span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Mail size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                        <input
                          type="email"
                          className="form-input"
                          style={{ paddingLeft: 36, backgroundColor: 'var(--neutral-100)', color: 'var(--neutral-600)', cursor: 'not-allowed' }}
                          value={editUserEmail}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Reset Password (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                      <input
                        type="password"
                        className="form-input"
                        style={{ paddingLeft: 36 }}
                        placeholder="Leave blank to keep existing password"
                        value={editUserNewPassword}
                        onChange={(e) => setEditUserNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Role Selector Cards */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-700)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} />
                    <span>2. Security Role & System Tier</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {/* Role 1: Cashier */}
                    <div
                      onClick={() => setEditUserRole('CASHIER')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${editUserRole === 'CASHIER' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        backgroundColor: editUserRole === 'CASHIER' ? 'var(--primary-50)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: editUserRole === 'CASHIER' ? '0 4px 12px var(--primary-glow)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>🧾</span>
                          {editUserRole === 'CASHIER' && <CheckCircle2 size={16} color="var(--primary-600)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Cashier</div>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--success-100)', color: 'var(--success-700)', fontWeight: 700, display: 'inline-block', margin: '4px 0 6px 0' }}>
                          POS & Checkout
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--neutral-600)', lineHeight: 1.35, margin: 0 }}>
                          Fast POS sales, customer receipts, and invoice returns.
                        </p>
                      </div>
                    </div>

                    {/* Role 2: Manager */}
                    <div
                      onClick={() => setEditUserRole('MANAGER')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${editUserRole === 'MANAGER' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        backgroundColor: editUserRole === 'MANAGER' ? 'var(--primary-50)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: editUserRole === 'MANAGER' ? '0 4px 12px var(--primary-glow)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>🏪</span>
                          {editUserRole === 'MANAGER' && <CheckCircle2 size={16} color="var(--primary-600)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Manager</div>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--warning-100)', color: 'var(--warning-700)', fontWeight: 700, display: 'inline-block', margin: '4px 0 6px 0' }}>
                          Stock & Ops
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--neutral-600)', lineHeight: 1.35, margin: 0 }}>
                          Inventory stocks, reports, ledger entries, and counter ops.
                        </p>
                      </div>
                    </div>

                    {/* Role 3: Store Admin */}
                    <div
                      onClick={() => setEditUserRole('TENANT_ADMIN')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${editUserRole === 'TENANT_ADMIN' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        backgroundColor: editUserRole === 'TENANT_ADMIN' ? 'var(--primary-50)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: editUserRole === 'TENANT_ADMIN' ? '0 4px 12px var(--primary-glow)' : 'none'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>👑</span>
                          {editUserRole === 'TENANT_ADMIN' && <CheckCircle2 size={16} color="var(--primary-600)" />}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900)' }}>Store Admin</div>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--primary-100)', color: 'var(--primary-700)', fontWeight: 700, display: 'inline-block', margin: '4px 0 6px 0' }}>
                          Full Control
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--neutral-600)', lineHeight: 1.35, margin: 0 }}>
                          Global access across all branches, staff settings, & billing.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Branch Location Permissions */}
                {editUserRole !== 'TENANT_ADMIN' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={14} />
                        <span>3. Assigned Store Outlets ({editUserLocationIds.length} Selected)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setEditUserLocationIds(locations.map(l => l.id))}
                          style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setEditUserLocationIds([])}
                          style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 150, overflowY: 'auto', padding: 4 }}>
                      {locations.map((loc) => {
                        const isSelected = editUserLocationIds.includes(loc.id);
                        const isLocActive = loc.isActive !== false;
                        return (
                          <div
                            key={loc.id}
                            onClick={() => handleToggleLocationSelection(loc.id, true)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                              backgroundColor: isSelected ? 'var(--primary-50)' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <MapPin size={15} color={isSelected ? 'var(--primary-600)' : 'var(--neutral-400)'} style={{ flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {loc.name}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                                  {loc.code} {loc.isDefault ? '• Default' : ''} {!isLocActive ? '• (Inactive)' : ''}
                                </div>
                              </div>
                            </div>
                            <div style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--neutral-300)'}`,
                              backgroundColor: isSelected ? 'var(--primary-600)' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              flexShrink: 0
                            }}>
                              {isSelected && <Check size={12} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'var(--neutral-50)',
                borderTop: '1px solid var(--neutral-200)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsEditUserModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} />
                  <span>Save Permissions</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Branch Location */}
      {isLocModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 540, padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                }}>
                  <Store size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                    Add Store Branch Location
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Configure a new retail counter, store branch, or stock warehouse.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--neutral-400)', padding: 4 }}
                onClick={() => setIsLocModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLocation}>
              <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {locFormError && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-700)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{locFormError}</span>
                  </div>
                )}

                {/* Live Outlet Preview Card */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--neutral-50) 0%, var(--primary-50) 100%)',
                  border: '1px solid var(--primary-200)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ffffff', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                      <MapPin size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--neutral-900)' }}>
                        {newLocName.trim() || 'New Outlet Name'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                        {newLocAddress.trim() || 'Physical location address'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'var(--neutral-200)', color: 'var(--neutral-800)' }}>
                      {newLocCode.trim().toUpperCase() || 'CODE-01'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--success-700)', fontWeight: 700 }}>
                      ● Ready for Billing
                    </span>
                  </div>
                </div>

                {/* Section 1: Identification */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Branch Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 600 }}
                      placeholder="e.g. BR-03"
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Branch / Outlet Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Airport Express Counter"
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Section 2: Address & Contact */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Physical Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      placeholder="e.g. Terminal 3 Arrivals, New Delhi"
                      value={newLocAddress}
                      onChange={(e) => setNewLocAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Phone / Counter Contact</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      placeholder="e.g. +91 98765 00000"
                      value={newLocPhone}
                      onChange={(e) => setNewLocPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Info Callout */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--neutral-50)',
                  border: '1px solid var(--neutral-200)',
                  fontSize: '0.78rem',
                  color: 'var(--neutral-600)',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <Info size={16} color="var(--primary-600)" style={{ flexShrink: 0 }} />
                  <span>
                    New branches are active upon creation and will immediately be available for POS sales checkout and stock allocation.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'var(--neutral-50)',
                borderTop: '1px solid var(--neutral-200)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsLocModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={16} />
                  <span>Save Branch Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Branch Location */}
      {isEditLocModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 540, padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
                }}>
                  <Edit3 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                    Edit Branch Location Details
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                    Update outlet naming, branch identifier code, address, or phone.
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', color: 'var(--neutral-400)', padding: 4 }}
                onClick={() => setIsEditLocModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditLocation}>
              <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {editLocFormError && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: 'var(--danger-50)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger-700)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{editLocFormError}</span>
                  </div>
                )}

                {/* Section 1: Identification */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Branch Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 600 }}
                      value={editLocCode}
                      onChange={(e) => setEditLocCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Branch / Outlet Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editLocName}
                      onChange={(e) => setEditLocName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Section 2: Address & Contact */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Physical Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      value={editLocAddress}
                      onChange={(e) => setEditLocAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Phone / Counter Contact</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} color="var(--neutral-400)" style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 36 }}
                      value={editLocPhone}
                      onChange={(e) => setEditLocPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: 'var(--neutral-50)',
                borderTop: '1px solid var(--neutral-200)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsEditLocModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Edit3 size={16} />
                  <span>Update Branch Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Custom Confirmation & Action Dialog */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 460, padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid var(--neutral-200)',
              backgroundColor: confirmModal.confirmBtnClass === 'btn-danger' ? 'var(--danger-50)' : 'var(--neutral-50)'
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: confirmModal.confirmBtnClass === 'btn-danger' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: confirmModal.confirmBtnClass === 'btn-danger' ? 'var(--danger-600)' : 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {confirmModal.type === 'ALERT_NOTICE' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--neutral-900)', margin: 0 }}>
                {confirmModal.title}
              </h3>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--neutral-800)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {confirmModal.message}
              </p>
              {confirmModal.subMessage && (
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', margin: 0, lineHeight: 1.4, backgroundColor: 'var(--neutral-50)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--neutral-200)' }}>
                  {confirmModal.subMessage}
                </p>
              )}
            </div>

            <div style={{
              padding: '12px 20px',
              backgroundColor: 'var(--neutral-50)',
              borderTop: '1px solid var(--neutral-200)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              {confirmModal.type !== 'ALERT_NOTICE' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className={`btn ${confirmModal.confirmBtnClass || 'btn-primary'}`}
                onClick={confirmModal.type === 'ALERT_NOTICE' ? () => setConfirmModal(prev => ({ ...prev, isOpen: false })) : handleExecuteConfirm}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Catalog & Inventory to Branch Modal */}
      <SyncInventoryModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        targetLocation={syncTargetLocation}
        onSuccess={async () => {
          await loadData();
        }}
      />
    </div>
  );
};

