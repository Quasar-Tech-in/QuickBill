import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Minus,
  Plus,
  Calculator
} from 'lucide-react';
import { Invoice } from '../types';
import { store } from '../services/store';

interface InvoiceUpdateModalProps {
  invoice: Invoice;
  onClose: () => void;
  onUpdated: (updatedInvoice: Invoice) => void;
}

interface ItemReturnState {
  itemId: string;
  name: string;
  unit: string;
  originalQty: number;
  returnedQty: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  returnReason: 'RESTOCKABLE_RETURN' | 'DEFECTIVE_DAMAGED' | 'EXCHANGE' | 'WRONG_ITEM';
  returnNote: string;
}

// Helper to parse decimal numbers or fraction expressions (e.g. "4/30", "6/12", "1 4/12", "1+4/12")
const parseFractionString = (str: string): number | null => {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Single decimal or integer e.g. "1.5" or "4"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Fraction e.g. "4/30" or "6/12"
  const fractionMatch = trimmed.match(/^(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[3]);
    if (den > 0) {
      return num / den;
    }
  }

  // Mixed fraction e.g. "1 4/12" or "1+4/12"
  const mixedMatch = trimmed.match(/^(\d+(\.\d+)?)\s*(?:\+|\s)\s*(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[3]);
    const den = parseFloat(mixedMatch[5]);
    if (den > 0) {
      return whole + (num / den);
    }
  }

  return null;
};

