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
  itemBarcode?: string;
  itemPrice?: number;
  itemMrp?: number;
  defaultStockCount?: number;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  visible,
  onClose,
  itemName = 'Organic Almond Milk 1L',
  itemSku = 'INT-SKU-GRO-8421',
  itemBarcode = 'INT-948271035',
  itemPrice = 240,
  itemMrp = 260,
  defaultStockCount = 10,
}) => {
  const [symbology, setSymbology] = useState<'BARCODE' | 'QR'>('QR');
  const [qrSizePreset, setQrSizePreset] = useState<'COMPACT' | 'STANDARD' | 'LARGE'>('STANDARD');
  const [paperSize, setPaperSize] = useState<'THERMAL_50x30' | 'THERMAL_40x40' | 'THERMAL_38x25' | 'DUMBBELL_70x12' | 'A4_GRID_24' | 'A4_GRID_40'>('THERMAL_40x40');
  const [quantity, setQuantity] = useState(defaultStockCount || 10);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const payload = symbology === 'QR' ? `ITEM:${itemBarcode || itemSku}` : (itemBarcode || itemSku);

  const handleCopyPayload = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleGeneratePdf = () => {
    Alert.alert(
      '📄 Generating PDF Label',
      `Type: ${symbology === 'QR' ? '2D QR Code' : '1D Barcode'}\nPreset: ${qrSizePreset}\nPaper: ${paperSize}\nQuantity: ${quantity} copies\n\nPDF label sheet ready!`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const hasDiscount = Boolean(itemMrp && itemMrp > itemPrice);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>🏷️ Barcode & QR Label Studio</Text>
              <Text style={styles.headerSub}>Thermal POS & Sticker Sheet Printing</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* 1. Symbology Selection */}
            <Text style={styles.sectionTitle}>1. Symbology & Representation</Text>
            <View style={styles.symbologyRow}>
              <TouchableOpacity
                style={[styles.symbologyCard, symbology === 'QR' && styles.symbologyCardActive]}
                onPress={() => {
                  setSymbology('QR');
                  if (paperSize === 'THERMAL_50x30') setPaperSize('THERMAL_40x40');
                }}
              >
                <Text style={styles.symbologyIcon}>📱</Text>
                <Text style={[styles.symbologyTitle, symbology === 'QR' && styles.symbologyTitleActive]}>
                  2D QR Code
                </Text>
                <Text style={styles.symbologySub}>Fast camera scan on phones</Text>
                {symbology === 'QR' && <View style={styles.activeDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.symbologyCard, symbology === 'BARCODE' && styles.symbologyCardActive]}
                onPress={() => {
                  setSymbology('BARCODE');
                  if (paperSize === 'THERMAL_40x40') setPaperSize('THERMAL_50x30');
                }}
              >
                <Text style={styles.symbologyIcon}>📊</Text>
                <Text style={[styles.symbologyTitle, symbology === 'BARCODE' && styles.symbologyTitleActive]}>
                  1D Barcode (Code 128)
                </Text>
                <Text style={styles.symbologySub}>Laser & hardware guns</Text>
                {symbology === 'BARCODE' && <View style={styles.activeDot} />}
              </TouchableOpacity>
            </View>

            {/* 2. QR Size Presets (if QR selected) */}
            {symbology === 'QR' && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.subSectionTitle}>QR Code Size Preset:</Text>
                <View style={styles.presetPillsRow}>
                  {(['COMPACT', 'STANDARD', 'LARGE'] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.presetPill, qrSizePreset === p && styles.presetPillActive]}
                      onPress={() => setQrSizePreset(p)}
                    >
                      <Text style={[styles.presetPillText, qrSizePreset === p && styles.presetPillTextActive]}>
                        {p === 'COMPACT' && 'Compact (25mm)'}
                        {p === 'STANDARD' && 'Standard (35mm)'}
                        {p === 'LARGE' && 'Large (50mm)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 3. Paper Format */}
            <Text style={styles.sectionTitle}>2. Paper Size & Label Format</Text>
            <View style={styles.paperOptionsGrid}>
              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'THERMAL_40x40' && styles.paperChipActive]}
                onPress={() => setPaperSize('THERMAL_40x40')}
              >
                <Text style={styles.paperChipTitle}>40x40 mm</Text>
                <Text style={styles.paperChipDesc}>Thermal Square QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'THERMAL_50x30' && styles.paperChipActive]}
                onPress={() => setPaperSize('THERMAL_50x30')}
              >
                <Text style={styles.paperChipTitle}>50x30 mm</Text>
                <Text style={styles.paperChipDesc}>Thermal Roll (1-Up)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'THERMAL_38x25' && styles.paperChipActive]}
                onPress={() => setPaperSize('THERMAL_38x25')}
              >
                <Text style={styles.paperChipTitle}>38x25 mm</Text>
                <Text style={styles.paperChipDesc}>Compact Thermal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paperChip, paperSize === 'DUMBBELL_70x12' && styles.paperChipActive]}
                onPress={() => setPaperSize('DUMBBELL_70x12')}
              >
                <Text style={styles.paperChipTitle}>70x12 mm</Text>
                <Text style={styles.paperChipDesc}>Jewelry String Tag</Text>
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

            {/* 4. Live Label Preview */}
            <Text style={styles.sectionTitle}>3. Sticker Live Preview</Text>
            <View style={styles.previewContainer}>
              <View style={[
                styles.standardStickerPreview,
                qrSizePreset === 'COMPACT' && { padding: 10 },
                qrSizePreset === 'LARGE' && { padding: 18 }
              ]}>
                {showStoreName ? <Text style={styles.previewStoreTextCenter}>QuickBill Store</Text> : null}
                <Text style={styles.previewItemTitleCenter}>{itemName}</Text>
                
                {/* Visual Representation */}
                {symbology === 'QR' ? (
                  <View style={styles.qrCodeBox}>
                    <View style={styles.qrCornerTL} />
                    <View style={styles.qrCornerTR} />
                    <View style={styles.qrCornerBL} />
                    <Text style={styles.qrCenterEmoji}>⬛ ⬜ ⬛</Text>
                  </View>
                ) : (
                  <Text style={styles.previewBarcodeSimCenter}>|||||| ||||| |||||||| |||</Text>
                )}

                <Text style={styles.payloadText}>{payload}</Text>

                {/* Price Display */}
                <View style={styles.previewFooterRow}>
                  {showSku ? <Text style={styles.previewFooterText}>{itemSku}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {Boolean(showMrp && hasDiscount) ? (
                      <Text style={styles.previewFooterMrp}>₹{itemMrp}</Text>
                    ) : null}
                    {showPrice ? (
                      <Text style={styles.previewFooterPrice}>₹{itemPrice}.00</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* One-Click Payload Copy */}
              <TouchableOpacity style={styles.copyPayloadBtn} onPress={handleCopyPayload}>
                <Text style={styles.copyPayloadBtnText}>
                  {isCopied ? '✓ Copied Payload!' : '📋 Copy Scannable Payload'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 5. Print Quantity Chips & Stepper */}
            <Text style={styles.sectionTitle}>4. Print Copies & Sync</Text>
            <View style={styles.quickQtyChipsRow}>
              {[1, 5, 10, 25, 50].map(cnt => (
                <TouchableOpacity
                  key={cnt}
                  style={[styles.quickQtyChip, quantity === cnt && styles.quickQtyChipActive]}
                  onPress={() => setQuantity(cnt)}
                >
                  <Text style={[styles.quickQtyChipText, quantity === cnt && styles.quickQtyChipTextActive]}>
                    {cnt}
                  </Text>
                </TouchableOpacity>
              ))}
              {defaultStockCount > 0 && (
                <TouchableOpacity
                  style={[styles.quickQtyChip, quantity === defaultStockCount && styles.quickQtyChipActive]}
                  onPress={() => setQuantity(defaultStockCount)}
                >
                  <Text style={[styles.quickQtyChipText, quantity === defaultStockCount && styles.quickQtyChipTextActive]}>
                    Sync ({defaultStockCount})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Manual Count:</Text>
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
              </View>
            </View>

            {/* 6. Content Toggles */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show Selling Price</Text>
              <Switch value={showPrice} onValueChange={setShowPrice} trackColor={{ false: '#cbd5e1', true: colors.primary[500] }} />
            </View>

            {hasDiscount ? (
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Show MRP Strikethrough</Text>
                <Switch value={showMrp} onValueChange={setShowMrp} trackColor={{ false: '#cbd5e1', true: colors.primary[500] }} />
              </View>
            ) : null}

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show SKU / Code</Text>
              <Switch value={showSku} onValueChange={setShowSku} trackColor={{ false: '#cbd5e1', true: colors.primary[500] }} />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show Store Header</Text>
              <Switch value={showStoreName} onValueChange={setShowStoreName} trackColor={{ false: '#cbd5e1', true: colors.primary[500] }} />
            </View>
          </ScrollView>

          {/* Dialog Action Buttons */}
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.cancelActionBtn} onPress={onClose}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.printActionBtn} onPress={handleGeneratePdf}>
              <Text style={styles.printActionText}>Print {quantity} Label{quantity > 1 ? 's' : ''} &gt;</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  headerSub: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.neutral[400],
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 10,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[600],
    marginBottom: 6,
  },
  symbologyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  symbologyCard: {
    flex: 1,
    backgroundColor: colors.surface.background,
    borderWidth: 1.5,
    borderColor: colors.surface.border,
    borderRadius: 12,
    padding: 12,
    position: 'relative',
  },
  symbologyCardActive: {
    borderColor: colors.primary[500],
    backgroundColor: '#f8faff',
  },
  symbologyIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  symbologyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  symbologyTitleActive: {
    color: colors.primary[700],
  },
  symbologySub: {
    fontSize: 10,
    color: colors.neutral[500],
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  presetPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetPill: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetPillActive: {
    backgroundColor: colors.primary[500],
  },
  presetPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  presetPillTextActive: {
    color: '#fff',
  },
  paperOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  paperChip: {
    width: '48%',
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: 10,
    borderRadius: 10,
  },
  paperChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: '#f8faff',
  },
  paperChipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  paperChipDesc: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  standardStickerPreview: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  previewStoreTextCenter: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  previewItemTitleCenter: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  qrCodeBox: {
    width: 68,
    height: 68,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  qrCornerTL: { position: 'absolute', top: 3, left: 3, width: 12, height: 12, backgroundColor: '#000' },
  qrCornerTR: { position: 'absolute', top: 3, right: 3, width: 12, height: 12, backgroundColor: '#000' },
  qrCornerBL: { position: 'absolute', bottom: 3, left: 3, width: 12, height: 12, backgroundColor: '#000' },
  qrCenterEmoji: { fontSize: 8 },
  previewBarcodeSimCenter: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#000',
    marginVertical: 4,
  },
  payloadText: {
    fontSize: 10,
    color: colors.neutral[500],
    fontWeight: '600',
    marginBottom: 6,
  },
  previewFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: 6,
    marginTop: 4,
  },
  previewFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  previewFooterMrp: {
    fontSize: 10,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  previewFooterPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.neutral[900],
  },
  copyPayloadBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.neutral[100],
  },
  copyPayloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  quickQtyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickQtyChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickQtyChipActive: {
    backgroundColor: colors.primary[500],
  },
  quickQtyChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  quickQtyChipTextActive: {
    color: '#fff',
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[900],
    minWidth: 24,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  toggleLabel: {
    fontSize: 12,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: '#fff',
  },
  cancelActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
  },
  cancelActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  printActionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary[500],
  },
  printActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
});
