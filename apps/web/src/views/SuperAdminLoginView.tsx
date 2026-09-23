import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowLeft, 
  KeyRound, 
  Server, 
  CheckCircle2, 
  ShieldAlert, 
  Terminal, 
  Cpu, 
  Database,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { store } from '../services/store';
import { User } from '../types';

interface SuperAdminLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToTenantLogin: () => void;
}

export const SuperAdminLoginView: React.FC<SuperAdminLoginViewProps> = ({
  onLoginSuccess,
  onNavigateToTenantLogin,
}) => {
  const [email, setEmail] = useState<string>('superadmin@quickbill.local');
  const [password, setPassword] = useState<string>('superadmin123');
  const [securityKey, setSecurityKey] = useState<string>('QB-ROOT-AUTH-99');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await store.login(email, password, undefined, true);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || 'Authentication rejected: Invalid Super Admin Master credentials.');
      }
    } catch {
      setError('Root authentication gateway failure. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillSuperAdminDemo = () => {
    setEmail('superadmin@quickbill.local');
    setPassword('superadmin123');
    setSecurityKey('QB-ROOT-AUTH-99');
    setError(null);
  };

  return (
    <div className="superadmin-auth-container">
      {/* Background Matrix & Neon Glow Effects */}
      <div className="superadmin-bg-glow" />
      <div className="superadmin-bg-glow-secondary" />
      <div className="superadmin-bg-grid" />

      <div className="superadmin-card-wrapper">
        <div className="superadmin-card">
          
          {/* Top Status Telemetry Bar */}
          <div className="superadmin-telemetry-bar">
            <div className="telemetry-pill">
              <span className="telemetry-live-dot" />
              <span>ROOT PLATFORM ACCESS</span>
            </div>
            <div className="telemetry-clusters">
              <Database size={12} color="#c084fc" />
              <span>3 CLUSTERS ACTIVE</span>
            </div>
          </div>

          {/* Header Section */}
          <div className="superadmin-header">
            <div className="superadmin-icon-box">
              <ShieldCheck size={32} color="#ffffff" />
            </div>
            <h1 className="superadmin-title">Super Admin Portal</h1>
            <p className="superadmin-subtitle">
              Multi-tenant database orchestration, cluster provisioning, and tenant governance
            </p>
          </div>

          {/* Security Notice */}
          <div className="superadmin-security-banner">
            <Cpu size={16} color="#c084fc" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Multi-Tenant Isolation Guard:</strong> Direct MongoDB cluster routing & tenant boundary enforcement active.
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="superadmin-alert error">
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Super Admin Form */}
          <form onSubmit={handleSuperAdminLogin} className="superadmin-form">
            <div className="superadmin-input-group">
              <label className="superadmin-label">
                <Mail size={14} color="#c084fc" />
                <span>Super Admin Master Email</span>
              </label>
              <input
                type="email"
                required
                className="superadmin-input"
                placeholder="superadmin@quickbill.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="superadmin-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="superadmin-label">
                  <Lock size={14} color="#c084fc" />
                  <span>Master Root Password</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: '#a855f7' }}>Master Security Key</span>
              </div>
              <div className="superadmin-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="superadmin-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="superadmin-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} color="#c084fc" /> : <Eye size={16} color="#c084fc" />}
                </button>
              </div>
            </div>

            <div className="superadmin-input-group">
              <label className="superadmin-label">
                <KeyRound size={14} color="#c084fc" />
                <span>Cluster Access Token / MFA Code</span>
              </label>
              <input
                type="text"
                className="superadmin-input"
                placeholder="QB-ROOT-AUTH-99"
                value={securityKey}
                onChange={(e) => setSecurityKey(e.target.value)}
              />
            </div>

            {/* Authenticate CTA */}
            <button
              type="submit"
              disabled={loading}
              className="btn-superadmin-submit"
            >
              {loading ? (
                <span>Authorizing Master Key...</span>
              ) : (
                <>
                  <Terminal size={18} />
                  <span>Authenticate Master Control Plane</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Demo Root Credentials Quick Autofill */}
          <div className="superadmin-demo-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', color: '#e9d5ff', fontWeight: 600 }}>
                ⚡ One-Click Master Test Key:
              </span>
              <button
                type="button"
                onClick={handleFillSuperAdminDemo}
                className="superadmin-fill-btn"
              >
                Auto-Fill Master Credentials
              </button>
            </div>
            <div className="superadmin-creds-preview">
              <code>superadmin@quickbill.local</code> • <code>superadmin123</code>
            </div>
          </div>

          {/* Back to Tenant Store Login */}
          <div className="superadmin-footer">
            <button
              type="button"
              onClick={onNavigateToTenantLogin}
              className="superadmin-back-btn"
            >
              <ArrowLeft size={16} />
              <span>Return to Standard Store / Tenant Login</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
