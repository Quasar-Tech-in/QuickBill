import * as Print from 'expo-print';
import { Invoice, Business } from '../types';

export function generateThermalReceiptHtml(invoice: Invoice, business: Business): string {
  const dateFormatted = new Date(invoice.date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const itemsHtml = invoice.items.map((item, idx) => `
    <tr>
      <td style="text-align: left; padding: 2px 0;">${idx + 1}. ${item.name}</td>
      <td style="text-align: center; padding: 2px 0;">${item.quantity} ${item.unit || ''}</td>
      <td style="text-align: right; padding: 2px 0;">₹${item.unitPrice.toFixed(2)}</td>
      <td style="text-align: right; padding: 2px 0; font-weight: bold;">₹${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 76mm;
            margin: 0 auto;
            padding: 8px;
            font-size: 11px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 1px double #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .total-row { font-size: 13px; font-weight: bold; margin: 4px 0; }
          .footer { font-size: 10px; text-align: center; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div style="font-size: 15px; font-weight: bold;">${business.name}</div>
          <div>${business.address || 'Retail Counter'}</div>
          ${business.phone ? `<div>Tel: ${business.phone}</div>` : ''}
          ${business.gstin ? `<div>GSTIN: ${business.gstin}</div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>Bill No: <b>${invoice.invoiceNumber}</b></span>
          <span>${dateFormatted}</span>
        </div>
        <div class="row">
          <span>Customer: <b>${invoice.partyName || 'Cash Customer'}</b></span>
          ${invoice.partyPhone ? `<span>${invoice.partyPhone}</span>` : ''}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left; width: 45%;">Item</th>
              <th style="text-align: center; width: 15%;">Qty</th>
              <th style="text-align: right; width: 20%;">Rate</th>
              <th style="text-align: right; width: 20%;">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="row">
          <span>Total Items / Qty:</span>
          <span>${invoice.items.length} items / ${invoice.items.reduce((acc, i) => acc + i.quantity, 0)}</span>
        </div>
        <div class="row">
          <span>Subtotal:</span>
          <span>₹${invoice.subtotal.toFixed(2)}</span>
        </div>
        <div class="row">
          <span>Tax (GST):</span>
          <span>₹${invoice.taxTotal.toFixed(2)}</span>
        </div>
        ${invoice.discountTotal > 0 ? `
          <div class="row">
            <span>Discount:</span>
            <span>- ₹${invoice.discountTotal.toFixed(2)}</span>
          </div>
        ` : ''}
        ${invoice.roundOff !== 0 ? `
          <div class="row">
            <span>Round Off:</span>
            <span>₹${invoice.roundOff.toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="double-divider"></div>

        <div class="row total-row">
          <span>GRAND TOTAL:</span>
          <span>₹${invoice.grandTotal.toFixed(2)}</span>
        </div>
        <div class="row">
          <span>Paid (${invoice.paymentMode}):</span>
          <span>₹${invoice.paidAmount.toFixed(2)}</span>
        </div>
        ${invoice.balanceAmount > 0 ? `
          <div class="row" style="color: #c00; font-weight: bold;">
            <span>Balance Due:</span>
            <span>₹${invoice.balanceAmount.toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="divider"></div>

        <div class="footer">
          <div>Thank you for your visit!</div>
          <div>Goods once sold will not be returned after 7 days.</div>
          <div style="margin-top: 4px;">Powered by <b>QuickBill POS</b></div>
        </div>
      </body>
    </html>
  `;
}

export function generateA4InvoiceHtml(invoice: Invoice, business: Business): string {
  const dateFormatted = new Date(invoice.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const rowsHtml = invoice.items.map((item, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 6px; text-align: center;">${idx + 1}</td>
      <td style="padding: 8px 6px; font-weight: 500;">${item.name}</td>
      <td style="padding: 8px 6px; text-align: center;">${item.quantity} ${item.unit || ''}</td>
      <td style="padding: 8px 6px; text-align: right;">₹${item.unitPrice.toFixed(2)}</td>
      <td style="padding: 8px 6px; text-align: center;">${item.taxRate}%</td>
      <td style="padding: 8px 6px; text-align: right; font-weight: 600;">₹${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 20px;
            font-size: 13px;
          }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; }
          .business-title { font-size: 22px; font-weight: 800; color: #4f46e5; }
          .invoice-badge { background: #eef2ff; color: #4338ca; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 16px; text-align: right; }
          .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info-box { width: 48%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .info-title { font-weight: 700; color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f5f9; padding: 10px 6px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
          .totals-wrapper { display: flex; justify-content: flex-end; }
          .totals-table { width: 320px; border-collapse: collapse; }
          .totals-table td { padding: 6px 8px; }
          .grand-total-row { background: #4f46e5; color: #fff; font-weight: 800; font-size: 15px; }
          .grand-total-row td { padding: 10px 8px; }
          .signature-section { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="business-title">${business.name}</div>
            <div>${business.address || ''}</div>
            <div>Tel: ${business.phone || 'N/A'} | Email: ${business.email || 'N/A'}</div>
            ${business.gstin ? `<div>GSTIN: <b>${business.gstin}</b></div>` : ''}
          </div>
          <div>
            <div class="invoice-badge">TAX INVOICE</div>
            <div style="margin-top: 8px; text-align: right;"><b>Invoice #:</b> ${invoice.invoiceNumber}</div>
            <div style="text-align: right;"><b>Date:</b> ${dateFormatted}</div>
            <div style="text-align: right;"><b>Payment:</b> ${invoice.paymentMode} (${invoice.status})</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-title">Billed To</div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${invoice.partyName || 'Counter Customer'}</div>
            <div>${invoice.partyPhone || ''}</div>
          </div>
          <div class="info-box">
            <div class="info-title">Invoice Summary</div>
            <div><b>Status:</b> ${invoice.status}</div>
            <div><b>Total Items:</b> ${invoice.items.length}</div>
            <div><b>Payment Tender:</b> ${invoice.paymentMode}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">#</th>
              <th style="width: 44%; text-align: left;">Description</th>
              <th style="width: 12%; text-align: center;">Qty</th>
              <th style="width: 14%; text-align: right;">Rate (₹)</th>
              <th style="width: 10%; text-align: center;">GST</th>
              <th style="width: 14%; text-align: right;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="totals-wrapper">
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right; font-weight: 600;">₹${invoice.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Tax Total (GST):</td>
              <td style="text-align: right; font-weight: 600;">₹${invoice.taxTotal.toFixed(2)}</td>
            </tr>
            ${invoice.discountTotal > 0 ? `
              <tr>
                <td>Discount:</td>
                <td style="text-align: right; color: #16a34a; font-weight: 600;">- ₹${invoice.discountTotal.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${invoice.roundOff !== 0 ? `
              <tr>
                <td>Round Off:</td>
                <td style="text-align: right;">₹${invoice.roundOff.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="grand-total-row">
              <td>Grand Total:</td>
              <td style="text-align: right;">₹${invoice.grandTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Paid Amount:</td>
              <td style="text-align: right; font-weight: 600;">₹${invoice.paidAmount.toFixed(2)}</td>
            </tr>
            ${invoice.balanceAmount > 0 ? `
              <tr style="color: #dc2626; font-weight: 700;">
                <td>Balance Due:</td>
                <td style="text-align: right;">₹${invoice.balanceAmount.toFixed(2)}</td>
              </tr>
            ` : ''}
          </table>
        </div>

        <div class="signature-section">
          <div>
            <b>Terms & Conditions:</b><br />
            1. All goods sold are subject to local jurisdiction.<br />
            2. Warranty as per manufacturer terms.
          </div>
          <div style="text-align: right;">
            <br /><br />
            <b>For ${business.name}</b><br />
            Authorized Signatory
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function printThermalReceipt(invoice: Invoice, business: Business): Promise<void> {
  const html = generateThermalReceiptHtml(invoice, business);
  await Print.printAsync({
    html,
  });
}

export async function printA4Invoice(invoice: Invoice, business: Business): Promise<void> {
  const html = generateA4InvoiceHtml(invoice, business);
  await Print.printAsync({
    html,
  });
}
