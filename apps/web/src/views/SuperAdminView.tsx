import React, { useState } from 'react';
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
  Users
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { store } from '../services/store';
import { Tenant, TenantDatabaseConfig } from '../types';

interface SuperAdminViewProps {
  onTenantSwitched: (tenant: Tenant) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onTenantSwitched }) => {
  const [tenants, setTenants] = useState<Tenant[]>(store.getTenants());
  const [activeTenant, setActiveTenant] = useState<Tenant>(store.getActiveTenant());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Forms
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTestDbOpen, setIsTestDbOpen] = useState(false);
  
  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    initialPassword: '',
    phone: '',
    gstin: '',
    plan: 'PROFESSIONAL' as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE',
    isolationMode: 'SHARED' as 'SHARED' | 'DEDICATED_DATABASE' | 'CUSTOM_CLUSTER',
    mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin',
    databaseName: 'quickbill_db',
  });

  // DB Test State
  const [testUri, setTestUri] = useState('mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin');
  const [testDbName, setTestDbName] = useState('quickbill_db');
  const [testResult, setTestResult] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null);

  const platformStats = store.getPlatformStats();

  const refreshTenants = () => {
    setTenants(store.getTenants());
    setActiveTenant(store.getActiveTenant());
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.adminEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      plan: newTenant.plan,
      databaseConfig: {
        isolationMode: newTenant.isolationMode,
        mongodbUri: newTenant.mongodbUri,
        databaseName: dbName,
      },
      initialPassword: newTenant.initialPassword,
    });

    refreshTenants();
    setIsCreateModalOpen(false);
    setNewTenant({
      name: '',
      slug: '',
      adminEmail: '',
      initialPassword: '',
      phone: '',
      gstin: '',
      plan: 'PROFESSIONAL',
      isolationMode: 'SHARED',
      mongodbUri: 'mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin',
      databaseName: 'quickbill_db',
    });
  };

  const handleTestConnection = async (uri: string, dbName: string) => {
    setTestResult({ testing: true });
    const res = await store.testMongoConnection(uri, dbName);
    setTestResult({ testing: false, success: res.success, message: res.message });
  };

  const handleSwitchTenant = (tenant: Tenant) => {
    const switched = store.switchActiveTenant(tenant.id);
    if (switched) {
      setActiveTenant(switched);
      onTenantSwitched(switched);
    }
  };

  return (
    <div className="page-container">
      {/* Top Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: 28,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(79, 70, 229, 0.3)', padding: '4px 10px', borderRadius: 'var(--radius-full)', marginBottom: 8 }}>
            <ShieldCheck size={14} color="#a5b4fc" />
            <span style={{ fontSize: '0.75rem', color: '#c7d2fe', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Super Admin Control Plane
            </span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Multi-Tenant & Database Governance
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: 4, maxWidth: 640 }}>
            Provision isolated business stores, configure dedicated MongoDB connection strings per tenant, and monitor cross-platform statistics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={16} />
            <span>Provision New Tenant</span>
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            onClick={() => setIsTestDbOpen(true)}
          >
            <Database size={16} />
            <span>Test MongoDB Link</span>
          </button>
        </div>
      </div>

      {/* Global Platform KPIs */}
      <div className="kpi-grid">
        <MetricCard
          title="Total Provisioned Tenants"
          value={String(platformStats.totalTenants)}
          subtitle={`${platformStats.activeTenants} active businesses`}
          variant="primary"
          icon={Building}
        />
        <MetricCard
          title="Global Platform GMV"
          value={`₹${platformStats.globalCombinedGmv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Combined sales across all stores"
          variant="success"
          icon={Sparkles}
        />
        <MetricCard
          title="Total Products Cataloged"
          value={String(platformStats.totalProducts)}
          subtitle="Across all tenant inventories"
          variant="primary"
          icon={Layers}
        />
        <MetricCard
          title="Database Isolation Clusters"
          value={String(platformStats.databaseClustersCount)}
          subtitle="Active MongoDB databases & clusters"
          variant="warning"
          icon={Database}
        />
      </div>

      {/* Tenant Directory */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Building size={20} color="var(--primary-500)" />
            <div>
              <h3 className="card-title">Provisioned Business Tenants</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                Active tenant: <strong style={{ color: 'var(--primary-600)' }}>{activeTenant.name} ({activeTenant.slug})</strong>
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', width: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search store name, slug..."
              className="form-input"
              style={{ paddingLeft: 32, fontSize: '0.82rem', padding: '6px 10px 6px 32px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Store / Business</th>
                <th>Slug / Code</th>
                <th>Plan Tier</th>
                <th>Database Isolation</th>
                <th>Target Database</th>
                <th>Monthly Sales</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((t) => {
                const isCurrent = t.id === activeTenant.id;
                return (
                  <tr key={t.id} style={{ backgroundColor: isCurrent ? 'var(--primary-50)' : undefined }}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{t.name}</div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Admin: {t.adminEmail}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', backgroundColor: 'var(--neutral-100)', padding: '2px 6px', borderRadius: 4 }}>
                        {t.slug}
                      </span>
                    </td>
                    <td>
                      <span 
                        style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          padding: '3px 8px', 
                          borderRadius: 4, 
                          backgroundColor: t.plan === 'ENTERPRISE' ? '#ede9fe' : 'var(--neutral-100)',
                          color: t.plan === 'ENTERPRISE' ? '#6d28d9' : 'var(--neutral-700)'
                        }}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: 
                            t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? 'var(--success-50)' :
                            t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? 'var(--primary-50)' : 'var(--neutral-100)',
                          color:
                            t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? 'var(--success-700)' :
                            t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? 'var(--primary-700)' : 'var(--neutral-700)'
                        }}
                      >
                        {t.databaseConfig.isolationMode === 'CUSTOM_CLUSTER' ? '⚡ Dedicated Cluster' :
                         t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? '🗄️ Isolated DB' : '🔗 Shared Tenant DB'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--neutral-700)' }}>
                        {t.databaseConfig.databaseName}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--primary-600)' }}>
                      ₹{t.stats.monthlyGmv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className="badge badge-paid">Active</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className={`btn btn-sm ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                          onClick={() => handleSwitchTenant(t)}
                        >
                          {isCurrent ? '✓ Active Store' : 'Switch Store'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision New Tenant Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <Building size={18} />
                </div>
                <div>
                  <h3 className="card-title">Provision New Business Tenant</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Create an isolated store with custom database settings</p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* 1. Business Profile */}
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    1. Business Profile & Identification
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
                      <label className="form-label">Tenant Slug / Store Identifier</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. apex-south-02"
                        value={newTenant.slug}
                        onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subscription Tier</label>
                      <select
                        className="form-select"
                        value={newTenant.plan}
                        onChange={(e) => setNewTenant({ ...newTenant, plan: e.target.value as any })}
                      >
                        <option value="STARTER">Starter Tier (Single POS)</option>
                        <option value="PROFESSIONAL">Professional (Multi-Counter)</option>
                        <option value="ENTERPRISE">Enterprise (Custom DB & Unlimited)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Admin User Credentials */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    2. Store Admin Account
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Store Admin Email *</label>
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
                        placeholder="e.g. StoreAdmin@2026"
                        value={newTenant.initialPassword}
                        onChange={(e) => setNewTenant({ ...newTenant, initialPassword: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Database Isolation & MongoDB Credentials */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-600)', letterSpacing: '0.05em' }}>
                    3. Database Isolation & MongoDB Credentials
                  </span>

                  <div className="form-group" style={{ marginTop: 10 }}>
                    <label className="form-label">Data Isolation Architecture</label>
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

                  {newTenant.isolationMode !== 'SHARED' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: 'var(--neutral-50)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Custom Database Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="quickbill_tenant_db"
                          value={newTenant.databaseName}
                          onChange={(e) => setNewTenant({ ...newTenant, databaseName: e.target.value })}
                        />
                      </div>

                      {newTenant.isolationMode === 'CUSTOM_CLUSTER' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Custom MongoDB Connection URI</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
                            value={newTenant.mongodbUri}
                            onChange={(e) => setNewTenant({ ...newTenant, mongodbUri: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '9px 24px' }}>
                  Provision & Launch Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Database Connection Test Modal */}
      {isTestDbOpen && (
        <div className="modal-overlay" onClick={() => setIsTestDbOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} color="var(--primary-500)" />
                <span className="card-title">Test MongoDB Connection Link</span>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsTestDbOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">MongoDB Connection URI</label>
                <textarea
                  className="form-input"
                  rows={3}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  value={testUri}
                  onChange={(e) => setTestUri(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Database Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={testDbName}
                  onChange={(e) => setTestDbName(e.target.value)}
                />
              </div>

              {testResult && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: testResult.testing ? 'var(--neutral-100)' : testResult.success ? 'var(--success-50)' : 'var(--danger-50)',
                    border: `1px solid ${testResult.testing ? 'var(--neutral-300)' : testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  {testResult.testing ? (
                    <RefreshCw size={18} className="pulse-dot" />
                  ) : testResult.success ? (
                    <CheckCircle2 size={18} color="var(--success-700)" />
                  ) : (
                    <XCircle size={18} color="var(--danger-700)" />
                  )}
                  <p style={{ fontSize: '0.82rem', fontWeight: 600, color: testResult.success ? 'var(--success-700)' : 'var(--danger-700)' }}>
                    {testResult.testing ? 'Testing ping to MongoDB server...' : testResult.message}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsTestDbOpen(false)}>
                Close
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleTestConnection(testUri, testDbName)}
                disabled={testResult?.testing}
              >
                <RefreshCw size={14} className={testResult?.testing ? 'pulse-dot' : ''} />
                <span>Test Connection Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
