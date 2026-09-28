import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { QRScannerModal } from '../components/QRScannerModal';

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
  const [scannerVisible, setScannerVisible] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>('ORD-9842');
  const [customerName, setCustomerName] = useState('Aarav Sharma');
  const [customerAddress, setCustomerAddress] = useState('45 Indiranagar 10th Main, Bengaluru - 560038');
  const [shippingStatus, setShippingStatus] = useState<'PENDING_PACKING' | 'PACKING_VERIFIED' | 'DISPATCHED'>('PENDING_PACKING');
  
  const [items, setItems] = useState<ItemChecklist[]>([
    {
      itemId: 'itm_rice',
      name: 'Basmati Rice 5kg',
      sku: 'SKU-RICE-5',
      barcode: 'ITEM:ITM-1001',
      quantityRequired: 1,
      quantityScanned: 0,
      isVerified: false,
    },
    {
      itemId: 'itm_oil',
      name: 'Sunflower Oil 1L',
      sku: 'SKU-OIL-1',
      barcode: 'ITEM:ITM-1002',
      quantityRequired: 2,
      quantityScanned: 0,
      isVerified: false,
    },
  ]);

  const handleScanBarcode = (barcodeData: string) => {
    const cleanData = barcodeData.trim();

    // 1. If scanning a shipping box label (`SHIP:<order_id>`)
    if (cleanData.startsWith('SHIP:')) {
      const orderId = cleanData.replace('SHIP:', '').trim();
      setActiveOrderId(orderId);
      Alert.alert('📦 Order Label Scanned', `Loaded order details for ${orderId}`);
      return;
    }

    // 2. If scanning a product barcode inside the box
    let matched = false;
    const updatedItems = items.map((item) => {
      if (
        cleanData === item.barcode ||
        cleanData === item.sku ||
        cleanData.includes(item.sku)
      ) {
        matched = true;
        const newCount = Math.min(item.quantityRequired, item.quantityScanned + 1);
        const verified = newCount === item.quantityRequired;
        return {
          ...item,
          quantityScanned: newCount,
          isVerified: verified,
        };
      }
      return item;
    });

    if (matched) {
      setItems(updatedItems);
      const allVerified = updatedItems.every((it) => it.isVerified);
      if (allVerified) {
        setShippingStatus('PACKING_VERIFIED');
        Alert.alert('✅ All Items Verified!', 'All items matched the order. Package ready for courier dispatch!');
      }
    } else {
      Alert.alert('⚠️ Unrecognized Barcode', `Scanned code '${cleanData}' does not belong to active order!`);
    }
  };

  const handleCompleteDispatch = () => {
    setShippingStatus('DISPATCHED');
    Alert.alert('🚀 Order Dispatched', `Order ${activeOrderId} marked as SHIPPED to courier manifest!`);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📦 Shipping & Dispatch Verification</Text>
        <Text style={styles.headerSubtitle}>Scan shipping label & verify box contents before dispatch</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Order Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Active Order: {activeOrderId || 'None'}</Text>
            <View style={[styles.statusBadge, shippingStatus === 'DISPATCHED' ? styles.badgeSuccess : styles.badgeWarning]}>
              <Text style={styles.statusBadgeText}>{shippingStatus.replace('_', ' ')}</Text>
            </View>
          </View>

          <Text style={styles.customerLabel}>Customer Details:</Text>
          <Text style={styles.customerName}>{customerName}</Text>
          <Text style={styles.customerAddress}>{customerAddress}</Text>

          <TouchableOpacity
            style={styles.scanShippingBtn}
            onPress={() => setScannerVisible(true)}
          >
            <Text style={styles.scanShippingBtnText}>📷 Open Camera Scanner (Standby Mode)</Text>
          </TouchableOpacity>
        </View>

        {/* Item Packing Checklist */}
        <Text style={styles.sectionHeader}>Box Items Checklist ({items.filter(i => i.isVerified).length}/{items.length})</Text>

        {items.map((item) => (
          <View key={item.itemId} style={[styles.itemCard, item.isVerified && styles.itemCardVerified]}>
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSku}>SKU: {item.sku} | Barcode: {item.barcode}</Text>
              </View>

              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQtyText}>
                  {item.quantityScanned} / {item.quantityRequired}
                </Text>
                {item.isVerified && <Text style={styles.checkIcon}> ✓</Text>}
              </View>
            </View>

            {/* Quick Simulate Scan Button */}
            <TouchableOpacity
              style={styles.simScanBtn}
              onPress={() => handleScanBarcode(item.barcode)}
            >
              <Text style={styles.simScanText}>+ Simulate Scan Barcode ({item.barcode})</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Dispatch Action */}
        <TouchableOpacity
          style={[styles.dispatchBtn, shippingStatus === 'DISPATCHED' && styles.dispatchBtnDisabled]}
          onPress={handleCompleteDispatch}
          disabled={shippingStatus === 'DISPATCHED'}
        >
          <Text style={styles.dispatchBtnText}>
            {shippingStatus === 'DISPATCHED' ? '✓ Order Dispatched' : '🚀 Confirm & Mark Dispatched'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* QR & Barcode Camera Scanner Modal */}
      <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanSuccess={handleScanBarcode}
        initialStandbyMode={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeWarning: {
    backgroundColor: colors.warning[50],
  },
  badgeSuccess: {
    backgroundColor: colors.success[50],
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  customerLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 6,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  customerAddress: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: 2,
  },
  scanShippingBtn: {
    marginTop: 14,
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanShippingBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: colors.surface.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  itemCardVerified: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  itemSku: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  itemQtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  itemQtyText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  checkIcon: {
    color: colors.success[600],
    fontWeight: '900',
  },
  simScanBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.neutral[100],
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  simScanText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  dispatchBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  dispatchBtnDisabled: {
    backgroundColor: colors.neutral[400],
  },
  dispatchBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
