import React, { useState, useEffect } from 'react';
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
  X,
  QrCode,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  LifeBuoy
} from 'lucide-react';
import QRCode from 'qrcode';
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

type AuthStep = 'CREDENTIALS' | 'SETUP_2FA' | 'VERIFY_2FA' | 'BACKUP_CODES';

export const SuperAdminLoginView: React.FC<SuperAdminLoginViewProps> = ({
  onLoginSuccess,
  onNavigateToTenantLogin,
}) => {
  const navigate = useNavigate();

  // Stage Management
  const [step, setStep] = useState<AuthStep>('CREDENTIALS');

  // Step 1 Form state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // 2FA Verification / Setup state
  const [mfaSessionToken, setMfaSessionToken] = useState<string>('');
  const [setupToken, setSetupToken] = useState<string>('');
  const [otpauthUri, setOtpauthUri] = useState<string>('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [isBackupCodeMode, setIsBackupCodeMode] = useState<boolean>(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);

  // UI status
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedAllCodes, setCopiedAllCodes] = useState<boolean>(false);
  const [authError, setAuthError] = useState<ClassifiedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [loading, setLoading] = useState<boolean>(false);

  // Generate QR Code data URL when otpauthUri changes
  useEffect(() => {
    if (otpauthUri && step === 'SETUP_2FA') {
      QRCode.toDataURL(otpauthUri, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code data URL', err));
    }
  }, [otpauthUri, step]);

  const validateStep1 = (): boolean => {
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

  // Step 1: Handle Root Credentials submission
  const handleStep1Login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!validateStep1()) {
      return;
    }

    setLoading(true);

    try {
      const result = await store.loginSuperAdminStep1(email.trim().toLowerCase(), password);

      if (result.success) {
        if (result.requires_2fa_setup && result.setup_token) {
          // First-time 2FA Enrollment required
          setSetupToken(result.setup_token);
          setOtpauthUri(result.otpauth_uri || '');
          setSecretKey(result.secret_key || '');
          setTwoFactorCode('');
          setStep('SETUP_2FA');
        } else if (result.requires_2fa && result.mfa_session_token) {
          // Existing 2FA configured, prompt for 6-digit TOTP
          setMfaSessionToken(result.mfa_session_token);
          setTwoFactorCode('');
          setIsBackupCodeMode(false);
          setStep('VERIFY_2FA');
        } else {
          setAuthError({
            type: 'danger',
            title: 'Authorization Incomplete',
            message: 'Unexpected 2FA configuration response from central gateway.',
          });
        }
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

  // Step 2A: Confirm initial 2FA enrollment
  const handleConfirm2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanCode = twoFactorCode.trim().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setFieldErrors({ code: 'Please enter the 6-digit code displayed in your authenticator app.' });
      return;
    }

    setLoading(true);

    try {
      const result = await store.confirmSuperAdmin2FASetup(setupToken, cleanCode);

      if (result.success && result.user) {
        if (result.backup_codes && result.backup_codes.length > 0) {
          setBackupCodes(result.backup_codes);
          setAuthenticatedUser(result.user);
          setStep('BACKUP_CODES');
        } else {
          onLoginSuccess(result.user);
        }
      } else {
        setAuthError({
          type: 'danger',
          title: 'Code Verification Failed',
          message: result.error || 'The 6-digit code was invalid or expired.',
          actionHint: 'Ensure your phone clock is synced and enter the latest code before it expires.'
        });
      }
    } catch (err: any) {
      setAuthError({
        type: 'danger',
        title: 'Verification Error',
        message: err.message || 'Failed to complete 2FA verification.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2B: Verify 2FA code or Emergency Backup Code
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanCode = twoFactorCode.trim();
    if (!cleanCode) {
      setFieldErrors({ code: isBackupCodeMode ? 'Please enter your emergency backup code (e.g. A1B2-C3D4).' : 'Please enter the 6-digit authenticator code.' });
      return;
    }

    setLoading(true);

    try {
      const result = await store.verifySuperAdmin2FA(mfaSessionToken, cleanCode);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setAuthError({
          type: 'danger',
          title: 'Verification Failed',
          message: result.error || 'Invalid 2FA security code.',
          actionHint: isBackupCodeMode 
            ? 'Make sure you entered an unused emergency backup code with hyphens.' 
            : 'Check Google/Microsoft Authenticator and enter the active 6-digit code.'
        });
      }
    } catch (err: any) {
      setAuthError({
        type: 'danger',
        title: 'Verification Error',
        message: err.message || 'Failed to verify 2FA code.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (secretKey) {
      navigator.clipboard.writeText(secretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyAllBackupCodes = () => {
    if (backupCodes.length > 0) {
      const text = `QUICKBILL SUPER ADMIN EMERGENCY BACKUP CODES\nGenerated: ${new Date().toLocaleString()}\nAccount: ${email}\n\n` +
        backupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
        '\n\nKeep these codes stored securely offline. Each code can be used once.';
      navigator.clipboard.writeText(text);
      setCopiedAllCodes(true);
      setTimeout(() => setCopiedAllCodes(false), 2500);
    }
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
              {step === 'CREDENTIALS' && 'Multi-tenant database orchestration, cluster provisioning, and tenant governance'}
              {step === 'SETUP_2FA' && 'Two-Factor Authentication Setup (Google / Microsoft Authenticator)'}
              {step === 'VERIFY_2FA' && 'Two-Factor Identity Verification Required'}
              {step === 'BACKUP_CODES' && 'Emergency Backup Recovery Codes Generated'}
            </p>
          </div>

          {/* Security Notice */}
          <div className="superadmin-security-banner">
            <Cpu size={16} color="#c084fc" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Security Protocol:</strong> TOTP Multi-Factor Authentication enforced on Root Control Plane.
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

          {/* ================= STAGE 1: CREDENTIALS ================= */}
          {step === 'CREDENTIALS' && (
            <>
              <form onSubmit={handleStep1Login} className="superadmin-form" noValidate>
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

                {/* Authenticate CTA */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-superadmin-submit"
                >
                  {loading ? (
                    <span>Validating Master Credentials...</span>
                  ) : (
                    <>
                      <Terminal size={18} />
                      <span>Proceed to Authenticator Verification</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ================= STAGE 2A: SETUP 2FA (FIRST TIME) ================= */}
          {step === 'SETUP_2FA' && (
            <div className="superadmin-2fa-setup-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '14px',
                color: '#bfdbfe',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={16} /> Setup Google or Microsoft Authenticator
                </div>
                1. Open <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your mobile device.<br />
                2. Tap <strong>+ (Add Account)</strong> &rarr; Scan the QR code below or enter the manual key.
              </div>

              {/* QR Code Card */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                margin: '0 auto',
                width: 'fit-content'
              }}>
                {qrCodeDataUrl ? (
                  <img 
                    src={qrCodeDataUrl} 
                    alt="2FA TOTP QR Code" 
                    style={{ width: '190px', height: '190px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '190px', height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                )}
                <div style={{ color: '#0f172a', fontSize: '0.72rem', fontWeight: 700, marginTop: '8px', letterSpacing: '0.5px' }}>
                  QUICKBILL SUPER ADMIN
                </div>
              </div>

              {/* Manual Secret Key */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 600 }}>MANUAL SECRET KEY</div>
                  <code style={{ fontSize: '0.86rem', color: '#f3e8ff', letterSpacing: '1px', wordBreak: 'break-all' }}>
                    {secretKey}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: copiedKey ? '#22c55e' : 'rgba(168, 85, 247, 0.25)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Verification Code Form */}
              <form onSubmit={handleConfirm2FASetup} className="superadmin-form" noValidate>
                <div className="superadmin-input-group">
                  <label className="superadmin-label">
                    <KeyRound size={14} color="#c084fc" />
                    <span>Enter 6-Digit Code from Authenticator</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    className={`superadmin-input ${fieldErrors.code ? 'input-error-border' : ''}`}
                    placeholder="123456"
                    value={twoFactorCode}
                    style={{
                      fontSize: '1.4rem',
                      letterSpacing: '6px',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorCode(val);
                      if (fieldErrors.code) setFieldErrors(prev => ({ ...prev, code: undefined }));
                      if (authError) setAuthError(null);
                    }}
                  />
                  {fieldErrors.code && (
                    <div className="field-error-text" style={{ color: '#fca5a5' }}>
                      <AlertCircle size={12} />
                      <span>{fieldErrors.code}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  className="btn-superadmin-submit"
                >
                  {loading ? (
                    <span>Activating Authenticator...</span>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Verify & Complete Enrollment</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('CREDENTIALS');
                    setAuthError(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '8px'
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Cancel and back to login</span>
                </button>
              </form>
            </div>
          )}

          {/* ================= STAGE 2B: VERIFY 2FA (RETURNING USER) ================= */}
          {step === 'VERIFY_2FA' && (
            <div className="superadmin-2fa-verify-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '14px',
                color: '#e9d5ff',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={16} /> Authenticator Verification
                </div>
                {isBackupCodeMode ? (
                  <span>Enter one of your 8-character single-use emergency backup recovery codes (e.g. <code>A1B2-C3D4</code>).</span>
                ) : (
                  <span>Open your <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> app and enter the dynamic 6-digit security code.</span>
                )}
              </div>

              <form onSubmit={handleVerify2FA} className="superadmin-form" noValidate>
                <div className="superadmin-input-group">
                  <label className="superadmin-label">
                    <KeyRound size={14} color="#c084fc" />
                    <span>{isBackupCodeMode ? 'Emergency Backup Recovery Code' : '6-Digit Authenticator Code'}</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={isBackupCodeMode ? 12 : 6}
                    className={`superadmin-input ${fieldErrors.code ? 'input-error-border' : ''}`}
                    placeholder={isBackupCodeMode ? 'XXXX-XXXX' : '••••••'}
                    value={twoFactorCode}
                    style={{
                      fontSize: '1.4rem',
                      letterSpacing: isBackupCodeMode ? '3px' : '6px',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      textTransform: isBackupCodeMode ? 'uppercase' : 'none'
                    }}
                    onChange={(e) => {
                      const val = isBackupCodeMode 
                        ? e.target.value.toUpperCase().slice(0, 12)
                        : e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorCode(val);
                      if (fieldErrors.code) setFieldErrors(prev => ({ ...prev, code: undefined }));
                      if (authError) setAuthError(null);
                    }}
                  />
                  {fieldErrors.code && (
                    <div className="field-error-text" style={{ color: '#fca5a5' }}>
                      <AlertCircle size={12} />
                      <span>{fieldErrors.code}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !twoFactorCode.trim()}
                  className="btn-superadmin-submit"
                >
                  {loading ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Verify & Enter Portal</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* Toggle Backup Code Mode */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBackupCodeMode(!isBackupCodeMode);
                      setTwoFactorCode('');
                      setFieldErrors({});
                      setAuthError(null);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#c084fc',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      textDecoration: 'underline'
                    }}
                  >
                    <LifeBuoy size={14} />
                    <span>{isBackupCodeMode ? 'Use 6-Digit Authenticator Code' : 'Use Emergency Backup Code'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('CREDENTIALS');
                      setAuthError(null);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to password</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= STAGE 3: BACKUP CODES DISPLAY ================= */}
          {step === 'BACKUP_CODES' && (
            <div className="superadmin-backup-codes-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: '8px',
                padding: '14px',
                color: '#fef08a',
                fontSize: '0.85rem',
                lineHeight: '1.5'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={16} /> Save Your Emergency Backup Codes
                </div>
                If you lose access to your phone or authenticator app, these codes are the <strong>only way</strong> to regain access to your Super Admin account. Each code can only be used once.
              </div>

              {/* Codes Grid */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '10px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px'
              }}>
                {backupCodes.map((code, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontFamily: 'monospace',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#a7f3d0',
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{idx + 1}.</span>
                    <span>{code}</span>
                  </div>
                ))}
              </div>

              {/* Copy & Continue CTAs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCopyAllBackupCodes}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: copiedAllCodes ? '#16a34a' : 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#ffffff',
                    borderRadius: '8px',
                    padding: '12px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedAllCodes ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copiedAllCodes ? 'All Backup Codes Copied to Clipboard!' : 'Copy All Backup Codes'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (authenticatedUser) {
                      onLoginSuccess(authenticatedUser);
                    }
                  }}
                  className="btn-superadmin-submit"
                  style={{ marginTop: '4px' }}
                >
                  <ShieldCheck size={18} />
                  <span>I Have Safely Stored My Backup Codes &rarr; Enter Portal</span>
                </button>
              </div>
            </div>
          )}

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
