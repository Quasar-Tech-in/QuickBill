import React from 'react';

interface StatusBadgeProps {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'PAID':
      return <span className="badge badge-paid">● Paid</span>;
    case 'PARTIAL':
      return <span className="badge badge-partial">● Partial</span>;
    case 'UNPAID':
      return <span className="badge badge-unpaid">● Unpaid</span>;
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
