import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';

interface CameraScannerProps {
  onBarcodeScanned: (data: string) => void;
  onClose?: () => void;
  isCompact?: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onBarcodeScanned,
  onClose,
  isCompact = false,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);

  if (!permission) {
    return (
      <View style={[styles.container, isCompact && styles.compactContainer]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, isCompact && styles.compactContainer]}>
        <Text style={styles.errorText}>Camera access required for barcode POS scanning.</Text>
        <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
          <Text style={styles.grantButtonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isLocked || !data) return;

    setIsLocked(true);
    setLastScannedText(data);

    // Haptic feedback
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // ignore if not supported
    }

    onBarcodeScanned(data);

    // Unlock after 1.2 seconds to allow next item scan
    setTimeout(() => {
      setIsLocked(false);
      setLastScannedText(null);
    }, 1200);
  };

  return (
    <View style={[styles.container, isCompact && styles.compactContainer]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'ean13',
            'ean8',
            'code128',
            'code39',
            'upc_e',
            'upc_a',
            'itf14',
            'datamatrix',
          ],
        }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Target Scanning Crosshair Box */}
      <View style={styles.overlay}>
        <View style={[styles.scanFrame, isLocked && styles.scanFrameSuccess]}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {isLocked && (
            <View style={styles.scannedBadge}>
              <Text style={styles.scannedBadgeText}>✓ SCANNED</Text>
            </View>
          )}
        </View>
        <Text style={styles.guideText}>
          {isLocked ? `Item Detected: ${lastScannedText}` : 'Point camera at Item Barcode or QR Code'}
        </Text>
      </View>

      {/* Floating Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity 
          style={[styles.controlBtn, torch && styles.controlBtnActive]} 
          onPress={() => setTorch(!torch)}
        >
          <Text style={styles.controlIcon}>{torch ? '🔦 ON' : '🔦 Torch'}</Text>
        </TouchableOpacity>

        {onClose && (
          <TouchableOpacity style={styles.controlBtn} onPress={onClose}>
            <Text style={styles.controlIcon}>✕ Close</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 220,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  compactContainer: {
    height: 180,
  },
  statusText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  grantButton: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  grantButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  scanFrame: {
    width: 220,
    height: 100,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrameSuccess: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#4f46e5',
  },
  topLeft: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  scannedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  scannedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  guideText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controlsRow: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  controlBtnActive: {
    backgroundColor: '#f59e0b',
  },
  controlIcon: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
