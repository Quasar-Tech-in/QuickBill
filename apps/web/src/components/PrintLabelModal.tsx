import React, { useState, useRef, useEffect } from 'react';
import { Printer, X, Tag, Gem, Download, Eye, QrCode, FileText, Copy, Check, Sparkles } from 'lucide-react';
import { apiClient, store } from '../services/store';
import { BarcodeRenderer, BarcodeRendererRef } from './BarcodeRenderer';

interface PrintLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName?: string;
  itemSku?: string;
  itemBarcode?: string;
  itemPrice?: number;
  itemMrp?: number;
  publicItemId?: string;
  defaultStockCount?: number;
  initialCodeType?: 'BARCODE' | 'QR';
  storeName?: string;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  isOpen,
  onClose,
  itemName = 'Product Item',
  itemSku = 'SKU-001',
  itemBarcode = '',
  itemPrice = 0,
  itemMrp = 0,
  publicItemId = 'ITM-1001',
  defaultStockCount = 10,
  initialCodeType = 'BARCODE',
  storeName: propStoreName,
}) => {
  const resolveInitialStoreName = () => {
    return (propStoreName || store.getActiveTenant()?.name || store.getCurrentUser()?.tenantName || store.getActiveLocation()?.name || 'QuickBill Store').trim();
  };

  const [codeType, setCodeType] = useState<'BARCODE' | 'QR'>(initialCodeType);
  const [qrSizePreset, setQrSizePreset] = useState<'COMPACT' | 'STANDARD' | 'LARGE'>('STANDARD');
  const [style, setStyle] = useState<'STANDARD' | 'JEWELRY_STRING_TAG' | 'SHELF' | 'SHIPPING'>('STANDARD');
  const [paperSize, setPaperSize] = useState<'THERMAL_50x30' | 'THERMAL_40x40' | 'THERMAL_38x25' | 'DUMBBELL_70x12' | 'A4_GRID_24' | 'A4_GRID_40' | 'SHIPPING_4x6'>('THERMAL_50x30');
  const [quantity, setQuantity] = useState(defaultStockCount || 10);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [storeName, setStoreName] = useState<string>(resolveInitialStoreName);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStoreName(resolveInitialStoreName());
    }
  }, [isOpen, propStoreName]);

  const barcodeRendererRef = useRef<BarcodeRendererRef | null>(null);

  // Determine standard payload strings
  const barcodeValue = (itemBarcode || itemSku || publicItemId || 'ITM-1001').replace(/^ITEM:/, '').trim();
  const qrValue = publicItemId 
    ? (publicItemId.startsWith('ITEM:') ? publicItemId : `ITEM:${publicItemId}`) 
    : (itemBarcode || itemSku || 'ITM-1001');

  const activePayload = codeType === 'QR' ? qrValue : barcodeValue;

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

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(activePayload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (err) {
      console.warn('Failed to copy payload:', err);
    }
  };

  const handleDownloadCodeImage = async () => {
    if (!barcodeRendererRef.current) return;
    setIsDownloadingImage(true);
    try {
      const dataUrl = await barcodeRendererRef.current.getDataUrl();
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        const safeName = (itemName || 'Product').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `${codeType}_${barcodeValue}_${safeName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.warn('Failed to export code image:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const payload = {
        itemName,
        sku: itemSku,
        barcode: itemBarcode || barcodeValue,
        salePrice: itemPrice,
        mrp: itemMrp,
        publicItemId,
        style,
        paperSize,
        codeType,
        quantity,
        showPrice,
        showMrp,
        showSku,
        showStoreName,
        storeName: storeName || 'Store',
      };

      const response = await apiClient.post('/labels/custom-pdf', payload, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Label_${codeType}_${itemSku || barcodeValue}_${paperSize}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.warn('PDF generation endpoint error:', err);
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
        className="modal-content modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: 750, 
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
              {codeType === 'QR' ? <QrCode size={22} /> : <Tag size={22} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
                Item Barcode &amp; QR Studio
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                Generate crisp labels, QR stickers, and print thermal rolls or A4 sheets
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} style={{ width: 32, height: 32 }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div className="no-print" style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 1. Code Type Format Selector (Barcode vs QR) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Code Representation Type
              </label>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: 'var(--neutral-600)' }}>
                <span>Payload:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700, backgroundColor: 'var(--neutral-100)', padding: '1px 6px', borderRadius: 4 }}>
                  {activePayload}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedPayload ? 'var(--success-700)' : 'var(--primary-600)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    padding: '1px 4px'
                  }}
                  title="Copy code value to clipboard"
                >
                  {copiedPayload ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="modal-grid-row-2">
              <div 
                onClick={() => setCodeType('BARCODE')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${codeType === 'BARCODE' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                  backgroundColor: codeType === 'BARCODE' ? 'var(--primary-50)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: codeType === 'BARCODE' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 8, 
                    backgroundColor: codeType === 'BARCODE' ? 'var(--primary-600)' : 'var(--neutral-100)', 
                    color: codeType === 'BARCODE' ? '#ffffff' : 'var(--neutral-600)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>
                    <Tag size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: codeType === 'BARCODE' ? 'var(--primary-900)' : 'var(--neutral-900)' }}>
                      1D Linear Barcode
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                      Standard laser gun scanner (Code 128)
                    </div>
                  </div>
                </div>
                {codeType === 'BARCODE' && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--primary-700)', backgroundColor: '#ffffff', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--primary-300)' }}>
                    Active
                  </span>
                )}
              </div>

              <div 
                onClick={() => setCodeType('QR')}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${codeType === 'QR' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                  backgroundColor: codeType === 'QR' ? 'var(--primary-50)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: codeType === 'QR' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 8, 
                    backgroundColor: codeType === 'QR' ? 'var(--primary-600)' : 'var(--neutral-100)', 
                    color: codeType === 'QR' ? '#ffffff' : 'var(--neutral-600)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>
                    <QrCode size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: codeType === 'QR' ? 'var(--primary-900)' : 'var(--neutral-900)' }}>
                      2D QR Code
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                      Camera scanner &amp; QuickBill App format
                    </div>
                  </div>
                </div>
                {codeType === 'QR' && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--primary-700)', backgroundColor: '#ffffff', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--primary-300)' }}>
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Interactive Live Vector Code & Sticker Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Live Layout Preview
              </label>

              {/* QR Sizing Switcher (if QR mode active) */}
              {codeType === 'QR' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: 'var(--neutral-100)', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-500)', padding: '0 4px' }}>QR Size:</span>
                  {(['COMPACT', 'STANDARD', 'LARGE'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setQrSizePreset(sz)}
                      style={{
                        padding: '2px 7px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        backgroundColor: qrSizePreset === sz ? '#ffffff' : 'transparent',
                        color: qrSizePreset === sz ? 'var(--primary-700)' : 'var(--neutral-600)',
                        boxShadow: qrSizePreset === sz ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {sz === 'COMPACT' ? '25mm' : sz === 'STANDARD' ? '35mm' : '50mm'}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDownloadCodeImage}
                  disabled={isDownloadingImage}
                  style={{ padding: '3px 9px', fontSize: '0.73rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Download size={13} />
                  <span>{isDownloadingImage ? 'Exporting...' : `Download ${codeType} PNG`}</span>
                </button>
              </div>
            </div>

            <div 
              style={{ 
                padding: 18, 
                backgroundColor: 'var(--neutral-50)', 
                border: '1.5px dashed var(--neutral-300)', 
                borderRadius: 'var(--radius-md)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: 140
              }}
            >
              {style === 'JEWELRY_STRING_TAG' ? (
                /* Dumbbell / Jewelry String Tag Graphic Preview */
                <div 
                  style={{ 
                    width: '100%', 
                    maxWidth: 520, 
                    height: 74, 
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
                    {showStoreName && <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--neutral-800)' }}>{storeName || 'Store'}</div>}
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemName}</div>
                    {showPrice && <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary-700)' }}>₹{itemPrice.toFixed(2)}</div>}
                  </div>

                  {/* Middle Non-Adhesive String Bridge */}
                  <div 
                    style={{ 
                      width: 52, 
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

                  {/* Right Wing (Dynamic Code) */}
                  <div style={{ flex: '2', paddingLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#000000' }}>
                        {barcodeValue}
                      </div>
                      {showSku && <div style={{ fontSize: '0.62rem', color: 'var(--neutral-500)', fontWeight: 700 }}>SKU: {itemSku}</div>}
                    </div>

                    <BarcodeRenderer
                      ref={barcodeRendererRef}
                      value={activePayload}
                      codeType={codeType}
                      width={codeType === 'BARCODE' ? 1.0 : undefined}
                      height={codeType === 'BARCODE' ? 32 : 46}
                      showText={false}
                    />
                  </div>
                </div>
              ) : (
                /* Standard Retail Sticker Preview */
                <div 
                  style={{ 
                    width: paperSize === 'THERMAL_40x40' ? 220 : 250, 
                    padding: '12px 14px', 
                    backgroundColor: '#ffffff', 
                    border: '1.5px solid var(--neutral-300)', 
                    borderRadius: 8, 
                    boxShadow: 'var(--shadow-sm)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                >
                  {showStoreName && <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--neutral-900)' }}>{storeName || 'Store'}</div>}
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--neutral-800)', margin: '3px 0', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemName}
                  </div>
                  
                  <div style={{ margin: '6px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <BarcodeRenderer
                      ref={barcodeRendererRef}
                      value={activePayload}
                      codeType={codeType}
                      width={codeType === 'BARCODE' ? 1.6 : qrSizePreset === 'COMPACT' ? 1.2 : qrSizePreset === 'LARGE' ? 2.0 : 1.6}
                      height={codeType === 'BARCODE' ? 44 : qrSizePreset === 'COMPACT' ? 68 : qrSizePreset === 'LARGE' ? 124 : 96}
                      showText={codeType === 'BARCODE'}
                    />
                  </div>

                  {codeType === 'QR' && (
                    <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-600)', marginBottom: 4 }}>
                      {barcodeValue}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.72rem', color: 'var(--neutral-600)', paddingTop: 4, borderTop: '1px solid var(--neutral-200)', flexWrap: 'wrap', gap: 4 }}>
                    {showSku && <span>SKU: {itemSku}</span>}
                    {showPrice && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {showMrp && itemMrp > itemPrice && (
                          <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.68rem' }}>
                            ₹{itemMrp.toFixed(2)}
                          </span>
                        )}
                        <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.84rem' }}>
                          ₹{itemPrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Label Style & Paper Layout Format */}
          <div className="modal-grid-row-2">
            {/* Style Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Label Template
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleStyleSelect('STANDARD')}
                  style={{
                    padding: 10,
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${style === 'STANDARD' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: style === 'STANDARD' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: style === 'STANDARD' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>Standard Sticker</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>Rolls &amp; Box tags</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStyleSelect('JEWELRY_STRING_TAG')}
                  style={{
                    padding: 10,
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${style === 'JEWELRY_STRING_TAG' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: style === 'JEWELRY_STRING_TAG' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: style === 'JEWELRY_STRING_TAG' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>Jewelry String</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)' }}>Dumbbell tag</div>
                </button>
              </div>
            </div>

            {/* Paper Format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Paper Format
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPaperSize('THERMAL_50x30')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paperSize === 'THERMAL_50x30' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'THERMAL_50x30' ? 'var(--primary-50)' : '#ffffff',
                    color: paperSize === 'THERMAL_50x30' ? 'var(--primary-700)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>50 x 30 mm</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>Thermal Standard</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('THERMAL_40x40')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paperSize === 'THERMAL_40x40' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'THERMAL_40x40' ? 'var(--primary-50)' : '#ffffff',
                    color: paperSize === 'THERMAL_40x40' ? 'var(--primary-700)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>40 x 40 mm</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>Thermal Square QR</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('DUMBBELL_70x12')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paperSize === 'DUMBBELL_70x12' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'DUMBBELL_70x12' ? 'var(--primary-50)' : '#ffffff',
                    color: paperSize === 'DUMBBELL_70x12' ? 'var(--primary-700)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>70 x 12 mm</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>Dumbbell String</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('THERMAL_38x25')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paperSize === 'THERMAL_38x25' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'THERMAL_38x25' ? 'var(--primary-50)' : '#ffffff',
                    color: paperSize === 'THERMAL_38x25' ? 'var(--primary-700)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>38 x 25 mm</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>Compact Roll</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('A4_GRID_24')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paperSize === 'A4_GRID_24' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'A4_GRID_24' ? 'var(--primary-50)' : '#ffffff',
                    color: paperSize === 'A4_GRID_24' ? 'var(--primary-700)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>A4 (24-Up)</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>3x8 Grid Sheet</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize('A4_GRID_40')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${paperSize === 'A4_GRID_40' ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'A4_GRID_40' ? 'var(--primary-50)' : '#ffffff',
                    color: paperSize === 'A4_GRID_40' ? 'var(--primary-700)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>A4 (40-Up)</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>4x10 Grid Sheet</div>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Print Quantity & Element Toggles */}
          <div className="modal-grid-row-2">
            {/* Quantity Stepper & Quick Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Print Quantity Copies
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="btn btn-secondary"
                    style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', border: 'none', borderRadius: 0 }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '1rem', fontWeight: 800, width: 42, textAlign: 'center', color: 'var(--neutral-900)' }}>
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="btn btn-secondary"
                    style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', border: 'none', borderRadius: 0 }}
                  >
                    +
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {[1, 5, 10, 25, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQuantity(n)}
                      style={{
                        padding: '3px 7px',
                        borderRadius: 4,
                        border: `1px solid ${quantity === n ? 'var(--primary-400)' : 'var(--neutral-300)'}`,
                        backgroundColor: quantity === n ? 'var(--primary-50)' : '#ffffff',
                        color: quantity === n ? 'var(--primary-700)' : 'var(--neutral-700)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuantity(defaultStockCount || 1)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      backgroundColor: 'var(--primary-50)',
                      color: 'var(--primary-700)',
                      border: '1px solid var(--primary-200)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Stock ({defaultStockCount || 0})
                  </button>
                </div>
              </div>
            </div>

            {/* Element Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Label Element Options
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', color: 'var(--neutral-700)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                    />
                    <span>Show Price</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showMrp}
                      onChange={(e) => setShowMrp(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                    />
                    <span>Show MRP</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showSku}
                      onChange={(e) => setShowSku(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                    />
                    <span>Show SKU/Code</span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--primary-600)' }}
                    />
                    <span>Store Header:</span>
                  </label>
                  {showStoreName && (
                    <input
                      type="text"
                      className="form-input"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Store / Business Name"
                      style={{
                        fontSize: '0.74rem',
                        height: 26,
                        padding: '2px 8px',
                        flex: 1,
                        maxWidth: 220
                      }}
                      title="Edit store header printed on labels"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Printable Printable Container for Direct Browser Window Printing */}
        <div className="only-print" style={{ display: 'none', padding: 20 }}>
          <div style={{ textAlign: 'center', border: '1px solid #000', padding: 10, width: 220, margin: '0 auto' }}>
            {showStoreName && <div style={{ fontSize: 10, fontWeight: 'bold' }}>{storeName || 'Store'}</div>}
            <div style={{ fontSize: 12, fontWeight: 'bold', margin: '4px 0' }}>{itemName}</div>
            <div style={{ margin: '6px 0', display: 'flex', justifyContent: 'center' }}>
              <BarcodeRenderer value={activePayload} codeType={codeType} height={codeType === 'BARCODE' ? 35 : 70} />
            </div>
            {codeType === 'QR' && <div style={{ fontFamily: 'monospace', fontSize: 10 }}>{barcodeValue}</div>}
            {showPrice && <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>₹{itemPrice.toFixed(2)}</div>}
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
            <span>{isGenerating ? 'Generating PDF...' : `Download ${quantity} Labels PDF (${codeType})`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
