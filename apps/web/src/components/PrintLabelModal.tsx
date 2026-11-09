import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Printer,
  Type,
  Bold,
  Italic, 
  X, 
  Tag, 
  Gem, 
  Download, 
  Eye, 
  QrCode, 
  FileText, 
  Copy, 
  Check, 
  Sparkles, 
  Image as ImageIcon,
  Sliders,
  Maximize2,
  Minimize2,
  Layers,
  Columns,
  AlignLeft,
  AlignCenter,
  Move,
  RotateCcw,
  RotateCw,
  Grid,
  LayoutGrid
} from 'lucide-react';
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

export interface ElementPos {
  x: number; // percentage (0 to 100%) from container left
  y: number; // percentage (0 to 100%) from container top
}

export type LayoutPositions = Record<string, ElementPos>;

export interface ElementStyleConfig {
  size: number;       // scale multiplier: 0.6 to 1.8 (default 1.0)
  bold: boolean;      // true / false
  italic: boolean;    // true / false
  uppercase: boolean; // true / false
  rotation?: number;  // 0, 90, 180, 270 (degrees)
}

export type LayoutStyles = Record<string, ElementStyleConfig>;

export const DEFAULT_ELEMENT_STYLES: LayoutStyles = {
  storeName: { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 },
  productName: { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 },
  price: { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 },
  barcodeText: { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 },
  sku: { size: 1.0, bold: false, italic: false, uppercase: false, rotation: 0 },
  code: { size: 1.0, bold: false, italic: false, uppercase: false, rotation: 0 },
};


const CACHE_KEY = 'qb_label_studio_design_v2';

export type PaperSizeType =
  | 'RAT_TAIL_76x12'
  | 'SEZNIK_100x15'
  | 'SEZNIK_3UP_100x15'
  | 'THERMAL_50x30'
  | 'THERMAL_40x40'
  | 'THERMAL_38x25'
  | 'DUMBBELL_70x12'
  | 'A4_GRID_24'
  | 'A4_GRID_40'
  | 'A4_GRID_65';

export type LabelOrientationType = 'PORTRAIT' | 'LANDSCAPE';

export interface A4GridDefinition {
  cols: number;
  rows: number;
  totalSlots: number;
  labelW_mm: number;
  labelH_mm: number;
  marginH_mm: number;
  marginV_mm: number;
  name: string;
}

export const A4_GRID_CONFIG: Record<string, A4GridDefinition> = {
  A4_GRID_24: {
    cols: 3,
    rows: 8,
    totalSlots: 24,
    labelW_mm: 64.0,
    labelH_mm: 33.9,
    marginH_mm: 9.0,
    marginV_mm: 12.9,
    name: 'A4 24-Up (3x8)'
  },
  A4_GRID_40: {
    cols: 4,
    rows: 10,
    totalSlots: 40,
    labelW_mm: 48.5,
    labelH_mm: 25.4,
    marginH_mm: 8.0,
    marginV_mm: 21.5,
    name: 'A4 40-Up (4x10)'
  },
  A4_GRID_65: {
    cols: 5,
    rows: 13,
    totalSlots: 65,
    labelW_mm: 38.1,
    labelH_mm: 21.2,
    marginH_mm: 9.75,
    marginV_mm: 10.7,
    name: 'A4 65-Up (5x13)'
  }
};

// Default coordinate templates for each physical layout
const DEFAULT_DUMBBELL_POSITIONS: LayoutPositions = {
  storeName: { x: 5, y: 14 },
  productName: { x: 5, y: 44 },
  price: { x: 5, y: 76 },
  code: { x: 82, y: 48 },
  barcodeText: { x: 64, y: 36 },
  sku: { x: 64, y: 72 },
};

const DEFAULT_RATTAIL_POSITIONS: LayoutPositions = {
  storeName: { x: 4, y: 14 },
  productName: { x: 4, y: 44 },
  price: { x: 4, y: 76 },
  barcodeText: { x: 38, y: 36 },
  sku: { x: 38, y: 72 },
  code: { x: 55, y: 48 },
};

const DEFAULT_SEZNIK_RATTAIL_POSITIONS: LayoutPositions = {
  storeName: { x: 3, y: 16 },
  productName: { x: 3, y: 46 },
  price: { x: 3, y: 78 },
  barcodeText: { x: 35, y: 36 },
  sku: { x: 35, y: 72 },
  code: { x: 50, y: 50 },
};

// Seznik Portrait layout (vertical 14.3mm strip as shown on Amazon reel)
// Centered horizontally across the 14.3mm width, stacked down the 100mm strip
const DEFAULT_SEZNIK_PORTRAIT_POSITIONS: LayoutPositions = {
  storeName: { x: 50, y: 7 },
  productName: { x: 50, y: 16 },
  price: { x: 50, y: 26 },
  code: { x: 50, y: 44 },
  barcodeText: { x: 50, y: 53 },
  sku: { x: 50, y: 58 },
};

const DEFAULT_A4_POSITIONS: LayoutPositions = {
  storeName: { x: 50, y: 12 },
  productName: { x: 50, y: 28 },
  code: { x: 50, y: 56 },
  barcodeText: { x: 50, y: 76 },
  price: { x: 50, y: 88 },
  sku: { x: 88, y: 88 },
};

const DEFAULT_STACKED_POSITIONS: LayoutPositions = {
  storeName: { x: 50, y: 9 },
  productName: { x: 50, y: 22 },
  code: { x: 50, y: 52 },
  barcodeText: { x: 50, y: 74 },
  sku: { x: 15, y: 91 },
  price: { x: 85, y: 91 },
};

