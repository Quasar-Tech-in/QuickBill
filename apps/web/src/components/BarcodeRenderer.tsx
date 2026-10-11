import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export interface BarcodeRendererRef {
  getDataUrl: () => Promise<string | null>;
}

export interface BarcodeRendererProps {
  value: string;
  codeType: 'BARCODE' | 'QR';
  width?: number; // bar width for barcode, or total px width for QR
  height?: number; // bar height for barcode, or total px height for QR
  showText?: boolean;
  altText?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const BarcodeRenderer = forwardRef<BarcodeRendererRef, BarcodeRendererProps>(({
  value,
  codeType,
  width = 1.8,
  height = 50,
  showText = true,
  altText,
  className,
  style,
}, ref) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Clean payload
  const cleanValue = (value || '').trim();

  // Render 1D Barcode or 2D QR
  useEffect(() => {
    setError(null);
    if (!cleanValue) {
      setError('No code provided');
      return;
    }

    if (codeType === 'BARCODE') {
      if (svgRef.current) {
        try {
          JsBarcode(svgRef.current, cleanValue, {
            format: 'CODE128',
            width: typeof width === 'number' && width <= 4 ? width : 1.8,
            height: typeof height === 'number' ? height : 50,
            displayValue: showText,
            text: altText || cleanValue,
            font: 'monospace',
            fontOptions: 'bold',
            fontSize: 13,
            textMargin: 3,
            margin: 6,
            background: 'transparent',
            lineColor: '#0f172a',
          });
        } catch (err: any) {
          console.warn('JsBarcode render error:', err);
          setError(err?.message || 'Invalid barcode format');
        }
      }
    } else {
      // QR Code
      const qrSize = typeof height === 'number' && height > 60 ? height : 180;
      QRCode.toDataURL(cleanValue, {
        width: qrSize,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.warn('QRCode render error:', err);
          setError(err?.message || 'Error generating QR code');
        });
    }
  }, [cleanValue, codeType, width, height, showText, altText]);

  // Imperative handle to get image data URL for export / download
  useImperativeHandle(ref, () => ({
    getDataUrl: async () => {
      if (codeType === 'QR') {
        return qrDataUrl || null;
      }

      // Convert 1D Barcode SVG to PNG Data URL
      if (!svgRef.current) return null;
      return new Promise<string | null>((resolve) => {
        try {
          const svgElement = svgRef.current;
          if (!svgElement) return resolve(null);
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const URL = window.URL || window.webkitURL || window;
          const blobURL = URL.createObjectURL(svgBlob);
          const image = new Image();

          image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width || 300;
            canvas.height = image.height || 100;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0);
              const pngUrl = canvas.toDataURL('image/png');
              URL.revokeObjectURL(blobURL);
              resolve(pngUrl);
            } else {
              URL.revokeObjectURL(blobURL);
              resolve(null);
            }
          };

          image.onerror = () => {
            URL.revokeObjectURL(blobURL);
            resolve(null);
          };

          image.src = blobURL;
        } catch (e) {
          console.warn('SVG conversion error:', e);
          resolve(null);
        }
      });
    },
  }));

  if (error) {
    return (
      <div 
        className={className}
        style={{ 
          padding: '8px 12px', 
          backgroundColor: 'var(--neutral-100)', 
          color: 'var(--neutral-600)', 
          borderRadius: 6,
          fontSize: '0.75rem',
          textAlign: 'center',
          ...style 
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cleanValue || 'N/A'}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--neutral-400)', marginTop: 2 }}>({error})</div>
      </div>
    );
  }

  if (codeType === 'QR') {
    return (
      <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...style }}>
        {qrDataUrl ? (
          <img 
            src={qrDataUrl} 
            alt={`QR: ${cleanValue}`} 
            style={{ 
              maxWidth: '100%', 
              height: 'auto', 
              display: 'block',
              borderRadius: 4,
            }} 
          />
        ) : (
          <div style={{ padding: 20, fontSize: '0.8rem', color: 'var(--neutral-400)' }}>Generating QR...</div>
        )}
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', maxWidth: '100%', overflow: 'hidden', ...style }}>
      <svg ref={svgRef} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
    </div>
  );
});

BarcodeRenderer.displayName = 'BarcodeRenderer';
