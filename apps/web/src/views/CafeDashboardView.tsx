import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  Receipt, 
  Utensils, 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  Printer, 
  Coffee, 
  ArrowRight,
  Sparkles,
  CreditCard,
  QrCode,
  Inbox,
  Flame,
  X,
  Check
} from 'lucide-react';
import { store } from '../services/store';
import { CafeTable, TableSession, TableStatus, Invoice } from '../types';
import { TableCard } from '../components/cafe/TableCard';
import { KOTPrintModal } from '../components/cafe/KOTPrintModal';
import { EditOrderModal } from '../components/cafe/EditOrderModal';

interface CafeDashboardViewProps {
  onNavigate?: (tab: string) => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

export const CafeDashboardView: React.FC<CafeDashboardViewProps> = ({ 
  onNavigate, 
  onViewInvoice 
}) => {
  const [tables, setTables] = useState<CafeTable[]>(store.getCafeTables());
  const [sessions, setSessions] = useState<TableSession[]>(store.getActiveTableSessions());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  
  // Selected table for drawer inspection
  const [activeTable, setActiveTable] = useState<CafeTable | null>(null);
  
  // Settle modal state
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleSession, setSettleSession] = useState<TableSession | null>(null);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'UPI' | 'SPLIT'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState('');

  // KOT Modal state
  const [kotModalOpen, setKotModalOpen] = useState(false);
  const [printingKotData, setPrintingKotData] = useState<any>(null);

