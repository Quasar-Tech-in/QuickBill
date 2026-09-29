import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Alert } from 'react-native';
import { Invoice, Business } from '../types';
import { generateA4InvoiceHtml, generateThermalReceiptHtml } from './printInvoice';

export interface WhatsAppShareOptions {
  invoice: Invoice;
  business: Business;
  format?: 'A4' | 'THERMAL';
  customerPhone?: string;
  customMessage?: string;
}

/**
 * 1-Tap WhatsApp Invoice Sharing Engine
 * Generates an immutable snapshot PDF in local cache and launches the native share sheet
 * pre-targeting WhatsApp with the customer's phone and message.
 */
export async function shareInvoiceOnWhatsApp({
  invoice,
  business,
  format = 'A4',
  customerPhone,
  customMessage,
}: WhatsAppShareOptions): Promise<boolean> {
  try {
    const html = format === 'THERMAL' 
      ? generateThermalReceiptHtml(invoice, business)
      : generateA4InvoiceHtml(invoice, business);

    // 1. Generate PDF file into device local cache
    const { uri } = await Print.printToFileAsync({
      html,
    });

    const cleanPhone = (customerPhone || invoice.partyPhone || '').replace(/[^0-9]/g, '');
    const defaultGreeting = customMessage || 
      `Hello ${invoice.partyName || 'Valued Customer'}, thank you for shopping with ${business.name}! Here is your Tax Invoice #${invoice.invoiceNumber} for ₹${invoice.grandTotal.toFixed(2)}.`;

    // 2. Launch Native Share Sheet with PDF Attachment
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice #${invoice.invoiceNumber} via WhatsApp`,
        UTI: 'com.adobe.pdf',
      });
      return true;
    } else {
      // Fallback: Direct WhatsApp URL scheme if sharing sheet unavailable
      if (cleanPhone) {
        const waUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(defaultGreeting)}`;
        const canOpen = await Linking.canOpenURL(waUrl);
        if (canOpen) {
          await Linking.openURL(waUrl);
          return true;
        }
      }
      Alert.alert('Sharing Unavailable', 'Native file sharing is not supported on this device.');
      return false;
    }
  } catch (error: any) {
    console.error('Failed to share invoice on WhatsApp:', error);
    Alert.alert('Sharing Error', error?.message || 'Could not generate invoice PDF for WhatsApp.');
    return false;
  }
}

/**
 * Quick deep link to WhatsApp chat with pre-filled message
 */
export async function openWhatsAppChat(phone: string, text: string): Promise<boolean> {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      // Web fallback
      await Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`);
      return true;
    }
  } catch (e) {
    Alert.alert('WhatsApp Not Installed', 'Please install WhatsApp to use this feature.');
    return false;
  }
}
