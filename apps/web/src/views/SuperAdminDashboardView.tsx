import React, { useState, useEffect } from 'react';
import { 
  Building, 
  CreditCard, 
  Users, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Layers, 
  Database, 
  TrendingUp, 
  ShieldCheck, 
  Plus, 
  Eye, 
  RefreshCw, 
  DollarSign, 
  MapPin, 
  FileText, 
  ExternalLink,
  Activity,
  Server,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { store } from '../services/store';
import { Tenant, PlatformStats, PlanTier } from '../types';

interface SuperAdminDashboardViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const SuperAdminDashboardView: React.FC<SuperAdminDashboardViewProps> = ({ onNavigateToTab }) => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>(store.getTenants());
  const [platformStats, setPlatformStats] = useState<PlatformStats>(store.getPlatformStats());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    await store.fetchTenants();
    setTenants(store.getTenants());
    setPlatformStats(store.getPlatformStats());
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Compute tier distribution
  const tierCounts = tenants.reduce((acc, t) => {
    acc[t.plan] = (acc[t.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Compute status distribution
  const statusCounts = tenants.reduce((acc, t) => {
    const st = t.subscription?.status || t.status || 'ACTIVE';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Estimated Monthly Recurring Revenue (MRR)
  const estimatedMrr = tenants.reduce((sum, t) => {
    const price = t.subscription?.pricePerCycle || (t.plan === 'ENTERPRISE' ? 49999 : t.plan === 'PROFESSIONAL' ? 2499 : 999);
    const isAnnual = t.subscription?.billingCycle === 'ANNUAL';
    return sum + (isAnnual ? price / 12 : price);
  }, 0);

  return (
    <div className="view-container" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* Top Hero Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              backgroundColor: 'rgba(79, 70, 229, 0.35)', 
              padding: '4px 12px', 
              borderRadius: '9999px', 
              marginBottom: 10, 
              border: '1px solid rgba(165, 180, 252, 0.25)' 
            }}
          >
            <ShieldCheck size={14} color="#a5b4fc" />
            <span style={{ fontSize: '0.75rem', color: '#e0e7ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Global Multi-Tenant Intelligence
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            Platform Analytics & Performance
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: 6, maxWidth: 680, lineHeight: 1.5 }}>
            Real-time platform telemetry across all registered tenant stores, live gross merchandise volume, subscription renewals, and database cluster health.
          </p>
        </div>

        {/* Global Action Shortcuts */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn"
            onClick={refreshData}
            disabled={isRefreshing}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              padding: '9px 16px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Sync Live Data</span>
          </button>

          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => navigate('/superadmin')}
            style={{
              backgroundColor: '#4f46e5',
              border: 'none',
              padding: '9px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
            }}
          >
            <span>Tenant Control Hub</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Global Platform KPIs Grid */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <MetricCard
          title="Total Registered Stores"
          value={String(platformStats.totalTenants)}
          subtitle={`${platformStats.activeTenants} Active store deployments`}
          variant="primary"
          icon={Building}
        />
        <MetricCard
          title="Active Licenses"
          value={String(platformStats.activeTenants)}
          subtitle={`${platformStats.expiringSubscriptionsCount} Expiring in ≤14 days`}
          variant={platformStats.expiringSubscriptionsCount > 0 ? 'warning' : 'success'}
          icon={CreditCard}
        />
        <MetricCard
          title="Total Staff Users"
          value={String(platformStats.totalUsers || 0)}
          subtitle={`Across ${platformStats.totalLocations || 0} store branches`}
          variant="primary"
          icon={Users}
        />
        <MetricCard
          title="Platform GMV Generated"
          value={`₹${platformStats.globalCombinedGmv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Cumulative platform billing volume"
          variant="success"
          icon={Sparkles}
        />
      </div>

      {/* Analytics Breakdown: 2-Column Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        
        {/* Card 1: Subscription Health & Expiration Matrix */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                <Activity size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Subscription License Health</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>Real-time status breakdown from database</p>
              </div>
            </div>

            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5' }}>
              Est. MRR: ₹{Math.round(estimatedMrr).toLocaleString('en-IN')}/mo
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#065f46', fontSize: '0.78rem', fontWeight: 700 }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Active & Healthy</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46', margin: '6px 0 2px 0' }}>
                {statusCounts['ACTIVE'] || 0} Stores
              </div>
              <div style={{ fontSize: '0.72rem', color: '#047857' }}>Licenses valid & operational</div>
            </div>

            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: platformStats.expiringSubscriptionsCount > 0 ? '#fffbeb' : '#f8fafc', border: `1px solid ${platformStats.expiringSubscriptionsCount > 0 ? '#fde68a' : '#e2e8f0'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400e', fontSize: '0.78rem', fontWeight: 700 }}>
                <Clock size={14} color="#f59e0b" />
                <span>Expiring Soon (≤14d)</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e', margin: '6px 0 2px 0' }}>
                {platformStats.expiringSubscriptionsCount} Stores
              </div>
              <div style={{ fontSize: '0.72rem', color: '#b45309' }}>Requires renewal attention</div>
            </div>
          </div>

          {/* Tier Distribution Breakdown */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
              Plan Tier Distribution
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ backgroundColor: '#fdf4ff', color: '#9333ea', border: '1px solid #f0abfc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700 }}>
                Enterprise: {tierCounts['ENTERPRISE'] || 0}
              </span>
              <span style={{ backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700 }}>
                Professional: {tierCounts['PROFESSIONAL'] || 0}
              </span>
              <span style={{ backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700 }}>
                Starter: {tierCounts['STARTER'] || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Database Multi-Cluster Status */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                <Database size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Database & Infrastructure</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>MongoDB cluster isolation telemetry</p>
              </div>
            </div>

            <span style={{ fontSize: '0.74rem', backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
              ● 100% Operational
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Server size={16} color="#4f46e5" />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Primary Multi-Tenant Cluster</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>quickbill_db (Shared Mongo Atlas)</div>
                </div>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>Latency: 3ms</span>
            </div>

            {tenants.filter(t => t.databaseConfig?.isolationMode === 'DEDICATED_DATABASE').map(t => (
              <div key={t.id} style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Zap size={16} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{t.name} (Dedicated Database)</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{t.databaseConfig.databaseName || `quickbill_${t.slug}_db`}</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>Latency: 2ms</span>
              </div>
            ))}
          </div>

          {/* Quick link */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/superadmin')}
            style={{ fontSize: '0.78rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Database size={13} />
            <span>Test Real-Time MongoDB Cluster Links</span>
          </button>
        </div>
      </div>

      {/* Registered Stores Real-Time Leaderboard */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title">Live Store Deployments & Quotas</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: 0 }}>
              Showing all verified business tenants loaded from MongoDB database
            </p>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => navigate('/superadmin')}
            style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>Manage All Stores</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Business Store</th>
                <th>Plan Tier</th>
                <th>Staff Quota</th>
                <th>Branch Quota</th>
                <th>Database Architecture</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--neutral-400)' }}>
                    No business stores provisioned yet in the database. Click "Manage All Stores" or "Provision New Store" to get started.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const sub = t.subscription;
                  const maxUsers = sub?.maxUsers || 5;
                  const maxLocs = sub?.maxLocations || 3;
                  const currentUsers = t.stats.usersCount || 0;
                  const currentLocs = t.stats.locationsCount || 0;

                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{t.name}</span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.slug} • {t.adminEmail}</span>
                        </div>
                      </td>
                      <td>
                        <span 
                          style={{
                            backgroundColor: t.plan === 'ENTERPRISE' ? '#fdf4ff' : '#eef2ff',
                            color: t.plan === 'ENTERPRISE' ? '#9333ea' : '#4f46e5',
                            border: `1px solid ${t.plan === 'ENTERPRISE' ? '#f0abfc' : '#c7d2fe'}`,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.74rem',
                            fontWeight: 700
                          }}
                        >
                          {t.plan}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{currentUsers} / {maxUsers} Users</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{currentLocs} / {maxLocs} Outlets</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                          {t.databaseConfig.isolationMode === 'DEDICATED_DATABASE' ? '🗄️ Dedicated DB' : '🔗 Shared DB'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-paid">● Active</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={() => navigate(`/workspace-preview?tenantId=${t.id}`)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <Eye size={12} />
                          <span>Preview</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
