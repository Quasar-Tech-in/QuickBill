import React, { useState, useEffect, useMemo } from 'react';
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
  Eye,
  Flame,
  CreditCard,
  Wallet,
  Smartphone,
  Building2,
  Calendar,
  MapPin,
  Sparkles,
  Layers,
  BarChart3,
  Percent,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { DateRangePicker, DateRangeValue, calculatePresetDates, formatIsoToDisplay } from '../components/DateRangePicker';
import { store } from '../services/store';
import { Invoice, Item, Party, StoreLocation } from '../types';

interface DashboardViewProps {
  onNavigate?: (tab: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
}

interface TopItemStat {
  itemId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  currentStock: number;
  unit: string;
  minStockAlert: number;
}

interface BranchSalesStat {
  locationId: string;
  name: string;
  code: string;
  sales: number;
  transactionsCount: number;
  avgOrderValue: number;
  percentage: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onViewInvoice }) => {
  const navigate = useNavigate();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    preset: 'TODAY',
    ...calculatePresetDates('TODAY'),
  }));
  const [invoices, setInvoices] = useState<Invoice[]>(store.getInvoices(selectedLocationId));
  const [items, setItems] = useState<Item[]>(selectedLocationId === 'ALL' ? store.getItems(undefined, true) : store.getItems(selectedLocationId, true));
  const [parties, setParties] = useState<Party[]>(selectedLocationId === 'ALL' ? store.getParties() : store.getParties(selectedLocationId));

  const activeTenant = store.getActiveTenant();
  const isStoreLocked = store.isStoreLocked();
  const isSuspended = store.isStoreSuspended();
  const [locations, setLocations] = useState<StoreLocation[]>(() => store.getAllLocations());

  useEffect(() => {
    store.fetchLocations().then(locs => {
      setLocations(locs);
    }).catch(() => {});
    store.fetchInvoices(selectedLocationId).then(data => {
      setInvoices(data);
    }).catch(() => {});
    store.fetchItems(selectedLocationId === 'ALL' ? undefined : selectedLocationId).then(data => {
      setItems(data);
    }).catch(() => {});
    store.fetchParties(selectedLocationId === 'ALL' ? undefined : selectedLocationId).then(data => {
      setParties(data);
    }).catch(() => {});
  }, [selectedLocationId, activeTenant?.id]);

  const handleNav = (tab: string) => {
    if (tab === 'transactions') {
      navigate('/invoices');
    } else if (tab.startsWith('/')) {
      navigate(tab);
    } else {
      navigate(`/${tab}`);
    }
  };

  // --- Filter Invoices by Custom Date Range & Type ---
  const filteredSalesInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.type !== 'SALE') return false;
      const invDate = inv.date || (inv.createdAt ? inv.createdAt.split('T')[0] : '');

      if (dateRange.preset === 'ALL') return true;
      if (dateRange.fromDate && invDate < dateRange.fromDate) return false;
      if (dateRange.toDate && invDate > dateRange.toDate) return false;

      return true;
    });
  }, [invoices, dateRange]);

  // --- Financial & Operational Metrics ---
  const totalRevenue = useMemo(() => {
    return filteredSalesInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  }, [filteredSalesInvoices]);

  const totalTransactions = filteredSalesInvoices.length;
  const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const totalTax = useMemo(() => {
    return filteredSalesInvoices.reduce((sum, inv) => sum + inv.taxTotal, 0);
  }, [filteredSalesInvoices]);

  const netSales = totalRevenue - totalTax;
  // Estimated COGS based on ~70% cost ratio
  const estimatedCOGS = netSales * 0.70;
  const grossProfit = netSales - estimatedCOGS;
  const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Stock Valuation & Alerts
  const totalStockRetailVal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.currentStock * item.salePrice), 0);
  }, [items]);

  const totalStockUnits = useMemo(() => {
    return items.reduce((sum, item) => sum + item.currentStock, 0);
  }, [items]);

  const lowStockItems = useMemo(() => {
    return items.filter(i => i.currentStock <= i.minStockAlert);
  }, [items]);

  // Receivables & Payables
  const totalReceivables = useMemo(() => {
    return parties.filter(p => p.currentBalance > 0).reduce((s, p) => s + p.currentBalance, 0);
  }, [parties]);

  const totalPayables = useMemo(() => {
    return parties.reduce((s, p) => {
      if (p.currentPayable && p.currentPayable > 0) return s + p.currentPayable;
      if (p.currentBalance && p.currentBalance < 0) return s + Math.abs(p.currentBalance);
      if (p.balance && p.balance < 0) return s + Math.abs(p.balance);
      return s;
    }, 0);
  }, [parties]);

  // --- Top-Selling Products Aggregation ---
  const topSellingItems = useMemo<TopItemStat[]>(() => {
    const itemMap = new Map<string, { quantity: number; revenue: number; name: string }>();

    filteredSalesInvoices.forEach(inv => {
      inv.items.forEach(line => {
        const existing = itemMap.get(line.itemId) || { quantity: 0, revenue: 0, name: line.name };
        existing.quantity += line.quantity;
        existing.revenue += line.total;
        existing.name = line.name || existing.name;
        itemMap.set(line.itemId, existing);
      });
    });

    const list: TopItemStat[] = [];
    itemMap.forEach((val, itemId) => {
      const foundItem = items.find(i => i.id === itemId);
      list.push({
        itemId,
        name: foundItem?.name || val.name,
        category: foundItem?.category || 'General',
        quantitySold: val.quantity,
        revenue: val.revenue,
        currentStock: foundItem ? foundItem.currentStock : 0,
        unit: foundItem?.unit || 'pcs',
        minStockAlert: foundItem ? foundItem.minStockAlert : 5
      });
    });

    // Sort by quantity sold descending (or revenue)
    return list.sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 6);
  }, [filteredSalesInvoices, items]);

  const maxQtySold = topSellingItems.length > 0 ? topSellingItems[0].quantitySold : 1;

  // --- Payment Modes Breakdown ---
  const paymentBreakdown = useMemo(() => {
    const counts = { CASH: 0, UPI: 0, CARD: 0, CREDIT: 0, BANK_TRANSFER: 0 };
    filteredSalesInvoices.forEach(inv => {
      const mode = inv.paymentMode as keyof typeof counts;
      if (counts[mode] !== undefined) {
        counts[mode] += inv.grandTotal;
      } else {
        counts.CASH += inv.grandTotal;
      }
    });

    const total = totalRevenue || 1;
    return [
      { mode: 'UPI / QR Scan', amount: counts.UPI, pct: (counts.UPI / total) * 100, color: '#6366f1', icon: Smartphone },
      { mode: 'Cash in Hand', amount: counts.CASH, pct: (counts.CASH / total) * 100, color: '#10b981', icon: Wallet },
      { mode: 'Credit / Khata', amount: counts.CREDIT, pct: (counts.CREDIT / total) * 100, color: '#f59e0b', icon: ArrowDownLeft },
      { mode: 'Card POS', amount: counts.CARD, pct: (counts.CARD / total) * 100, color: '#ec4899', icon: CreditCard },
      { mode: 'Bank Transfer', amount: counts.BANK_TRANSFER, pct: (counts.BANK_TRANSFER / total) * 100, color: '#8b5cf6', icon: Building2 },
    ].filter(p => p.amount > 0 || totalRevenue === 0);
  }, [filteredSalesInvoices, totalRevenue]);

  // --- Multi-Branch Comparative Breakdown ---
  const branchStats = useMemo<BranchSalesStat[]>(() => {
    if (locations.length <= 1) return [];

    const branchMap = new Map<string, { sales: number; count: number }>();
    locations.forEach(l => branchMap.set(l.id, { sales: 0, count: 0 }));

    filteredSalesInvoices.forEach(inv => {
      const locId = inv.locationId || locations[0]?.id || 'main';
      const current = branchMap.get(locId) || { sales: 0, count: 0 };
      current.sales += inv.grandTotal;
      current.count += 1;
      branchMap.set(locId, current);
    });

    const total = totalRevenue || 1;
    return locations.map(loc => {
      const data = branchMap.get(loc.id) || { sales: 0, count: 0 };
      return {
        locationId: loc.id,
        name: loc.name,
        code: loc.code,
        sales: data.sales,
        transactionsCount: data.count,
        avgOrderValue: data.count > 0 ? data.sales / data.count : 0,
        percentage: totalRevenue > 0 ? (data.sales / total) * 100 : 0
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [locations, filteredSalesInvoices, totalRevenue]);

  const recentInvoices = filteredSalesInvoices.slice(0, 6);

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      {/* Store Suspension / License Expiry Warning Hero for Owner */}
      {isStoreLocked && (
        <div 
          style={{
            background: isSuspended 
              ? 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)' 
              : 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            color: '#ffffff',
            marginBottom: 24,
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25)',
            border: isSuspended ? '1px solid #ef4444' : '1px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: '850px' }}>
            <div 
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 12, 
                backgroundColor: 'rgba(255, 255, 255, 0.15)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0 
              }}
            >
              {isSuspended ? <AlertTriangle size={26} color="#fca5a5" /> : <Clock size={26} color="#fde68a" />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', color: '#ffffff' }}>
                {isSuspended ? '⚠️ Store Operations Suspended' : '⚠️ Subscription License Expired'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: isSuspended ? '#fecaca' : '#fef3c7', margin: 0, lineHeight: 1.5 }}>
                {isSuspended ? (
                  <>
                    Your store account has been <strong>suspended by platform administration</strong>. Active store operations including <strong>POS Billing, Inventory adjustments, Purchase Orders, and User Management</strong> are temporarily locked. <strong>Historical Analytics & Reports remain accessible in read-only mode</strong>. Please contact QuickBill support to restore operational status.
                  </>
                ) : (
                  <>
                    Your store subscription ended on <strong>{activeTenant.subscription?.endDate ? new Date(activeTenant.subscription.endDate).toLocaleDateString() : 'N/A'}</strong>. Operational checkout and stock changes are locked. Please contact your Super Administrator or renew your subscription to resume operations.
                  </>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div 
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              📊 Read-Only Analytics Mode
            </div>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigate('/settings?tab=subscription')}
              style={{
                backgroundColor: '#ffffff',
                color: isSuspended ? '#991b1b' : '#92400e',
                fontWeight: 800,
                fontSize: '0.8rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                cursor: 'pointer'
              }}
            >
              <CreditCard size={15} />
              <span>View License & Subscription</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Operations Header Bar */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
          padding: '16px 20px',
          background: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-border)',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          zIndex: 10,
          overflow: 'visible'
        }}
      >
        {/* Title & Scope */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              background: 'var(--primary-50)', 
              color: 'var(--primary-600)', 
              padding: '3px 8px', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.75rem', 
              fontWeight: 700 
            }}>
              LIVE INTELLIGENCE
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} /> Updated just now
            </span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 4, letterSpacing: '-0.02em' }}>
            Store Operations & Performance Cockpit
          </h1>
        </div>

        {/* Action Controls & Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {/* Universal Date Range Filter (DD-MM-YYYY) */}
          <DateRangePicker value={dateRange} onChange={setDateRange} variant="dropdown" allowAllTime={true} />

          {/* Location Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              className="form-select"
              style={{ padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, minWidth: 170 }}
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="ALL">🌐 Consolidated (All Branches)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  📍 {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action: POS Billing */}
          <button 
            className="btn btn-primary" 
            style={{ padding: '7px 16px', fontSize: '0.82rem', fontWeight: 700 }}
            onClick={() => handleNav('pos')}
          >
            <Receipt size={15} />
            <span>New POS Bill</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (6 Cards for Complete Business Overview) */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', 
          gap: 16, 
          marginBottom: 24 
        }}
      >
        <MetricCard
          title={dateRange.preset === 'TODAY' ? "Today's Sales" : dateRange.preset === 'ALL' ? "All-Time Sales" : "Period Sales"}
          value={`₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${totalTransactions} bills processed`}
          variant="primary"
          icon={TrendingUp}
        />
        <MetricCard
          title="Est. Gross Profit"
          value={`₹${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`~${grossMarginPercent.toFixed(1)}% margin on sales`}
          variant="success"
          icon={Percent}
        />
        <MetricCard
          title="Avg Order Value (AOV)"
          value={`₹${avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Revenue per transaction"
          variant="primary"
          icon={Receipt}
        />
        <MetricCard
          title="Active Stock Valuation"
          value={`₹${totalStockRetailVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${items.length} SKUs (${totalStockUnits.toLocaleString()} units)`}
          variant="primary"
          icon={Package}
        />
        <MetricCard
          title="Receivables (To Collect)"
          value={`₹${totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Customer khata balance"
          variant="warning"
          icon={ArrowDownLeft}
        />
        <MetricCard
          title="Critical Restock Alerts"
          value={String(lowStockItems.length)}
          subtitle={lowStockItems.length > 0 ? "Items below min threshold" : "All inventories optimal"}
          variant={lowStockItems.length > 0 ? "danger" : "success"}
          icon={AlertTriangle}
        />
      </div>

      {/* Main Analytics Grid: Top Selling Items + Payment Mode Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 24 }}>
        
        {/* Top Selling Products Leaderboard */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 'var(--radius-md)', 
                background: '#fef3c7', 
                color: '#d97706', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Flame size={18} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Top Fast-Selling Products</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: 1 }}>
                  Ranked by sales velocity and unit movement ({dateRange.preset === 'CUSTOM' ? `${formatIsoToDisplay(dateRange.fromDate)} to ${formatIsoToDisplay(dateRange.toDate)}` : dateRange.preset.toLowerCase().replace(/_/g, ' ')})
                </p>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleNav('inventory')}>
              View Inventory
            </button>
          </div>

          <div style={{ padding: '16px 20px', flex: 1 }}>
            {topSellingItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--neutral-400)' }}>
                <Package size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No product sales recorded in this timeframe</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Sales bills generated in POS will rank here in real-time.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {topSellingItems.map((item, idx) => {
                  const percentOfTop = maxQtySold > 0 ? (item.quantitySold / maxQtySold) * 100 : 0;
                  const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                  const isLow = item.currentStock <= item.minStockAlert;
                  const isOut = item.currentStock <= 0;

                  return (
                    <div 
                      key={item.itemId} 
                      style={{
                        padding: '10px 14px',
                        background: 'var(--neutral-50)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--neutral-200)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, width: 26, textAlign: 'center' }}>
                            {rankBadge}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-900)' }}>
                              {item.name}
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--neutral-500)' }}>
                              {item.category}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--primary-700)' }}>
                            {item.quantitySold % 1 === 0 ? item.quantitySold : item.quantitySold.toFixed(3)} {item.unit}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--neutral-500)', fontWeight: 600 }}>
                            ₹{item.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Velocity Progress Bar & Stock Indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--neutral-200)', borderRadius: 99, overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${Math.max(percentOfTop, 8)}%`, 
                              height: '100%', 
                              background: idx === 0 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #4f46e5, #6366f1)',
                              borderRadius: 99 
                            }} 
                          />
                        </div>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: isOut ? 'var(--danger-100)' : isLow ? 'var(--warning-100)' : 'var(--success-100)',
                          color: isOut ? 'var(--danger-700)' : isLow ? 'var(--warning-700)' : 'var(--success-700)'
                        }}>
                          {isOut ? 'Out of Stock' : isLow ? `Low: ${item.currentStock} ${item.unit}` : `In Stock: ${item.currentStock} ${item.unit}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Payment Tender & Collection Channels */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 'var(--radius-md)', 
                background: '#e0e7ff', 
                color: '#4338ca', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Wallet size={18} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Payment & Tender Distribution</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: 1 }}>
                  Daily cash drawer reconciliation and digital payment share
                </p>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleNav('reports')}>
              P&L Reports
            </button>
          </div>

          <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20 }}>
            {/* Payment Mode Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {paymentBreakdown.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.mode} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ color: item.color, display: 'flex', alignItems: 'center' }}>
                          <IconComponent size={16} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--neutral-800)' }}>
                          {item.mode}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-900)' }}>
                          ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginLeft: 6 }}>
                          ({item.pct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    {/* Bar */}
                    <div style={{ width: '100%', height: 8, background: 'var(--neutral-100)', borderRadius: 99, overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${Math.max(item.pct, item.amount > 0 ? 3 : 0)}%`, 
                          height: '100%', 
                          background: item.color,
                          borderRadius: 99,
                          transition: 'width 0.3s ease'
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Summary Box */}
            <div 
              style={{ 
                padding: '14px 16px', 
                background: 'var(--neutral-50)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--neutral-200)',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>
                  Net Tax Collected
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--neutral-900)', marginTop: 2 }}>
                  ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>
                  Supplier Payables Due
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--danger-600)', marginTop: 2 }}>
                  ₹{totalPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Multi-Branch Performance Comparison (Visible when >1 locations exist or Consolidated view) */}
      {branchStats.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 'var(--radius-md)', 
                background: '#ecfdf5', 
                color: '#059669', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Multi-Branch Performance Matrix</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: 1 }}>
                  Comparative store revenue contribution, order velocity, and branch efficiency
                </p>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleNav('settings')}>
              Manage Locations
            </button>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Store / Branch</th>
                  <th>Branch Code</th>
                  <th>Revenue Contribution</th>
                  <th>Sales Volume</th>
                  <th>Avg Ticket (AOV)</th>
                  <th style={{ textAlign: 'right' }}>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branchStats.map((branch) => (
                  <tr key={branch.locationId}>
                    <td style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>
                      📍 {branch.name}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'var(--neutral-100)', padding: '2px 6px', borderRadius: 4 }}>
                        {branch.code}
                      </span>
                    </td>
                    <td style={{ width: '28%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--neutral-200)', borderRadius: 99, overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${Math.max(branch.percentage, branch.sales > 0 ? 5 : 0)}%`, 
                              height: '100%', 
                              background: 'var(--primary-600)',
                              borderRadius: 99 
                            }} 
                          />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-700)', minWidth: 42 }}>
                          {branch.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{branch.transactionsCount} bills</td>
                    <td style={{ color: 'var(--neutral-600)' }}>₹{branch.avgOrderValue.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.92rem' }}>
                      ₹{branch.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid: Recent Invoices & Low Stock Alert Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24 }}>
        
        {/* Recent Invoices Card */}
        <div className="card">
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={18} color="var(--primary-500)" />
              <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Sales Invoices</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleNav('transactions')}>
              View All Invoices
            </button>
          </div>
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', width: '26%' }}>Invoice #</th>
                  <th style={{ padding: '10px 14px', width: '30%' }}>Customer</th>
                  <th style={{ padding: '10px 14px', width: '18%' }}>Payment</th>
                  <th style={{ padding: '10px 14px', width: '26%', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-400)' }}>
                      No transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((inv) => (
                    <tr 
                      key={inv.id}
                      className="table-row-clickable"
                      onClick={() => onViewInvoice(inv)}
                      title="Click to view & print invoice"
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.84rem', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ fontWeight: 600, padding: '12px 14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inv.partyName || inv.consumerName || 'Walk-in Customer'}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          padding: '3px 8px', 
                          borderRadius: 4,
                          background: inv.paymentMode === 'UPI' ? '#eef2ff' : inv.paymentMode === 'CASH' ? '#ecfdf5' : '#fffbeb',
                          color: inv.paymentMode === 'UPI' ? '#4f46e5' : inv.paymentMode === 'CASH' ? '#047857' : '#b45309'
                        }}>
                          {inv.paymentMode}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--neutral-900)' }}>
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Restock Watchlist Card */}
        <div className="card">
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="var(--warning-500)" />
              <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Critical Stock Replenishment</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => handleNav('inventory')}>
              Adjust Stock
            </button>
          </div>
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', width: '22%' }}>Item Code</th>
                  <th style={{ padding: '10px 14px', width: '38%' }}>Product Name</th>
                  <th style={{ padding: '10px 14px', width: '22%' }}>Stock</th>
                  <th style={{ padding: '10px 14px', width: '18%', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--success-700)' }}>
                      <CheckCircle2 size={24} style={{ margin: '0 auto 6px', color: 'var(--success-500)' }} />
                      <div style={{ fontWeight: 600 }}>All item inventory levels are healthy!</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                        No items currently at or below minimum threshold alert.
                      </div>
                    </td>
                  </tr>
                ) : (
                  lowStockItems.slice(0, 6).map((item) => (
                    <tr 
                      key={item.id}
                      className="table-row-clickable"
                      onClick={() => handleNav('inventory')}
                      title="Click to view & manage in inventory"
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {item.publicItemId}
                      </td>
                      <td style={{ fontWeight: 600, padding: '12px 14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </td>
                      <td style={{ fontWeight: 700, color: item.currentStock === 0 ? 'var(--danger-600)' : 'var(--warning-700)', padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {item.currentStock % 1 === 0 ? item.currentStock : item.currentStock.toFixed(3)} {item.unit}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
