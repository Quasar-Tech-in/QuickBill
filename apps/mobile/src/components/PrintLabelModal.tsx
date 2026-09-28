import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';

interface PrintLabelModalProps {
  visible: boolean;
  onClose: () => void;
  itemName?: string;
  itemSku?: string;
  itemPrice?: number;
  itemMrp?: number;
  defaultStockCount?: number;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  visible,
  onClose,
  itemName = 'Organic Almond Milk 1L',
  itemSku = 'SKU-MILK-1',
  itemPrice = 240,
  itemMrp = 260,
  defaultStockCount = 10,
}) => {
  const [style, setStyle] = useState<'STANDARD' | 'JEWELRY_STRING_TAG' | 'SHELF' | 'SHIPPING'>('STANDARD');
  const [paperSize, setPaperSize] = useState<'THERMAL_50x30' | 'DUMBBELL_70x12' | 'A4_GRID_24' | 'A4_GRID_40' | 'SHIPPING_4x6'>('THERMAL_50x30');
  const [quantity, setQuantity] = useState(defaultStockCount || 10);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);

  const handleSelectStyle = (newStyle: 'STANDARD' | 'JEWELRY_STRING_TAG' | 'SHELF' | 'SHIPPING') => {
    setStyle(newStyle);
    if (newStyle === 'JEWELRY_STRING_TAG') {
      setPaperSize('DUMBBELL_70x12');
    } else if (newStyle === 'SHIPPING') {
      setPaperSize('SHIPPING_4x6');
    } else if (newStyle === 'STANDARD') {
      setPaperSize('THERMAL_50x30');
    }
  };

  const handleGeneratePdf = () => {
    Alert.alert(
      '📄 Generating PDF Label',
      `Label Style: ${style}\nPaper: ${paperSize}\nQuantity: ${quantity} copies\n\nPDF downloaded successfully!`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🏷️ Print Barcode & Item Labels</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* 1. Label Style Tabs */}
            <Text style={styles.sectionTitle}>1. Select Label Style</Text>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, style === 'STANDARD' && styles.tabBtnActive]}
                onPress={() => handleSelectStyle('STANDARD')}
              >
                <Text style={[styles.tabBtnText, style === 'STANDARD' && styles.tabBtnTextActive]}>
                  📦 Standard Retail
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, style === 'JEWELRY_STRING_TAG' && styles.tabBtnActive]}
                onPress={() => handleSelectStyle('JEWELRY_STRING_TAG')}
              >
                <Text style={[styles.tabBtnText, style === 'JEWELRY_STRING_TAG' && styles.tabBtnTextActive]}>
                  💍 Jewelry / String Tag
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, style === 'SHELF' && styles.tabBtnActive]}
                onPress={() => handleSelectStyle('SHELF')}
              >
                <Text style={[styles.tabBtnText, style === 'SHELF' && styles.tabBtnTextActive]}>
                  🏷️ Shelf Edge Tag
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, style === 'SHIPPING' && styles.tabBtnActive]}
                onPress={() => handleSelectStyle('SHIPPING')}
              >
                <Text style={[styles.tabBtnText, style === 'SHIPPING' && styles.tabBtnTextActive]}>
                  📦 Shipping 4x6"
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. Paper Size & Grid Format */}
            <Text style={styles.sectionTitle}>2. Paper Size & Grid Format</Text>
            <View style={styles.paperOptionsGrid}>
              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'THERMAL_50x30' && styles.paperChipActive]}
                onPress={() => setPaperSize('THERMAL_50x30')}
              >
                <Text style={styles.paperChipTitle}>50x30 mm</Text>
                <Text style={styles.paperChipDesc}>Thermal Roll (1-Up)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'DUMBBELL_70x12' && styles.paperChipActive]}
                onPress={() => setPaperSize('DUMBBELL_70x12')}
              >
                <Text style={styles.paperChipTitle}>70x12 mm</Text>
                <Text style={styles.paperChipDesc}>Dumbbell String Tag</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'A4_GRID_24' && styles.paperChipActive]}
                onPress={() => setPaperSize('A4_GRID_24')}
              >
                <Text style={styles.paperChipTitle}>A4 (24-Up)</Text>
                <Text style={styles.paperChipDesc}>3x8 Grid Sheet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'A4_GRID_40' && styles.paperChipActive]}
                onPress={() => setPaperSize('A4_GRID_40')}
              >
                <Text style={styles.paperChipTitle}>A4 (40-Up)</Text>
                <Text style={styles.paperChipDesc}>4x10 Grid Sheet</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Interactive Label Preview Box */}
            <Text style={styles.sectionTitle}>3. Label Preview</Text>
            <View style={styles.previewContainer}>
              {style === 'JEWELRY_STRING_TAG' ? (
                /* Dumbbell / Jewelry Tag Geometry Preview */
                <View style={styles.dumbbellPreview}>
                  <View style={styles.dumbbellLeftWing}>
                    {showStoreName && <Text style={styles.previewStoreText}>QuickBill</Text>}
                    <Text style={styles.previewItemText}>{itemName}</Text>
                    {showPrice && <Text style={styles.previewPriceText}>₹{itemPrice}</Text>}
                  </View>

                  <View style={styles.dumbbellBridge}>
                    <Text style={styles.bridgeLabel}>String Bridge</Text>
                  </View>

                  <View style={styles.dumbbellRightWing}>
                    <Text style={styles.previewBarcodeSim}>||||| ||| ||||||</Text>
                    {showSku && <Text style={styles.previewSkuText}>{itemSku}</Text>}
                  </View>
                </View>
              ) : (
                /* Standard Sticker Preview */
                <View style={styles.standardStickerPreview}>
                  {showStoreName && <Text style={styles.previewStoreTextCenter}>QuickBill Store</Text>}
                  <Text style={styles.previewItemTitleCenter}>{itemName}</Text>
                  <Text style={styles.previewBarcodeSimCenter}>|||||| ||||| |||||||| |||</Text>
                  <View style={styles.previewFooterRow}>
                    {showSku && <Text style={styles.previewFooterText}>SKU: {itemSku}</Text>}
                    {showPrice && <Text style={styles.previewFooterPrice}>₹{itemPrice}.00</Text>}
                  </View>
                </View>
              )}
            </View>

            {/* 4. Print Quantity Stepper */}
            <Text style={styles.sectionTitle}>4. Quantity & Content Controls</Text>
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Print Copies:</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Text style={styles.stepBtnText}>-</Text>
                </TouchableOpacity>

                <Text style={styles.qtyValue}>{quantity}</Text>

                <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(quantity + 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.syncStockBtn}
                  onPress={() => setQuantity(defaultStockCount)}
                >
                  <Text style={styles.syncStockText}>Sync Stock ({defaultStockCount})</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Content Display Toggles */}
            <View style={styles.togglesGroup}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>Show Sale Price</Text>
                <Switch value={showPrice} onValueChange={setShowPrice} trackColor={{ true: colors.primary[500] }} />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>Show MRP</Text>
                <Switch value={showMrp} onValueChange={setShowMrp} trackColor={{ true: colors.primary[500] }} />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>Show SKU / Barcode ID</Text>
                <Switch value={showSku} onValueChange={setShowSku} trackColor={{ true: colors.primary[500] }} />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>Show Business Name Header</Text>
                <Switch value={showStoreName} onValueChange={setShowStoreName} trackColor={{ true: colors.primary[500] }} />
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.actionFooter}>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={onClose}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.printActionBtn} onPress={handleGeneratePdf}>
              <Text style={styles.printActionText}>🖨️ Print {quantity} Labels</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContainer: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.neutral[500],
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  tabBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  tabBtnTextActive: {
    color: colors.primary[700],
    fontWeight: '800',
  },
  paperOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paperChip: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  paperChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  paperChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  paperChipDesc: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  previewContainer: {
    padding: 16,
    backgroundColor: colors.neutral[100],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  dumbbellPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    paddingHorizontal: 6,
  },
  dumbbellLeftWing: {
    flex: 2,
    justifyContent: 'center',
  },
  dumbbellBridge: {
    flex: 1,
    height: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  bridgeLabel: {
    fontSize: 7,
    color: colors.neutral[400],
  },
  dumbbellRightWing: {
    flex: 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  previewStoreText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  previewItemText: {
    fontSize: 9,
    color: colors.neutral[600],
  },
  previewPriceText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.success[600],
  },
  previewBarcodeSim: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#000',
  },
  previewSkuText: {
    fontSize: 8,
    color: colors.neutral[500],
  },
  standardStickerPreview: {
    width: 200,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    alignItems: 'center',
  },
  previewStoreTextCenter: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  previewItemTitleCenter: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
    marginVertical: 2,
  },
  previewBarcodeSimCenter: {
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginVertical: 4,
  },
  previewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  previewFooterText: {
    fontSize: 9,
    color: colors.neutral[500],
  },
  previewFooterPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[700],
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  qtyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '800',
    width: 36,
    textAlign: 'center',
  },
  syncStockBtn: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncStockText: {
    fontSize: 11,
    color: colors.primary[700],
    fontWeight: '700',
  },
  togglesGroup: {
    marginVertical: 6,
    gap: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 13,
    color: colors.neutral[700],
  },
  actionFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface.card,
    borderTopWidth: 1,
    borderColor: colors.neutral[200],
    gap: 12,
  },
  cancelActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  cancelActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  printActionBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  printActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
