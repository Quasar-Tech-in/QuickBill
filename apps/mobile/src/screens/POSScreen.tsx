import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  Modal,
  Dimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Item, CartItem, Party, Invoice, Business, StagedOrder } from '../types';
import { QRScannerModal } from '../components/QRScannerModal';
import { PaymentModal } from '../components/pos/PaymentModal';
import { PostSaleModal } from '../components/pos/PostSaleModal';

interface POSScreenProps {
  onComplete?: () => void;
}

const QUICK_HOLD_PRESETS = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Takeaway', 'Token #1', 'Token #2', 'Drive-Thru'];

export const parseFractionString = (input: string): number => {
  if (!input) return 0;
  const clean = input.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return Number((num / den).toFixed(3));
      }
    }
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Number(parsed.toFixed(3));
};

export const POSScreen: React.FC<POSScreenProps> = () => {
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [cart, setCart] = useState<CartItem[]>(() => store.getCart());
  const [parties, setParties] = useState<Party[]>(() => store.getParties());
  const [business, setBusiness] = useState<Business>(() => store.getBusinessProfile());
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>(() => store.getStagedOrders());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // View Switcher (Parity with Web App Mobile View)
  const [activeView, setActiveView] = useState<'CATALOG' | 'CART'>('CATALOG');
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isPostSaleModalOpen, setIsPostSaleModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState('');
  const [holdMode, setHoldMode] = useState<'UPDATE' | 'NEW'>('UPDATE');

  // Item Discount Modal State
  const [editingDiscountItemIdx, setEditingDiscountItemIdx] = useState<number | null>(null);
  const [discMode, setDiscMode] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [discValueInput, setDiscValueInput] = useState('');

  // Round-off Toggle State
  const [enableRoundOff, setEnableRoundOff] = useState(true);

  useEffect(() => {
    store.fetchStagedOrders().catch(() => {});
    const unsubscribe = store.subscribe(() => {
      setItems(store.getItems());
      setCart(store.getCart());
      setParties(store.getParties());
      setBusiness(store.getBusinessProfile());
      setStagedOrders(store.getStagedOrders());
    });
    return () => { unsubscribe(); };
  }, []);

  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Barcode / QR Scan Handler
  const handleBarcodeScanned = (barcodeData: string) => {
    let cleanCode = barcodeData.trim();
    if (!cleanCode) return;
    if (cleanCode.startsWith('ITEM:')) {
      cleanCode = cleanCode.replace('ITEM:', '').trim();
    }

    // Debounce duplicate barcode scans within 700ms (avoids double quantity increments from rapid camera frames or gun bounce)
    const now = Date.now();
    if (
      cleanCode.toLowerCase() === lastScanRef.current.code.toLowerCase() &&
      now - lastScanRef.current.time < 700
    ) {
      return;
    }
    lastScanRef.current = { code: cleanCode, time: now };

    const matchedItem = store.getItemByCode(cleanCode) || store.getItemById(cleanCode);

    if (matchedItem) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
      store.addToCart(matchedItem, 1);
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (_) {}
      Alert.alert(
        'Product Not Found',
        `No catalog item found with code: "${cleanCode}". Add it in Inventory or search manually.`
      );
    }
  };

  const handleItemPress = (item: Item) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    store.addToCart(item, 1);
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
  const grandTotal = enableRoundOff ? Math.round(unroundedTotal) : Number(unroundedTotal.toFixed(2));
  const roundOff = enableRoundOff ? Number((grandTotal - unroundedTotal).toFixed(2)) : 0;

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

  const handleOpenHoldModal = () => {
    if (cart.length === 0) return;
    const activeDraft = stagedOrders.find(d => d.id === activeDraftId);
    if (activeDraft) {
      setHoldLabel(activeDraft.label);
      setHoldMode('UPDATE');
    } else {
      setHoldLabel(`Order #${stagedOrders.length + 1}`);
      setHoldMode('NEW');
    }
    setIsHoldModalOpen(true);
  };

  const handleQuickSaveActiveDraft = () => {
    if (!activeDraftId || cart.length === 0) return;
    const activeDraft = stagedOrders.find(d => d.id === activeDraftId);
    store.stageCurrentOrder({
      id: activeDraftId,
      label: activeDraft?.label || 'Held Order',
      cart,
      locationId: store.getActiveLocation().id,
      notes: activeDraft?.notes,
    });
    setStagedOrders(store.getStagedOrders());
    store.clearCart();
    setActiveDraftId(null);
    Alert.alert('Draft Updated', 'Held order updated and saved successfully.');
  };

  const handleConfirmHold = () => {
    if (cart.length === 0) return;
    const isUpdating = holdMode === 'UPDATE' && !!activeDraftId;
    const activeDraft = stagedOrders.find(d => d.id === activeDraftId);
    const defaultLabel = isUpdating ? (activeDraft?.label || 'Held Order') : `Order #${stagedOrders.length + 1}`;
    const finalLabel = holdLabel.trim() || defaultLabel;

    store.stageCurrentOrder({
      ...(isUpdating ? { id: activeDraftId } : {}),
      label: finalLabel,
      cart,
      locationId: store.getActiveLocation().id,
      notes: isUpdating ? activeDraft?.notes : undefined,
    });
    setStagedOrders(store.getStagedOrders());
    store.clearCart();
    setActiveDraftId(null);
    setIsHoldModalOpen(false);
    setActiveView('CATALOG');
  };

  const handleResumeDraft = (draft: StagedOrder) => {
    if (cart.length > 0 && activeDraftId !== draft.id) {
      Alert.alert(
        'Cart Not Empty',
        'You have items in your active cart. What would you like to do before opening this draft?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hold & Open',
            onPress: () => {
              store.stageCurrentOrder({
                label: `Order #${stagedOrders.length + 1}`,
                cart,
                locationId: store.getActiveLocation().id,
              });
              store.setCart(draft.cart || draft.items || []);
              setActiveDraftId(draft.id);
              setStagedOrders(store.getStagedOrders());
              setIsDraftsModalOpen(false);
              setActiveView('CART');
            },
          },
          {
            text: 'Discard & Open',
            style: 'destructive',
            onPress: () => {
              store.setCart(draft.cart || draft.items || []);
              setActiveDraftId(draft.id);
              setIsDraftsModalOpen(false);
              setActiveView('CART');
            },
          },
        ]
      );
    } else {
      store.setCart(draft.cart || draft.items || []);
      setActiveDraftId(draft.id);
      setIsDraftsModalOpen(false);
      setActiveView('CART');
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    Alert.alert('Delete Draft', 'Remove this held order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          store.deleteStagedOrder(draftId);
          if (activeDraftId === draftId) {
            setActiveDraftId(null);
          }
          setStagedOrders(store.getStagedOrders());
        },
      },
    ]);
  };

  const handlePromptClearCart = () => {
    if (cart.length === 0) return;
    Alert.alert(
      'Clear Active Cart',
      'Remove all items from current bill? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Bill', 
          style: 'destructive', 
          onPress: () => {
            store.clearCart();
            setActiveDraftId(null);
          } 
        }
      ]
    );
  };

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

    // Auto-clean draft if billed
    if (activeDraftId) {
      store.deleteStagedOrder(activeDraftId);
      setActiveDraftId(null);
      setStagedOrders(store.getStagedOrders());
    }

    setCompletedInvoice(newInvoice);
    setIsPostSaleModalOpen(true);
    setActiveView('CATALOG');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      {/* 1. Top View Switcher Segmented Control */}
      <View style={styles.viewSwitcherBar}>
        <TouchableOpacity
          style={[styles.switcherTab, activeView === 'CATALOG' && styles.switcherTabActive]}
          onPress={() => setActiveView('CATALOG')}
        >
          <Text style={[styles.switcherTabText, activeView === 'CATALOG' && styles.switcherTabTextActive]}>
            📦 Catalog ({filteredCatalog.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switcherTab, activeView === 'CART' && styles.switcherTabActive]}
          onPress={() => setActiveView('CART')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.switcherTabText, activeView === 'CART' && styles.switcherTabTextActive]}>
              🛒 Active Bill ({cart.length})
            </Text>
            {cart.length > 0 && (
              <View style={styles.switcherCartBadge}>
                <Text style={styles.switcherCartBadgeText}>₹{grandTotal.toFixed(0)}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Main Content Based on Selected Tab */}
      {activeView === 'CATALOG' ? (
        <View style={{ flex: 1 }}>
          {/* Top Search & Scanner Bar */}
          <View style={styles.topCatalogControls}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="🔍 Search product name, SKU, or barcode..."
                  placeholderTextColor={colors.neutral[400]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => {
                    if (searchQuery.trim()) {
                      handleBarcodeScanned(searchQuery.trim());
                      setSearchQuery('');
                    }
                  }}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={styles.cameraScanBtn} 
                onPress={() => setIsQrScannerOpen(true)}
              >
                <Text style={styles.cameraScanBtnText}>📷 Scan</Text>
              </TouchableOpacity>
            </View>

            {/* Category Filter Chips */}
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

            {/* Quick Drafts Banner if Available */}
            {stagedOrders.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.draftsScroll}>
                <TouchableOpacity 
                  style={styles.draftsViewAllChip}
                  onPress={() => setIsDraftsModalOpen(true)}
                >
                  <Text style={styles.draftsViewAllText}>⏸️ Held ({stagedOrders.length}) &gt;</Text>
                </TouchableOpacity>
                {stagedOrders.map(draft => {
                  const isActive = activeDraftId === draft.id;
                  const draftCart = draft.cart || draft.items || [];
                  const draftTotal = draftCart.reduce((s, c) => s + (c.unitPrice * c.quantity), 0);
                  return (
                    <TouchableOpacity
                      key={draft.id}
                      style={[styles.draftChip, isActive && styles.draftChipActive]}
                      onPress={() => handleResumeDraft(draft)}
                    >
                      <Text style={[styles.draftChipText, isActive && styles.draftChipTextActive]}>
                        📌 {draft.label} • ₹{draftTotal.toFixed(0)} ({draftCart.length})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Product Grid / Catalog List */}
          <ScrollView 
            style={styles.catalogScroll} 
            contentContainerStyle={[styles.catalogGridContent, cart.length > 0 && { paddingBottom: 110 }]}
          >
            {filteredCatalog.length === 0 ? (
              <View style={styles.emptyCatalogBox}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🔍</Text>
                <Text style={styles.emptyCatalogTitle}>No Products Found</Text>
                <Text style={styles.emptyCatalogSub}>
                  No items match "{searchQuery}". Try a different search term or category.
                </Text>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {filteredCatalog.map(item => {
                  const inCartItem = cart.find(c => c.item.id === item.id);
                  const isLow = item.currentStock <= item.minStockAlert;
                  const isOut = item.currentStock <= 0;
                  const hasDiscount = Boolean(item.mrp && item.mrp > item.salePrice);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.productCard, inCartItem && styles.productCardInCart]}
                      onPress={() => handleItemPress(item)}
                      activeOpacity={0.8}
                    >
                      {/* Top Meta Badges */}
                      <View style={styles.cardBadgeRow}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText} numberOfLines={1}>{item.category}</Text>
                        </View>
                        <View style={[
                          styles.stockBadge, 
                          isOut ? styles.stockBadgeOut : (isLow ? styles.stockBadgeLow : styles.stockBadgeIn)
                        ]}>
                          <Text style={[
                            styles.stockBadgeText,
                            isOut ? styles.stockTextOut : (isLow ? styles.stockTextLow : styles.stockTextIn)
                          ]}>
                            {isOut ? 'Out' : `${item.currentStock}`}
                          </Text>
                        </View>
                      </View>

                      {/* Product Name */}
                      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>

                      {/* Barcode/SKU Subtext */}
                      <Text style={styles.productSku} numberOfLines={1}>
                        {item.barcode || item.sku || item.publicItemId}
                      </Text>

                      {/* Pricing & Add Action Row */}
                      <View style={styles.cardBottomRow}>
                        <View style={{ flex: 1 }}>
                          {hasDiscount ? (
                            <Text style={styles.productMrp}>₹{item.mrp?.toFixed(2)}</Text>
                          ) : null}
                          <Text style={styles.productPrice}>₹ {item.salePrice.toFixed(2)}</Text>
                        </View>

                        <View style={[styles.addCardBtn, inCartItem && styles.addCardBtnInCart]}>
                          <Text style={styles.addCardBtnText}>
                            {inCartItem ? `✓ ${inCartItem.quantity}` : '+ Add'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Sticky Floating Bottom Cart Bar (When on Catalog Tab with Items) */}
          {cart.length > 0 && (
            <TouchableOpacity
              style={styles.floatingCartBar}
              onPress={() => setActiveView('CART')}
              activeOpacity={0.9}
            >
              <View style={styles.floatingCartLeft}>
                <View style={styles.floatingCartIcon}>
                  <Text style={{ fontSize: 16 }}>🛒</Text>
                </View>
                <View>
                  <Text style={styles.floatingCartCount}>
                    {cart.length} item{cart.length > 1 ? 's' : ''} in bill
                  </Text>
                  <Text style={styles.floatingCartTotal}>Total: ₹ {grandTotal.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.floatingCartReviewBtn}>
                <Text style={styles.floatingCartReviewText}>Review Bill &rarr;</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* CART VIEW: Active Bill Details & Steppers */
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={styles.cartScroll} 
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          >
            {/* Cart Header Actions */}
            <View style={styles.cartHeaderRow}>
              <Text style={styles.cartSectionTitle}>Current Shopping Cart ({cart.length})</Text>
              {cart.length > 0 && (
                <TouchableOpacity onPress={handlePromptClearCart}>
                  <Text style={styles.clearCartText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Active Draft Banner */}
            {Boolean(activeDraftId) ? (
              <View style={styles.activeDraftBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeDraftBannerText}>
                    📌 Editing Draft: {stagedOrders.find(d => d.id === activeDraftId)?.label || 'Held Order'}
                  </Text>
                  <Text style={styles.activeDraftBannerSub}>
                    Auto-clears when billed or tap Save Order below
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={handlePromptClearCart}
                  style={styles.cancelDraftBtn}
                >
                  <Text style={styles.cancelDraftBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Cart Item Cards */}
            {cart.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Text style={styles.emptyCartEmoji}>🛍️</Text>
                <Text style={styles.emptyCartTitle}>Your Cart is Empty</Text>
                <Text style={styles.emptyCartSub}>
                  Switch to the Catalog tab or scan a barcode to add products.
                </Text>
                <TouchableOpacity 
                  style={styles.backToCatalogBtn} 
                  onPress={() => setActiveView('CATALOG')}
                >
                  <Text style={styles.backToCatalogBtnText}>Browse Product Catalog</Text>
                </TouchableOpacity>
              </View>
            ) : (
              cart.map((cartItem, idx) => (
                <View key={cartItem.item.id} style={styles.cartCard}>
                  <View style={styles.cartCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName}>{cartItem.item.name}</Text>
                      <Text style={styles.cartItemMeta}>
                        {cartItem.item.category} • GST {cartItem.taxRate}%
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => store.removeFromCart(idx)}
                      style={styles.deleteCartItemBtn}
                    >
                      <Text style={styles.deleteCartItem}>🗑️</Text>
                    </TouchableOpacity>
                  </View>

                    <View style={styles.cartCardBody}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.qtyControls}>
                        <TouchableOpacity 
                          style={styles.qtyBtn} 
                          onPress={() => {
                            const step = cartItem.item.allowParts ? 0.5 : 1;
                            store.updateCartItem(
                              idx, 
                              Number((cartItem.quantity - step).toFixed(3)), 
                              cartItem.unitPrice, 
                              cartItem.discountPercent,
                              cartItem.discountType,
                              cartItem.discountValue
                            );
                          }}
                        >
                          <Text style={styles.qtyBtnText}>-</Text>
                        </TouchableOpacity>

                        <TextInput
                          style={styles.qtyInput}
                          value={String(cartItem.quantity)}
                          onChangeText={(val) => {
                            const num = parseFractionString(val);
                            store.updateCartItem(
                              idx, 
                              num, 
                              cartItem.unitPrice, 
                              cartItem.discountPercent,
                              cartItem.discountType,
                              cartItem.discountValue
                            );
                          }}
                          keyboardType="decimal-pad"
                        />

                        <TouchableOpacity 
                          style={styles.qtyBtn} 
                          onPress={() => {
                            const step = cartItem.item.allowParts ? 0.5 : 1;
                            store.updateCartItem(
                              idx, 
                              Number((cartItem.quantity + step).toFixed(3)), 
                              cartItem.unitPrice, 
                              cartItem.discountPercent,
                              cartItem.discountType,
                              cartItem.discountValue
                            );
                          }}
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>

                        <Text style={styles.unitLabel}>{cartItem.item.unit}</Text>
                      </View>

                      {/* Fractional Quick Chips for Loose Items */}
                      {cartItem.item.allowParts ? (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                          {[0.25, 0.5, 0.75, 1, 1.5].map(frac => (
                            <TouchableOpacity
                              key={frac}
                              style={styles.fractionChip}
                              onPress={() => store.updateCartItem(
                                idx, 
                                frac, 
                                cartItem.unitPrice, 
                                cartItem.discountPercent,
                                cartItem.discountType,
                                cartItem.discountValue
                              )}
                            >
                              <Text style={styles.fractionChipText}>{frac}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}

                      {/* Line Item Discount Trigger */}
                      <TouchableOpacity 
                        style={styles.cartDiscBadge}
                        onPress={() => {
                          setEditingDiscountItemIdx(idx);
                          setDiscMode(cartItem.discountType || 'PERCENT');
                          setDiscValueInput(String(cartItem.discountType === 'FLAT' ? (cartItem.discountValue || 0) : cartItem.discountPercent));
                        }}
                      >
                        <Text style={styles.cartDiscBadgeText}>
                          🏷️ {cartItem.discountPercent > 0 
                            ? (cartItem.discountType === 'FLAT' ? `Disc: ₹${cartItem.discountValue || 0} OFF` : `Disc: ${cartItem.discountPercent}% OFF`) 
                            : '+ Add Item Disc'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.priceColumn}>
                      <Text style={styles.rateText}>@ ₹{cartItem.unitPrice.toFixed(2)}</Text>
                      <Text style={styles.lineTotalText}>₹ {cartItem.lineTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {/* Financial Summary Card */}
            {cart.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Bill Summary</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Gross Subtotal</Text>
                  <Text style={styles.summaryVal}>₹ {grossSubtotal.toFixed(2)}</Text>
                </View>

                {Boolean(discountTotal > 0) ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.danger[600] }]}>Discounts</Text>
                    <Text style={[styles.summaryVal, { color: colors.danger[600] }]}>- ₹ {discountTotal.toFixed(2)}</Text>
                  </View>
                ) : null}

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxable Base</Text>
                  <Text style={styles.summaryVal}>₹ {subtotal.toFixed(2)}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>GST Total</Text>
                  <Text style={styles.summaryVal}>₹ {taxTotal.toFixed(2)}</Text>
                </View>

                {/* Round Off Toggle Row */}
                <TouchableOpacity 
                  style={styles.roundOffToggleRow}
                  onPress={() => setEnableRoundOff(!enableRoundOff)}
                >
                  <Text style={styles.roundOffToggleText}>
                    {enableRoundOff ? '✓ Round Off to Nearest Rupee' : '○ Exact Decimal Billing'}
                  </Text>
                  <Text style={styles.roundOffToggleValue}>
                    {enableRoundOff ? `${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)}` : 'Off'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.grandTotalTextLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalTextVal}>₹ {grandTotal.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Persistent Bottom Checkout Bar in Cart View */}
          {cart.length > 0 && (
            <View style={styles.bottomCheckoutBar}>
              <View>
                <Text style={styles.grandTotalLabel}>Total ({cart.length} items)</Text>
                <Text style={styles.grandTotalValue}>₹ {grandTotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={[
                    styles.holdBtn, 
                    activeDraftId ? { backgroundColor: '#f0fdf4', borderColor: '#86efac' } : null
                  ]} 
                  onPress={activeDraftId ? handleQuickSaveActiveDraft : handleOpenHoldModal}
                >
                  <Text style={[
                    styles.holdBtnText, 
                    activeDraftId ? { color: '#15803d', fontWeight: '800' } : null
                  ]}>
                    {activeDraftId ? '💾 Save' : '⏸️ Hold'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.checkoutBtn} 
                  onPress={() => setIsPaymentModalOpen(true)}
                >
                  <Text style={styles.checkoutBtnText}>Checkout &gt;</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3. On-Demand QR & Barcode Camera Scanner Modal */}
      <QRScannerModal
        visible={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={(data) => {
          handleBarcodeScanned(data);
        }}
      />

      {/* 4. Hold / Staged Order Modals */}
      <Modal visible={isHoldModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {activeDraftId ? '💾 Save & Re-Hold Order' : '⏸️ Hold Active Order'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Save {cart.length} item(s) (₹{grandTotal.toFixed(2)}) as a draft to serve other customers.
            </Text>

            {/* Mode selection if active draft */}
            {Boolean(activeDraftId) ? (
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, holdMode === 'UPDATE' && styles.modeToggleBtnActive]}
                  onPress={() => {
                    setHoldMode('UPDATE');
                    const ad = stagedOrders.find(d => d.id === activeDraftId);
                    if (ad) setHoldLabel(ad.label);
                  }}
                >
                  <Text style={[styles.modeToggleText, holdMode === 'UPDATE' && styles.modeToggleTextActive]}>
                    🔄 Update Existing
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeToggleBtn, holdMode === 'NEW' && styles.modeToggleBtnActive]}
                  onPress={() => {
                    setHoldMode('NEW');
                    setHoldLabel(`Order #${stagedOrders.length + 1}`);
                  }}
                >
                  <Text style={[styles.modeToggleText, holdMode === 'NEW' && styles.modeToggleTextActive]}>
                    ➕ Save as New
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Quick Label Presets:</Text>
            <View style={styles.presetRow}>
              {QUICK_HOLD_PRESETS.map(p => (
                <TouchableOpacity 
                  key={p} 
                  style={[styles.presetChip, holdLabel === p && styles.presetChipActive]}
                  onPress={() => setHoldLabel(p)}
                >
                  <Text style={[styles.presetChipText, holdLabel === p && styles.presetChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Custom Label / Identifier:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Table 4, Takeaway"
              value={holdLabel}
              onChangeText={setHoldLabel}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setIsHoldModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn} 
                onPress={handleConfirmHold}
              >
                <Text style={styles.modalConfirmText}>
                  {holdMode === 'UPDATE' && activeDraftId ? '💾 Update & Re-Hold' : '⏸️ Hold & Clear'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Staged Orders / Drafts Modal */}
      <Modal visible={isDraftsModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>📂 Held Orders & Drafts ({stagedOrders.length})</Text>
            
            <ScrollView style={{ marginTop: 12, marginBottom: 12 }}>
              {stagedOrders.length === 0 ? (
                <Text style={styles.emptyDraftsText}>No orders currently on hold.</Text>
              ) : (
                stagedOrders.map(draft => {
                  const draftCart = draft.cart || draft.items || [];
                  const draftTotal = draftCart.reduce((s, c) => s + (c.unitPrice * c.quantity), 0);
                  const isCurrent = activeDraftId === draft.id;
                  return (
                    <View key={draft.id} style={[styles.draftItemCard, isCurrent && styles.draftItemCardActive]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.draftItemLabel}>{draft.label}</Text>
                        <Text style={styles.draftItemMeta}>
                          {draftCart.length} items • ₹{draftTotal.toFixed(2)}
                        </Text>
                        <Text style={styles.draftItemItems}>
                          {draftCart.map(c => `${c.quantity}x ${c.item.name}`).join(', ')}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity 
                          style={styles.draftDeleteBtn} 
                          onPress={() => handleDeleteDraft(draft.id)}
                        >
                          <Text style={styles.draftDeleteText}>🗑️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.draftResumeBtn} 
                          onPress={() => handleResumeDraft(draft)}
                        >
                          <Text style={styles.draftResumeText}>Resume</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseBtn} 
              onPress={() => setIsDraftsModalOpen(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Item Discount Modal */}
      {editingDiscountItemIdx !== null && cart[editingDiscountItemIdx] ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingDiscountItemIdx(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>🏷️ Item Discount: {cart[editingDiscountItemIdx].item.name}</Text>
              <Text style={styles.modalSubtitle}>
                Price: ₹{cart[editingDiscountItemIdx].unitPrice} × {cart[editingDiscountItemIdx].quantity} {cart[editingDiscountItemIdx].item.unit}
              </Text>

              {/* Mode Switcher */}
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
                <TouchableOpacity
                  style={[styles.discModeBtn, discMode === 'PERCENT' && styles.discModeBtnActive]}
                  onPress={() => setDiscMode('PERCENT')}
                >
                  <Text style={[styles.discModeText, discMode === 'PERCENT' && styles.discModeTextActive]}>
                    % Percentage
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.discModeBtn, discMode === 'FLAT' && styles.discModeBtnActive]}
                  onPress={() => setDiscMode('FLAT')}
                >
                  <Text style={[styles.discModeText, discMode === 'FLAT' && styles.discModeTextActive]}>
                    ₹ Flat Amount
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Discount Value ({discMode === 'PERCENT' ? '%' : '₹'}):
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={discMode === 'PERCENT' ? 'e.g. 10' : 'e.g. 50'}
                value={discValueInput}
                onChangeText={setDiscValueInput}
                keyboardType="decimal-pad"
                autoFocus
              />

              {/* Preset Quick Chips */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {(discMode === 'PERCENT' ? ['5', '10', '15', '20', '50'] : ['10', '25', '50', '100', '200']).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={styles.presetChip}
                    onPress={() => setDiscValueInput(p)}
                  >
                    <Text style={styles.presetChipText}>{discMode === 'PERCENT' ? `${p}%` : `₹${p}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn} 
                  onPress={() => setEditingDiscountItemIdx(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.modalConfirmBtn} 
                  onPress={() => {
                    const it = cart[editingDiscountItemIdx];
                    const val = parseFloat(discValueInput) || 0;
                    const gross = it.unitPrice * it.quantity;
                    const pct = discMode === 'PERCENT' ? val : (gross > 0 ? (val / gross) * 100 : 0);
                    store.updateCartItem(
                      editingDiscountItemIdx, 
                      it.quantity, 
                      it.unitPrice, 
                      Number(pct.toFixed(2)), 
                      discMode, 
                      val
                    );
                    setEditingDiscountItemIdx(null);
                  }}
                >
                  <Text style={styles.modalConfirmText}>Apply Discount</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

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
  
  // Segmented Switcher Tab
  viewSwitcherBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    gap: 10,
  },
  switcherTab: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherTabActive: {
    backgroundColor: colors.primary[500],
  },
  switcherTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  switcherTabTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  switcherCartBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  switcherCartBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[600],
  },

  // Catalog Controls
  topCatalogControls: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.neutral[900],
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 10,
    top: 9,
    padding: 2,
  },
  clearSearchText: {
    fontSize: 13,
    color: colors.neutral[400],
    fontWeight: '700',
  },
  cameraScanBtn: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  cameraScanBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[600],
  },
  categoryScroll: {
    paddingVertical: 4,
  },
  categoryChip: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
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
    fontWeight: '700',
  },

  // Drafts Scroll
  draftsScroll: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    marginTop: 4,
  },
  draftsViewAllChip: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  draftsViewAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  draftChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  draftChipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  draftChipText: {
    fontSize: 11,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  draftChipTextActive: {
    color: '#92400e',
    fontWeight: '800',
  },

  // Product Grid
  catalogScroll: {
    flex: 1,
  },
  catalogGridContent: {
    padding: 12,
  },
  emptyCatalogBox: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyCatalogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 4,
  },
  emptyCatalogSub: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    width: (Dimensions.get('window').width - 34) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 10,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  productCardInCart: {
    borderColor: colors.primary[400],
    backgroundColor: '#f8faff',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: '55%',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockBadgeIn: { backgroundColor: '#ecfdf5' },
  stockBadgeLow: { backgroundColor: '#fffbeb' },
  stockBadgeOut: { backgroundColor: '#fef2f2' },
  stockBadgeText: { fontSize: 10, fontWeight: '700' },
  stockTextIn: { color: '#047857' },
  stockTextLow: { color: '#b45309' },
  stockTextOut: { color: '#b91c1c' },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
    lineHeight: 17,
    marginBottom: 4,
  },
  productSku: {
    fontSize: 10,
    color: colors.neutral[400],
    marginBottom: 8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  productMrp: {
    fontSize: 10,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  addCardBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addCardBtnInCart: {
    backgroundColor: '#059669',
  },
  addCardBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Sticky Floating Bottom Cart Bar
  floatingCartBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: colors.neutral[900],
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCartIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartCount: {
    fontSize: 12,
    color: colors.neutral[300],
    fontWeight: '600',
  },
  floatingCartTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
  floatingCartReviewBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  floatingCartReviewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Cart Tab Styles
  cartScroll: {
    flex: 1,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  clearCartText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger[600],
  },
  activeDraftBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activeDraftBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  activeDraftBannerSub: {
    fontSize: 10,
    color: '#b45309',
    marginTop: 2,
  },
  cancelDraftBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  cancelDraftBtnText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '800',
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyCartEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyCartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 4,
  },
  emptyCartSub: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backToCatalogBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backToCatalogBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  cartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 12,
    marginBottom: 10,
  },
  cartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  cartItemMeta: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  deleteCartItemBtn: {
    padding: 4,
  },
  deleteCartItem: {
    fontSize: 15,
  },
  cartCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  qtyInput: {
    width: 44,
    height: 32,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
    paddingVertical: 0,
  },
  unitLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  rateText: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  lineTotalText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.neutral[900],
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 14,
    marginTop: 6,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.surface.border,
    marginVertical: 8,
  },
  grandTotalTextLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  grandTotalTextVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary[600],
  },

  // Persistent Checkout Bar
  bottomCheckoutBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  holdBtn: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  holdBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  checkoutBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Hold Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 12,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  modeToggleBtnActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  modeToggleTextActive: {
    color: '#92400e',
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  presetChipActive: {
    backgroundColor: colors.primary[100],
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  presetChipText: {
    fontSize: 12,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.primary[700],
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.neutral[900],
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
  },
  modalConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  // Drafts Modal Items
  emptyDraftsText: {
    textAlign: 'center',
    paddingVertical: 24,
    color: colors.neutral[400],
    fontSize: 13,
  },
  draftItemCard: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  draftItemCardActive: {
    borderColor: colors.primary[400],
    backgroundColor: '#f8faff',
  },
  draftItemLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  draftItemMeta: {
    fontSize: 11,
    color: colors.primary[600],
    fontWeight: '700',
    marginTop: 2,
  },
  draftItemItems: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  draftDeleteBtn: {
    padding: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  draftDeleteText: {
    fontSize: 13,
  },
  draftResumeBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  draftResumeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  modalCloseBtn: {
    backgroundColor: colors.neutral[100],
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  fractionChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  fractionChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  cartDiscBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartDiscBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  roundOffToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  roundOffToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  roundOffToggleValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[700],
  },
  discModeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  discModeBtnActive: {
    backgroundColor: colors.primary[600],
  },
  discModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  discModeTextActive: {
    color: '#fff',
  },
});
