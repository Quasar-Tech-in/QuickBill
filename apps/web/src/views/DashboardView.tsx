import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Receipt, 
  Plus, 
  Package, 
  Users,
  Eye
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { store } from '../services/store';
import { Invoice } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onViewInvoice }) => {
  const [invoices, setInvoices] = useState<Invoice[]>(store.getInvoices());

  useEffect(() => {
    store.fetchInvoices().then(data => {
      setInvoices(data);
    }).catch(() => {});
  }, []);

  const stats = store.getDashboardStats();
  const recentInvoices = invoices.slice(0, 5);
  const items = store.getItems();
  const lowStockItems = items.filter(i => i.currentStock <= i.minStockAlert);

  return (
    <div className="page-container">
      {/* Top Banner / Hero */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: 28,
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a5b4fc', fontWeight: 700 }}>
            Real-Time Business Overview
          </span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em' }}>
            Welcome back to QuickBill POS
          </h1>
          <p style={{ color: '#e0e7ff', fontSize: '0.9rem', marginTop: 4, maxWidth: 520 }}>
            Unified cloud billing, immutable stock movements ledger, and real-time financial tracking for enterprise retail.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className="btn btn-primary" 
            style={{ backgroundColor: '#ffffff', color: '#3730a3', fontWeight: 700 }}
            onClick={() => onNavigate('pos')}
          >
            <Receipt size={17} />
            <span>Launch POS Billing</span>
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: 'transparent' }}
            onClick={() => onNavigate('inventory')}
          >
            <Package size={17} />
            <span>Manage Items</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <MetricCard
          title="Today's Sales"
          value={`₹${stats.todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${stats.todayTransactionsCount} transactions processed`}
          variant="primary"
          icon={TrendingUp}
        />
        <MetricCard
          title="Total Receivables (To Collect)"
          value={`₹${stats.totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="From credit parties"
          variant="warning"
          icon={ArrowDownLeft}
        />
        <MetricCard
          title="Total Payables (To Pay)"
          value={`₹${stats.totalPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Due to suppliers"
          variant="danger"
          icon={ArrowUpRight}
        />
        <MetricCard
          title="Low Stock Warnings"
          value={String(stats.lowStockCount)}
          subtitle={stats.lowStockCount > 0 ? "Requires restock replenishment" : "All inventories optimal"}
          variant={stats.lowStockCount > 0 ? "danger" : "success"}
          icon={AlertTriangle}
        />
      </div>

      {/* Grid: Recent Bills & Low Stock Inventory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24 }}>
        {/* Recent Invoices Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={18} color="var(--primary-500)" />
              <h3 className="card-title">Recent Invoices</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('transactions')}>
              View All
            </button>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td style={{ fontWeight: 600 }}>{inv.partyName}</td>
                    <td style={{ fontWeight: 700 }}>₹{inv.grandTotal.toFixed(2)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary btn-icon btn-sm"
                        title="Print / View Invoice"
                        onClick={() => onViewInvoice(inv)}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Watchlist Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="var(--warning-500)" />
              <h3 className="card-title">Low Stock Alert Watchlist</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('inventory')}>
              Adjust Stock
            </button>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Min Alert</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-400)' }}>
                      🎉 All item stocks are above minimum threshold levels!
                    </td>
                  </tr>
                ) : (
                  lowStockItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.publicItemId}</td>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ fontWeight: 700, color: item.currentStock === 0 ? 'var(--danger-600)' : 'var(--warning-700)' }}>
                        {item.currentStock} {item.unit}
                      </td>
                      <td style={{ color: 'var(--neutral-500)' }}>{item.minStockAlert} {item.unit}</td>
                      <td>
                        <StatusBadge status={item.currentStock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
