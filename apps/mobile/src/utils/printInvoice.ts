import * as Print from 'expo-print';
import { Invoice, Business } from '../types';
import { store } from '../services/store';

// Clean quantity formatting rounded to max 3 decimal places without floating-point artifacts
const formatQty = (qty: number | undefined | null): string => {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  const rounded = Math.round(Number(qty) * 1000) / 1000;
  return Number(rounded.toFixed(3)).toString();
};

// Formats invoice date into DD/MM/YYYY format matching web bill
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

// Resolves branding hierarchy identically to web InvoicePrintModal
function resolveInvoiceBranding(invoice: Invoice, business?: Business) {
  const profile = business || store.getBusinessProfile();
  const activeLoc = store.getActiveLocation();
  const allLocations = store.getLocations();
  const branchLocation = allLocations.find(l => l.id === invoice.locationId || l.name === invoice.locationName);

  const storeName = profile.name || store.getActiveUser()?.tenantName || 'STORE COUNTER';
  const storeLogo = profile.logoUrl;
  const storeTagline = profile.tagline;
  const receiptFooter = profile.receiptFooterNote || 'Please keep this receipt for future reference';
  const branchName = invoice.locationName || branchLocation?.name || activeLoc?.name || 'Main Branch';
  const branchAddress = invoice.locationAddress || branchLocation?.address || activeLoc?.address || profile.address || '';
  const branchPhone = invoice.locationPhone || branchLocation?.phone || activeLoc?.phone || profile.phone || '';
  const gstin = invoice.locationGstin || branchLocation?.gstin || (invoice.locationId === activeLoc?.id ? activeLoc?.gstin : undefined) || profile.gstin || '';

  return {
    storeName,
    storeLogo,
    storeTagline,
    receiptFooter,
    branchName,
    branchAddress,
    branchPhone,
    gstin,
  };
}

/**
 * Standard Thermal POS Template (80mm) - 1:1 Pixel & Behavioral Parity with Web Bill
 */
