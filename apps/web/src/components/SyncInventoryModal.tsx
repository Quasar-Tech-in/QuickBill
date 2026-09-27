import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Boxes, 
  CheckCircle2, 
  EyeOff, 
  SlidersHorizontal, 
  Search, 
  Check, 
  Sparkles, 
  Loader2, 
  Building2, 
  PackageCheck,
  Layers,
  ArrowRight
} from 'lucide-react';
import { StoreLocation, Item } from '../types';
import { store } from '../services/store';

export interface SyncInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLocation: StoreLocation | null;
  onSuccess?: (syncedCount: number, message: string) => void;
}

export const SyncInventoryModal: React.FC<SyncInventoryModalProps> = ({
  isOpen,
  onClose,
  targetLocation,
  onSuccess,
}) => {
  const [syncMode, setSyncMode] = useState<'ALL_ENABLED' | 'ALL_DISABLED' | 'SELECTIVE'>('ALL_ENABLED');
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [defaultStock, setDefaultStock] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');

  // Load items when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessToast('');
      setSearchQuery('');
      setCategoryFilter('ALL');
      
      const allItems = store.getItems('ALL', true);
      setItems(allItems);

      // By default if selective, pre-select items that are currently listed in target location or all items
      if (targetLocation) {
        const preSelected = new Set<string>();
        allItems.forEach(i => {
          const locInv = i.locations?.find(l => l.locationId === targetLocation.id || l.locationId === targetLocation.code);
          if (locInv) {
            if (locInv.isListed !== false) {
              preSelected.add(i.id);
            }
          } else {
            preSelected.add(i.id);
          }
        });
        setSelectedItemIds(preSelected);
      }
    }
  }, [isOpen, targetLocation]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach(i => {
      if (i.category) cats.add(i.category);
    });
    return Array.from(cats);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSku = item.sku?.toLowerCase().includes(q);
        const matchBarcode = item.barcode?.toLowerCase().includes(q);
        const matchCategory = item.category?.toLowerCase().includes(q);
        return matchName || matchSku || matchBarcode || matchCategory;
      }
      return true;
    });
  }, [items, categoryFilter, searchQuery]);

  if (!isOpen || !targetLocation) return null;

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedItemIds(new Set(items.map(i => i.id)));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  const handleExecuteSync = async () => {
    if (!targetLocation) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payloadItemIds = syncMode === 'SELECTIVE' ? Array.from(selectedItemIds) : undefined;
      const res = await store.syncLocationInventory(targetLocation.id, {
        mode: syncMode,
        itemIds: payloadItemIds,
        defaultStock: defaultStock > 0 ? defaultStock : 0,
      });

      if (res.success) {
        setSuccessToast(res.message || `Successfully synchronized items to ${targetLocation.name}!`);
        if (onSuccess) {
          onSuccess(res.syncedCount, res.message || '');
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg('Inventory synchronization could not be completed.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to sync inventory to branch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const enabledCount = syncMode === 'ALL_ENABLED' 
    ? items.length 
    : syncMode === 'ALL_DISABLED' 
    ? 0 
    : selectedItemIds.size;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: syncMode === 'SELECTIVE' ? 820 : 640, 
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          transition: 'all 0.25s ease'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, var(--neutral-900) 0%, #1e1b4b 100%)',
          color: '#ffffff',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-700) 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)'
              }}>
                <Boxes size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                  Sync Catalog & Inventory to Branch
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', margin: '3px 0 0 0' }}>
                  Initialize product catalog entries and availability for <strong style={{ color: '#ffffff' }}>{targetLocation.name}</strong> ({targetLocation.code})
                </p>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-ghost" 
              onClick={onClose} 
              disabled={isSubmitting}
              style={{ color: 'rgba(255,255,255,0.7)', padding: 6, margin: -6 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Target Branch Badge Bar */}
          <div style={{
            marginTop: 14,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={14} color="var(--primary-400)" />
              <span style={{ fontWeight: 700, color: '#ffffff' }}>{targetLocation.name}</span>
              <span style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.72rem', 
                background: 'rgba(255,255,255,0.2)', 
                padding: '1px 6px', 
                borderRadius: 4,
                fontWeight: 700
              }}>
                {targetLocation.code}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Total Catalog Products:</span>
              <span style={{ fontWeight: 800, color: 'var(--primary-300)' }}>{items.length} Items</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ 
          padding: 24, 
          overflowY: 'auto', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 20 
        }}>
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-50)',
              border: '1px solid var(--danger-200)',
              color: 'var(--danger-700)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <X size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successToast && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--success-50)',
              border: '1px solid var(--success-300)',
              color: 'var(--success-800)',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <CheckCircle2 size={18} color="var(--success-600)" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Sync Mode Selection Cards */}
          <div>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--neutral-800)', marginBottom: 8, display: 'block' }}>
              Choose Product Availability Strategy:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {/* Option 1: All Enabled */}
              <div
                onClick={() => setSyncMode('ALL_ENABLED')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${syncMode === 'ALL_ENABLED' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                  backgroundColor: syncMode === 'ALL_ENABLED' ? 'var(--primary-50)' : 'var(--neutral-50)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 8, 
                    backgroundColor: syncMode === 'ALL_ENABLED' ? 'var(--primary-600)' : 'var(--neutral-200)',
                    color: syncMode === 'ALL_ENABLED' ? '#ffffff' : 'var(--neutral-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Sparkles size={16} />
                  </div>
                  {syncMode === 'ALL_ENABLED' && (
                    <div style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} />
                    </div>
                  )}
                </div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--neutral-900)', margin: '0 0 4px 0' }}>
                  Enable All Items
                </h4>
                <p style={{ fontSize: '0.74rem', color: 'var(--neutral-600)', margin: 0, lineHeight: 1.35 }}>
                  All {items.length} products listed and ready for POS sales immediately.
                </p>
              </div>

              {/* Option 2: All Disabled */}
              <div
                onClick={() => setSyncMode('ALL_DISABLED')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${syncMode === 'ALL_DISABLED' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                  backgroundColor: syncMode === 'ALL_DISABLED' ? 'var(--primary-50)' : 'var(--neutral-50)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 8, 
                    backgroundColor: syncMode === 'ALL_DISABLED' ? 'var(--primary-600)' : 'var(--neutral-200)',
                    color: syncMode === 'ALL_DISABLED' ? '#ffffff' : 'var(--neutral-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <EyeOff size={16} />
                  </div>
                  {syncMode === 'ALL_DISABLED' && (
                    <div style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} />
                    </div>
                  )}
                </div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--neutral-900)', margin: '0 0 4px 0' }}>
                  Keep Unlisted (Drafts)
                </h4>
                <p style={{ fontSize: '0.74rem', color: 'var(--neutral-600)', margin: 0, lineHeight: 1.35 }}>
                  Link all products but keep them unlisted until stock arrives.
                </p>
              </div>

              {/* Option 3: Selective */}
              <div
                onClick={() => setSyncMode('SELECTIVE')}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${syncMode === 'SELECTIVE' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                  backgroundColor: syncMode === 'SELECTIVE' ? 'var(--primary-50)' : 'var(--neutral-50)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 8, 
                    backgroundColor: syncMode === 'SELECTIVE' ? 'var(--primary-600)' : 'var(--neutral-200)',
                    color: syncMode === 'SELECTIVE' ? '#ffffff' : 'var(--neutral-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <SlidersHorizontal size={16} />
                  </div>
                  {syncMode === 'SELECTIVE' && (
                    <div style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'var(--primary-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} />
                    </div>
                  )}
                </div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--neutral-900)', margin: '0 0 4px 0' }}>
                  Selective Item Picker
                </h4>
                <p style={{ fontSize: '0.74rem', color: 'var(--neutral-600)', margin: 0, lineHeight: 1.35 }}>
                  Choose specifically which items to activate for this branch.
                </p>
              </div>
            </div>
          </div>

          {/* Selective Picker Table / Search Container */}
          {syncMode === 'SELECTIVE' && (
            <div style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--neutral-200)',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {/* Filter Bar */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--neutral-200)',
                backgroundColor: 'var(--neutral-50)',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--neutral-400)' }} />
                  <input
                    type="text"
                    placeholder="Filter products by name or SKU..."
                    className="form-input"
                    style={{ paddingLeft: 32, fontSize: '0.8rem', height: 34 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {categories.length > 0 && (
                  <select
                    className="form-input"
                    style={{ width: 'auto', fontSize: '0.8rem', height: 34, padding: '0 10px' }}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={handleSelectAll}
                    style={{ fontSize: '0.74rem', fontWeight: 600 }}
                  >
                    Select All ({items.length})
                  </button>
                  <span style={{ color: 'var(--neutral-300)' }}>|</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-danger"
                    onClick={handleDeselectAll}
                    style={{ fontSize: '0.74rem', fontWeight: 600 }}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Status Header */}
              <div style={{
                padding: '6px 14px',
                backgroundColor: 'var(--primary-50)',
                color: 'var(--primary-800)',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--primary-100)'
              }}>
                <span>Showing {filteredItems.length} items</span>
                <span>{selectedItemIds.size} of {items.length} items selected for activation</span>
              </div>

              {/* Scrollable Item Rows */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {filteredItems.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--neutral-500)', fontSize: '0.84rem' }}>
                    No products matching your search query.
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          borderBottom: '1px solid var(--neutral-100)',
                          backgroundColor: isSelected ? '#f8faff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleItem(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 16, height: 16, accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--neutral-900)' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', display: 'flex', gap: 8, marginTop: 2 }}>
                              {item.sku && <span>SKU: {item.sku}</span>}
                              {item.category && <span style={{ color: 'var(--primary-600)', fontWeight: 600 }}>{item.category}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--neutral-900)' }}>
                            ₹{item.salePrice.toFixed(2)}
                          </div>
                          <span className={`badge ${isSelected ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                            {isSelected ? 'Listed' : 'Unlisted'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Optional Default Stock Input */}
          <div style={{
            padding: 14,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--neutral-50)',
            border: '1px solid var(--neutral-200)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--neutral-800)', display: 'block' }}>
                  Initial Stock Quantity for New Branch Entities
                </label>
                <p style={{ fontSize: '0.74rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                  Default opening stock count assigned to items without existing inventory at this branch.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  style={{ width: 100, textAlign: 'center', fontWeight: 700, height: 36 }}
                  value={defaultStock}
                  onChange={(e) => setDefaultStock(Math.max(0, Number(e.target.value) || 0))}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', fontWeight: 600 }}>units</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--neutral-200)',
          backgroundColor: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ fontWeight: 600 }}
          >
            Skip / Close
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExecuteSync}
            disabled={isSubmitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              fontWeight: 700,
              boxShadow: 'var(--shadow-md)'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Syncing Inventory...</span>
              </>
            ) : (
              <>
                <PackageCheck size={16} />
                <span>Sync & Activate {enabledCount} Item{enabledCount === 1 ? '' : 's'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
