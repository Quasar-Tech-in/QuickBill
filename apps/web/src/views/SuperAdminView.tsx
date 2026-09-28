import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Building, 
  Plus, 
  Database, 
  Server, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search, 
  Sparkles, 
  X,
  Layers,
  KeyRound,
  ExternalLink,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  CreditCard,
  Sliders,
  Eye,
  Check,
  UserCheck,
  MapPin,
  FileText,
  Lock,
  Edit3,
  Power,
  Shield,
  Zap,
  Tag,
  Receipt,
  ShoppingCart,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { store } from '../services/store';
import { Tenant, TenantDatabaseConfig, PlanTier, BillingCycle, SubscriptionStatus } from '../types';

interface SuperAdminViewProps {
  onTenantSwitched: (tenant: Tenant) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onTenantSwitched }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tenants' | 'subscriptions' | 'profile' | 'simulator' | 'clusters'>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>(store.getTenants());
  const [activeTenant, setActiveTenant] = useState<Tenant>(store.getActiveTenant());
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [subExpiryFilter, setSubExpiryFilter] = useState<'ALL' | 'EXPIRING_7' | 'EXPIRING_30' | 'EXPIRED' | 'ACTIVE'>('ALL');
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTestDbOpen, setIsTestDbOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false);
  const [isResetPwModalOpen, setIsResetPwModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    initialPassword: '',
    phone: '',
    gstin: '',
    address: '',
    plan: 'PROFESSIONAL' as PlanTier,
    maxUsers: 5,
    maxLocations: 3,
    durationDays: 365,
    billingCycle: 'ANNUAL' as BillingCycle,
    isolationMode: 'SHARED' as 'SHARED' | 'DEDICATED_DATABASE' | 'CUSTOM_CLUSTER',
    mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin',
    databaseName: 'quickbill_db',
  });

  // Renewal Modal Form State
  const [renewalForm, setRenewalForm] = useState({
    extendOption: '30_DAYS' as '30_DAYS' | '90_DAYS' | '1_YEAR' | 'CUSTOM_DATE',
    customEndDate: '',
    plan: 'PROFESSIONAL' as PlanTier,
    maxUsers: 5,
    maxLocations: 3,
    billingCycle: 'ANNUAL' as BillingCycle,
    amount: 2499,
    notes: '',
  });

  // Edit Tenant Profile State
  const [editTenantForm, setEditTenantForm] = useState({
    name: '',
    adminEmail: '',
    phone: '',
    gstin: '',
    address: '',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
    plan: 'PROFESSIONAL' as PlanTier,
  });

  // Reset Admin Password State
  const [resetPwForm, setResetPwForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Super Admin Profile State
  const currentUser = store.getCurrentUser();
  const [adminProfile, setAdminProfile] = useState({
    name: currentUser?.name || 'Global Super Administrator',
    email: currentUser?.email || 'superadmin@quickbill.local',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // DB Test State
  const [testUri, setTestUri] = useState('mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin');
  const [testDbName, setTestDbName] = useState('quickbill_db');
  const [testResult, setTestResult] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null);

  // Tenant Simulator State
  const [simulatorTenantId, setSimulatorTenantId] = useState<string>(tenants[0]?.id || '');

  const platformStats = store.getPlatformStats();

  const refreshTenants = async () => {
    await store.fetchTenants();
    setTenants(store.getTenants());
    setActiveTenant(store.getActiveTenant());
  };

  useEffect(() => {
    refreshTenants();
  }, []);

  const showToast = (type: 'success' | 'danger' | 'info', text: string) => {
    setNotificationMsg({ type, text });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Filtered Tenants List
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.adminEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPlan = planFilter === 'ALL' || t.plan === planFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    let matchesExpiry = true;
    const days = t.subscription?.daysRemaining ?? 365;
    if (subExpiryFilter === 'EXPIRING_7') {
      matchesExpiry = days >= 0 && days <= 7;
    } else if (subExpiryFilter === 'EXPIRING_30') {
      matchesExpiry = days >= 0 && days <= 30;
    } else if (subExpiryFilter === 'EXPIRED') {
      matchesExpiry = days < 0;
    } else if (subExpiryFilter === 'ACTIVE') {
      matchesExpiry = days > 14 && t.status === 'ACTIVE';
    }

    return matchesSearch && matchesPlan && matchesStatus && matchesExpiry;
  });

  // Handle Create Tenant
  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.name.trim() || !newTenant.adminEmail.trim()) return;

    const slug = newTenant.slug.trim() || newTenant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dbName = newTenant.isolationMode === 'SHARED' 
      ? 'quickbill_db' 
      : (newTenant.databaseName || `quickbill_${slug.replace(/-/g, '_')}_db`);

    store.addTenant({
      name: newTenant.name,
      slug,
      adminEmail: newTenant.adminEmail,
      phone: newTenant.phone,
      gstin: newTenant.gstin,
      address: newTenant.address,
      plan: newTenant.plan,
      maxUsers: newTenant.maxUsers,
      maxLocations: newTenant.maxLocations,
      durationDays: newTenant.durationDays,
      billingCycle: newTenant.billingCycle,
      databaseConfig: {
        isolationMode: newTenant.isolationMode,
        mongodbUri: newTenant.mongodbUri,
        databaseName: dbName,
      },
      initialPassword: newTenant.initialPassword || 'StoreAdmin@2026',
    });

    refreshTenants();
    setIsCreateModalOpen(false);
    showToast('success', `Business tenant "${newTenant.name}" provisioned successfully with ${newTenant.plan} license!`);
    
    // Reset Form
    setNewTenant({
      name: '',
      slug: '',
      adminEmail: '',
      initialPassword: '',
      phone: '',
      gstin: '',
      address: '',
      plan: 'PROFESSIONAL',
      maxUsers: 5,
      maxLocations: 3,
      durationDays: 365,
      billingCycle: 'ANNUAL',
      isolationMode: 'SHARED',
      mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin',
      databaseName: 'quickbill_db',
    });
  };

  // Open Renewal Modal
  const openRenewalModal = (t: Tenant) => {
    setSelectedTenant(t);
    const sub = t.subscription;
    const currentEnd = sub?.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : '';
    setRenewalForm({
      extendOption: '30_DAYS',
      customEndDate: currentEnd,
      plan: t.plan || 'PROFESSIONAL',
      maxUsers: sub?.maxUsers || (t.plan === 'STARTER' ? 2 : (t.plan === 'ENTERPRISE' ? 25 : 5)),
      maxLocations: sub?.maxLocations || (t.plan === 'STARTER' ? 1 : (t.plan === 'ENTERPRISE' ? 10 : 3)),
      billingCycle: sub?.billingCycle || 'ANNUAL',
      amount: t.plan === 'ENTERPRISE' ? 49999 : (t.plan === 'PROFESSIONAL' ? 2499 : 999),
      notes: '',
    });
    setIsRenewalModalOpen(true);
  };

  // Execute Renewal
  const handleExecuteRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    let extendDays: number | undefined;
    let newEndDate: string | undefined;

    if (renewalForm.extendOption === '30_DAYS') {
      extendDays = 30;
    } else if (renewalForm.extendOption === '90_DAYS') {
      extendDays = 90;
    } else if (renewalForm.extendOption === '1_YEAR') {
      extendDays = 365;
    } else if (renewalForm.extendOption === 'CUSTOM_DATE' && renewalForm.customEndDate) {
      newEndDate = new Date(renewalForm.customEndDate).toISOString();
    }

    const res = await store.renewTenantSubscription(selectedTenant.id, {
      extendDays,
      newEndDate,
      plan: renewalForm.plan,
      maxUsers: renewalForm.maxUsers,
      maxLocations: renewalForm.maxLocations,
      amount: renewalForm.amount,
      billingCycle: renewalForm.billingCycle,
      notes: renewalForm.notes || `License renewed via Super Admin panel`,
    });

    if (res.success) {
      refreshTenants();
      setIsRenewalModalOpen(false);
      showToast('success', res.message);
    } else {
      showToast('danger', res.message);
    }
  };

  // Quick 30-Day Extension Action
  const handleQuickExtend30Days = async (t: Tenant) => {
    const res = await store.renewTenantSubscription(t.id, {
      extendDays: 30,
      notes: '+30 Days Quick Renewal by Super Admin',
    });
    if (res.success) {
      refreshTenants();
      showToast('success', `Extended ${t.name} license by +30 Days.`);
    }
  };

  // Quick 1-Year Extension Action
  const handleQuickExtend1Year = async (t: Tenant) => {
    const res = await store.renewTenantSubscription(t.id, {
      extendDays: 365,
      notes: '+1 Year Annual Renewal by Super Admin',
    });
    if (res.success) {
      refreshTenants();
      showToast('success', `Extended ${t.name} license by +1 Year (Annual).`);
    }
  };

  // Open Edit Tenant Modal
  const openEditTenantModal = (t: Tenant) => {
    setSelectedTenant(t);
    setEditTenantForm({
      name: t.name,
      adminEmail: t.adminEmail,
      phone: t.phone || '',
      gstin: t.gstin || '',
      address: t.address || '',
      status: t.status,
      plan: t.plan,
    });
    setIsEditTenantModalOpen(true);
  };

  // Save Edit Tenant
  const handleSaveEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    await store.updateTenantProfile({
      name: editTenantForm.name,
      email: editTenantForm.adminEmail,
      phone: editTenantForm.phone,
      gstin: editTenantForm.gstin,
      address: editTenantForm.address,
      status: editTenantForm.status,
      plan: editTenantForm.plan,
    });

    refreshTenants();
    setIsEditTenantModalOpen(false);
    showToast('success', `Store profile for ${editTenantForm.name} updated successfully.`);
  };

  // Toggle Tenant Active / Suspended
  const handleToggleStatus = async (t: Tenant) => {
    const updated = await store.toggleTenantStatus(t.id);
    if (updated) {
      refreshTenants();
      showToast('info', `Store "${t.name}" status changed to ${updated.status}.`);
    }
  };

  // Reset Tenant Admin Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    if (resetPwForm.newPassword.length < 6) {
      showToast('danger', 'Password must be at least 6 characters long.');
      return;
    }
    if (resetPwForm.newPassword !== resetPwForm.confirmPassword) {
      showToast('danger', 'Passwords do not match.');
      return;
    }

    const res = await store.resetTenantAdminPassword(selectedTenant.id, resetPwForm.newPassword);
    setIsResetPwModalOpen(false);
    setResetPwForm({ newPassword: '', confirmPassword: '' });
    showToast('success', res.message);
  };

  // Test Mongo Connection
  const handleTestConnection = async (uri: string, dbName: string) => {
    setTestResult({ testing: true });
    const res = await store.testMongoConnection(uri, dbName);
    setTestResult({ testing: false, success: res.success, message: res.message });
  };

  // Switch Active Tenant
  const handleSwitchTenant = (tenant: Tenant) => {
    const switched = store.switchActiveTenant(tenant.id);
    if (switched) {
      setActiveTenant(switched);
      onTenantSwitched(switched);
      showToast('success', `Switched context to ${tenant.name}. Super Admin workspace mode active.`);
    }
  };

  // Save Super Admin Profile
  const handleSaveAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminProfile.newPassword && adminProfile.newPassword !== adminProfile.confirmNewPassword) {
      showToast('danger', 'New passwords do not match.');
      return;
    }
    setProfileSaveSuccess(true);
    setTimeout(() => setProfileSaveSuccess(false), 3000);
    showToast('success', 'Super Admin profile preferences updated.');
  };

  const getStatusBadge = (status: SubscriptionStatus | string, daysRemaining?: number) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="badge badge-paid" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
            Active ({daysRemaining !== undefined ? `${daysRemaining}d left` : 'Valid'})
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="badge badge-partial" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            Expiring ({daysRemaining}d left)
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} />
            Grace Period ({Math.abs(daysRemaining || 0)}d past)
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={11} />
            License Expired
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
            Suspended
          </span>
        );
      default:
        return <span className="badge badge-paid">Active</span>;
    }
  };

  const getPlanBadge = (plan: string) => {
    const isEnt = plan === 'ENTERPRISE';
    const isPro = plan === 'PROFESSIONAL';
    const isCustom = plan === 'CUSTOM';
    return (
      <span 
        style={{ 
          fontSize: '0.72rem', 
          fontWeight: 700, 
          padding: '3px 8px', 
          borderRadius: 6, 
          backgroundColor: isEnt ? '#ede9fe' : (isPro ? '#e0e7ff' : (isCustom ? '#fef3c7' : 'var(--neutral-100)')),
          color: isEnt ? '#6d28d9' : (isPro ? '#3730a3' : (isCustom ? '#92400e' : 'var(--neutral-700)')),
          border: '1px solid rgba(0,0,0,0.06)'
        }}
      >
        {isEnt ? '⚡ ENTERPRISE' : (isPro ? '⭐ PROFESSIONAL' : (isCustom ? '🛠️ CUSTOM' : '🌱 STARTER'))}
      </span>
    );
  };

  return (
    <div className="page-container" style={{ paddingBottom: 60 }}>
      {/* Toast Notification Alert */}
      {notificationMsg && (
        <div 
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99999,
            padding: '12px 20px',
            borderRadius: 12,
            backgroundColor: notificationMsg.type === 'success' ? '#065f46' : (notificationMsg.type === 'danger' ? '#991b1b' : '#1e1b4b'),
            color: '#ffffff',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.88rem',
            fontWeight: 600,
            animation: 'slideUp 0.25s ease-out'
          }}
        >
          {notificationMsg.type === 'success' ? <CheckCircle2 size={18} color="#34d399" /> : <AlertTriangle size={18} color="#fca5a5" />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* Top Banner Hero */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: 24,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          border: '1px solid rgba(255, 255, 255, 0.12)'
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(79, 70, 229, 0.35)', padding: '4px 12px', borderRadius: 'var(--radius-full)', marginBottom: 10, border: '1px solid rgba(165, 180, 252, 0.2)' }}>
            <ShieldCheck size={14} color="#a5b4fc" />
            <span style={{ fontSize: '0.75rem', color: '#e0e7ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Root Super Admin Control Plane
            </span>
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Platform Governance & License Hub
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: 6, maxWidth: 680, lineHeight: 1.5 }}>
            Centrally manage tenant businesses, monitor live license expiration countdowns, enforce user and location quotas, and provision isolated MongoDB clusters.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} />
            <span>Provision New Store</span>
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setIsTestDbOpen(true)}
          >
            <Database size={16} />
            <span>Test DB Cluster</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar (Standard Platform UI) */}
      <div style={{ display: 'flex', background: 'var(--neutral-100)', padding: 4, borderRadius: 'var(--radius-md)', gap: 4, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'tenants' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('tenants')}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Building size={14} />
          <span>Tenant Stores ({tenants.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'subscriptions' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('subscriptions')}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <CreditCard size={14} />
          <span>Licenses & Subscriptions</span>
          {platformStats.expiringSubscriptionsCount > 0 && (
            <span style={{ 
              fontSize: '0.68rem', 
              padding: '1px 6px', 
              borderRadius: 8, 
              backgroundColor: activeTab === 'subscriptions' ? '#ffffff' : '#fef3c7', 
              color: activeTab === 'subscriptions' ? 'var(--primary-600)' : '#b45309', 
              fontWeight: 800 
            }}>
              {platformStats.expiringSubscriptionsCount} Expiring
            </span>
          )}
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'simulator' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('simulator')}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Eye size={14} />
          <span>Grouped Tenant Simulator</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('profile')}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <ShieldCheck size={14} />
          <span>Super Admin Profile & Security</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'clusters' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('clusters')}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Database size={14} />
          <span>Multi-Cluster Telemetry</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TENANT DIRECTORY & MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'tenants' && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                <Building size={20} />
              </div>
              <div>
                <h3 className="card-title">Provisioned Business Stores & Quotas</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: 0 }}>
                  Active context: <strong style={{ color: 'var(--primary-600)' }}>{activeTenant.name} ({activeTenant.slug})</strong>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--neutral-400)' }} />
                <input
                  type="text"
                  placeholder="Search store, email..."
                  className="form-input"
                  style={{ paddingLeft: 32, fontSize: '0.82rem', padding: '6px 10px 6px 32px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Plan Filter */}
              <select
                className="form-select"
                style={{ fontSize: '0.82rem', padding: '6px 10px', width: 140 }}
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <option value="ALL">All Plan Tiers</option>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
                <option value="CUSTOM">Custom</option>
              </select>

              {/* Status Filter */}
              <select
                className="form-select"
                style={{ fontSize: '0.82rem', padding: '6px 10px', width: 130 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Store / Business</th>
                  <th>Plan & License</th>
                  <th>Users Quota</th>
                  <th>Branches Quota</th>
                  <th>Database Isolation</th>
                  <th>Monthly GMV</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Governance Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--neutral-400)' }}>
                      No business tenants match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isCurrent = t.id === activeTenant.id;
                    const sub = t.subscription;
                    const maxUsers = sub?.maxUsers || 5;
                    const currentUsers = t.stats.usersCount || 1;
                    const maxLocs = sub?.maxLocations || 3;
                    const currentLocs = t.stats.locationsCount || 1;

                    const isUsersMaxed = currentUsers >= maxUsers;
                    const isLocsMaxed = currentLocs >= maxLocs;

                    return (
                      <tr key={t.id} style={{ backgroundColor: isCurrent ? 'var(--primary-50)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.88rem' }}>
                              {t.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', backgroundColor: 'var(--neutral-100)', padding: '1px 5px', borderRadius: 4 }}>
                                {t.slug}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                                {t.adminEmail}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            {getPlanBadge(t.plan)}
                            {getStatusBadge(sub?.status || 'ACTIVE', sub?.daysRemaining)}
                          </div>
                        </td>

                        {/* Users Quota Progress */}
                        <td style={{ minWidth: 120 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: 3 }}>
                            <span>{currentUsers} / {maxUsers} Staff</span>
                            {isUsersMaxed && <span style={{ color: '#dc2626', fontSize: '0.7rem' }}>Capped</span>}
                          </div>
                          <div style={{ width: '100%', height: 6, backgroundColor: 'var(--neutral-200)', borderRadius: 3, overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${Math.min(100, (currentUsers / maxUsers) * 100)}%`, 
                                height: '100%', 
                                backgroundColor: isUsersMaxed ? '#ef4444' : 'var(--primary-600)',
                                borderRadius: 3 
                              }} 
                            />
                          </div>
                        </td>

                        {/* Locations Quota Progress */}
                        <td style={{ minWidth: 120 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: 3 }}>
                            <span>{currentLocs} / {maxLocs} Outlets</span>
                            {isLocsMaxed && <span style={{ color: '#dc2626', fontSize: '0.7rem' }}>Capped</span>}
                          </div>
                          <div style={{ width: '100%', height: 6, backgroundColor: 'var(--neutral-200)', borderRadius: 3, overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${Math.min(100, (currentLocs / maxLocs) * 100)}%`, 
                                height: '100%', 
                                backgroundColor: isLocsMaxed ? '#ef4444' : '#10b981',
                                borderRadius: 3 
                              }} 
                            />
                          </div>
                        </td>

                        {/* Database Isolation */}
                        <td>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 4,
                              backgroundColor: 
                                t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? 'var(--success-50)' :
                                t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? 'var(--primary-50)' : 'var(--neutral-100)',
                              color:
                                t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? 'var(--success-700)' :
                                t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? 'var(--primary-700)' : 'var(--neutral-700)'
                            }}
                          >
                            {t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? '⚡ Cluster' :
                             t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? '🗄️ Isolated DB' : '🔗 Shared DB'}
                          </span>
                        </td>

                        {/* GMV */}
                        <td style={{ fontWeight: 800, color: 'var(--primary-600)', fontSize: '0.88rem' }}>
                          ₹{t.stats.monthlyGmv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Store Status */}
                        <td>
                          <button
                            onClick={() => handleToggleStatus(t)}
                            title="Click to toggle Active / Suspended status"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            {t.status === 'ACTIVE' ? (
                              <span className="badge badge-paid" style={{ cursor: 'pointer' }}>✓ Active</span>
                            ) : (
                              <span className="badge badge-danger" style={{ cursor: 'pointer' }}>⏸ Suspended</span>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                              onClick={() => navigate(`/workspace-preview?tenantId=${t.id}`)}
                              title="Inspect and test this store's live workspace preview"
                            >
                              <Sparkles size={13} />
                              <span>Preview</span>
                            </button>

                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                              onClick={() => openRenewalModal(t)}
                              title="Manage subscription and extend license"
                            >
                              <CreditCard size={13} />
                            </button>

                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                              onClick={() => openEditTenantModal(t)}
                              title="Edit business store profile"
                            >
                              <Edit3 size={13} />
                            </button>

                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '5px 8px' }}
                              onClick={() => {
                                setSelectedTenant(t);
                                setIsResetPwModalOpen(true);
                              }}
                              title="Reset Store Admin Password"
                            >
                              <KeyRound size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBSCRIPTION & LICENSE LIFECYCLE MONITOR */}
      {/* ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Subscriptions Filter Pills & Quick KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div 
              className={`card ${subExpiryFilter === 'ALL' ? 'border-primary' : ''}`}
              style={{ padding: 18, cursor: 'pointer', border: subExpiryFilter === 'ALL' ? '2px solid var(--primary-500)' : undefined }}
              onClick={() => setSubExpiryFilter('ALL')}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase' }}>All Subscriptions</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: 'var(--neutral-900)' }}>
                {tenants.length} Licenses
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary-600)' }}>View full catalog</span>
            </div>

            <div 
              className={`card ${subExpiryFilter === 'EXPIRING_7' ? 'border-primary' : ''}`}
              style={{ padding: 18, cursor: 'pointer', border: subExpiryFilter === 'EXPIRING_7' ? '2px solid #f59e0b' : undefined, backgroundColor: '#fffbeb' }}
              onClick={() => setSubExpiryFilter('EXPIRING_7')}
            >
              <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>Expiring ≤ 7 Days</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#b45309' }}>
                {tenants.filter(t => (t.subscription?.daysRemaining ?? 365) >= 0 && (t.subscription?.daysRemaining ?? 365) <= 7).length} Stores
              </div>
              <span style={{ fontSize: '0.75rem', color: '#92400e' }}>Requires prompt renewal</span>
            </div>

            <div 
              className={`card ${subExpiryFilter === 'EXPIRING_30' ? 'border-primary' : ''}`}
              style={{ padding: 18, cursor: 'pointer', border: subExpiryFilter === 'EXPIRING_30' ? '2px solid var(--primary-500)' : undefined }}
              onClick={() => setSubExpiryFilter('EXPIRING_30')}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase' }}>Expiring This Month</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: 'var(--neutral-900)' }}>
                {tenants.filter(t => (t.subscription?.daysRemaining ?? 365) >= 0 && (t.subscription?.daysRemaining ?? 365) <= 30).length} Stores
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Upcoming renewals</span>
            </div>

            <div 
              className={`card ${subExpiryFilter === 'EXPIRED' ? 'border-primary' : ''}`}
              style={{ padding: 18, cursor: 'pointer', border: subExpiryFilter === 'EXPIRED' ? '2px solid #ef4444' : undefined, backgroundColor: '#fef2f2' }}
              onClick={() => setSubExpiryFilter('EXPIRED')}
            >
              <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>Grace / Expired</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: '#b91c1c' }}>
                {tenants.filter(t => (t.subscription?.daysRemaining ?? 365) < 0).length} Stores
              </div>
              <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>Grace period or locked</span>
            </div>
          </div>

          {/* Subscriptions & Expiry Table */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={20} color="var(--primary-600)" />
                <div>
                  <h3 className="card-title">Tenant License Timeline & Renewal Desk</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: 0 }}>
                    Monitor license expiration countdowns and execute 1-click renewals or quota expansions
                  </p>
                </div>
              </div>

              {subExpiryFilter !== 'ALL' && (
                <button 
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSubExpiryFilter('ALL')}
                >
                  Clear Filter (Showing {filteredTenants.length})
                </button>
              )}
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Store Name</th>
                    <th>Plan Tier</th>
                    <th>License Start</th>
                    <th>Expiration Date</th>
                    <th>Days Remaining</th>
                    <th>Billing Cycle</th>
                    <th>Users & Loc Limits</th>
                    <th style={{ textAlign: 'right' }}>Quick Renewal Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => {
                    const sub = t.subscription;
                    const days = sub?.daysRemaining ?? 365;
                    const endDateStr = sub?.endDate ? new Date(sub.endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
                    const startDateStr = sub?.startDate ? new Date(sub.startDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

                    return (
                      <tr key={t.id}>
                        <td>
                          <strong style={{ color: 'var(--neutral-900)' }}>{t.name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>{t.adminEmail}</div>
                        </td>

                        <td>{getPlanBadge(t.plan)}</td>

                        <td style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>
                          {startDateStr}
                        </td>

                        <td style={{ fontSize: '0.82rem', fontWeight: 700, color: days <= 7 ? '#dc2626' : 'var(--neutral-800)' }}>
                          {endDateStr}
                        </td>

                        <td>
                          {getStatusBadge(sub?.status || 'ACTIVE', days)}
                        </td>

                        <td>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)', textTransform: 'capitalize' }}>
                            {sub?.billingCycle || 'Annual'}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontSize: '0.75rem', color: 'var(--neutral-700)' }}>
                            <span><strong>{sub?.maxUsers || 5}</strong> Users</span> • <span><strong>{sub?.maxLocations || 3}</strong> Branches</span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '4px 8px', backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                              onClick={() => handleQuickExtend30Days(t)}
                              title="Extend subscription by 30 days immediately"
                            >
                              +30 Days
                            </button>

                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '4px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}
                              onClick={() => handleQuickExtend1Year(t)}
                              title="Extend subscription by 1 Year immediately"
                            >
                              +1 Year
                            </button>

                            <button
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                              onClick={() => openRenewalModal(t)}
                            >
                              Custom / Upgrade
                            </button>

                            {sub?.renewalHistory && sub.renewalHistory.length > 0 && (
                              <button
                                className="btn btn-sm btn-ghost"
                                style={{ fontSize: '0.72rem', padding: '4px 6px' }}
                                onClick={() => {
                                  setSelectedTenant(t);
                                  setIsHistoryModalOpen(true);
                                }}
                                title="View license renewal history audit logs"
                              >
                                📜
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GROUPED TENANT SIMULATOR (WHAT TENANTS CAN SEE) */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Tenant Selector & Launch Bar */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--neutral-900)' }}>
                  Tenant Feature Simulator & Preview
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', marginTop: 4 }}>
                  Select any provisioned tenant to preview their enabled modules, quotas, and launch directly into their store workspace.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select
                  className="form-select"
                  style={{ minWidth: 260, fontWeight: 600 }}
                  value={simulatorTenantId}
                  onChange={(e) => setSimulatorTenantId(e.target.value)}
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.plan} • {t.subscription?.status || 'ACTIVE'})
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    navigate(`/workspace-preview?tenantId=${simulatorTenantId}`);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontWeight: 700 }}
                >
                  <Sparkles size={16} />
                  <span>Open Interactive Workspace Preview</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feature Matrix Breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Tenant Tier Feature & Visibility Matrix</h3>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Module / Capability</th>
                    <th>Starter Tier</th>
                    <th>Professional Tier</th>
                    <th>Enterprise Tier</th>
                    <th>Custom Tier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>POS Counter Billing & Quick Sale</strong></td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Standard POS</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Multi-counter POS</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> High-throughput POS</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Unlimited POS</td>
                  </tr>
                  <tr>
                    <td><strong>Max Staff Users Allowed (`maxUsers`)</strong></td>
                    <td><span className="badge">Max 2 Users</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>Max 5 Users</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}>Max 25 Users</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Custom Configurable</span></td>
                  </tr>
                  <tr>
                    <td><strong>Store Branches / Locations (`maxLocations`)</strong></td>
                    <td><span className="badge">1 Location</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>Up to 3 Outlets</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}>Up to 10 Outlets</span></td>
                    <td><span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Unlimited Outlets</span></td>
                  </tr>
                  <tr>
                    <td><strong>Multi-Location Inventory Sync</strong></td>
                    <td><XCircle size={16} color="#94a3b8" /> Disabled</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Enabled</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Real-time Global Sync</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Real-time Global Sync</td>
                  </tr>
                  <tr>
                    <td><strong>Purchase Orders & Lot Tracking</strong></td>
                    <td><XCircle size={16} color="#94a3b8" /> Basic Items</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> POs & Suppliers</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Full FIFO & Batch Track</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Full FIFO & Batch Track</td>
                  </tr>
                  <tr>
                    <td><strong>Party CRM & Ledgers</strong></td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Customers only</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Customers & Suppliers</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Complete Double-Entry</td>
                    <td><CheckCircle2 size={16} color="#10b981" /> Complete Double-Entry</td>
                  </tr>
                  <tr>
                    <td><strong>Database Isolation Architecture</strong></td>
                    <td>Shared Tenant DB</td>
                    <td>Shared or Isolated DB</td>
                    <td>Dedicated DB or Cluster</td>
                    <td>Custom MongoDB Cluster URI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPER ADMIN PROFILE & SECURITY */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Admin Identity Card */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} color="var(--primary-600)" />
                <h3 className="card-title">Super Administrator Account</h3>
              </div>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div 
                  style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: 16, 
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#ffffff',
                    fontSize: '1.8rem',
                    boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  ⚡
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{adminProfile.name}</h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--neutral-500)' }}>{adminProfile.email}</p>
                  <span className="badge" style={{ marginTop: 6, backgroundColor: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}>
                    👑 SYSTEM ROOT PRIVILEGE
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--neutral-500)' }}>Role Authority:</span>
                  <strong>SUPER_ADMIN (Unrestricted)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--neutral-500)' }}>Primary Root Database:</span>
                  <code style={{ fontSize: '0.75rem' }}>quickbill_db</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--neutral-500)' }}>Session Status:</span>
                  <span className="badge badge-paid">Active & Authenticated</span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Credentials & Preferences Form */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={18} color="var(--primary-600)" />
                <h3 className="card-title">Root Security & Credentials</h3>
              </div>
            </div>

            <form onSubmit={handleSaveAdminProfile} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {profileSaveSuccess && (
                <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#f0fdf4', color: '#166534', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Super Administrator Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={adminProfile.name}
                  onChange={(e) => setAdminProfile({ ...adminProfile, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Master Root Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={adminProfile.email}
                  onChange={(e) => setAdminProfile({ ...adminProfile, email: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 14 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>
                  Update Root Password (Optional)
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={adminProfile.newPassword}
                      onChange={(e) => setAdminProfile({ ...adminProfile, newPassword: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Confirm Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={adminProfile.confirmNewPassword}
                      onChange={(e) => setAdminProfile({ ...adminProfile, confirmNewPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
                Save Profile Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MULTI-CLUSTER TELEMETRY */}
      {/* ========================================================================= */}
      {activeTab === 'clusters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={20} color="var(--primary-600)" />
                <div>
                  <h3 className="card-title">MongoDB Multi-Tenant Cluster Diagnostics</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: 0 }}>
                    Real-time verification of dedicated tenant databases and cluster link availability
                  </p>
                </div>
              </div>

              <button 
                className="btn btn-secondary"
                onClick={() => handleTestConnection(testUri, testDbName)}
              >
                <RefreshCw size={14} className={testResult?.testing ? 'spin' : ''} />
                <span>Run Ping Test</span>
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">MongoDB Connection String</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={testUri}
                    onChange={(e) => setTestUri(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Database Name</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={testDbName}
                    onChange={(e) => setTestDbName(e.target.value)}
                  />
                </div>
              </div>

              {testResult && (
                <div 
                  style={{ 
                    padding: 14, 
                    borderRadius: 8, 
                    backgroundColor: testResult.testing ? 'var(--neutral-50)' : (testResult.success ? '#f0fdf4' : '#fef2f2'),
                    border: `1px solid ${testResult.testing ? 'var(--neutral-200)' : (testResult.success ? '#bbf7d0' : '#fca5a5')}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  {testResult.testing ? (
                    <RefreshCw size={16} className="spin" color="var(--primary-600)" />
                  ) : testResult.success ? (
                    <CheckCircle2 size={18} color="#16a34a" />
                  ) : (
                    <XCircle size={18} color="#dc2626" />
                  )}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: testResult.success ? '#15803d' : '#b91c1c' }}>
                    {testResult.testing ? 'Establishing connection to MongoDB cluster...' : testResult.message}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PROVISION NEW TENANT */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <Building size={18} />
                </div>
                <div>
                  <h3 className="card-title">Provision New Business Store</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: 0 }}>Create an isolated store with custom subscription quotas</p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                {/* 1. Business Profile */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    1. Store Information & Identity
                  </span>

                  <div className="form-group" style={{ marginTop: 10 }}>
                    <label className="form-label">Store / Company Name *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Apex Hypermarket South"
                      value={newTenant.name}
                      onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                      autoFocus
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Store Slug / Identifier</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. apex-south-02"
                        value={newTenant.slug}
                        onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GSTIN / Tax ID</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="07AABCB1234F1Z5"
                        value={newTenant.gstin}
                        onChange={(e) => setNewTenant({ ...newTenant, gstin: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Subscription Plan & Quotas */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    2. Subscription Tier & Quotas
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Subscription Tier</label>
                      <select
                        className="form-select"
                        value={newTenant.plan}
                        onChange={(e) => {
                          const p = e.target.value as PlanTier;
                          const u = p === 'STARTER' ? 2 : (p === 'ENTERPRISE' ? 25 : 5);
                          const l = p === 'STARTER' ? 1 : (p === 'ENTERPRISE' ? 10 : 3);
                          setNewTenant({ ...newTenant, plan: p, maxUsers: u, maxLocations: l });
                        }}
                      >
                        <option value="STARTER">Starter Tier (Single POS, 2 Users, 1 Branch)</option>
                        <option value="PROFESSIONAL">Professional Tier (Multi-Branch, 5 Users, 3 Branches)</option>
                        <option value="ENTERPRISE">Enterprise Tier (Full Suite, 25 Users, 10 Branches)</option>
                        <option value="CUSTOM">Custom Tier (Custom Limits)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">License Duration (Days)</label>
                      <select
                        className="form-select"
                        value={newTenant.durationDays}
                        onChange={(e) => setNewTenant({ ...newTenant, durationDays: Number(e.target.value) })}
                      >
                        <option value={30}>30 Days (Monthly License)</option>
                        <option value={90}>90 Days (Quarterly License)</option>
                        <option value={365}>365 Days (1 Year Annual License)</option>
                        <option value={730}>730 Days (2 Years License)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Max Staff Users Allowed (`maxUsers`)</label>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={newTenant.maxUsers}
                        onChange={(e) => setNewTenant({ ...newTenant, maxUsers: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Outlets / Locations (`maxLocations`)</label>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={newTenant.maxLocations}
                        onChange={(e) => setNewTenant({ ...newTenant, maxLocations: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Admin Account */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    3. Store Admin Credentials
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Admin Email *</label>
                      <input
                        type="email"
                        required
                        className="form-input"
                        placeholder="admin@store.com"
                        value={newTenant.adminEmail}
                        onChange={(e) => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Initial Password</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="StoreAdmin@2026"
                        value={newTenant.initialPassword}
                        onChange={(e) => setNewTenant({ ...newTenant, initialPassword: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Database Isolation */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    4. Database Isolation Architecture
                  </span>

                  <div className="form-group" style={{ marginTop: 10 }}>
                    <select
                      className="form-select"
                      value={newTenant.isolationMode}
                      onChange={(e) => setNewTenant({ ...newTenant, isolationMode: e.target.value as any })}
                    >
                      <option value="SHARED">Logical Shared Multi-Tenant Database (Fastest)</option>
                      <option value="DEDICATED_DATABASE">Isolated MongoDB Database (Per-Tenant Database)</option>
                      <option value="CUSTOM_CLUSTER">Dedicated MongoDB Cluster (Custom MongoDB URI)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--neutral-200)', flexShrink: 0, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Provision Store & Activate License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SUBSCRIPTION RENEWAL & QUOTA MODAL */}
      {/* ========================================================================= */}
      {isRenewalModalOpen && selectedTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={18} color="var(--primary-600)" />
                <div>
                  <h3 className="card-title">Renew License & Adjust Quotas</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', margin: 0 }}>
                    Store: <strong>{selectedTenant.name}</strong>
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsRenewalModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteRenewal} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                {/* Current Status Info */}
                <div style={{ backgroundColor: 'var(--neutral-50)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--neutral-500)' }}>Current Expiration:</span>
                    <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                      {selectedTenant.subscription?.endDate ? new Date(selectedTenant.subscription.endDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--neutral-500)' }}>Status:</span>
                    <div>{getStatusBadge(selectedTenant.subscription?.status || 'ACTIVE', selectedTenant.subscription?.daysRemaining)}</div>
                  </div>
                </div>

                {/* Extension Period */}
                <div className="form-group">
                  <label className="form-label">Renewal Extension Period</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${renewalForm.extendOption === '30_DAYS' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRenewalForm({ ...renewalForm, extendOption: '30_DAYS' })}
                    >
                      +30 Days (Monthly)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${renewalForm.extendOption === '90_DAYS' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRenewalForm({ ...renewalForm, extendOption: '90_DAYS' })}
                    >
                      +90 Days (Quarterly)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${renewalForm.extendOption === '1_YEAR' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRenewalForm({ ...renewalForm, extendOption: '1_YEAR' })}
                    >
                      +1 Year (Annual)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${renewalForm.extendOption === 'CUSTOM_DATE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRenewalForm({ ...renewalForm, extendOption: 'CUSTOM_DATE' })}
                    >
                      Custom Expiry Date
                    </button>
                  </div>
                </div>

                {renewalForm.extendOption === 'CUSTOM_DATE' && (
                  <div className="form-group">
                    <label className="form-label">Set New Expiration Date</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={renewalForm.customEndDate}
                      onChange={(e) => setRenewalForm({ ...renewalForm, customEndDate: e.target.value })}
                    />
                  </div>
                )}

                {/* Plan Tier Upgrade */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">License Plan Tier</label>
                    <select
                      className="form-select"
                      value={renewalForm.plan}
                      onChange={(e) => setRenewalForm({ ...renewalForm, plan: e.target.value as PlanTier })}
                    >
                      <option value="STARTER">Starter Tier</option>
                      <option value="PROFESSIONAL">Professional Tier</option>
                      <option value="ENTERPRISE">Enterprise Tier</option>
                      <option value="CUSTOM">Custom Tier</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Renewal Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={renewalForm.amount}
                      onChange={(e) => setRenewalForm({ ...renewalForm, amount: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Quota Limits */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Max Users Quota</label>
                    <input
                      type="number"
                      min={1}
                      className="form-input"
                      value={renewalForm.maxUsers}
                      onChange={(e) => setRenewalForm({ ...renewalForm, maxUsers: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Outlets Quota</label>
                    <input
                      type="number"
                      min={1}
                      className="form-input"
                      value={renewalForm.maxLocations}
                      onChange={(e) => setRenewalForm({ ...renewalForm, maxLocations: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Audit Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Annual renewal received via bank transfer"
                    value={renewalForm.notes}
                    onChange={(e) => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--neutral-200)', flexShrink: 0, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRenewalModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  Confirm License Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT TENANT PROFILE */}
      {/* ========================================================================= */}
      {isEditTenantModalOpen && selectedTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Edit3 size={18} color="var(--primary-600)" />
                <h3 className="card-title">Edit Store Profile</h3>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsEditTenantModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditTenant} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                <div className="form-group">
                  <label className="form-label">Store / Company Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editTenantForm.name}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Admin Email</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={editTenantForm.adminEmail}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, adminEmail: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editTenantForm.phone}
                      onChange={(e) => setEditTenantForm({ ...editTenantForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editTenantForm.gstin}
                      onChange={(e) => setEditTenantForm({ ...editTenantForm, gstin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editTenantForm.address}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--neutral-200)', flexShrink: 0, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditTenantModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Store Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RESET STORE ADMIN PASSWORD */}
      {/* ========================================================================= */}
      {isResetPwModalOpen && selectedTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={18} color="var(--primary-600)" />
                <h3 className="card-title">Reset Store Admin Password</h3>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsResetPwModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--neutral-600)', margin: 0 }}>
                  Reset master credentials for <strong>{selectedTenant.name}</strong> ({selectedTenant.adminEmail}).
                </p>

                <div className="form-group">
                  <label className="form-label">New Store Password</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={resetPwForm.newPassword}
                    onChange={(e) => setResetPwForm({ ...resetPwForm, newPassword: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={resetPwForm.confirmPassword}
                    onChange={(e) => setResetPwForm({ ...resetPwForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--neutral-200)', flexShrink: 0, background: 'var(--neutral-50)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsResetPwModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: RENEWAL HISTORY AUDIT */}
      {/* ========================================================================= */}
      {isHistoryModalOpen && selectedTenant && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={18} color="var(--primary-600)" />
                <h3 className="card-title">Renewal History & Audit Trail</h3>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsHistoryModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedTenant.subscription?.renewalHistory?.map((h, idx) => (
                  <div key={idx} style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Extended until {new Date(h.extendedUntil).toLocaleDateString()}</span>
                      <span style={{ color: 'var(--primary-600)' }}>{h.amount ? `₹${h.amount.toLocaleString()}` : 'Standard'}</span>
                    </div>
                    <div style={{ color: 'var(--neutral-500)', fontSize: '0.75rem', marginTop: 4 }}>
                      Date: {new Date(h.date).toLocaleString()} • Renewed by: {h.renewedBy}
                    </div>
                    {h.notes && <div style={{ color: 'var(--neutral-700)', marginTop: 4 }}>Note: {h.notes}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--neutral-200)', flexShrink: 0, background: 'var(--neutral-50)' }}>
              <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TEST MONGO CONNECTION */}
      {/* ========================================================================= */}
      {isTestDbOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={18} color="var(--primary-600)" />
                <h3 className="card-title">Test MongoDB Link</h3>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsTestDbOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', flex: 1 }}>
              <div className="form-group">
                <label className="form-label">Connection String</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={testUri}
                  onChange={(e) => setTestUri(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Database</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={testDbName}
                  onChange={(e) => setTestDbName(e.target.value)}
                />
              </div>

              {testResult && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: testResult.success ? '#f0fdf4' : '#fef2f2', color: testResult.success ? '#15803d' : '#b91c1c', fontSize: '0.82rem', fontWeight: 600 }}>
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--neutral-200)', flexShrink: 0, background: 'var(--neutral-50)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsTestDbOpen(false)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => handleTestConnection(testUri, testDbName)}>
                <RefreshCw size={14} className={testResult?.testing ? 'spin' : ''} />
                <span>Execute Ping</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
