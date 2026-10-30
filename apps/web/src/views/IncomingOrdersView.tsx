import React, { useState, useEffect, useMemo } from 'react';
import { 
  Inbox, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  Filter, 
  ChefHat,
  Printer,
  Coffee,
  X
} from 'lucide-react';
import { store } from '../services/store';
import { TableSession, TableSessionOrder, CafeTable } from '../types';
import { IncomingOrderCard } from '../components/cafe/IncomingOrderCard';
import { KOTPrintModal } from '../components/cafe/KOTPrintModal';

export const IncomingOrdersView: React.FC = () => {
  const [sessions, setSessions] = useState<TableSession[]>(store.getActiveTableSessions());
  const [tables, setTables] = useState<CafeTable[]>(store.getCafeTables());
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'>('SUBMITTED');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // KOT Modal
  const [kotModalOpen, setKotModalOpen] = useState(false);
  const [kotData, setKotData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, tList] = await Promise.all([
        store.fetchActiveTableSessions(),
        store.fetchTables()
      ]);
      setSessions(sList);
      setTables(tList);
    } catch (err) {
      console.warn('Failed to load incoming orders data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = store.subscribe(() => {
      setSessions(store.getActiveTableSessions());
      setTables(store.getCafeTables());
    });

    // Polling every 5 seconds for new customer orders
    const interval = setInterval(() => {
      store.fetchActiveTableSessions().catch(() => {});
    }, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Map tableId -> tableName
  const tableNameMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach(t => {
      map.set(t.id, t.tableName || t.label || `Table ${t.tableNumber}`);
    });
    return map;
  }, [tables]);

  // Flatten all orders from all active sessions with table context
  const allOrdersList = useMemo(() => {
    const list: Array<{
      sessionId: string;
      tableId: string;
      tableName: string;
      order: TableSessionOrder;
    }> = [];

    sessions.forEach(s => {
      const tName = tableNameMap.get(s.tableId) || `Table ${s.tableId}`;
      s.orders?.forEach(o => {
        list.push({
          sessionId: s.id,
          tableId: s.tableId,
          tableName: tName,
          order: o,
        });
      });
    });

    // Sort newest placedAt first
    list.sort((a, b) => new Date(b.order.placedAt).getTime() - new Date(a.order.placedAt).getTime());
    return list;
  }, [sessions, tableNameMap]);

  // Counts
  const counts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    allOrdersList.forEach(item => {
      if (item.order.approvalStatus === 'SUBMITTED') pending++;
      else if (item.order.approvalStatus === 'ACCEPTED') accepted++;
      else if (item.order.approvalStatus === 'REJECTED') rejected++;
    });
    return { pending, accepted, rejected, total: allOrdersList.length };
  }, [allOrdersList]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return allOrdersList;
    return allOrdersList.filter(item => item.order.approvalStatus === statusFilter);
  }, [allOrdersList, statusFilter]);

  const handleAcceptOrder = async (sessionId: string, orderId: string) => {
    try {
      const res = await store.acceptSessionOrder(sessionId, orderId);
      // If a KOT was returned, automatically show print preview
      if (res?.kot) {
        const itemObj = allOrdersList.find(x => x.order.orderId === orderId);
        setKotData({
          kotNumber: res.kot.kotNumber || 'KOT-001',
          tableName: itemObj?.tableName || 'Table',
          createdAt: res.kot.createdAt || new Date().toISOString(),
          serverName: res.kot.serverName || 'QR Order',
          specialInstructions: res.kot.specialInstructions,
          items: res.kot.items || [],
        });
        setKotModalOpen(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to accept order.');
    }
  };

  const handleRejectOrder = async (sessionId: string, orderId: string, reason: string) => {
    try {
      await store.rejectSessionOrder(sessionId, orderId, reason);
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to reject order.');
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#dc2626',
            width: 40,
            height: 40,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Inbox size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
              Incoming QR Orders Queue
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', margin: '2px 0 0' }}>
              Review diner mobile orders before sending to the kitchen, prevent fraudulent or invalid tickets
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Sound Toggle */}
          <button
            type="button"
            className={`btn btn-sm ${soundEnabled ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
            title={soundEnabled ? 'Mute order notification chimes' : 'Enable order chimes'}
          >
            {soundEnabled ? <Volume2 size={15} color="#16a34a" /> : <VolumeX size={15} color="#94a3b8" />}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Strip */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--neutral-200)',
        padding: '12px 18px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'SUBMITTED' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('SUBMITTED')}
          style={{
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '0.82rem',
            backgroundColor: statusFilter === 'SUBMITTED' ? '#dc2626' : undefined,
            borderColor: statusFilter === 'SUBMITTED' ? '#dc2626' : undefined,
            color: statusFilter === 'SUBMITTED' ? '#ffffff' : undefined,
          }}
        >
          Pending Review ({counts.pending})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'ACCEPTED' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('ACCEPTED')}
          style={{ fontWeight: 600, padding: '6px 14px', fontSize: '0.82rem' }}
        >
          Accepted & In Kitchen ({counts.accepted})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'REJECTED' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('REJECTED')}
          style={{ fontWeight: 600, padding: '6px 14px', fontSize: '0.82rem' }}
        >
          Rejected ({counts.rejected})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('ALL')}
          style={{ fontWeight: 600, padding: '6px 14px', fontSize: '0.82rem' }}
        >
          All Orders ({counts.total})
        </button>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px dashed var(--neutral-300)',
          padding: '64px 24px',
          textAlign: 'center',
          color: 'var(--neutral-500)'
        }}>
          <Inbox size={48} style={{ margin: '0 auto 14px', color: 'var(--neutral-300)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '0 0 6px' }}>
            No Orders In This Queue
          </h3>
          <p style={{ fontSize: '0.82rem', margin: '0' }}>
            {statusFilter === 'SUBMITTED' 
              ? 'All incoming customer orders have been reviewed. New orders from tables will appear here in real-time!'
              : 'No orders found matching the selected status.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 20,
        }}>
          {filteredOrders.map(item => (
            <IncomingOrderCard
              key={item.order.orderId}
              sessionId={item.sessionId}
              tableNumber={item.tableName}
              order={item.order}
              onAccept={handleAcceptOrder}
              onReject={handleRejectOrder}
            />
          ))}
        </div>
      )}

      {/* KOT Print Chit Modal */}
      {kotModalOpen && kotData && (
        <KOTPrintModal
          isOpen={kotModalOpen}
          onClose={() => setKotModalOpen(false)}
          kotData={kotData}
        />
      )}
    </div>
  );
};
