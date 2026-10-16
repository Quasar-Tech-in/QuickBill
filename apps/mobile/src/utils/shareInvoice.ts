import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Alert } from 'react-native';
import { Invoice, Business } from '../types';
import { generateA4InvoiceHtml, generateThermalReceiptHtml } from './printInvoice';

export interface WhatsAppShareOptions {
  invoice: Invoice;
  business: Business;
  format?: 'A4' | 'THERMAL';
  customerPhone?: string;
  customMessage?: string;
  mode?: 'DIRECT_WHATSAPP' | 'SHARE_SHEET' | 'AUTO';
}

/**
 * Normalizes phone numbers for WhatsApp scheme (prepends 91 for standard 10-digit Indian numbers)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

import { store } from '../services/store';

/**
 * Formats a clean, structured text invoice summary for WhatsApp with prominent Bill Number,
 * complete company branding, and clear return breakdowns.
 */
export function generateInvoiceWhatsAppText(
  invoice: Invoice,
  business?: Business,
  customGreeting?: string,
  customerPhone?: string
): string {
  const profile = business || store.getBusinessProfile();
  const activeLoc = store.getActiveLocation();
  const allLocations = store.getLocations();
  const branchLocation = allLocations.find(l => l.id === invoice.locationId || l.name === invoice.locationName);

  const storeName = profile.name || store.getActiveUser()?.tenantName || 'STORE COUNTER';
  const storeTagline = profile.tagline;
  const receiptFooter = profile.receiptFooterNote || 'Please keep this receipt for future reference';
  const branchName = invoice.locationName || branchLocation?.name || activeLoc?.name || '';
  const branchAddress = invoice.locationAddress || branchLocation?.address || activeLoc?.address || profile.address || '';
  const branchPhone = invoice.locationPhone || branchLocation?.phone || activeLoc?.phone || profile.phone || '';
  const gstin = invoice.locationGstin || branchLocation?.gstin || (invoice.locationId === activeLoc?.id ? activeLoc?.gstin : undefined) || profile.gstin || '';

  const dateFormatted = new Date(invoice.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const lines: string[] = [
    customGreeting || `🧾 *TAX INVOICE BILL: #${invoice.invoiceNumber}*`,
  ];

  if (invoice.hasReturns) {
    lines.push(`🔄 *[${invoice.status === 'RETURNED' || invoice.returnStatus === 'FULLY_RETURNED' ? 'FULLY RETURNED' : 'SALES RETURN ADJUSTED'}]*`);
  }

  lines.push(`🏪 *${storeName}*`);
  if (storeTagline) lines.push(`✨ _${storeTagline}_`);
  if (branchName) lines.push(`📍 ${branchName}`);
  if (branchAddress) lines.push(`🏢 ${branchAddress}`);
  if (branchPhone) lines.push(`📞 Tel: ${branchPhone}`);
  if (gstin) lines.push(`📋 GSTIN: ${gstin}`);

  lines.push(`📅 Date: ${dateFormatted}`);
  lines.push(`👤 Customer: ${invoice.partyName || 'Valued Customer'}`);
  if (customerPhone) lines.push(`📱 Phone: ${customerPhone}`);
  lines.push(`--------------------------------`);

  const totalQuantity = (invoice.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const returnedQuantitySum = (invoice.items || []).reduce((sum, it) => sum + (Number(it.returnedQuantity) || 0), 0);

  invoice.items.forEach((it, idx) => {
    const retQty = Number(it.returnedQuantity || 0);
    const hasRet = retQty > 0;
    const activeQty = Math.max(0, it.quantity - retQty);

    let lineStr = `${idx + 1}. *${it.name}*`;
    if (hasRet) {
      lineStr += `\n   Qty: ${activeQty}/${it.quantity} ${it.unit || 'pcs'} @ ₹${it.unitPrice.toFixed(2)} = ₹${it.total.toFixed(2)}`;
      lineStr += `\n   ⚠️ *[RET: ${retQty} ${it.returnReason === 'DEFECTIVE_DAMAGED' ? 'DEFECTIVE' : 'RETURN'}${it.returnNote ? ` - ${it.returnNote}` : ''}]*`;
    } else {
      lineStr += `\n   Qty: ${it.quantity} ${it.unit || 'pcs'} @ ₹${it.unitPrice.toFixed(2)} = ₹${it.total.toFixed(2)}`;
    }
    if (it.discountAmount && it.discountAmount > 0) {
      lineStr += `\n   🏷️ Disc: -₹${it.discountAmount.toFixed(2)}`;
    }
    lines.push(lineStr);
  });

  lines.push(`--------------------------------`);
  lines.push(`Total Items / Qty: ${invoice.items.length} items / ${totalQuantity}${returnedQuantitySum > 0 ? ` (Ret: ${returnedQuantitySum})` : ''}`);

  if (invoice.originalGrandTotal !== undefined && invoice.originalGrandTotal > 0 && invoice.originalGrandTotal !== invoice.grandTotal) {
    lines.push(`Original Billed Total: ₹${Number(invoice.originalGrandTotal).toFixed(2)}`);
  }
  if (invoice.returnTotal !== undefined && invoice.returnTotal > 0) {
    lines.push(`*Less Returns: -₹${Number(invoice.returnTotal).toFixed(2)}*`);
  }

  const itemDiscountsSum = invoice.itemDiscountTotal !== undefined
    ? invoice.itemDiscountTotal
    : (invoice.items || []).reduce((sum, it) => sum + (it.discountAmount || 0), 0);
  if (itemDiscountsSum > 0) {
    lines.push(`Item Discounts: -₹${itemDiscountsSum.toFixed(2)}`);
  }

  const orderDiscountAmount = invoice.orderDiscountAmount !== undefined
    ? invoice.orderDiscountAmount
    : (invoice.invoiceDiscount !== undefined ? invoice.invoiceDiscount : Math.max(0, (invoice.discountTotal || 0) - itemDiscountsSum));
  if (orderDiscountAmount > 0) {
    lines.push(`Order Discount: -₹${orderDiscountAmount.toFixed(2)}`);
  }

  lines.push(`Taxable Subtotal: ₹${invoice.subtotal.toFixed(2)}`);
  if (invoice.taxTotal > 0) {
    lines.push(`Tax / GST: ₹${invoice.taxTotal.toFixed(2)}`);
  }
  if (invoice.roundOff !== 0) {
    lines.push(`Round Off: ${invoice.roundOff > 0 ? `+₹${invoice.roundOff.toFixed(2)}` : `-₹${Math.abs(invoice.roundOff).toFixed(2)}`}`);
  }

  lines.push(`*GRAND TOTAL: ₹${invoice.grandTotal.toFixed(2)}*`);
  lines.push(`Payment Mode: ${invoice.paymentMode || 'CASH'} (${invoice.status || 'PAID'})`);
  lines.push(`Amount Paid: ₹${invoice.paidAmount.toFixed(2)}`);
  if (invoice.balanceAmount > 0) {
    lines.push(`*Balance Due: ₹${invoice.balanceAmount.toFixed(2)}*`);
  }

  lines.push(`--------------------------------`);
  lines.push(`Thank you for shopping with ${storeName}! 🙏`);
  if (receiptFooter) lines.push(`_${receiptFooter}_`);

  return lines.filter(Boolean).join('\n');
}

/**
 * Generates an immutable snapshot PDF in local sandboxed cache and launches the native share sheet.
 */
export async function shareInvoicePdfFile({
  invoice,
  business,
  format = 'A4',
}: {
  invoice: Invoice;
  business: Business;
  format?: 'A4' | 'THERMAL';
}): Promise<boolean> {
  try {
    const html = format === 'THERMAL' 
      ? generateThermalReceiptHtml(invoice, business)
      : generateA4InvoiceHtml(invoice, business);

    // 1. Generate PDF file with base64 data to enable safe sandbox placement
    const printResult = await Print.printToFileAsync({
      html,
      base64: true,
    });

    let shareableUri = printResult.uri;

    // 2. Relocate to app's sandboxed cacheDirectory to satisfy Android Expo file permissions
    const cleanInvoiceNumber = (invoice.invoiceNumber || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Invoice_${cleanInvoiceNumber}.pdf`;
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

    if (targetDir) {
      const destinationUri = `${targetDir}${fileName}`;
      try {
        if (printResult.base64) {
          await FileSystem.writeAsStringAsync(destinationUri, printResult.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          shareableUri = destinationUri;
        } else {
          await FileSystem.copyAsync({
            from: printResult.uri,
            to: destinationUri,
          });
          shareableUri = destinationUri;
        }
      } catch (relocateError) {
        console.warn('Could not relocate PDF to sandbox cache, using print URI directly:', relocateError);
      }
    }

    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(shareableUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice #${invoice.invoiceNumber}`,
        UTI: 'com.adobe.pdf',
      });
      return true;
    } else {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
      return false;
    }
  } catch (error: any) {
    console.error('Failed to generate or share invoice PDF:', error);
    Alert.alert('Sharing Error', error?.message || 'Could not generate invoice PDF for sharing.');
    return false;
  }
}

/**
 * Shares the official invoice as a PDF file document via native share sheet (WhatsApp, Email, Drive, etc.)
 * Ensures invoices are always shared as PDF documents, never as plain text.
 */
export async function shareInvoiceOnWhatsApp({
  invoice,
  business,
  format = 'A4',
}: WhatsAppShareOptions): Promise<boolean> {
  return await shareInvoicePdfFile({ invoice, business, format });
}

/**
 * Quick deep link to WhatsApp chat with pre-filled message
 */
export async function openWhatsAppChat(phone: string, text: string): Promise<boolean> {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  const webUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

  try {
    const canOpen = await Linking.canOpenURL(appUrl);
    if (canOpen) {
      await Linking.openURL(appUrl);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (e) {
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (webErr) {
      Alert.alert('WhatsApp Not Available', 'Please install WhatsApp or open a web browser to share.');
      return false;
    }
  }
}