  // Edit Order state
  const [editingOrder, setEditingOrder] = useState<{ order: any; sessionId: string; tableName: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tList, sList] = await Promise.all([
        store.fetchTables(),
        store.fetchActiveTableSessions()
      ]);
      setTables(tList);
      setSessions(sList);
    } catch (err) {
      console.warn('Failed to load cafe tables/sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = store.subscribe(() => {
      setTables(store.getCafeTables());
      setSessions(store.getActiveTableSessions());
    });
    // Auto-refresh active sessions every 10 seconds
    const interval = setInterval(() => {
      store.fetchActiveTableSessions().catch(() => {});
      store.fetchTables().catch(() => {});
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Update activeTable ref if tables list updates
  useEffect(() => {
    if (activeTable) {
      const updated = tables.find(t => t.id === activeTable.id);
      if (updated) setActiveTable(updated);
    }
  }, [tables]);

  // Extract distinct sections from tables
  const sections = useMemo(() => {
    const set = new Set<string>();
    tables.forEach(t => {
      if (t.section) set.add(t.section);
    });
    return Array.from(set);
  }, [tables]);

  // Map of tableId -> active session
  const sessionMap = useMemo(() => {
    const map = new Map<string, TableSession>();
    sessions.forEach(s => {
      map.set(s.tableId, s);
    });
    return map;
  }, [sessions]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = tables.length;
    let available = 0;
    let occupied = 0;
    let newOrders = 0;
    let billing = 0;

    tables.forEach(t => {
      if (t.currentStatus === 'AVAILABLE') available++;
      else if (t.currentStatus === 'OCCUPIED') occupied++;
      else if (t.currentStatus === 'ORDERING') newOrders++;
      else if (t.currentStatus === 'BILLING') billing++;
    });

    let runningRevenue = 0;
    let pendingOrdersCount = 0;
    sessions.forEach(s => {
      runningRevenue += Number(s.grandTotal || 0);
      s.orders?.forEach(o => {
        if (o.approvalStatus === 'SUBMITTED') {
          pendingOrdersCount++;
        }
      });
    });

    return {
      total,
      available,
      occupied: occupied + newOrders + billing,
      runningRevenue,
      pendingOrdersCount,
    };
  }, [tables, sessions]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      if (selectedSection !== 'ALL' && t.section !== selectedSection) {
        return false;
      }
      if (selectedStatus !== 'ALL' && t.currentStatus !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (t.tableName || t.label || '').toLowerCase().includes(q);
        const matchesNum = String(t.tableNumber).toLowerCase().includes(q);
        const matchesSec = t.section ? t.section.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesNum && !matchesSec) return false;
      }
      return true;
    });
  }, [tables, selectedSection, selectedStatus, searchQuery]);

  const handleOpenSettle = (table: CafeTable, session?: TableSession) => {
    const targetSession = session || sessionMap.get(table.id);
    if (!targetSession) {
      alert('No active session found for this table.');
      return;
    }
    setSettleSession(targetSession);
    setPaymentMode('CASH');
    setPaymentRef('');
    setCustomerName(targetSession.customerName || '');
    setCustomerPhone(targetSession.customerPhone || '');
    setDiscountPercent(0);
    setSettleError('');
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettle = async () => {
    if (!settleSession) return;
    setIsSettling(true);
    setSettleError('');
    try {
      const gross = settleSession.subtotal || 0;
      const discountVal = (gross * discountPercent) / 100;
      const res = await store.settleTableSession(settleSession.id, {
        paymentMode,
        paymentRef: paymentRef.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        discountAmount: discountVal,
        discountType: discountVal > 0 ? 'FIXED' : undefined,
        discountValue: discountVal > 0 ? discountVal : undefined,
      });

      setIsSettleModalOpen(false);
      setActiveTable(null);
      await loadData();

      if (res?.invoice && onViewInvoice) {
        onViewInvoice(res.invoice);
      }
    } catch (err: any) {
      setSettleError(err.response?.data?.detail || err.message || 'Settlement failed.');
    } finally {
      setIsSettling(false);
    }
  };

  const handleForceCloseSession = async (table: CafeTable) => {
    const targetSession = sessionMap.get(table.id);
    if (!targetSession) return;
    const tableName = table.tableName || table.label || `Table ${table.tableNumber}`;
    if (!window.confirm(`Are you sure you want to close the active session for ${tableName}? Any active QR customer sessions and join codes will be invalidated, and the table will be marked for cleaning.`)) {
      return;
    }
    try {
      await store.forceCloseTableSession(targetSession.id);
      setActiveTable(null);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to close table session.');
    }
  };

  const handleStatusChange = async (tableId: string, status: TableStatus) => {
    try {
      const updated = await store.updateTableStatus(tableId, status);
      await loadData();
      if (activeTable && activeTable.id === tableId) {
        setActiveTable(updated);
      }
    } catch (err: any) {
      console.warn('Failed to change status:', err);
      alert(err.response?.data?.detail || err.message || 'Failed to update table status');
    }
  };

  const handlePrintKOT = (session: TableSession) => {
    // Generate chit data
    const activeTableObj = tables.find(t => t.id === session.tableId);
    const acceptedOrders = session.orders?.filter(o => o.approvalStatus === 'ACCEPTED') || [];
    
    const itemsMap = new Map<string, any>();
    acceptedOrders.forEach(ord => {
      ord.items.forEach(it => {
        const key = it.itemId + (it.variantName || '');
        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key);
          existing.quantity += it.quantity;
        } else {
          itemsMap.set(key, { ...it });
        }
      });
    });

    const kotChit = {
      kotNumber: `KOT-${session.sessionNumber || '001'}`,
      tableName: activeTableObj?.tableName || activeTableObj?.label || `Table ${activeTableObj?.tableNumber}`,
      createdAt: new Date().toISOString(),
      serverName: session.customerName || 'Dine-In',
      specialInstructions: session.notes,
      items: Array.from(itemsMap.values()),
    };

    setPrintingKotData(kotChit);
    setKotModalOpen(true);
  };

  return (
    <div className="view-container" style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ 
              backgroundColor: 'var(--primary-100, #dbeafe)', 
              color: 'var(--primary-600, #2563eb)',
              width: 40,
              height: 40,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Coffee size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                Café Floor & Table Map
              </h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', margin: '2px 0 0' }}>
                Live dine-in floor status, real-time QR ordering, and table-side billing
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            title="Refresh floor tables"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {stats.pendingOrdersCount > 0 && (
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate ? onNavigate('cafe-incoming') : window.location.assign('/cafe/orders/incoming')}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                fontWeight: 700,
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff'
              }}
            >
              <Inbox size={15} />
              <span>{stats.pendingOrdersCount} Incoming Orders</span>
            </button>
          )}

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate ? onNavigate('cafe-kitchen') : window.location.assign('/cafe/kitchen')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <Flame size={15} color="#ea580c" />
            <span>Kitchen Display (KDS)</span>
          </button>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate ? onNavigate('cafe-tables') : window.location.assign('/cafe/tables')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <QrCode size={15} />
            <span>Manage Tables & QR</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 16, 
        marginBottom: 24 
      }}>
        {/* Total Tables */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--neutral-200)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '10px', 
            backgroundColor: 'var(--neutral-100)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--neutral-700)'
          }}>
            <Utensils size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Total Tables</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>{stats.total}</div>
          </div>
        </div>

        {/* Available Tables */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--neutral-200)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '10px', 
            backgroundColor: 'var(--success-50, #f0fdf4)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--success-600, #16a34a)'
          }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Available Now</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success-700, #15803d)' }}>{stats.available}</div>
          </div>
        </div>

        {/* Occupied / Active Tables */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--neutral-200)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '10px', 
            backgroundColor: 'var(--warning-50, #fffbeb)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--warning-700, #b45309)'
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Occupied & Dining</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning-800, #92400e)' }}>{stats.occupied}</div>
          </div>
        </div>

        {/* Running Live Revenue */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--neutral-200)',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            borderRadius: '10px', 
            backgroundColor: 'var(--primary-50, #eff6ff)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--primary-600, #2563eb)'
          }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Active Table Bills</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
              ₹{stats.runningRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Section Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--neutral-200)',
        padding: '14px 18px',
        marginBottom: 24,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14
      }}>
        {/* Section Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', marginRight: 4 }}>
            Section:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${selectedSection === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, padding: '4px 12px', fontSize: '0.8rem' }}
            onClick={() => setSelectedSection('ALL')}
          >
            All Sections
          </button>
          {sections.map(sec => (
            <button
              key={sec}
              type="button"
              className={`btn btn-sm ${selectedSection === sec ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: 600, padding: '4px 12px', fontSize: '0.8rem' }}
              onClick={() => setSelectedSection(sec)}
            >
              {sec}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Status selector */}
          <select
            className="form-select form-select-sm"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ fontSize: '0.8rem', fontWeight: 600, padding: '6px 12px', borderRadius: '8px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="ORDERING">New Orders</option>
            <option value="BILLING">Billing</option>
            <option value="CLEANING">Cleaning</option>
          </select>

          {/* Search box */}
          <div style={{ position: 'relative', width: 200 }}>
            <Search 
              size={14} 
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} 
            />
            <input
              type="text"
              placeholder="Search table..."
              className="form-input form-input-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 30, fontSize: '0.8rem', borderRadius: '8px' }}
            />
          </div>
        </div>
      </div>

      {/* Table Cards Grid */}
      {filteredTables.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px dashed var(--neutral-300)',
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--neutral-500)'
        }}>
          <Utensils size={40} style={{ margin: '0 auto 12px', color: 'var(--neutral-400)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '0 0 4px' }}>
            No Tables Match Current Filter
          </h3>
          <p style={{ fontSize: '0.82rem', margin: '0 0 16px' }}>
            Adjust your section, status filter, or search keywords to view tables.
          </p>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => { setSelectedSection('ALL'); setSelectedStatus('ALL'); setSearchQuery(''); }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 18,
        }}>
          {filteredTables.map(tbl => {
            const sess = sessionMap.get(tbl.id);
            return (
              <TableCard
                key={tbl.id}
                table={tbl}
                session={sess}
                onSelectTable={(table) => setActiveTable(table)}
                onSettleTable={(table, session) => handleOpenSettle(table, session)}
                onStatusChange={(tableId, status) => handleStatusChange(tableId, status)}
              />
            );
          })}
        </div>
      )}

      {/* Table Detail / Active Session Drawer */}
      {activeTable && (
        <div 
          className="modal-overlay" 
          onClick={() => setActiveTable(null)}
          style={{ zIndex: 1000 }}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 460,
              borderRadius: 0,
              backgroundColor: '#ffffff',
              boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1001,
              animation: 'slideInRight 0.2s ease',
              maxHeight: '100vh',
            }}
          >
            {/* Drawer Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--neutral-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--neutral-50)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--neutral-900)' }}>
                    {activeTable.tableName || activeTable.label || `Table ${activeTable.tableNumber}`}
                  </h2>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--neutral-200)',
                    color: 'var(--neutral-700)'
                  }}>
                    {activeTable.section || 'General'} • {activeTable.capacity || activeTable.seatingCapacity || 4} seats
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', marginTop: 4 }}>
                  Status: <strong>{activeTable.currentStatus}</strong>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => setActiveTable(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {sessionMap.get(activeTable.id) ? (
                (() => {
                  const sess = sessionMap.get(activeTable.id)!;
                  const acceptedOrders = sess.orders?.filter(o => o.approvalStatus === 'ACCEPTED') || [];
                  const pendingOrders = sess.orders?.filter(o => o.approvalStatus === 'SUBMITTED') || [];

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {/* Active Session Info Card */}
                      <div style={{
                        padding: '14px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--neutral-50)',
                        border: '1px solid var(--neutral-200)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Guest / Customer</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--neutral-800)' }}>
                            {sess.customerName || 'Walk-in Diner'}
                            {sess.customerPhone && <span style={{ fontWeight: 400, color: 'var(--neutral-500)', fontSize: '0.8rem', marginLeft: 6 }}>({sess.customerPhone})</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginTop: 4 }}>
                            Started at: {new Date(sess.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Running Bill</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-600, #2563eb)' }}>
                            ₹{Number(sess.grandTotal || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Pending Orders Alert */}
                      {pendingOrders.length > 0 && (
                        <div style={{
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertCircle size={18} color="#dc2626" />
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#991b1b' }}>
                              {pendingOrders.length} Pending QR Order(s)
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', fontWeight: 700 }}
                            onClick={() => {
                              setActiveTable(null);
                              if (onNavigate) onNavigate('cafe-incoming');
                              else window.location.assign('/cafe/orders/incoming');
                            }}
                          >
                            Review Orders
                          </button>
                        </div>
                      )}

                      {/* Placed Items Breakdown */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--neutral-800)' }}>
                            Items on Table ({acceptedOrders.reduce((sum, o) => sum + o.items.length, 0)})
                          </h4>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                            onClick={() => handlePrintKOT(sess)}
                          >
                            <Printer size={13} style={{ marginRight: 4 }} />
                            Print KOT
                          </button>
                        </div>

                        {acceptedOrders.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--neutral-400)', fontStyle: 'italic', padding: '12px 0' }}>
                            No accepted items yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {acceptedOrders.map((ord, oIdx) => (
                              <div 
                                key={ord.orderId || oIdx}
                                style={{
                                  border: '1px solid var(--neutral-200)',
                                  borderRadius: '8px',
                                  padding: '10px 12px',
                                  backgroundColor: '#ffffff'
                                }}
                              >
                                <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>Order #{oIdx + 1}</span>
                                    {ord.kotNumber && <span style={{ backgroundColor: 'var(--neutral-100)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>{ord.kotNumber}</span>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>{new Date(ord.orderedAt || ord.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      style={{ padding: '1px 6px', fontSize: '0.7rem', color: 'var(--primary-600)', height: 'auto', minHeight: 'unset' }}
                                      onClick={() => setEditingOrder({
                                        order: ord,
                                        sessionId: sess.id,
                                        tableName: activeTable.tableName || activeTable.label || `Table ${activeTable.tableNumber}`
                                      })}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                                {ord.items.map((it, iIdx) => (
                                  <div 
                                    key={iIdx} 
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center', 
                                      fontSize: '0.85rem',
                                      padding: '3px 0'
                                    }}
                                  >
                                    <div>
                                      <span style={{ fontWeight: 700, marginRight: 6 }}>{it.quantity}x</span>
                                      <span>{it.itemName || it.name}</span>
                                      {it.variantName && (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginLeft: 4 }}>
                                          ({it.variantName})
                                        </span>
                                      )}
                                      {it.notes && (
                                        <div style={{ fontSize: '0.72rem', color: '#ea580c', fontStyle: 'italic' }}>
                                          Note: {it.notes}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>
                                      ₹{(Number(it.unitPrice || 0) * Number(it.quantity || 1)).toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick Status Override */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                          Update Table Status
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {(['AVAILABLE', 'OCCUPIED', 'CLEANING'] as TableStatus[]).map(st => (
                            <button
                              key={st}
                              type="button"
                              className={`btn btn-sm ${activeTable.currentStatus === st ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: '0.76rem', fontWeight: 600 }}
                              onClick={() => handleStatusChange(activeTable.id, st)}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--neutral-500)' }}>
                  <Coffee size={40} style={{ margin: '0 auto 12px', color: 'var(--neutral-400)' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '0 0 4px' }}>
                    Table is Currently {activeTable.currentStatus}
                  </h3>
                  <p style={{ fontSize: '0.82rem', margin: '0 0 20px' }}>
                    No active dine-in session is registered for this table.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 280, margin: '0 auto' }}>
                    {activeTable.currentStatus === 'AVAILABLE' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStatusChange(activeTable.id, 'OCCUPIED')}
                      >
                        <Utensils size={14} style={{ marginRight: 6 }} />
                        Seat Guests (Mark Occupied)
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleStatusChange(activeTable.id, 'AVAILABLE')}
                        >
                          <CheckCircle size={14} style={{ marginRight: 6 }} />
                          Mark Table Free / Available
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStatusChange(activeTable.id, 'OCCUPIED')}
                        >
                          <Utensils size={14} style={{ marginRight: 6 }} />
                          Start Dine-in Session (Occupied)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            {sessionMap.get(activeTable.id) && (
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--neutral-200)',
                backgroundColor: 'var(--neutral-50)',
                display: 'flex',
                gap: 12
              }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontWeight: 600,
                      padding: '10px 14px',
                      borderColor: '#fca5a5',
                      color: '#b91c1c',
                      backgroundColor: '#fef2f2'
                    }}
                    onClick={() => handleForceCloseSession(activeTable)}
                    title="Close table session and invalidate join codes"
                  >
                    <X size={15} />
                    <span>Close Table</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontWeight: 700,
                      padding: '10px 16px'
                    }}
                    onClick={() => handleOpenSettle(activeTable)}
                  >
                    <CreditCard size={16} />
                    <span>Settle & Checkout Bill</span>
                  </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bill Settlement Modal */}
      {isSettleModalOpen && settleSession && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsSettleModalOpen(false)}
          style={{ zIndex: 2000 }}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 500,
              borderRadius: '14px',
              backgroundColor: '#ffffff',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--neutral-900)' }}>
                  Settle Table Bill
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', margin: '2px 0 0' }}>
                  {tables.find(t => t.id === settleSession.tableId)?.tableName || tables.find(t => t.id === settleSession.tableId)?.label || `Table ${settleSession.tableId}`}
                </p>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => setIsSettleModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {settleError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: 16
              }}>
                {settleError}
              </div>
            )}

            {/* Bill Summary Box */}
            <div style={{
              backgroundColor: 'var(--neutral-50)',
              borderRadius: '10px',
              border: '1px solid var(--neutral-200)',
              padding: '16px',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--neutral-600)' }}>Food Subtotal:</span>
                <span style={{ fontWeight: 600 }}>₹{Number(settleSession.subtotal || 0).toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success-700)', marginBottom: 6 }}>
                  <span>Discount ({discountPercent}%):</span>
                  <span>-₹{((Number(settleSession.subtotal || 0) * discountPercent) / 100).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 8 }}>
                <span style={{ color: 'var(--neutral-600)' }}>Taxes & GST (5%):</span>
                <span style={{ fontWeight: 600 }}>
                  ₹{(
                    (Number(settleSession.subtotal || 0) - (Number(settleSession.subtotal || 0) * discountPercent) / 100) * 0.05
                  ).toFixed(2)}
                </span>
              </div>
              <div style={{
                borderTop: '1px solid var(--neutral-200)',
                paddingTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--neutral-900)'
              }}>
                <span>Final Payable:</span>
                <span style={{ color: 'var(--primary-600)' }}>
                  ₹{(
                    (Number(settleSession.subtotal || 0) - (Number(settleSession.subtotal || 0) * discountPercent) / 100) * 1.05
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                Payment Method *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn btn-sm ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontWeight: 700, fontSize: '0.78rem', padding: '8px 4px' }}
                    onClick={() => setPaymentMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference / UTR for UPI or Card */}
            {(paymentMode === 'UPI' || paymentMode === 'CARD') && (
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Transaction / UTR Reference (Optional)</label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  placeholder="e.g. UPI Ref / Card Last 4"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                />
              </div>
            )}

            {/* Customer Details & Discount Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Customer Phone (for WhatsApp)</label>
                <input
                  type="tel"
                  className="form-input form-input-sm"
                  placeholder="10-digit mobile"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Discount %</label>
                <select
                  className="form-select form-select-sm"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Number(e.target.value))}
                >
                  <option value={0}>No Discount (0%)</option>
                  <option value={5}>5% Discount</option>
                  <option value={10}>10% Staff / Friend</option>
                  <option value={15}>15% Special</option>
                  <option value={20}>20% VIP</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, fontWeight: 600 }}
                onClick={() => setIsSettleModalOpen(false)}
                disabled={isSettling}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2, fontWeight: 700 }}
                onClick={handleConfirmSettle}
                disabled={isSettling}
              >
                {isSettling ? 'Generating Bill...' : 'Complete & Generate Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          isOpen={Boolean(editingOrder)}
          onClose={() => { setEditingOrder(null); loadData(); }}
          order={editingOrder.order}
          sessionId={editingOrder.sessionId}
          tableName={editingOrder.tableName}
          onOrderAccepted={(kot) => {
            setPrintingKotData(kot);
            setKotModalOpen(true);
            loadData();
          }}
        />
      )}

      {/* KOT Thermal Print Modal */}
      {kotModalOpen && printingKotData && (
        <KOTPrintModal
          isOpen={kotModalOpen}
          onClose={() => setKotModalOpen(false)}
          kotData={printingKotData}
        />
      )}
    </div>
  );
};
