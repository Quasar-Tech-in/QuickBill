import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Zap, CheckCircle2, QrCode, Scan, Radio, HelpCircle, Laptop, ArrowRight, ShieldCheck } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';

interface WebcamScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcodeData: string, isContinuous?: boolean) => void;
  initialStandbyMode?: boolean;
  title?: string;
  initialTab?: 'CAMERA' | 'GUN';
}

export const WebcamScannerModal: React.FC<WebcamScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  initialStandbyMode = false,
  title = 'Barcode & QR Scanner',
  initialTab = 'GUN',
}) => {
  const [activeTab, setActiveTab] = useState<'CAMERA' | 'GUN'>(initialTab);
  const [isStandby, setIsStandby] = useState(initialStandbyMode);
  const [isScanned, setIsScanned] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [testGunInput, setTestGunInput] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStandbyRef = useRef<boolean>(initialStandbyMode);
  const scannerContainerId = 'webcam-scanner-viewport';
  const lastScannedTimeRef = useRef<number>(0);
  const lastCodeRef = useRef<string | null>(null);
  const usbBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const testInputRef = useRef<HTMLInputElement | null>(null);

  // Keep isStandbyRef synchronized with state to prevent stale closure in scanner callbacks
  useEffect(() => {
    isStandbyRef.current = isStandby;
  }, [isStandby]);

  // Audio feedback confirmation beep (880Hz pleasant chirp)
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  };

  const handleSuccessfulScan = (code: string, isHardwareTrigger = false) => {
    const clean = code.trim();
    if (!clean) return;

    const now = Date.now();
    // Throttle duplicate detections:
    // - Camera continuous video stream: 800ms for identical barcode (avoids multi-frame double fires)
    // - Hardware trigger: 600ms debounce
    const throttleWindow = isHardwareTrigger ? 600 : 800;
    if (
      clean.toLowerCase() === (lastCodeRef.current || '').toLowerCase() &&
      now - lastScannedTimeRef.current < throttleWindow
    ) {
      return;
    }
    lastScannedTimeRef.current = now;
    lastCodeRef.current = clean;

    playBeep();
    setIsScanned(true);
    setLastCode(clean);
    setRecentScans((prev) => [clean, ...prev.slice(0, 4)]);

    const continuousActive = isStandbyRef.current;
    onScanSuccess(clean, continuousActive);

    setTimeout(() => {
      setIsScanned(false);
      // Close ONLY if NOT in continuous / multi-capture mode
      if (!isStandbyRef.current) {
        onClose();
      }
    }, 700);
  };

  // 1. Detect available cameras
  useEffect(() => {
    if (!isOpen || activeTab !== 'CAMERA') return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          if (!selectedCameraId) {
            // Prefer back/environment camera if found
            const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('Unable to query camera devices:', err);
      });
  }, [isOpen, activeTab]);

  // 2. Start / stop Html5Qrcode camera stream
  useEffect(() => {
    if (!isOpen || activeTab !== 'CAMERA') return;

    setIsScanned(false);
    setCameraError(null);

    let html5QrCode: Html5Qrcode | null = null;
    let isCancelled = false;

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

        const cameraConfig = selectedCameraId 
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: 'environment' };

        html5QrCode
          .start(
            cameraConfig,
            {
              fps: 20,
              qrbox: { width: 250, height: 220 },
              aspectRatio: 1.6,
            },
            (decodedText) => {
              if (decodedText) {
                handleSuccessfulScan(decodedText);
              }
            },
            () => {}
          )
          .catch((err) => {
            console.warn('Camera start error:', err);
            if (!isCancelled) {
              setCameraError('Camera access unavailable or denied. Switch to Hardware Gun mode or connect a USB scanner.');
            }
          });
      } catch (err: any) {
        if (!isCancelled) {
          setCameraError(err?.message || 'Failed to start camera');
        }
      }
    }, 120);

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
  }, [isOpen, activeTab, selectedCameraId]);

  // 3. Listen for USB / Bluetooth handheld hardware barcode gun keystrokes globally in modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      // Physical scanner typing speed is superhuman (< 60ms between consecutive keystrokes)
      if (now - lastKeyTimeRef.current > 90) {
        usbBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const captured = usbBufferRef.current.trim();
        if (captured.length >= 2) {
          e.preventDefault();
          usbBufferRef.current = '';
          handleSuccessfulScan(captured, true);
        }
      } else if (e.key.length === 1) {
        usbBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isStandby, lastCode]);

  // Focus test input when opening GUN tab or when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setTestGunInput('');
      setIsScanned(false);
      setLastCode(null);
      if (initialTab === 'GUN' || activeTab === 'GUN') {
        setTimeout(() => {
          testInputRef.current?.focus();
        }, 100);
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (activeTab === 'GUN' && testInputRef.current) {
      testInputRef.current.focus();
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 10000, 
        backgroundColor: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div 
        className="scanner-hud-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(99, 102, 241, 0.25)',
        }}
      >
        {/* Top HUD Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5 0%, #38bdf8 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(79, 70, 229, 0.5)'
            }}>
              <Scan size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {title}
              </h3>
              <p style={{ fontSize: '0.73rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                Instant capture via Camera or 2D/1D Hardware Scanner Gun
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsStandby(!isStandby)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.72rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
                backgroundColor: isStandby ? '#4f46e5' : 'rgba(255, 255, 255, 0.07)',
                color: isStandby ? '#ffffff' : '#94a3b8',
                boxShadow: isStandby ? '0 0 12px rgba(79, 70, 229, 0.5)' : 'none'
              }}
              title="Continuous scanning without closing after one code"
            >
              <Zap size={13} />
              <span>{isStandby ? 'Continuous Mode ON' : 'Single Capture'}</span>
            </button>

            {isStandby && recentScans.length > 0 && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                }}
              >
                <CheckCircle2 size={13} />
                <span>Done ({recentScans.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.07)',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'inline-flex',
            padding: 3,
            backgroundColor: 'rgba(2, 6, 23, 0.6)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              type="button"
              className={`scanner-mode-tab ${activeTab === 'GUN' ? 'active' : ''}`}
              onClick={() => setActiveTab('GUN')}
            >
              <Radio size={14} />
              <span>Barcode Scanner (Primary)</span>
            </button>

            <button
              type="button"
              className={`scanner-mode-tab ${activeTab === 'CAMERA' ? 'active' : ''}`}
              onClick={() => setActiveTab('CAMERA')}
            >
              <Camera size={14} />
              <span>Phone / Webcam Camera</span>
            </button>
          </div>

          {activeTab === 'CAMERA' && cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${c.id.substring(0, 6)}`}
                </option>
              ))}
            </select>
          )}

          {activeTab === 'GUN' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
              <div className="scanner-pulse-dot" />
              <span>Gun Listener Active</span>
            </div>
          )}
        </div>

        {/* Tab Body Content */}
        <div style={{ padding: 20 }}>
          {activeTab === 'CAMERA' ? (
            /* ================= MODE 1: CAMERA VIEWFINDER ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="scanner-viewport-wrapper">
                {cameraError ? (
                  <div style={{ padding: 24, textAlign: 'center', maxWidth: 380 }}>
                    <div style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto'
                    }}>
                      <Camera size={26} />
                    </div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f87171' }}>
                      Camera Access Unavailable
                    </div>
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '6px 0 14px 0', lineHeight: 1.4 }}>
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('GUN')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Radio size={14} />
                      <span>Switch to Hardware Gun Mode</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Raw Video Target Mounted by Html5Qrcode */}
                    <div id={scannerContainerId} />

                    {/* Cyberpunk HUD Reticle & Corner Brackets */}
                    <div className="scanner-reticle-box">
                      <div className="scanner-corner tl" />
                      <div className="scanner-corner tr" />
                      <div className="scanner-corner bl" />
                      <div className="scanner-corner br" />

                      {/* Animated Laser Line */}
                      <div className="scanner-laser-sweep" />
                    </div>
                  </>
                )}

                {/* Success Detected Overlay Banner */}
                {isScanned && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(6, 78, 59, 0.75)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 30,
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      padding: '10px 22px',
                      borderRadius: 9999,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 10px 25px rgba(5, 150, 105, 0.5)',
                      animation: 'bounce 0.6s infinite alternate'
                    }}>
                      <CheckCircle2 size={22} />
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                        {lastCode}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.73rem',
                color: '#94a3b8'
              }}>
                <span>📷 Position QR Code or Barcode flat within the laser reticle</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>Auto-Focus 15 FPS</span>
              </div>

              {isStandby && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(2, 6, 23, 0.75)',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.73rem'
                }}>
                  <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <CheckCircle2 size={13} />
                    <span>Multi-Capture Log ({recentScans.length}):</span>
                  </span>
                  {recentScans.length === 0 ? (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>Point camera at items in sequence...</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
                      {recentScans.map((scannedItem, idx) => (
                        <span
                          key={`${scannedItem}-${idx}`}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            backgroundColor: idx === 0 ? 'rgba(79, 70, 229, 0.45)' : 'rgba(255, 255, 255, 0.06)',
                            color: idx === 0 ? '#ffffff' : '#94a3b8',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {scannedItem}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ================= MODE 2: HARDWARE SCANNER GUN ================= */
            <div className="scanner-gun-bench" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Top Status Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.25)'
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 16px rgba(79, 70, 229, 0.5)'
                }}>
                  <Laptop size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                    Hardware Barcode Scanner Ready (Primary)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: 2 }}>
                    Standard USB, 2.4GHz Wireless Dongle, or Bluetooth guns are recognized automatically without opening your camera.
                  </div>
                </div>
              </div>

              {/* Primary Gun Trigger / Input Box */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(2, 6, 23, 0.75)',
                border: '1.5px dashed rgba(99, 102, 241, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1' }}>
                    Scanner Input (Auto-Captured on Gun Trigger):
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span className="scanner-pulse-dot" style={{ width: 6, height: 6 }} />
                    <span>Listening for Barcode</span>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    ref={testInputRef}
                    type="text"
                    value={testGunInput}
                    onChange={(e) => setTestGunInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && testGunInput.trim()) {
                        e.preventDefault();
                        handleSuccessfulScan(testGunInput.trim(), true);
                        setTestGunInput('');
                      }
                    }}
                    placeholder="Point scanner gun at barcode & pull trigger, or enter code..."
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (testGunInput.trim()) {
                        handleSuccessfulScan(testGunInput.trim(), true);
                        setTestGunInput('');
                      }
                    }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      backgroundColor: '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)'
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Accept</span>
                  </button>
                </div>
              </div>

              {/* Toggle to Phone / Device Camera Button */}
              <button
                type="button"
                onClick={() => setActiveTab('CAMERA')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px 16px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                <Camera size={16} />
                <span>On Phone or Tablet? Switch to Camera Scanner</span>
                <ArrowRight size={14} />
              </button>

              {/* Step-by-Step Instructions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  How to Use Your Barcode Gun:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  <div style={{ padding: 10, borderRadius: 10, backgroundColor: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38bdf8' }}>1. Plug & Play</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>
                      Connect your gun via USB or wireless dongle.
                    </div>
                  </div>

                  <div style={{ padding: 10, borderRadius: 10, backgroundColor: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#818cf8' }}>2. Point & Trigger</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>
                      Aim red laser at barcode and pull trigger.
                    </div>
                  </div>

                  <div style={{ padding: 10, borderRadius: 10, backgroundColor: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#34d399' }}>3. Auto Captured</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>
                      QuickBill captures the code & populates the form.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Simulation Bar */}
          <div style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
              Quick Test Simulation:
            </span>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleSuccessfulScan('8901030383321', true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                8901030383321 (EAN)
              </button>

              <button
                type="button"
                onClick={() => handleSuccessfulScan('SKU-RICE-001', true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                SKU-RICE-001
              </button>

              <button
                type="button"
                onClick={() => handleSuccessfulScan('ITEM:ITM-1001', true)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                ITEM:ITM-1001 (QR)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
