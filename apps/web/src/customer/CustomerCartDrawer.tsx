import React, { useState } from 'react';
import axios from 'axios';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export interface CartLineItem {
  item: any;
  quantity: number;
  notes: string;
  variantName?: string;
}

interface CustomerCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartLineItem[];
  onUpdateQuantity: (itemId: string, delta: number, variantName?: string) => void;
  onUpdateNotes: (itemId: string, notes: string, variantName?: string) => void;
  onClearCart: () => void;
  businessId: string;
  tableId: string;
  token?: string;
  /** HMAC member token — identifies the ordering member within the session */
  memberToken?: string;
  /** Active session ID */
  sessionId?: string;
  tableName?: string;
  onOrderSuccess: (orderData: any) => void;
}

export const CustomerCartDrawer: React.FC<CustomerCartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onUpdateNotes,
  onClearCart,
  businessId,
  tableId,
  token,
  memberToken,
  sessionId,
  tableName,
  onOrderSuccess,
}) => {
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [submittedOrderInfo, setSubmittedOrderInfo] = useState<any>(null);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((sum, line) => {
    const price = line.item.salePrice || line.item.unitPrice || 0;
    return sum + price * line.quantity;
  }, 0);

  const estimatedTax = subtotal * 0.05; // 5% GST standard estimate
  const grandTotal = subtotal + estimatedTax;

  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const payload: Record<string, any> = {
        tableId,
        qrToken: token || '',
        token: token || undefined,
        notes: generalNotes.trim() || undefined,
        items: cartItems.map(c => ({
          itemId: c.item.id,
          itemName: c.item.name,
          quantity: c.quantity,
          variantName: c.variantName || undefined,
          notes: c.notes.trim() || undefined,
          unitPrice: c.item.salePrice || c.item.unitPrice || 0,
        })),
      };

      // Include memberToken for session member identification
      if (memberToken) payload.memberToken = memberToken;

      const res = await axios.post(
        `${API_BASE_URL}/public/cafe/orders`,
        payload,
        { params: { businessId } }
      );
      setOrderPlaced(true);
      setSubmittedOrderInfo(res.data);
      onOrderSuccess(res.data);
      onClearCart();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Unable to place order. Please call a staff member.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAndReset = () => {
    setOrderPlaced(false);
    setSubmittedOrderInfo(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9999, display: 'flex', justifyContent: 'flex-end',
        backdropFilter: 'blur(3px)',
      }}
      onClick={handleCloseAndReset}
    >
      <div
        style={{
          width: '100%', maxWidth: 440,
          backgroundColor: '#ffffff', height: '100%',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#ffffff',
        }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              {orderPlaced ? 'Order Confirmation' : 'Your Order Cart'}
            </h2>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
              {tableName || 'Table'} • Self Ordering
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseAndReset}
            style={{
              border: 'none', background: '#f1f5f9', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: '#334155'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {orderPlaced ? (
          /* ---- Order Placed Success ---- */
          <div style={{
            flex: 1, padding: '40px 24px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              backgroundColor: '#dcfce7', color: '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
            }}>
              <CheckCircle2 size={40} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
              Order Sent to Counter!
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px', maxWidth: 300 }}>
              Your order has been sent to our kitchen counter. Staff will accept it and start preparing your items!
            </p>
            <div style={{
              backgroundColor: '#f8fafc', borderRadius: '12px',
              border: '1px solid #e2e8f0', padding: '14px',
              width: '100%', maxWidth: 300, marginBottom: 24, textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                Table Destination
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {tableName || 'Your Table'}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 700, marginTop: 8 }}>
                ✓ KOT Registered
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseAndReset}
              style={{
                width: '100%', maxWidth: 300, padding: '12px 20px',
                backgroundColor: '#2563eb', color: '#ffffff', border: 'none',
                borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
              }}
            >
              Order More Items
            </button>
          </div>
        ) : cartItems.length === 0 ? (
          /* ---- Empty Cart ---- */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
            padding: 32, textAlign: 'center', color: '#94a3b8'
          }}>
            <ShoppingBag size={52} style={{ marginBottom: 12, color: '#cbd5e1' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
              Your cart is empty
            </h4>
            <p style={{ fontSize: '0.8rem', margin: '0 0 18px', maxWidth: 240 }}>
              Browse the menu and click "+ Add" on your favourite dishes and beverages.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: '8px',
                backgroundColor: '#f1f5f9', color: '#334155',
                border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer'
              }}
            >
              Back to Menu
            </button>
          </div>
        ) : (
          /* ---- Cart With Items ---- */
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {errorMessage && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                  color: '#dc2626', fontSize: '0.8rem', fontWeight: 600,
                  marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Item rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                {cartItems.map((c, idx) => {
                  const price = c.item.salePrice || c.item.unitPrice || 0;
                  return (
                    <div
                      key={c.item.id + (c.variantName || '') + idx}
                      style={{
                        padding: '12px', borderRadius: '10px',
                        border: '1px solid #e2e8f0', backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{c.item.name}</div>
                          {c.variantName && (
                            <div style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>
                              Size: {c.variantName}
                            </div>
                          )}
                          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                            ₹{(price * c.quantity).toFixed(2)}
                          </div>
                        </div>
                        {/* Stepper */}
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          backgroundColor: '#f8fafc', border: '1px solid #cbd5e1',
                          borderRadius: '8px', padding: '2px 6px',
                        }}>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(c.item.id, -1, c.variantName)}
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#64748b', padding: 4
                            }}
                          >
                            {c.quantity === 1 ? <Trash2 size={12} color="#ef4444" /> : <Minus size={12} />}
                          </button>
                          <span style={{ fontSize: '0.83rem', fontWeight: 800, minWidth: 16, textAlign: 'center' }}>
                            {c.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(c.item.id, 1, c.variantName)}
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#2563eb', padding: 4
                            }}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      {/* Item-level note */}
                      <input
                        type="text"
                        placeholder="Add cooking note (e.g. less spicy, oat milk)..."
                        value={c.notes}
                        onChange={e => onUpdateNotes(c.item.id, e.target.value, c.variantName)}
                        style={{
                          marginTop: 8, width: '100%', padding: '5px 8px',
                          borderRadius: '6px', border: '1px solid #e2e8f0',
                          fontSize: '0.73rem', color: '#334155', outline: 'none',
                          backgroundColor: '#f8fafc', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* General table note */}
              <div style={{
                backgroundColor: '#f8fafc', borderRadius: '10px',
                border: '1px solid #e2e8f0', padding: '12px', marginBottom: 8
              }}>
                <div style={{
                  fontSize: '0.75rem', fontWeight: 700, color: '#334155',
                  marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5
                }}>
                  <MessageSquare size={13} />
                  Special Note for Waiter (optional)
                </div>
                <input
                  type="text"
                  placeholder="e.g. Please bring extra napkins, less ice in drinks..."
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px',
                    borderRadius: '7px', border: '1px solid #cbd5e1',
                    fontSize: '0.8rem', outline: 'none',
                    backgroundColor: '#ffffff', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Sticky Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid #f1f5f9',
              backgroundColor: '#ffffff',
            }}>
              {/* Bill summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Item Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Estimated GST (5%)</span>
                  <span>₹{estimatedTax.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '1rem', fontWeight: 900, color: '#0f172a',
                  borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 2
                }}>
                  <span>Payable Amount</span>
                  <span style={{ color: '#2563eb' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Place order button */}
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submitting}
                style={{
                  width: '100%', padding: '12px 20px',
                  backgroundColor: '#2563eb', color: '#ffffff', border: 'none',
                  borderRadius: '10px', fontWeight: 800, fontSize: '0.93rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: submitting ? 0.75 : 1,
                }}
              >
                {submitting ? 'Sending to Kitchen...' : `Place Order (₹${grandTotal.toFixed(2)})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
