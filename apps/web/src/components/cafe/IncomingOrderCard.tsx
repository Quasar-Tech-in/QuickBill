import React, { useState } from 'react';
import { Check, X, Clock, User, Phone, AlertCircle, ChefHat, Edit3 } from 'lucide-react';
import { TableSessionOrder } from '../../types';

interface IncomingOrderCardProps {
  sessionId: string;
  tableNumber: string;
  order: TableSessionOrder;
  onAccept: (sessionId: string, orderId: string) => Promise<void>;
  onReject: (sessionId: string, orderId: string, reason: string) => Promise<void>;
  onEdit?: (sessionId: string, order: TableSessionOrder) => void;
}

export const IncomingOrderCard: React.FC<IncomingOrderCardProps> = ({
  sessionId,
  tableNumber,
  order,
  onAccept,
  onReject,
  onEdit,
}) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('Out of stock / dish unavailable');
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    try {
      setLoading(true);
      await onAccept(sessionId, order.orderId);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    try {
      setLoading(true);
      await onReject(sessionId, order.orderId, rejectReason);
      setIsRejecting(false);
    } finally {
      setLoading(false);
    }
  };

  const elapsedSec = Math.floor((Date.now() - new Date(order.placedAt).getTime()) / 1000);
  const elapsedText = elapsedSec < 60 ? `${elapsedSec}s ago` : `${Math.floor(elapsedSec / 60)}m ago`;

  return (
    <div
      style={{
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '1.5px solid var(--primary-200, #bfdbfe)',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
      }}
    >
      {/* Top Meta Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 900,
                color: 'var(--primary-700, #1d4ed8)',
                backgroundColor: 'var(--primary-50, #eff6ff)',
                padding: '2px 8px',
                borderRadius: '6px',
              }}
            >
              Table {tableNumber}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500, #6b7280)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> {elapsedText}
            </span>
          </div>
          {(order.customerName || order.customerPhone) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--neutral-600, #4b5563)', marginTop: '4px' }}>
              {order.customerName && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} /> {order.customerName}
                </span>
              )}
              {order.customerPhone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={12} /> {order.customerPhone}
                </span>
              )}
            </div>
          )}
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--warning-700, #b45309)',
            backgroundColor: 'var(--warning-50, #fffbeb)',
            padding: '3px 8px',
            borderRadius: '999px',
            border: '1px solid var(--warning-200, #fde68a)',
          }}
        >
          Awaiting Approval
        </span>
      </div>

      {/* Items List */}
      <div
        style={{
          backgroundColor: 'var(--neutral-50, #f9fafb)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {order.items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.85rem' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--neutral-900, #111827)' }}>
                {it.quantity}x {it.name}
              </span>
              {it.variantName && (
                <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500, #6b7280)', marginLeft: '4px' }}>
                  ({it.variantName})
                </span>
              )}
              {it.notes && (
                <div style={{ fontSize: '0.75rem', color: 'var(--primary-700, #1d4ed8)', fontStyle: 'italic', marginTop: '2px' }}>
                  * {it.notes}
                </div>
              )}
            </div>
            <span style={{ fontWeight: 600, color: 'var(--neutral-700, #374151)' }}>
              ₹{(it.lineTotal ?? (it.unitPrice * it.quantity)).toFixed(2)}
            </span>
          </div>
        ))}

        {order.notes && (
          <div style={{ borderTop: '1px dashed var(--neutral-200, #e5e7eb)', paddingTop: '6px', fontSize: '0.75rem', color: 'var(--neutral-600, #4b5563)' }}>
            <strong>Special Note:</strong> {order.notes}
          </div>
        )}
      </div>

      {/* Rejection Input Drawer */}
      {isRejecting ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: 'var(--danger-50, #fef2f2)', borderRadius: '8px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger-800, #991b1b)' }}>
            Reason for Rejection:
          </label>
          <input
            type="text"
            className="input"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '6px 10px' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={() => setIsRejecting(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              onClick={handleRejectConfirm}
              disabled={loading}
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      ) : (
        /* Action Buttons */
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          {onEdit && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', justifyContent: 'center', fontSize: '0.82rem' }}
              onClick={() => onEdit(sessionId, order)}
              disabled={loading}
              title="Edit items or instructions before accepting"
            >
              <Edit3 size={14} style={{ marginRight: '4px' }} />
              Edit
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '6px 12px', color: 'var(--danger-600, #dc2626)', justifyContent: 'center', fontSize: '0.82rem' }}
            onClick={() => setIsRejecting(true)}
            disabled={loading}
          >
            <X size={15} style={{ marginRight: '4px' }} />
            Reject
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.82rem' }}
            onClick={handleAccept}
            disabled={loading}
          >
            <ChefHat size={15} style={{ marginRight: '4px' }} />
            Accept & Print KOT
          </button>
        </div>
      )}
    </div>
  );
};
