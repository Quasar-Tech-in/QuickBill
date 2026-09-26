import React from 'react';

interface StatusBadgeProps {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED' | 'REFUNDED' | 'CONFIRMED' | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'PAID':
    case 'CONFIRMED':
      return <span className="badge badge-paid">● Paid</span>;
    case 'PARTIAL':
      return <span className="badge badge-partial">● Partial</span>;
    case 'UNPAID':
      return <span className="badge badge-unpaid">● Unpaid</span>;
    case 'PARTIALLY_RETURNED':
      return <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning-700)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>🔄 Partial Ret</span>;
    case 'RETURNED':
    case 'REFUNDED':
      return <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger-700)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>🔴 Returned</span>;
    case 'IN_STOCK':
      return <span className="badge badge-stock-in">In Stock</span>;
    case 'LOW_STOCK':
      return <span className="badge badge-stock-low">Low Stock</span>;
    case 'OUT_OF_STOCK':
      return <span className="badge badge-stock-out">Out of Stock</span>;
    default:
      return <span className="badge">{status}</span>;
  }
};

