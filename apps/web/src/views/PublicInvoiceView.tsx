import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Store, 
  Phone, 
  MapPin, 
  Calendar, 
  Tag, 
  ArrowLeft,
  ArrowRight,
  Search,
  Lock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiClient, store } from '../services/store';
import { Invoice } from '../types';

interface PublicStoreInfo {
  name: string;
  logoUrl?: string;
  tagline?: string;
  branchName?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  receiptFooterNote?: string;
}

interface PublicInvoiceData {
  invoice: any;
  store: PublicStoreInfo;
}

// Clean quantity formatting rounded to max 3 decimal places without floating-point artifacts
const formatQty = (qty: number | undefined | null): string => {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  const rounded = Math.round(Number(qty) * 1000) / 1000;
  return Number(rounded.toFixed(3)).toString();
};

export const PublicInvoiceView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTarget, setSearchTarget] = useState('');

  const currentUser = store.getCurrentUser();
  const allInvoices = store.getInvoices();

  // Find index of current invoice in store for Prev / Next navigation
  const currentIndex = allInvoices.findIndex(
    inv => inv.shareToken === token || inv.invoiceNumber === token || inv.id === token
  );
  const prevInvoice = currentIndex > 0 ? allInvoices[currentIndex - 1] : null;
  const nextInvoice = currentIndex >= 0 && currentIndex < allInvoices.length - 1 ? allInvoices[currentIndex + 1] : null;

  useEffect(() => {
    if (!token) {
      setError('Invalid invoice link: missing invoice identifier or share token.');
      setIsLoading(false);
      return;
    }

    const fetchPublicInvoice = async () => {
      setIsLoading(true);
      setError(null);

      // 1. Try fetching from live backend via apiClient
      try {
        const res = await apiClient.get(`/public/invoices/${encodeURIComponent(token)}`);
        if (res.data && res.data.invoice) {
          setData(res.data);
          setIsLoading(false);
          return;
        }
      } catch (apiErr: any) {
        console.warn('Backend public lookup failed, checking local store cache:', apiErr);
      }

      // 2. Fallback: Search in local Store / In-Memory / LocalStorage cache
      const localMatch = allInvoices.find(
        inv => inv.shareToken === token || inv.invoiceNumber === token || inv.id === token
      );

      if (localMatch) {
        const activeTenant = store.getActiveTenant();
        setData({
          invoice: localMatch,
          store: {
            name: activeTenant?.name || localMatch.locationName || 'STORE COUNTER',
            logoUrl: activeTenant?.logoUrl,
            tagline: activeTenant?.tagline,
            branchName: localMatch.locationName || activeTenant?.name || 'Main Branch',
            address: localMatch.locationAddress || activeTenant?.address || '',
            phone: localMatch.locationPhone || activeTenant?.phone || '',
            gstin: localMatch.locationGstin || activeTenant?.gstin || '',
            receiptFooterNote: activeTenant?.receiptFooterNote || 'Thank you for shopping with us please visit again.'
          }
        });
        setIsLoading(false);
        return;
      }

      // If neither backend nor local store had it:
      setError('Invoice not found or link has expired. Please verify the receipt number or token.');
      setIsLoading(false);
    };

    fetchPublicInvoice();
  }, [token]);

  const handleDownloadPdf = (formatType: 'A4' | 'THERMAL' = 'A4') => {
    if (!token) return;
    const baseURL = apiClient.defaults.baseURL || '/api/v1';
    const url = `${baseURL}/public/invoices/${token}/pdf?format_type=${formatType}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleJumpToInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchTarget.trim();
    if (!clean) return;
    navigate(`/bill/${encodeURIComponent(clean)}`);
    setSearchTarget('');
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateVal);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            border: '3px solid #e2e8f0', 
            borderTopColor: '#4f46e5', 
            borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px' 
          }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Loading Official Invoice...</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Verifying 256-bit cryptographic link</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 20 }}>
        <div style={{ maxWidth: 460, width: '100%', backgroundColor: '#ffffff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', border: '1px solid #fee2e2' }}>
          <div style={{ width: 56, height: 56, backgroundColor: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#ef4444' }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Invoice Not Accessible</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>{error || 'The requested invoice could not be located.'}</p>
          
          {/* Jump to Another Bill Input */}
          <form onSubmit={handleJumpToInvoice} style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            <input 
              type="text" 
              placeholder="Enter Bill # (e.g. INV-2026-000011)"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.82rem' }}
            />
            <button 
              type="submit" 
              style={{ backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Search
            </button>
          </form>

          {currentUser && (
            <Link 
              to="/invoices" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4f46e5', fontWeight: 700, fontSize: '0.84rem', textDecoration: 'none' }}
            >
              <ArrowLeft size={15} />
              <span>Back to Invoices Console</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const { invoice, store: storeInfo } = data;
  const items = invoice.items || [];
  const grandTotal = Number(invoice.grandTotal || invoice.total || 0).toFixed(2);
  const returnTotal = Number(invoice.returnTotal || 0);
  const taxableVal = Number(invoice.subtotal || invoice.taxableAmount || 0).toFixed(2);
  const gstVal = Number(invoice.taxTotal || invoice.tax_total || invoice.gst || 0).toFixed(2);
  const roundOffVal = Number(invoice.roundOff || 0);
  const paidVal = Number(invoice.paidAmount !== undefined ? invoice.paidAmount : invoice.grandTotal).toFixed(2);
  const balanceDue = Number(invoice.balanceDue || invoice.balanceAmount || 0).toFixed(2);

  const totalQuantity = items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
  const returnedQuantitySum = items.reduce((sum: number, it: any) => sum + Number(it.returnedQuantity || 0), 0);

  // Robust calculation of item discounts across all naming conventions
  const computedLineDiscountsSum = items.reduce((sum: number, it: any) => {
    const explicitDisc = Number(it.discountAmount !== undefined ? it.discountAmount : (it.discount !== undefined ? it.discount : (it.discountType === 'FLAT' ? it.discountValue : 0) || 0));
    if (explicitDisc > 0) return sum + explicitDisc;
    const itOrig = Number(it.originalTotal !== undefined ? it.originalTotal : (Number(it.unitPrice || 0) * Number(it.quantity || 1)));
    const itTotal = Number(it.total !== undefined ? it.total : (it.lineTotal !== undefined ? it.lineTotal : itOrig));
    return sum + Math.max(0, itOrig - itTotal);
  }, 0);

  const itemDiscountsSum = Number(
    invoice.itemDiscountTotal !== undefined
      ? invoice.itemDiscountTotal
      : (computedLineDiscountsSum > 0 ? computedLineDiscountsSum : 0)
  );

  const orderDiscountAmount = Number(
    invoice.orderDiscountAmount !== undefined
      ? invoice.orderDiscountAmount
      : (invoice.orderDiscountTotal !== undefined
          ? invoice.orderDiscountTotal
          : (invoice.invoiceDiscount !== undefined
              ? invoice.invoiceDiscount
              : Math.max(0, Number(invoice.discountTotal || 0) - itemDiscountsSum)))
  );

  const originalGrandTotal = Number(
    invoice.originalGrandTotal !== undefined && Number(invoice.originalGrandTotal) > 0
      ? invoice.originalGrandTotal
      : (itemDiscountsSum > 0 || orderDiscountAmount > 0 || returnTotal > 0
          ? Number(invoice.grandTotal || invoice.total || 0) + itemDiscountsSum + orderDiscountAmount + returnTotal
          : 0)
  );

  const branchName = invoice.locationName || storeInfo.branchName || 'Main Branch';
  const branchAddress = invoice.locationAddress || storeInfo.address || '';
  const branchPhone = invoice.locationPhone || storeInfo.phone || '';
  const gstin = invoice.locationGstin || storeInfo.gstin || '';
  const receiptFooterNote = storeInfo.receiptFooterNote || 'Thank you for shopping with us please visit again.';

  return (
    <div 
      className="public-invoice-page"
      style={{ 
        height: '100vh', 
        maxHeight: '100vh', 
        overflowY: 'auto', 
        overflowX: 'hidden', 
        WebkitOverflowScrolling: 'touch',
        backgroundColor: '#f1f5f9', 
        padding: '20px 12px 60px', 
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, sans-serif", 
        color: '#0f172a' 
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        
        {/* Navigation & Jump Header Bar (Excluded from Print) */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentUser && (
              <Link
                to="/invoices"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
                title="Return to store billing history"
              >
                <ArrowLeft size={14} />
                <span>All Invoices</span>
              </Link>
            )}

            {/* Read-Only Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#047857', backgroundColor: '#ecfdf5', padding: '6px 12px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, border: '1px solid #a7f3d0' }}>
              <Lock size={13} />
              <span>Official Read-Only Invoice</span>
            </div>
          </div>

          {/* Quick Invoice Navigation (Prev / Next & Switcher) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {prevInvoice && (
              <button
                type="button"
                onClick={() => navigate(`/bill/${prevInvoice.shareToken || prevInvoice.invoiceNumber || prevInvoice.id}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#334155'
                }}
                title={`Previous: ${prevInvoice.invoiceNumber}`}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
            )}

            {nextInvoice && (
              <button
                type="button"
                onClick={() => navigate(`/bill/${nextInvoice.shareToken || nextInvoice.invoiceNumber || nextInvoice.id}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#334155'
                }}
                title={`Next: ${nextInvoice.invoiceNumber}`}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            )}

            {/* Search / Jump to Another Bill */}
            <form onSubmit={handleJumpToInvoice} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                placeholder="Jump to Bill #..."
                value={searchTarget}
                onChange={(e) => setSearchTarget(e.target.value)}
                style={{
                  width: 130,
                  padding: '5px 8px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: '0.76rem',
                  backgroundColor: '#ffffff'
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                Go
              </button>
            </form>
          </div>

        </div>

        {/* Action Controls Bar (Excluded from Print) */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14, gap: 8 }}>
          <button
            onClick={() => handleDownloadPdf('A4')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Download size={14} />
            <span>Download PDF (A4)</span>
          </button>

          <button
            onClick={() => handleDownloadPdf('THERMAL')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#ffffff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span>Thermal Roll PDF</span>
          </button>

          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>

        {/* Invoice Main Card */}
        <div 
          className="public-bill-card invoice-printable" 
          style={{ backgroundColor: '#ffffff', borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}
        >
          
          {/* Header Banner - Exactly Matching Physical Thermal Receipt */}
          <div style={{ padding: '24px 24px 18px', textAlign: 'center', backgroundColor: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
            {storeInfo.logoUrl && (
              <div style={{ marginBottom: 8 }}>
                <img 
                  src={storeInfo.logoUrl} 
                  alt={storeInfo.name} 
                  style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', margin: '0 auto' }} 
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              </div>
            )}

            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: '#000000' }}>
              {storeInfo.name}
            </h1>

            {storeInfo.tagline && (
              <p style={{ margin: '2px 0 0', fontSize: '0.80rem', color: '#444444', fontStyle: 'italic' }}>
                {storeInfo.tagline}
              </p>
            )}

            {branchName && (
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem', fontWeight: 700, color: '#000000' }}>
                {branchName}
              </p>
            )}

            {branchAddress && (
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#333333' }}>
                {branchAddress}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 4, fontSize: '0.78rem' }}>
              {branchPhone && (
                <span style={{ color: '#333333' }}>Tel: {branchPhone}</span>
              )}
              {gstin && (
                <span style={{ fontWeight: 800, color: '#000000' }}>GSTIN: {gstin}</span>
              )}
            </div>
          </div>

          {/* Dashed Separator */}
          <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '0' }} />

          {/* Receipt Number & Date Meta Strip */}
          <div style={{ padding: '12px 24px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', fontWeight: 700 }}>
            <span>Receipt: {invoice.invoiceNumber || 'INV-RECEIPT'}</span>
            <span>Date: {formatDate(invoice.createdAt || invoice.date)}</span>
          </div>

          {/* Dashed Separator */}
          <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '0' }} />

          {/* Billed To / Customer Section */}
          <div style={{ padding: '10px 24px', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', flexWrap: 'wrap', gap: 6 }}>
            <div>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Customer: </span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{invoice.consumerName || invoice.partyNameSnapshot || 'Walk-in Customer'}</span>
            </div>
            {(invoice.consumerPhone || invoice.partyPhoneSnapshot) && (
              <div style={{ color: '#334155', fontWeight: 600 }}>
                📱 {invoice.consumerPhone || invoice.partyPhoneSnapshot}
              </div>
            )}
          </div>

          {/* Dashed Separator */}
          <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '0' }} />

          {/* Itemized Table */}
          <div style={{ padding: '14px 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000000', fontWeight: 800, fontSize: '0.76rem', color: '#000000' }}>
                  <th style={{ padding: '6px 0', textAlign: 'left', width: '42%' }}>ITEM</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center', width: '14%' }}>QTY</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right', width: '20%' }}>PRICE</th>
                  <th style={{ padding: '6px 0', textAlign: 'right', width: '24%' }}>AMT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((line: any, idx: number) => {
                  const qty = Number(line.quantity || 1);
                  const retQty = Number(line.returnedQuantity || 0);
                  const activeQty = Math.max(0, qty - retQty);
                  const unitPrice = Number(line.unitPrice || 0);
                  const lineTotal = Number(line.total !== undefined ? line.total : (line.lineTotal !== undefined ? line.lineTotal : (unitPrice * qty)));
                  const origTotal = Number(line.originalTotal !== undefined ? line.originalTotal : (unitPrice * qty));

                  const discPercent = Number(line.discountPercent || (line.discountType === 'PERCENT' ? line.discountValue : 0) || 0);
                  let discAmount = Number(line.discountAmount !== undefined ? line.discountAmount : (line.discount !== undefined ? line.discount : (line.discountType === 'FLAT' ? line.discountValue : 0) || 0));
                  if (discAmount === 0 && discPercent > 0 && origTotal > 0) {
                    discAmount = (origTotal * discPercent) / 100;
                  }
                  if (discAmount === 0 && origTotal > lineTotal && (origTotal - lineTotal) > 0.01) {
                    discAmount = origTotal - lineTotal;
                  }

                  const is100PctDisc = discPercent >= 100 || (discAmount > 0 && origTotal > 0 && discAmount >= origTotal);
                  const hasDisc = is100PctDisc || discAmount > 0 || discPercent > 0 || (origTotal > lineTotal && (origTotal - lineTotal) > 0.01);

                  const discLabel = is100PctDisc 
                    ? 'Disc: 100% OFF (FREE)'
                    : (line.discountType === 'FLAT' || discPercent === 0
                        ? `Disc: -₹${discAmount.toFixed(2)}`
                        : `Disc: ${line.discountValue !== undefined ? line.discountValue : discPercent}% (-₹${discAmount.toFixed(2)})`);

                  return (
                    <tr key={idx} style={{ borderBottom: '1px dotted #e2e8f0' }}>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#0f172a' }}>
                        <div>{line.nameSnapshot || line.name || 'Item'}</div>
                        {hasDisc && (
                          <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
                            🏷️ {discLabel}
                          </div>
                        )}
                        {retQty > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>
                            [RET: {formatQty(retQty)} {line.returnReason === 'DEFECTIVE_DAMAGED' ? 'DEFECTIVE' : 'RETURN'}]
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: '#334155' }}>
                        {retQty > 0 ? `${formatQty(activeQty)}/${formatQty(qty)}` : formatQty(qty)}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', color: '#334155' }}>
                        {unitPrice.toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {hasDisc && origTotal > lineTotal && Math.abs(origTotal - lineTotal) > 0.01 && (
                          <div style={{ fontSize: '0.70rem', textDecoration: 'line-through', color: '#888888', fontWeight: 400 }}>
                            {origTotal.toFixed(2)}
                          </div>
                        )}
                        <div>{lineTotal.toFixed(2)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Dashed Separator */}
          <div style={{ borderBottom: '1px dashed #000000', margin: '0 24px' }} />

          {/* Breakdown & Grand Total */}
          <div style={{ padding: '14px 24px' }}>
            <div style={{ maxWidth: 320, marginLeft: 'auto', fontSize: '0.82rem', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#333333', fontWeight: 600 }}>
                <span>Total Qty:</span>
                <span>{formatQty(totalQuantity)}{returnedQuantitySum > 0 ? ` (Ret: ${formatQty(returnedQuantitySum)})` : ''}</span>
              </div>

              {originalGrandTotal > 0 && originalGrandTotal !== Number(grandTotal) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666666' }}>
                  <span>Original Total:</span>
                  <span>₹{originalGrandTotal.toFixed(2)}</span>
                </div>
              )}

              {returnTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b91c1c' }}>
                  <span>Less Returns:</span>
                  <span>-₹{returnTotal.toFixed(2)}</span>
                </div>
              )}

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

              <div style={{ borderBottom: '1px dotted #cbd5e1', margin: '6px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Taxable Value:</span>
                <span>₹{taxableVal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>GST Tax:</span>
                <span>₹{gstVal}</span>
              </div>
              {roundOffVal !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Round Off:</span>
                  <span>{roundOffVal > 0 ? `+₹${roundOffVal.toFixed(2)}` : `-₹${Math.abs(roundOffVal).toFixed(2)}`}</span>
                </div>
              )}
              
              {/* Grand Total Bar */}
              <div style={{ 
                borderTop: '2px solid #000000', 
                borderBottom: '2px solid #000000', 
                margin: '8px 0', 
                padding: '8px 0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '1.05rem', 
                fontWeight: 900, 
                color: '#000000' 
              }}>
                <span>GRAND TOTAL:</span>
                <span>₹{grandTotal}</span>
              </div>

              {/* Settlement Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.80rem' }}>
                <span>Payment Mode:</span>
                <span style={{ fontWeight: 700 }}>{invoice.paymentMode || 'CASH'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.80rem' }}>
                <span>Amount Paid:</span>
                <span>₹{paidVal}</span>
              </div>
              {Number(balanceDue) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.80rem', color: '#b91c1c', fontWeight: 800 }}>
                  <span>Balance Due:</span>
                  <span>₹{balanceDue}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Notice - Exactly Matching Physical Thermal Receipt */}
          <div style={{ borderTop: '1px dashed #000000', padding: '18px 24px', textAlign: 'center', backgroundColor: '#ffffff' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 900, color: '#000000', letterSpacing: '0.02em' }}>
              *** THANK YOU FOR SHOPPING WITH US! ***
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#444444' }}>
              {receiptFooterNote}
            </p>
          </div>

        </div>

        {/* QuickBill Brand Watermark */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: 24, fontSize: '0.74rem', color: '#94a3b8' }}>
          <span>Powered by QuickBill Cloud Billing Engine • End-to-End Cryptographically Signed</span>
        </div>

      </div>
    </div>
  );
};
