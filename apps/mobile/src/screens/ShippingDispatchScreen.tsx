import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Invoice } from '../types';
import { CameraScanner } from '../components/pos/CameraScanner';

interface ItemChecklist {
  itemId: string;
  name: string;
  sku: string;
  barcode: string;
  quantityRequired: number;
  quantityScanned: number;
  isVerified: boolean;
}

export const ShippingDispatchScreen: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(() => {
    const list = store.getInvoices();
    return list.length > 0 ? list[0] : null;
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [courierPartner, setCourierPartner] = useState('In-House Rider');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingStatus, setShippingStatus] = useState<'PENDING_PACKING' | 'PACKING_VERIFIED' | 'DISPATCHED'>('PENDING_PACKING');
  const [items, setItems] = useState<ItemChecklist[]>([]);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const invs = store.getInvoices();
      setInvoices(invs);
      if (!selectedInvoice && invs.length > 0) {
        setSelectedInvoice(invs[0]);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  // Load checklist whenever active invoice changes
  useEffect(() => {
    if (selectedInvoice) {
      const catalog = store.getItems();
      const checklist: ItemChecklist[] = selectedInvoice.items.map((it) => {
        const matched = catalog.find(c => c.id === it.itemId || c.name === it.name);
        return {
          itemId: it.itemId,
          name: it.name,
          sku: matched?.sku || `SKU-${it.itemId.slice(-4)}`,
          barcode: matched?.barcode || `ITEM:${matched?.publicItemId || it.itemId}`,
          quantityRequired: Math.max(1, it.quantity),
          quantityScanned: 0,
          isVerified: false,
        };
      });
      setItems(checklist);
      setShippingStatus('PENDING_PACKING');
      setTrackingNumber(`TRK-${Date.now().toString().slice(-6)}`);
    } else {
      setItems([]);
    }
  }, [selectedInvoice]);

  const handleScanBarcode = (barcodeData: string) => {
    const cleanData = barcodeData.trim();

    // 1. If scanning an invoice / order barcode
    if (cleanData.startsWith('INV-') || cleanData.startsWith('SHIP:') || cleanData.startsWith('ORD-')) {
      const targetNumber = cleanData.replace('SHIP:', '').replace('ORD-', '').trim();
      const match = invoices.find(inv => inv.invoiceNumber === targetNumber || inv.invoiceNumber.includes(targetNumber) || inv.id === targetNumber);
      if (match) {
        setSelectedInvoice(match);
        Alert.alert('📦 Order Loaded', `Switched active packing verification to Invoice #${match.invoiceNumber}`);
        return;
      }
    }

    // 2. If scanning a product barcode
    let matched = false;
    const updatedItems = items.map((item) => {
      const isCodeMatch = 
        cleanData === item.barcode ||
        cleanData === item.sku ||
        cleanData.replace('ITEM:', '') === item.barcode.replace('ITEM:', '') ||
        cleanData.toLowerCase() === item.name.toLowerCase();

      if (isCodeMatch && item.quantityScanned < item.quantityRequired) {
        matched = true;
        const newCount = item.quantityScanned + 1;
        return {
          ...item,
          quantityScanned: newCount,
          isVerified: newCount >= item.quantityRequired,
        };
      }
      return item;
    });

    if (matched) {
      setItems(updatedItems);
      const allVerified = updatedItems.every((it) => it.isVerified);
      if (allVerified) {
        setShippingStatus('PACKING_VERIFIED');
        Alert.alert('✅ Order 100% Verified!', 'All items matched the invoice. Ready to seal package and dispatch!');
      }
    } else {
      const alreadyFull = items.some(i => (cleanData === i.barcode || cleanData === i.sku) && i.quantityScanned >= i.quantityRequired);
      if (alreadyFull) {
        Alert.alert('Item Quantity Complete', 'Required quantity for this product is already fully scanned.');
      } else {
        Alert.alert('⚠️ Unrecognized Item Barcode', `Scanned code "${cleanData}" does not match any pending items in ${selectedInvoice?.invoiceNumber || 'this order'}.`);
      }
    }
  };

  const handleManualIncrement = (itemId: string) => {
    const updated = items.map(item => {
      if (item.itemId === itemId) {
        const next = Math.min(item.quantityRequired, item.quantityScanned + 1);
        return {
          ...item,
          quantityScanned: next,
          isVerified: next >= item.quantityRequired,
        };
      }
      return item;
    });
    setItems(updated);
    if (updated.length > 0 && updated.every(i => i.isVerified)) {
      setShippingStatus('PACKING_VERIFIED');
    }
  };

  const handleManualDecrement = (itemId: string) => {
    const updated = items.map(item => {
      if (item.itemId === itemId) {
        const next = Math.max(0, item.quantityScanned - 1);
        return {
          ...item,
          quantityScanned: next,
          isVerified: false,
        };
      }
      return item;
    });
    setItems(updated);
    setShippingStatus('PENDING_PACKING');
  };

  const handleCompleteDispatch = () => {
    if (!selectedInvoice) return;
    setShippingStatus('DISPATCHED');
    Alert.alert(
      '🚀 Dispatched Successfully!',
      `Order #${selectedInvoice.invoiceNumber} has been verified and handed over to ${courierPartner}.\n\nWaybill / Tracking: ${trackingNumber}`
    );
  };

  const verifiedCount = items.filter(i => i.isVerified).length;
  const totalItemsCount = items.length;
  const progressPercent = totalItemsCount > 0 ? Math.round((verifiedCount / totalItemsCount) * 100) : 0;
  const isAllVerified = totalItemsCount > 0 && verifiedCount === totalItemsCount;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Header Banner */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.qcIconBadge}>
              <Text style={styles.qcIconEmoji}>🚚</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Shipping & Dispatch</Text>
              <Text style={styles.headerSubtitle}>
                {invoices.length} orders available for QC & packing
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.cameraToggleBtn, isCameraActive && styles.cameraToggleBtnActive]}
          onPress={() => setIsCameraActive(!isCameraActive)}
          activeOpacity={0.8}
        >
          <Text style={[styles.cameraToggleBtnText, isCameraActive && styles.cameraToggleBtnTextActive]}>
            {isCameraActive ? '✕ Close Scanner' : '📷 Open Scanner'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Live Camera Scanner Viewfinder */}
      {isCameraActive && (
        <View style={styles.cameraWrapper}>
          <CameraScanner 
            onBarcodeScanned={handleScanBarcode} 
            isCompact={true}
            onClose={() => setIsCameraActive(false)}
          />
        </View>
      )}

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Select Order to Dispatch */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>📦 Active Orders</Text>
          <Text style={styles.sectionBadge}>{invoices.length} Orders</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.orderCarousel}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {invoices.map((inv) => {
            const isSelected = selectedInvoice?.id === inv.id;
            return (
              <TouchableOpacity
                key={inv.id}
                style={[styles.orderCard, isSelected && styles.orderCardSelected]}
                onPress={() => setSelectedInvoice(inv)}
                activeOpacity={0.7}
              >
                <View style={styles.orderCardTop}>
                  <Text style={[styles.orderCardNumber, isSelected && styles.orderCardNumberSelected]}>
                    {inv.invoiceNumber}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedCheckBadge}>
                      <Text style={styles.selectedCheckText}>✓</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.orderCardCustomer} numberOfLines={1}>
                  👤 {inv.partyName || 'Counter Customer'}
                </Text>

                <View style={styles.orderCardFooter}>
                  <Text style={styles.orderCardAmount}>₹{inv.grandTotal.toFixed(2)}</Text>
                  <Text style={styles.orderCardItems}>{inv.items.length} items</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedInvoice ? (
          <>
            {/* Active Order Summary & QC Progress Card */}
            <View style={styles.mainCard}>
              <View style={styles.mainCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderDetailNumber}>{selectedInvoice.invoiceNumber}</Text>
                  <Text style={styles.orderDetailCustomer}>
                    👤 {selectedInvoice.partyName || 'Counter Customer'}
                  </Text>
                  <Text style={styles.orderDetailPhone}>
                    📞 {selectedInvoice.partyPhone || 'Store Delivery / Handover'}
                  </Text>
                </View>

                <View style={[
                  styles.statusBadge, 
                  shippingStatus === 'DISPATCHED' ? styles.statusBadgeDispatched : 
                  shippingStatus === 'PACKING_VERIFIED' ? styles.statusBadgeVerified : styles.statusBadgePending
                ]}>
                  <Text style={[
                    styles.statusBadgeText, 
                    shippingStatus === 'DISPATCHED' ? styles.statusTextDispatched : 
                    shippingStatus === 'PACKING_VERIFIED' ? styles.statusTextVerified : styles.statusTextPending
                  ]}>
                    {shippingStatus === 'DISPATCHED' ? '✓ DISPATCHED' : 
                     shippingStatus === 'PACKING_VERIFIED' ? 'READY TO SEAL' : 'IN PACKING'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar Gauge */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTextRow}>
                  <Text style={styles.progressLabel}>Box Verification Progress</Text>
                  <Text style={styles.progressValue}>
                    {verifiedCount} of {totalItemsCount} items ({progressPercent}%)
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${progressPercent}%` },
                      isAllVerified && { backgroundColor: colors.success[500] }
                    ]} 
                  />
                </View>
              </View>

              {/* Manual Barcode Input Row */}
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Scan or type item barcode / SKU..."
                  placeholderTextColor={colors.neutral[400]}
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.searchBtn}
                  onPress={() => {
                    if (manualCode.trim()) {
                      handleScanBarcode(manualCode.trim());
                      setManualCode('');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.searchBtnText}>Verify</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Checklist Items */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>📋 Box Checklist ({items.length})</Text>
              <Text style={styles.sectionSub}>Scan each product as it goes into the package</Text>
            </View>

            {items.map((item) => (
              <View 
                key={item.itemId} 
                style={[styles.itemCard, item.isVerified && styles.itemCardVerified]}
              >
                <View style={styles.itemMainRow}>
                  <View style={styles.itemIconContainer}>
                    <Text style={styles.itemIcon}>{item.isVerified ? '✅' : '📦'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.itemTagsRow}>
                      <View style={styles.itemTag}>
                        <Text style={styles.itemTagText}>SKU: {item.sku}</Text>
                      </View>
                      <View style={styles.itemTag}>
                        <Text style={styles.itemTagText}>Code: {item.barcode}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.qtyBadge, item.isVerified ? styles.qtyBadgeDone : styles.qtyBadgeWait]}>
                    <Text style={[styles.qtyBadgeText, item.isVerified ? styles.qtyTextDone : styles.qtyTextWait]}>
                      {item.quantityScanned}/{item.quantityRequired}
                    </Text>
                  </View>
                </View>

                {/* Card Action Row */}
                <View style={styles.itemActionRow}>
                  <Text style={[styles.itemStatusNote, item.isVerified && { color: colors.success[700], fontWeight: '700' }]}>
                    {item.isVerified ? '✓ Verified in Box' : '⏳ Awaiting barcode scan'}
                  </Text>
                  <View style={styles.counterGroup}>
                    <TouchableOpacity 
                      style={styles.counterBtn} 
                      onPress={() => handleManualDecrement(item.itemId)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.counterBtn, styles.counterBtnPlus]} 
                      onPress={() => handleManualIncrement(item.itemId)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.counterBtnPlusText}>+1</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            {/* Courier Partner & Seal Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>🚚 Logistics & Handover</Text>
            </View>

            <View style={styles.mainCard}>
              <Text style={styles.fieldHeading}>Select Courier Partner</Text>
              <View style={styles.courierRow}>
                {['In-House Rider', 'Delhivery', 'BlueDart', 'Porter / Dunzo', 'Shadowfax'].map((courier) => {
                  const isActive = courierPartner === courier;
                  return (
                    <TouchableOpacity
                      key={courier}
                      style={[styles.courierChip, isActive && styles.courierChipActive]}
                      onPress={() => setCourierPartner(courier)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.courierChipText, isActive && styles.courierChipTextActive]}>
                        {courier}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldHeading}>AWB / Tracking Number</Text>
              <TextInput
                style={styles.trackingInput}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="e.g. TRK-984210"
                placeholderTextColor={colors.neutral[400]}
              />

              <TouchableOpacity 
                style={[
                  styles.primaryDispatchBtn, 
                  shippingStatus === 'DISPATCHED' ? styles.primaryDispatchBtnDone : 
                  !isAllVerified ? styles.primaryDispatchBtnDisabled : null
                ]}
                onPress={handleCompleteDispatch}
                disabled={shippingStatus === 'DISPATCHED' || !isAllVerified}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryDispatchBtnText}>
                  {shippingStatus === 'DISPATCHED' ? '✓ Order Handed Over & Dispatched' : 
                   isAllVerified ? '🚀 Seal Box & Confirm Handover' : `⚠️ Verify ${totalItemsCount - verifiedCount} Remaining Items First`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>📭</Text>
            <Text style={styles.emptyHeading}>No Pending Orders</Text>
            <Text style={styles.emptySubtitle}>
              Create a sales invoice via POS to begin quality control and shipping verification.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qcIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  qcIconEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 1,
  },
  cameraToggleBtn: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cameraToggleBtnActive: {
    backgroundColor: colors.danger[50],
    borderColor: colors.danger[200],
  },
  cameraToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
  },
  cameraToggleBtnTextActive: {
    color: colors.danger[700],
  },
  cameraWrapper: {
    padding: 12,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[600],
    backgroundColor: colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionSub: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  orderCarousel: {
    marginBottom: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    width: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  orderCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
    borderWidth: 2,
  },
  orderCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderCardNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  orderCardNumberSelected: {
    color: colors.primary[700],
  },
  selectedCheckBadge: {
    backgroundColor: colors.primary[600],
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheckText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  orderCardCustomer: {
    fontSize: 11,
    color: colors.neutral[600],
    marginBottom: 8,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  orderCardAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  orderCardItems: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  orderDetailNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  orderDetailCustomer: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
    marginTop: 2,
  },
  orderDetailPhone: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[200],
  },
  statusBadgeVerified: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  statusBadgeDispatched: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusTextPending: {
    color: colors.warning[800],
  },
  statusTextVerified: {
    color: colors.success[700],
  },
  statusTextDispatched: {
    color: colors.primary[700],
  },
  progressContainer: {
    marginVertical: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral[100],
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[700],
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 4,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: colors.neutral[900],
  },
  searchBtn: {
    backgroundColor: colors.neutral[900],
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  itemCardVerified: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 16,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  itemTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  itemTag: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  qtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qtyBadgeWait: {
    backgroundColor: colors.neutral[100],
  },
  qtyBadgeDone: {
    backgroundColor: colors.success[100],
  },
  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '900',
  },
  qtyTextWait: {
    color: colors.neutral[700],
  },
  qtyTextDone: {
    color: colors.success[700],
  },
  itemActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  itemStatusNote: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  counterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  counterBtn: {
    backgroundColor: colors.neutral[100],
    width: 36,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  counterBtnPlus: {
    backgroundColor: colors.primary[50],
    width: 44,
  },
  counterBtnPlusText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[700],
  },
  fieldHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 8,
    marginTop: 4,
  },
  courierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  courierChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  courierChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  courierChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  courierChipTextActive: {
    color: '#FFFFFF',
  },
  trackingInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.neutral[900],
    marginBottom: 16,
  },
  primaryDispatchBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryDispatchBtnDisabled: {
    backgroundColor: colors.neutral[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryDispatchBtnDone: {
    backgroundColor: colors.neutral[500],
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryDispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginTop: 20,
  },
  emptyHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
