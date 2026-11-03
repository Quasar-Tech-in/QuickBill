import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, ChefHat, Check, AlertCircle, ShoppingBag } from 'lucide-react';
import { TableSessionOrder, Item } from '../../types';
import { store } from '../../services/store';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: TableSessionOrder;
  sessionId: string;
  tableName: string;
  onOrderSaved?: (updatedOrder: any) => void;
  onOrderAccepted?: (kotData: any) => void;
}

interface EditableItem {
  itemId?: string;
  name: string;
  quantity: number;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  notes?: string;
  taxRate?: number;
  lineTotal: number;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  sessionId,
  tableName,
  onOrderSaved,
  onOrderAccepted,
}) => {
  const [items, setItems] = useState<EditableItem[]>([]);
  const [notes, setNotes] = useState<string>(order.notes || '');
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedAddItem, setSelectedAddItem] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Populate items from order
    if (order && order.items) {
      setItems(
        order.items.map(it => ({
          itemId: it.itemId,
          name: it.name || (it as any).itemName || 'Item',
          quantity: Number(it.quantity || 1),
          variantId: it.variantId,
          variantName: it.variantName,
          unitPrice: Number(it.unitPrice || 0),
          notes: it.notes,
          taxRate: Number(it.taxRate || 5),
          lineTotal: Number(it.lineTotal || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
        }))
      );
      setNotes(order.notes || '');
    }

    // Load menu items from store
    const storeItems = store.getItems().filter(i => (i as any).isActive !== false);
    setAvailableItems(storeItems);
  }, [order]);

  if (!isOpen) return null;

  const handleQuantityChange = (index: number, delta: number) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        // Remove item if quantity reaches 0
        return copy.filter((_, i) => i !== index);
      }
      target.quantity = newQty;
      target.lineTotal = round2(target.unitPrice * newQty);
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewItem = () => {
    if (!selectedAddItem) return;
    const found = availableItems.find(i => i.id === selectedAddItem);
    if (!found) return;

    const price = Number(found.salePrice || 0);
    const newItem: EditableItem = {
      itemId: found.id,
      name: found.name,
      quantity: 1,
      unitPrice: price,
      taxRate: Number(found.taxRate || 5),
      lineTotal: price,
    };

    setItems(prev => [...prev, newItem]);
    setSelectedAddItem('');
  };

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const subtotal = round2(items.reduce((sum, it) => sum + (it.lineTotal || 0), 0));
  const estimatedTax = round2(subtotal * 0.05);
  const grandTotal = round2(subtotal + estimatedTax);

  const handleSave = async (andAccept: boolean = false) => {
    if (items.length === 0) {
      setErrorMsg('An order must have at least one item. To cancel, please reject the order.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await store.updateSessionOrder(sessionId, order.orderId, {
        items: items.map(it => ({
          itemId: it.itemId,
          name: it.name,
          quantity: it.quantity,
          variantId: it.variantId,
          variantName: it.variantName,
          unitPrice: it.unitPrice,
          notes: it.notes,
        })),
        notes: notes.trim() || undefined,
      });

      if (onOrderSaved) {
        onOrderSaved(res.order || res);
      }

      if (andAccept) {
        const acceptRes = await store.acceptSessionOrder(sessionId, order.orderId);
        if (onOrderAccepted && acceptRes?.kot) {
          onOrderAccepted(acceptRes.kot);
        }
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 2100,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'fixed',
        inset: 0,
      }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--neutral-200, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--neutral-50, #f8fafc)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  backgroundColor: 'var(--primary-100, #dbeafe)',
                  color: 'var(--primary-700, #1d4ed8)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                Table {tableName}
              </span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--neutral-900, #0f172a)' }}>
                Edit Order
              </h2>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500, #64748b)', marginTop: '2px' }}>
              Order ID: <code style={{ fontWeight: 600 }}>{order.orderId}</code> • Status: {order.approvalStatus}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon btn-sm"
            onClick={onClose}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: 'var(--danger-50, #fef2f2)',
                border: '1px solid var(--danger-200, #fecaca)',
                color: 'var(--danger-700, #b91c1c)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Items List */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-500, #64748b)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              Order Items ({items.length})
            </label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: 'var(--neutral-50, #f8fafc)',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid var(--neutral-200, #e2e8f0)',
              }}
            >
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--neutral-400, #94a3b8)', fontSize: '0.85rem' }}>
                  No items in this order. Add an item below.
                </div>
              ) : (
                items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#ffffff',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--neutral-200, #e2e8f0)',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-900, #0f172a)' }}>
                        {it.name}
                        {it.variantName && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500, #64748b)', marginLeft: '4px' }}>
                            ({it.variantName})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500, #64748b)', marginTop: '2px' }}>
                        ₹{it.unitPrice.toFixed(2)} each
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, -1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid var(--neutral-300, #cbd5e1)',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: '24px', textAlign: 'center' }}>
                        {it.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid var(--neutral-300, #cbd5e1)',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Line total & remove */}
                    <div style={{ textAlign: 'right', minWidth: '70px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--neutral-900, #0f172a)' }}>
                        ₹{it.lineTotal.toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remove item"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--danger-500, #ef4444)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Item From Menu */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-500, #64748b)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              Add Dish from Menu
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-select"
                value={selectedAddItem}
                onChange={e => setSelectedAddItem(e.target.value)}
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px', borderRadius: '8px' }}
              >
                <option value="">-- Choose dish to add --</option>
                {availableItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (₹{Number(item.salePrice || 0).toFixed(2)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddNewItem}
                disabled={!selectedAddItem}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px' }}
              >
                <Plus size={15} />
                Add Item
              </button>
            </div>
          </div>

          {/* Special Instructions Notes */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-500, #64748b)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
              Kitchen / Special Instructions
            </label>
            <textarea
              className="form-input"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Extra spicy, less sugar, no ice..."
              style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '8px' }}
            />
          </div>

          {/* Running Totals Breakdown */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--neutral-50, #f8fafc)',
              borderRadius: '10px',
              border: '1px solid var(--neutral-200, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600, #475569)' }}>
              <span>Order Subtotal:</span>
              <span style={{ fontWeight: 600 }}>₹{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600, #475569)' }}>
              <span>Estimated GST (5%):</span>
              <span style={{ fontWeight: 600 }}>₹{estimatedTax.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: '1rem',
                color: 'var(--neutral-900, #0f172a)',
                borderTop: '1px dashed var(--neutral-200, #e2e8f0)',
                paddingTop: '6px',
                marginTop: '2px',
              }}
            >
              <span>Total:</span>
              <span style={{ color: 'var(--primary-600, #2563eb)' }}>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--neutral-200, #e2e8f0)',
            backgroundColor: 'var(--neutral-50, #f8fafc)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={saving}
            style={{ fontWeight: 600, fontSize: '0.85rem' }}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSave(false)}
            disabled={saving || items.length === 0}
            style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={15} />
            {saving ? 'Saving...' : 'Save Order'}
          </button>

          {order.approvalStatus === 'SUBMITTED' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSave(true)}
              disabled={saving || items.length === 0}
              style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ChefHat size={15} />
              {saving ? 'Processing...' : 'Save & Accept (Print KOT)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

