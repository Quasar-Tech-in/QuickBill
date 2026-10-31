import React, { useState } from 'react';
import axios from 'axios';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  CheckCircle2, 
  Sparkles, 
  Coffee, 
  Phone, 
  User, 
  MessageSquare,
  AlertCircle
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
  tableName,
  onOrderSuccess,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
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

  const estimatedTax = subtotal * 0.05; // 5% GST standard
  const grandTotal = subtotal + estimatedTax;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        businessId,
        tableId,
        qrToken: token || '',
        token: token || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
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

      const res = await axios.post(`${API_BASE_URL}/public/cafe/orders`, payload);
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
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(3px)',
      }}
      onClick={handleCloseAndReset}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              {orderPlaced ? 'Order Confirmation' : 'Your Order Cart'}
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
              {tableName || 'Table'} • Self Ordering
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseAndReset}
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {orderPlaced ? (
          /* Order Placed Success View */
          <div style={{
            flex: 1,
            padding: '40px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <CheckCircle2 size={40} />
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
              Order Sent to Counter!
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 24px', maxWidth: 300 }}>
              Your order has been transmitted to our kitchen. Our staff will accept it and start preparing your fresh items!
            </p>

            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px',
              width: '100%',
              maxWidth: 320,
              marginBottom: 28,
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                Table Destination
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {tableName || 'Your Table'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, marginTop: 8 }}>
                ✓ Digital KOT Registered
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseAndReset}
              style={{
                width: '100%',
                maxWidth: 320,
                padding: '12px 20px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
            >
              Order More Items
            </button>
          </div>
        ) : cartItems.length === 0 ? (
          /* Empty Cart */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
            textAlign: 'center',
            color: '#94a3b8'
          }}>
            <ShoppingBag size={56} style={{ marginBottom: 12, color: '#cbd5e1' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
              Your cart is empty
            </h4>
            <p style={{ fontSize: '0.82rem', margin: '0 0 20px', maxWidth: 240 }}>
              Browse the menu and click "+ Add" on your favorite dishes and beverages.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Back to Menu
            </button>
          </div>
        ) : (
          /* Normal Cart List with Form */
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {errorMessage && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {cartItems.map((c, idx) => {
                  const price = c.item.salePrice || c.item.unitPrice || 0;
                  return (
                    <div
                      key={c.item.id + (c.variantName || '') + idx}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                            {c.item.name}
                          </div>
                          {c.variantName && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                              Size: {c.variantName}
                            </div>
                          )}
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                            ₹{(price * c.quantity).toFixed(2)}
                          </div>
                        </div>

                        {/* Stepper */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '2px 6px',
                        }}>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(c.item.id, -1, c.variantName)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748b',
                              padding: 4
                            }}
                          >
                            {c.quantity === 1 ? <Trash2 size={13} color="#ef4444" /> : <Minus size={13} />}
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: 16, textAlign: 'center' }}>
                            {c.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(c.item.id, 1, c.variantName)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#2563eb',
                              padding: 4
                            }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Item-level notes input */}
                      <input
                        type="text"
                        placeholder="Add cooking note (e.g. less spicy, oat milk)..."
                        value={c.notes}
                        onChange={e => onUpdateNotes(c.item.id, e.target.value, c.variantName)}
                        style={{
                          marginTop: 8,
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.75rem',
                          color: '#334155',
                          outline: 'none',
                          backgroundColor: '#f8fafc'
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Diner Details Form */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '14px',
                marginBottom: 16
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                  Guest Details (Optional)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Mobile Number (for WhatsApp Receipt)"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Special table notes for waiter..."
                      value={generalNotes}
                      onChange={e => setGeneralNotes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Actions & Summary */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #f1f5f9',
              backgroundColor: '#ffffff',
            }}>
              {/* Financial Breakup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                  <span>Item Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                  <span>Estimated Taxes (GST 5%)</span>
                  <span>₹{estimatedTax.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  color: '#0f172a',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 6,
                  marginTop: 2
                }}>
                  <span>Payable Amount</span>
                  <span style={{ color: '#2563eb' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {submitting ? 'Transmitting to Kitchen...' : `Place Order (₹${grandTotal.toFixed(2)})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

