import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Zap, RefreshCw, CheckCircle2, QrCode } from 'lucide-react';

interface WebcamScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcodeData: string) => void;
  initialStandbyMode?: boolean;
}

export const WebcamScannerModal: React.FC<WebcamScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  initialStandbyMode = true,
}) => {
  const [isStandby, setIsStandby] = useState(initialStandbyMode);
  const [isScanned, setIsScanned] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsScanned(false);
      setLastCode(null);
      setCameraError(null);

      // Start desktop webcam stream
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn('Webcam access failed:', err);
          setCameraError('Webcam not detected or permission denied. You can use simulation buttons below or USB scanner.');
        });
    } else {
      // Stop webcam stream when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulateScan = (code: string) => {
    setIsScanned(true);
    setLastCode(code);
    onScanSuccess(code);

    setTimeout(() => {
      setIsScanned(false);
      if (!isStandby) {
        onClose();
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">Desktop Barcode & QR Scanner</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsStandby(!isStandby)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isStandby ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isStandby ? 'Standby Mode ON' : 'Single Scan'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video / Camera Viewport Area */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <Camera className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-amber-400 font-medium">{cameraError}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Viewfinder Target Cutout */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-64 h-64 border-2 rounded-2xl transition-all duration-300 relative flex items-center justify-center ${
              isScanned ? 'border-emerald-500 bg-emerald-500/20' : 'border-indigo-500/80 bg-transparent'
            }`}>
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />

              {isScanned ? (
                <div className="bg-emerald-600 text-white px-4 py-2 rounded-full flex items-center space-x-2 shadow-lg animate-bounce">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-xs font-bold">{lastCode}</span>
                </div>
              ) : (
                <div className="w-48 h-0.5 bg-indigo-500/70 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              )}
            </div>
          </div>
        </div>

        {/* Bottom Simulation Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-400 font-medium text-center">
            {isStandby
              ? '📱 Desktop Standby Scanner Active (Fast USB hardware scanner also supported)'
              : 'Point camera at product QR code or retail barcode'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={() => handleSimulateScan('ITEM:ITM-1001')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              🍚 Basmati Rice
            </button>
            <button
              onClick={() => handleSimulateScan('JW-RING-99')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              💍 Diamond Ring
            </button>
            <button
              onClick={() => handleSimulateScan('SHIP:ORD-9842')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              📦 Order ORD-9842
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
