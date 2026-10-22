import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  Vibration,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme/colors';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (barcodeData: string) => void;
  initialStandbyMode?: boolean;
  initialMode?: 'SCANNER' | 'CAMERA';
  title?: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onScanSuccess,
  initialStandbyMode = true,
  initialMode = 'CAMERA',
  title = 'Barcode & QR Scanner',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isStandby, setIsStandby] = useState(initialStandbyMode);
  const [scanned, setScanned] = useState(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);
  const [mode, setMode] = useState<'SCANNER' | 'CAMERA'>(initialMode);
  const [barcodeInput, setBarcodeInput] = useState('');

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setBarcodeInput('');
      setScanned(false);
      setLastScannedText(null);
    }
  }, [visible, initialMode]);

  const handleBarcodeScanned = ({ data }: { data: string; type: string }) => {
    const clean = data.trim();
    if (scanned || !clean) return;

    setScanned(true);
    setLastScannedText(clean);
    Vibration.vibrate(100);

    onScanSuccess(clean);

    // Debounce re-scan after 1.5 seconds in standby mode, so cashier can scan next item without modal closing
    setTimeout(() => {
      setScanned(false);
      if (!isStandby || mode === 'SCANNER') {
        onClose();
      }
    }, mode === 'SCANNER' ? 600 : 1500);
  };

  const handleManualSubmit = () => {
    if (!barcodeInput.trim()) return;
    handleBarcodeScanned({ data: barcodeInput.trim(), type: 'hardware_or_manual' });
  };

  const handleDemoSampleScan = (sampleData: string) => {
    setScanned(true);
    setLastScannedText(sampleData);
    Vibration.vibrate(80);
    onScanSuccess(sampleData);
    setTimeout(() => {
      setScanned(false);
      onClose();
    }, 600);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {mode === 'SCANNER' ? (
          /* ================= MODE 1: HARDWARE BARCODE SCANNER (PRIMARY) ================= */
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Top Bar */}
            <View style={styles.scannerTopBar}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.scannerTopTitle} numberOfLines={1}>{title}</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.modeTabBar}>
              <TouchableOpacity 
                style={[styles.modeTab, styles.modeTabActive]}
                onPress={() => setMode('SCANNER')}
              >
                <Text style={[styles.modeTabText, styles.modeTabTextActive]}>
                  ⚡ Barcode Scanner (Primary)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modeTab}
                onPress={() => setMode('CAMERA')}
              >
                <Text style={styles.modeTabText}>
                  📷 Camera Viewfinder
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.gunScrollView} 
              contentContainerStyle={styles.gunScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Ready Status Banner */}
              <View style={styles.gunStatusBanner}>
                <View style={styles.gunStatusIconBox}>
                  <Text style={{ fontSize: 22 }}>⚡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gunStatusTitle}>Hardware Barcode Scanner Ready</Text>
                  <Text style={styles.gunStatusDesc}>
                    Takes input directly from Bluetooth or USB barcode guns without opening your phone camera.
                  </Text>
                </View>
              </View>

              {/* Barcode Input Card */}
              <View style={styles.gunInputCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.gunInputLabel}>Barcode / SKU Input:</Text>
                  <Text style={styles.gunListeningBadge}>🟢 Ready for Trigger</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={styles.gunInputField}
                    value={barcodeInput}
                    onChangeText={setBarcodeInput}
                    placeholder="Point scanner gun or type code..."
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={true}
                    returnKeyType="done"
                    onSubmitEditing={handleManualSubmit}
                  />

                  <TouchableOpacity 
                    style={styles.gunSubmitBtn} 
                    onPress={handleManualSubmit}
                  >
                    <Text style={styles.gunSubmitBtnText}>Accept</Text>
                  </TouchableOpacity>
                </View>

                {scanned && (
                  <View style={styles.gunSuccessAlert}>
                    <Text style={styles.gunSuccessAlertText}>
                      ✓ Scanned: {lastScannedText}
                    </Text>
                  </View>
                )}
              </View>

              {/* Toggle to Camera Button */}
              <TouchableOpacity 
                style={styles.toggleCameraBtn}
                onPress={() => setMode('CAMERA')}
              >
                <Text style={styles.toggleCameraBtnText}>
                  📷 Want to scan with Phone Camera? Switch to Camera
                </Text>
              </TouchableOpacity>

              {/* Quick Test Chips */}
              <View style={styles.testSection}>
                <Text style={styles.testSectionTitle}>Quick Test Simulation (Tap to Test):</Text>
                <View style={styles.testChipsRow}>
                  <TouchableOpacity 
                    style={styles.testChip} 
                    onPress={() => handleDemoSampleScan('8901030383321')}
                  >
                    <Text style={styles.testChipText}>8901030383321 (EAN)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.testChip} 
                    onPress={() => handleDemoSampleScan('INT-SKU-GRO-8421')}
                  >
                    <Text style={styles.testChipText}>INT-SKU-GRO-8421</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.testChip} 
                    onPress={() => handleDemoSampleScan('ITEM:ITM-1001')}
                  >
                    <Text style={styles.testChipText}>ITEM:ITM-1001 (QR)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          /* ================= MODE 2: CAMERA VIEWFINDER ================= */
          !permission?.granted ? (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionTitle}>📷 Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                QuickBill needs camera permission to scan product barcodes, string tags, and shipping labels.
              </Text>

              <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
                <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setMode('SCANNER')}>
                <Text style={styles.cancelButtonText}>⚡ Switch Back to Barcode Scanner</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={StyleSheet.absoluteFill}>
              <CameraView
                style={StyleSheet.absoluteFill}
                enableTorch={torch}
                facing={facing}
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

              <View style={styles.overlay}>
                {/* Top Controls Bar */}
                <View style={styles.topBar}>
                  <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <Text style={styles.closeBtnText}>✕ Close</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modeToggleBtn, { backgroundColor: '#4f46e5' }]}
                    onPress={() => setMode('SCANNER')}
                  >
                    <Text style={styles.modeToggleText}>⚡ Barcode Gun</Text>
                  </TouchableOpacity>

                  <View style={styles.topRightControls}>
                    <TouchableOpacity 
                      style={styles.controlIconBtn} 
                      onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                    >
                      <Text style={styles.controlIconText}>🔄 {facing.toUpperCase()}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.controlIconBtn, torch && styles.torchActive]} 
                      onPress={() => setTorch(!torch)}
                    >
                      <Text style={styles.controlIconText}>{torch ? '🔦 ON' : '🔦 OFF'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Viewfinder Target Cutout */}
                <View style={styles.viewfinderContainer}>
                  <View style={[styles.viewfinder, scanned && styles.viewfinderSuccess]}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    {scanned ? (
                      <View style={styles.successBadge}>
                        <Text style={styles.successBadgeText}>✓ Scanned & Added!</Text>
                        <Text style={styles.scannedCodeText} numberOfLines={1}>{lastScannedText}</Text>
                      </View>
                    ) : (
                      <View style={styles.crosshair} />
                    )}
                  </View>
                  <Text style={styles.instructionText}>
                    Point camera at product barcode or 2D QR code
                  </Text>
                </View>

                {/* Bottom Quick Simulation Barcodes */}
                <View style={styles.bottomBar}>
                  <Text style={styles.demoBarTitle}>Quick Test Barcodes (Tap to Simulate):</Text>
                  <View style={styles.demoChipsRow}>
                    <TouchableOpacity 
                      style={styles.demoChip} 
                      onPress={() => handleDemoSampleScan('ITEM:ITM-1001')}
                    >
                      <Text style={styles.demoChipText}>🍚 Basmati Rice</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.demoChip} 
                      onPress={() => handleDemoSampleScan('JW-RING-99')}
                    >
                      <Text style={styles.demoChipText}>💍 Diamond Ring</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.demoChip} 
                      onPress={() => handleDemoSampleScan('SHIP:ORD-9842')}
                    >
                      <Text style={styles.demoChipText}>📦 Order ORD-9842</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scannerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  scannerTopTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modeTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: '#4f46e5',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  gunScrollView: {
    flex: 1,
  },
  gunScrollContent: {
    padding: 16,
    gap: 14,
  },
  gunStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  gunStatusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gunStatusTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  gunStatusDesc: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  gunInputCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gunInputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  gunListeningBadge: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  gunInputField: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  gunSubmitBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gunSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  gunSuccessAlert: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  gunSuccessAlertText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  toggleCameraBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCameraBtnText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '700',
  },
  testSection: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  testSectionTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  testChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  testChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  testChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#0f172a',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
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
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#a5b4fc',
    fontSize: 13,
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
    paddingTop: 50,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modeToggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 6,
  },
  controlIconBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  torchActive: {
    backgroundColor: colors.warning[500],
  },
  controlIconText: {
    color: '#fff',
    fontSize: 11,
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
    fontWeight: '600',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  demoBarTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
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
