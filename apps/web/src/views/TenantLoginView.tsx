import React, { useState } from 'react';
import { 
  Sparkles, 
  Lock, 
  Mail, 
  Store, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ReceiptText, 
  Package, 
  BarChart3, 
  Zap,
  Layers
} from 'lucide-react';
import { store } from '../services/store';
import { User } from '../types';

interface TenantLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToSuperAdmin: () => void;
}

export const TenantLoginView: React.FC<TenantLoginViewProps> = ({
  onLoginSuccess,
  onNavigateToSuperAdmin,
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await store.login(email, password, undefined, false);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || 'Failed to authenticate. Please check your credentials.');
      }
    } catch {
      setError('An error occurred during sign in. Please try again.');
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
            <div className="login-header-icon-box">
              <Store size={22} color="var(--primary-600)" />
            </div>
            <h2 className="login-form-title">Store Sign In</h2>
            <p className="login-form-sub">
              Sign in with your work email and password to access your terminal
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="auth-alert error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="login-styled-form">

            {/* Work Email */}
            <div className="form-input-group">
              <label className="form-input-label">
                <Mail size={15} color="var(--primary-600)" />
                <span>Work Email Address</span>
              </label>
              <div className="input-with-icon-wrapper">
                <input
                  type="email"
                  required
                  autoFocus
                  className="modern-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-input-label">
                  <Lock size={15} color="var(--primary-600)" />
                  <span>Password</span>
                </label>
                <span className="password-hint">Min 6 characters</span>
              </div>
              <div className="input-with-icon-wrapper password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="modern-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

          {/* Super Admin Control Plane Entry Banner */}
          <div className="superadmin-access-card" style={{ marginTop: 32 }}>
            <div className="superadmin-access-info">
              <div className="superadmin-badge-icon">
                <ShieldCheck size={20} color="#7c3aed" />
              </div>
              <div>
                <h4>Super Admin Control Plane</h4>
                <p>Platform governance & tenant database manager</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToSuperAdmin}
              className="btn-launch-superadmin"
            >
              <span>Control Plane</span>
              <ArrowRight size={14} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
