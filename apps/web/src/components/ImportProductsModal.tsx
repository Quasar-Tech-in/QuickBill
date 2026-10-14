import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RefreshCw, 
  Layers, 
  Loader2, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  FileCheck,
  Package,
  Plus,
  Sparkles,
  ArrowRight,
  ArrowDown,
  Store,
  Check,
  FileText,
  Info,
  ShieldCheck,
  Tag,
  BookOpen,
  Table,
  Copy,
  Search
} from 'lucide-react';
import { StoreLocation, ItemImportResponse } from '../types';
import { store } from '../services/store';

export interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  locations: StoreLocation[];
  currentLocationId: string;
}

export const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  locations,
  currentLocationId,
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(currentLocationId || 'ALL');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [createCategories, setCreateCategories] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<'xlsx' | 'csv' | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ItemImportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [columnFilter, setColumnFilter] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    setIsDownloading(format);
    setErrorMsg('');
    try {
      await store.downloadItemTemplate(format);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download template.');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const name = file.name.toLowerCase();
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
        setErrorMsg('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
        return;
      }
      setSelectedFile(file);
      setErrorMsg('');
      setImportResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const name = file.name.toLowerCase();
      if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
        setErrorMsg('Please drop a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
        return;
      }
      setSelectedFile(file);
      setErrorMsg('');
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select an Excel or CSV file to import.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    try {
      const res = await store.importProducts(selectedFile, {
        locationId: selectedLocationId !== 'ALL' ? selectedLocationId : undefined,
        updateExisting,
        createCategories,
      });
      setImportResult(res);
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Product import failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const scrollToAnchor = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyBranchCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  const activeBranchObj = locations.find(l => l.id === selectedLocationId);

  const columnSpecs = [
    { 
      name: 'Product Name', 
      required: true, 
      type: 'Text', 
      sample: 'Artisan Sourdough Loaf 500g', 
      desc: 'Display title for item catalog and billing. Matches existing items if Barcode and SKU are blank.' 
    },
    { 
      name: 'Sale Price', 
      required: true, 
      type: 'Number', 
      sample: '120.00', 
      desc: 'Selling price (INR) for this store outlet. Required to enable billing.' 
    },
    { 
      name: 'Category', 
      required: false, 
      autoCategory: true, 
      type: 'Text', 
      sample: 'Gourmet Bakery', 
      desc: 'Product group. If this category does not exist, QuickBill auto-creates and tags it in your store!' 
    },
    { 
      name: 'Barcode', 
      required: false, 
      type: 'Text / Digits', 
      sample: '890998877001', 
      desc: 'Primary identifier. Scanned at checkout counter. Priority 1 for matching existing products.' 
    },
    { 
      name: 'SKU', 
      required: false, 
      type: 'Text', 
      sample: 'SKU-BAK-001', 
      desc: 'Stock Keeping Unit code. Priority 2 for matching existing products in store catalog.' 
    },
    { 
      name: 'Opening Stock', 
      required: false, 
      type: 'Number', 
      sample: '15.0', 
      desc: 'Initial branch stock count. Automatically posted to the immutable Stock Movement Ledger.' 
    },
    { 
      name: 'MRP', 
      required: false, 
      type: 'Number', 
      sample: '140.00', 
      desc: 'Maximum Retail Price printed on package. If omitted, defaults to Sale Price.' 
    },
    { 
      name: 'Purchase Price', 
      required: false, 
      type: 'Number', 
      sample: '70.00', 
      desc: 'Unit cost price used for financial valuation, margins, and profit calculations.' 
    },
    { 
      name: 'Tax Rate %', 
      required: false, 
      type: 'Number', 
      sample: '5.0', 
      desc: 'GST tax slab percentage (e.g., 0, 5, 12, 18, 28). Defaults to 0.' 
    },
    { 
      name: 'Min Stock Alert', 
      required: false, 
      type: 'Number', 
      sample: '5.0', 
      desc: 'Reorder warning threshold. Flags low stock warning in inventory view. Defaults to 5.' 
    },
    { 
      name: 'Unit', 
      required: false, 
      type: 'Text', 
      sample: 'pcs', 
      desc: 'Unit of measurement (pcs, kg, ltr, box, pack, mtr). Defaults to "pcs".' 
    },
    { 
      name: 'Branch Code / Name', 
      required: false, 
      type: 'Text', 
      sample: 'MAIN-01', 
      desc: 'Destination store outlet. If blank, assigns to the target branch selected in the modal dropdown.' 
    },
    { 
      name: 'Description', 
      required: false, 
      type: 'Text', 
      sample: 'Fresh daily sourdough with organic grains', 
      desc: 'Product description and ingredient notes.' 
    },
  ];

  const filteredColumns = columnSpecs.filter(c => 
    c.name.toLowerCase().includes(columnFilter.toLowerCase()) ||
    c.desc.toLowerCase().includes(columnFilter.toLowerCase()) ||
    c.sample.toLowerCase().includes(columnFilter.toLowerCase())
  );

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'hidden'
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: 960, 
          width: '100%', 
          maxHeight: '92vh', 
          height: '92vh',
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.9)',
          position: 'relative',
        }}
      >
        {/* Top Gradient Accent Bar */}
        <div style={{
          height: 4,
          width: '100%',
          flexShrink: 0,
          background: 'linear-gradient(90deg, #4f46e5 0%, #3b82f6 35%, #06b6d4 70%, #10b981 100%)',
        }} />

        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          flexShrink: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
              border: '1px solid #c7d2fe',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.12)',
              flexShrink: 0
            }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0, letterSpacing: '-0.02em' }}>
                  Bulk Import Products & Catalog
                </h3>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 12,
                  backgroundColor: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe'
                }}>
                  Excel & CSV
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 12,
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0'
                }}>
                  Auto-Categories
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', margin: '3px 0 0 0' }}>
                Upload spreadsheet, view column specifications, update branch stock, and download official templates.
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn-icon"
            style={{ 
              border: 'none', 
              background: 'var(--neutral-100)', 
              borderRadius: '50%',
              width: 34,
              height: 34,
              cursor: 'pointer', 
              color: 'var(--neutral-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick-Jump Section Navigation Strip */}
        <div style={{
          padding: '8px 24px',
          borderBottom: '1px solid var(--neutral-200)',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Jump To:
            </span>
            <button
              type="button"
              onClick={() => scrollToAnchor('upload-section')}
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#4338ca',
                backgroundColor: '#eef2ff',
                border: '1px solid #c7d2fe',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Upload size={13} />
              <span>1. Upload File & Settings</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToAnchor('column-specs-section')}
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Table size={13} color="#4f46e5" />
              <span>2. Supported Columns (13)</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 10,
                backgroundColor: '#e0e7ff',
                color: '#4338ca'
              }}>
                Visible Below
              </span>
            </button>

            <button
              type="button"
              onClick={() => scrollToAnchor('branches-section')}
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Store size={13} color="#059669" />
              <span>3. Branch Directory ({locations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToAnchor('matching-rules-section')}
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ShieldCheck size={13} color="#2563eb" />
              <span>4. Matching Rules & Ledger</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#64748b' }}>
            <ArrowDown size={13} color="#4f46e5" />
            <span style={{ fontWeight: 600 }}>Scroll form to review full specifications</span>
          </div>
        </div>

        {/* Modal Scrollable Body (Guaranteed Flexbox Scrolling) */}
        <div 
          ref={modalBodyRef}
          className="modal-body"
          style={{ 
            padding: '24px 28px', 
            overflowY: 'auto', 
            overflowX: 'hidden',
            flex: '1 1 auto', 
            minHeight: 0, // CRITICAL FOR FLEXBOX SCROLLING
            display: 'flex', 
            flexDirection: 'column', 
            gap: 26,
            backgroundColor: '#f8fafc',
            scrollbarWidth: 'thin',
            scrollbarColor: '#94a3b8 #f1f5f9'
          }}
        >
          {errorMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
              <span style={{ fontWeight: 600 }}>{errorMsg}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* SECTION: RESULTS SUMMARY (When Import Has Succeeded)           */}
          {/* ============================================================== */}
          {importResult && (
            <div style={{
              borderRadius: 16,
              border: '1px solid #a7f3d0',
              background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)',
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 800, color: '#064e3b', fontSize: '1.1rem', margin: 0 }}>
                    Spreadsheet Processed Successfully!
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#047857', margin: '3px 0 0 0' }}>
                    Reviewed <strong>{importResult.totalRows}</strong> row(s) and synchronized catalog records into QuickBill.
                  </p>
                </div>
              </div>

              {/* Stat Chips Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12,
              }}>
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Total Evaluated
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                    {importResult.totalRows}
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #86efac',
                  boxShadow: '0 1px 3px rgba(34, 197, 94, 0.08)',
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    New Products
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a', marginTop: 2 }}>
                    +{importResult.createdCount}
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #93c5fd',
                  boxShadow: '0 1px 3px rgba(59, 130, 246, 0.08)',
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Updated Items
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
                    {importResult.updatedCount}
                  </div>
                </div>

                {importResult.categoriesCreated && importResult.categoriesCreated.length > 0 && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #d8b4fe',
                    boxShadow: '0 1px 3px rgba(168, 85, 247, 0.08)',
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#7e22ce', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Categories Added
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#9333ea', marginTop: 2 }}>
                      +{importResult.categoriesCreated.length}
                    </div>
                  </div>
                )}

                {importResult.skippedCount > 0 && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #fde68a',
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Skipped Duplicates
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706', marginTop: 2 }}>
                      {importResult.skippedCount}
                    </div>
                  </div>
                )}

                {importResult.errorsCount > 0 && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid #fca5a5',
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Rows with Errors
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626', marginTop: 2 }}>
                      {importResult.errorsCount}
                    </div>
                  </div>
                )}
              </div>

              {/* Newly Created Categories List */}
              {importResult.categoriesCreated && importResult.categoriesCreated.length > 0 && (
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid #e9d5ff',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Sparkles size={16} color="#9333ea" />
                    <span>Auto-created {importResult.categoriesCreated.length} category tag(s) in your store:</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {importResult.categoriesCreated.map(cat => (
                      <span 
                        key={cat} 
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          backgroundColor: '#faf5ff',
                          color: '#7e22ce',
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: '1px solid #d8b4fe',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Tag size={12} />
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Row Errors if any */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid #fecaca',
                  maxHeight: 160,
                  overflowY: 'auto',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} color="#dc2626" />
                    <span>The following rows could not be imported ({importResult.errors.length}):</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {importResult.errors.map((err, i) => (
                      <div key={i} style={{ fontSize: '0.76rem', color: '#b91c1c', fontFamily: 'var(--font-mono)' }}>
                        • <strong style={{ color: '#7f1d1d' }}>Row {err.row}:</strong> {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* SECTION 1: UPLOAD & CONFIGURATION                              */}
          {/* ============================================================== */}
          <div id="upload-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Step 1: Target Branch & Template Downloads Card Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 16
            }}>
              {/* Card 1: Target Branch Selection */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: '16px 18px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: '#eef2ff',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Store size={16} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>
                      Target Store Branch
                    </span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#64748b', margin: 0 }}>
                    Default branch destination for imported inventory stock counts and pricing.
                  </p>
                </div>

                <div>
                  <select
                    className="form-input"
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    style={{
                      width: '100%',
                      fontWeight: 600,
                      fontSize: '0.84rem',
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ALL">🏢 All Branches (Primary Catalog & Default Outlet)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        📍 {loc.name} {loc.code ? `[${loc.code}]` : ''} {loc.isDefault ? '★ Primary' : ''}
                      </option>
                    ))}
                  </select>
                  {activeBranchObj && (
                    <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} />
                      <span>Destination: <strong>{activeBranchObj.name}</strong> (Branch Code: <code>{activeBranchObj.code || 'MAIN-01'}</code>)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Download Ready-to-use Template */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: '16px 18px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Download size={16} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>
                      Download Official Templates
                    </span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#64748b', margin: 0 }}>
                    Pre-formatted templates with all 13 column headers and sample data.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    disabled={isDownloading !== null}
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 5px rgba(5, 150, 105, 0.2)'
                    }}
                    title="Download formatted Excel (.xlsx) workbook with instructions sheet"
                  >
                    {isDownloading === 'xlsx' ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('csv')}
                    disabled={isDownloading !== null}
                    style={{
                      padding: '9px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Download standard CSV (.csv) file"
                  >
                    {isDownloading === 'csv' ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload Dropzone */}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
              />

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? '#4f46e5' : '#cbd5e1'}`,
                    backgroundColor: isDragging ? '#eef2ff' : '#ffffff',
                    borderRadius: 16,
                    padding: '36px 24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    boxShadow: isDragging ? '0 0 0 4px rgba(79, 70, 229, 0.15)' : 'none'
                  }}
                >
                  <div style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    backgroundColor: isDragging ? '#c7d2fe' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDragging ? '#3730a3' : '#4f46e5',
                    transition: 'all 0.2s ease',
                  }}>
                    <Upload size={28} />
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.96rem', letterSpacing: '-0.01em' }}>
                      Choose your completed spreadsheet or drag & drop it here
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                      Supports <strong>Microsoft Excel (.xlsx, .xls)</strong> and <strong>CSV (.csv)</strong> files up to 25 MB.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 20, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                      .XLSX
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 20, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                      .CSV
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 20, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                      .XLS
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '16px 20px',
                  borderRadius: 16,
                  border: '1.5px solid #818cf8',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: selectedFile.name.endsWith('.csv') ? '#e0e7ff' : '#dcfce7',
                      border: `1px solid ${selectedFile.name.endsWith('.csv') ? '#c7d2fe' : '#bbf7d0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: selectedFile.name.endsWith('.csv') ? '#4338ca' : '#15803d',
                      flexShrink: 0
                    }}>
                      {selectedFile.name.endsWith('.csv') ? <FileText size={26} /> : <FileSpreadsheet size={26} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.96rem' }}>
                          {selectedFile.name}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0'
                        }}>
                          ✓ Ready to Import
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>Size: <strong>{formatFileSize(selectedFile.size)}</strong></span>
                        <span>•</span>
                        <span>Type: {selectedFile.name.endsWith('.csv') ? 'CSV Document' : 'Excel Workbook'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      padding: '7px 14px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Change File ✕
                  </button>
                </div>
              )}
            </div>

            {/* Import Behavior Switches */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 12
            }}>
              {/* Option 1: Update Existing Toggle */}
              <div 
                onClick={() => setUpdateExisting(!updateExisting)}
                style={{
                  backgroundColor: updateExisting ? '#eff6ff' : '#ffffff',
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: `1.5px solid ${updateExisting ? '#93c5fd' : '#e2e8f0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: updateExisting ? '0 2px 8px rgba(59, 130, 246, 0.08)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: updateExisting ? '#2563eb' : '#f1f5f9',
                    color: updateExisting ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1e293b' }}>
                      Update Existing Products
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                      Matches by <strong>Barcode &rarr; SKU &rarr; Name</strong> and updates prices & stock.
                    </div>
                  </div>
                </div>

                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${updateExisting ? '#2563eb' : '#cbd5e1'}`,
                  backgroundColor: updateExisting ? '#2563eb' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0
                }}>
                  {updateExisting && <Check size={14} strokeWidth={3} />}
                </div>
              </div>

              {/* Option 2: Auto-create Categories Toggle */}
              <div 
                onClick={() => setCreateCategories(!createCategories)}
                style={{
                  backgroundColor: createCategories ? '#faf5ff' : '#ffffff',
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: `1.5px solid ${createCategories ? '#d8b4fe' : '#e2e8f0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: createCategories ? '0 2px 8px rgba(168, 85, 247, 0.08)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: createCategories ? '#9333ea' : '#f1f5f9',
                    color: createCategories ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1e293b' }}>
                      Auto-Register New Categories
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                      New categories in your file will be registered into your store catalog.
                    </div>
                  </div>
                </div>

                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${createCategories ? '#9333ea' : '#cbd5e1'}`,
                  backgroundColor: createCategories ? '#9333ea' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0
                }}>
                  {createCategories && <Check size={14} strokeWidth={3} />}
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 2: TEMPLATE SPECIFICATIONS & SUPPORTED COLUMNS (13)    */}
          {/* Directly visible in the form!                                 */}
          {/* ============================================================== */}
          <div 
            id="column-specs-section" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 16,
              paddingTop: 10,
              borderTop: '1px solid #e2e8f0'
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderRadius: 16,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Table size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                      Template Specifications & Supported Columns ({columnSpecs.length} Fields)
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                      QuickBill automatically matches column headers with case-insensitivity and synonym handling.
                    </p>
                  </div>
                </div>
              </div>

              {/* Column Search Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '4px 10px',
                  gap: 6
                }}>
                  <Search size={14} color="#64748b" />
                  <input
                    type="text"
                    value={columnFilter}
                    onChange={(e) => setColumnFilter(e.target.value)}
                    placeholder="Search columns..."
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '0.78rem',
                      outline: 'none',
                      width: 140
                    }}
                  />
                  {columnFilter && (
                    <button 
                      type="button" 
                      onClick={() => setColumnFilter('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    style={{
                      padding: '7px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={13} />
                    <span>Get Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('csv')}
                    style={{
                      padding: '7px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={13} />
                    <span>Get CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Full High-Visibility Interactive Table */}
            <div style={{
              borderRadius: 16,
              border: '1.5px solid #e2e8f0',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#334155' }}>
                      <th style={{ padding: '12px 16px', width: '20%', fontWeight: 800 }}>Column Name</th>
                      <th style={{ padding: '12px 14px', width: '16%', fontWeight: 800 }}>Requirement</th>
                      <th style={{ padding: '12px 14px', width: '12%', fontWeight: 800 }}>Data Type</th>
                      <th style={{ padding: '12px 16px', width: '20%', fontWeight: 800 }}>Sample Value</th>
                      <th style={{ padding: '12px 16px', width: '32%', fontWeight: 800 }}>Notes & Auto-Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredColumns.map((col, idx) => (
                      <tr 
                        key={col.name} 
                        style={{ 
                          borderBottom: idx < filteredColumns.length - 1 ? '1px solid #f1f5f9' : 'none',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{col.name}</span>
                            {col.required && <span style={{ color: '#dc2626', fontWeight: 900 }}>*</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {col.required ? (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: 10,
                              backgroundColor: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
                              Mandatory
                            </span>
                          ) : col.autoCategory ? (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: 10,
                              backgroundColor: '#faf5ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Sparkles size={11} />
                              Auto-Created
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: 10,
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #e2e8f0'
                            }}>
                              Optional
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '0.74rem', 
                            color: '#475569',
                            backgroundColor: '#f8fafc',
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid #e2e8f0'
                          }}>
                            {col.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#3730a3', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {col.sample}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', lineHeight: 1.45, fontSize: '0.78rem' }}>
                          {col.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 3: STORE BRANCHES & CODES DIRECTORY                    */}
          {/* ============================================================== */}
          <div 
            id="branches-section" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 12,
              paddingTop: 10,
              borderTop: '1px solid #e2e8f0'
            }}
          >
            <div style={{
              borderRadius: 16,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Store size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>
                    Active Store Branches & Code Directory ({locations.length})
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Click any branch code below to copy it and paste into the <strong>Branch Code / Name</strong> column in your spreadsheet:
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                {locations.map(loc => {
                  const codeVal = loc.code || loc.name;
                  const isCopied = copiedCode === codeVal;
                  return (
                    <div 
                      key={loc.id}
                      onClick={() => copyBranchCode(codeVal)}
                      title="Click to copy branch code"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        backgroundColor: '#f8fafc',
                        border: `1.5px solid ${isCopied ? '#86efac' : '#cbd5e1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isCopied ? '0 0 0 3px rgba(34, 197, 94, 0.15)' : 'none'
                      }}
                    >
                      <MapPin size={14} color="#4f46e5" />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{loc.name}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.74rem',
                        padding: '2px 7px',
                        borderRadius: 6,
                        backgroundColor: '#eef2ff',
                        color: '#4338ca',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {codeVal}
                        {isCopied ? <Check size={11} color="#16a34a" /> : <Copy size={11} color="#818cf8" />}
                      </span>
                      {loc.isDefault && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: 4 }}>
                          ★ Primary
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 4: MATCHING RULES & STOCK LEDGER                       */}
          {/* ============================================================== */}
          <div 
            id="matching-rules-section" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 12,
              paddingTop: 10,
              borderTop: '1px solid #e2e8f0',
              paddingBottom: 16
            }}
          >
            <div style={{
              borderRadius: 16,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              {/* Rule 1 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                    1. Product Matching & Deduplication Priority
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                    When "Update Existing Products" is active, QuickBill checks for an existing item in this exact order:
                  </p>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.76rem', color: '#334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, width: 76, color: '#2563eb' }}>Priority 1:</span>
                      <span><strong>Barcode Match:</strong> Exact barcode lookup in store items.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, width: 76, color: '#2563eb' }}>Priority 2:</span>
                      <span><strong>SKU Match:</strong> Case-insensitive exact SKU code lookup.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, width: 76, color: '#2563eb' }}>Priority 3:</span>
                      <span><strong>Product Name Match:</strong> Case-insensitive title match.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />

              {/* Rule 2 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#faf5ff',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                    2. Automatic Category Self-Healing
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                    Any category name present in the spreadsheet that does not yet exist is automatically inserted into your store's categories registry. It immediately becomes available in POS billing filter tabs and dropdowns.
                  </p>
                </div>
              </div>

              <div style={{ height: 1, backgroundColor: '#f1f5f9' }} />

              {/* Rule 3 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                    3. Double-Entry Stock Movement Ledger
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                    Inventory additions are never silently modified. For new items, an immutable <code>OPENING_STOCK</code> ledger record is created. For updated items, a <code>BULK_IMPORT_UPDATE</code> record is written with exact previous, delta, and new stock counts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          flexShrink: 0,
          zIndex: 10
        }}>
          {!importResult ? (
            <>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {selectedFile ? (
                  <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Attached: <strong>{selectedFile.name}</strong> ({formatFileSize(selectedFile.size)})
                  </span>
                ) : (
                  <span>Select or drop an Excel (.xlsx) or CSV file above</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="btn btn-secondary"
                  disabled={isUploading}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.84rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!selectedFile || isUploading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 24px',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    color: '#ffffff',
                    background: (!selectedFile || isUploading) 
                      ? '#94a3b8' 
                      : 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                    border: 'none',
                    cursor: (!selectedFile || isUploading) ? 'not-allowed' : 'pointer',
                    boxShadow: (!selectedFile || isUploading) ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Importing Catalog...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Start Bulk Import</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} />
                <span>Import completed successfully. Catalog synchronized.</span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  type="button" 
                  onClick={handleReset} 
                  className="btn btn-secondary"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6,
                    padding: '9px 16px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.84rem'
                  }}
                >
                  <Plus size={15} />
                  <span>Import Another File</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6,
                    padding: '9px 22px',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <Check size={16} strokeWidth={2.5} />
                  <span>Done & View Catalog</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
