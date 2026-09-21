import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Eye, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { Invoice } from '../types';
import { store } from '../services/store';
import { StatusBadge } from '../components/StatusBadge';

interface TransactionsViewProps {
  onViewInvoice: (invoice: Invoice) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onViewInvoice }) => {
  const [invoices, setInvoices] = useState<Invoice[]>(store.getInvoices());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL');

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.partyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSalesAmount = filteredInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
  const totalBalanceDue = filteredInvoices.reduce((sum, i) => sum + i.balanceAmount, 0);

  return (
    <div className="page-container">
      {/* Top Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Invoices & Billing History
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Audit generated bills, print tax receipts, and track payment settlements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Filtered Total</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-600)' }}>
              ₹{totalSalesAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search invoice number, customer name..."
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {(['ALL', 'PAID', 'PARTIAL', 'UNPAID'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: statusFilter === status ? 'var(--primary-500)' : 'var(--neutral-200)',
                  backgroundColor: statusFilter === status ? 'var(--primary-50)' : '#ffffff',
                  color: statusFilter === status ? 'var(--primary-700)' : 'var(--neutral-600)',
                  cursor: 'pointer',
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer / Party</th>
                <th>Payment Mode</th>
                <th>Subtotal</th>
                <th>GST</th>
                <th>Grand Total</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--neutral-400)' }}>
                    No invoices match your search.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>{inv.date}</td>
                    <td style={{ fontWeight: 600 }}>{inv.partyName}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'var(--neutral-100)', padding: '3px 8px', borderRadius: 4 }}>
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td>₹{inv.subtotal.toFixed(2)}</td>
                    <td>₹{inv.taxTotal.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--neutral-900)' }}>
                      ₹{inv.grandTotal.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 700, color: inv.balanceAmount > 0 ? 'var(--danger-600)' : 'var(--neutral-400)' }}>
                      ₹{inv.balanceAmount.toFixed(2)}
                    </td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-icon btn-sm"
                        title="View / Print Tax Invoice"
                        onClick={() => onViewInvoice(inv)}
                      >
                        <Printer size={15} color="var(--primary-600)" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
