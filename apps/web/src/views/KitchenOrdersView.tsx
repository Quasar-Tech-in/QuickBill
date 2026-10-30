import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChefHat, 
  Clock, 
  Flame, 
  CheckCircle2, 
  RefreshCw, 
  Printer, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Utensils
} from 'lucide-react';
import { store } from '../services/store';
import { KOT } from '../types';
import { KOTPrintModal } from '../components/cafe/KOTPrintModal';

export const KitchenOrdersView: React.FC = () => {
  const [kots, setKots] = useState<KOT[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'QUEUED' | 'PREPARING' | 'READY' | 'SERVED'>('ACTIVE');

  // Print Modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedKOT, setSelectedKOT] = useState<any>(null);

  const loadKOTs = async () => {
    setLoading(true);
    try {
      const data = await store.fetchKOTs();
      setKots(data);
    } catch (err) {
      console.warn('Failed to load KOTs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKOTs();
    const unsub = store.subscribe(() => {
      // In case store has updated KOTs
    });

    // Auto-refresh KDS every 5 seconds
    const interval = setInterval(() => {
      store.fetchKOTs().then(res => setKots(res)).catch(() => {});
    }, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleUpdateStatus = async (kotId: string, newStatus: string) => {
    try {
      await store.updateKOTStatus(kotId, newStatus);
      await loadKOTs();
    } catch (err) {
      alert('Failed to update kitchen ticket status.');
    }
  };

  const handlePrint = (kot: KOT) => {
    setSelectedKOT({
      kotNumber: kot.kotNumber,
      tableName: kot.tableName || kot.tableNumber || `Table ${kot.tableId}`,
      createdAt: kot.createdAt,
      serverName: kot.serverName || 'Counter',
      specialInstructions: kot.specialInstructions,
      items: kot.items,
    });
    setPrintModalOpen(true);
  };

  // Filter KOTs
  const filteredKOTs = useMemo(() => {
    return kots.filter(k => {
      if (statusFilter === 'ACTIVE') {
        return k.kitchenStatus === 'QUEUED' || k.kitchenStatus === 'PREPARING';
      }
      return k.kitchenStatus === statusFilter;
    });
  }, [kots, statusFilter]);

  // Counts
  const counts = useMemo(() => {
    let queued = 0;
    let preparing = 0;
    let ready = 0;
    let served = 0;
    kots.forEach(k => {
      if (k.kitchenStatus === 'QUEUED') queued++;
      else if (k.kitchenStatus === 'PREPARING') preparing++;
      else if (k.kitchenStatus === 'READY') ready++;
      else if (k.kitchenStatus === 'SERVED') served++;
    });
    return {
      active: queued + preparing,
      queued,
      preparing,
      ready,
      served,
    };
  }, [kots]);

  const getElapsedMinutes = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="view-container" style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            backgroundColor: '#ffedd5', 
            color: '#ea580c',
            width: 40,
            height: 40,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ChefHat size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
              Kitchen Display System (KDS)
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', margin: '2px 0 0' }}>
              Live chef workstation chits, prep timer, and sequential ticket flow
            </p>
          </div>
        </div>

        <button 
          type="button" 
          className="btn btn-secondary btn-sm"
          onClick={loadKOTs}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Tickets</span>
        </button>
      </div>

      {/* Filter Tabs */}
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
          className={`btn btn-sm ${statusFilter === 'ACTIVE' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('ACTIVE')}
          style={{ fontWeight: 700, padding: '6px 14px', fontSize: '0.82rem' }}
        >
          Active Workstation ({counts.active})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'QUEUED' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('QUEUED')}
          style={{
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '0.82rem',
            backgroundColor: statusFilter === 'QUEUED' ? '#dc2626' : undefined,
            borderColor: statusFilter === 'QUEUED' ? '#dc2626' : undefined,
            color: statusFilter === 'QUEUED' ? '#fff' : undefined,
          }}
        >
          Queued ({counts.queued})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'PREPARING' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('PREPARING')}
          style={{
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '0.82rem',
            backgroundColor: statusFilter === 'PREPARING' ? '#ea580c' : undefined,
            borderColor: statusFilter === 'PREPARING' ? '#ea580c' : undefined,
            color: statusFilter === 'PREPARING' ? '#fff' : undefined,
          }}
        >
          Cooking / Prep ({counts.preparing})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'READY' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('READY')}
          style={{
            fontWeight: 700,
            padding: '6px 14px',
            fontSize: '0.82rem',
            backgroundColor: statusFilter === 'READY' ? '#16a34a' : undefined,
            borderColor: statusFilter === 'READY' ? '#16a34a' : undefined,
            color: statusFilter === 'READY' ? '#fff' : undefined,
          }}
        >
          Ready for Pickup ({counts.ready})
        </button>

        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'SERVED' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setStatusFilter('SERVED')}
          style={{ fontWeight: 600, padding: '6px 14px', fontSize: '0.82rem' }}
        >
          Served History ({counts.served})
        </button>
      </div>

      {/* KOT Cards Grid */}
      {filteredKOTs.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px dashed var(--neutral-300)',
          padding: '64px 24px',
          textAlign: 'center',
          color: 'var(--neutral-500)'
        }}>
          <ChefHat size={48} style={{ margin: '0 auto 14px', color: 'var(--neutral-300)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '0 0 6px' }}>
            Kitchen Queue is Clear
          </h3>
          <p style={{ fontSize: '0.82rem', margin: '0' }}>
            No order tickets in this state. Accepted items from tables will appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 20,
        }}>
          {filteredKOTs.map(kot => {
            const elapsed = getElapsedMinutes(kot.createdAt);
            const isUrgent = elapsed >= 15;
            const isWarning = elapsed >= 8 && elapsed < 15;

            return (
              <div
                key={kot.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: `2px solid ${
                    isUrgent 
                      ? '#ef4444' 
                      : kot.kitchenStatus === 'PREPARING' 
                        ? '#f97316' 
                        : kot.kitchenStatus === 'READY' 
                          ? '#22c55e' 
                          : '#cbd5e1'
                  }`,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Header Strip */}
                <div style={{
                  padding: '14px 18px',
                  backgroundColor: isUrgent ? '#fef2f2' : 'var(--neutral-50)',
                  borderBottom: '1px solid var(--neutral-200)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--neutral-900)' }}>
                        {kot.kotNumber}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: kot.kitchenStatus === 'QUEUED' ? '#fecaca' : kot.kitchenStatus === 'PREPARING' ? '#fed7aa' : '#bbf7d0',
                        color: kot.kitchenStatus === 'QUEUED' ? '#991b1b' : kot.kitchenStatus === 'PREPARING' ? '#9a3412' : '#166534',
                      }}>
                        {kot.kitchenStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--neutral-700)', marginTop: 2 }}>
                      {kot.tableName || kot.tableNumber || `Table ${kot.tableId}`}
                    </div>
                  </div>

                  {/* Elapsed Timer */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: isUrgent ? '#dc2626' : isWarning ? '#d97706' : 'var(--neutral-600)'
                    }}>
                      <Clock size={15} />
                      <span>{elapsed}m ago</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>
                      {new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div style={{ padding: '16px 18px', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {kot.items.map((it, idx) => (
                      <div 
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          borderBottom: idx < kot.items.length - 1 ? '1px dashed var(--neutral-200)' : 'none',
                          paddingBottom: idx < kot.items.length - 1 ? 8 : 0,
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '6px',
                          backgroundColor: 'var(--neutral-900)',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.92rem',
                          flexShrink: 0
                        }}>
                          {it.quantity}
                        </span>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                            {it.itemName || it.name}
                          </div>
                          {it.variantName && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', fontWeight: 600 }}>
                              Size/Type: {it.variantName}
                            </div>
                          )}
                          {it.notes && (
                            <div style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: '#ea580c',
                              backgroundColor: '#fff7ed',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              marginTop: 4,
                              display: 'inline-block'
                            }}>
                              Note: {it.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {kot.specialInstructions && (
                    <div style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}>
                      Ticket Note: {kot.specialInstructions}
                    </div>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div style={{
                  padding: '12px 18px',
                  backgroundColor: 'var(--neutral-50)',
                  borderTop: '1px solid var(--neutral-200)',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center'
                }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handlePrint(kot)}
                    title="Print kitchen chit"
                    style={{ padding: '6px 10px' }}
                  >
                    <Printer size={15} color="var(--neutral-600)" />
                  </button>

                  {kot.kitchenStatus === 'QUEUED' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{
                        flex: 1,
                        backgroundColor: '#ea580c',
                        borderColor: '#ea580c',
                        fontWeight: 700,
                        fontSize: '0.82rem'
                      }}
                      onClick={() => handleUpdateStatus(kot.id, 'PREPARING')}
                    >
                      <Flame size={15} style={{ marginRight: 6 }} />
                      Start Preparing
                    </button>
                  )}

                  {kot.kitchenStatus === 'PREPARING' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{
                        flex: 1,
                        backgroundColor: '#16a34a',
                        borderColor: '#16a34a',
                        fontWeight: 700,
                        fontSize: '0.82rem'
                      }}
                      onClick={() => handleUpdateStatus(kot.id, 'READY')}
                    >
                      <CheckCircle2 size={15} style={{ marginRight: 6 }} />
                      Mark Ready for Pickup
                    </button>
                  )}

                  {kot.kitchenStatus === 'READY' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontWeight: 700, fontSize: '0.82rem' }}
                      onClick={() => handleUpdateStatus(kot.id, 'SERVED')}
                    >
                      Mark Served
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Print Slip Modal */}
      {printModalOpen && selectedKOT && (
        <KOTPrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          kotData={selectedKOT}
        />
      )}
    </div>
  );
};
