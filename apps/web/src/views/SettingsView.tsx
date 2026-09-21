import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Database, 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Building, 
  Key, 
  FileCode 
} from 'lucide-react';
import { store } from '../services/store';

export const SettingsView: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [backendStatus, setBackendStatus] = useState<boolean>(store.getOnlineStatus());
  const [lastCheckTime, setLastCheckTime] = useState<string>(new Date().toLocaleTimeString());

  const handleTestConnection = async () => {
    setIsChecking(true);
    const ok = await store.checkHealth();
    setBackendStatus(ok);
    setLastCheckTime(new Date().toLocaleTimeString());
    setIsChecking(false);
  };

  useEffect(() => {
    handleTestConnection();
  }, []);

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
          Settings & Infrastructure Config
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
          Configure MongoDB database connection links, FastAPI backend endpoints, and company profile.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
        {/* Database & Backend Connectivity Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="var(--primary-500)" />
              <h3 className="card-title">MongoDB & Backend Server Connection</h3>
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
                You can easily customize your MongoDB connection link in <code>apps/api/.env</code>:
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
{`# Local Docker MongoDB:
MONGODB_URI=mongodb://admin:secretpassword@localhost:27017/quickbill_db?authSource=admin

# Remote / MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<user>:<pwd>@cluster0.mongodb.net/quickbill_db?retryWrites=true&w=majority

DATABASE_NAME=quickbill_db
REDIS_URL=redis://localhost:6379/0`}
              </pre>
            </div>
          </div>
        </div>

        {/* Business Profile Settings */}
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
                <label className="form-label">Store Address</label>
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
      </div>
    </div>
  );
};
