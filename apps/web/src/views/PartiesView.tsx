import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CreditCard, 
  X,
  FileText
} from 'lucide-react';
import { Party, Payment } from '../types';
import { store } from '../services/store';

export const PartiesView: React.FC = () => {
  const [parties, setParties] = useState<Party[]>(store.getParties());
  const [payments, setPayments] = useState<Payment[]>(store.getPayments());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');

  // Modals
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState<Party | null>(null);

  // Forms
  const [newParty, setNewParty] = useState<Omit<Party, 'id' | 'currentBalance'>>({
    name: '',
    type: 'CUSTOMER',
    phone: '',
    email: '',
    gstin: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 1000,
    type: 'PAYMENT_IN' as 'PAYMENT_IN' | 'PAYMENT_OUT',
    paymentMode: 'UPI' as 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE',
    referenceNumber: '',
    notes: '',
  });

  const refreshData = () => {
    setParties(store.getParties());
    setPayments(store.getPayments());
  };

  const filteredParties = parties.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery)) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'ALL' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCreateParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParty.name.trim()) return;
    store.addParty(newParty);
    refreshData();
    setIsAddPartyOpen(false);
    setNewParty({
      name: '',
      type: 'CUSTOMER',
      phone: '',
      email: '',
      gstin: '',
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyForPayment || paymentForm.amount <= 0) return;

    store.recordPayment({
      date: new Date().toISOString().split('T')[0],
      partyId: selectedPartyForPayment.id,
      partyName: selectedPartyForPayment.name,
      type: paymentForm.type,
      amount: paymentForm.amount,
      paymentMode: paymentForm.paymentMode,
      referenceNumber: paymentForm.referenceNumber,
      notes: paymentForm.notes,
    });

    refreshData();
    setIsPaymentModalOpen(false);
    setSelectedPartyForPayment(null);
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Parties & Contact Ledger
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Track customer receivables, supplier payables, and record cash/bank payments.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsAddPartyOpen(true)}>
          <Plus size={16} />
          <span>+ Add New Party</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search by contact name, phone, GSTIN..."
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {(['ALL', 'CUSTOMER', 'SUPPLIER'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: filterType === t ? 'var(--primary-500)' : 'var(--neutral-200)',
                  backgroundColor: filterType === t ? 'var(--primary-50)' : '#ffffff',
                  color: filterType === t ? 'var(--primary-700)' : 'var(--neutral-600)',
                  cursor: 'pointer',
                }}
              >
                {t === 'ALL' ? 'All Parties' : t === 'CUSTOMER' ? 'Customers' : 'Suppliers'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Parties Table */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Party Name</th>
                <th>Type</th>
                <th>Contact Info</th>
                <th>GSTIN</th>
                <th>Current Balance</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.map((party) => {
                const isReceivable = party.currentBalance > 0;
                const isPayable = party.currentBalance < 0;

                return (
                  <tr key={party.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{party.name}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          backgroundColor: party.type === 'CUSTOMER' ? 'var(--primary-50)' : 'var(--warning-50)',
                          color: party.type === 'CUSTOMER' ? 'var(--primary-700)' : 'var(--warning-700)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {party.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--neutral-700)' }}>{party.phone || '—'}</div>
                      {party.email && <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>{party.email}</div>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {party.gstin || 'Unregistered'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 800,
                          color: isReceivable ? 'var(--warning-700)' : isPayable ? 'var(--danger-700)' : 'var(--neutral-500)',
                        }}
                      >
                        ₹{Math.abs(party.currentBalance).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.72rem', marginLeft: 4, color: 'var(--neutral-400)' }}>
                        {isReceivable ? '(To Collect)' : isPayable ? '(To Pay)' : '(Settled)'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                        onClick={() => {
                          setSelectedPartyForPayment(party);
                          setPaymentForm({
                            ...paymentForm,
                            type: party.type === 'CUSTOMER' ? 'PAYMENT_IN' : 'PAYMENT_OUT',
                            amount: Math.abs(party.currentBalance) || 500,
                          });
                          setIsPaymentModalOpen(true);
                        }}
                      >
                        <CreditCard size={14} />
                        <span>Record Payment</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--primary-500)" />
            <h3 className="card-title">Recent Payment Records</h3>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party Name</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Ref No / Note</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--neutral-400)' }}>
                    No payment records yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td style={{ fontWeight: 600 }}>{p.partyName}</td>
                    <td>
                      <span style={{ color: p.type === 'PAYMENT_IN' ? 'var(--success-700)' : 'var(--danger-700)', fontWeight: 700 }}>
                        {p.type === 'PAYMENT_IN' ? '↙ Payment In' : '↗ Payment Out'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800 }}>₹{p.amount.toFixed(2)}</td>
                    <td>{p.paymentMode}</td>
                    <td style={{ color: 'var(--neutral-500)', fontSize: '0.8rem' }}>
                      {p.referenceNumber || p.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Party Modal */}
      {isAddPartyOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPartyOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="card-header">
              <span className="card-title">Add New Party / Customer</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAddPartyOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateParty} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Party Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Apex Traders Pvt Ltd"
                    value={newParty.name}
                    onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Party Type</label>
                  <select
                    className="form-select"
                    value={newParty.type}
                    onChange={(e) => setNewParty({ ...newParty, type: e.target.value as any })}
                  >
                    <option value="CUSTOMER">Customer (Client)</option>
                    <option value="SUPPLIER">Supplier (Vendor)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+91 9876543210"
                      value={newParty.phone}
                      onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="contact@domain.com"
                      value={newParty.email}
                      onChange={(e) => setNewParty({ ...newParty, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="07AAAAA0000A1Z5"
                    value={newParty.gstin}
                    onChange={(e) => setNewParty({ ...newParty, gstin: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddPartyOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedPartyForPayment && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="card-header">
              <span className="card-title">Record Payment</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsPaymentModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ backgroundColor: 'var(--neutral-50)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--neutral-900)' }}>{selectedPartyForPayment.name}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                    Current Ledger Balance: <strong>₹{Math.abs(selectedPartyForPayment.currentBalance).toFixed(2)}</strong>
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Direction</label>
                  <select
                    className="form-select"
                    value={paymentForm.type}
                    onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value as any })}
                  >
                    <option value="PAYMENT_IN">Payment In (Received Money)</option>
                    <option value="PAYMENT_OUT">Payment Out (Paid Money)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    className="form-input"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={paymentForm.paymentMode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value as any })}
                  >
                    <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference ID / UTR</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. UPI/628192839120"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm & Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
