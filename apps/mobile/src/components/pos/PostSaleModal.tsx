import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { colors } from '../../theme/colors';
import { Invoice, Business } from '../../types';
import { shareInvoiceOnWhatsApp } from '../../utils/shareInvoice';
import { printThermalReceipt, printA4Invoice } from '../../utils/printInvoice';

interface PostSaleModalProps {
  visible: boolean;
  invoice: Invoice | null;
  business: Business;
  onNewSale: () => void;
  onClose: () => void;
}

export const PostSaleModal: React.FC<PostSaleModalProps> = ({
  visible,
  invoice,
  business,
  onNewSale,
  onClose,
}) => {
  const [phoneNumber, setPhoneNumber] = useState(invoice?.partyPhone || '');
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!invoice) return null;

  const handleShareWhatsApp = async (format: 'A4' | 'THERMAL' = 'A4') => {
    setIsSharing(true);
    try {
      await shareInvoiceOnWhatsApp({
        invoice,
        business,
        format,
        customerPhone: phoneNumber,
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrintThermal = async () => {
    setIsPrinting(true);
    try {
      await printThermalReceipt(invoice, business);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not trigger thermal receipt print.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintA4 = async () => {
    setIsPrinting(true);
    try {
      await printA4Invoice(invoice, business);
    } catch (e: any) {
      Alert.alert('Print Error', e?.message || 'Could not trigger A4 tax invoice print.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Success Checkmark */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>✓</Text>
          </View>

          <Text style={styles.title}>Sale Completed!</Text>
          <Text style={styles.subtitle}>Invoice #{invoice.invoiceNumber}</Text>
          <Text style={styles.grandTotal}>₹ {invoice.grandTotal.toFixed(2)}</Text>

          <View style={styles.customerBox}>
            <Text style={styles.customerName}>👤 {invoice.partyName || 'Counter Customer'}</Text>
            <Text style={styles.customerMode}>Tender: {invoice.paymentMode} ({invoice.status})</Text>
          </View>

          {/* WhatsApp Sharing Section */}
          <View style={styles.waSection}>
            <Text style={styles.waHeading}>💬 Send Invoice on WhatsApp</Text>
            <View style={styles.waInputRow}>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter 10-digit mobile number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
              <TouchableOpacity 
                style={[styles.waButton, isSharing && { opacity: 0.6 }]} 
                onPress={() => handleShareWhatsApp('A4')}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.waButtonText}>Share PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Print Options */}
          <View style={styles.printGrid}>
            <TouchableOpacity 
              style={styles.printOptionBtn} 
              onPress={handlePrintThermal}
              disabled={isPrinting}
            >
              <Text style={styles.printIcon}>🖨️</Text>
              <Text style={styles.printText}>Thermal POS (80mm)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.printOptionBtn} 
              onPress={handlePrintA4}
              disabled={isPrinting}
            >
              <Text style={styles.printIcon}>📄</Text>
              <Text style={styles.printText}>A4 Tax Invoice</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Action CTAs */}
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>View Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={onNewSale}>
              <Text style={styles.primaryBtnText}>+ Next Sale</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[600],
    marginTop: 2,
  },
  grandTotal: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary[600],
    marginVertical: 10,
  },
  customerBox: {
    backgroundColor: colors.neutral[50],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  customerMode: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  waSection: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  waHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  waInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  waButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  printGrid: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 20,
  },
  printOptionBtn: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  printIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  printText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  primaryBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