export const InvoiceUpdateModal: React.FC<InvoiceUpdateModalProps> = ({ invoice, onClose, onUpdated }) => {
  const [itemsState, setItemsState] = useState<ItemReturnState[]>(
    invoice.items.map(it => ({
      itemId: it.itemId,
      name: it.name,
      unit: it.unit || 'pcs',
      originalQty: it.quantity,
      returnedQty: it.returnedQuantity || 0,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      discountPercent: it.discountPercent || 0,
      returnReason: it.returnReason || 'RESTOCKABLE_RETURN',
      returnNote: it.returnNote || '',
    }))
  );

  // Map of raw typed input string per item to allow typing "0.", "0.0", "4/30" without React resetting mid-keystroke
  const [qtyInputMap, setQtyInputMap] = useState<Record<string, string>>({});

  // Fraction / Loose Parts Calculator Modal State
  const [fractionModal, setFractionModal] = useState<{
    isOpen: boolean;
    itemId: string;
    itemName: string;
    unit: string;
    unitPrice: number;
    maxQty: number;
    wholeUnits: string;
    partsGiven: string;
    totalParts: string;
  }>({
    isOpen: false,
    itemId: '',
    itemName: '',
    unit: 'pcs',
    unitPrice: 0,
    maxQty: 0,
    wholeUnits: '0',
    partsGiven: '1',
    totalParts: '12',
  });

  const [returnNotes, setReturnNotes] = useState<string>(invoice.returnNotes || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute live financial totals (tax-inclusive MRP standard)
  const originalGrand = invoice.originalGrandTotal || invoice.grandTotal;
  let netSubtotal = 0;
  let netTax = 0;
  let netGrandTotal = 0;
  let totalReturnedQty = 0;
  let returnDeduction = 0;

  itemsState.forEach(it => {
    const activeQty = Math.max(0, Number((it.originalQty - it.returnedQty).toFixed(3)));
    totalReturnedQty += it.returnedQty;
    const gross = activeQty * it.unitPrice;
    const disc = it.discountPercent ? (gross * (it.discountPercent / 100)) : 0;
    const netLineInclusive = Math.max(0, gross - disc);
    
    // Extract taxable base from tax-inclusive amount: Base = Inclusive / (1 + TaxRate/100)
    const taxable = it.taxRate > 0 ? (netLineInclusive * 100 / (100 + it.taxRate)) : netLineInclusive;
    const tax = netLineInclusive - taxable;

    netSubtotal += taxable;
    netTax += tax;
    netGrandTotal += netLineInclusive;

    // Return value for returned quantity (tax-inclusive full product price)
    const retGross = it.returnedQty * it.unitPrice;
    const retDisc = it.discountPercent ? (retGross * (it.discountPercent / 100)) : 0;
    returnDeduction += Math.max(0, retGross - retDisc);
  });

  netSubtotal = Number(netSubtotal.toFixed(2));
  netTax = Number(netTax.toFixed(2));
  netGrandTotal = Number(netGrandTotal.toFixed(2));
  returnDeduction = Number(returnDeduction.toFixed(2));
  const refundDue = invoice.paidAmount > netGrandTotal ? Number((invoice.paidAmount - netGrandTotal).toFixed(2)) : 0;

  // Handle manual typing into quantity field (allows fractions & decimals)
  const handleQtyInputChange = (itemId: string, rawVal: string) => {
    // Allow digits, decimals, slash, plus, spaces (e.g. "4/30", "1 4/12", "0.5")
    if (!/^[0-9\s/+.compact-]*$/.test(rawVal)) {
      return;
    }
    setQtyInputMap(prev => ({ ...prev, [itemId]: rawVal }));
  };

  // On blur, evaluate the input and round strictly to 3 decimal places
  const handleQtyInputBlur = (itemId: string, origQty: number) => {
    const rawVal = qtyInputMap[itemId];
    if (rawVal === undefined) return;

    if (!rawVal.trim()) {
      handleQtyChange(itemId, 0);
      setQtyInputMap(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      return;
    }

    const parsed = parseFractionString(rawVal);
    if (parsed !== null && !isNaN(parsed)) {
      // Clamped and rounded strictly to 3 decimal places
      const clamped = Math.min(origQty, Math.max(0, Number(parsed.toFixed(3))));
      handleQtyChange(itemId, clamped);
    }

    setQtyInputMap(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleQtyChange = (itemId: string, newQty: number) => {
    setItemsState(prev => prev.map(it => {
      if (it.itemId !== itemId) return it;
      const clamped = Math.min(it.originalQty, Math.max(0, Number(Number(newQty).toFixed(3)) || 0));
      return { ...it, returnedQty: clamped };
    }));
  };

  // Open Fraction Modal for a specific line item
  const handleOpenFractionModal = (it: ItemReturnState) => {
    const whole = Math.floor(it.returnedQty || 0);
    setFractionModal({
      isOpen: true,
      itemId: it.itemId,
      itemName: it.name,
      unit: it.unit || 'pcs',
      unitPrice: it.unitPrice,
      maxQty: it.originalQty,
      wholeUnits: whole > 0 ? String(whole) : '0',
      partsGiven: '1',
      totalParts: '12',
    });
  };

  // Apply Fraction / Loose Parts Calculation
  const handleApplyFraction = () => {
    const whole = parseFloat(fractionModal.wholeUnits) || 0;
    const parts = parseFloat(fractionModal.partsGiven) || 0;
    const total = parseFloat(fractionModal.totalParts) || 1;

    if (total <= 0 || (whole === 0 && parts === 0)) return;

    // Strict 3 decimal places rounding
    const calculatedQty = Number((whole + (parts / total)).toFixed(3));
    const clamped = Math.min(fractionModal.maxQty, Math.max(0, calculatedQty));

    setQtyInputMap(prev => {
      const next = { ...prev };
      delete next[fractionModal.itemId];
      return next;
    });

    handleQtyChange(fractionModal.itemId, clamped);
    setFractionModal(prev => ({ ...prev, isOpen: false }));
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
          returnedQuantity: Number(it.returnedQty.toFixed(3)),
          returnReason: it.returnedQty > 0 ? it.returnReason : undefined,
          returnNote: it.returnedQty > 0 ? it.returnNote : undefined,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          discount: it.discountPercent ? ((it.unitPrice * it.originalQty) * (it.discountPercent / 100)) : 0,
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

  // Fraction Presets for Denominator
  const packPresets = [
    { label: '12 (Dozen)', value: '12' },
    { label: '30 (Egg Crate)', value: '30' },
    { label: '24 (Case)', value: '24' },
    { label: '10 (Strip/Box)', value: '10' },
    { label: '6 (Half Dozen)', value: '6' },
  ];

  // Fraction live preview calculations
  const modalWhole = parseFloat(fractionModal.wholeUnits) || 0;
  const modalParts = parseFloat(fractionModal.partsGiven) || 0;
  const modalTotal = parseFloat(fractionModal.totalParts) || 1;
  const modalCalculatedQty = modalTotal > 0 ? Number((modalWhole + (modalParts / modalTotal)).toFixed(3)) : 0;
  const modalPiecePrice = modalTotal > 0 ? (fractionModal.unitPrice / modalTotal) : 0;
  const modalRefundVal = Number((modalCalculatedQty * fractionModal.unitPrice).toFixed(2));

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: 820, 
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
                    <th style={{ padding: '10px 14px', width: '34%' }}>Item &amp; Price</th>
                    <th style={{ padding: '10px 14px', width: '28%', textAlign: 'center' }}>Return Qty (Fractions Allowed)</th>
                    <th style={{ padding: '10px 14px', width: '38%' }}>Condition &amp; Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsState.map((it) => {
                    const activeQty = Math.max(0, Number((it.originalQty - it.returnedQty).toFixed(3)));
                    const isFullyReturned = it.returnedQty >= it.originalQty && it.originalQty > 0;
                    const isPartiallyReturned = it.returnedQty > 0 && it.returnedQty < it.originalQty;
                    const displayQtyStr = qtyInputMap[it.itemId] !== undefined 
                      ? qtyInputMap[it.itemId] 
                      : (it.returnedQty > 0 ? String(it.returnedQty) : '0');

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
                            ₹{it.unitPrice.toFixed(2)} / {it.unit} (MRP incl. {it.taxRate}% GST)
                          </div>
                          <div style={{ fontSize: '0.72rem', color: isFullyReturned ? 'var(--danger-700)' : 'var(--neutral-600)', fontWeight: 600, marginTop: 2 }}>
                            Billed: {it.originalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {it.unit} • Active: {activeQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {it.unit}
                          </div>
                          {it.returnedQty > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--danger-600)', fontWeight: 700, marginTop: 2 }}>
                              Refund Amount: ₹{(it.returnedQty * it.unitPrice * (1 - (it.discountPercent || 0) / 100)).toFixed(2)} (Full Product Value)
                            </div>
                          )}
                        </td>

                        {/* Return Quantity Stepper & Fraction Quick Tools */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                              <button
                                type="button"
                                onClick={() => handleQtyChange(it.itemId, Math.max(0, it.returnedQty - 1))}
                                disabled={it.returnedQty <= 0}
                                style={{ width: 28, height: 28, border: 'none', background: 'var(--neutral-100)', cursor: it.returnedQty <= 0 ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                                title="Decrease by 1"
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={displayQtyStr}
                                onChange={(e) => handleQtyInputChange(it.itemId, e.target.value)}
                                onBlur={() => handleQtyInputBlur(it.itemId, it.originalQty)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleQtyInputBlur(it.itemId, it.originalQty);
                                  }
                                }}
                                style={{ width: 64, height: 28, border: 'none', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', outline: 'none' }}
                                title="Enter decimal (e.g. 0.5) or fraction (e.g. 4/12, 4/30)"
                              />
                              <button
                                type="button"
                                onClick={() => handleQtyChange(it.itemId, Math.min(it.originalQty, it.returnedQty + 1))}
                                disabled={it.returnedQty >= it.originalQty}
                                style={{ width: 28, height: 28, border: 'none', background: 'var(--neutral-100)', cursor: it.returnedQty >= it.originalQty ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                                title="Increase by 1"
                              >
                                +
                              </button>
                            </div>

                            {/* Quick Fraction / Loose Parts Helper Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenFractionModal(it)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 8px',
                                fontSize: '0.70rem',
                                fontWeight: 700,
                                color: 'var(--primary-700)',
                                backgroundColor: 'var(--primary-50)',
                                border: '1px solid var(--primary-200)',
                                borderRadius: 4,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="Calculate fraction or loose pieces (e.g. 4 eggs out of 12)"
                            >
                              <Calculator size={11} color="var(--primary-600)" />
                              <span>Fraction / Parts</span>
                            </button>

                            <div style={{ fontSize: '0.68rem', color: 'var(--neutral-400)' }}>
                              Max: {it.originalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                            </div>
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

      {/* Loose Parts & Fraction Return Calculator Popup */}
      {fractionModal.isOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setFractionModal(prev => ({ ...prev, isOpen: false }))} 
          style={{ zIndex: 10005, backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: 380, 
              width: '92%', 
              backgroundColor: '#ffffff', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '14px 18px', 
              borderBottom: '1px solid var(--neutral-200)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              backgroundColor: 'var(--neutral-50)' 
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--neutral-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calculator size={16} color="var(--primary-600)" />
                  Return Loose / Fraction
                </h4>
                <div style={{ fontSize: '0.74rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                  {fractionModal.itemName}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setFractionModal(prev => ({ ...prev, isOpen: false }))} 
                className="btn btn-secondary btn-icon btn-sm"
                style={{ width: 28, height: 28 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. Pieces / Parts to Return */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--neutral-700)', marginBottom: 4 }}>
                    Loose Pieces / Parts to Return (Numerator)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFractionModal(prev => ({ ...prev, partsGiven: String(Math.max(1, (parseFloat(prev.partsGiven) || 1) - 1)) }))}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: '1px solid var(--neutral-300)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-700)'
                      }}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fractionModal.partsGiven}
                      onChange={(e) => setFractionModal(prev => ({ ...prev, partsGiven: e.target.value }))}
                      className="form-input"
                      placeholder="4"
                      style={{ fontSize: '0.90rem', padding: '5px 8px', flex: 1, textAlign: 'center', fontWeight: 700 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setFractionModal(prev => ({ ...prev, partsGiven: String((parseFloat(prev.partsGiven) || 0) + 1) }))}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: '1px solid var(--neutral-300)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-700)'
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* 2. Out of Total in Pack (Denominator) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                      Out of Total in 1 Full {fractionModal.unit || 'Unit'}
                    </label>
                    {modalPiecePrice > 0 && (
                      <span style={{ fontSize: '0.70rem', color: 'var(--primary-700)', fontWeight: 700 }}>
                        ₹{modalPiecePrice.toFixed(2)}/pc
                      </span>
                    )}
                  </div>

                  {/* Pack Presets */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {packPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setFractionModal(prev => ({ ...prev, totalParts: preset.value }))}
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid',
                          borderColor: fractionModal.totalParts === preset.value ? 'var(--primary-500)' : 'var(--neutral-200)',
                          backgroundColor: fractionModal.totalParts === preset.value ? 'var(--primary-50)' : '#ffffff',
                          color: fractionModal.totalParts === preset.value ? 'var(--primary-700)' : 'var(--neutral-700)',
                          fontWeight: fractionModal.totalParts === preset.value ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={fractionModal.totalParts}
                    onChange={(e) => setFractionModal(prev => ({ ...prev, totalParts: e.target.value }))}
                    className="form-input"
                    placeholder="Total parts (e.g. 12 or 30)"
                    style={{ fontSize: '0.84rem', padding: '5px 8px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* 3. Optional Whole Packs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--neutral-600)', fontWeight: 600 }}>
                    + Whole {fractionModal.unit || 'Units'} (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fractionModal.wholeUnits}
                    onChange={(e) => setFractionModal(prev => ({ ...prev, wholeUnits: e.target.value }))}
                    className="form-input"
                    placeholder="0"
                    style={{ width: 70, fontSize: '0.84rem', padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}
                  />
                </div>

                {/* Live Preview Box (Rounded to 3 decimal places) */}
                <div style={{ 
                  backgroundColor: 'var(--primary-50)', 
                  border: '1px solid var(--primary-200)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--primary-600)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Calculated Return Qty
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-800)', fontFamily: 'var(--font-mono)' }}>
                      {modalCalculatedQty.toFixed(3)} {fractionModal.unit}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--primary-600)' }}>
                      {modalParts}/{modalTotal} {modalWhole > 0 ? `+ ${modalWhole}` : ''} (Strict 3 Decimals)
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.70rem', color: 'var(--neutral-500)', fontWeight: 600 }}>
                      Refund Value
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--danger-700)' }}>
                      -₹{modalRefundVal.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '12px 18px', 
              borderTop: '1px solid var(--neutral-200)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              backgroundColor: 'var(--neutral-50)' 
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setFractionModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApplyFraction}
                style={{ fontWeight: 700 }}
              >
                Apply ({modalCalculatedQty.toFixed(3)} {fractionModal.unit})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
