import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { colors } from '../theme/colors';
import { QRScannerModal } from '../components/QRScannerModal';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  taxRate: number;
}

const PRODUCT_CATALOG: Record<string, { name: string; price: number; taxRate: number }> = {
  'ITM-1001': { name: 'Basmati Rice (1kg Pack)', price: 120.0, taxRate: 5.0 },
  'ITM-1002': { name: 'Refined Sunflower Oil (1L)', price: 145.0, taxRate: 5.0 },
  'ITM-1003': { name: 'Wireless Optical Mouse', price: 499.0, taxRate: 18.0 },
  'ITM-1004': { name: 'USB-C Fast Charging Cable', price: 249.0, taxRate: 18.0 },
  'ITM-1005': { name: 'Dairy Milk Silk Chocolate', price: 90.0, taxRate: 12.0 },
  'ITM-1006': { name: 'Organic Green Tea (25 Bags)', price: 185.0, taxRate: 5.0 },
};

export const NewSaleScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [customerName, setCustomerName] = useState('Aarav Sharma');
  const [customerPhone, setCustomerPhone] = useState('+91 98765 43210');
  const [cart, setCart] = useState<CartItem[]>([
    { id: 'ITM-1001', name: 'Basmati Rice (1kg Pack)', price: 120.0, qty: 2, taxRate: 5.0 },
    { id: 'ITM-1005', name: 'Dairy Milk Silk Chocolate', price: 90.0, qty: 3, taxRate: 12.0 }
  ]);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Hardware Camera QR / Barcode Scan Handler
  const handleQRScanResult = (barcodeData: string) => {
    let cleanCode = barcodeData.trim();
    if (cleanCode.startsWith('ITEM:')) {
      cleanCode = cleanCode.substring(5).trim();
    }

    const matchedProduct = PRODUCT_CATALOG[cleanCode] || {
      name: `Scanned Item (${cleanCode})`,
      price: 150.0,
      taxRate: 5.0,
    };

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(c => c.id === cleanCode || c.name === matchedProduct.name);
      if (existingIdx >= 0) {
        const nextCart = [...prevCart];
        nextCart[existingIdx] = {
          ...nextCart[existingIdx],
          qty: nextCart[existingIdx].qty + 1,
        };
        return nextCart;
      } else {
        return [
          ...prevCart,
          {
            id: cleanCode,
            name: matchedProduct.name,
            price: matchedProduct.price,
            qty: 1,
            taxRate: matchedProduct.taxRate,
          },
        ];
      }
    });
  };

  const calculateSubtotal = () => cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const calculateTax = () => cart.reduce((acc, item) => acc + ((item.price * item.qty) * (item.taxRate / 100)), 0);
  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const grandTotal = Math.round(subtotal + tax);
  const effectivePaid = paidAmount !== '' ? parseFloat(paidAmount) : grandTotal;
  const balanceDue = Math.max(0, grandTotal - effectivePaid);

  const handleCompleteSale = () => {
    Alert.alert('Sale Completed!', `Invoice created for ₹ ${grandTotal.toFixed(2)}.`, [
      { text: 'Share Invoice PDF', onPress: onComplete },
      { text: 'Done', onPress: onComplete }
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Customer Information Section */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Customer Details</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Phone Number"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Cart Items Section */}
        <View style={styles.card}>
          <View style={styles.cartHeader}>
            <Text style={styles.sectionHeader}>Billing Cart ({cart.reduce((s, c) => s + c.qty, 0)} items)</Text>
            
            {/* Open Hardware Camera Scanner */}
            <TouchableOpacity 
              style={styles.scanButton} 
              onPress={() => setIsScannerOpen(true)}
            >
              <Text style={styles.scanButtonText}>📷 Open Camera Scanner</Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.neutral[400], fontSize: 13 }}>Cart is empty. Tap 'Open Camera Scanner' to scan items.</Text>
            </View>
          ) : (
            cart.map((item, idx) => (
              <View key={idx} style={styles.cartItemRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>₹ {item.price.toFixed(2)} • GST {item.taxRate}%</Text>
                </View>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => {
                      if (item.qty === 1) {
                        setCart(cart.filter((_, i) => i !== idx));
                      } else {
                        setCart(cart.map((c, i) => i === idx ? { ...c, qty: c.qty - 1 } : c));
                      }
                    }}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setCart(cart.map((c, i) => i === idx ? { ...c, qty: c.qty + 1 } : c))}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemTotal}>₹ {(item.price * item.qty).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Bill Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Payment & Bill Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹ {subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxes (GST)</Text>
            <Text style={styles.summaryVal}>₹ {tax.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total (Rounded)</Text>
            <Text style={styles.grandTotalVal}>₹ {grandTotal.toFixed(2)}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.inputLabel}>Paid Amount (Leave blank for full paid)</Text>
            <TextInput
              style={styles.input}
              placeholder={`₹ ${grandTotal.toFixed(2)}`}
              value={paidAmount}
              onChangeText={setPaidAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {balanceDue > 0 && (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance Credit / Due</Text>
              <Text style={styles.balanceVal}>₹ {balanceDue.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteSale}>
          <Text style={styles.completeBtnText}>Confirm & Generate Bill (₹ {grandTotal})</Text>
        </TouchableOpacity>
      </View>

      {/* Hardware Camera QR Scanner Modal */}
      <QRScannerModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQRScanResult}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: colors.surface.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.surface.border, marginBottom: 16 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: colors.neutral[900], marginBottom: 12 },
  row: { flexDirection: 'row' },
  input: { borderWidth: 1, borderColor: colors.neutral[200], borderRadius: 8, padding: 10, fontSize: 14, color: colors.neutral[900] },
  inputLabel: { fontSize: 12, fontWeight: '600', color: colors.neutral[700], marginBottom: 4 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  scanButton: { backgroundColor: colors.primary[500], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  scanButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.neutral[900] },
  itemMeta: { fontSize: 12, color: colors.neutral[400], marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.neutral[100], justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: colors.neutral[700] },
  qtyText: { marginHorizontal: 8, fontSize: 14, fontWeight: '700' },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.neutral[900], width: 70, textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryLabel: { fontSize: 13, color: colors.neutral[600] },
  summaryVal: { fontSize: 13, fontWeight: '600', color: colors.neutral[900] },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: colors.neutral[200], paddingTop: 8, marginTop: 6 },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', color: colors.neutral[900] },
  grandTotalVal: { fontSize: 16, fontWeight: '800', color: colors.primary[500] },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, backgroundColor: colors.danger[50], padding: 8, borderRadius: 6 },
  balanceLabel: { color: colors.danger[700], fontWeight: '600', fontSize: 13 },
  balanceVal: { color: colors.danger[700], fontWeight: '800', fontSize: 13 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: colors.surface.border },
  completeBtn: { backgroundColor: colors.primary[500], padding: 16, borderRadius: 10, alignItems: 'center' },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
