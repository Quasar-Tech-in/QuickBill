import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Item, CartItem, Party, Invoice, Business } from '../types';
import { CameraScanner } from '../components/pos/CameraScanner';
import { PaymentModal } from '../components/pos/PaymentModal';
import { PostSaleModal } from '../components/pos/PostSaleModal';

interface POSScreenProps {
  onComplete?: () => void;
}

export const POSScreen: React.FC<POSScreenProps> = () => {
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [cart, setCart] = useState<CartItem[]>(() => store.getCart());
  const [parties, setParties] = useState<Party[]>(() => store.getParties());
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isPostSaleModalOpen, setIsPostSaleModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setItems(store.getItems());
      setCart(store.getCart());
      setParties(store.getParties());
      setBusiness(store.getBusinessProfile());
    });
    return () => { unsubscribe(); };
  }, []);

  // Barcode / QR Scan Handler
  const handleBarcodeScanned = (barcodeData: string) => {
    let cleanCode = barcodeData.trim();
    if (cleanCode.startsWith('ITEM:')) {
      cleanCode = cleanCode.replace('ITEM:', '').trim();
    }

    const matchedItem = store.getItemByCode(cleanCode) || store.getItemById(cleanCode);

    if (matchedItem) {
      store.addToCart(matchedItem, 1);
    } else {
      Alert.alert(
        'Product Not Found',
        `No catalog item found with code: "${cleanCode}". Add it in Inventory or search manually.`
      );
    }
  };

  // Cart Calculations (Tax-Inclusive MRP Standard)
  const grossSubtotal = cart.reduce((sum, c) => sum + (Number(c.unitPrice || 0) * Number(c.quantity || 0)), 0);
  const discountTotal = cart.reduce((acc, c) => acc + (Number(c.unitPrice || 0) * (c.discountPercent / 100) * c.quantity), 0);
  const netSubtotal = Math.max(0, grossSubtotal - discountTotal);
  const discountFactor = grossSubtotal > 0 ? (netSubtotal / grossSubtotal) : 1;

  // Base taxable amount & GST Taxes
  const taxBaseTotal = cart.reduce((sum, c) => {
    const rate = Number(c.taxRate || 0);
    const unitPrice = Number(c.unitPrice || 0);
    const qty = Number(c.quantity || 0);
    const discountedLinePrice = unitPrice * qty * discountFactor;
    const base = rate > 0 ? discountedLinePrice * (100 / (100 + rate)) : discountedLinePrice;
    return sum + base;
  }, 0);

  const taxTotal = cart.reduce((sum, c) => {
    const rate = Number(c.taxRate || 0);
    const unitPrice = Number(c.unitPrice || 0);
    const qty = Number(c.quantity || 0);
    const discountedLinePrice = unitPrice * qty * discountFactor;
    const base = rate > 0 ? discountedLinePrice * (100 / (100 + rate)) : discountedLinePrice;
    return sum + (base * (rate / 100));
  }, 0);

  const subtotal = Number(taxBaseTotal.toFixed(2));
  const unroundedTotal = netSubtotal;
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

  // Search and Filter Items
  const filteredCatalog = items.filter(item => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || 
      item.name.toLowerCase().includes(q) || 
      (item.sku && item.sku.toLowerCase().includes(q)) || 
      (item.barcode && item.barcode.toLowerCase().includes(q)) ||
      item.publicItemId.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  const categories = ['ALL', ...Array.from(new Set(items.map(i => i.category)))];

  const handleCheckoutComplete = async (saleDetails: {
    customerName: string;
    customerPhone: string;
    partyId?: string;
    paymentMode: 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'SPLIT';
    paidAmount: number;
    balanceAmount: number;
    notes?: string;
  }) => {
    setIsPaymentModalOpen(false);

    const invoiceItems = cart.map(c => {
      const lineGross = c.unitPrice * c.quantity;
      const lineDisc = lineGross * (c.discountPercent / 100);
      const lineNet = Math.max(0, lineGross - lineDisc);
      const lineTaxBase = c.taxRate > 0 ? (lineNet * (100 / (100 + c.taxRate))) : lineNet;
      const taxAmt = lineNet - lineTaxBase;
      return {
        itemId: c.item.id,
        name: c.item.name,
        unit: c.item.unit,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        discountPercent: c.discountPercent,
        taxRate: c.taxRate,
        taxAmount: Number(taxAmt.toFixed(2)),
        total: Number(lineNet.toFixed(2)),
      };
    });

    const activeUser = store.getActiveUser();
    const activeLoc = store.getActiveLocation();

    const newInvoice = await store.createInvoice({
      partyId: saleDetails.partyId,
      partyName: saleDetails.customerName,
      partyPhone: saleDetails.customerPhone,
      consumerName: saleDetails.customerName,
      consumerPhone: saleDetails.customerPhone,
      billedById: activeUser?.id,
      billedByName: activeUser?.name || 'Cashier Mobile',
      locationId: activeLoc.id,
      locationName: activeLoc.name,
      type: 'SALE',
      items: invoiceItems,
      subtotal,
      taxTotal: Number(taxTotal.toFixed(2)),
      discountTotal: Number(discountTotal.toFixed(2)),
      roundOff,
      grandTotal,
      paidAmount: saleDetails.paidAmount,
      balanceAmount: saleDetails.balanceAmount,
      paymentMode: saleDetails.paymentMode,
      status: saleDetails.balanceAmount > 0 ? (saleDetails.paidAmount > 0 ? 'PARTIAL' : 'UNPAID') : 'PAID',
      notes: saleDetails.notes,
    });

    setCompletedInvoice(newInvoice);
    setIsPostSaleModalOpen(true);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      {/* Top POS Header & Camera Scanner Viewfinder */}
      <View style={styles.topSection}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>⚡ Fast Retail POS</Text>
          <TouchableOpacity 
            style={[styles.cameraToggleBtn, isCameraActive && styles.cameraToggleBtnActive]}
            onPress={() => setIsCameraActive(!isCameraActive)}
          >
            <Text style={styles.cameraToggleText}>
              {isCameraActive ? '📷 Camera Active' : '📷 Open Camera'}
            </Text>
          </TouchableOpacity>
        </View>

        {isCameraActive && (
          <View style={styles.cameraWrapper}>
            <CameraScanner 
              onBarcodeScanned={handleBarcodeScanned} 
              isCompact={true}
              onClose={() => setIsCameraActive(false)}
            />
          </View>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Manual Search & Filter Bar */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search item name, barcode, or SKU..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Item Selection Results */}
        {searchQuery.trim() !== '' && (
          <View style={styles.searchResultsBox}>
            <Text style={styles.sectionHeader}>Matching Products ({filteredCatalog.length})</Text>
            {filteredCatalog.map(item => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.resultRow} 
                onPress={() => {
                  store.addToCart(item, 1);
                  setSearchQuery('');
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultMeta}>
                    ₹{item.salePrice.toFixed(2)} / {item.unit} • Stock: {item.currentStock} {item.unit}
                  </Text>
                </View>
                <View style={styles.addBtnBadge}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Active Shopping Cart Section */}
        <View style={styles.cartSection}>
          <View style={styles.cartHeaderRow}>
            <Text style={styles.sectionHeader}>🛒 Cart Items ({cart.length})</Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={() => store.clearCart()}>
                <Text style={styles.clearCartText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <Text style={styles.emptyCartEmoji}>🛍️</Text>
              <Text style={styles.emptyCartTitle}>Cart is Empty</Text>
              <Text style={styles.emptyCartSub}>
                Scan item barcode with the camera above or search to add items.
              </Text>
            </View>
          ) : (
            cart.map((cartItem, idx) => (
              <View key={cartItem.item.id} style={styles.cartCard}>
                <View style={styles.cartCardHeader}>
                  <Text style={styles.cartItemName}>{cartItem.item.name}</Text>
                  <TouchableOpacity onPress={() => store.removeFromCart(idx)}>
                    <Text style={styles.deleteCartItem}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cartCardBody}>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => {
                        const step = cartItem.item.allowParts ? 0.5 : 1;
                        store.updateCartItem(idx, Number((cartItem.quantity - step).toFixed(3)), cartItem.unitPrice, cartItem.discountPercent);
                      }}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.qtyInput}
                      value={String(cartItem.quantity)}
                      onChangeText={(val) => {
                        const num = parseFloat(val) || 0;
                        store.updateCartItem(idx, num, cartItem.unitPrice, cartItem.discountPercent);
                      }}
                      keyboardType="decimal-pad"
                    />

                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={() => {
                        const step = cartItem.item.allowParts ? 0.5 : 1;
                        store.updateCartItem(idx, Number((cartItem.quantity + step).toFixed(3)), cartItem.unitPrice, cartItem.discountPercent);
                      }}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>

                    <Text style={styles.unitLabel}>{cartItem.item.unit}</Text>
                  </View>

                  <View style={styles.priceColumn}>
                    <Text style={styles.rateText}>@ ₹{cartItem.unitPrice.toFixed(2)}</Text>
                    <Text style={styles.lineTotalText}>₹ {cartItem.lineTotal.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Tax & Discount Details */}
                <View style={styles.cartItemFooter}>
                  <Text style={styles.taxSubText}>GST {cartItem.taxRate}% included</Text>
                  {cartItem.item.allowParts && (
                    <Text style={styles.fractionalBadge}>Fractional Qty Allowed</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Persistent Bottom Checkout Bar */}
      {cart.length > 0 && (
        <View style={styles.bottomCheckoutBar}>
          <View>
            <Text style={styles.grandTotalLabel}>Total ({cart.length} items)</Text>
            <Text style={styles.grandTotalValue}>₹ {grandTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            style={styles.checkoutBtn} 
            onPress={() => setIsPaymentModalOpen(true)}
          >
            <Text style={styles.checkoutBtnText}>Checkout &gt;</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Payment Tender Modal */}
      <PaymentModal
        visible={isPaymentModalOpen}
        grandTotal={grandTotal}
        subtotal={subtotal}
        taxTotal={taxTotal}
        discountTotal={discountTotal}
        parties={parties}
        onClose={() => setIsPaymentModalOpen(false)}
        onCompleteSale={handleCheckoutComplete}
      />

      {/* Post Sale Share & Print Modal */}
      <PostSaleModal
        visible={isPostSaleModalOpen}
        invoice={completedInvoice}
        business={business}
        onNewSale={() => {
          setIsPostSaleModalOpen(false);
          setCompletedInvoice(null);
        }}
        onClose={() => {
          setIsPostSaleModalOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  topSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  cameraToggleBtn: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraToggleBtnActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  cameraToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[600],
  },
  cameraWrapper: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: { padding: 16 },
  searchSection: {
    position: 'relative',
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.neutral[900],
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 12,
    top: 10,
    padding: 2,
  },
  clearSearchText: {
    fontSize: 14,
    color: colors.neutral[400],
    fontWeight: '700',
  },
  categoryScroll: {
    marginBottom: 14,
  },
  categoryChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  searchResultsBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 12,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  resultName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  resultMeta: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
  },
  addBtnBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  cartSection: {
    marginTop: 6,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  clearCartText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger[500],
  },
  emptyCartBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  emptyCartEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyCartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  emptyCartSub: {
    fontSize: 12,
    color: colors.neutral[600],
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  cartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 10,
  },
  cartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
    flex: 1,
  },
  deleteCartItem: {
    fontSize: 16,
    padding: 4,
  },
  cartCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    backgroundColor: colors.neutral[100],
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  qtyInput: {
    minWidth: 44,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  unitLabel: {
    fontSize: 12,
    color: colors.neutral[600],
    marginLeft: 4,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  rateText: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  lineTotalText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary[600],
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  taxSubText: {
    fontSize: 10,
    color: colors.neutral[600],
  },
  fractionalBadge: {
    fontSize: 10,
    color: colors.primary[600],
    fontWeight: '700',
  },
  bottomCheckoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary[700],
  },
  checkoutBtn: {
    backgroundColor: colors.success[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
