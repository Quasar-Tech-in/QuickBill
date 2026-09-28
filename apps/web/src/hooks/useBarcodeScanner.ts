import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  maxKeystrokeIntervalMs?: number;
  minBarcodeLength?: number;
}

/**
 * Global keyboard wedge listener for physical USB / Wireless Barcode Scanners.
 * Physical hardware scanners type characters rapidly (< 35ms per key) followed by Enter.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  maxKeystrokeIntervalMs = 45,
  minBarcodeLength = 3,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes when typing inside text inputs, textareas, or editable elements unless scanner sequence starts
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      );

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If time between keys is too long, reset draft buffer
      if (timeDiff > maxKeystrokeIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minBarcodeLength) {
          // If typed inside input, don't submit form automatically
          if (isInput) {
            e.preventDefault();
          }
          const scannedCode = bufferRef.current.trim();
          bufferRef.current = '';
          onScan(scannedCode);
        } else {
          bufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        // Collect single character keys
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, enabled, maxKeystrokeIntervalMs, minBarcodeLength]);
}
