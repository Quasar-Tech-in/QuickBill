import React from 'react';
import { Users, Clock, Receipt, Utensils, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { CafeTable, TableSession, TableStatus } from '../../types';

interface TableCardProps {
  table: CafeTable;
  session?: TableSession;
  onSelectTable: (table: CafeTable) => void;
  onSettleTable?: (table: CafeTable, session: TableSession) => void;
  onStatusChange?: (tableId: string, status: TableStatus) => void;
}

export const getStatusConfig = (status: TableStatus) => {
  switch (status) {
    case 'AVAILABLE':
      return {
        label: 'Available',
        color: 'var(--success-600, #16a34a)',
        bgColor: 'var(--success-50, #f0fdf4)',
        borderColor: 'var(--success-200, #bbf7d0)',
      };
    case 'OCCUPIED':
      return {
        label: 'Occupied',
        color: 'var(--warning-700, #b45309)',
        bgColor: 'var(--warning-50, #fffbeb)',
        borderColor: 'var(--warning-200, #fde68a)',
      };
    case 'ORDERING':
      return {
        label: 'New Order',
        color: 'var(--primary-600, #2563eb)',
        bgColor: 'var(--primary-50, #eff6ff)',
        borderColor: 'var(--primary-200, #bfdbfe)',
      };
    case 'BILLING':
      return {
        label: 'Billing',
        color: '#7c3aed',
        bgColor: '#f5f3ff',
        borderColor: '#ddd6fe',
      };
    case 'CLEANING':
      return {
        label: 'Cleaning',
        color: 'var(--neutral-600, #4b5563)',
        bgColor: 'var(--neutral-100, #f3f4f6)',
        borderColor: 'var(--neutral-200, #e5e7eb)',
      };
    default:
      return {
        label: status,
        color: 'var(--neutral-600, #4b5563)',
        bgColor: 'var(--neutral-50, #f9fafb)',
        borderColor: 'var(--neutral-200, #e5e7eb)',
      };
  }
};

export const TableCard: React.FC<TableCardProps> = ({
  table,
  session,
  onSelectTable,
  onSettleTable,
  onStatusChange,
}) => {
  const statusCfg = getStatusConfig(table.currentStatus);
  const pendingOrders = session?.orders?.filter(o => o.approvalStatus === 'SUBMITTED') || [];
  const acceptedOrders = session?.orders?.filter(o => o.approvalStatus === 'ACCEPTED') || [];

  // Calculate elapsed time from session openedAt
  const getElapsedMinutes = () => {
    if (!session?.openedAt) return null;
    const diff = Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 60000);
    return diff > 0 ? diff : 0;
  };
  const elapsed = getElapsedMinutes();

  return (
    <div
      onClick={() => onSelectTable(table)}
      style={{
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: `1.5px solid ${statusCfg.borderColor}`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        position: 'relative',
        minHeight: '160px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 14px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
      }}
    >
      {/* Top Header: Table Number & Status Pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900, #111827)' }}>
            {table.tableNumber}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--neutral-500, #6b7280)', fontWeight: 500 }}>
            {table.label !== table.tableNumber ? table.label : table.section}
          </div>
        </div>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: statusCfg.color,
            backgroundColor: statusCfg.bgColor,
            border: `1px solid ${statusCfg.borderColor}`,
            padding: '3px 8px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Middle: Capacity, Timer, Pending Indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: 'var(--neutral-600, #4b5563)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={14} color="var(--neutral-400, #9ca3af)" />
            {table.seatingCapacity} Seats
          </span>
          {elapsed !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neutral-600, #4b5563)' }}>
              <Clock size={14} color="var(--neutral-400, #9ca3af)" />
              {elapsed}m
            </span>
          )}
        </div>

        {/* Incoming QR Order Alert */}
        {pendingOrders.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary-50, #eff6ff)',
              color: 'var(--primary-700, #1d4ed8)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <AlertCircle size={13} color="var(--primary-600, #2563eb)" />
            {pendingOrders.length} New Order{pendingOrders.length > 1 ? 's' : ''} to Review
          </div>
        )}

        {/* Bill Total if Occupied / Billing */}
        {session && session.grandTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--neutral-500, #6b7280)' }}>
              {acceptedOrders.length} KOT round{acceptedOrders.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--neutral-900, #111827)' }}>
              ₹{session.grandTotal.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '8px',
          borderTop: '1px dashed var(--neutral-200, #e5e7eb)',
          paddingTop: '10px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {table.currentStatus === 'AVAILABLE' && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
            onClick={() => onStatusChange && onStatusChange(table.id, 'OCCUPIED')}
          >
            <Utensils size={13} style={{ marginRight: '4px' }} />
            Seat Guests
          </button>
        )}

        {table.currentStatus === 'CLEANING' && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center', color: 'var(--success-700, #15803d)' }}
            onClick={() => onStatusChange && onStatusChange(table.id, 'AVAILABLE')}
          >
            <Sparkles size={13} style={{ marginRight: '4px' }} />
            Mark Ready
          </button>
        )}

        {(table.currentStatus === 'OCCUPIED' || table.currentStatus === 'ORDERING') && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
              onClick={() => onSelectTable(table)}
            >
              View / Add Items
            </button>
            {(!session || session.grandTotal === 0) && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  justifyContent: 'center',
                  color: 'var(--neutral-600, #4b5563)',
                  backgroundColor: 'var(--neutral-50, #f9fafb)',
                  border: '1px solid var(--neutral-300, #d1d5db)',
                }}
                title="Mark table as available / free"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStatusChange) onStatusChange(table.id, 'AVAILABLE');
                }}
              >
                Free Table
              </button>
            )}
          </>
        )}

        {session && session.sessionStatus === 'ACTIVE' && session.grandTotal > 0 && onSettleTable && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
            onClick={() => onSettleTable(table, session)}
          >
            <Receipt size={13} style={{ marginRight: '4px' }} />
            Settle Bill
          </button>
        )}
      </div>
    </div>
  );
};

