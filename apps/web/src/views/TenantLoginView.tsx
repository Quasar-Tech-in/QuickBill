import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Lock, 
  Mail, 
  Store, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  WifiOff, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ReceiptText, 
  Package, 
  BarChart3, 
  Zap, 
  Layers, 
  X,
  HelpCircle,
  Building2,
  Users,
  KeyRound
} from 'lucide-react';
import { store } from '../services/store';
import { User } from '../types';

interface TenantLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToSuperAdmin?: () => void;
}

interface ClassifiedError {
  type: 'danger' | 'warning' | 'network' | 'info';
  title: string;
  message: string;
  actionHint?: string;
}

export const TenantLoginView: React.FC<TenantLoginViewProps> = ({
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState<boolean>(false);
  const [authError, setAuthError] = useState<ClassifiedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Check backend server readiness on mount
  const checkBackendStatus = async () => {
    setIsCheckingHealth(true);
    try {
      const online = await store.checkHealth();
      setIsBackendOnline(online);
      if (!online) {
        setAuthError({
          type: 'network',
          title: 'Backend Server Offline',
          message: 'The billing server is currently unreachable. If running locally, ensure the API is running on port 8000.',
          actionHint: 'Check server connection or contact system administrator.'
        });
      } else if (authError?.type === 'network') {
        setAuthError(null);
      }
    } catch {
      setIsBackendOnline(false);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      errors.email = 'Work email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address (e.g. name@company.com).';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 4) {
      errors.password = 'Password must be at least 4 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await store.login(email.trim().toLowerCase(), password, undefined, false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        const rawError = result.error || 'Authentication failed.';
        
        // Categorize error for distinct user guidance
        if (rawError.includes('Super Administrator accounts must authenticate')) {
          setAuthError({
            type: 'warning',
            title: 'Master Control Account',
            message: 'Super Administrator accounts must authenticate exclusively via the dedicated Master Control Portal with Multi-Factor Authentication.',
            actionHint: 'Please navigate directly to the Super Admin portal.'
          });
        } else if (rawError.toLowerCase().includes('deactivated') || rawError.toLowerCase().includes('suspended')) {
          setAuthError({
            type: 'warning',
            title: 'Account Inactive / Suspended',
            message: rawError,
            actionHint: 'Please contact your Store Administrator or Owner to reactivate access.'
          });
        } else if (rawError.toLowerCase().includes('network') || rawError.toLowerCase().includes('service unavailable') || rawError.toLowerCase().includes('failed to connect')) {
          setAuthError({
            type: 'network',
            title: 'Connection Failure',
            message: 'Could not communicate with the authentication server. Please check your internet or local API server.',
            actionHint: 'Click retry or ensure backend server is online.'
          });
        } else {
          setAuthError({
            type: 'danger',
            title: 'Invalid Email or Password',
            message: rawError.includes('401') || rawError.includes('Invalid') 
              ? 'The email or password you entered does not match our records. Please double check and try again.' 
              : rawError,
            actionHint: 'Ensure Caps Lock is off and your email spelling is correct.'
          });
        }
      }
    } catch (err: any) {
      setAuthError({
        type: 'danger',
        title: 'Sign In Error',
        message: err.message || 'An unexpected error occurred during sign in.',
        actionHint: 'Please refresh the page and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-page">
      {/* LEFT SHOWCASE HERO PANEL */}
      <div className="login-hero-pane">
        <div className="login-hero-glow-1" />
        <div className="login-hero-glow-2" />

        {/* Brand Header */}
        <div className="login-hero-header">
          <div className="login-brand-badge">
            <Sparkles size={24} color="#ffffff" />
          </div>
          <div>
            <h2 className="login-brand-title">QuickBill</h2>
            <span className="login-brand-sub">Enterprise Retail Billing & Multi-Branch Platform</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="login-hero-content">
          <div className="hero-status-pill">
            <span className="hero-status-dot" />
            <Zap size={14} color="#facc15" />
            <span>Multi-Location Stock Control & High-Speed POS</span>
          </div>

          <h1 className="login-hero-headline">
            Modern Billing, Branch Inventory & Instant Accounting
          </h1>

          <p className="login-hero-desc">
            Accelerate counter billing across all branch locations, manage multi-user team roles, track live inventory, and generate GST invoices effortlessly.
          </p>

          {/* 4 Feature Highlights Grid */}
          <div className="hero-features-grid">
            <div className="hero-feature-card">
              <div className="hero-feature-icon" style={{ background: 'rgba(79, 70, 229, 0.2)' }}>
                <ReceiptText size={20} color="#a5b4fc" />
              </div>
              <div>
                <h4>Multi-Counter POS</h4>
                <p>Instant barcode scanning, thermal prints & UPI QR receipts</p>
              </div>
            </div>

            <div className="hero-feature-card">
              <div className="hero-feature-icon" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                <Package size={20} color="#6ee7b7" />
              </div>
              <div>
                <h4>Multi-Branch Stock</h4>
                <p>Real-time location inventory, batch items & reorder alerts</p>
              </div>
            </div>

            <div className="hero-feature-card">
              <div className="hero-feature-icon" style={{ background: 'rgba(245, 158, 11, 0.2)' }}>
                <BarChart3 size={20} color="#fde047" />
              </div>
              <div>
                <h4>GST & Profit Reports</h4>
                <p>Automated sales summaries, tax returns & daily P&L analytics</p>
              </div>
            </div>

            <div className="hero-feature-card">
              <div className="hero-feature-icon" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
                <Layers size={20} color="#d8b4fe" />
              </div>
              <div>
                <h4>Role-Based Access</h4>
                <p>Assign Manager & Cashier accounts to specific branch locations</p>
              </div>
            </div>
          </div>

          {/* Live POS Bill Snippet Preview */}
          <div className="hero-floating-invoice-card">
            <div className="hero-invoice-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="hero-invoice-dot" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                  Live POS Counter Bill #INV-2026-001
                </span>
              </div>
              <span className="hero-invoice-status">PAID • ₹4,850.00</span>
            </div>
            <div className="hero-invoice-items">
              <span>🌾 Basmati Rice (10kg) × 2</span>
              <span>🌻 Sunflower Cooking Oil (5L) × 1</span>
              <span>🧾 Location: Main Flagship Counter</span>
            </div>
          </div>
        </div>

        {/* Hero Footer */}
        <div className="login-hero-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={15} color="#10b981" />
            <span>Multi-Location Ready</span>
          </div>
          <span>•</span>
          <span>100% Reliable Cloud Sync</span>
          <span>•</span>
          <span>Granular Staff Permissions</span>
        </div>
      </div>

      {/* RIGHT AUTH FORM PANEL */}
      <div className="login-form-pane">
        <div className="login-form-container">
          
          {/* Header */}
          <div className="login-form-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 12 }}>
              <div className="login-header-icon-box">
                <Store size={22} color="var(--primary-600)" />
              </div>

              {/* Backend Health Status Pill */}
              <div className={`backend-health-pill ${isBackendOnline === true ? 'online' : isBackendOnline === false ? 'offline' : 'checking'}`}>
                <span className="health-dot" />
                <span>
                  {isCheckingHealth ? 'Checking API...' : isBackendOnline ? 'API Connected' : 'API Offline'}
                </span>
                <button 
                  type="button" 
                  onClick={checkBackendStatus} 
                  className="health-refresh-btn" 
                  title="Refresh Server Connection"
                >
                  <RefreshCw size={12} className={isCheckingHealth ? 'spin-animation' : ''} />
                </button>
              </div>
            </div>

            <h2 className="login-form-title">Store Sign In</h2>
            <p className="login-form-sub">
              Sign in with your work email and password to access your terminal
            </p>
          </div>

          {/* Contextual Error / Warning Banner */}
          {authError && (
            <div className={`auth-alert ${authError.type} animate-shake`}>
              <div className="auth-alert-icon-box">
                {authError.type === 'danger' && <AlertCircle size={20} />}
                {authError.type === 'warning' && <AlertTriangle size={20} />}
                {authError.type === 'network' && <WifiOff size={20} />}
                {authError.type === 'info' && <AlertCircle size={20} />}
              </div>
              <div className="auth-alert-body">
                <div className="auth-alert-title">{authError.title}</div>
                <div className="auth-alert-message">{authError.message}</div>
                {authError.actionHint && (
                  <div className="auth-alert-hint">
                    💡 <span>{authError.actionHint}</span>
                  </div>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setAuthError(null)} 
                className="auth-alert-close-btn"
                title="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="login-styled-form" noValidate>

            {/* Work Email */}
            <div className="form-input-group">
              <label className="form-input-label">
                <Mail size={15} color="var(--primary-600)" />
                <span>Work Email Address</span>
              </label>
              <div className={`input-with-icon-wrapper ${fieldErrors.email ? 'input-error-border' : ''}`}>
                <input
                  type="email"
                  required
                  autoFocus
                  className="modern-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                    if (authError) setAuthError(null);
                  }}
                />
              </div>
              {fieldErrors.email && (
                <div className="field-error-text">
                  <AlertCircle size={13} />
                  <span>{fieldErrors.email}</span>
                </div>
              )}
            </div>

            {/* Password */}
            <div className="form-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-input-label">
                  <Lock size={15} color="var(--primary-600)" />
                  <span>Password</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-600)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <HelpCircle size={13} />
                  <span>Forgot password?</span>
                </button>
              </div>
              <div className={`input-with-icon-wrapper password-wrapper ${fieldErrors.password ? 'input-error-border' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="modern-input"
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
                  className="btn-toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <div className="field-error-text">
                  <AlertCircle size={13} />
                  <span>{fieldErrors.password}</span>
                </div>
              )}
            </div>

            {/* Sign In Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-login-submit"
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="btn-spinner" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

        </div>
      </div>

      {/* FORGOT PASSWORD GUIDANCE MODAL */}
      {showForgotPasswordModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowForgotPasswordModal(false)}
          style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: 480, 
              width: '100%', 
              backgroundColor: '#ffffff', 
              borderRadius: '16px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '18px 24px', 
              borderBottom: '1px solid var(--neutral-200)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              backgroundColor: 'var(--neutral-50)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'var(--primary-100)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-700)'
                }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    Password Reset Guide
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                    Account recovery procedure by role
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowForgotPasswordModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--neutral-400)',
                  padding: 4,
                  borderRadius: 6
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Business Owner Card */}
              <div style={{
                border: '1px solid var(--primary-200)',
                backgroundColor: 'var(--primary-50)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-600)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  <Building2 size={16} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                    Are you a Business / Store Owner?
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--primary-800)', lineHeight: 1.45 }}>
                    To safeguard your store and financial records, master credential resets are managed by central administration. Please reach out to the <strong>Platform Administrator</strong> or support desk at:
                  </p>
                  <div style={{ marginTop: '8px', display: 'inline-block', background: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--primary-200)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                    support@quickbill.platform
                  </div>
                </div>
              </div>

              {/* Staff / Cashier / Manager Card */}
              <div style={{
                border: '1px solid var(--neutral-200)',
                backgroundColor: 'var(--neutral-50)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'var(--neutral-700)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  <Users size={16} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    Are you a Store Manager or Cashier?
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--neutral-700)', lineHeight: 1.45 }}>
                    Please contact your <strong>Store Owner or Business Administrator</strong>. They can instantly reset or update your password directly from the store dashboard under <strong>Settings &rarr; Staff & Users</strong>.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  borderRadius: '8px'
                }}
              >
                Understood, Return to Sign In
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
