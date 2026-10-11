import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Zap, CheckCircle2, QrCode, Scan, AlertCircle } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface WebcamScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcodeData: string) => void;
  initialStandbyMode?: boolean;
  title?: string;
}

export const WebcamScannerModal: React.FC<WebcamScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  initialStandbyMode = false,
  title = 'Barcode & QR Camera Scanner',
}) => {
  const [isStandby, setIsStandby] = useState(initialStandbyMode);
  const [isScanned, setIsScanned] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'webcam-scanner-viewport';
  const lastScannedTimeRef = useRef<number>(0);
  const usbBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Audio feedback helper
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  };

  const handleSuccessfulScan = (code: string) => {
    const now = Date.now();
    // Debounce duplicate scans within 1.2 seconds
    if (now - lastScannedTimeRef.current < 1200 && code === lastCode) {
      return;
    }
    lastScannedTimeRef.current = now;

    playBeep();
    setIsScanned(true);
    setLastCode(code);
    onScanSuccess(code);

    setTimeout(() => {
      setIsScanned(false);
      if (!isStandby) {
        onClose();
      }
    }, 1100);
  };

  // 1. Initialize Html5Qrcode camera scanner
  useEffect(() => {
    if (!isOpen) return;

    setIsScanned(false);
    setLastCode(null);
    setCameraError(null);
    setIsCameraActive(false);

    let html5QrCode: Html5Qrcode | null = null;
    let isCancelled = false;

    // Small delay to ensure container element is mounted
    const timer = setTimeout(() => {
      const container = document.getElementById(scannerContainerId);
      if (!container || isCancelled) return;

      try {
        html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        html5QrCode
          .start(
            { facingMode: 'environment' },
            {
              fps: 15,
              qrbox: { width: 240, height: 240 },
              aspectRatio: 1.333,
            },
            (decodedText) => {
              if (decodedText) {
                handleSuccessfulScan(decodedText.trim());
              }
            },
            () => {
              // Ignore frequent scan misses
            }
          )
          .then(() => {
            if (!isCancelled) {
              setIsCameraActive(true);
            }
          })
          .catch((err) => {
            console.warn('Html5Qrcode start error:', err);
            if (!isCancelled) {
              setCameraError('Camera access denied or unavailable. You can use a USB scanner or quick simulation buttons.');
            }
          });
      } catch (err: any) {
        console.warn('Scanner init error:', err);
        setCameraError(err?.message || 'Failed to initialize scanner');
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {}).finally(() => {
            try {
              scannerRef.current?.clear();
            } catch (_) {}
            scannerRef.current = null;
          });
        } else {
          try {
            scannerRef.current.clear();
          } catch (_) {}
          scannerRef.current = null;
        }
      }
    };
  }, [isOpen]);

  // 2. Listen for USB / Bluetooth handheld hardware barcode gun keystrokes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      // If typing speed is rapid (< 60ms between keys), it's likely a hardware scanner
      if (now - lastKeyTimeRef.current > 100) {
        usbBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const captured = usbBufferRef.current.trim();
        if (captured.length >= 2) {
          e.preventDefault();
          usbBufferRef.current = '';
          handleSuccessfulScan(captured);
        }
      } else if (e.key.length === 1) {
        usbBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isStandby, lastCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Scan className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsStandby(!isStandby)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isStandby ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Continuous standby scanning mode"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isStandby ? 'Continuous Mode ON' : 'Single Capture'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport Box */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Camera className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-amber-400 font-medium">{cameraError}</p>
              <p className="text-[11px] text-slate-500">USB hardware barcode guns still work automatically.</p>
            </div>
          ) : (
            <div 
              id={scannerContainerId} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Visual Scan Success Overlay Banner */}
          {isScanned && (
            <div className="absolute inset-0 bg-emerald-950/60 flex items-center justify-center backdrop-blur-[2px] transition-all z-20">
              <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-full flex items-center space-x-2.5 shadow-2xl animate-bounce">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-bold tracking-wide">{lastCode}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Simulation Quick Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>📷 Align 1D Barcode or QR Code within the viewfinder</span>
            <span className="text-indigo-400 font-medium">⚡ USB Gun Ready</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-800/60">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Simulate:</span>
            <button
              type="button"
              onClick={() => handleSuccessfulScan('8901030383321')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition-colors"
            >
              8901030383321 (EAN)
            </button>
            <button
              type="button"
              onClick={() => handleSuccessfulScan('SKU-RICE-001')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition-colors"
            >
              SKU-RICE-001
            </button>
            <button
              type="button"
              onClick={() => handleSuccessfulScan('ITEM:ITM-1001')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition-colors"
            >
              ITEM:ITM-1001
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
