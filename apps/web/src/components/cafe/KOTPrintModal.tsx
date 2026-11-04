import React from 'react';
import { X, Printer, ChefHat } from 'lucide-react';
import { KOT } from '../../types';
import { store } from '../../services/store';

interface KOTPrintModalProps {
  kot?: KOT;
  kotData?: any;
  isOpen?: boolean;
  onClose: () => void;
}

export const KOTPrintModal: React.FC<KOTPrintModalProps> = ({ kot, kotData, isOpen, onClose }) => {
  const activeTenant = store.getActiveTenant();
  const activeLocation = store.getActiveLocation();

  if (isOpen === false) return null;
  const activeKot = kot || kotData;
  if (!activeKot) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeName = activeTenant?.name || 'QuickBill Café';
  const branchName = activeLocation?.name || 'Counter';
  const items: any[] = activeKot.items || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Action Bar (Excluded from Print) */}
        <div
          className="card-header no-print"
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--neutral-200, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ChefHat size={18} color="var(--primary-600, #2563eb)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--neutral-800, #1f2937)' }}>
              Kitchen Ticket ({activeKot.kotNumber})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handlePrint}
            >
              <Printer size={14} />
              <span>Print KOT</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px', borderRadius: '50%' }}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable 80mm Thermal KOT Slip */}
        <div
          id="printable-kot"
          style={{
            padding: '24px 20px',
            backgroundColor: '#ffffff',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#000000',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          {/* Top Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
              *** KITCHEN ORDER TICKET ***
            </div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              {storeName} — {branchName}
            </div>
          </div>

          {/* Table & Ticket Meta */}
          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 900 }}>
              <span>TABLE: {activeKot.tableName || activeKot.tableNumber}</span>
              <span>{activeKot.kotNumber}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
              <span>Round #{activeKot.roundNumber || 1}</span>
              <span>Server: {activeKot.serverName || 'Staff'}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
              Time: {new Date(activeKot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(activeKot.createdAt).toLocaleDateString()})
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '6px' }}>
              <span style={{ flex: 1 }}>ITEM / VARIANT</span>
              <span style={{ width: '40px', textAlign: 'right' }}>QTY</span>
            </div>

            {items.map((it, idx) => (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>
                    {it.name || it.itemName}
                    {it.variantName && ` (${it.variantName})`}
                  </span>
                  <span style={{ width: '40px', textAlign: 'right', fontWeight: 900, fontSize: '15px' }}>
                    {it.quantity}
                  </span>
                </div>
                {it.notes && (
                  <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#333', marginLeft: '8px', marginTop: '2px' }}>
                    * Instruction: {it.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Notice */}
          <div style={{ textAlign: 'center', borderTop: '2px dashed #000', paddingTop: '10px', fontSize: '11px' }}>
            Total Items: {items.reduce((acc, it) => acc + it.quantity, 0)}
            <div style={{ marginTop: '4px', fontSize: '10px' }}>
              --- END OF TICKET ---
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
