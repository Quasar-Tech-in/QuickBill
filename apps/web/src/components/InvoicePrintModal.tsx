import React, { useState, useRef } from 'react';
import { X, Printer, Share2, Send, CheckCircle2, AlertCircle, Phone, User, Loader2 } from 'lucide-react';
import { Invoice } from '../types';
import { store, apiClient } from '../services/store';

interface InvoicePrintModalProps {
  invoice: Invoice;
  onClose: () => void;
}

// Clean quantity formatting rounded to max 3 decimal places without floating-point artifacts
const formatQty = (qty: number | undefined | null): string => {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  const rounded = Math.round(Number(qty) * 1000) / 1000;
  return Number(rounded.toFixed(3)).toString();
};

// Formats invoice date into DD/MM/YYYY format
const formatInvoiceDate = (val?: string | null): string => {
  if (!val) return '';
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return str;
};

const RECEIPT_FORMAT_CACHE_KEY = 'qb_pos_receipt_format_v2';
const RECEIPT_MARGIN_CACHE_KEY = 'qb_pos_receipt_margin_v2';

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoice, onClose }) => {
  const [activeInvoice, setActiveInvoice] = useState<Invoice>(invoice);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Support POS Thermal 48mm (2-inch), POS Thermal 58mm, POS Thermal 80mm (3-inch), and A4 Standard
  const [printFormat, setPrintFormat] = useState<'POS_80' | 'POS_58' | 'POS_55' | 'POS_48' | 'A4'>(() => {
    try {
      const cached = localStorage.getItem(RECEIPT_FORMAT_CACHE_KEY);
      if (cached === 'POS_48' || cached === 'POS_55' || cached === 'POS_58' || cached === 'A4' || cached === 'POS_80') return cached;
    } catch (_) {}
    return 'POS_55'; // 55mm Roll by default
  });

  const [receiptLeftMargin, setReceiptLeftMargin] = useState<number>(() => {
    try {
      const cached = localStorage.getItem(RECEIPT_MARGIN_CACHE_KEY);
      const parsed = cached !== null ? parseFloat(cached) : 0;
      if (!isNaN(parsed) && parsed >= -10 && parsed <= 15) return parsed;
    } catch (_) {}
    return 0; // 0mm left margin by default (printer hardware provides its own 3mm margin)
  });

  const handleMarginChange = (newMargin: number) => {
    const clamped = Math.max(-10, Math.min(15, Math.round(newMargin * 10) / 10));
    setReceiptLeftMargin(clamped);
    try {
      localStorage.setItem(RECEIPT_MARGIN_CACHE_KEY, String(clamped));
    } catch (_) {}
  };

  const handleFormatChange = (fmt: 'POS_80' | 'POS_58' | 'POS_55' | 'POS_48' | 'A4') => {
    setPrintFormat(fmt);
    try {
      localStorage.setItem(RECEIPT_FORMAT_CACHE_KEY, fmt);
    } catch (_) {}
  };

  const isPos = printFormat === 'POS_80' || printFormat === 'POS_58' || printFormat === 'POS_55' || printFormat === 'POS_48';
  
  const activeTenant = store.getActiveTenant();
  const activeLocation = store.getActiveLocation();
  const branchLocation = store.getAllLocations().find(l => l.id === activeInvoice.locationId || l.name === activeInvoice.locationName);

  const handlePrint = () => {
    // 1. Purge any injected Netlify badges, drawer or feedback elements completely
    document.querySelectorAll('netlify-drawer, #netlify-drawer, .netlify-badge, [class*="netlify"], [id*="netlify"], [data-netlify], [data-netlify-drawer], a[href*="netlify.com"], iframe[src*="netlify"]').forEach(el => el.remove());
    
    // 2. Scan elements for "Powered by Netlify" text and purge
    document.querySelectorAll('div, a, span, p, footer, aside, section').forEach(el => {
      const txt = el.textContent?.trim().toLowerCase() || '';
      if (txt === 'powered by netlify' || txt.includes('powered by netlify')) {
        el.remove();
      }
    });

    // 3. Suppress mobile bottom nav and background headers
    document.querySelectorAll('.mobile-bottom-nav, .mobile-drawer, .sidebar, .header').forEach(el => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });

    window.print();
  };

  const getCleanPhone = (inv: Invoice): string => {
    const raw = (inv.customerPhone || inv.consumerPhone || inv.partyPhone || '').replace(/\D/g, '');
    if (raw.length > 10 && raw.startsWith('91')) return raw.slice(2);
    if (raw.length > 10 && raw.startsWith('0')) return raw.slice(1);
    return raw.length >= 10 ? raw.slice(-10) : raw;
  };

  const executeWhatsAppDispatch = async (inv: Invoice, targetTenDigitPhone: string) => {
    let token = inv.shareToken;
    if (!token) {
      try {
        const tokenRes = await apiClient.get(`/sales/${inv.id}/share-token`);
        token = tokenRes.data.shareToken;
      } catch (e) {
        console.warn('Could not fetch share token:', e);
      }
    }

    const clean10 = targetTenDigitPhone.replace(/\D/g, '').slice(-10);
    const fullPhone = `91${clean10}`;
    const origin = window.location.origin;
    const publicLink = token ? `${origin}/bill/${token}` : '';

    const finalAmt = Number(inv.grandTotal || inv.total || 0).toFixed(2);
    const dateStr = formatInvoiceDate(inv.date);
    const customerDisplayName = inv.customerName || inv.consumerName || inv.partyName || 'Valued Customer';

    const itemLines = (inv.items || [])
      .map((it: any) => `• ${it.nameSnapshot || it.name} x ${formatQty(it.quantity)} = ₹${Number(it.lineTotal || it.total || 0).toFixed(2)}`)
      .join('\n');

    let text = `🧾 *TAX INVOICE - ${storeName}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Bill No:* ${inv.invoiceNumber}\n`;
    text += `*Date:* ${dateStr}\n`;
    text += `*Customer:* ${customerDisplayName}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*ITEMS PURCHASED:*\n${itemLines}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Total Qty:* ${formatQty(totalQuantity)}\n`;
    text += `*Taxable Value:* ₹${inv.subtotal.toFixed(2)}\n`;
    text += `*GST:* ₹${inv.taxTotal.toFixed(2)}\n`;
    text += `*GRAND TOTAL:* *₹${finalAmt}*\n`;
    text += `*Payment Mode:* ${inv.paymentMode || 'CASH'} (Paid: ₹${Number(inv.paidAmount !== undefined ? inv.paidAmount : inv.grandTotal).toFixed(2)})\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (publicLink) {
      text += `📄 *View & Download Official PDF Bill:*\n${publicLink}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
    }
    text += `*** THANK YOU FOR SHOPPING WITH US! ***`;

    const waUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleShareWhatsApp = () => {
    const existingPhone = getCleanPhone(activeInvoice);
    if (existingPhone && existingPhone.length === 10) {
      executeWhatsAppDispatch(activeInvoice, existingPhone);
    } else {
      const existingName = (activeInvoice.consumerName || activeInvoice.partyName || '').trim();
      const isGeneric = !existingName || /walk-in|counter/i.test(existingName);
      setNameInput(isGeneric ? '' : existingName);
      setPhoneInput('');
      setPhoneError(null);
      setShowPhonePrompt(true);
    }
  };

  const handleConfirmAttachAndShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = phoneInput.replace(/\D/g, '');
    const tenDigits = cleanDigits.length > 10 ? cleanDigits.slice(-10) : cleanDigits;

    if (tenDigits.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setIsAttaching(true);
      setPhoneError(null);

      const res = await apiClient.post(`/sales/${activeInvoice.id}/attach-customer`, {
        phone: `+91${tenDigits}`,
        name: nameInput.trim() || undefined
      });

      const updatedSale = res.data;
      const updatedInv = store.mapSaleDocToInvoice(updatedSale);
      setActiveInvoice(updatedInv);

      setShowPhonePrompt(false);
      executeWhatsAppDispatch(updatedInv, tenDigits);
    } catch (err: any) {
      console.error('Failed to attach customer:', err);
      setPhoneError(err.response?.data?.detail || 'Failed to link customer. Please check network.');
    } finally {
      setIsAttaching(false);
    }
  };

  const storeName = activeTenant?.name || 'STORE COUNTER';
  const storeLogo = activeTenant?.logoUrl;
  const storeTagline = activeTenant?.tagline;
  const receiptFooter = activeTenant?.receiptFooterNote || 'Please keep this receipt for future reference';
  const branchName = activeInvoice.locationName || activeLocation?.name || 'Main Branch';
  const branchAddress = activeInvoice.locationAddress || branchLocation?.address || activeLocation?.address || '';
  const branchPhone = activeInvoice.locationPhone || branchLocation?.phone || activeLocation?.phone || '';
  const gstin = activeInvoice.locationGstin || branchLocation?.gstin || (activeInvoice.locationId === activeLocation?.id ? activeLocation?.gstin : undefined) || activeTenant?.gstin || '';

  const grossSubtotal = activeInvoice.grossTotal !== undefined
    ? activeInvoice.grossTotal
    : activeInvoice.items.reduce((sum, it) => sum + (Number(it.unitPrice || 0) * Number(it.quantity || 0)), 0);

  const itemDiscountsSum = activeInvoice.itemDiscountTotal !== undefined
    ? activeInvoice.itemDiscountTotal
    : activeInvoice.items.reduce((sum, it) => sum + (it.discountAmount || 0), 0);

  const orderDiscountAmount = activeInvoice.orderDiscountAmount !== undefined
    ? activeInvoice.orderDiscountAmount
    : (activeInvoice.invoiceDiscount !== undefined ? activeInvoice.invoiceDiscount : Math.max(0, (activeInvoice.discountTotal || 0) - itemDiscountsSum));

  const totalItemsCount = activeInvoice.items?.length || 0;
  const totalQuantity = (activeInvoice.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const returnedQuantitySum = (activeInvoice.items || []).reduce((sum, it) => sum + (Number(it.returnedQuantity) || 0), 0);
  const activeQuantity = Math.max(0, totalQuantity - returnedQuantitySum);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: printFormat === 'A4' ? 760 : 440, 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          transition: 'max-width 0.2s ease'
        }}
      >
        {/* Modal Action Header (Excluded from Print) */}
        <div 
          className="card-header no-print" 
          style={{ 
            padding: '14px 20px', 
            borderBottom: '1px solid var(--neutral-200)', 
            backgroundColor: '#ffffff',
            display: 'flex', 
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
            position: 'relative'
          }}
        >
          {/* Top Row: Receipt Title & Return Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 42 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Receipt No:
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                {activeInvoice.invoiceNumber}
              </span>
              {activeInvoice.hasReturns && (
                <span style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                  color: 'var(--danger-700)', 
                  padding: '2px 8px', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.25)' 
                }}>
                  🔄 {activeInvoice.status === 'RETURNED' ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
                </span>
              )}
            </div>
          </div>

          {/* Dedicated Top-Right Close Button */}
          <button 
            type="button"
            className="btn btn-secondary btn-icon btn-sm" 
            onClick={onClose} 
            title="Close Preview"
            style={{ 
              position: 'absolute',
              top: 12,
              right: 16,
              width: 32, 
              height: 32, 
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--neutral-100)',
              border: '1px solid var(--neutral-300)',
              color: 'var(--neutral-700)',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <X size={17} />
          </button>

          {/* Bottom Action Row: Format Switcher & Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            {/* Format Toggle Switch & Width Fit */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div 
                style={{ 
                  display: 'inline-flex', 
                  background: 'var(--neutral-100)', 
                  padding: 3, 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--neutral-200)',
                  gap: 2
                }}
              >
                <button
                  type="button"
                  className={`btn btn-sm ${printFormat === 'POS_80' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: 'none', 
                    padding: '4px 8px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: printFormat === 'POS_80' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => handleFormatChange('POS_80')}
                  title="Calibrated 80mm (3-inch) thermal POS receipt"
                >
                  80mm Roll
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${printFormat === 'POS_58' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: 'none', 
                    padding: '4px 8px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: printFormat === 'POS_58' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => handleFormatChange('POS_58')}
                  title="Compact 58mm (2.25-inch) portable Bluetooth thermal POS receipt"
                >
                  58mm Roll
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${printFormat === 'POS_55' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: 'none', 
                    padding: '4px 8px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: printFormat === 'POS_55' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => handleFormatChange('POS_55')}
                  title="Calibrated 55mm thermal POS paper roll"
                >
                  55mm Roll
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${printFormat === 'POS_48' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: 'none', 
                    padding: '4px 8px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: printFormat === 'POS_48' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => handleFormatChange('POS_48')}
                  title="Pocket 48mm (2-inch) mini Bluetooth thermal printer roll"
                >
                  48mm Roll
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${printFormat === 'A4' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    border: 'none', 
                    padding: '4px 8px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: printFormat === 'A4' ? 'var(--shadow-sm)' : 'none'
                  }}
                  onClick={() => handleFormatChange('A4')}
                >
                  A4 Standard
                </button>
              </div>

              {/* Left Margin Alignment Stepper */}
              {isPos && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--neutral-100)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-600)' }}>Left Margin:</span>
                  <button
                    type="button"
                    onClick={() => handleMarginChange(receiptLeftMargin - 1)}
                    disabled={receiptLeftMargin <= -10}
                    style={{
                      width: 18,
                      height: 18,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      border: '1px solid var(--neutral-300)',
                      backgroundColor: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Shift left by 1mm (supports negative to cancel printer driver hardware margins)"
                  >
                    -
                  </button>
                  <span style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--primary-700)', minWidth: 48, textAlign: 'center' }}>
                    {receiptLeftMargin === 0 ? '0mm' : (receiptLeftMargin > 0 ? '+' : '') + receiptLeftMargin + 'mm'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMarginChange(receiptLeftMargin + 1)}
                    disabled={receiptLeftMargin >= 15}
                    style={{
                      width: 18,
                      height: 18,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      border: '1px solid var(--neutral-300)',
                      backgroundColor: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Shift right by 1mm"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleShareWhatsApp}
                title="Share invoice on WhatsApp"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  backgroundColor: '#f0fdf4',
                  borderColor: '#86efac',
                  color: '#166534'
                }}
              >
                <Share2 size={14} />
                <span>WhatsApp</span>
              </button>

              {/* Print Trigger Button */}
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handlePrint} 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  fontWeight: 700,
                  padding: '6px 16px',
                  fontSize: '0.82rem'
                }}
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>


        {/* Scrollable Printable Receipt Container */}
        <div 
          className="card-body invoice-printable" 
          style={{ 
            overflowY: 'auto', 
            flex: 1, 
            padding: printFormat === 'A4' ? '28px 32px' : '20px 16px',
            backgroundColor: '#ffffff',
            fontFamily: isPos ? 'var(--font-mono, monospace)' : 'var(--font-sans)',
            color: '#000000',
            fontSize: printFormat === 'POS_48' ? '0.62rem' : printFormat === 'POS_58' ? '0.67rem' : printFormat === 'POS_80' ? '0.73rem' : '0.84rem',
            lineHeight: 1.4,
          }}
        >
          {isPos ? (
            /* ========================================================
               CALIBRATED THERMAL POS TEMPLATE (80mm & 58mm)
               ======================================================== */
            <div 
              className={`receipt-pos-container ${
                printFormat === 'POS_48' ? 'receipt-pos-48' : 
                printFormat === 'POS_55' ? 'receipt-pos-55' : 
                printFormat === 'POS_58' ? 'receipt-pos-58' : 'receipt-pos-80'
              }`}
              style={{ 
                ['--receipt-left-margin' as any]: `${receiptLeftMargin}mm`,
                maxWidth: printFormat === 'POS_48' ? 125 : printFormat === 'POS_55' ? 144 : printFormat === 'POS_58' ? 166 : 265, 
                margin: '0 auto',
                textAlign: 'left',
                boxSizing: 'border-box',
                padding: printFormat === 'POS_48' ? '0 1px' : printFormat === 'POS_55' ? '0 1.5px' : printFormat === 'POS_58' ? '0 2px' : '0 4px',
                fontSize: printFormat === 'POS_48' ? '0.54rem' : printFormat === 'POS_55' ? '0.58rem' : printFormat === 'POS_58' ? '0.64rem' : '0.73rem'
              }}
            >
              {/* Company & Location Header Directly on Receipt */}
              <div style={{ marginBottom: 8, textAlign: 'center' }}>
                {storeLogo && (
                  <div style={{ marginBottom: 4 }}>
                    <img 
                      src={storeLogo} 
                      alt="Store Logo" 
                      style={{ maxHeight: 42, maxWidth: 140, objectFit: 'contain' }} 
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <h2 style={{ fontSize: printFormat === 'POS_48' ? '0.92rem' : printFormat === 'POS_55' ? '0.98rem' : '1.15rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: '#000000' }}>
                  {storeName}
                </h2>
                {storeTagline && (
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.7rem', color: '#444444', fontStyle: 'italic' }}>
                    {storeTagline}
                  </p>
                )}
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', fontWeight: 600 }}>
                  {branchName}
                </p>
                {branchAddress && (
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: '#333333' }}>
                    {branchAddress}
                  </p>
                )}
                {branchPhone && (
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: '#333333' }}>
                    Tel: {branchPhone}
                  </p>
                )}
                {gstin && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', fontWeight: 700 }}>
                    GSTIN: {gstin}
                  </p>
                )}
              </div>

              {/* Dashed Separator */}
              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Consistent Invoice Number & Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: printFormat === 'POS_48' ? '0.64rem' : printFormat === 'POS_55' ? '0.68rem' : '0.74rem', fontWeight: 700, textAlign: 'left' }}>
                <span>Receipt: {activeInvoice.invoiceNumber}</span>
                <span>Date: {formatInvoiceDate(activeInvoice.date)}</span>
              </div>

              {/* Dashed Separator */}
              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Item Lines Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: printFormat === 'POS_48' ? '0.62rem' : printFormat === 'POS_55' ? '0.66rem' : '0.74rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #000000', fontWeight: 800, fontSize: printFormat === 'POS_48' ? '0.62rem' : printFormat === 'POS_55' ? '0.66rem' : '0.74rem' }}>
                    <th style={{ padding: '3px 0', textAlign: 'left', width: printFormat === 'POS_48' ? '36%' : printFormat === 'POS_55' ? '36%' : '44%' }}>ITEM</th>
                    <th style={{ padding: '3px 0', textAlign: 'center', width: printFormat === 'POS_48' ? '13%' : printFormat === 'POS_55' ? '13%' : '15%', whiteSpace: 'nowrap' }}>QTY</th>
                    <th style={{ padding: '3px 0', textAlign: 'right', width: printFormat === 'POS_48' ? '23%' : printFormat === 'POS_55' ? '23%' : '19%', whiteSpace: 'nowrap' }}>PRICE</th>
                    <th style={{ padding: '3px 0', textAlign: 'right', width: printFormat === 'POS_48' ? '28%' : printFormat === 'POS_55' ? '28%' : '22%', whiteSpace: 'nowrap', paddingRight: 0 }}>AMT</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map((line, idx) => {
                    const retQty = line.returnedQuantity ? Math.round(Number(line.returnedQuantity) * 1000) / 1000 : 0;
                    const hasRet = retQty > 0;
                    const activeQty = Math.max(0, Math.round((Number(line.quantity) - retQty) * 1000) / 1000);
                    const discPercent = Number(line.discountPercent || (line.discountType === 'PERCENT' ? line.discountValue : 0) || 0);
                    const discAmount = Number(line.discountAmount !== undefined ? line.discountAmount : (line.discountType === 'FLAT' ? line.discountValue : 0) || 0);
                    const origTotal = Number(line.originalTotal !== undefined ? line.originalTotal : (line.unitPrice * line.quantity));

                    const is100PctDisc = discPercent >= 100 || (discAmount > 0 && origTotal > 0 && discAmount >= origTotal);
                    const hasDisc = is100PctDisc || discAmount > 0 || discPercent > 0;
                    
                    const discLabel = is100PctDisc 
                      ? 'Disc: 100% OFF (FREE)'
                      : (line.discountType === 'FLAT' 
                          ? `Disc: -₹${(line.discountValue !== undefined ? line.discountValue : discAmount).toFixed(2)}`
                          : `Disc: ${line.discountValue !== undefined ? line.discountValue : discPercent}% (-₹${discAmount.toFixed(2)})`);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px dotted #e5e5e5' }}>
                        <td style={{ padding: '3px 0', fontWeight: 600, wordBreak: 'break-word' }}>
                          <div>{line.name}</div>
                          {hasDisc && (
                            <div style={{ fontSize: '0.64rem', color: '#047857', fontWeight: 600 }}>
                              🏷️ {discLabel}
                            </div>
                          )}
                          {hasRet && (
                            <div style={{ fontSize: '0.66rem', color: '#b91c1c', fontWeight: 700 }}>
                              [RET: {formatQty(retQty)} {line.returnReason === 'DEFECTIVE_DAMAGED' ? 'DEFECTIVE' : 'RETURN'}]
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '3px 0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {hasRet ? `${formatQty(activeQty)}/${formatQty(line.quantity)}` : formatQty(line.quantity)}
                        </td>
                        <td style={{ padding: '3px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {line.unitPrice.toFixed(2)}
                        </td>

                        <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', paddingRight: printFormat === 'POS_48' ? 0 : printFormat === 'POS_55' ? 0 : 2 }}>
                          {hasDisc && line.originalTotal !== undefined && Math.abs(line.originalTotal - line.total) > 0.01 && (
                            <div style={{ fontSize: '0.60rem', textDecoration: 'line-through', color: '#777777', fontWeight: 400, whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                              {line.originalTotal.toFixed(2)}
                            </div>
                          )}
                          <div style={{ whiteSpace: 'nowrap' }}>{line.total.toFixed(2)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Dashed Separator */}
              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Totals Breakdown */}
              <div style={{ fontSize: printFormat === 'POS_48' ? '0.64rem' : printFormat === 'POS_55' ? '0.68rem' : '0.74rem', lineHeight: 1.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#333333', fontWeight: 600 }}>
                  <span>Total Qty:</span>
                  <span>{formatQty(totalQuantity)}{returnedQuantitySum > 0 ? ` (Ret: ${formatQty(returnedQuantitySum)})` : ''}</span>
                </div>
                {activeInvoice.originalGrandTotal !== undefined && activeInvoice.originalGrandTotal > 0 && activeInvoice.originalGrandTotal !== activeInvoice.grandTotal ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666666' }}>
                    <span>Original Total:</span>
                    <span>₹{Number(activeInvoice.originalGrandTotal).toFixed(2)}</span>
                  </div>
                ) : null}
                {activeInvoice.returnTotal !== undefined && activeInvoice.returnTotal > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b91c1c' }}>
                    <span>Less Returns:</span>
                    <span>-₹{Number(activeInvoice.returnTotal).toFixed(2)}</span>
                  </div>
                ) : null}
                {/* <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Item Value (Actual):</span>
                  <span>₹{grossSubtotal.toFixed(2)}</span>
                </div> */}
                {itemDiscountsSum > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
                    <span>Item Discounts:</span>
                    <span>-₹{itemDiscountsSum.toFixed(2)}</span>
                  </div>
                )}
                {orderDiscountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#047857' }}>
                    <span>Order Discount:</span>
                    <span>-₹{orderDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderBottom: '1px dotted #dddddd', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable Value:</span>
                  <span>₹{activeInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>GST:</span>
                  <span>₹{activeInvoice.taxTotal.toFixed(2)}</span>
                </div>
                {activeInvoice.roundOff !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555555' }}>
                    <span>Round Off:</span>
                    <span>{activeInvoice.roundOff > 0 ? `+₹${activeInvoice.roundOff.toFixed(2)}` : `-₹${Math.abs(activeInvoice.roundOff).toFixed(2)}`}</span>
                  </div>
                )}
              </div>

              {/* Grand Total Bar */}
              <div style={{ 
                borderTop: '2px solid #000000', 
                borderBottom: '2px solid #000000', 
                padding: '5px 0', 
                margin: '6px 0',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                fontSize: printFormat === 'POS_48' ? '0.78rem' : printFormat === 'POS_55' ? '0.84rem' : '0.98rem', 
                fontWeight: 900 
              }}>
                <span style={{ whiteSpace: 'nowrap' }}>GRAND TOTAL:</span>
                <span style={{ whiteSpace: 'nowrap' }}>₹{activeInvoice.grandTotal.toFixed(2)}</span>
              </div>

              {/* Settlement Info */}
              <div style={{ fontSize: printFormat === 'POS_48' ? '0.64rem' : printFormat === 'POS_55' ? '0.68rem' : '0.73rem', lineHeight: 1.35 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Payment Mode:</span>
                  <span style={{ fontWeight: 700 }}>{activeInvoice.paymentMode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amount Paid:</span>
                  <span>₹{activeInvoice.paidAmount.toFixed(2)}</span>
                </div>
                {activeInvoice.balanceAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b91c1c' }}>
                    <span>Balance Due:</span>
                    <span>₹{activeInvoice.balanceAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Footer Notice */}
              <div style={{ borderTop: '1px dashed #000000', marginTop: 10, paddingTop: 6, textAlign: 'center', fontSize: printFormat === 'POS_48' ? '0.58rem' : printFormat === 'POS_55' ? '0.60rem' : printFormat === 'POS_58' ? '0.62rem' : '0.68rem', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <p style={{ margin: 0, fontWeight: 800 }}>*** THANK YOU FOR SHOPPING WITH US! ***</p>
                <p style={{ margin: '2px 0 0 0', color: '#555555' }}>{receiptFooter}</p>
              </div>
            </div>
          ) : (
            /* ========================================================
               A4 STANDARD TEMPLATE
               ======================================================== */
            <div>
              {/* A4 Header */}
              <div style={{ borderBottom: '2px solid var(--neutral-900)', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {storeLogo && (
                      <img 
                        src={storeLogo} 
                        alt="Store Logo" 
                        style={{ maxHeight: 54, maxWidth: 120, objectFit: 'contain' }} 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                        {storeName}
                      </h1>
                      {storeTagline && <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: '1px 0' }}>{storeTagline}</p>}
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--neutral-700)', marginTop: 2 }}>{branchName}</p>
                      {branchAddress && <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', margin: '1px 0' }}>{branchAddress}</p>}
                      {branchPhone && <p style={{ fontSize: '0.78rem', color: 'var(--neutral-600)', margin: '1px 0' }}>Tel: {branchPhone}</p>}
                      {gstin && <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-800)', marginTop: 2 }}>GSTIN: {gstin}</p>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.85rem' }}>
                      TAX INVOICE
                    </div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 6, margin: '4px 0 0 0' }}>{activeInvoice.invoiceNumber}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', margin: '2px 0 0 0' }}>Date: {formatInvoiceDate(activeInvoice.date)}</p>
                    {activeInvoice.hasReturns && (
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger-700)', margin: '2px 0 0 0' }}>
                        ⚠️ Has Item Returns
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--neutral-300)', textAlign: 'left', color: 'var(--neutral-600)', backgroundColor: 'var(--neutral-50)' }}>
                    <th style={{ padding: '7px 6px' }}>Item Details</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center' }}>Billed Qty</th>
                    <th style={{ padding: '7px 6px', textAlign: 'center' }}>Returned</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>Discount</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>Taxable Base</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>GST</th>
                    <th style={{ padding: '7px 6px', textAlign: 'right' }}>Net Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items.map((line, idx) => {
                    const retQty = line.returnedQuantity ? Math.round(Number(line.returnedQuantity) * 1000) / 1000 : 0;
                    const hasRet = retQty > 0;
                    const discPercent = Number(line.discountPercent || (line.discountType === 'PERCENT' ? line.discountValue : 0) || 0);
                    const discAmount = Number(line.discountAmount !== undefined ? line.discountAmount : (line.discountType === 'FLAT' ? line.discountValue : 0) || 0);
                    const origTotal = Number(line.originalTotal !== undefined ? line.originalTotal : (line.unitPrice * line.quantity));

                    const is100PctDisc = discPercent >= 100 || (discAmount > 0 && origTotal > 0 && discAmount >= origTotal);
                    const hasDisc = is100PctDisc || discAmount > 0 || discPercent > 0;
                    
                    const discLabel = is100PctDisc 
                      ? '100% (FREE)'
                      : (line.discountType === 'FLAT' 
                          ? `-₹${(line.discountValue !== undefined ? line.discountValue : discAmount).toFixed(2)}`
                          : `${line.discountValue !== undefined ? line.discountValue : discPercent}%`);

                    const lineTaxable = line.taxableAmount !== undefined 
                      ? line.taxableAmount 
                      : (line.taxRate > 0 && line.total > 0 ? line.total * 100 / (100 + line.taxRate) : (line.total === 0 ? 0 : line.total));
                    
                    const lineTaxAmt = line.taxAmount !== undefined
                      ? line.taxAmount
                      : Math.max(0, line.total - lineTaxable);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                        <td style={{ padding: '7px 6px', fontWeight: 600 }}>
                          <div>{line.name}</div>
                          {line.returnNote && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontWeight: 400 }}>
                              Note: {line.returnNote}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'center' }}>{formatQty(line.quantity)}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'center', color: hasRet ? 'var(--danger-700)' : 'var(--neutral-400)', fontWeight: hasRet ? 700 : 400 }}>
                          {hasRet ? `${formatQty(retQty)} (${line.returnReason === 'DEFECTIVE_DAMAGED' ? 'Defective' : 'Return'})` : '-'}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'right' }}>₹{line.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', color: hasDisc ? '#047857' : 'inherit', fontWeight: hasDisc ? 600 : 400 }}>
                          {hasDisc ? discLabel : '-'}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'right' }}>₹{lineTaxable.toFixed(2)}</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right' }}>
                          {line.taxRate > 0 ? `${line.taxRate}% (₹${lineTaxAmt.toFixed(2)})` : '0%'}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700 }}>
                          {hasDisc && line.originalTotal !== undefined && Math.abs(line.originalTotal - line.total) > 0.01 && (
                            <div style={{ fontSize: '0.70rem', textDecoration: 'line-through', color: 'var(--neutral-400)', fontWeight: 400 }}>
                              ₹{line.originalTotal.toFixed(2)}
                            </div>
                          )}
                          <div>₹{line.total.toFixed(2)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ borderTop: '2px solid var(--neutral-300)', fontWeight: 700, backgroundColor: 'var(--neutral-50)' }}>
                  <tr>
                    <td style={{ padding: '7px 6px' }}>Total Qty</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center' }}>{formatQty(totalQuantity)}</td>
                    <td style={{ padding: '7px 6px', textAlign: 'center', color: returnedQuantitySum > 0 ? 'var(--danger-700)' : 'var(--neutral-400)' }}>
                      {returnedQuantitySum > 0 ? formatQty(returnedQuantitySum) : '-'}
                    </td>
                    <td colSpan={4}></td>
                    <td style={{ padding: '7px 6px', textAlign: 'right' }}>₹{activeInvoice.grandTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Totals Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{ width: '310px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--neutral-700)', fontWeight: 600 }}>
                    <span>Total Qty:</span>
                    <span>{formatQty(totalQuantity)}</span>
                  </div>
                  {activeInvoice.originalGrandTotal !== undefined && activeInvoice.originalGrandTotal > 0 && activeInvoice.originalGrandTotal !== activeInvoice.grandTotal ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                      <span>Original Billed Total:</span>
                      <span>₹{Number(activeInvoice.originalGrandTotal).toFixed(2)}</span>
                    </div>
                  ) : null}
                  {activeInvoice.returnTotal !== undefined && activeInvoice.returnTotal > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--danger-700)', fontWeight: 700 }}>
                      <span>Less Returned Items:</span>
                      <span>-₹{Number(activeInvoice.returnTotal).toFixed(2)}</span>
                    </div>
                  ) : null}
                  {/* <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Total Item Value (Actual):</span>
                    <span>₹{grossSubtotal.toFixed(2)}</span>
                  </div> */}
                  {itemDiscountsSum > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: '#047857', fontWeight: 600 }}>
                      <span>Item Discounts:</span>
                      <span>-₹{itemDiscountsSum.toFixed(2)}</span>
                    </div>
                  )}
                  {orderDiscountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: '#047857', fontWeight: 600 }}>
                      <span>Order Discount:</span>
                      <span>-₹{orderDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ borderBottom: '1px dashed var(--neutral-300)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Taxable Subtotal (Ex-Tax):</span>
                    <span>₹{activeInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>GST:</span>
                    <span>₹{activeInvoice.taxTotal.toFixed(2)}</span>
                  </div>
                  {activeInvoice.roundOff !== 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: 'var(--neutral-500)' }}>
                      <span>Round Off:</span>
                      <span>{activeInvoice.roundOff > 0 ? `+₹${activeInvoice.roundOff.toFixed(2)}` : `-₹${Math.abs(activeInvoice.roundOff).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid var(--neutral-900)', borderBottom: '2px solid var(--neutral-900)', marginTop: 4, fontWeight: 800, fontSize: '1rem' }}>
                    <span>Net Grand Total:</span>
                    <span style={{ color: 'var(--primary-600)' }}>₹{activeInvoice.grandTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', marginTop: 4 }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Payment Mode:</span>
                    <span style={{ fontWeight: 700 }}>{activeInvoice.paymentMode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--neutral-600)' }}>Paid:</span>
                    <span>₹{activeInvoice.paidAmount.toFixed(2)}</span>
                  </div>
                  {activeInvoice.balanceAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger-600)' }}>
                      <span>Balance Due:</span>
                      <span>₹{activeInvoice.balanceAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Terms */}
              <div style={{ textAlign: 'center', borderTop: '1px dashed var(--neutral-300)', paddingTop: 10, marginTop: 12 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-700)', margin: 0 }}>
                  Thank you for your business!
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                  {receiptFooter}
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Customer Phone Prompt for WhatsApp Share */}
        {showPhonePrompt && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000,
              padding: 16
            }}
            onClick={() => setShowPhonePrompt(false)}
          >
            <div 
              style={{
                maxWidth: 420,
                width: '100%',
                backgroundColor: '#ffffff',
                borderRadius: 16,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                padding: '24px 20px',
                border: '1px solid #e2e8f0',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                    <Share2 size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Send via WhatsApp</h3>
                    <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>Bill #{activeInvoice.invoiceNumber}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPhonePrompt(false)}
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 16, lineHeight: 1.45 }}>
                Enter the customer's WhatsApp mobile number. QuickBill will link this invoice, save the phone, and auto-register them in your CRM if they are a new customer.
              </p>

              {phoneError && (
                <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: '0.78rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={15} />
                  <span>{phoneError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmAttachAndShare}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 6, textTransform: 'uppercase' }}>
                    Customer Mobile Number *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff' }}>
                    <span style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderRight: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                      +91
                    </span>
                    <input 
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      maxLength={14}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="98765 43210"
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        padding: '10px 12px',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: '#0f172a'
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 6, textTransform: 'uppercase' }}>
                    Customer Name (Optional)
                  </label>
                  <input 
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '9px 12px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPhonePrompt(false)}
                    disabled={isAttaching}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isAttaching}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: isAttaching ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    {isAttaching ? (
                      <>
                        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Saving &amp; Opening...</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Save &amp; Open WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