const DEFAULT_SIDEBYSIDE_POSITIONS: LayoutPositions = {
  code: { x: 24, y: 42 },
  barcodeText: { x: 24, y: 82 },
  storeName: { x: 56, y: 14 },
  productName: { x: 56, y: 36 },
  sku: { x: 56, y: 62 },
  price: { x: 56, y: 86 },
};

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  isOpen,
  onClose,
  itemName = 'Product Item',
  itemSku = 'SKU-001',
  itemBarcode = '',
  itemPrice = 0,
  publicItemId = 'ITM-1001',
  defaultStockCount = 10,
  initialCodeType = 'QR',
  storeName: propStoreName,
}) => {
  const resolveInitialStoreName = () => {
    return (propStoreName || store.getActiveTenant()?.name || store.getCurrentUser()?.tenantName || store.getActiveLocation()?.name || 'QuickBill Store').trim();
  };

  // Label Data States
  const [productName, setProductName] = useState<string>(itemName || 'Product Item');
  const [showProductName, setShowProductName] = useState(true);
  const [price, setPrice] = useState<number>(itemPrice || 0);
  const [showPrice, setShowPrice] = useState(true);
  const [sku, setSku] = useState<string>(itemSku || '');
  const [showSku, setShowSku] = useState(true);
  const [storeName, setStoreName] = useState<string>(resolveInitialStoreName);
  const [customBarcodeText, setCustomBarcodeText] = useState<string>('');
  const [showStoreName, setShowStoreName] = useState(true);

  // Formatting & Arrangement States
  const [codeType, setCodeType] = useState<'BARCODE' | 'QR'>(initialCodeType);
  const [style, setStyle] = useState<'JEWELRY_RAT_TAIL' | 'STANDARD' | 'JEWELRY_STRING_TAG' | 'A4_SHEET'>('JEWELRY_RAT_TAIL');
  const [paperSize, setPaperSize] = useState<PaperSizeType>('RAT_TAIL_76x12');
  const [orientation, setOrientation] = useState<LabelOrientationType>('PORTRAIT');
  const [arrangement, setArrangement] = useState<'DUAL_FLAP' | 'STACKED' | 'SIDE_BY_SIDE'>('DUAL_FLAP');
  const [codeScale, setCodeScale] = useState<number>(1.0); // 0.8, 1.0, 1.2, 1.4
  const [quantity, setQuantity] = useState<number | ''>(defaultStockCount || 10);
  const effectiveQuantity = Math.max(1, typeof quantity === 'number' && !isNaN(quantity) ? quantity : (parseInt(String(quantity), 10) || 1));

  // Cached positions dictionary for every template
  const [positionsByTemplate, setPositionsByTemplate] = useState<Record<string, LayoutPositions>>({});
  // Selected Element for Typography & Style Inspector (includes code for scaling & rotation)
  const [selectedElementId, setSelectedElementId] = useState<'productName' | 'price' | 'storeName' | 'barcodeText' | 'sku' | 'code'>('productName');
  const [elementStyles, setElementStyles] = useState<LayoutStyles>(DEFAULT_ELEMENT_STYLES);
  const [stylesByTemplate, setStylesByTemplate] = useState<Record<string, LayoutStyles>>({});

  // Hardware Printer Feed Offsets (in mm) for margin calibration
  const [printOffsetX_mm, setPrintOffsetX_mm] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem('qb_label_hardware_offset_x') || '0') || 0; } catch { return 0; }
  });
  const [printOffsetY_mm, setPrintOffsetY_mm] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem('qb_label_hardware_offset_y') || '0') || 0; } catch { return 0; }
  });

  const handleOffsetXChange = (val: number) => {
    const clamped = Math.round(Math.max(-10, Math.min(10, val)) * 10) / 10;
    setPrintOffsetX_mm(clamped);
    try { localStorage.setItem('qb_label_hardware_offset_x', String(clamped)); } catch {}
  };

  const handleOffsetYChange = (val: number) => {
    const clamped = Math.round(Math.max(-10, Math.min(10, val)) * 10) / 10;
    setPrintOffsetY_mm(clamped);
    try { localStorage.setItem('qb_label_hardware_offset_y', String(clamped)); } catch {}
  };

  // Active element positions
  const [elementPositions, setElementPositions] = useState<LayoutPositions>(DEFAULT_RATTAIL_POSITIONS);
  const [isCustomLayout, setIsCustomLayout] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragSnapToGrid, setDragSnapToGrid] = useState<boolean>(true);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    startElemX: number;
    startElemY: number;
    containerW: number;
    containerH: number;
  } | null>(null);

  // Action / UI feedback states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [cacheNotification, setCacheNotification] = useState<string | null>(null);

  // Helper flags
  const isDumbbell = style === 'JEWELRY_STRING_TAG' || paperSize === 'DUMBBELL_70x12';
  const isSeznik3Up = paperSize === 'SEZNIK_3UP_100x15';
  const isSeznik = paperSize === 'SEZNIK_100x15' || isSeznik3Up;
  const isRatTail = (style === 'JEWELRY_RAT_TAIL' || paperSize === 'RAT_TAIL_76x12' || isSeznik) && !isDumbbell;
  const isA4 = paperSize === 'A4_GRID_24' || paperSize === 'A4_GRID_40' || paperSize === 'A4_GRID_65' || style === 'A4_SHEET';
  const [startOffsetSlot, setStartOffsetSlot] = useState<number>(1);
  const activeA4Grid = A4_GRID_CONFIG[paperSize] || A4_GRID_CONFIG['A4_GRID_24'];

  // Resolve default positions based on layout and orientation
  const resolveDefaultPositions = useCallback((curArr: string, curStyle: string, curPaper: string, curOrientation = orientation): LayoutPositions => {
    if (curPaper.startsWith('A4_') || curStyle === 'A4_SHEET') {
      return { ...DEFAULT_A4_POSITIONS };
    }
    if (curStyle === 'JEWELRY_STRING_TAG' || curPaper === 'DUMBBELL_70x12') {
      return { ...DEFAULT_DUMBBELL_POSITIONS };
    }
    if (curPaper === 'SEZNIK_100x15' || curPaper === 'SEZNIK_3UP_100x15') {
      if (curOrientation === 'PORTRAIT') {
        return { ...DEFAULT_SEZNIK_PORTRAIT_POSITIONS };
      }
      return { ...DEFAULT_SEZNIK_RATTAIL_POSITIONS };
    }
    if (curStyle === 'JEWELRY_RAT_TAIL' || curPaper === 'RAT_TAIL_76x12') {
      return { ...DEFAULT_RATTAIL_POSITIONS };
    }
    if (curArr === 'SIDE_BY_SIDE') {
      return { ...DEFAULT_SIDEBYSIDE_POSITIONS };
    }
    return { ...DEFAULT_STACKED_POSITIONS };
  }, [orientation]);

  // Save current design state to localStorage cache
  const saveDesignToCache = useCallback((
    newPositions: LayoutPositions,
    curPaper = paperSize,
    curStyle = style,
    curArr = arrangement,
    curCodeType = codeType,
    curCodeScale = codeScale,
    curSnap = dragSnapToGrid,
    curStyles: LayoutStyles = elementStyles,
    curOrientation = orientation
  ) => {
    try {
      const templateKey = `${curPaper}_${curOrientation}`;
      const updatedPositionsByTemplate = {
        ...positionsByTemplate,
        [templateKey]: newPositions,
        [curPaper]: newPositions,
      };
      setPositionsByTemplate(updatedPositionsByTemplate);

      const updatedStylesByTemplate = {
        ...stylesByTemplate,
        [templateKey]: curStyles,
        [curPaper]: curStyles,
      };
      setStylesByTemplate(updatedStylesByTemplate);

      const cacheObj = {
        version: 2,
        lastUpdated: Date.now(),
        style: curStyle,
        paperSize: curPaper,
        orientation: curOrientation,
        arrangement: curArr,
        codeType: curCodeType,
        codeScale: curCodeScale,
        dragSnapToGrid: curSnap,
        showProductName,
        showPrice,
        showSku,
        showStoreName,
        positionsByTemplate: updatedPositionsByTemplate,
        stylesByTemplate: updatedStylesByTemplate,
        elementStyles: curStyles,
        customBarcodeText,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    } catch (err) {
      console.warn('Failed to cache label design:', err);
    }
  }, [positionsByTemplate, stylesByTemplate, elementStyles, paperSize, style, arrangement, codeType, codeScale, dragSnapToGrid, showProductName, showPrice, showSku, showStoreName, orientation]);

  // Update typography style for a specific label element
  const handleUpdateElementStyle = (
    elemId: string,
    partial: Partial<ElementStyleConfig>
  ) => {
    const current = elementStyles[elemId] || DEFAULT_ELEMENT_STYLES[elemId] || { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 };
    const updated: ElementStyleConfig = {
      ...current,
      ...partial,
    };
    const nextStyles: LayoutStyles = {
      ...elementStyles,
      [elemId]: updated,
    };
    setElementStyles(nextStyles);
    saveDesignToCache(elementPositions, paperSize, style, arrangement, codeType, codeScale, dragSnapToGrid, nextStyles, orientation);
  };

  // Reset typography style for a specific label element
  const handleResetElementStyle = (elemId: string) => {
    const defaultVal = DEFAULT_ELEMENT_STYLES[elemId] || { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 };
    const nextStyles: LayoutStyles = {
      ...elementStyles,
      [elemId]: defaultVal,
    };
    setElementStyles(nextStyles);
    saveDesignToCache(elementPositions, paperSize, style, arrangement, codeType, codeScale, dragSnapToGrid, nextStyles, orientation);
    setCacheNotification(`Reset style for ${elemId}`);
    setTimeout(() => setCacheNotification(null), 1500);
  };

  // Rotate all elements by 90 degrees clockwise (0° -> 90° -> 180° -> 270° -> 0°)
  const handleRotateAll = () => {
    const curRot = elementStyles['productName']?.rotation || 0;
    const nextRot = (curRot + 90) % 360;
    const nextStyles: LayoutStyles = { ...elementStyles };
    const elementKeys = ['storeName', 'productName', 'price', 'barcodeText', 'sku', 'code'];
    elementKeys.forEach((key) => {
      const cur = nextStyles[key] || DEFAULT_ELEMENT_STYLES[key] || { size: 1.0, bold: true, italic: false, uppercase: false, rotation: 0 };
      nextStyles[key] = {
        ...cur,
        rotation: nextRot,
      };
    });
    setElementStyles(nextStyles);
    saveDesignToCache(elementPositions, paperSize, style, arrangement, codeType, codeScale, dragSnapToGrid, nextStyles, orientation);
    setCacheNotification(`Rotated all elements to ${nextRot}°`);
    setTimeout(() => setCacheNotification(null), 1500);
  };

  // Update code scale with live cache persistence
  const handleUpdateCodeScale = (newScale: number) => {
    const clamped = Math.round(Math.max(0.3, Math.min(2.5, newScale)) * 100) / 100;
    setCodeScale(clamped);
    saveDesignToCache(elementPositions, paperSize, style, arrangement, codeType, clamped, dragSnapToGrid, elementStyles, orientation);
  };

  // Switch label orientation (Portrait vs Landscape)
  const handleOrientationSelect = (newOrientation: LabelOrientationType) => {
    setOrientation(newOrientation);
    const templateKey = `${paperSize}_${newOrientation}`;
    const cachedPositions = positionsByTemplate[templateKey];
    if (cachedPositions) {
      setElementPositions(cachedPositions);
      setIsCustomLayout(true);
    } else {
      const defaults = resolveDefaultPositions(arrangement, style, paperSize, newOrientation);
      setElementPositions(defaults);
      setIsCustomLayout(false);
      saveDesignToCache(defaults, paperSize, style, arrangement, codeType, codeScale, dragSnapToGrid, elementStyles, newOrientation);
    }
  };

  // Load cached template & design on open
  useEffect(() => {
    if (!isOpen) return;

    setProductName(itemName || 'Product Item');
    setPrice(itemPrice || 0);
    setSku(itemSku || '');
    setStoreName(resolveInitialStoreName());
    setCodeType(initialCodeType || 'QR');

    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached && typeof cached === 'object') {
          if (cached.style) setStyle(cached.style);
          if (cached.paperSize) setPaperSize(cached.paperSize);
          if (cached.orientation) setOrientation(cached.orientation);
          if (cached.arrangement) setArrangement(cached.arrangement);
          if (cached.codeType) setCodeType(cached.codeType);
          if (cached.codeScale) setCodeScale(cached.codeScale);
          if (typeof cached.dragSnapToGrid === 'boolean') setDragSnapToGrid(cached.dragSnapToGrid);
          if (typeof cached.showProductName === 'boolean') setShowProductName(cached.showProductName);
          if (typeof cached.showPrice === 'boolean') setShowPrice(cached.showPrice);
          if (typeof cached.showSku === 'boolean') setShowSku(cached.showSku);
          if (typeof cached.showStoreName === 'boolean') setShowStoreName(cached.showStoreName);
          if (typeof cached.customBarcodeText === 'string') setCustomBarcodeText(cached.customBarcodeText);

          const curOrient = cached.orientation || orientation;
          const templateKey = `${cached.paperSize || paperSize}_${curOrient}`;
          const fallbackKey = cached.paperSize || paperSize;
          if (cached.stylesByTemplate && cached.stylesByTemplate[templateKey]) {
            setStylesByTemplate(cached.stylesByTemplate);
            setElementStyles(cached.stylesByTemplate[templateKey]);
          } else if (cached.stylesByTemplate && cached.stylesByTemplate[fallbackKey]) {
            setStylesByTemplate(cached.stylesByTemplate);
            setElementStyles(cached.stylesByTemplate[fallbackKey]);
          } else if (cached.elementStyles) {
            setElementStyles(cached.elementStyles);
          }

          if (cached.positionsByTemplate && cached.positionsByTemplate[templateKey]) {
            setPositionsByTemplate(cached.positionsByTemplate);
            setElementPositions(cached.positionsByTemplate[templateKey]);
            setIsCustomLayout(true);
            setCacheNotification('Loaded saved design & typography');
            setTimeout(() => setCacheNotification(null), 2500);
            return;
          } else if (cached.positionsByTemplate && cached.positionsByTemplate[fallbackKey]) {
            setPositionsByTemplate(cached.positionsByTemplate);
            setElementPositions(cached.positionsByTemplate[fallbackKey]);
            setIsCustomLayout(true);
            setCacheNotification('Loaded saved design & typography');
            setTimeout(() => setCacheNotification(null), 2500);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached label design:', e);
    }

    // Sync print quantity with actual item stock if provided
    if (defaultStockCount !== undefined && defaultStockCount > 0) {
      setQuantity(defaultStockCount);
    }

    // Fallback to default positions if no cache
    const defaults = resolveDefaultPositions(arrangement, style, paperSize, orientation);
    setElementPositions(defaults);
    setIsCustomLayout(false);
  }, [isOpen, itemName, itemPrice, itemSku, propStoreName, initialCodeType, defaultStockCount, resolveDefaultPositions, orientation]);

  // Reset layout and typography to default preset
  const resetLayout = useCallback((targetArr = arrangement, targetStyle = style, targetPaper = paperSize, targetOrientation = orientation) => {
    const defaults = resolveDefaultPositions(targetArr, targetStyle, targetPaper, targetOrientation);
    setElementPositions(defaults);
    setElementStyles(DEFAULT_ELEMENT_STYLES);
    setIsCustomLayout(false);
    saveDesignToCache(defaults, targetPaper, targetStyle, targetArr, codeType, codeScale, dragSnapToGrid, DEFAULT_ELEMENT_STYLES, targetOrientation);
    setCacheNotification('Layout & typography reset to default');
    setTimeout(() => setCacheNotification(null), 2000);
  }, [arrangement, style, paperSize, orientation, codeType, codeScale, dragSnapToGrid, resolveDefaultPositions, saveDesignToCache]);

  const barcodeRendererRef = useRef<BarcodeRendererRef | null>(null);

  // Determine standard payload strings
  const barcodeValue = (itemBarcode || sku || publicItemId || 'ITM-1001').replace(/^ITEM:/, '').trim();
  const effectiveBarcodeText = customBarcodeText.trim() !== '' ? customBarcodeText.trim() : barcodeValue;
  const qrValue = publicItemId 
    ? (publicItemId.startsWith('ITEM:') ? publicItemId : `ITEM:${publicItemId}`) 
    : (itemBarcode || sku || 'ITM-1001');

  const activePayload = codeType === 'QR' ? qrValue : effectiveBarcodeText;

  if (!isOpen) return null;

  const handleSelectPreset = (newPaper: PaperSizeType) => {
    setPaperSize(newPaper);
    let newStyle: 'JEWELRY_RAT_TAIL' | 'STANDARD' | 'JEWELRY_STRING_TAG' | 'A4_SHEET' = 'STANDARD';
    let newArr: 'DUAL_FLAP' | 'STACKED' | 'SIDE_BY_SIDE' = 'STACKED';
    let newOrient: LabelOrientationType = orientation;

    if (newPaper === 'SEZNIK_3UP_100x15') {
      newStyle = 'JEWELRY_RAT_TAIL';
      newArr = 'DUAL_FLAP';
      newOrient = 'PORTRAIT';
    } else if (newPaper === 'SEZNIK_100x15') {
      newStyle = 'JEWELRY_RAT_TAIL';
      newArr = 'DUAL_FLAP';
    } else if (newPaper === 'DUMBBELL_70x12') {
      newStyle = 'JEWELRY_STRING_TAG';
      newArr = 'DUAL_FLAP';
    } else if (newPaper === 'RAT_TAIL_76x12') {
      newStyle = 'JEWELRY_RAT_TAIL';
      newArr = 'DUAL_FLAP';
    } else if (newPaper.startsWith('A4_')) {
      newStyle = 'A4_SHEET';
      newArr = 'STACKED';
    } else {
      newStyle = 'STANDARD';
      newArr = arrangement === 'SIDE_BY_SIDE' ? 'SIDE_BY_SIDE' : 'STACKED';
    }

    setStyle(newStyle);
    setArrangement(newArr);
    setOrientation(newOrient);

    const templateKey = `${newPaper}_${newOrient}`;
    const cachedPositions = positionsByTemplate[templateKey] || positionsByTemplate[newPaper];
    if (cachedPositions) {
      setElementPositions(cachedPositions);
      setIsCustomLayout(true);
    } else {
      const defaults = resolveDefaultPositions(newArr, newStyle, newPaper, newOrient);
      setElementPositions(defaults);
      setIsCustomLayout(false);
      saveDesignToCache(defaults, newPaper, newStyle, newArr, codeType, codeScale, dragSnapToGrid, elementStyles, newOrient);
    }
  };

  const handlePaperSelect = handleSelectPreset;

  const handleStyleSelect = (newStyle: 'JEWELRY_RAT_TAIL' | 'STANDARD' | 'JEWELRY_STRING_TAG' | 'A4_SHEET') => {
    if (newStyle === 'JEWELRY_RAT_TAIL') handleSelectPreset('RAT_TAIL_76x12');
    else if (newStyle === 'JEWELRY_STRING_TAG') handleSelectPreset('DUMBBELL_70x12');
    else if (newStyle === 'A4_SHEET') handleSelectPreset('A4_GRID_24');
    else handleSelectPreset('THERMAL_50x30');
  };

  const handleArrangementSelect = (newArr: 'DUAL_FLAP' | 'STACKED' | 'SIDE_BY_SIDE') => {
    setArrangement(newArr);
    const defaults = resolveDefaultPositions(newArr, style, paperSize, orientation);
    setElementPositions(defaults);
    setIsCustomLayout(false);
    saveDesignToCache(defaults, paperSize, style, newArr, codeType, codeScale, dragSnapToGrid, elementStyles, orientation);
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

  const escapeHtml = (str: string) => {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Drag & drop pointer handler with auto-save to cache on release
  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDragId(id);
    if (id === 'productName' || id === 'price' || id === 'storeName' || id === 'barcodeText' || id === 'sku' || id === 'code') {
      setSelectedElementId(id);
    }

    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const currentPos = elementPositions[id] || { x: 50, y: 50 };

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startElemX: currentPos.x,
      startElemY: currentPos.y,
      containerW: rect.width,
      containerH: rect.height,
    };

    let latestPositions = { ...elementPositions };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const { startX, startY, startElemX, startElemY, containerW, containerH } = dragStartRef.current;
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;

      let newX = startElemX + (deltaX / containerW) * 100;
      let newY = startElemY + (deltaY / containerH) * 100;

      // Clamping inside canvas bounds
      newX = Math.max(2, Math.min(94, newX));
      newY = Math.max(5, Math.min(95, newY));

      // 2% grid snap (~1-1.5mm)
      if (dragSnapToGrid) {
        newX = Math.round(newX / 2) * 2;
        newY = Math.round(newY / 2) * 2;
      }

      latestPositions = {
        ...latestPositions,
        [id]: { x: newX, y: newY },
      };

      setElementPositions(latestPositions);
      setIsCustomLayout(true);
    };

    const handlePointerUp = () => {
      setActiveDragId(null);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      // Persist the custom dragged position to cache immediately
      saveDesignToCache(latestPositions);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };


  // Helper for computing live canvas style properties
  const getElementStyleProps = (id: string, baseRem: number, defaultBold: boolean, isMonospace = false) => {
    const cfg = elementStyles[id] || DEFAULT_ELEMENT_STYLES[id] || { size: 1.0, bold: defaultBold, italic: false, uppercase: false, rotation: 0 };
    return {
      fontSize: `${(baseRem * (cfg.size || 1.0)).toFixed(3)}rem`,
      fontWeight: cfg.bold ? 800 : 400,
      fontStyle: cfg.italic ? 'italic' : 'normal',
      textTransform: (cfg.uppercase ? 'uppercase' : 'none') as React.CSSProperties['textTransform'],
      fontFamily: isMonospace ? 'var(--font-mono)' : 'inherit',
      outline: selectedElementId === id ? '2px solid var(--primary-500)' : 'none',
      outlineOffset: '2px',
    };
  };

  // Helper for computing 2D canvas font string in 300 DPI image generation
  const getCanvasFont = (id: string, basePx: number, defaultBold: boolean, isMonospace = false) => {
    const cfg = elementStyles[id] || DEFAULT_ELEMENT_STYLES[id] || { size: 1.0, bold: defaultBold, italic: false, uppercase: false, rotation: 0 };
    const fontPx = Math.max(8, Math.round(basePx * (cfg.size || 1.0)));
    const fontStyle = cfg.italic ? 'italic ' : '';
    const fontWeight = cfg.bold ? 'bold ' : 'normal ';
    const fontFamily = isMonospace ? 'monospace' : 'sans-serif';
    return `${fontStyle}${fontWeight}${fontPx}px ${fontFamily}`;
  };

  // Helper for inline CSS string in isolated print HTML
  const getPrintInlineCss = (id: string, basePt: number, defaultBold: boolean, isMonospace = false) => {
    const cfg = elementStyles[id] || DEFAULT_ELEMENT_STYLES[id] || { size: 1.0, bold: defaultBold, italic: false, uppercase: false, rotation: 0 };
    const pt = Math.max(3, Number((basePt * (cfg.size || 1.0)).toFixed(2)));
    const weight = cfg.bold ? 'bold' : 'normal';
    const style = cfg.italic ? 'italic' : 'normal';
    const transform = cfg.uppercase ? 'uppercase' : 'none';
    const family = isMonospace ? 'font-family:monospace;' : '';
    return `font-size:${pt}pt;font-weight:${weight};font-style:${style};text-transform:${transform};${family}`;
  };

  const formatElementText = (id: string, text: string) => {
    const cfg = elementStyles[id] || DEFAULT_ELEMENT_STYLES[id];
    return cfg?.uppercase ? text.toUpperCase() : text;
  };

  // Download raw QR code / Barcode graphic
  const handleDownloadCodeImage = async () => {
    if (!barcodeRendererRef.current) return;
    setIsDownloadingImage(true);
    try {
      const dataUrl = await barcodeRendererRef.current.getDataUrl();
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        const safeName = (productName || 'Product').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `RawCode_${codeType}_${barcodeValue}_${safeName}.png`;
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

  // High-Resolution 300 DPI Full Sticker Label PNG Export
  // Accurately renders the exact user-dragged coordinates for all templates
  const handleDownloadFullStickerImage = async () => {
    setIsDownloadingImage(true);
    try {
      const rawDataUrl = barcodeRendererRef.current ? await barcodeRendererRef.current.getDataUrl() : null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const safeName = (productName || 'Product').replace(/[^a-zA-Z0-9_-]/g, '_');
      // Merge with default positions to guarantee every element has valid coordinates
      const defaultPos = resolveDefaultPositions(arrangement, style, paperSize, orientation);
      const pos: LayoutPositions = { ...defaultPos, ...elementPositions };

      // Ensure vertical text baseline aligns with CSS translateY(-50%)
      ctx.textBaseline = 'middle';

      if (isSeznik && orientation === 'PORTRAIT') {
        // High-res Portrait Seznik Jewellery Tag: 150px x 1000px
        canvas.width = isSeznik3Up ? 480 : 150;
        canvas.height = 1000;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const stripCols = isSeznik3Up ? [10, 170, 330] : [0];
        const sW = 140;

        for (const colX of stripCols) {
          // Flap 1 (0 to 320px)
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.strokeRect(colX + 2, 4, sW - 4, 314);

          // Fold crease at 320px
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(colX + 2, 320);
          ctx.lineTo(colX + sW - 2, 320);
          ctx.stroke();
          ctx.setLineDash([]);

          // Flap 2 (320 to 640px)
          ctx.strokeStyle = '#94a3b8';
          ctx.strokeRect(colX + 2, 324, sW - 4, 314);

          // Tail strap (640 to 1000px, 40px wide in center)
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#cbd5e1';
          const tX = colX + (sW - 40) / 2;
          ctx.fillRect(tX, 642, 40, 354);
          ctx.strokeRect(tX, 642, 40, 354);

          ctx.textAlign = 'center';
          const midX = colX + sW / 2;

          if (showStoreName) {
            const sY = (pos.storeName.y / 100) * canvas.height;
            ctx.fillStyle = '#0f172a';
            ctx.font = getCanvasFont('storeName', 12, true);
            ctx.fillText(formatElementText('storeName', storeName || 'Store').substring(0, 16), midX, sY);
          }
          if (showProductName) {
            const pY = (pos.productName.y / 100) * canvas.height;
            ctx.fillStyle = '#1e293b';
            ctx.font = getCanvasFont('productName', 13, true);
            ctx.fillText(formatElementText('productName', productName || 'Item').substring(0, 16), midX, pY);
          }
          if (showPrice) {
            const prY = (pos.price.y / 100) * canvas.height;
            ctx.fillStyle = '#1e1b4b';
            ctx.font = getCanvasFont('price', 16, true);
            ctx.fillText(`₹${(price || 0).toFixed(2)}`, midX, prY);
          }

          if (rawDataUrl) {
            const img = new Image();
            await new Promise((res) => {
              img.onload = res;
              img.src = rawDataUrl;
            });
            const cW = Math.round((codeType === 'QR' ? 90 : 130) * codeScale);
            const cH = Math.round((codeType === 'QR' ? 90 : 54) * codeScale);
            const cY = (pos.code.y / 100) * canvas.height;
            ctx.drawImage(img, midX - cW / 2, cY - cH / 2, cW, cH);
          }

          const bY = (pos.barcodeText.y / 100) * canvas.height;
          ctx.fillStyle = '#0f172a';
          ctx.font = getCanvasFont('barcodeText', 11, true, true);
          ctx.fillText(formatElementText('barcodeText', effectiveBarcodeText).substring(0, 14), midX, bY);

          if (showSku && sku) {
            const skY = (pos.sku.y / 100) * canvas.height;
            ctx.fillStyle = '#64748b';
            ctx.font = getCanvasFont('sku', 10, false);
            ctx.fillText(formatElementText('sku', `SKU:${sku.substring(0, 12)}`), midX, skY);
          }
        }
      } else if (isSeznik) {
        // High-res Seznik Jewellery Tag: 1000px x 150px (Flap 1: 320px, Flap 2: 320px, Tail: 360px)
        canvas.width = 1000;
        canvas.height = 150;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Flap 1 border (0 to 320px)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(6, 6, 310, 138);

        ctx.textAlign = 'left';
        if (showStoreName) {
          const sX = (pos.storeName.x / 100) * canvas.width;
          const sY = (pos.storeName.y / 100) * canvas.height;
          ctx.fillStyle = '#0f172a';
          ctx.font = getCanvasFont('storeName', 14, true);
          ctx.fillText(formatElementText('storeName', storeName || 'Store').substring(0, 22), sX, sY);
        }
        if (showProductName) {
          const pX = (pos.productName.x / 100) * canvas.width;
          const pY = (pos.productName.y / 100) * canvas.height;
          ctx.fillStyle = '#1e293b';
          ctx.font = getCanvasFont('productName', 14, true);
          ctx.fillText(formatElementText('productName', productName || 'Item').substring(0, 22), pX, pY);
        }
        if (showPrice) {
          const prX = (pos.price.x / 100) * canvas.width;
          const prY = (pos.price.y / 100) * canvas.height;
          ctx.fillStyle = '#1e1b4b';
          ctx.font = getCanvasFont('price', 19, true);
          ctx.fillText(`₹${(price || 0).toFixed(2)}`, prX, prY);
        }

        // Dashed Seam / Fold Line at 320px
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(320, 4);
        ctx.lineTo(320, 146);
        ctx.stroke();
        ctx.setLineDash([]);

        // Flap 2 border (320 to 640px)
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(324, 6, 310, 138);

        if (rawDataUrl) {
          const img = new Image();
          await new Promise((res) => {
            img.onload = res;
            img.src = rawDataUrl;
          });
          const codeW = Math.round((codeType === 'QR' ? 100 : 130) * codeScale);
          const codeH = Math.round((codeType === 'QR' ? 100 : 55) * codeScale);
          const cX = (pos.code.x / 100) * canvas.width;
          const cY = (pos.code.y / 100) * canvas.height;
          ctx.drawImage(img, cX - codeW / 2, cY - codeH / 2, codeW, codeH);
        }

        ctx.textAlign = 'left';
        const bX = (pos.barcodeText.x / 100) * canvas.width;
        const bY = (pos.barcodeText.y / 100) * canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.font = getCanvasFont('barcodeText', 13, true, true);
        ctx.fillText(formatElementText('barcodeText', effectiveBarcodeText).substring(0, 14), bX, bY);

        if (showSku && sku) {
          const skX = (pos.sku.x / 100) * canvas.width;
          const skY = (pos.sku.y / 100) * canvas.height;
          ctx.fillStyle = '#64748b';
          ctx.font = getCanvasFont('sku', 12, false);
          ctx.fillText(formatElementText('sku', `SKU:${sku.substring(0, 12)}`), skX, skY);
        }

        // Tail strap (640 to 1000px, 40px high in center: y = 55)
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.fillRect(640, 55, 355, 40);
        ctx.strokeRect(640, 55, 355, 40);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SEZNIK JOSH TAIL STRAP (36mm)', 815, 78);

      } else if (isDumbbell) {
        // High-res Dumbbell Sticker: 700px x 120px (Symmetrical 28mm Left Wing, 14mm Bridge, 28mm Right Wing)
        canvas.width = 700;
        canvas.height = 120;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Die-cut background cutouts for central neck
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(280, 0, 140, 44);
        ctx.fillRect(280, 76, 140, 44);

        // Left Wing (0 to 280px)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(6, 6, 274, 108);

        // Center Neck Strip (280 to 420px)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(280, 44, 140, 32);
        ctx.strokeStyle = '#64748b';
        ctx.strokeRect(280, 44, 140, 32);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STRING LOOP', 350, 60);

        // Right Wing (420 to 700px)
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(420, 6, 274, 108);

        // Render Left Wing elements at user coordinates
        ctx.textAlign = 'left';
        if (showStoreName) {
          const sX = (pos.storeName.x / 100) * canvas.width;
          const sY = (pos.storeName.y / 100) * canvas.height;
          ctx.fillStyle = '#0f172a';
          ctx.font = getCanvasFont('storeName', 13, true);
          ctx.fillText(formatElementText('storeName', storeName || 'Store').substring(0, 18), sX, sY);
        }
        if (showProductName) {
          const pX = (pos.productName.x / 100) * canvas.width;
          const pY = (pos.productName.y / 100) * canvas.height;
          ctx.fillStyle = '#1e293b';
          ctx.font = getCanvasFont('productName', 13, true);
          ctx.fillText(formatElementText('productName', productName || 'Item').substring(0, 20), pX, pY);
        }
        if (showPrice) {
          const prX = (pos.price.x / 100) * canvas.width;
          const prY = (pos.price.y / 100) * canvas.height;
          ctx.fillStyle = '#1e1b4b';
          ctx.font = getCanvasFont('price', 18, true);
          ctx.fillText(`₹${(price || 0).toFixed(2)}`, prX, prY);
        }

        // Render Right Wing elements at user coordinates
        if (rawDataUrl) {
          const img = new Image();
          await new Promise((res) => {
            img.onload = res;
            img.src = rawDataUrl;
          });
          const codeW = Math.round((codeType === 'QR' ? 84 : 110) * codeScale);
          const codeH = Math.round((codeType === 'QR' ? 84 : 50) * codeScale);
          const cX = (pos.code.x / 100) * canvas.width;
          const cY = (pos.code.y / 100) * canvas.height;
          ctx.drawImage(img, cX - codeW / 2, cY - codeH / 2, codeW, codeH);
        }

        ctx.textAlign = 'left';
        const bX = (pos.barcodeText.x / 100) * canvas.width;
        const bY = (pos.barcodeText.y / 100) * canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.font = getCanvasFont('barcodeText', 12, true, true);
        ctx.fillText(formatElementText('barcodeText', effectiveBarcodeText).substring(0, 12), bX, bY);

        if (showSku && sku) {
          const skX = (pos.sku.x / 100) * canvas.width;
          const skY = (pos.sku.y / 100) * canvas.height;
          ctx.fillStyle = '#64748b';
          ctx.font = getCanvasFont('sku', 11, false);
          ctx.fillText(formatElementText('sku', `SKU:${sku.substring(0, 10)}`), skX, skY);
        }

      } else if (isRatTail || arrangement === 'DUAL_FLAP') {
        // High-res Rat-Tail Sticker: 760px x 120px (Flap 1: 260px, Flap 2: 260px, Tail: 240px)
        canvas.width = 760;
        canvas.height = 120;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Flap 1 border (0 to 260px)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(6, 6, 252, 108);

        ctx.textAlign = 'left';
        if (showStoreName) {
          const sX = (pos.storeName.x / 100) * canvas.width;
          const sY = (pos.storeName.y / 100) * canvas.height;
          ctx.fillStyle = '#0f172a';
          ctx.font = getCanvasFont('storeName', 13, true);
          ctx.fillText(formatElementText('storeName', storeName || 'Store').substring(0, 20), sX, sY);
        }
        if (showProductName) {
          const pX = (pos.productName.x / 100) * canvas.width;
          const pY = (pos.productName.y / 100) * canvas.height;
          ctx.fillStyle = '#1e293b';
          ctx.font = getCanvasFont('productName', 13, true);
          ctx.fillText(formatElementText('productName', productName || 'Item').substring(0, 20), pX, pY);
        }
        if (showPrice) {
          const prX = (pos.price.x / 100) * canvas.width;
          const prY = (pos.price.y / 100) * canvas.height;
          ctx.fillStyle = '#1e1b4b';
          ctx.font = getCanvasFont('price', 18, true);
          ctx.fillText(`₹${(price || 0).toFixed(2)}`, prX, prY);
        }

        // Dashed Seam / Fold Line at 260px
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(260, 4);
        ctx.lineTo(260, 116);
        ctx.stroke();
        ctx.setLineDash([]);

        // Flap 2 border (260 to 520px)
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(264, 6, 252, 108);

        if (rawDataUrl) {
          const img = new Image();
          await new Promise((res) => {
            img.onload = res;
            img.src = rawDataUrl;
          });
          const codeW = Math.round((codeType === 'QR' ? 84 : 110) * codeScale);
          const codeH = Math.round((codeType === 'QR' ? 84 : 50) * codeScale);
          const cX = (pos.code.x / 100) * canvas.width;
          const cY = (pos.code.y / 100) * canvas.height;
          ctx.drawImage(img, cX - codeW / 2, cY - codeH / 2, codeW, codeH);
        }

        ctx.textAlign = 'left';
        const bX = (pos.barcodeText.x / 100) * canvas.width;
        const bY = (pos.barcodeText.y / 100) * canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.font = getCanvasFont('barcodeText', 12, true, true);
        ctx.fillText(formatElementText('barcodeText', effectiveBarcodeText).substring(0, 12), bX, bY);

        if (showSku && sku) {
          const skX = (pos.sku.x / 100) * canvas.width;
          const skY = (pos.sku.y / 100) * canvas.height;
          ctx.fillStyle = '#64748b';
          ctx.font = getCanvasFont('sku', 11, false);
          ctx.fillText(formatElementText('sku', `SKU:${sku.substring(0, 10)}`), skX, skY);
        }

        // Tail strap (520 to 760px)
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.fillRect(524, 44, 230, 32);
        ctx.strokeRect(524, 44, 230, 32);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAIL STRAP', 635, 60);

      } else if (arrangement === 'SIDE_BY_SIDE') {
        canvas.width = 500;
        canvas.height = 300;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

        if (rawDataUrl) {
          const img = new Image();
          await new Promise((res) => {
            img.onload = res;
            img.src = rawDataUrl;
          });
          const cSize = Math.round(130 * codeScale);
          const cX = (pos.code.x / 100) * canvas.width;
          const cY = (pos.code.y / 100) * canvas.height;
          ctx.drawImage(img, cX - cSize / 2, cY - cSize / 2, cSize, cSize);
        }

        ctx.textAlign = 'center';
        const bX = (pos.barcodeText.x / 100) * canvas.width;
        const bY = (pos.barcodeText.y / 100) * canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.font = getCanvasFont('barcodeText', 13, true, true);
        ctx.fillText(formatElementText('barcodeText', effectiveBarcodeText), bX, bY);

        ctx.textAlign = 'left';
        if (showStoreName) {
          const sX = (pos.storeName.x / 100) * canvas.width;
          const sY = (pos.storeName.y / 100) * canvas.height;
          ctx.fillStyle = '#0f172a';
          ctx.font = getCanvasFont('storeName', 15, true);
          ctx.fillText(formatElementText('storeName', storeName || 'Store').substring(0, 22), sX, sY);
        }
        if (showProductName) {
          const pX = (pos.productName.x / 100) * canvas.width;
          const pY = (pos.productName.y / 100) * canvas.height;
          ctx.fillStyle = '#1e293b';
          ctx.font = getCanvasFont('productName', 15, true);
          ctx.fillText(formatElementText('productName', productName || 'Item').substring(0, 22), pX, pY);
        }
        if (showSku && sku) {
          const skX = (pos.sku.x / 100) * canvas.width;
          const skY = (pos.sku.y / 100) * canvas.height;
          ctx.fillStyle = '#64748b';
          ctx.font = getCanvasFont('sku', 13, false);
          ctx.fillText(formatElementText('sku', `SKU: ${sku}`), skX, skY);
        }
        if (showPrice) {
          const prX = (pos.price.x / 100) * canvas.width;
          const prY = (pos.price.y / 100) * canvas.height;
          ctx.fillStyle = '#1e1b4b';
          ctx.font = getCanvasFont('price', 24, true);
          ctx.fillText(`₹${(price || 0).toFixed(2)}`, prX, prY);
        }

      } else {
        // Standard Stacked Layout (500 x 300)
        canvas.width = 500;
        canvas.height = 300;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

        ctx.textAlign = 'center';
        if (showStoreName) {
          const sX = (pos.storeName.x / 100) * canvas.width;
          const sY = (pos.storeName.y / 100) * canvas.height;
          ctx.fillStyle = '#0f172a';
          ctx.font = getCanvasFont('storeName', 16, true);
          ctx.fillText(formatElementText('storeName', storeName || 'Store').substring(0, 28), sX, sY);
        }
        if (showProductName) {
          const pX = (pos.productName.x / 100) * canvas.width;
          const pY = (pos.productName.y / 100) * canvas.height;
          ctx.fillStyle = '#1e293b';
          ctx.font = getCanvasFont('productName', 16, true);
          ctx.fillText(formatElementText('productName', productName || 'Item').substring(0, 28), pX, pY);
        }

        if (rawDataUrl) {
          const img = new Image();
          await new Promise((res) => {
            img.onload = res;
            img.src = rawDataUrl;
          });
          const cW = Math.round((codeType === 'QR' ? 120 : 320) * codeScale);
          const cH = Math.round((codeType === 'QR' ? 120 : 64) * codeScale);
          const cX = (pos.code.x / 100) * canvas.width;
          const cY = (pos.code.y / 100) * canvas.height;
          ctx.drawImage(img, cX - cW / 2, cY - cH / 2, cW, cH);
        }

        const bX = (pos.barcodeText.x / 100) * canvas.width;
        const bY = (pos.barcodeText.y / 100) * canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.font = getCanvasFont('barcodeText', 14, true, true);
        ctx.fillText(formatElementText('barcodeText', effectiveBarcodeText), bX, bY);

        ctx.textAlign = 'left';
        if (showSku && sku) {
          const skX = (pos.sku.x / 100) * canvas.width;
          const skY = (pos.sku.y / 100) * canvas.height;
          ctx.fillStyle = '#64748b';
          ctx.font = getCanvasFont('sku', 14, false);
          ctx.fillText(formatElementText('sku', `SKU: ${sku}`), skX, skY);
        }

        ctx.textAlign = 'right';
        if (showPrice) {
          const prX = (pos.price.x / 100) * canvas.width;
          const prY = (pos.price.y / 100) * canvas.height;
          ctx.fillStyle = '#1e1b4b';
          ctx.font = getCanvasFont('price', 22, true);
          ctx.fillText(`₹${(price || 0).toFixed(2)}`, prX, prY);
        }
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Sticker_${isDumbbell ? 'Dumbbell' : style}_${codeType}_${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Failed to export full sticker image:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  // Robust Isolated Print Engine
  // Positions elements with CSS percentage coordinates matching user drag & drop layout
  const executeIsolatedPrint = async () => {
    setIsGenerating(true);
    try {
      let codeDataUrl = barcodeRendererRef.current ? await barcodeRendererRef.current.getDataUrl() : null;

      if (!codeDataUrl && typeof window !== 'undefined') {
        const QRCode = (await import('qrcode')).default;
        if (codeType === 'QR') {
          codeDataUrl = await QRCode.toDataURL(activePayload, { width: 280, margin: 1 });
        }
      }

      let w_mm = '50mm';
      let h_mm = '30mm';
      if (isA4) {
        const grid = activeA4Grid;
        w_mm = `${grid.labelW_mm}mm`;
        h_mm = `${grid.labelH_mm}mm`;
      } else if (isSeznik3Up) {
        w_mm = '48mm';
        h_mm = '100mm';
      } else if (isSeznik) {
        if (orientation === 'PORTRAIT') {
          w_mm = '15mm';
          h_mm = '100mm';
        } else {
          w_mm = '100mm';
          h_mm = '15mm';
        }
      } else if (isDumbbell) {
        w_mm = '70mm';
        h_mm = '12mm';
      } else if (isRatTail) {
        w_mm = '76mm';
        h_mm = '12mm';
      } else if (paperSize === 'THERMAL_40x40') {
        w_mm = '40mm';
        h_mm = '40mm';
      } else if (paperSize === 'THERMAL_38x25') {
        w_mm = '38mm';
        h_mm = '25mm';
      }

      const defaultPos = resolveDefaultPositions(arrangement, style, paperSize, orientation);
      const pos: LayoutPositions = { ...defaultPos, ...elementPositions };

      // Construct Unit HTML matching user drag & drop coordinates
      const buildUnitHtml = () => {
        if (isA4) {
          const grid = activeA4Grid;
          const qrH = paperSize === 'A4_GRID_65' ? 10.5 : paperSize === 'A4_GRID_40' ? 12.0 : 15.0;
          const barH = paperSize === 'A4_GRID_65' ? 6.0 : paperSize === 'A4_GRID_40' ? 7.5 : 9.5;
          return `
            <div class="label-unit-a4" style="width:${grid.labelW_mm}mm;height:${grid.labelH_mm}mm;position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;border:0.15mm dashed #cbd5e1;padding:1mm;font-family:Arial,Helvetica,sans-serif;color:#000000;">
              ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', paperSize === 'A4_GRID_65' ? 5.2 : 6, true)}white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
              ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', paperSize === 'A4_GRID_65' ? 5.5 : 6.5, true)}white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
              ${codeDataUrl ? `
                <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
                  <img src="${codeDataUrl}" style="height:${codeType === 'BARCODE' ? `${barH * codeScale}mm` : `${qrH * codeScale}mm`};max-width:${grid.labelW_mm - 6}mm;object-fit:contain;" />
                </div>
              ` : ''}
              <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', paperSize === 'A4_GRID_65' ? 4.5 : 5, true, true)}white-space:nowrap;">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText))}</div>
              ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', paperSize === 'A4_GRID_65' ? 5.8 : 7, true)}">₹${Number(price || 0).toFixed(2)}</div>` : ''}
              ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', paperSize === 'A4_GRID_65' ? 4.2 : 5, false)}color:#333;">SKU:${escapeHtml(formatElementText('sku', sku))}</div>` : ''}
            </div>
          `;
        } else if (isSeznik) {
          if (orientation === 'PORTRAIT') {
            // Authentic Seznik Portrait Tag 14.3mm x 100mm (32mm Top Flap, 32mm Middle Flap, 36mm Tail)
            return `
              <div class="label-unit-seznik-portrait" style="width:${isSeznik3Up ? '14mm' : '14.3mm'};height:100mm;position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000;">
                <!-- Background Guides -->
                <div style="position:absolute;left:0;top:0;width:100%;height:32mm;border:0.2mm solid #cbd5e1;border-bottom:0.3mm dashed #64748b;box-sizing:border-box;"></div>
                <div style="position:absolute;left:0;top:32mm;width:100%;height:32mm;border:0.2mm solid #cbd5e1;box-sizing:border-box;"></div>
                <div style="position:absolute;left:5.15mm;top:64mm;width:4mm;height:36mm;border:0.2mm solid #cbd5e1;background:#f8fafc;box-sizing:border-box;"></div>

                <!-- Custom Elements in Portrait with rotation support -->
                ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', 5.2, true)}line-height:1;white-space:nowrap;text-align:center;">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
                ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', 5.5, true)}line-height:1;white-space:nowrap;text-align:center;">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
                ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', 6.8, true)}line-height:1;text-align:center;">₹${Number(price || 0).toFixed(2)}</div>` : ''}

                ${codeDataUrl ? `
                  <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
                    <img src="${codeDataUrl}" style="height:${codeType === 'BARCODE' ? `${6.5 * codeScale}mm` : `${10.0 * codeScale}mm`};max-width:13.5mm;object-fit:contain;" />
                  </div>
                ` : ''}

                <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', 4.8, true, true)}line-height:1;text-align:center;">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText.substring(0, 14)))}</div>
                ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', 4.4, false)}color:#333;line-height:1;text-align:center;">SKU:${escapeHtml(formatElementText('sku', sku.substring(0, 12)))}</div>` : ''}
              </div>
            `;
          }

          // Authentic Seznik Landscape Jewellery Tag 100mm x 15mm (32mm Front Flap, 32mm Back Flap, 36mm Tail)
          return `
            <div class="label-unit-seznik-100x15" style="width:100mm;height:15mm;position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000;">
              <!-- Background Guides -->
              <div style="position:absolute;left:0;top:0;width:32mm;height:15mm;border:0.2mm solid #cbd5e1;border-right:0.3mm dashed #64748b;box-sizing:border-box;"></div>
              <div style="position:absolute;left:32mm;top:0;width:32mm;height:15mm;border:0.2mm solid #cbd5e1;box-sizing:border-box;"></div>
              <div style="position:absolute;left:64mm;top:5.5mm;width:36mm;height:4mm;border:0.2mm solid #cbd5e1;background:#f8fafc;box-sizing:border-box;"></div>

              <!-- Custom Elements in Landscape -->
              ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(0,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', 5.5, true)}line-height:1;white-space:nowrap;">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
              ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(0,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', 5.5, true)}line-height:1;white-space:nowrap;">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
              ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(0,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', 7, true)}line-height:1;">₹${Number(price || 0).toFixed(2)}</div>` : ''}

              ${codeDataUrl ? `
                <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
                  <img src="${codeDataUrl}" style="height:${codeType === 'BARCODE' ? `${7.5 * codeScale}mm` : `${10.5 * codeScale}mm`};max-width:30mm;object-fit:contain;" />
                </div>
              ` : ''}

              <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(0,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', 5.2, true, true)}line-height:1;">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText.substring(0, 14)))}</div>
              ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(0,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', 4.5, false)}color:#333;line-height:1;">SKU:${escapeHtml(formatElementText('sku', sku.substring(0, 12)))}</div>` : ''}
            </div>
          `;
        } else if (isDumbbell) {
          // Authentic Jewelry Dumbbell 70mm x 12mm
          return `
            <div style="width:70mm;height:12mm;position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000;">
              <!-- Background Dumbbell Guides -->
              <div style="position:absolute;left:0;top:0;width:28mm;height:12mm;border:0.2mm solid #cbd5e1;border-right:0.3mm dashed #64748b;box-sizing:border-box;"></div>
              <div style="position:absolute;left:28mm;top:4.5mm;width:14mm;height:3mm;border-top:0.3mm solid #64748b;border-bottom:0.3mm solid #64748b;background:#f8fafc;box-sizing:border-box;"></div>
              <div style="position:absolute;left:42mm;top:0;width:28mm;height:12mm;border:0.2mm solid #cbd5e1;border-left:0.3mm dashed #64748b;box-sizing:border-box;"></div>

              <!-- Draggable / Custom Positioned Elements -->
              ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(0,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', 5, true)}line-height:1;white-space:nowrap;">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
              ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(0,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', 5, true)}line-height:1;white-space:nowrap;">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
              ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(0,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', 6.5, true)}line-height:1;">₹${Number(price || 0).toFixed(2)}</div>` : ''}
              
              ${codeDataUrl ? `
                <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
                  <img src="${codeDataUrl}" style="height:${codeType === 'BARCODE' ? `${5.5 * codeScale}mm` : `${8.5 * codeScale}mm`};max-width:25mm;object-fit:contain;" />
                </div>
              ` : ''}
              
              <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(0,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', 5, true, true)}line-height:1;">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText.substring(0, 12)))}</div>
              ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(0,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', 4, false)}color:#333;line-height:1;">SKU:${escapeHtml(formatElementText('sku', sku.substring(0, 10)))}</div>` : ''}
            </div>
          `;
        } else if (isRatTail || arrangement === 'DUAL_FLAP') {
          // Jewelry Rat-Tail 76mm x 12mm
          return `
            <div style="width:76mm;height:12mm;position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000000;">
              <!-- Background Guides -->
              <div style="position:absolute;left:0;top:0;width:26mm;height:12mm;border:0.2mm solid #cbd5e1;border-right:0.3mm dashed #64748b;box-sizing:border-box;"></div>
              <div style="position:absolute;left:26mm;top:0;width:26mm;height:12mm;border:0.2mm solid #cbd5e1;box-sizing:border-box;"></div>
              <div style="position:absolute;left:52mm;top:4.5mm;width:24mm;height:3mm;border:0.2mm solid #cbd5e1;background:#f8fafc;box-sizing:border-box;"></div>

              <!-- Custom Elements -->
              ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(0,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', 5, true)}line-height:1;white-space:nowrap;">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
              ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(0,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', 5, true)}line-height:1;white-space:nowrap;">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
              ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(0,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', 6.5, true)}line-height:1;">₹${Number(price || 0).toFixed(2)}</div>` : ''}

              ${codeDataUrl ? `
                <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;display:flex;align-items:center;justify-content:center;">
                  <img src="${codeDataUrl}" style="height:${codeType === 'BARCODE' ? `${6.5 * codeScale}mm` : `${9.5 * codeScale}mm`};max-width:24mm;object-fit:contain;" />
                </div>
              ` : ''}

              <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(0,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', 5, true, true)}line-height:1;">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText.substring(0, 12)))}</div>
              ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(0,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', 4, false)}color:#333;line-height:1;">SKU:${escapeHtml(formatElementText('sku', sku.substring(0, 10)))}</div>` : ''}
            </div>
          `;
        } else if (arrangement === 'SIDE_BY_SIDE') {
          return `
            <div style="width:${w_mm};height:${h_mm};position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;border:0.3mm solid #cbd5e1;padding:1mm;font-family:Arial,Helvetica,sans-serif;color:#000000;">
              ${codeDataUrl ? `
                <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;">
                  <img src="${codeDataUrl}" style="max-height:${parseFloat(h_mm) * 0.7 * codeScale}mm;max-width:30mm;object-fit:contain;" />
                </div>
              ` : ''}
              <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', 5, true, true)}">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText))}</div>
              ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(0,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', 6, true)}">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
              ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(0,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', 6, true)}">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
              ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(0,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', 5, false)}color:#444;">SKU: ${escapeHtml(formatElementText('sku', sku))}</div>` : ''}
              ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(0,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', 7.5, true)}">₹${Number(price || 0).toFixed(2)}</div>` : ''}
            </div>
          `;
        } else {
          // Standard Stacked Layout
          return `
            <div style="width:${w_mm};height:${h_mm};position:relative;box-sizing:border-box;overflow:hidden;background:#ffffff;border:0.3mm solid #cbd5e1;padding:1mm;font-family:Arial,Helvetica,sans-serif;color:#000000;">
              ${showStoreName ? `<div style="position:absolute;left:${pos.storeName.x}%;top:${pos.storeName.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.storeName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('storeName', 6, true)}white-space:nowrap;">${escapeHtml(formatElementText('storeName', storeName || 'Store'))}</div>` : ''}
              ${showProductName ? `<div style="position:absolute;left:${pos.productName.x}%;top:${pos.productName.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.productName?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('productName', 6.5, true)}white-space:nowrap;">${escapeHtml(formatElementText('productName', productName || 'Item'))}</div>` : ''}
              ${codeDataUrl ? `
                <div style="position:absolute;left:${pos.code.x}%;top:${pos.code.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.code?.rotation || 0}deg);transform-origin:center center;">
                  <img src="${codeDataUrl}" style="height:${codeType === 'BARCODE' ? `${7 * codeScale}mm` : `${13 * codeScale}mm`};max-width:40mm;object-fit:contain;" />
                </div>
              ` : ''}
              <div style="position:absolute;left:${pos.barcodeText.x}%;top:${pos.barcodeText.y}%;transform:translate(-50%,-50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('barcodeText', 5, true, true)}">${escapeHtml(formatElementText('barcodeText', effectiveBarcodeText))}</div>
              ${showSku && sku ? `<div style="position:absolute;left:${pos.sku.x}%;top:${pos.sku.y}%;transform:translate(0,-50%) rotate(${elementStyles.sku?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('sku', 5.5, false)}">SKU:${escapeHtml(formatElementText('sku', sku))}</div>` : ''}
              ${showPrice ? `<div style="position:absolute;left:${pos.price.x}%;top:${pos.price.y}%;transform:translate(-100%,-50%) rotate(${elementStyles.price?.rotation || 0}deg);transform-origin:center center;${getPrintInlineCss('price', 7, true)}">₹${Number(price || 0).toFixed(2)}</div>` : ''}
            </div>
          `;
        }
      };

      const singleLabelHtml = buildUnitHtml();
      let bodyHtml = '';
      const printQty = effectiveQuantity;

      if (isA4) {
        // Calibrated Multi-Page A4 Sheet Grid Printing
        const grid = activeA4Grid;
        const totalSlots = grid.totalSlots;
        const pagesCount = Math.ceil(((startOffsetSlot - 1) + printQty) / totalSlots);
        let remainingToPrint = printQty;

        for (let p = 0; p < pagesCount; p++) {
          bodyHtml += `
            <div class="a4-sheet-page" style="width:210mm;height:297mm;padding:${grid.marginV_mm}mm ${grid.marginH_mm}mm;display:grid;grid-template-columns:repeat(${grid.cols}, ${grid.labelW_mm}mm);grid-template-rows:repeat(${grid.rows}, ${grid.labelH_mm}mm);gap:0;box-sizing:border-box;page-break-after:always;background:#ffffff;margin:0 auto;overflow:hidden;">
          `;

          for (let slot = 1; slot <= totalSlots; slot++) {
            if (p === 0 && slot < startOffsetSlot) {
              // Blank slot for already peeled stickers on page 1
              bodyHtml += `<div style="width:${grid.labelW_mm}mm;height:${grid.labelH_mm}mm;box-sizing:border-box;"></div>`;
            } else if (remainingToPrint > 0) {
              bodyHtml += singleLabelHtml;
              remainingToPrint--;
            } else {
              // Empty slot at the end of the final page
              bodyHtml += `<div style="width:${grid.labelW_mm}mm;height:${grid.labelH_mm}mm;box-sizing:border-box;"></div>`;
            }
          }

          bodyHtml += `</div>`;
        }
      } else if (isSeznik3Up) {
        // 3-Across Seznik Reel (48mm x 100mm feed, 3 columns side by side with calibrated side padding and gap)
        const cols = 3;
        const totalRows = Math.ceil(printQty / cols);
        let curIndex = 0;
        for (let r = 0; r < totalRows; r++) {
          bodyHtml += `
            <div style="width:48mm;height:100mm;page-break-after:always;display:flex;flex-direction:row;padding:${printOffsetY_mm}mm 0 0 ${2.0 + printOffsetX_mm}mm;gap:1.5mm;box-sizing:border-box;margin:0 auto;overflow:hidden;background:#ffffff;">
          `;
          for (let c = 0; c < cols; c++) {
            if (curIndex < printQty) {
              bodyHtml += singleLabelHtml;
              curIndex++;
            } else {
              bodyHtml += `<div style="width:14mm;height:100mm;box-sizing:border-box;"></div>`;
            }
          }
          bodyHtml += `</div>`;
        }
      } else {
        for (let i = 0; i < printQty; i++) {
          bodyHtml += `
            <div style="width:${w_mm};height:${h_mm};page-break-after:always;display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;">
              ${singleLabelHtml}
            </div>
          `;
        }
      }

      // Create isolated invisible iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error('Cannot access print iframe document');

      const printPageSize = isA4
        ? 'A4 portrait'
        : isSeznik3Up 
        ? '48mm 100mm' 
        : (isSeznik && orientation === 'PORTRAIT') 
        ? '15mm 100mm' 
        : `${w_mm} ${h_mm}`;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>QuickBill Print - ${escapeHtml(productName)}</title>
          <style>
            @page {
              size: ${printPageSize};
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
            }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 300);

    } catch (err) {
      console.error('Isolated print engine error, falling back to window.print():', err);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  // Download PDF with custom coordinates sent to backend ReportLab service
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const defaultPos = resolveDefaultPositions(arrangement, style, paperSize, orientation);
      const pos: LayoutPositions = { ...defaultPos, ...elementPositions };

      const payload = {
        itemName: productName,
        sku: sku,
        barcode: itemBarcode || effectiveBarcodeText,
        salePrice: price,
        publicItemId,
        style,
        paperSize,
        orientation,
        labelsAcross: isSeznik3Up ? 3 : 1,
        codeType,
        quantity: effectiveQuantity,
        showPrice,
        showSku,
        showStoreName,
        storeName: storeName || 'Store',
        customPositions: pos, // Pass custom layout coordinates to backend ReportLab!
        codeScale,
        elementStyles,
        customBarcodeText: effectiveBarcodeText,
        printOffsetX: printOffsetX_mm,
        printOffsetY: printOffsetY_mm,
      };

      const response = await apiClient.post('/labels/custom-pdf', payload, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Label_${isA4 ? 'A4_Sticker_Grid' : isSeznik3Up ? 'Seznik_3UP' : isDumbbell ? 'Dumbbell' : style}_${codeType}_${sku || barcodeValue}_${effectiveQuantity}qty.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Backend PDF endpoint error, falling back to isolated print dialog:', err);
      executeIsolatedPrint();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div 
        className="modal-content modal-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '100%',
          maxWidth: 900, 
          maxHeight: '94vh', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        {/* MODAL HEADER */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <QrCode size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Interactive Barcode &amp; QR Label Studio
                </h3>
                {cacheNotification && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                    ✓ {cacheNotification}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--neutral-500)' }}>
                Drag elements directly on canvas • Symmetrical Jewelry Dumbbell &amp; Rat-Tail Rolls • Auto-saved template cache
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL SCROLLABLE BODY */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 1. SYMBOLOGY SELECTOR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Code Symbology
            </label>
            <div className="modal-grid-row-2">
              <div
                onClick={() => {
                  setCodeType('QR');
                  saveDesignToCache(elementPositions, paperSize, style, arrangement, 'QR');
                }}
                style={{
                  padding: '10px 14px',
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
                    <QrCode size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: codeType === 'QR' ? 'var(--primary-900)' : 'var(--neutral-900)' }}>
                      2D QR Code
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                      Universal smartphone camera scan
                    </div>
                  </div>
                </div>
                {codeType === 'QR' && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--primary-700)', backgroundColor: '#ffffff', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--primary-300)' }}>
                    Active
                  </span>
                )}
              </div>

              <div
                onClick={() => {
                  setCodeType('BARCODE');
                  saveDesignToCache(elementPositions, paperSize, style, arrangement, 'BARCODE');
                }}
                style={{
                  padding: '10px 14px',
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
            </div>
          </div>

          {/* 2. INTERACTIVE DRAG & DROP DESIGN CANVAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  2. Interactive Design Canvas
                </label>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)', padding: '2px 8px', borderRadius: 10 }}>
                  {paperSize === 'SEZNIK_3UP_100x15'
                    ? '100 × 15 mm (3-UP Reel)'
                    : paperSize === 'SEZNIK_100x15'
                    ? '100 × 15 mm (1-UP Tag)'
                    : paperSize === 'RAT_TAIL_76x12'
                    ? '76 × 12 mm'
                    : paperSize === 'DUMBBELL_70x12'
                    ? '70 × 12 mm'
                    : paperSize === 'THERMAL_40x40'
                    ? '40 × 40 mm'
                    : paperSize === 'THERMAL_38x25'
                    ? '38 × 25 mm'
                    : paperSize === 'THERMAL_50x30'
                    ? '50 × 30 mm'
                    : paperSize === 'A4_GRID_40'
                    ? 'A4 40-Up (48.5 × 25.4 mm)'
                    : paperSize === 'A4_GRID_65'
                    ? 'A4 65-Up (38.1 × 21.2 mm)'
                    : 'A4 24-Up (64 × 33.9 mm)'}
                </span>
                {isCustomLayout && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: 6 }}>
                    Custom Drag Layout Active
                  </span>
                )}
              </div>

              {/* Canvas Controls: Drag tools, Reset, Snap & Scale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Reset Layout Button */}
                <button
                  type="button"
                  onClick={() => resetLayout()}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.70rem', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Reset elements to standard template positions"
                >
                  <RotateCcw size={12} />
                  <span>Reset Layout</span>
                </button>

                {/* Snap to grid toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextSnap = !dragSnapToGrid;
                    setDragSnapToGrid(nextSnap);
                    saveDesignToCache(elementPositions, paperSize, style, arrangement, codeType, codeScale, nextSnap, elementStyles, orientation);
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${dragSnapToGrid ? 'var(--primary-400)' : 'var(--neutral-300)'}`,
                    backgroundColor: dragSnapToGrid ? 'var(--primary-50)' : '#ffffff',
                    color: dragSnapToGrid ? 'var(--primary-700)' : 'var(--neutral-600)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Snap dragging to grid"
                >
                  <Grid size={12} />
                  <span>Snap: {dragSnapToGrid ? 'ON' : 'OFF'}</span>
                </button>

                {/* Orientation Switcher */}
                <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--neutral-100)', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-500)', padding: '0 4px' }}>Orient:</span>
                  {(['PORTRAIT', 'LANDSCAPE'] as const).map((orient) => (
                    <button
                      key={orient}
                      type="button"
                      onClick={() => handleOrientationSelect(orient)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        backgroundColor: orientation === orient ? '#ffffff' : 'transparent',
                        color: orientation === orient ? 'var(--primary-700)' : 'var(--neutral-600)',
                        boxShadow: orientation === orient ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      }}
                      title={orient === 'PORTRAIT' ? 'Vertical 14.3mm Strip (Amazon Reel Standard)' : 'Horizontal 32mm Flap (Rotated)'}
                    >
                      {orient === 'PORTRAIT' ? 'Portrait' : 'Landscape'}
                    </button>
                  ))}
                </div>

                {/* Layout Switcher */}
                <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--neutral-100)', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-500)', padding: '0 4px' }}>Layout:</span>
                  {(['DUAL_FLAP', 'STACKED', 'SIDE_BY_SIDE'] as const).map((arr) => (
                    <button
                      key={arr}
                      type="button"
                      onClick={() => handleArrangementSelect(arr)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        backgroundColor: arrangement === arr ? '#ffffff' : 'transparent',
                        color: arrangement === arr ? 'var(--primary-700)' : 'var(--neutral-600)',
                        boxShadow: arrangement === arr ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {arr === 'DUAL_FLAP' ? (isDumbbell ? 'Dumbbell' : 'Dual-Flap') : arr === 'STACKED' ? 'Stacked' : 'Side-by-Side'}
                    </button>
                  ))}
                </div>

                {/* Custom Code Scaling (Fine Slider + Stepper + Direct % + Presets) */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: 'var(--neutral-100)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>Scale:</span>

                  {/* Decrement Stepper */}
                  <button
                    type="button"
                    onClick={() => handleUpdateCodeScale(codeScale - 0.05)}
                    style={{
                      width: 18,
                      height: 18,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      border: '1px solid var(--neutral-300)',
                      backgroundColor: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      color: 'var(--neutral-700)',
                      padding: 0,
                      lineHeight: 1
                    }}
                    title="Decrease code size by 5%"
                  >
                    -
                  </button>

                  {/* Smooth Range Slider (40% to 200%) */}
                  <input
                    type="range"
                    min="0.4"
                    max="2.0"
                    step="0.05"
                    value={codeScale}
                    onChange={(e) => handleUpdateCodeScale(parseFloat(e.target.value))}
                    style={{
                      width: 58,
                      height: 4,
                      accentColor: 'var(--primary-600)',
                      cursor: 'pointer'
                    }}
                    title={`Code Scale: ${Math.round(codeScale * 100)}%`}
                  />

                  {/* Increment Stepper */}
                  <button
                    type="button"
                    onClick={() => handleUpdateCodeScale(codeScale + 0.05)}
                    style={{
                      width: 18,
                      height: 18,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      border: '1px solid var(--neutral-300)',
                      backgroundColor: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      color: 'var(--neutral-700)',
                      padding: 0,
                      lineHeight: 1
                    }}
                    title="Increase code size by 5%"
                  >
                    +
                  </button>

                  {/* Editable Numeric Percentage */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="number"
                      min={30}
                      max={250}
                      step={5}
                      value={Math.round(codeScale * 100)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          handleUpdateCodeScale(val / 100);
                        }
                      }}
                      style={{
                        width: 38,
                        padding: '1px 2px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: 3,
                        backgroundColor: '#ffffff',
                        color: 'var(--primary-700)'
                      }}
                    />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--neutral-500)' }}>%</span>
                  </div>

                  {/* Quick Preset Chips */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, borderLeft: '1px solid var(--neutral-300)', paddingLeft: 4 }}>
                    {([0.5, 0.75, 1.0, 1.25, 1.5] as const).map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => handleUpdateCodeScale(sc)}
                        style={{
                          padding: '1px 4px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          border: 'none',
                          borderRadius: 3,
                          cursor: 'pointer',
                          backgroundColor: Math.abs(codeScale - sc) < 0.02 ? '#ffffff' : 'transparent',
                          color: Math.abs(codeScale - sc) < 0.02 ? 'var(--primary-700)' : 'var(--neutral-600)',
                          boxShadow: Math.abs(codeScale - sc) < 0.02 ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        {`${Math.round(sc * 100)}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export PNG */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDownloadFullStickerImage}
                  disabled={isDownloadingImage}
                  style={{ padding: '3px 8px', fontSize: '0.70rem', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Download full 300 DPI sticker image"
                >
                  <ImageIcon size={12} />
                  <span>PNG</span>
                </button>
              </div>
            </div>

            {/* ELEMENT TYPOGRAPHY & DESIGN INSPECTOR */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                backgroundColor: '#ffffff',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              {/* Element Selector Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--neutral-600)', display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 2 }}>
                  <Type size={12} color="var(--primary-600)" />
                  <span>Element:</span>
                </span>
                {[
                  { id: 'productName', label: 'Item Name' },
                  { id: 'price', label: 'Price' },
                  { id: 'storeName', label: 'Store' },
                  { id: 'barcodeText', label: 'Code Text' },
                  { id: 'sku', label: 'SKU' },
                  { id: 'code', label: 'QR / Barcode' },
                ].map((item) => {
                  const isSelected = selectedElementId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedElementId(item.id as any)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.68rem',
                        fontWeight: isSelected ? 800 : 600,
                        borderRadius: 4,
                        border: `1px solid ${isSelected ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                        backgroundColor: isSelected ? 'var(--primary-600)' : '#f8fafc',
                        color: isSelected ? '#ffffff' : 'var(--neutral-700)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Live Real-Time Content Input for Selected Element */}
              {selectedElementId === 'code' ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--neutral-50)', padding: '3px 10px', borderRadius: 4, border: '1.5px solid var(--primary-400)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary-700)' }}>Code Symbology:</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--neutral-800)' }}>{codeType === 'QR' ? '2D QR Code' : '1D Barcode'}</span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: 'var(--neutral-50)', padding: '2px 8px', borderRadius: 4, border: '1.5px solid var(--primary-400)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary-700)', whiteSpace: 'nowrap' }}>
                    {selectedElementId === 'productName' ? 'Item Name:' : selectedElementId === 'price' ? 'Price (₹):' : selectedElementId === 'storeName' ? 'Store:' : selectedElementId === 'barcodeText' ? 'Code Text:' : 'SKU:'}
                  </span>
                  <input
                    type={selectedElementId === 'price' ? 'number' : 'text'}
                    value={
                      selectedElementId === 'productName'
                        ? productName
                        : selectedElementId === 'price'
                        ? price
                        : selectedElementId === 'storeName'
                        ? storeName
                        : selectedElementId === 'barcodeText'
                        ? (customBarcodeText !== '' ? customBarcodeText : barcodeValue)
                        : sku
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedElementId === 'productName') setProductName(val);
                      else if (selectedElementId === 'price') setPrice(parseFloat(val) || 0);
                      else if (selectedElementId === 'storeName') setStoreName(val);
                      else if (selectedElementId === 'barcodeText') setCustomBarcodeText(val);
                      else if (selectedElementId === 'sku') setSku(val);
                    }}
                    placeholder="Type to edit in real time..."
                    style={{
                      padding: '2px 6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      border: '1px solid var(--neutral-300)',
                      borderRadius: 3,
                      minWidth: 150,
                      maxWidth: 220,
                      backgroundColor: '#ffffff',
                      color: 'var(--neutral-900)'
                    }}
                  />
                </div>
              )}

              {/* Style Controls for Selected Element */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Size Controls */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: 'var(--neutral-100)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--neutral-200)' }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--neutral-600)' }}>Text Size:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = elementStyles[selectedElementId]?.size ?? 1.0;
                      handleUpdateElementStyle(selectedElementId, { size: Math.max(0.6, Math.round((cur - 0.05) * 100) / 100) });
                    }}
                    style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--neutral-300)', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}
                    title="Decrease font size by 5%"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.05"
                    value={elementStyles[selectedElementId]?.size ?? 1.0}
                    onChange={(e) => handleUpdateElementStyle(selectedElementId, { size: parseFloat(e.target.value) })}
                    style={{ width: 50, height: 4, accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                    title={`Text Size: ${Math.round((elementStyles[selectedElementId]?.size ?? 1.0) * 100)}%`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = elementStyles[selectedElementId]?.size ?? 1.0;
                      handleUpdateElementStyle(selectedElementId, { size: Math.min(1.8, Math.round((cur + 0.05) * 100) / 100) });
                    }}
                    style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--neutral-300)', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}
                    title="Increase font size by 5%"
                  >
                    +
                  </button>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--primary-700)', minWidth: 32, textAlign: 'center' }}>
                    {Math.round((elementStyles[selectedElementId]?.size ?? 1.0) * 100)}%
                  </span>
                </div>

                {/* Bold Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const cur = elementStyles[selectedElementId]?.bold ?? true;
                    handleUpdateElementStyle(selectedElementId, { bold: !cur });
                  }}
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.70rem',
                    fontWeight: 900,
                    borderRadius: 4,
                    border: `1px solid ${elementStyles[selectedElementId]?.bold ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                    backgroundColor: elementStyles[selectedElementId]?.bold ? 'var(--primary-100)' : '#ffffff',
                    color: elementStyles[selectedElementId]?.bold ? 'var(--primary-800)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  title="Toggle Bold"
                >
                  <Bold size={11} strokeWidth={3} />
                  <span>B</span>
                </button>

                {/* Italic Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const cur = elementStyles[selectedElementId]?.italic ?? false;
                    handleUpdateElementStyle(selectedElementId, { italic: !cur });
                  }}
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.70rem',
                    fontStyle: 'italic',
                    fontWeight: 700,
                    borderRadius: 4,
                    border: `1px solid ${elementStyles[selectedElementId]?.italic ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                    backgroundColor: elementStyles[selectedElementId]?.italic ? 'var(--primary-100)' : '#ffffff',
                    color: elementStyles[selectedElementId]?.italic ? 'var(--primary-800)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  title="Toggle Italic"
                >
                  <Italic size={11} />
                  <span>I</span>
                </button>

                {/* Uppercase Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const cur = elementStyles[selectedElementId]?.uppercase ?? false;
                    handleUpdateElementStyle(selectedElementId, { uppercase: !cur });
                  }}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    borderRadius: 4,
                    border: `1px solid ${elementStyles[selectedElementId]?.uppercase ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                    backgroundColor: elementStyles[selectedElementId]?.uppercase ? 'var(--primary-100)' : '#ffffff',
                    color: elementStyles[selectedElementId]?.uppercase ? 'var(--primary-800)' : 'var(--neutral-700)',
                    cursor: 'pointer'
                  }}
                  title="Toggle Uppercase"
                >
                  AA
                </button>

                {/* 90° Element Rotation Button */}
                <button
                  type="button"
                  onClick={() => {
                    const curRot = elementStyles[selectedElementId]?.rotation || 0;
                    const nextRot = (curRot + 90) % 360;
                    handleUpdateElementStyle(selectedElementId, { rotation: nextRot });
                  }}
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    borderRadius: 4,
                    border: `1px solid ${(elementStyles[selectedElementId]?.rotation || 0) !== 0 ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                    backgroundColor: (elementStyles[selectedElementId]?.rotation || 0) !== 0 ? 'var(--primary-100)' : '#ffffff',
                    color: (elementStyles[selectedElementId]?.rotation || 0) !== 0 ? 'var(--primary-800)' : 'var(--neutral-700)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  title="Rotate selected element 90° clockwise (0°, 90°, 180°, 270°)"
                >
                  <RotateCw size={11} />
                  <span>{elementStyles[selectedElementId]?.rotation || 0}°</span>
                </button>

                {/* Rotate All 90° Button */}
                <button
                  type="button"
                  onClick={handleRotateAll}
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    border: '1px solid var(--neutral-300)',
                    backgroundColor: '#ffffff',
                    color: 'var(--neutral-700)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  title="Rotate all text, barcode, and QR elements by 90° clockwise"
                >
                  <RotateCw size={11} color="var(--primary-600)" />
                  <span>Rotate All</span>
                </button>

                {/* Reset Element Style */}
                <button
                  type="button"
                  onClick={() => handleResetElementStyle(selectedElementId)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: '0.66rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  title="Reset element style"
                >
                  <RotateCcw size={10} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* HARDWARE PRINTER FEED & MARGIN CALIBRATION */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                backgroundColor: '#f8fafc',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                padding: '5px 10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sliders size={12} color="var(--primary-600)" />
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--neutral-700)' }}>
                  Hardware Feed Calibration:
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--neutral-500)' }}>
                  (Calibrate printer roll margin to prevent sticker clipping)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* X Offset */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--neutral-600)' }}>Offset X:</span>
                  <button
                    type="button"
                    onClick={() => handleOffsetXChange(printOffsetX_mm - 0.5)}
                    style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--neutral-300)', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}
                    title="Shift print left by 0.5mm"
                  >
                    -
                  </button>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary-700)', minWidth: 44, textAlign: 'center' }}>
                    {printOffsetX_mm > 0 ? `+${printOffsetX_mm.toFixed(1)}` : printOffsetX_mm.toFixed(1)} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOffsetXChange(printOffsetX_mm + 0.5)}
                    style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--neutral-300)', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}
                    title="Shift print right by 0.5mm"
                  >
                    +
                  </button>
                </div>

                {/* Y Offset */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--neutral-600)' }}>Offset Y:</span>
                  <button
                    type="button"
                    onClick={() => handleOffsetYChange(printOffsetY_mm - 0.5)}
                    style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--neutral-300)', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}
                    title="Shift print up by 0.5mm"
                  >
                    -
                  </button>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary-700)', minWidth: 44, textAlign: 'center' }}>
                    {printOffsetY_mm > 0 ? `+${printOffsetY_mm.toFixed(1)}` : printOffsetY_mm.toFixed(1)} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOffsetYChange(printOffsetY_mm + 0.5)}
                    style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--neutral-300)', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', lineHeight: 1 }}
                    title="Shift print down by 0.5mm"
                  >
                    +
                  </button>
                </div>

                {/* Reset Offsets */}
                {(printOffsetX_mm !== 0 || printOffsetY_mm !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOffsetXChange(0);
                      handleOffsetYChange(0);
                    }}
                    style={{
                      padding: '1px 6px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      border: '1px solid var(--neutral-300)',
                      borderRadius: 3,
                      backgroundColor: '#ffffff',
                      color: 'var(--neutral-600)',
                      cursor: 'pointer'
                    }}
                    title="Reset margins to 0.0mm"
                  >
                    Reset Margin
                  </button>
                )}
              </div>
            </div>

            {/* LIVE DRAG & DROP WORKBENCH */}
            <div 
              style={{
                backgroundColor: 'var(--neutral-100)',
                border: '1.5px dashed var(--neutral-300)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Drag instruction notice */}
              <div style={{
                position: 'absolute',
                top: 6,
                left: 12,
                fontSize: '0.66rem',
                color: 'var(--neutral-500)',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <Move size={12} />
                <span>Click &amp; drag any text or barcode directly to custom position • Auto-saved to cache</span>
              </div>

              {/* RENDERED CANVAS WORKBENCH */}
              {isSeznik ? (
                orientation === 'PORTRAIT' ? (
                  /* AUTHENTIC SEZNIK PORTRAIT JEWELRY TAG CANVAS (14.3mm x 100mm Strip) */
                  <div style={{ width: '100%', maxWidth: 760, padding: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        🏷️ SEZNIK Jewellery Tag (14.3 × 100 mm) • PORTRAIT
                        {isSeznik3Up && (
                          <span style={{ fontSize: '0.62rem', backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                            ✨ 3-Across Reel (3 Labels per row)
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                        Front Face (32mm) • Fold Crease • Back Face (32mm) • Tail Strap (36mm)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 20, flexWrap: 'wrap', width: '100%' }}>
                      {/* INTERACTIVE STRIP DESIGNER */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--neutral-600)' }}>
                          Interactive Strip Editor {isSeznik3Up ? '(Column Template)' : ''}
                        </span>
                        <div 
                          ref={canvasContainerRef}
                          style={{
                            width: 160,
                            height: 460,
                            backgroundColor: '#ffffff',
                            border: '1.5px solid var(--neutral-400)',
                            borderRadius: 8,
                            boxShadow: 'var(--shadow-md)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            overflow: 'hidden',
                            userSelect: 'none'
                          }}
                        >
                          {/* FLAP 1: Front Face (0 to 32% height) */}
                          <div style={{
                            width: '100%',
                            height: '32%',
                            borderBottom: '1.5px dashed var(--neutral-400)',
                            backgroundColor: '#ffffff',
                            position: 'relative',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ position: 'absolute', right: 4, bottom: -9, backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-700)', fontSize: '0.50rem', fontWeight: 800, padding: '1px 4px', borderRadius: 3, zIndex: 12 }}>
                              FOLD (32mm)
                            </div>
                            <div style={{ position: 'absolute', left: 4, top: 2, fontSize: '0.48rem', color: 'var(--neutral-400)', fontWeight: 600 }}>
                              Front Face (32mm)
                            </div>
                          </div>

                          {/* FLAP 2: Back Face (32% to 64% height) */}
                          <div style={{
                            width: '100%',
                            height: '32%',
                            borderBottom: '1px solid var(--neutral-200)',
                            backgroundColor: '#ffffff',
                            position: 'relative',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ position: 'absolute', left: 4, top: 2, fontSize: '0.48rem', color: 'var(--neutral-400)', fontWeight: 600 }}>
                              Back Face (32mm)
                            </div>
                          </div>

                          {/* TAIL STRAP (64% to 100% height) */}
                          <div style={{
                            width: '100%',
                            height: '36%',
                            backgroundColor: 'var(--neutral-50)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: 44,
                              height: '92%',
                              borderRadius: 4,
                              backgroundColor: '#ffffff',
                              border: '1px solid var(--neutral-300)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}>
                              <span style={{ fontSize: '0.52rem', color: 'var(--neutral-500)', fontWeight: 700, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
                                Tail Strap (36mm)
                              </span>
                            </div>
                          </div>

                          {/* DRAGGABLE ELEMENTS IN PORTRAIT */}
                          {showStoreName && (
                            <div
                              onPointerDown={(e) => handlePointerDown('storeName', e)}
                              onClick={() => setSelectedElementId('storeName')}
                              style={{
                                position: 'absolute',
                                left: `${elementPositions.storeName?.x ?? 50}%`,
                                top: `${elementPositions.storeName?.y ?? 7}%`,
                                transform: `translate(-50%, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                                transformOrigin: 'center center',
                                cursor: 'move',
                                padding: '2px 4px',
                                borderRadius: 4,
                                border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                                backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                color: 'var(--neutral-900)',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                                maxWidth: 150,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                zIndex: 10,
                                ...getElementStyleProps('storeName', 0.68, true)
                              }}
                            >
                              {formatElementText('storeName', storeName || 'Store')}
                            </div>
                          )}

                          {showProductName && (
                            <div
                              onPointerDown={(e) => handlePointerDown('productName', e)}
                              onClick={() => setSelectedElementId('productName')}
                              style={{
                                position: 'absolute',
                                left: `${elementPositions.productName?.x ?? 50}%`,
                                top: `${elementPositions.productName?.y ?? 16}%`,
                                transform: `translate(-50%, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                                transformOrigin: 'center center',
                                cursor: 'move',
                                padding: '2px 4px',
                                borderRadius: 4,
                                border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                                backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                color: 'var(--neutral-800)',
                                maxWidth: 150,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                                zIndex: 10,
                                ...getElementStyleProps('productName', 0.74, true)
                              }}
                            >
                              {formatElementText('productName', productName)}
                            </div>
                          )}

                          {showPrice && (
                            <div
                              onPointerDown={(e) => handlePointerDown('price', e)}
                              onClick={() => setSelectedElementId('price')}
                              style={{
                                position: 'absolute',
                                left: `${elementPositions.price?.x ?? 50}%`,
                                top: `${elementPositions.price?.y ?? 26}%`,
                                transform: `translate(-50%, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                                transformOrigin: 'center center',
                                cursor: 'move',
                                padding: '2px 4px',
                                borderRadius: 4,
                                border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                                backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                color: '#1e1b4b',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                                zIndex: 10,
                                ...getElementStyleProps('price', 0.96, true)
                              }}
                            >
                              ₹{Number(price || 0).toFixed(2)}
                            </div>
                          )}

                          <div
                            onPointerDown={(e) => handlePointerDown('code', e)}
                            onClick={() => setSelectedElementId('code')}
                            style={{
                              position: 'absolute',
                              left: `${elementPositions.code?.x ?? 50}%`,
                              top: `${elementPositions.code?.y ?? 44}%`,
                              transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                              transformOrigin: 'center center',
                              cursor: 'move',
                              padding: '2px',
                              borderRadius: 4,
                              border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                              backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 'max-content',
                              height: 'max-content',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                              zIndex: 10
                            }}
                          >
                            <BarcodeRenderer
                              ref={barcodeRendererRef}
                              value={activePayload}
                              codeType={codeType}
                              width={codeType === 'BARCODE' ? 0.9 : undefined}
                              height={codeType === 'BARCODE' ? 36 : 60}
                              showText={false}
                            />
                          </div>

                          <div
                            onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                            onClick={() => setSelectedElementId('barcodeText')}
                            style={{
                              position: 'absolute',
                              left: `${elementPositions.barcodeText?.x ?? 50}%`,
                              top: `${elementPositions.barcodeText?.y ?? 53}%`,
                              transform: `translate(-50%, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                              transformOrigin: 'center center',
                              cursor: 'move',
                              padding: '2px 4px',
                              borderRadius: 4,
                              border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                              backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              color: 'var(--neutral-900)',
                              whiteSpace: 'nowrap',
                              textAlign: 'center',
                              zIndex: 10,
                              ...getElementStyleProps('barcodeText', 0.68, true, true)
                            }}
                          >
                            {formatElementText('barcodeText', effectiveBarcodeText.substring(0, 14))}
                          </div>

                          {showSku && sku && (
                            <div
                              onPointerDown={(e) => handlePointerDown('sku', e)}
                              onClick={() => setSelectedElementId('sku')}
                              style={{
                                position: 'absolute',
                                left: `${elementPositions.sku?.x ?? 50}%`,
                                top: `${elementPositions.sku?.y ?? 58}%`,
                                transform: `translate(-50%, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                                transformOrigin: 'center center',
                                cursor: 'move',
                                padding: '2px 4px',
                                borderRadius: 4,
                                border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                                backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                color: 'var(--neutral-500)',
                                whiteSpace: 'nowrap',
                                textAlign: 'center',
                                zIndex: 10,
                                ...getElementStyleProps('sku', 0.60, false)
                              }}
                            >
                              {formatElementText('sku', `SKU:${sku}`)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* REEL PREVIEW: 3-Across side-by-side feed simulation */}
                      {isSeznik3Up && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                              🖨️ 3-Across Reel Feed Preview (48mm Web)
                            </span>
                            <span style={{ fontSize: '0.60rem', backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                              3 Labels / Row
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#ffffff', border: '1.5px solid var(--neutral-300)', borderRadius: 6, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)' }}>
                            {[1, 2, 3].map((col) => (
                              <div key={col} style={{ width: 80, height: 250, border: '1px solid var(--neutral-300)', borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#ffffff', position: 'relative' }}>
                                {/* Miniature Flap 1 */}
                                <div style={{ height: '32%', borderBottom: '1px dashed #cbd5e1', padding: '2px 3px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.45rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 74 }}>{formatElementText('storeName', storeName || 'Store')}</div>
                                  <div style={{ fontSize: '0.42rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 74 }}>{formatElementText('productName', productName)}</div>
                                  <div style={{ fontSize: '0.50rem', fontWeight: 800, color: '#0f172a' }}>₹{Number(price || 0).toFixed(0)}</div>
                                </div>
                                {/* Miniature Flap 2 */}
                                <div style={{ height: '32%', borderBottom: '1px solid #e2e8f0', padding: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.40rem', fontWeight: 700, color: '#0f172a' }}>{codeType === 'QR' ? '⬛ QR' : '||||| BARCODE'}</div>
                                  <div style={{ fontSize: '0.38rem', fontFamily: 'monospace', color: '#475569' }}>{effectiveBarcodeText.slice(0, 8)}</div>
                                  <div style={{ fontSize: '0.36rem', color: '#94a3b8' }}>SKU:{sku.slice(0, 6)}</div>
                                </div>
                                {/* Miniature Tail */}
                                <div style={{ height: '36%', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: 22, height: '90%', backgroundColor: '#ffffff', border: '0.5px solid #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '0.30rem', color: '#94a3b8', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>Tail #{col}</span>
                                  </div>
                                </div>
                                <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.48rem', fontWeight: 800, color: 'var(--primary-600)' }}>#{col}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--neutral-500)', textAlign: 'center', maxWidth: 280 }}>
                            Thermal head prints 3 tags simultaneously across the 48mm roll feed width.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* AUTHENTIC SEZNIK LANDSCAPE JEWELRY TAG CANVAS (100mm x 15mm Horizontal) */
                  <div style={{ width: '100%', maxWidth: 640, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        🏷️ SEZNIK Josh Tag (100 × 15 mm) • LANDSCAPE • 32mm Front / 32mm Back / 36mm Tail
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                        Drag items freely • Fold at 32mm crease
                      </span>
                    </div>
                    <div 
                      ref={canvasContainerRef}
                      style={{
                        width: '100%',
                        height: 105,
                        backgroundColor: '#ffffff',
                        border: '1.5px solid var(--neutral-400)',
                        borderRadius: 8,
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        userSelect: 'none'
                      }}
                    >
                      {/* FLAP 1: Front Face (0 to 32%) */}
                      <div style={{
                        width: '32%',
                        height: '100%',
                        borderRight: '1.5px dashed var(--neutral-400)',
                        backgroundColor: '#ffffff',
                        position: 'relative'
                      }}>
                        <div style={{ position: 'absolute', right: -12, top: 4, backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-700)', fontSize: '0.54rem', fontWeight: 800, padding: '1px 3px', borderRadius: 3, zIndex: 2 }}>
                          FOLD
                        </div>
                        <div style={{ position: 'absolute', left: 4, bottom: 2, fontSize: '0.52rem', color: 'var(--neutral-400)', fontWeight: 600 }}>
                          Front Face (32mm)
                        </div>
                      </div>

                      {/* FLAP 2: Back Face (32% to 64%) */}
                      <div style={{
                        width: '32%',
                        height: '100%',
                        backgroundColor: '#ffffff',
                        position: 'relative',
                        borderRight: '1px solid var(--neutral-200)'
                      }}>
                        <div style={{ position: 'absolute', left: 6, bottom: 2, fontSize: '0.52rem', color: 'var(--neutral-400)', fontWeight: 600 }}>
                          Back Face (32mm)
                        </div>
                      </div>

                      {/* TAIL STRAP: Looping strap (64% to 100%, 36mm) */}
                      <div style={{
                        width: '36%',
                        height: '100%',
                        backgroundColor: 'var(--neutral-50)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 8px',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: '100%',
                          height: 24,
                          borderRadius: 4,
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--neutral-300)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.58rem',
                          color: 'var(--neutral-500)',
                          fontWeight: 700
                        }}>
                          Tail Strap (36mm)
                        </div>
                      </div>

                      {/* DRAGGABLE ELEMENTS LAYER (LANDSCAPE) */}
                      {showStoreName && (
                        <div
                          onPointerDown={(e) => handlePointerDown('storeName', e)}
                          onClick={() => setSelectedElementId('storeName')}
                          style={{
                            position: 'absolute',
                            left: `${elementPositions.storeName?.x ?? 3}%`,
                            top: `${elementPositions.storeName?.y ?? 16}%`,
                            transform: `translate(0, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            cursor: 'move',
                            padding: '2px 4px',
                            borderRadius: 4,
                            border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                            backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: 'var(--neutral-900)',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            ...getElementStyleProps('storeName', 0.68, true)
                          }}
                        >
                          {formatElementText('storeName', storeName || 'Store')}
                        </div>
                      )}

                      {showProductName && (
                        <div
                          onPointerDown={(e) => handlePointerDown('productName', e)}
                          onClick={() => setSelectedElementId('productName')}
                          style={{
                            position: 'absolute',
                            left: `${elementPositions.productName?.x ?? 3}%`,
                            top: `${elementPositions.productName?.y ?? 46}%`,
                            transform: `translate(0, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            cursor: 'move',
                            padding: '2px 4px',
                            borderRadius: 4,
                            border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                            backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: 'var(--neutral-800)',
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            ...getElementStyleProps('productName', 0.74, true)
                          }}
                        >
                          {formatElementText('productName', productName)}
                        </div>
                      )}

                      {showPrice && (
                        <div
                          onPointerDown={(e) => handlePointerDown('price', e)}
                          onClick={() => setSelectedElementId('price')}
                          style={{
                            position: 'absolute',
                            left: `${elementPositions.price?.x ?? 3}%`,
                            top: `${elementPositions.price?.y ?? 78}%`,
                            transform: `translate(0, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            cursor: 'move',
                            padding: '2px 4px',
                            borderRadius: 4,
                            border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                            backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: '#1e1b4b',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            ...getElementStyleProps('price', 0.96, true)
                          }}
                        >
                          ₹{Number(price || 0).toFixed(2)}
                        </div>
                      )}

                      <div
                        onPointerDown={(e) => handlePointerDown('code', e)}
                        onClick={() => setSelectedElementId('code')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.code?.x ?? 50}%`,
                          top: `${elementPositions.code?.y ?? 50}%`,
                          transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px',
                          borderRadius: 4,
                          border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 'max-content',
                          height: 'max-content',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          zIndex: 10
                        }}
                      >
                        <BarcodeRenderer
                          ref={barcodeRendererRef}
                          value={activePayload}
                          codeType={codeType}
                          width={codeType === 'BARCODE' ? 1.0 : undefined}
                          height={codeType === 'BARCODE' ? 40 : 64}
                          showText={false}
                        />
                      </div>

                      <div
                        onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                        onClick={() => setSelectedElementId('barcodeText')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.barcodeText?.x ?? 35}%`,
                          top: `${elementPositions.barcodeText?.y ?? 36}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-900)',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('barcodeText', 0.70, true, true)
                        }}
                      >
                        {formatElementText('barcodeText', effectiveBarcodeText.substring(0, 14))}
                      </div>

                      {showSku && sku && (
                        <div
                          onPointerDown={(e) => handlePointerDown('sku', e)}
                          onClick={() => setSelectedElementId('sku')}
                          style={{
                            position: 'absolute',
                            left: `${elementPositions.sku?.x ?? 35}%`,
                            top: `${elementPositions.sku?.y ?? 72}%`,
                            transform: `translate(0, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            cursor: 'move',
                            padding: '2px 4px',
                            borderRadius: 4,
                            border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                            backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: 'var(--neutral-500)',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            ...getElementStyleProps('sku', 0.62, false)
                          }}
                        >
                          {formatElementText('sku', `SKU: ${sku}`)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : isDumbbell ? (
                /* AUTHENTIC JEWELRY DUMBBELL CANVAS (70mm x 12mm Symmetrical) */
                <div style={{ width: '100%', maxWidth: 580, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div 
                    ref={canvasContainerRef}
                    style={{
                      width: '100%',
                      height: 104,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      userSelect: 'none'
                    }}
                  >
                    {/* LEFT WING (0 to 40% = 28mm) */}
                    <div style={{
                      width: '40%',
                      height: '100%',
                      backgroundColor: '#ffffff',
                      border: '1.5px solid var(--neutral-400)',
                      borderRight: '1.5px dashed var(--neutral-400)',
                      borderTopLeftRadius: 8,
                      borderBottomLeftRadius: 8,
                      position: 'relative',
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      <div style={{ position: 'absolute', right: 4, top: 4, backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-700)', fontSize: '0.52rem', fontWeight: 800, padding: '1px 3px', borderRadius: 3 }}>
                        FOLD
                      </div>
                    </div>

                    {/* CENTER BRIDGE NECK (40% to 60% = 14mm) with die-cut top/bottom cutouts */}
                    <div style={{
                      width: '20%',
                      height: '100%',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}>
                      {/* Top die-cut guide */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        width: '100%',
                        height: 38,
                        borderBottom: '1px dotted var(--neutral-300)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.50rem',
                        color: 'var(--neutral-400)'
                      }}>
                        Die-Cut Void
                      </div>

                      {/* Narrow Center String Neck Strip */}
                      <div style={{
                        width: '100%',
                        height: 26,
                        backgroundColor: '#ffffff',
                        borderTop: '1.5px solid var(--neutral-400)',
                        borderBottom: '1.5px solid var(--neutral-400)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.54rem',
                        fontWeight: 800,
                        color: 'var(--neutral-500)',
                        letterSpacing: '0.02em',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        zIndex: 2
                      }}>
                        Loop Bridge (14mm)
                      </div>

                      {/* Bottom die-cut guide */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        width: '100%',
                        height: 38,
                        borderTop: '1px dotted var(--neutral-300)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.50rem',
                        color: 'var(--neutral-400)'
                      }}>
                        Die-Cut Void
                      </div>
                    </div>

                    {/* RIGHT WING (60% to 100% = 28mm) */}
                    <div style={{
                      width: '40%',
                      height: '100%',
                      backgroundColor: '#ffffff',
                      border: '1.5px solid var(--neutral-400)',
                      borderLeft: '1.5px dashed var(--neutral-400)',
                      borderTopRightRadius: 8,
                      borderBottomRightRadius: 8,
                      position: 'relative',
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      <div style={{ position: 'absolute', left: 4, top: 4, backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-700)', fontSize: '0.52rem', fontWeight: 800, padding: '1px 3px', borderRadius: 3 }}>
                        FOLD
                      </div>
                    </div>

                    {/* DRAGGABLE ELEMENTS LAYER */}
                    {/* 1. Store Name */}
                    {showStoreName && (
                      <div
                        onPointerDown={(e) => handlePointerDown('storeName', e)}
                        onClick={() => setSelectedElementId('storeName')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.storeName?.x ?? 5}%`,
                          top: `${elementPositions.storeName?.y ?? 14}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-900)',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('storeName', 0.66, true)
                        }}
                      >
                        {formatElementText('storeName', storeName || 'Store')}
                      </div>
                    )}

                    {/* 2. Product Name */}
                    {showProductName && (
                      <div
                        onPointerDown={(e) => handlePointerDown('productName', e)}
                        onClick={() => setSelectedElementId('productName')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.productName?.x ?? 5}%`,
                          top: `${elementPositions.productName?.y ?? 44}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-800)',
                          maxWidth: 190,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('productName', 0.74, true)
                        }}
                      >
                        {formatElementText('productName', productName)}
                      </div>
                    )}

                    {/* 3. Selling Price */}
                    {showPrice && (
                      <div
                        onPointerDown={(e) => handlePointerDown('price', e)}
                        onClick={() => setSelectedElementId('price')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.price?.x ?? 5}%`,
                          top: `${elementPositions.price?.y ?? 76}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: '#1e1b4b',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('price', 0.94, true)
                        }}
                      >
                        ₹{Number(price || 0).toFixed(2)}
                      </div>
                    )}

                    {/* 4. Barcode / QR Code Graphic */}
                    <div
                      onPointerDown={(e) => handlePointerDown('code', e)}
                      onClick={() => setSelectedElementId('code')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.code?.x ?? 82}%`,
                        top: `${elementPositions.code?.y ?? 48}%`,
                        transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px',
                        borderRadius: 4,
                        border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 'max-content',
                        height: 'max-content',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        zIndex: 10
                      }}
                    >
                      <BarcodeRenderer
                        ref={barcodeRendererRef}
                        value={activePayload}
                        codeType={codeType}
                        width={codeType === 'BARCODE' ? 1.0 : undefined}
                        height={codeType === 'BARCODE' ? 36 : 58}
                        showText={false}
                      />
                    </div>

                    {/* 5. Barcode Number Text */}
                    <div
                      onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                      onClick={() => setSelectedElementId('barcodeText')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.barcodeText?.x ?? 64}%`,
                        top: `${elementPositions.barcodeText?.y ?? 36}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        borderRadius: 4,
                        border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: 'var(--neutral-900)',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        ...getElementStyleProps('barcodeText', 0.68, true, true)
                      }}
                    >
                      {formatElementText('barcodeText', effectiveBarcodeText.substring(0, 12))}
                    </div>

                    {/* 6. SKU Text */}
                    {showSku && sku && (
                      <div
                        onPointerDown={(e) => handlePointerDown('sku', e)}
                        onClick={() => setSelectedElementId('sku')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.sku?.x ?? 64}%`,
                          top: `${elementPositions.sku?.y ?? 72}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-600)',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('sku', 0.62, false)
                        }}
                      >
                        {formatElementText('sku', `SKU: ${sku}`)}
                      </div>
                    )}
                  </div>
                </div>

              ) : isRatTail || arrangement === 'DUAL_FLAP' ? (
                /* AUTHENTIC JEWELRY RAT-TAIL CANVAS (76mm x 12mm) */
                <div style={{ width: '100%', maxWidth: 580, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div 
                    ref={canvasContainerRef}
                    style={{
                      width: '100%',
                      height: 100,
                      backgroundColor: '#ffffff',
                      border: '1.5px solid var(--neutral-400)',
                      borderRadius: 8,
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      userSelect: 'none'
                    }}
                  >
                    {/* FLAP 1: Left Wing (Front face when folded) */}
                    <div style={{
                      flex: '1.1',
                      height: '100%',
                      borderRight: '1.5px dashed var(--neutral-400)',
                      backgroundColor: '#ffffff',
                      position: 'relative'
                    }}>
                      <div style={{ position: 'absolute', right: -12, top: 4, backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-700)', fontSize: '0.54rem', fontWeight: 800, padding: '1px 3px', borderRadius: 3, zIndex: 2 }}>
                        FOLD
                      </div>
                    </div>

                    {/* FLAP 2: Middle Wing (Back face when folded) */}
                    <div style={{
                      flex: '1.1',
                      height: '100%',
                      backgroundColor: '#ffffff',
                      position: 'relative'
                    }}>
                    </div>

                    {/* TAIL: Right Wing (Extended strap) */}
                    <div style={{
                      flex: '0.8',
                      height: '100%',
                      backgroundColor: 'var(--neutral-50)',
                      borderLeft: '1px solid var(--neutral-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 8px'
                    }}>
                      <div style={{
                        width: '100%',
                        height: 20,
                        borderRadius: 4,
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--neutral-300)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.58rem',
                        color: 'var(--neutral-500)',
                        fontWeight: 700
                      }}>
                        Tail Strap
                      </div>
                    </div>

                    {/* DRAGGABLE ELEMENTS LAYER */}
                    {showStoreName && (
                      <div
                        onPointerDown={(e) => handlePointerDown('storeName', e)}
                        onClick={() => setSelectedElementId('storeName')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.storeName?.x ?? 4}%`,
                          top: `${elementPositions.storeName?.y ?? 14}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-900)',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('storeName', 0.66, true)
                        }}
                      >
                        {formatElementText('storeName', storeName || 'Store')}
                      </div>
                    )}

                    {showProductName && (
                      <div
                        onPointerDown={(e) => handlePointerDown('productName', e)}
                        onClick={() => setSelectedElementId('productName')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.productName?.x ?? 4}%`,
                          top: `${elementPositions.productName?.y ?? 44}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-800)',
                          maxWidth: 180,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('productName', 0.74, true)
                        }}
                      >
                        {formatElementText('productName', productName)}
                      </div>
                    )}

                    {showPrice && (
                      <div
                        onPointerDown={(e) => handlePointerDown('price', e)}
                        onClick={() => setSelectedElementId('price')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.price?.x ?? 4}%`,
                          top: `${elementPositions.price?.y ?? 76}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: '#1e1b4b',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('price', 0.96, true)
                        }}
                      >
                        ₹{Number(price || 0).toFixed(2)}
                      </div>
                    )}

                    <div
                      onPointerDown={(e) => handlePointerDown('code', e)}
                      onClick={() => setSelectedElementId('code')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.code?.x ?? 55}%`,
                        top: `${elementPositions.code?.y ?? 48}%`,
                        transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px',
                        borderRadius: 4,
                        border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 'max-content',
                        height: 'max-content',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        zIndex: 10
                      }}
                    >
                      <BarcodeRenderer
                        ref={barcodeRendererRef}
                        value={activePayload}
                        codeType={codeType}
                        width={codeType === 'BARCODE' ? 1.0 : undefined}
                        height={codeType === 'BARCODE' ? 36 : 58}
                        showText={false}
                      />
                    </div>

                    <div
                      onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                      onClick={() => setSelectedElementId('barcodeText')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.barcodeText?.x ?? 38}%`,
                        top: `${elementPositions.barcodeText?.y ?? 36}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        borderRadius: 4,
                        border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: 'var(--neutral-900)',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        ...getElementStyleProps('barcodeText', 0.70, true, true)
                      }}
                    >
                      {formatElementText('barcodeText', effectiveBarcodeText.substring(0, 12))}
                    </div>

                    {showSku && sku && (
                      <div
                        onPointerDown={(e) => handlePointerDown('sku', e)}
                        onClick={() => setSelectedElementId('sku')}
                        style={{
                          position: 'absolute',
                          left: `${elementPositions.sku?.x ?? 38}%`,
                          top: `${elementPositions.sku?.y ?? 72}%`,
                          transform: `translate(0, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                          transformOrigin: 'center center',
                          cursor: 'move',
                          padding: '2px 4px',
                          borderRadius: 4,
                          border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                          backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          color: 'var(--neutral-500)',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          ...getElementStyleProps('sku', 0.62, false)
                        }}
                      >
                        {formatElementText('sku', `SKU: ${sku}`)}
                      </div>
                    )}
                  </div>
                </div>

              ) : isA4 ? (
                /* AUTHENTIC A4 STICKER CELL CANVAS & MINI SHEET PREVIEW */
                <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 4px', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-700)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      📄 {activeA4Grid.name} Sticker Cell ({activeA4Grid.labelW_mm} × {activeA4Grid.labelH_mm} mm)
                      <span style={{ fontSize: '0.62rem', backgroundColor: 'var(--primary-100)', color: 'var(--primary-800)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {activeA4Grid.cols} cols × {activeA4Grid.rows} rows = {activeA4Grid.totalSlots} labels/sheet
                      </span>
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                      Dashed border = Peel outline • Drag elements directly inside the cell
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 20, flexWrap: 'wrap', width: '100%' }}>
                    {/* LEFT: Single Sticker Interactive Cell Canvas */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--neutral-600)' }}>
                        Single Sticker Cell Editor ({activeA4Grid.labelW_mm} × {activeA4Grid.labelH_mm} mm)
                      </span>
                      <div 
                        ref={canvasContainerRef}
                        style={{ 
                          width: 320, 
                          height: Math.round(320 * (activeA4Grid.labelH_mm / activeA4Grid.labelW_mm)),
                          minHeight: 140,
                          maxHeight: 210,
                          backgroundColor: '#ffffff', 
                          border: '2px dashed var(--primary-400)', 
                          borderRadius: 6, 
                          boxShadow: 'var(--shadow-md)', 
                          position: 'relative',
                          overflow: 'hidden',
                          userSelect: 'none'
                        }}
                      >
                        {showStoreName && (
                          <div
                            onPointerDown={(e) => handlePointerDown('storeName', e)}
                            onClick={() => setSelectedElementId('storeName')}
                            style={{
                              position: 'absolute',
                              left: `${elementPositions.storeName?.x ?? 50}%`,
                              top: `${elementPositions.storeName?.y ?? 12}%`,
                              transform: `translate(-50%, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                              transformOrigin: 'center center',
                              cursor: 'move',
                              padding: '2px 4px',
                              color: 'var(--neutral-900)',
                              border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                              backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              whiteSpace: 'nowrap',
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              zIndex: 10,
                              ...getElementStyleProps('storeName', 0.72, true)
                            }}
                          >
                            {formatElementText('storeName', storeName || 'Store')}
                          </div>
                        )}

                        {showProductName && (
                          <div
                            onPointerDown={(e) => handlePointerDown('productName', e)}
                            onClick={() => setSelectedElementId('productName')}
                            style={{
                              position: 'absolute',
                              left: `${elementPositions.productName?.x ?? 50}%`,
                              top: `${elementPositions.productName?.y ?? 26}%`,
                              transform: `translate(-50%, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                              transformOrigin: 'center center',
                              cursor: 'move',
                              padding: '2px 4px',
                              color: 'var(--neutral-800)',
                              border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                              backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              zIndex: 10,
                              ...getElementStyleProps('productName', 0.76, true)
                            }}
                          >
                            {formatElementText('productName', productName)}
                          </div>
                        )}

                        <div
                          onPointerDown={(e) => handlePointerDown('code', e)}
                          onClick={() => setSelectedElementId('code')}
                          style={{
                            position: 'absolute',
                            left: `${elementPositions.code?.x ?? 50}%`,
                            top: `${elementPositions.code?.y ?? 52}%`,
                            transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            cursor: 'move',
                            padding: 2,
                            border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                            backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 'max-content',
                            height: 'max-content',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            zIndex: 10
                          }}
                        >
                          <BarcodeRenderer
                            ref={barcodeRendererRef}
                            value={activePayload}
                            codeType={codeType}
                            width={codeType === 'BARCODE' ? (paperSize === 'A4_GRID_65' ? 1.0 : 1.2) : 1.4}
                            height={codeType === 'BARCODE' ? (paperSize === 'A4_GRID_65' ? 28 : paperSize === 'A4_GRID_40' ? 34 : 40) : (paperSize === 'A4_GRID_65' ? 52 : 68)}
                            showText={false}
                          />
                        </div>

                        <div
                          onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                          onClick={() => setSelectedElementId('barcodeText')}
                          style={{
                            position: 'absolute',
                            left: `${elementPositions.barcodeText?.x ?? 50}%`,
                            top: `${elementPositions.barcodeText?.y ?? 74}%`,
                            transform: `translate(-50%, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                            transformOrigin: 'center center',
                            cursor: 'move',
                            padding: '1px 4px',
                            color: 'var(--neutral-700)',
                            border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                            backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            zIndex: 10,
                            ...getElementStyleProps('barcodeText', 0.68, true, true)
                          }}
                        >
                          {formatElementText('barcodeText', effectiveBarcodeText)}
                        </div>

                        {showPrice && (
                          <div
                            onPointerDown={(e) => handlePointerDown('price', e)}
                            onClick={() => setSelectedElementId('price')}
                            style={{
                              position: 'absolute',
                              left: `${elementPositions.price?.x ?? 50}%`,
                              top: `${elementPositions.price?.y ?? 88}%`,
                              transform: `translate(-50%, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                              transformOrigin: 'center center',
                              cursor: 'move',
                              padding: '1px 4px',
                              color: '#1e1b4b',
                              border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                              backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              zIndex: 10,
                              ...getElementStyleProps('price', 0.88, true)
                            }}
                          >
                            ₹{Number(price || 0).toFixed(2)}
                          </div>
                        )}

                        {showSku && sku && (
                          <div
                            onPointerDown={(e) => handlePointerDown('sku', e)}
                            onClick={() => setSelectedElementId('sku')}
                            style={{
                              position: 'absolute',
                              left: `${elementPositions.sku?.x ?? 88}%`,
                              top: `${elementPositions.sku?.y ?? 88}%`,
                              transform: `translate(-50%, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                              transformOrigin: 'center center',
                              cursor: 'move',
                              padding: '1px 3px',
                              color: 'var(--neutral-600)',
                              border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                              backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              zIndex: 10,
                              ...getElementStyleProps('sku', 0.60, false)
                            }}
                          >
                            {formatElementText('sku', `SKU:${sku}`)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: Scaled Mini A4 Sheet Grid Layout */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--neutral-600)' }}>
                        Mini A4 Sheet Layout ({effectiveQuantity} labels • {Math.ceil(((startOffsetSlot - 1) + effectiveQuantity) / activeA4Grid.totalSlots)} Sheet(s))
                      </span>
                      <div style={{
                        width: 140,
                        height: 198,
                        backgroundColor: '#ffffff',
                        border: '1.5px solid var(--neutral-400)',
                        borderRadius: 4,
                        boxShadow: 'var(--shadow-sm)',
                        padding: '8px 6px',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${activeA4Grid.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${activeA4Grid.rows}, 1fr)`,
                        gap: 1.5,
                        boxSizing: 'border-box'
                      }}>
                        {Array.from({ length: activeA4Grid.totalSlots }).map((_, idx) => {
                          const slotNumber = idx + 1;
                          const isSkipped = slotNumber < startOffsetSlot;
                          const isFilled = slotNumber >= startOffsetSlot && slotNumber < (startOffsetSlot + effectiveQuantity);
                          return (
                            <div
                              key={idx}
                              title={`Slot #${slotNumber}${isSkipped ? ' (Peeled/Skipped)' : isFilled ? ' (Active print)' : ' (Blank)'}`}
                              style={{
                                backgroundColor: isSkipped ? '#f1f5f9' : isFilled ? 'var(--primary-600)' : '#f8fafc',
                                border: `0.5px solid ${isFilled ? 'var(--primary-700)' : '#e2e8f0'}`,
                                borderRadius: 1,
                                opacity: isSkipped ? 0.35 : 1
                              }}
                            />
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '0.60rem', color: 'var(--neutral-500)', textAlign: 'center', maxWidth: 140 }}>
                        Blue = Printing slots • Gray = Skipped
                      </div>
                    </div>
                  </div>
                </div>

              ) : arrangement === 'SIDE_BY_SIDE' ? (
                /* HORIZONTAL SIDE-BY-SIDE CANVAS */
                <div 
                  ref={canvasContainerRef}
                  style={{ 
                    width: 320, 
                    height: 180,
                    backgroundColor: '#ffffff', 
                    border: '1.5px solid var(--neutral-400)', 
                    borderRadius: 8, 
                    boxShadow: 'var(--shadow-sm)', 
                    position: 'relative',
                    overflow: 'hidden',
                    userSelect: 'none'
                  }}
                >
                  <div
                    onPointerDown={(e) => handlePointerDown('code', e)}
                    style={{
                      position: 'absolute',
                      left: `${elementPositions.code?.x ?? 24}%`,
                      top: `${elementPositions.code?.y ?? 42}%`,
                      transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                      cursor: 'move',
                      padding: 2,
                      border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                      backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 'max-content',
                      height: 'max-content',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      zIndex: 10
                    }}
                  >
                    <BarcodeRenderer
                      ref={barcodeRendererRef}
                      value={activePayload}
                      codeType={codeType}
                      width={codeType === 'BARCODE' ? 1.2 : 1.4}
                      height={codeType === 'BARCODE' ? 40 : 76}
                      showText={false}
                    />
                  </div>

                  <div
                    onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                    onClick={() => setSelectedElementId('barcodeText')}
                    style={{
                      position: 'absolute',
                      left: `${elementPositions.barcodeText?.x ?? 24}%`,
                      top: `${elementPositions.barcodeText?.y ?? 82}%`,
                      transform: `translate(-50%, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                      cursor: 'move',
                      padding: '2px 4px',
                      color: 'var(--neutral-700)',
                      border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                      backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      zIndex: 10,
                      ...getElementStyleProps('barcodeText', 0.68, true, true)
                    }}
                  >
                    {formatElementText('barcodeText', effectiveBarcodeText)}
                  </div>

                  {showStoreName && (
                    <div
                      onPointerDown={(e) => handlePointerDown('storeName', e)}
                      onClick={() => setSelectedElementId('storeName')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.storeName?.x ?? 56}%`,
                        top: `${elementPositions.storeName?.y ?? 14}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: 'var(--neutral-900)',
                        border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        zIndex: 10,
                        ...getElementStyleProps('storeName', 0.72, true)
                      }}
                    >
                      {formatElementText('storeName', storeName || 'Store')}
                    </div>
                  )}

                  {showProductName && (
                    <div
                      onPointerDown={(e) => handlePointerDown('productName', e)}
                      onClick={() => setSelectedElementId('productName')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.productName?.x ?? 56}%`,
                        top: `${elementPositions.productName?.y ?? 36}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: 'var(--neutral-800)',
                        border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        maxWidth: 130,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        ...getElementStyleProps('productName', 0.78, true)
                      }}
                    >
                      {formatElementText('productName', productName)}
                    </div>
                  )}

                  {showSku && sku && (
                    <div
                      onPointerDown={(e) => handlePointerDown('sku', e)}
                      onClick={() => setSelectedElementId('sku')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.sku?.x ?? 56}%`,
                        top: `${elementPositions.sku?.y ?? 62}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: 'var(--neutral-500)',
                        border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        zIndex: 10,
                        ...getElementStyleProps('sku', 0.64, false)
                      }}
                    >
                      {formatElementText('sku', `SKU: ${sku}`)}
                    </div>
                  )}

                  {showPrice && (
                    <div
                      onPointerDown={(e) => handlePointerDown('price', e)}
                      onClick={() => setSelectedElementId('price')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.price?.x ?? 56}%`,
                        top: `${elementPositions.price?.y ?? 86}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: '#1e1b4b',
                        border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        zIndex: 10,
                        ...getElementStyleProps('price', 0.94, true)
                      }}
                    >
                      ₹{Number(price || 0).toFixed(2)}
                    </div>
                  )}
                </div>

              ) : (
                /* STANDARD VERTICAL STACKED CANVAS */
                <div 
                  ref={canvasContainerRef}
                  style={{ 
                    width: paperSize === 'THERMAL_40x40' ? 240 : 260, 
                    height: 220,
                    backgroundColor: '#ffffff', 
                    border: '1.5px solid var(--neutral-400)', 
                    borderRadius: 8, 
                    boxShadow: 'var(--shadow-sm)', 
                    position: 'relative',
                    overflow: 'hidden',
                    userSelect: 'none'
                  }}
                >
                  {showStoreName && (
                    <div
                      onPointerDown={(e) => handlePointerDown('storeName', e)}
                      onClick={() => setSelectedElementId('storeName')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.storeName?.x ?? 50}%`,
                        top: `${elementPositions.storeName?.y ?? 9}%`,
                        transform: `translate(-50%, -50%) rotate(${elementStyles.storeName?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: 'var(--neutral-900)',
                        border: activeDragId === 'storeName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'storeName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        ...getElementStyleProps('storeName', 0.75, true)
                      }}
                    >
                      {formatElementText('storeName', storeName || 'Store')}
                    </div>
                  )}

                  {showProductName && (
                    <div
                      onPointerDown={(e) => handlePointerDown('productName', e)}
                      onClick={() => setSelectedElementId('productName')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.productName?.x ?? 50}%`,
                        top: `${elementPositions.productName?.y ?? 22}%`,
                        transform: `translate(-50%, -50%) rotate(${elementStyles.productName?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: 'var(--neutral-800)',
                        border: activeDragId === 'productName' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'productName' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                        ...getElementStyleProps('productName', 0.82, true)
                      }}
                    >
                      {formatElementText('productName', productName)}
                    </div>
                  )}

                  <div
                    onPointerDown={(e) => handlePointerDown('code', e)}
                    onClick={() => setSelectedElementId('code')}
                    style={{
                      position: 'absolute',
                      left: `${elementPositions.code?.x ?? 50}%`,
                      top: `${elementPositions.code?.y ?? 52}%`,
                      transform: `translate(-50%, -50%) scale(${codeScale}) rotate(${elementStyles.code?.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                      cursor: 'move',
                      padding: 2,
                      border: activeDragId === 'code' || selectedElementId === 'code' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                      backgroundColor: activeDragId === 'code' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 'max-content',
                      height: 'max-content',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      zIndex: 10
                    }}
                  >
                    <BarcodeRenderer
                      ref={barcodeRendererRef}
                      value={activePayload}
                      codeType={codeType}
                      width={codeType === 'BARCODE' ? 1.4 : 1.6}
                      height={codeType === 'BARCODE' ? 44 : 84}
                      showText={false}
                    />
                  </div>

                  <div
                    onPointerDown={(e) => handlePointerDown('barcodeText', e)}
                    onClick={() => setSelectedElementId('barcodeText')}
                    style={{
                      position: 'absolute',
                      left: `${elementPositions.barcodeText?.x ?? 50}%`,
                      top: `${elementPositions.barcodeText?.y ?? 74}%`,
                      transform: `translate(-50%, -50%) rotate(${elementStyles.barcodeText?.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                      cursor: 'move',
                      padding: '2px 4px',
                      color: 'var(--neutral-700)',
                      border: activeDragId === 'barcodeText' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                      backgroundColor: activeDragId === 'barcodeText' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      zIndex: 10,
                      ...getElementStyleProps('barcodeText', 0.72, true, true)
                    }}
                  >
                    {formatElementText('barcodeText', effectiveBarcodeText)}
                  </div>

                  {showSku && sku && (
                    <div
                      onPointerDown={(e) => handlePointerDown('sku', e)}
                      onClick={() => setSelectedElementId('sku')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.sku?.x ?? 15}%`,
                        top: `${elementPositions.sku?.y ?? 91}%`,
                        transform: `translate(0, -50%) rotate(${elementStyles.sku?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: 'var(--neutral-600)',
                        border: activeDragId === 'sku' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'sku' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        zIndex: 10,
                        ...getElementStyleProps('sku', 0.68, false)
                      }}
                    >
                      {formatElementText('sku', `SKU: ${sku}`)}
                    </div>
                  )}

                  {showPrice && (
                    <div
                      onPointerDown={(e) => handlePointerDown('price', e)}
                      onClick={() => setSelectedElementId('price')}
                      style={{
                        position: 'absolute',
                        left: `${elementPositions.price?.x ?? 85}%`,
                        top: `${elementPositions.price?.y ?? 91}%`,
                        transform: `translate(-100%, -50%) rotate(${elementStyles.price?.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        cursor: 'move',
                        padding: '2px 4px',
                        color: '#1e1b4b',
                        border: activeDragId === 'price' ? '1.5px solid var(--primary-500)' : '1px dashed transparent',
                        backgroundColor: activeDragId === 'price' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        zIndex: 10,
                        ...getElementStyleProps('price', 0.90, true)
                      }}
                    >
                      ₹{Number(price || 0).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. EDITABLE ELEMENT VALUES & PRODUCT NAME DRAWER */}
          <div style={{ backgroundColor: 'var(--neutral-50)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 10 }}>
              3. Customize Tag Content &amp; Product Details
            </label>

            <div className="modal-grid-row-2">
              {/* Product Name Input */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                    Product Name on Tag:
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showProductName}
                      onChange={(e) => {
                        setShowProductName(e.target.checked);
                        saveDesignToCache(elementPositions);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--neutral-600)' }}>Visible</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Custom Product Name"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              {/* Selling Price Input */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                    Selling Price (₹):
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => {
                        setShowPrice(e.target.checked);
                        saveDesignToCache(elementPositions);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--neutral-600)' }}>Visible</span>
                  </label>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  placeholder="Selling Price"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              {/* SKU / Code Input */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                    SKU Code:
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showSku}
                      onChange={(e) => {
                        setShowSku(e.target.checked);
                        saveDesignToCache(elementPositions);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--neutral-600)' }}>Visible</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU Code"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              {/* Store Header Input */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                    Store Header:
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => {
                        setShowStoreName(e.target.checked);
                        saveDesignToCache(elementPositions);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--neutral-600)' }}>Visible</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    saveDesignToCache(elementPositions);
                  }}
                  placeholder="Store Header"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              {/* Code / Barcode Text Input */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                    Code Text on Tag:
                  </label>
                </div>
                <input
                  type="text"
                  value={customBarcodeText !== '' ? customBarcodeText : barcodeValue}
                  onChange={(e) => {
                    setCustomBarcodeText(e.target.value);
                  }}
                  placeholder="Custom Code Text"
                  className="input input-sm"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          </div>

          {/* 4. CHOOSE LABEL FORMAT & PRESET */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                4. Select Label Format &amp; Preset
              </label>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-700)', backgroundColor: 'var(--primary-50)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--primary-200)' }}>
                Active: {
                  paperSize === 'SEZNIK_3UP_100x15' ? 'Seznik 3-UP Reel (100x15mm)' :
                  paperSize === 'SEZNIK_100x15' ? 'Seznik 1-UP (100x15mm)' :
                  paperSize === 'DUMBBELL_70x12' ? 'Jewelry Dumbbell (70x12mm)' :
                  paperSize === 'RAT_TAIL_76x12' ? 'Jewelry Rat-Tail (76x12mm)' :
                  paperSize === 'A4_GRID_24' ? 'A4 24-Up Sheet (64x33.9mm)' :
                  paperSize === 'A4_GRID_40' ? 'A4 40-Up Sheet (48.5x25.4mm)' :
                  paperSize === 'A4_GRID_65' ? 'A4 65-Up Sheet (38.1x21.2mm)' :
                  paperSize === 'THERMAL_40x40' ? 'Thermal Square (40x40mm)' :
                  paperSize === 'THERMAL_38x25' ? 'Thermal Compact (38x25mm)' :
                  'Thermal Standard (50x30mm)'
                }
              </span>
            </div>

            {/* Category 1: 💎 Jewelry Tags & Reels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--neutral-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                💎 Jewelry Tags &amp; Reels
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {/* SEZNIK 3-UP */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('SEZNIK_3UP_100x15')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'SEZNIK_3UP_100x15' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'SEZNIK_3UP_100x15' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    boxShadow: paperSize === 'SEZNIK_3UP_100x15' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'SEZNIK_3UP_100x15' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                      Seznik 3-UP Reel
                    </div>
                    <span style={{ fontSize: '0.56rem', fontWeight: 800, backgroundColor: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 4 }}>
                      Amazon 3-UP
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    100 × 15 mm • 3 labels/row across 48mm web
                  </div>
                </button>

                {/* SEZNIK 1-UP */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('SEZNIK_100x15')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'SEZNIK_100x15' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'SEZNIK_100x15' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'SEZNIK_100x15' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'SEZNIK_100x15' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    Seznik 1-UP Tag
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    100 × 15 mm • Single continuous tag strip
                  </div>
                </button>

                {/* DUMBBELL */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('DUMBBELL_70x12')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'DUMBBELL_70x12' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'DUMBBELL_70x12' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'DUMBBELL_70x12' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'DUMBBELL_70x12' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    Jewelry Dumbbell
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    70 × 12 mm • Symmetrical bridge fold tag
                  </div>
                </button>

                {/* RAT-TAIL */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('RAT_TAIL_76x12')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'RAT_TAIL_76x12' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'RAT_TAIL_76x12' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'RAT_TAIL_76x12' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'RAT_TAIL_76x12' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    Jewelry Rat-Tail
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    76 × 12 mm • Dual-flap with tail loop
                  </div>
                </button>
              </div>
            </div>

            {/* Category 2: 📄 A4 Sticker Sheets (Standard Laser / Inkjet Printers) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--neutral-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                📄 A4 Sticker Sheets (Office Printers)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {/* A4 24-Up */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('A4_GRID_24')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'A4_GRID_24' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'A4_GRID_24' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'A4_GRID_24' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'A4_GRID_24' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    A4 (24-Up Grid)
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    64 × 33.9 mm • 3 cols × 8 rows (24 labels/sheet)
                  </div>
                </button>

                {/* A4 40-Up */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('A4_GRID_40')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'A4_GRID_40' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'A4_GRID_40' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'A4_GRID_40' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'A4_GRID_40' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    A4 (40-Up Grid)
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    48.5 × 25.4 mm • 4 cols × 10 rows (40 labels/sheet)
                  </div>
                </button>

                {/* A4 65-Up */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('A4_GRID_65')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'A4_GRID_65' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'A4_GRID_65' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'A4_GRID_65' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'A4_GRID_65' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    A4 (65-Up Grid)
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    38.1 × 21.2 mm • 5 cols × 13 rows (65 labels/sheet)
                  </div>
                </button>
              </div>
            </div>

            {/* Category 3: 📦 Standard Direct Thermal Rolls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--neutral-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                📦 Direct Thermal Rolls
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {/* 50x30 */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('THERMAL_50x30')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'THERMAL_50x30' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'THERMAL_50x30' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'THERMAL_50x30' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'THERMAL_50x30' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    Standard 50 × 30 mm
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    Universal barcode / QR thermal roll
                  </div>
                </button>

                {/* 40x40 */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('THERMAL_40x40')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'THERMAL_40x40' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'THERMAL_40x40' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'THERMAL_40x40' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'THERMAL_40x40' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    Square QR 40 × 40 mm
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    Square high-density 2D QR roll
                  </div>
                </button>

                {/* 38x25 */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('THERMAL_38x25')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${paperSize === 'THERMAL_38x25' ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                    backgroundColor: paperSize === 'THERMAL_38x25' ? 'var(--primary-50)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: paperSize === 'THERMAL_38x25' ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: paperSize === 'THERMAL_38x25' ? 'var(--primary-900)' : 'var(--neutral-800)' }}>
                    Compact 38 × 25 mm
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    Small packaging &amp; retail tag
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* 5. PRINT QUANTITY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              5. Print Quantity Copies
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--neutral-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, effectiveQuantity - 1))}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', borderRadius: 0, border: 'none', borderRight: '1px solid var(--neutral-300)' }}
                  title="Decrease copies"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setQuantity('');
                      return;
                    }
                    const num = parseInt(raw, 10);
                    if (isNaN(num)) {
                      setQuantity('');
                    } else {
                      setQuantity(Math.min(5000, Math.max(0, num)));
                    }
                  }}
                  onBlur={() => {
                    if (quantity === '' || Number(quantity) < 1) {
                      setQuantity(1);
                    }
                  }}
                  style={{
                    width: 64,
                    textAlign: 'center',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.94rem',
                    color: 'var(--neutral-900)',
                    outline: 'none',
                    padding: '6px 0'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(5000, effectiveQuantity + 1))}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', borderRadius: 0, border: 'none', borderLeft: '1px solid var(--neutral-300)' }}
                  title="Increase copies"
                >
                  +
                </button>
              </div>

              {[1, 5, 10, 25, 50, 100].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuantity(cnt)}
                  className={`btn btn-sm ${quantity === cnt ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: 38, padding: '4px 10px' }}
                >
                  {cnt}
                </button>
              ))}

              {defaultStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(defaultStockCount)}
                  className={`btn btn-sm ${quantity === defaultStockCount ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Sparkles size={14} />
                  <span>Sync Stock ({defaultStockCount})</span>
                </button>
              )}
            </div>

            {/* A4 Sheet Planner Breakdown Card */}
            {isA4 && (
              <div style={{
                backgroundColor: 'var(--primary-50)',
                border: '1.5px solid var(--primary-200)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LayoutGrid size={16} color="var(--primary-600)" />
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      A4 Sheet Breakdown: {Math.ceil(((startOffsetSlot - 1) + effectiveQuantity) / activeA4Grid.totalSlots)} Sheet(s)
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--neutral-500)' }}>
                      {effectiveQuantity} labels • {activeA4Grid.totalSlots} stickers per sheet ({activeA4Grid.cols}×{activeA4Grid.rows} grid)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--neutral-700)' }} title="Skip already peeled slots on sheet 1">
                    Start at sticker slot:
                  </label>
                  <select
                    value={startOffsetSlot}
                    onChange={(e) => setStartOffsetSlot(parseInt(e.target.value, 10) || 1)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: 4,
                      border: '1px solid var(--neutral-300)',
                      backgroundColor: '#ffffff',
                      color: 'var(--neutral-900)',
                      cursor: 'pointer'
                    }}
                  >
                    {Array.from({ length: activeA4Grid.totalSlots }).map((_, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Slot #{idx + 1} {idx === 0 ? '(Top Left)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 3-UP Seznik Information Card */}
            {isSeznik3Up && (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.72rem',
                color: 'var(--neutral-600)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: '0.9rem' }}>🖨️</span>
                <span>
                  <strong>Seznik 3-UP Reel:</strong> Thermal desktop printer advances in rows of 3 tags across the 48mm web ({Math.ceil(effectiveQuantity / 3)} rows total).
                </span>
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER ACTION BAR */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--neutral-50)',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 12
        }}>
          {/* Payload Display & Copy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '50%' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#ffffff',
              border: '1px solid var(--neutral-300)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              maxWidth: 320,
              overflow: 'hidden'
            }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>
                PAYLOAD:
              </span>
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {activePayload}
              </span>
              <button
                type="button"
                onClick={handleCopyPayload}
                className="btn btn-ghost btn-sm"
                style={{ padding: 2, height: 'auto', minHeight: 0 }}
                title="Copy Scannable String"
              >
                {copiedPayload ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              </button>
            </div>
            {copiedPayload && (
              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>
                Copied!
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadCodeImage}
              disabled={isDownloadingImage}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title="Export raw QR/Barcode graphic only"
            >
              <Download size={15} />
              <span>Raw Code</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileText size={16} />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={executeIsolatedPrint}
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px' }}
            >
              <Printer size={16} />
              <span>{isGenerating ? 'Printing...' : `Print ${effectiveQuantity} Labels`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
