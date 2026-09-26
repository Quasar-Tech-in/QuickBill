import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Sparkles,
  ArrowRight,
  PackageCheck,
  PackageX,
  RefreshCw,
  Info
} from 'lucide-react';
import { Invoice, InvoiceItem } from '../types';
import { store } from '../services/store';

interface InvoiceUpdateModalProps {
  invoice: Invoice;
  onClose: () => void;
  onUpdated: (updatedInvoice: Invoice) => void;
}

interface ItemReturnState {
  itemId: string;
  name: string;
  originalQty: number;
  returnedQty: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  returnReason: 'RESTOCKABLE_RETURN' | 'DEFECTIVE_DAMAGED' | 'EXCHANGE' | 'WRONG_ITEM';
  returnNote: string;
}

export const InvoiceUpdateModal: React.FC<InvoiceUpdateModalProps> = ({ invoice, onClose, onUpdated }) => {
  const [itemsState, setItemsState] = useState<ItemReturnState[]>(
    invoice.items.map(it => ({
      itemId: it.itemId,
      name: it.name,
      originalQty: it.quantity,
      returnedQty: it.returnedQuantity || 0,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      discountPercent: it.discountPercent || 0,
      returnReason: it.returnReason || 'RESTOCKABLE_RETURN',
      returnNote: it.returnNote || '',
    }))
  );

  const [returnNotes, setReturnNotes] = useState<string>(invoice.returnNotes || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute live financial totals
  const originalGrand = invoice.originalGrandTotal || invoice.grandTotal;
  let netSubtotal = 0;
  let netTax = 0;
  let totalReturnedQty = 0;

  itemsState.forEach(it => {
    const activeQty = Math.max(0, it.originalQty - it.returnedQty);
    totalReturnedQty += it.returnedQty;
    const gross = activeQty * it.unitPrice;
    const disc = it.discountPercent ? (gross * (it.discountPercent / 100)) : 0;
    const taxable = Math.max(0, gross - disc);
    const tax = taxable * (it.taxRate / 100);
    netSubtotal += taxable;
    netTax += tax;
  });

  const netGrandTotal = Number((netSubtotal + netTax).toFixed(2));
  const returnDeduction = Math.max(0, Number((originalGrand - netGrandTotal).toFixed(2)));
  const refundDue = invoice.paidAmount > netGrandTotal ? Number((invoice.paidAmount - netGrandTotal).toFixed(2)) : 0;

  const handleQtyChange = (itemId: string, newQty: number) => {
    setItemsState(prev => prev.map(it => {
      if (it.itemId !== itemId) return it;
      const clamped = Math.min(it.originalQty, Math.max(0, Number(newQty) || 0));
      return { ...it, returnedQty: clamped };
    }));
  };

  const handleReasonChange = (itemId: string, reason: ItemReturnState['returnReason']) => {
    setItemsState(prev => prev.map(it => it.itemId === itemId ? { ...it, returnReason: reason } : it));
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setItemsState(prev => prev.map(it => it.itemId === itemId ? { ...it, returnNote: note } : it));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        items: itemsState.map(it => ({
          itemId: it.itemId,
          quantity: it.originalQty,
          returnedQuantity: it.returnedQty,
          returnReason: it.returnedQty > 0 ? it.returnReason : undefined,
          returnNote: it.returnedQty > 0 ? it.returnNote : undefined,
        })),
        returnNotes: returnNotes.trim() || undefined,
      };

      const updated = await store.updateInvoiceWithReturn(invoice.id, payload);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      console.error('Error saving invoice update/return:', err);
      setErrorMsg(err?.message || 'Failed to update invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: 780, 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{ 
          padding: '16px 20px', 
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
              borderRadius: 'var(--radius-md)', 
              backgroundColor: 'var(--primary-100)', 
              color: 'var(--primary-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                Update Invoice &amp; Process Returns
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                Invoice: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)' }}>{invoice.invoiceNumber}</strong> • Customer: {invoice.consumerName || invoice.partyName || 'Walk-in'}
              </p>
            </div>
          </div>

          <button 
            type="button"
            className="btn btn-secondary btn-icon btn-sm" 
            onClick={onClose} 
            title="Close"
            style={{ width: 32, height: 32 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Explicit Warning Alert Banner Regarding Inventory Stock */}
          <div style={{ 
            backgroundColor: '#fffbeb', 
            border: '1px solid #fef08a', 
            borderLeft: '4px solid #f59e0b',
            padding: '12px 16px', 
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}>
            <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#92400e', marginBottom: 2 }}>
                ⚠️ Important Notice: Inventory Stock Separation
              </div>
              <p style={{ fontSize: '0.78rem', color: '#b45309', margin: 0, lineHeight: 1.45 }}>
                Updating this bill will recalculate billing amounts, register return/defective marks on the receipt, and adjust financial records. <strong>It will NOT automatically restock physical inventory in your store/warehouse</strong>. Please process and inspect physical restockable items separately under <strong>Inventory &amp; Items &gt; Adjust Stock</strong>.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: '0.82rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Line Items Return Selector */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Line Items &amp; Return Allocation
            </h4>

            <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)', color: 'var(--neutral-600)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', width: '36%' }}>Item &amp; Price</th>
                    <th style={{ padding: '10px 14px', width: '22%', textAlign: 'center' }}>Return Qty</th>
                    <th style={{ padding: '10px 14px', width: '42%' }}>Condition &amp; Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsState.map((it) => {
                    const activeQty = Math.max(0, it.originalQty - it.returnedQty);
                    const isFullyReturned = it.returnedQty >= it.originalQty && it.originalQty > 0;
                    const isPartiallyReturned = it.returnedQty > 0 && it.returnedQty < it.originalQty;

                    return (
                      <tr 
                        key={it.itemId} 
                        style={{ 
                          borderBottom: '1px solid var(--neutral-100)',
                          backgroundColor: isFullyReturned ? 'rgba(239, 68, 68, 0.04)' : (isPartiallyReturned ? 'rgba(245, 158, 11, 0.04)' : '#ffffff')
                        }}
                      >
                        {/* Item Details */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{it.name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                            ₹{it.unitPrice.toFixed(2)} × {it.originalQty} pcs (Billed)
                          </div>
                          <div style={{ fontSize: '0.72rem', color: isFullyReturned ? 'var(--danger-700)' : 'var(--neutral-600)', fontWeight: 600, marginTop: 2 }}>
                            Active Remaining: {activeQty} pcs
                          </div>
                        </td>

                        {/* Return Quantity Stepper */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(it.itemId, it.returnedQty - 1)}
                              disabled={it.returnedQty <= 0}
                              style={{ width: 28, height: 28, border: 'none', background: 'var(--neutral-100)', cursor: it.returnedQty <= 0 ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={it.originalQty}
                              step="any"
                              value={it.returnedQty}
                              onChange={(e) => handleQtyChange(it.itemId, parseFloat(e.target.value) || 0)}
                              style={{ width: 50, height: 28, border: 'none', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleQtyChange(it.itemId, it.returnedQty + 1)}
                              disabled={it.returnedQty >= it.originalQty}
                              style={{ width: 28, height: 28, border: 'none', background: 'var(--neutral-100)', cursor: it.returnedQty >= it.originalQty ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                            >
                              +
                            </button>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--neutral-400)', marginTop: 3 }}>
                            Max: {it.originalQty}
                          </div>
                        </td>

                        {/* Condition & Notes */}
                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          {it.returnedQty > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <select
                                className="form-select"
                                style={{ padding: '4px 8px', fontSize: '0.78rem', height: 30, borderRadius: 'var(--radius-sm)' }}
                                value={it.returnReason}
                                onChange={(e) => handleReasonChange(it.itemId, e.target.value as any)}
                              >
                                <option value="RESTOCKABLE_RETURN">🟢 Customer Return (Good / Restockable)</option>
                                <option value="DEFECTIVE_DAMAGED">🔴 Defective / Damaged (Scrap Item)</option>
                                <option value="EXCHANGE">🟡 Exchange / Wrong Item</option>
                              </select>

                              <input
                                type="text"
                                placeholder="Specific reason (e.g. broken seal, wrong size)..."
                                className="form-input"
                                style={{ padding: '4px 8px', fontSize: '0.76rem', height: 28, borderRadius: 'var(--radius-sm)' }}
                                value={it.returnNote}
                                onChange={(e) => handleNoteChange(it.itemId, e.target.value)}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.76rem', color: 'var(--neutral-400)', fontStyle: 'italic' }}>
                              No items returned
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Return Remarks Textarea */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--neutral-700)', marginBottom: 4 }}>
              Overall Return Notes / Memo
            </label>
            <textarea
              rows={2}
              placeholder="Add internal notes or customer return justification..."
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem', padding: '8px 12px', resize: 'vertical' }}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
          </div>

          {/* Financial Calculation Summary Card */}
          <div style={{ 
            backgroundColor: 'var(--neutral-50)', 
            border: '1px solid var(--neutral-200)', 
            borderRadius: 'var(--radius-md)', 
            padding: '16px 20px' 
          }}>
            <h4 style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--neutral-800)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Financial Recalculation Preview
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Original Bill Total</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                  ₹{originalGrand.toFixed(2)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--danger-600)', fontWeight: 600 }}>Returned Value</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger-600)' }}>
                  -₹{returnDeduction.toFixed(2)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary-700)', fontWeight: 600 }}>Net Adjusted Total</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                  ₹{netGrandTotal.toFixed(2)}
                </div>
              </div>

              {refundDue > 0 && (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success-200)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--success-700)', fontWeight: 700 }}>Refund / Credit Due</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success-700)' }}>
                    ₹{refundDue.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ 
          padding: '14px 20px', 
          borderTop: '1px solid var(--neutral-200)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: '#ffffff'
        }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>

          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '7px 18px' }}
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="spin-animation" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Confirm &amp; Update Invoice</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
