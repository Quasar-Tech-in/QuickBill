import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ActivityIndicator, 
  Vibration,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme/colors';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (barcodeData: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onScanSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);

  // Reset scanned debounce state when modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setLastScannedText(null);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data, type }: { data: string; type: string }) => {
    if (scanned || !data) return;

    setScanned(true);
    setLastScannedText(data);
    Vibration.vibrate(100);

    // Call success handler
    onScanSuccess(data);

    // Debounce re-scan after 1.8 seconds so user can scan next item
    setTimeout(() => {
      setScanned(false);
    }, 1800);
  };

  const handleDemoSampleScan = (sampleData: string) => {
    setScanned(true);
    setLastScannedText(sampleData);
    Vibration.vibrate(80);
    onScanSuccess(sampleData);
    setTimeout(() => {
      setScanned(false);
    }, 1200);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Permission Request View */}
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionTitle}>📷 Camera Access Required</Text>
            <Text style={styles.permissionDesc}>
              QuickBill needs camera permission to scan product barcodes and QR codes for high-speed billing.
            </Text>

            <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
              <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Live Camera View */
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                ],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            {/* Scanning Overlay Mask */}
            <View style={styles.overlay}>
              {/* Top Bar */}
              <View style={styles.topBar}>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeBtnText}>✕ Close</Text>
                </TouchableOpacity>

                <Text style={styles.scannerHeaderTitle}>Scan Item Barcode</Text>

                <TouchableOpacity 
                  style={[styles.torchBtn, torch && styles.torchBtnActive]} 
                  onPress={() => setTorch(!torch)}
                >
                  <Text style={styles.torchBtnText}>{torch ? '🔦 On' : '🔦 Off'}</Text>
                </TouchableOpacity>
              </View>

              {/* Target Cutout Viewfinder */}
              <View style={styles.viewfinderContainer}>
                <View style={[styles.viewfinder, scanned && styles.viewfinderSuccess]}>
                  {/* Corner Markers */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />

                  {scanned ? (
                    <View style={styles.successBadge}>
                      <Text style={styles.successBadgeText}>✓ Added to Bill!</Text>
                      <Text style={styles.scannedCodeText} numberOfLines={1}>{lastScannedText}</Text>
                    </View>
                  ) : (
                    <View style={styles.crosshair} />
                  )}
                </View>
                <Text style={styles.instructionText}>
                  Point camera at product QR code (`ITEM:...`) or retail barcode
                </Text>
              </View>

              {/* Bottom Quick Test / Demo Barcode Bar */}
              <View style={styles.bottomBar}>
                <Text style={styles.demoBarTitle}>Quick Test Item Barcodes (Tap to Simulate):</Text>
                <View style={styles.demoChipsRow}>
                  <TouchableOpacity 
                    style={styles.demoChip} 
                    onPress={() => handleDemoSampleScan('ITEM:ITM-1001')}
                  >
                    <Text style={styles.demoChipText}>🍚 Basmati Rice</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.demoChip} 
                    onPress={() => handleDemoSampleScan('ITEM:ITM-1002')}
                  >
                    <Text style={styles.demoChipText}>🌻 Sunflower Oil</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.demoChip} 
                    onPress={() => handleDemoSampleScan('ITEM:ITM-1003')}
                  >
                    <Text style={styles.demoChipText}>🖱️ Optical Mouse</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: colors.surface.background,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.neutral[900],
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    color: colors.neutral[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  grantButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  grantButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: colors.neutral[600],
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  scannerHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  torchBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  torchBtnActive: {
    backgroundColor: colors.warning[500],
  },
  torchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 260,
    height: 260,
    borderRadius: 16,
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#4F46E5',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  crosshair: {
    width: 200,
    height: 2,
    backgroundColor: 'rgba(99, 102, 241, 0.75)',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  successBadge: {
    backgroundColor: colors.success[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  successBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  scannedCodeText: {
    color: '#d1fae5',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 180,
  },
  instructionText: {
    color: '#ffffff',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
    paddingHorizontal: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    fontWeight: '500',
  },
  bottomBar: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  demoBarTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  demoChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  demoChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
