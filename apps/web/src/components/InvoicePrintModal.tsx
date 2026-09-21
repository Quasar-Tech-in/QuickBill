import React, { useState } from 'react';
import { X, Printer, Download, Share2, CheckCircle2 } from 'lucide-react';
import { Invoice } from '../types';

interface InvoicePrintModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoice, onClose }) => {
  const [printFormat, setPrintFormat] = useState<'A4' | 'POS'>('A4');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: printFormat === 'A4' ? 680 : 420, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="card-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="card-title">Tax Invoice #{invoice.invoiceNumber}</span>
            <div style={{ display: 'flex', background: 'var(--neutral-100)', padding: 2, borderRadius: 'var(--radius-sm)' }}>
              <button
                className={`btn btn-sm ${printFormat === 'A4' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 8px', fontSize: '0.75rem' }}
                onClick={() => setPrintFormat('A4')}
              >
                A4 Standard
              </button>
              <button
                className={`btn btn-sm ${printFormat === 'POS' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 8px', fontSize: '0.75rem' }}
                onClick={() => setPrintFormat('POS')}
              >
                Thermal (80mm)
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={15} />
              <span>Print</span>
            </button>
            <button className="btn btn-secondary btn-icon btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Container */}
        <div className="card-body invoice-printable" style={{ overflowY: 'auto', flex: 1, padding: printFormat === 'A4' ? 32 : 16 }}>
          {/* Header */}
          <div style={{ borderBottom: '2px solid var(--neutral-900)', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: printFormat === 'A4' ? '1.5rem' : '1.15rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  QUICKBILL ENTERPRISE
                </h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>GSTIN: 07AABCB1234F1Z5</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>Plot 42, Tech Park, New Delhi, 110001</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>Ph: +91 9876543210 | info@quickbill.com</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.85rem' }}>
                  TAX INVOICE
                </div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 6 }}>{invoice.invoiceNumber}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>Date: {invoice.date}</p>
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div style={{ backgroundColor: 'var(--neutral-50)', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--neutral-400)', fontWeight: 700 }}>
              Customer Details
            </p>
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--neutral-900)' }}>{invoice.partyName}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)' }}>Payment Mode: <strong>{invoice.paymentMode}</strong></p>
          </div>

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--neutral-300)', textAlign: 'left', color: 'var(--neutral-600)' }}>
                <th style={{ padding: '8px 4px' }}>Item</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>GST</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>{line.name}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>{line.quantity}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>₹{line.unitPrice.toFixed(2)}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{line.taxRate}%</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>₹{line.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <div style={{ width: printFormat === 'A4' ? '280px' : '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--neutral-600)' }}>Subtotal:</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--neutral-600)' }}>GST Total:</span>
                <span>₹{invoice.taxTotal.toFixed(2)}</span>
              </div>
              {invoice.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: 'var(--success-700)' }}>
                  <span>Discount:</span>
                  <span>-₹{invoice.discountTotal.toFixed(2)}</span>
                </div>
              )}
              {invoice.roundOff !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: 'var(--neutral-500)' }}>
                  <span>Round Off:</span>
                  <span>₹{invoice.roundOff.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--neutral-900)', borderBottom: '2px solid var(--neutral-900)', marginTop: 4, fontWeight: 800, fontSize: '1.05rem' }}>
                <span>Grand Total:</span>
                <span style={{ color: 'var(--primary-600)' }}>₹{invoice.grandTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', marginTop: 4 }}>
                <span style={{ color: 'var(--neutral-600)' }}>Paid:</span>
                <span>₹{invoice.paidAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', fontWeight: 700, color: invoice.balanceAmount > 0 ? 'var(--danger-600)' : 'var(--success-600)' }}>
                <span>Balance:</span>
                <span>₹{invoice.balanceAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer Terms */}
          <div style={{ textAlign: 'center', borderTop: '1px dashed var(--neutral-300)', paddingTop: 12, marginTop: 16 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-700)' }}>
              Thank you for your business!
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>
              Goods once sold are non-refundable. For queries, contact support@quickbill.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
