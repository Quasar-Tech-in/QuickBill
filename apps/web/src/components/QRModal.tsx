import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Download, QrCode } from 'lucide-react';
import { Item } from '../types';

interface QRModalProps {
  item: Item;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({ item, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrPayload = `ITEM:${item.publicItemId}`;

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR:', err));
  }, [qrPayload]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${item.publicItemId}_${item.name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={20} color="var(--primary-500)" />
            <span className="card-title">Item QR Code Tag</span>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="card-body" style={{ textAlign: 'center' }}>
          <div
            style={{
              padding: 20,
              backgroundColor: '#f8fafc',
              border: '2px dashed var(--neutral-300)',
              borderRadius: 'var(--radius-lg)',
              display: 'inline-block',
              marginBottom: 16,
            }}
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Item QR" style={{ width: 220, height: 220, display: 'block' }} />
            ) : (
              <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Generating QR...
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--neutral-900)' }}>
                {item.publicItemId}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--neutral-700)', marginTop: 2 }}>
                {item.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--primary-600)', fontWeight: 700, marginTop: 4 }}>
                ₹{item.salePrice.toFixed(2)} (Tax: {item.taxRate}%)
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginBottom: 20 }}>
            Scan this QR barcode using the QuickBill Mobile Camera scanner to instantly add to POS carts.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleDownload}>
              <Download size={16} />
              <span>Download PNG</span>
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} />
              <span>Print Sticker</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
