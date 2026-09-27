import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowLeft, 
  KeyRound, 
  ShieldAlert, 
  Terminal, 
  Cpu, 
  Database,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { store } from '../services/store';
import { User } from '../types';

interface SuperAdminLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToTenantLogin?: () => void;
}

interface ClassifiedError {
  type: 'danger' | 'warning' | 'network' | 'info';
  title: string;
  message: string;
  actionHint?: string;
}

export const SuperAdminLoginView: React.FC<SuperAdminLoginViewProps> = ({
  onLoginSuccess,
  onNavigateToTenantLogin,
}) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('superadmin@quickbill.local');
  const [password, setPassword] = useState<string>('superadmin123');
  const [securityKey, setSecurityKey] = useState<string>('QB-ROOT-AUTH-99');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<ClassifiedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      errors.email = 'Master root email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Enter a valid administrator email address.';
    }

    if (!password) {
      errors.password = 'Master root password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await store.login(email.trim().toLowerCase(), password, undefined, true);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        const rawError = result.error || 'Authentication rejected: Invalid Super Admin Master credentials.';
        
        if (rawError.includes('Super Administrator role required')) {
          setAuthError({
            type: 'warning',
            title: 'Unauthorized Privilege Level',
            message: 'This account does not have Super Administrator (Root) privileges. Please use the standard Store Login for tenant accounts.',
            actionHint: 'Click "Return to Standard Store Login" below.'
          });
        } else if (rawError.toLowerCase().includes('network') || rawError.toLowerCase().includes('connect')) {
          setAuthError({
            type: 'network',
            title: 'Cluster Communication Error',
            message: 'Failed to connect to the central authentication database gateway.',
            actionHint: 'Ensure the backend server is running and reachable.'
          });
        } else {
          setAuthError({
            type: 'danger',
            title: 'Root Authorization Failed',
            message: rawError,
            actionHint: 'Check your Master email, Root password, and cluster security key.'
          });
        }
      }
    } catch (err: any) {
      setAuthError({
        type: 'danger',
        title: 'Gateway Failure',
        message: err.message || 'Root authentication gateway failure. Please retry.',
        actionHint: 'Please refresh the page and verify credentials.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFillSuperAdminDemo = () => {
    setEmail('superadmin@quickbill.local');
    setPassword('superadmin123');
    setSecurityKey('QB-ROOT-AUTH-99');
    setFieldErrors({});
    setAuthError(null);
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
              <span>MULTI-CLUSTER ROUTING ACTIVE</span>
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
          {authError && (
            <div className={`superadmin-alert ${authError.type} animate-shake`}>
              <div className="superadmin-alert-icon">
                {authError.type === 'warning' ? <ShieldAlert size={20} color="#f59e0b" /> : <AlertCircle size={20} color="#ef4444" />}
              </div>
              <div className="superadmin-alert-body">
                <div className="superadmin-alert-title">{authError.title}</div>
                <div className="superadmin-alert-msg">{authError.message}</div>
                {authError.actionHint && (
                  <div className="superadmin-alert-hint">
                    💡 <span>{authError.actionHint}</span>
                  </div>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setAuthError(null)} 
                className="superadmin-alert-close"
                title="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Super Admin Form */}
          <form onSubmit={handleSuperAdminLogin} className="superadmin-form" noValidate>
            <div className="superadmin-input-group">
              <label className="superadmin-label">
                <Mail size={14} color="#c084fc" />
                <span>Super Admin Master Email</span>
              </label>
              <input
                type="email"
                required
                className={`superadmin-input ${fieldErrors.email ? 'input-error-border' : ''}`}
                placeholder="superadmin@quickbill.local"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                  if (authError) setAuthError(null);
                }}
              />
              {fieldErrors.email && (
                <div className="field-error-text" style={{ color: '#fca5a5' }}>
                  <AlertCircle size={12} />
                  <span>{fieldErrors.email}</span>
                </div>
              )}
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
                  className={`superadmin-input ${fieldErrors.password ? 'input-error-border' : ''}`}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                    if (authError) setAuthError(null);
                  }}
                />
                <button
                  type="button"
                  className="superadmin-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} color="#c084fc" /> : <Eye size={16} color="#c084fc" />}
                </button>
              </div>
              {fieldErrors.password && (
                <div className="field-error-text" style={{ color: '#fca5a5' }}>
                  <AlertCircle size={12} />
                  <span>{fieldErrors.password}</span>
                </div>
              )}
            </div>

            <div className="superadmin-input-group">
              <label className="superadmin-label">
                <KeyRound size={14} color="#c084fc" />
                <span>Cluster Access Token / Security PIN</span>
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

          {/* Dev Test Helper Auto-Fill */}
          <div className="superadmin-demo-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', color: '#e9d5ff', fontWeight: 600 }}>
                ⚡ Development Master Test Key:
              </span>
              <button
                type="button"
                onClick={handleFillSuperAdminDemo}
                className="superadmin-fill-btn"
              >
                Auto-Fill Master Test Key
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
              onClick={() => {
                if (onNavigateToTenantLogin) {
                  onNavigateToTenantLogin();
                }
                navigate('/login');
              }}
              className="superadmin-back-btn"
            >
              <ArrowLeft size={16} />
              <span>Return to Standard Store Login</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
