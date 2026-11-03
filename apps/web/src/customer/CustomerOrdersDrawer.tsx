import React from 'react';
import { X, Clock, ChefHat, CheckCircle2, AlertCircle, ShoppingBag, Utensils, RefreshCw, AlertTriangle } from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  variantName?: string;
  unitPrice: number;
  lineTotal?: number;
  notes?: string;
}

interface TableOrder {
  orderId: string;
  placedAt: string;
  approvalStatus: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  kotNumber?: string;
  rejectionReason?: string;
  customerName?: string;
  notes?: string;
  orderSubtotal?: number;
  items: OrderItem[];
}

interface CustomerOrdersData {
  sessionId?: string;
  tableNumber: string;
  tableLabel?: string;
  sessionStatus?: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  pendingOrders: TableOrder[];
  acceptedOrders: TableOrder[];
  rejectedOrders: TableOrder[];
  allOrders: TableOrder[];
}

interface CustomerOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ordersData: CustomerOrdersData | null;
  loading: boolean;
  onRefresh: () => void;
  onBrowseMenu: () => void;
}

export const CustomerOrdersDrawer: React.FC<CustomerOrdersDrawerProps> = ({
  isOpen,
  onClose,
  ordersData,
  loading,
  onRefresh,
  onBrowseMenu,
}) => {
  if (!isOpen) return null;

  const pending = ordersData?.pendingOrders || [];
  const accepted = ordersData?.acceptedOrders || [];
  const rejected = ordersData?.rejectedOrders || [];
  const totalOrders = (ordersData?.allOrders || []).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100%',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          animation: 'slideInRight 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Utensils size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Table Orders & Bill
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                  }}
                >
                  Table {ordersData?.tableNumber || ''}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                Live kitchen status & running summary
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh order status"
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
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
                color: '#64748b',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Running Bill Summary Bar */}
        {ordersData && (
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>
                Current Running Bill
              </div>
              <div style={{ fontSize: '0.76rem', color: '#3b82f6', marginTop: 1 }}>
                Subtotal ₹{Number(ordersData.subtotal || 0).toFixed(2)} + GST ₹{Number(ordersData.taxTotal || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1d4ed8' }}>
                ₹{Number(ordersData.grandTotal || 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Order Sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {totalOrders === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 16px', color: '#64748b' }}>
              <ShoppingBag size={48} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                No Orders Placed Yet
              </h4>
              <p style={{ fontSize: '0.82rem', margin: '0 0 16px' }}>
                Browse our delicious menu, add items to your cart, and place an order directly from your phone!
              </p>
              <button
                type="button"
                onClick={onBrowseMenu}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              {/* Section 1: Pending Orders (Awaiting Kitchen Acceptance) */}
              {pending.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        color: '#b45309',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      <Clock size={12} className="animate-spin" />
                      Awaiting Kitchen Acceptance ({pending.length})
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pending.map(ord => (
                      <div
                        key={ord.orderId}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1.5px solid #fde68a',
                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309' }}>
                            Order Placed • {new Date(ord.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            Under Review
                          </span>
                        </div>

                        {/* Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: '#fffdfa', padding: 10, borderRadius: 8 }}>
                          {ord.items.map((it, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{it.quantity}x </span>
                                <span style={{ color: '#1e293b' }}>{it.name}</span>
                                {it.variantName && (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 4 }}>
                                    ({it.variantName})
                                  </span>
                                )}
                                {it.notes && (
                                  <div style={{ fontSize: '0.72rem', color: '#d97706', fontStyle: 'italic', marginTop: 2 }}>
                                    * {it.notes}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontWeight: 600, color: '#475569' }}>
                                ₹{(it.lineTotal ?? (it.unitPrice * it.quantity)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {ord.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#78350f', backgroundColor: '#fef3c7', padding: '6px 10px', borderRadius: '6px' }}>
                            <strong>Table Note:</strong> {ord.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Accepted / Preparing in Kitchen */}
              {accepted.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        color: '#15803d',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      <ChefHat size={12} />
                      Accepted & Preparing in Kitchen ({accepted.length})
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {accepted.map(ord => (
                      <div
                        key={ord.orderId}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1.5px solid #bbf7d0',
                          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.08)',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d' }}>
                              Kitchen Order
                            </span>
                            {ord.kotNumber && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  backgroundColor: '#dcfce7',
                                  color: '#166534',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {ord.kotNumber}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {new Date(ord.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 }}>
                          {ord.items.map((it, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{it.quantity}x </span>
                                <span style={{ color: '#1e293b' }}>{it.name}</span>
                                {it.variantName && (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 4 }}>
                                    ({it.variantName})
                                  </span>
                                )}
                                {it.notes && (
                                  <div style={{ fontSize: '0.72rem', color: '#ea580c', fontStyle: 'italic', marginTop: 2 }}>
                                    * {it.notes}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontWeight: 600, color: '#475569' }}>
                                ₹{(it.lineTotal ?? (it.unitPrice * it.quantity)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {ord.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
                            Special note: {ord.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Rejected Orders (if any) */}
              {rejected.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        color: '#b91c1c',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      <AlertTriangle size={12} />
                      Item Unavailable / Declined ({rejected.length})
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rejected.map(ord => (
                      <div
                        key={ord.orderId}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #fecaca',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          opacity: 0.85,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>
                            Declined by Staff
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {new Date(ord.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {ord.rejectionReason && (
                          <div style={{ fontSize: '0.75rem', color: '#991b1b', backgroundColor: '#fef2f2', padding: '6px 10px', borderRadius: '6px' }}>
                            <strong>Reason:</strong> {ord.rejectionReason}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Items: {ord.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onBrowseMenu}
            style={{
              flex: 1,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 16px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Utensils size={16} />
            <span>Add More Items</span>
          </button>
        </div>
      </div>
    </div>
  );
};