export function generateThermalReceiptHtml(invoice: Invoice, business?: Business): string {
  const branding = resolveInvoiceBranding(invoice, business);

  const itemDiscountsSum = invoice.itemDiscountTotal !== undefined
    ? invoice.itemDiscountTotal
    : (invoice.items || []).reduce((sum, it) => sum + (it.discountAmount || 0), 0);

  const orderDiscountAmount = invoice.orderDiscountAmount !== undefined
    ? invoice.orderDiscountAmount
    : (invoice.invoiceDiscount !== undefined ? invoice.invoiceDiscount : Math.max(0, (invoice.discountTotal || 0) - itemDiscountsSum));

  const totalQuantity = (invoice.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const returnedQuantitySum = (invoice.items || []).reduce((sum, it) => sum + (Number(it.returnedQuantity) || 0), 0);

  const itemsRowsHtml = invoice.items.map((line) => {
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

    return `
      <tr style="border-bottom: 1px dotted #e5e5e5;">
        <td style="padding: 3px 0; font-weight: 600; word-break: break-word;">
          <div>${line.name}</div>
          ${hasDisc ? `
            <div style="font-size: 0.64rem; color: #047857; font-weight: 600;">
              🏷️ ${discLabel}
            </div>
          ` : ''}
          ${hasRet ? `
            <div style="font-size: 0.66rem; color: #b91c1c; font-weight: 700;">
              [RET: ${formatQty(retQty)} ${line.returnReason === 'DEFECTIVE_DAMAGED' ? 'DEFECTIVE' : 'RETURN'}]
            </div>
          ` : ''}
        </td>
        <td style="padding: 3px 0; text-align: center;">
          ${hasRet ? `${formatQty(activeQty)}/${formatQty(line.quantity)}` : formatQty(line.quantity)}
        </td>
        <td style="padding: 3px 0; text-align: right;">
          ${line.unitPrice.toFixed(2)}
        </td>
        <td style="padding: 3px 0; text-align: right; font-weight: 700;">
          ${hasDisc && line.originalTotal !== undefined && Math.abs(line.originalTotal - line.total) > 0.01 ? `
            <div style="font-size: 0.62rem; text-decoration: line-through; color: #777777; font-weight: 400;">
              ${line.originalTotal.toFixed(2)}
            </div>
          ` : ''}
          <div>${line.total.toFixed(2)}</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 76mm;
            margin: 0 auto;
            padding: 10px 6px;
            font-size: 11px;
            color: #000000;
            background: #ffffff;
            line-height: 1.4;
          }
          .center { text-align: center; }
          .dashed-divider { border-bottom: 1px dashed #000000; margin: 6px 0; }
          .dotted-divider { border-bottom: 1px dotted #dddddd; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; }
          .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
          .grand-total-bar {
            border-top: 2px solid #000000;
            border-bottom: 2px solid #000000;
            padding: 5px 0;
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 900;
          }
          .return-pill {
            margin-top: 4px;
            padding: 2px 6px;
            background-color: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.25);
            border-radius: 4px;
            font-size: 10px;
            font-weight: 800;
            color: #b91c1c;
            text-align: center;
          }
          .footer {
            border-top: 1px dashed #000000;
            margin-top: 10px;
            padding-top: 6px;
            text-align: center;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <!-- Company & Location Header Directly on Receipt -->
        <div class="center" style="margin-bottom: 8px;">
          ${branding.storeLogo ? `
            <div style="margin-bottom: 4px;">
              <img 
                src="${branding.storeLogo}" 
                alt="Store Logo" 
                style="max-height: 42px; max-width: 140px; object-fit: contain;" 
              />
            </div>
          ` : ''}
          <h2 style="font-size: 1.15rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; color: #000000;">
            ${branding.storeName}
          </h2>
          ${branding.storeTagline ? `
            <p style="margin: 1px 0 0 0; font-size: 0.7rem; color: #444444; font-style: italic;">
              ${branding.storeTagline}
            </p>
          ` : ''}
          <p style="margin: 2px 0 0 0; font-size: 0.78rem; font-weight: 600;">
            ${branding.branchName}
          </p>
          ${branding.branchAddress ? `
            <p style="margin: 1px 0 0 0; font-size: 0.72rem; color: #333333;">
              ${branding.branchAddress}
            </p>
          ` : ''}
          ${branding.branchPhone ? `
            <p style="margin: 1px 0 0 0; font-size: 0.72rem; color: #333333;">
              Tel: ${branding.branchPhone}
            </p>
          ` : ''}
          ${branding.gstin ? `
            <p style="margin: 2px 0 0 0; font-size: 0.72rem; font-weight: 700;">
              GSTIN: ${branding.gstin}
            </p>
          ` : ''}
        </div>

        <div class="dashed-divider"></div>

        <!-- Receipt Number & Date -->
        <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 700; text-align: left;">
          <span>Receipt: ${invoice.invoiceNumber}</span>
          <span>Date: ${formatInvoiceDate(invoice.date)}</span>
        </div>

        ${invoice.partyName ? `
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #333333; margin-top: 2px; text-align: left;">
            <span>Customer: <b>${invoice.partyName}</b></span>
            ${invoice.partyPhone ? `<span>${invoice.partyPhone}</span>` : ''}
          </div>
        ` : ''}

        ${invoice.hasReturns ? `
          <div class="return-pill">
            🔄 ${invoice.status === 'RETURNED' || invoice.returnStatus === 'FULLY_RETURNED' ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
          </div>
        ` : ''}

        <div class="dashed-divider"></div>

        <!-- Item Lines Table -->
        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000000; font-weight: 800;">
              <th style="padding: 3px 0; width: 50%;">ITEM</th>
              <th style="padding: 3px 0; text-align: center; width: 15%;">QTY</th>
              <th style="padding: 3px 0; text-align: right; width: 15%;">PRICE</th>
              <th style="padding: 3px 0; text-align: right; width: 20%;">AMT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <div class="dashed-divider"></div>

        <!-- Totals Breakdown -->
        <div style="font-size: 0.74rem; line-height: 1.45;">
          <div class="row" style="color: #333333; font-weight: 600;">
            <span>Total Qty:</span>
            <span>${formatQty(totalQuantity)}${returnedQuantitySum > 0 ? ` (Ret: ${formatQty(returnedQuantitySum)})` : ''}</span>
          </div>

          ${invoice.originalGrandTotal !== undefined && invoice.originalGrandTotal > 0 && invoice.originalGrandTotal !== invoice.grandTotal ? `
            <div class="row" style="color: #666666;">
              <span>Original Total:</span>
              <span>₹${Number(invoice.originalGrandTotal).toFixed(2)}</span>
            </div>
          ` : ''}

          ${invoice.returnTotal !== undefined && invoice.returnTotal > 0 ? `
            <div class="row" style="font-weight: 700; color: #b91c1c;">
              <span>Less Returns:</span>
              <span>-₹${Number(invoice.returnTotal).toFixed(2)}</span>
            </div>
          ` : ''}

          ${itemDiscountsSum > 0 ? `
            <div class="row" style="color: #047857;">
              <span>Item Discounts:</span>
              <span>-₹${itemDiscountsSum.toFixed(2)}</span>
            </div>
          ` : ''}

          ${orderDiscountAmount > 0 ? `
            <div class="row" style="font-weight: 700; color: #047857;">
              <span>Order Discount:</span>
              <span>-₹${orderDiscountAmount.toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="dotted-divider"></div>

          <div class="row">
            <span>Taxable Value:</span>
            <span>₹${invoice.subtotal.toFixed(2)}</span>
          </div>

          <div class="row">
            <span>GST:</span>
            <span>₹${invoice.taxTotal.toFixed(2)}</span>
          </div>

          ${invoice.roundOff !== 0 ? `
            <div class="row" style="color: #555555;">
              <span>Round Off:</span>
              <span>${invoice.roundOff > 0 ? `+₹${invoice.roundOff.toFixed(2)}` : `-₹${Math.abs(invoice.roundOff).toFixed(2)}`}</span>
            </div>
          ` : ''}
        </div>

        <!-- Grand Total Bar -->
        <div class="grand-total-bar">
          <span>GRAND TOTAL:</span>
          <span>₹${invoice.grandTotal.toFixed(2)}</span>
        </div>

        <!-- Settlement Info -->
        <div style="font-size: 0.73rem; line-height: 1.35;">
          <div class="row">
            <span>Payment Mode:</span>
            <span style="font-weight: 700;">${invoice.paymentMode}</span>
          </div>
          <div class="row">
            <span>Amount Paid:</span>
            <span>₹${invoice.paidAmount.toFixed(2)}</span>
          </div>
          ${invoice.balanceAmount > 0 ? `
            <div class="row" style="font-weight: 700; color: #b91c1c;">
              <span>Balance Due:</span>
              <span>₹${invoice.balanceAmount.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Footer Notice -->
        <div class="footer">
          <p style="margin: 0; font-weight: 800;">*** THANK YOU FOR SHOPPING WITH US! ***</p>
          <p style="margin: 2px 0 0 0; color: #555555;">${branding.receiptFooter}</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Standard A4 Tax Invoice Template - 1:1 Parity with Web Bill
 */
export function generateA4InvoiceHtml(invoice: Invoice, business?: Business): string {
  const branding = resolveInvoiceBranding(invoice, business);

  const itemDiscountsSum = invoice.itemDiscountTotal !== undefined
    ? invoice.itemDiscountTotal
    : (invoice.items || []).reduce((sum, it) => sum + (it.discountAmount || 0), 0);

  const orderDiscountAmount = invoice.orderDiscountAmount !== undefined
    ? invoice.orderDiscountAmount
    : (invoice.invoiceDiscount !== undefined ? invoice.invoiceDiscount : Math.max(0, (invoice.discountTotal || 0) - itemDiscountsSum));

  const totalQuantity = (invoice.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const returnedQuantitySum = (invoice.items || []).reduce((sum, it) => sum + (Number(it.returnedQuantity) || 0), 0);

  const rowsHtml = invoice.items.map((line, idx) => {
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

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 7px 6px; font-weight: 600;">
          <div>${line.name}</div>
          ${line.returnNote ? `
            <div style="font-size: 0.72rem; color: #64748b; font-weight: 400;">
              Note: ${line.returnNote}
            </div>
          ` : ''}
        </td>
        <td style="padding: 7px 6px; text-align: center;">${formatQty(line.quantity)}</td>
        <td style="padding: 7px 6px; text-align: center; color: ${hasRet ? '#b91c1c' : '#94a3b8'}; font-weight: ${hasRet ? 700 : 400};">
          ${hasRet ? `${formatQty(retQty)} (${line.returnReason === 'DEFECTIVE_DAMAGED' ? 'Defective' : 'Return'})` : '-'}
        </td>
        <td style="padding: 7px 6px; text-align: right;">₹${line.unitPrice.toFixed(2)}</td>
        <td style="padding: 7px 6px; text-align: right; color: ${hasDisc ? '#047857' : 'inherit'}; font-weight: ${hasDisc ? 600 : 400};">
          ${hasDisc ? discLabel : '-'}
        </td>
        <td style="padding: 7px 6px; text-align: right;">₹${lineTaxable.toFixed(2)}</td>
        <td style="padding: 7px 6px; text-align: right;">
          ${line.taxRate > 0 ? `${line.taxRate}% (₹${lineTaxAmt.toFixed(2)})` : '0%'}
        </td>
        <td style="padding: 7px 6px; text-align: right; font-weight: 700;">
          ${hasDisc && line.originalTotal !== undefined && Math.abs(line.originalTotal - line.total) > 0.01 ? `
            <div style="font-size: 0.70rem; text-decoration: line-through; color: #94a3b8; font-weight: 400;">
              ₹${line.originalTotal.toFixed(2)}
            </div>
          ` : ''}
          <div>₹${line.total.toFixed(2)}</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 16px;
            font-size: 13px;
            line-height: 1.4;
          }
          .header {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .invoice-badge {
            display: inline-block;
            background-color: #eef2ff;
            color: #4338ca;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 0.85rem;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 0.82rem; }
          th {
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
            color: #475569;
            background-color: #f8fafc;
            padding: 7px 6px;
            font-size: 0.75rem;
            text-transform: uppercase;
          }
          .totals-wrapper {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 14px;
          }
          .totals-box {
            width: 320px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 0.82rem;
            color: #334155;
          }
          .net-total-bar {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            margin-top: 4px;
            font-weight: 800;
            font-size: 1rem;
          }
          .footer-terms {
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            margin-top: 14px;
          }
        </style>
      </head>
      <body>
        <!-- A4 Header -->
        <div class="header">
          <div style="display: flex; align-items: flex-start; gap: 14px;">
            ${branding.storeLogo ? `
              <img 
                src="${branding.storeLogo}" 
                alt="Store Logo" 
                style="max-height: 54px; max-width: 120px; object-fit: contain;" 
              />
            ` : ''}
            <div>
              <h1 style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0;">
                ${branding.storeName}
              </h1>
              ${branding.storeTagline ? `
                <p style="font-size: 0.78rem; color: #64748b; margin: 1px 0;">
                  ${branding.storeTagline}
                </p>
              ` : ''}
              <p style="font-size: 0.82rem; font-weight: 600; color: #334155; margin-top: 2px;">
                ${branding.branchName}
              </p>
              ${branding.branchAddress ? `
                <p style="font-size: 0.78rem; color: #475569; margin: 1px 0;">
                  ${branding.branchAddress}
                </p>
              ` : ''}
              ${branding.branchPhone ? `
                <p style="font-size: 0.78rem; color: #475569; margin: 1px 0;">
                  Tel: ${branding.branchPhone}
                </p>
              ` : ''}
              ${branding.gstin ? `
                <p style="font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-top: 2px;">
                  GSTIN: ${branding.gstin}
                </p>
              ` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div class="invoice-badge">
              TAX INVOICE
            </div>
            <p style="font-size: 0.85rem; font-weight: 700; font-family: monospace; margin: 4px 0 0 0;">
              ${invoice.invoiceNumber}
            </p>
            <p style="font-size: 0.8rem; color: #475569; margin: 2px 0 0 0;">
              Date: ${formatInvoiceDate(invoice.date)}
            </p>
            ${invoice.hasReturns ? `
              <p style="font-size: 0.75rem; font-weight: 700; color: #b91c1c; margin: 2px 0 0 0;">
                ⚠️ Has Item Returns
              </p>
            ` : ''}
            ${invoice.partyName ? `
              <div style="margin-top: 6px; font-size: 0.78rem; color: #334155;">
                <div><b>Customer:</b> ${invoice.partyName}</div>
                ${invoice.partyPhone ? `<div>Tel: ${invoice.partyPhone}</div>` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Line Items Table -->
        <table>
          <thead>
            <tr>
              <th style="padding: 7px 6px;">Item Details</th>
              <th style="padding: 7px 6px; textAlign: center;">Billed Qty</th>
              <th style="padding: 7px 6px; textAlign: center;">Returned</th>
              <th style="padding: 7px 6px; textAlign: right;">Price</th>
              <th style="padding: 7px 6px; textAlign: right;">Discount</th>
              <th style="padding: 7px 6px; textAlign: right;">Taxable Base</th>
              <th style="padding: 7px 6px; textAlign: right;">GST</th>
              <th style="padding: 7px 6px; textAlign: right;">Net Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot style="border-top: 2px solid #cbd5e1; font-weight: 700; background-color: #f8fafc;">
            <tr>
              <td style="padding: 7px 6px;">Total Qty</td>
              <td style="padding: 7px 6px; text-align: center;">${formatQty(totalQuantity)}</td>
              <td style="padding: 7px 6px; text-align: center; color: ${returnedQuantitySum > 0 ? '#b91c1c' : '#94a3b8'};">
                ${returnedQuantitySum > 0 ? formatQty(returnedQuantitySum) : '-'}
              </td>
              <td colspan="4"></td>
              <td style="padding: 7px 6px; text-align: right;">₹${invoice.grandTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Totals Summary -->
        <div class="totals-wrapper">
          <div class="totals-box">
            <div class="totals-row" style="color: #334155; font-weight: 600;">
              <span>Total Qty:</span>
              <span>${formatQty(totalQuantity)}</span>
            </div>

            ${invoice.originalGrandTotal !== undefined && invoice.originalGrandTotal > 0 && invoice.originalGrandTotal !== invoice.grandTotal ? `
              <div class="totals-row" style="color: #64748b;">
                <span>Original Billed Total:</span>
                <span>₹${Number(invoice.originalGrandTotal).toFixed(2)}</span>
              </div>
            ` : ''}

            ${invoice.returnTotal !== undefined && invoice.returnTotal > 0 ? `
              <div class="totals-row" style="color: #b91c1c; font-weight: 700;">
                <span>Less Returned Items:</span>
                <span>-₹${Number(invoice.returnTotal).toFixed(2)}</span>
              </div>
            ` : ''}

            ${itemDiscountsSum > 0 ? `
              <div class="totals-row" style="color: #047857; font-weight: 600;">
                <span>Item Discounts:</span>
                <span>-₹${itemDiscountsSum.toFixed(2)}</span>
              </div>
            ` : ''}

            ${orderDiscountAmount > 0 ? `
              <div class="totals-row" style="color: #047857; font-weight: 600;">
                <span>Order Discount:</span>
                <span>-₹${orderDiscountAmount.toFixed(2)}</span>
              </div>
            ` : ''}

            <div style="border-bottom: 1px dashed #cbd5e1; margin: 4px 0;"></div>

            <div class="totals-row">
              <span style="color: #64748b;">Taxable Subtotal (Ex-Tax):</span>
              <span>₹${invoice.subtotal.toFixed(2)}</span>
            </div>

            <div class="totals-row">
              <span style="color: #64748b;">GST:</span>
              <span>₹${invoice.taxTotal.toFixed(2)}</span>
            </div>

            ${invoice.roundOff !== 0 ? `
              <div class="totals-row" style="color: #64748b;">
                <span>Round Off:</span>
                <span>${invoice.roundOff > 0 ? `+₹${invoice.roundOff.toFixed(2)}` : `-₹${Math.abs(invoice.roundOff).toFixed(2)}`}</span>
              </div>
            ` : ''}

            <div class="net-total-bar">
              <span>Net Grand Total:</span>
              <span style="color: #4f46e5;">₹${invoice.grandTotal.toFixed(2)}</span>
            </div>

            <div class="totals-row" style="margin-top: 4px;">
              <span style="color: #64748b;">Payment Mode:</span>
              <span style="font-weight: 700;">${invoice.paymentMode}</span>
            </div>

            <div class="totals-row">
              <span style="color: #64748b;">Paid:</span>
              <span>₹${invoice.paidAmount.toFixed(2)}</span>
            </div>

            ${invoice.balanceAmount > 0 ? `
              <div class="totals-row" style="font-weight: 700; color: #dc2626;">
                <span>Balance Due:</span>
                <span>₹${invoice.balanceAmount.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Footer Terms -->
        <div class="footer-terms">
          <p style="font-size: 0.78rem; font-weight: 700; color: #334155; margin: 0;">
            Thank you for your business!
          </p>
          <p style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
            ${branding.receiptFooter}
          </p>
        </div>
      </body>
    </html>
  `;
}

export async function printThermalReceipt(invoice: Invoice, business?: Business): Promise<void> {
  const html = generateThermalReceiptHtml(invoice, business);
  await Print.printAsync({
    html,
  });
}

export async function printA4Invoice(invoice: Invoice, business?: Business): Promise<void> {
  const html = generateA4InvoiceHtml(invoice, business);
  await Print.printAsync({
    html,
  });
}
