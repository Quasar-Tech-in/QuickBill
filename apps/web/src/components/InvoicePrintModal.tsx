import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { Invoice } from '../types';
import { store } from '../services/store';

interface InvoicePrintModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoice, onClose }) => {
  // Default to POS Thermal 80mm standard template as requested
  const [printFormat, setPrintFormat] = useState<'POS' | 'A4'>('POS');
  
  const activeTenant = store.getActiveTenant();
  const activeLocation = store.getActiveLocation();

  const handlePrint = () => {
    window.print();
  };


  const storeName = activeTenant?.name || 'QUICKBILL ENTERPRISE';
  const branchName = invoice.locationName || activeLocation?.name || 'Main Branch';
  const branchAddress = invoice.locationAddress || activeLocation?.address || 'Plot 42, Tech Park, New Delhi, 110001';
  const branchPhone = invoice.locationPhone || activeLocation?.phone || '+91 98765 43210';
  const gstin = activeTenant?.gstin || '07AABCB1234F1Z5';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: printFormat === 'A4' ? 700 : 440, 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          transition: 'max-width 0.2s ease'
        }}
      >
        {/* Modal Action Header (Excluded from Print) */}
        <div 
          className="card-header no-print" 
          style={{ 
            padding: '14px 20px', 
            borderBottom: '1px solid var(--neutral-200)', 
            backgroundColor: '#ffffff',
            display: 'flex', 
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
            position: 'relative'
          }}
        >
          {/* Top Row: Receipt Title & Return Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 42 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Receipt No:
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                {invoice.invoiceNumber}
              </span>
              {invoice.hasReturns && (
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                  color: 'var(--danger-700)', 
                  padding: '2px 8px', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.25)' 
                }}>
                  🔄 {invoice.status === 'RETURNED' ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
                </span>
              )}
            </div>
          </div>

          {/* Dedicated Top-Right Close Button */}
          <button 
            type="button"
            className="btn btn-secondary btn-icon btn-sm" 
            onClick={onClose} 
            title="Close Preview"
            style={{ 
              position: 'absolute',
              top: 12,
              right: 16,
              width: 32, 
              height: 32, 
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--neutral-100)',
              border: '1px solid var(--neutral-300)',
              color: 'var(--neutral-700)',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <X size={17} />
          </button>

          {/* Bottom Action Row: Format Switcher & Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            {/* Format Toggle Switch */}
            <div 
              style={{ 
                display: 'inline-flex', 
                background: 'var(--neutral-100)', 
                padding: 3, 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--neutral-200)',
                gap: 2
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${printFormat === 'POS' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  border: 'none', 
                  padding: '4px 10px', 
                  fontSize: '0.76rem', 
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: printFormat === 'POS' ? 'var(--shadow-sm)' : 'none'
                }}
                onClick={() => setPrintFormat('POS')}
              >
                Thermal (80mm)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${printFormat === 'A4' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  border: 'none', 
                  padding: '4px 10px', 
                  fontSize: '0.76rem', 
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: printFormat === 'A4' ? 'var(--shadow-sm)' : 'none'
                }}
                onClick={() => setPrintFormat('A4')}
              >
                A4 Standard
              </button>
            </div>

            {/* Print Trigger Button */}
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handlePrint} 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                fontWeight: 700,
                padding: '6px 16px',
                fontSize: '0.82rem'
              }}
            >
              <Printer size={15} />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>


        {/* Scrollable Printable Receipt Container */}
        <div 
          className="card-body invoice-printable" 
          style={{ 
            overflowY: 'auto', 
            flex: 1, 
            padding: printFormat === 'A4' ? '28px 32px' : '20px 16px',
            backgroundColor: '#ffffff',
            fontFamily: printFormat === 'POS' ? 'var(--font-mono, monospace)' : 'var(--font-sans)',
            color: '#000000',
            fontSize: printFormat === 'POS' ? '0.76rem' : '0.84rem',
            lineHeight: 1.4,
          }}
        >
          {printFormat === 'POS' ? (
            /* ========================================================
               STANDARD THERMAL POS TEMPLATE (80mm)
               ======================================================== */
            <div style={{ maxWidth: 330, margin: '0 auto', textAlign: 'center' }}>
              {/* Company & Location Header Directly on Receipt */}
              <div style={{ marginBottom: 8 }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: '#000000' }}>
                  {storeName}
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', fontWeight: 600 }}>
                  {branchName}
                </p>
                <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: '#333333' }}>
                  {branchAddress}
                </p>
                {branchPhone && (
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: '#333333' }}>
                    Tel: {branchPhone}
                  </p>
                )}
                {gstin && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', fontWeight: 700 }}>
                    GSTIN: {gstin}
                  </p>
                )}
              </div>

              {/* Dashed Separator */}
              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Consistent Invoice Number & Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, textAlign: 'left' }}>
                <span>Receipt: {invoice.invoiceNumber}</span>
                <span>Date: {invoice.date}</span>
              </div>

              {/* Dashed Separator */}
              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Item Lines Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #000000', fontWeight: 800 }}>
                    <th style={{ padding: '3px 0', width: '50%' }}>ITEM</th>
                    <th style={{ padding: '3px 0', textAlign: 'center', width: '15%' }}>QTY</th>
                    <th style={{ padding: '3px 0', textAlign: 'right', width: '15%' }}>PRICE</th>
                    <th style={{ padding: '3px 0', textAlign: 'right', width: '20%' }}>AMT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((line, idx) => {
                    const hasRet = line.returnedQuantity && line.returnedQuantity > 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dotted #e5e5e5' }}>
                        <td style={{ padding: '3px 0', fontWeight: 600, wordBreak: 'break-word' }}>
                          <div>{line.name}</div>
                          {hasRet && (
                            <div style={{ fontSize: '0.66rem', color: '#b91c1c', fontWeight: 700 }}>
                              [RET: {line.returnedQuantity} {line.returnReason === 'DEFECTIVE_DAMAGED' ? 'DEFECTIVE' : 'RETURN'}]
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '3px 0', textAlign: 'center' }}>
                          {hasRet ? `${line.quantity - (line.returnedQuantity || 0)}/${line.quantity}` : line.quantity}
                        </td>
                        <td style={{ padding: '3px 0', textAlign: 'right' }}>
                          {line.unitPrice.toFixed(2)}
                        </td>

                        <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700 }}>
                          {line.total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Dashed Separator */}
              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Totals Breakdown */}
              <div style={{ fontSize: '0.74rem', lineHeight: 1.45 }}>
                {invoice.originalGrandTotal && invoice.originalGrandTotal !== invoice.grandTotal && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666666' }}>
                    <span>Original Total:</span>
                    <span>₹{invoice.originalGrandTotal.toFixed(2)}</span>
                  </div>
                )}
                {invoice.returnTotal && invoice.returnTotal > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b91c1c' }}>
                    <span>Less Returns:</span>
                    <span>-₹{invoice.returnTotal.toFixed(2)}</span>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable Base:</span>
                  <span>₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>GST Taxes (Incl.):</span>
                  <span>₹{invoice.taxTotal.toFixed(2)}</span>
                </div>
                {invoice.discountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Discount:</span>
                    <span>-₹{invoice.discountTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Grand Total Bar */}
              <div style={{ 
                borderTop: '2px solid #000000', 
                borderBottom: '2px solid #000000', 
                padding: '5px 0', 
                margin: '6px 0',
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '0.98rem', 
                fontWeight: 900 
              }}>
                <span>NET GRAND TOTAL:</span>
                <span>₹{invoice.grandTotal.toFixed(2)}</span>
              </div>

              {/* Settlement Info */}
              <div style={{ fontSize: '0.73rem', lineHeight: 1.35 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Payment Mode:</span>
                  <span style={{ fontWeight: 700 }}>{invoice.paymentMode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amount Paid:</span>
                  <span>₹{invoice.paidAmount.toFixed(2)}</span>
                </div>
                {invoice.balanceAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b91c1c' }}>
                    <span>Balance Due:</span>
                    <span>₹{invoice.balanceAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Footer Notice */}
              <div style={{ borderTop: '1px dashed #000000', marginTop: 10, paddingTop: 6, textAlign: 'center', fontSize: '0.68rem' }}>
                <p style={{ margin: 0, fontWeight: 800 }}>*** THANK YOU FOR SHOPPING WITH US! ***</p>
                <p style={{ margin: '2px 0 0 0', color: '#555555' }}>Please keep this receipt for future reference</p>
                <p style={{ margin: '1px 0 0 0', fontSize: '0.62rem', color: '#777777' }}>Powered by QuickBill POS</p>
              </div>
            </div>
          ) : (
            /* ========================================================
               A4 STANDARD TEMPLATE
               ======================================================== */
            <div>
              {/* A4 Header */}
              <div style={{ borderBottom: '2px solid var(--neutral-900)', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                      {storeName}
                    </h1>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--neutral-700)', marginTop: 2 }}>{branchName}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', margin: '1px 0' }}>{branchAddress}</p>
                    {branchPhone && <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', margin: '1px 0' }}>Tel: {branchPhone}</p>}
                    {gstin && <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-800)', marginTop: 2 }}>GSTIN: {gstin}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.85rem' }}>
                      TAX INVOICE
                    </div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 6, margin: '4px 0 0 0' }}>{invoice.invoiceNumber}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', margin: '2px 0 0 0' }}>Date: {invoice.date}</p>
                    {invoice.hasReturns && (
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger-700)', margin: '2px 0 0 0' }}>
                        ⚠️ Has Item Returns
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--neutral-300)', textAlign: 'left', color: 'var(--neutral-600)', backgroundColor: 'var(--neutral-50)' }}>
                    <th style={{ padding: '7px 6px' }}>Item Details</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center' }}>Billed Qty</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center' }}>Returned</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>GST</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>Net Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                      <td style={{ padding: '7px 6px', fontWeight: 600 }}>
                        <div>{line.name}</div>
                        {line.returnNote && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontWeight: 400 }}>
                            Note: {line.returnNote}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '7px 6px', textAlign: 'center' }}>{line.quantity}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'center', color: line.returnedQuantity ? 'var(--danger-700)' : 'var(--neutral-400)', fontWeight: line.returnedQuantity ? 700 : 400 }}>
                        {line.returnedQuantity ? `${line.returnedQuantity} (${line.returnReason === 'DEFECTIVE_DAMAGED' ? 'Defective' : 'Return'})` : '-'}
                      </td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}>₹{line.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right' }}>{line.taxRate}%</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700 }}>₹{line.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{ width: '280px' }}>
                  {invoice.originalGrandTotal && invoice.originalGrandTotal !== invoice.grandTotal && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                      <span>Original Billed Total:</span>
                      <span>₹{invoice.originalGrandTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {invoice.returnTotal && invoice.returnTotal > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--danger-700)', fontWeight: 700 }}>
                      <span>Less Returned Items:</span>
                      <span>-₹{invoice.returnTotal.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Taxable Subtotal:</span>
                    <span>₹{invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>GST Total (Incl.):</span>
                    <span>₹{invoice.taxTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid var(--neutral-900)', borderBottom: '2px solid var(--neutral-900)', marginTop: 4, fontWeight: 800, fontSize: '1rem' }}>
                    <span>Net Grand Total:</span>
                    <span style={{ color: 'var(--primary-600)' }}>₹{invoice.grandTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', marginTop: 4 }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Payment Mode:</span>
                    <span style={{ fontWeight: 700 }}>{invoice.paymentMode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Paid:</span>
                    <span>₹{invoice.paidAmount.toFixed(2)}</span>
                  </div>
                  {invoice.balanceAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger-600)' }}>
                      <span>Balance Due:</span>
                      <span>₹{invoice.balanceAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Terms */}
              <div style={{ textAlign: 'center', borderTop: '1px dashed var(--neutral-300)', paddingTop: 10, marginTop: 12 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-700)', margin: 0 }}>
                  Thank you for your business!
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                  For questions regarding warranty or returns, please retain this invoice copy.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

