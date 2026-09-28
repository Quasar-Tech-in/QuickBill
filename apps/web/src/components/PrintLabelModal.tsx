import React, { useState, useEffect } from 'react';
import { Printer, X, Tag, Gem, Check, Download, Eye, QrCode } from 'lucide-react';
import axios from 'axios';
import QRCode from 'qrcode';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

interface PrintLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName?: string;
  itemSku?: string;
  itemPrice?: number;
  itemMrp?: number;
  publicItemId?: string;
  defaultStockCount?: number;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  isOpen,
  onClose,
  itemName = 'Organic Almond Milk 1L',
  itemSku = 'SKU-MILK-1',
  itemPrice = 240,
  itemMrp = 260,
  publicItemId = 'ITM-1001',
  defaultStockCount = 10,
}) => {
  const [style, setStyle] = useState<'STANDARD' | 'JEWELRY_STRING_TAG' | 'SHELF' | 'SHIPPING'>('STANDARD');
  const [paperSize, setPaperSize] = useState<'THERMAL_50x30' | 'DUMBBELL_70x12' | 'A4_GRID_24' | 'A4_GRID_40' | 'SHIPPING_4x6'>('THERMAL_50x30');
  const [quantity, setQuantity] = useState(defaultStockCount || 10);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const barcodePayload = publicItemId ? `ITEM:${publicItemId}` : (itemSku || 'ITM-1001');

  // Generate crisp real QR code image for live preview
  useEffect(() => {
    if (isOpen && barcodePayload) {
      QRCode.toDataURL(barcodePayload, {
        width: 200,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('Preview QR error:', err));
    }
  }, [isOpen, barcodePayload]);

  if (!isOpen) return null;

  const handleStyleSelect = (newStyle: 'STANDARD' | 'JEWELRY_STRING_TAG' | 'SHELF' | 'SHIPPING') => {
    setStyle(newStyle);
    if (newStyle === 'JEWELRY_STRING_TAG') {
      setPaperSize('DUMBBELL_70x12');
    } else if (newStyle === 'SHIPPING') {
      setPaperSize('SHIPPING_4x6');
    } else if (newStyle === 'STANDARD') {
      setPaperSize('THERMAL_50x30');
    }
  };

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const payload = {
        itemName,
        sku: itemSku,
        salePrice: itemPrice,
        mrp: itemMrp,
        publicItemId,
        style,
        paperSize,
        quantity,
        showPrice,
        showMrp,
        showSku,
        showStoreName,
        storeName: 'QuickBill Store',
      };

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/labels/custom-pdf`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      // Create downloadable PDF Blob URL
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Label_${itemSku || 'Item'}_${paperSize}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.warn('PDF generation endpoint error:', err);
      // Fallback: Trigger browser direct print window
      window.print();
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectPrintWindow = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: 680, 
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div 
          className="no-print"
          style={{ 
            padding: '16px 24px', 
            borderBottom: '1px solid var(--neutral-200)', 
            backgroundColor: '#ffffff',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Printer size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                Item Barcode & String Tag Printer
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                Customize label templates, paper formats, copies, and display elements
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} style={{ width: 32, height: 32 }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div className="no-print" style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 1. Label Style Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Select Label Style & Template
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {/* Standard Retail Tag */}
              <div 
                onClick={() => handleStyleSelect('STANDARD')}
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${style === 'STANDARD' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                  backgroundColor: style === 'STANDARD' ? 'var(--primary-50)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: style === 'STANDARD' ? 'var(--primary-600)' : 'var(--neutral-100)', color: style === 'STANDARD' ? '#ffffff' : 'var(--neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Tag size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: style === 'STANDARD' ? 'var(--primary-900, #1e1b4b)' : 'var(--neutral-900)' }}>
                    Standard Retail Sticker
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    Thermal roll stickers for items & boxes
                  </div>
                </div>
              </div>

              {/* Jewelry / Dumbbell String Tag */}
              <div 
                onClick={() => handleStyleSelect('JEWELRY_STRING_TAG')}
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${style === 'JEWELRY_STRING_TAG' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                  backgroundColor: style === 'JEWELRY_STRING_TAG' ? 'var(--primary-50)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: style === 'JEWELRY_STRING_TAG' ? '#d97706' : 'var(--neutral-100)', color: style === 'JEWELRY_STRING_TAG' ? '#ffffff' : 'var(--neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Gem size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: style === 'JEWELRY_STRING_TAG' ? 'var(--primary-900, #1e1b4b)' : 'var(--neutral-900)' }}>
                    Jewelry / String Tag
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    Dumbbell dual-wing with non-adhesive bridge
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Paper Size & Grid Format */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Paper Size & Layout Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <button
                type="button"
                onClick={() => setPaperSize('THERMAL_50x30')}
                style={{
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${paperSize === 'THERMAL_50x30' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                  backgroundColor: paperSize === 'THERMAL_50x30' ? 'var(--primary-50)' : '#ffffff',
                  color: paperSize === 'THERMAL_50x30' ? 'var(--primary-700)' : 'var(--neutral-700)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>50 x 30 mm</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>Thermal Roll</div>
              </button>

              <button
                type="button"
                onClick={() => setPaperSize('DUMBBELL_70x12')}
                style={{
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${paperSize === 'DUMBBELL_70x12' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                  backgroundColor: paperSize === 'DUMBBELL_70x12' ? 'var(--primary-50)' : '#ffffff',
                  color: paperSize === 'DUMBBELL_70x12' ? 'var(--primary-700)' : 'var(--neutral-700)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>70 x 12 mm</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>Dumbbell Tag</div>
              </button>

              <button
                type="button"
                onClick={() => setPaperSize('A4_GRID_24')}
                style={{
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${paperSize === 'A4_GRID_24' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                  backgroundColor: paperSize === 'A4_GRID_24' ? 'var(--primary-50)' : '#ffffff',
                  color: paperSize === 'A4_GRID_24' ? 'var(--primary-700)' : 'var(--neutral-700)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>A4 (24-Up)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>3x8 Grid Sheet</div>
              </button>

              <button
                type="button"
                onClick={() => setPaperSize('A4_GRID_40')}
                style={{
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${paperSize === 'A4_GRID_40' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                  backgroundColor: paperSize === 'A4_GRID_40' ? 'var(--primary-50)' : '#ffffff',
                  color: paperSize === 'A4_GRID_40' ? 'var(--primary-700)' : 'var(--neutral-700)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>A4 (40-Up)</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>4x10 Grid Sheet</div>
              </button>
            </div>
          </div>

          {/* 3. Interactive Real Barcode & QR Preview Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Live Vector Barcode & QR Preview
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Eye size={12} />
                <span>Exact Layout Render</span>
              </span>
            </div>

            <div 
              style={{ 
                padding: 20, 
                backgroundColor: 'var(--neutral-50)', 
                border: '1.5px dashed var(--neutral-300)', 
                borderRadius: 'var(--radius-md)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: 130
              }}
            >
              {style === 'JEWELRY_STRING_TAG' ? (
                /* Dumbbell / Jewelry String Tag Graphic Preview with Real QR */
                <div 
                  style={{ 
                    width: '100%', 
                    maxWidth: 500, 
                    height: 70, 
                    backgroundColor: '#ffffff', 
                    border: '1.5px solid var(--neutral-300)', 
                    borderRadius: 8, 
                    boxShadow: 'var(--shadow-sm)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '0 10px',
                    position: 'relative'
                  }}
                >
                  {/* Left Wing (Store + Price & Title) */}
                  <div style={{ flex: '2', paddingRight: 8 }}>
                    {showStoreName && <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--neutral-800)' }}>QuickBill Store</div>}
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemName}</div>
                    {showPrice && <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary-700)' }}>₹{itemPrice}.00</div>}
                  </div>

                  {/* Middle Non-Adhesive String Bridge */}
                  <div 
                    style={{ 
                      width: 54, 
                      height: 28, 
                      borderTop: '1.5px solid var(--neutral-300)', 
                      borderBottom: '1.5px solid var(--neutral-300)', 
                      backgroundColor: 'var(--neutral-100)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.62rem',
                      color: 'var(--neutral-400)',
                      fontWeight: 600
                    }}
                  >
                    Bridge
                  </div>

                  {/* Right Wing (Real QR Image & Barcode ID) */}
                  <div style={{ flex: '2', paddingLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#000000' }}>
                        {barcodePayload}
                      </div>
                      {showSku && <div style={{ fontSize: '0.62rem', color: 'var(--neutral-500)', fontWeight: 700 }}>SKU: {itemSku}</div>}
                    </div>

                    {qrDataUrl && (
                      <img src={qrDataUrl} alt="QR Code Tag" style={{ width: 44, height: 44, borderRadius: 4, border: '1px solid var(--neutral-200)' }} />
                    )}
                  </div>
                </div>
              ) : (
                /* Standard Sticker Preview with Real QR */
                <div 
                  style={{ 
                    width: 240, 
                    padding: 12, 
                    backgroundColor: '#ffffff', 
                    border: '1.5px solid var(--neutral-300)', 
                    borderRadius: 8, 
                    boxShadow: 'var(--shadow-sm)', 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  {showStoreName && <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--neutral-900)' }}>QuickBill Store</div>}
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '3px 0' }}>{itemName}</div>
                  
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code Tag" style={{ width: 80, height: 80, margin: '4px 0' }} />
                  ) : (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 800 }}>{barcodePayload}</div>
                  )}

                  <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-600)', marginBottom: 4 }}>
                    {barcodePayload}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.72rem', color: 'var(--neutral-600)', paddingTop: 4, borderTop: '1px solid var(--neutral-200)' }}>
                    {showSku && <span>SKU: {itemSku}</span>}
                    {showPrice && <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.82rem' }}>₹{itemPrice}.00</span>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Print Quantity & Content Element Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {/* Quantity Stepper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Print Quantity Copies
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="btn btn-secondary"
                  style={{ width: 36, height: 36, padding: 0, justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}
                >
                  -
                </button>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, width: 44, textAlign: 'center', color: 'var(--neutral-900)' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="btn btn-secondary"
                  style={{ width: 36, height: 36, padding: 0, justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}
                >
                  +
                </button>

                <button
                  type="button"
                  onClick={() => setQuantity(defaultStockCount)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary-50)',
                    color: 'var(--primary-700)',
                    border: '1px solid var(--primary-200)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Sync Stock ({defaultStockCount})
                </button>
              </div>
            </div>

            {/* Element Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Label Element Options
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', color: 'var(--neutral-700)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                  />
                  <span>Show Sale Price</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                  />
                  <span>Show SKU / Item Barcode ID</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                  />
                  <span>Show Business Header</span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* Printable Printable Container for Direct Browser Window Printing */}
        <div className="only-print" style={{ display: 'none', padding: 20 }}>
          <div style={{ textAlign: 'center', border: '1px solid #000', padding: 10, width: 220, margin: '0 auto' }}>
            {showStoreName && <div style={{ fontSize: 10, fontWeight: 'bold' }}>QuickBill Store</div>}
            <div style={{ fontSize: 12, fontWeight: 'bold', margin: '4px 0' }}>{itemName}</div>
            {qrDataUrl && <img src={qrDataUrl} style={{ width: 100, height: 100, margin: '4px auto', display: 'block' }} />}
            <div style={{ fontFamily: 'monospace', fontSize: 10 }}>{barcodePayload}</div>
            {showPrice && <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>₹{itemPrice}.00</div>}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div 
          className="no-print"
          style={{ 
            padding: '14px 24px', 
            borderTop: '1px solid var(--neutral-200)', 
            backgroundColor: 'var(--neutral-50)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end',
            gap: 10,
            flexShrink: 0
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDirectPrintWindow}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={16} />
            <span>Print Window</span>
          </button>

          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleDownloadPdf} 
            disabled={isGenerating}
            style={{ padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={16} />
            <span>{isGenerating ? 'Generating PDF...' : `Download ${quantity} Labels PDF`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
