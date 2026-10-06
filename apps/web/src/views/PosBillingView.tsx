import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Trash2, 
  CheckCircle, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Package,
  Filter,
  ChevronDown,
  User,
  Phone,
  Tag,
  MapPin,
  Percent,
  X,
  FileText,
  ArrowRight,
  RotateCw,
  Divide,
  Calculator,
  Scale,
  QrCode,
  Clock,
  Bookmark,
  PauseCircle,
  PlayCircle,
  Layers,
  Edit3,
  AlertCircle,
  Check
} from 'lucide-react';
import { Item, Party, CartItem, Invoice, ItemCategory, StagedOrder } from '../types';
import { store } from '../services/store';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { WebcamScannerModal } from '../components/WebcamScannerModal';

// Helper to parse decimal numbers or fraction expressions (e.g. "4/30", "6/12", "1 4/12", "1+4/12")
const parseFractionString = (str: string): number | null => {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Single decimal or integer e.g. "1.5" or "4"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Fraction e.g. "4/30" or "6/12"
  const fractionMatch = trimmed.match(/^(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]);
    const den = parseFloat(fractionMatch[3]);
    if (den > 0) {
      return num / den;
    }
  }

  // Mixed fraction e.g. "1 4/12" or "1+4/12"
  const mixedMatch = trimmed.match(/^(\d+(\.\d+)?)\s*(?:\+|\s)\s*(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[3]);
    const den = parseFloat(mixedMatch[5]);
    if (den > 0) {
      return whole + (num / den);
    }
  }

  return null;
};

// Helper for relative timestamps on drafts
const formatTimeAgo = (isoString: string): string => {
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return '';
  }
};

const QUICK_STAGE_PRESETS = [
  'Table 1',
  'Table 2',
  'Table 3',
  'Table 4',
  'Table 5',
  'Table 6',
  'Takeaway',
  'Token #1',
  'Token #2',
  'Drive-Thru',
  'Phone Order'
];

interface PosBillingViewProps {
  onInvoiceCreated: (invoice: Invoice) => void;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({ onInvoiceCreated }) => {
  const currentUser = store.getCurrentUser();
  const [selectedLocationId, setSelectedLocationId] = useState<string>(store.getActiveLocation().id);
  const [items, setItems] = useState<Item[]>([]);
  const [, setRawItems] = useState<Item[]>([]);
  const [categoriesList, setCategoriesList] = useState<ItemCategory[]>(store.getCategories());
  const [parties, setParties] = useState<Party[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Category Multi-Select Dropdown State (Matching InventoryView)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Cart State (Synchronized with store.posCart)
  const [cart, setCart] = useState<CartItem[]>(store.getPosCart());
  // Map of raw typed input string per item to allow typing "0.", "0.0", "0.01", "4/30" without React resetting mid-keystroke
  const [qtyInputMap, setQtyInputMap] = useState<Record<string, string>>({});
  // Item-level discount editor state
  const [editingDiscountItemId, setEditingDiscountItemId] = useState<string | null>(null);

  // Staged Orders / Multi-Drafts State
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>(() => store.getStagedOrders(store.getActiveLocation().id));
  const [activeStagedOrderId, setActiveStagedOrderId] = useState<string | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState<boolean>(false);
  const [stageSaveMode, setStageSaveMode] = useState<'UPDATE' | 'NEW'>('NEW');
  const [stageLabelInput, setStageLabelInput] = useState<string>('');
  const [stageNotesInput, setStageNotesInput] = useState<string>('');
  const [isDraftsDrawerOpen, setIsDraftsDrawerOpen] = useState<boolean>(false);
  const [draftSearch, setDraftSearch] = useState<string>('');
  const [conflictDraftToResume, setConflictDraftToResume] = useState<StagedOrder | null>(null);
  const [isEditingLabelId, setIsEditingLabelId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState<string>('');

  // Confirmation Dialog Modal State (for Discard / Delete / Clear Cart actions)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Fraction / Parts Calculator Modal State (Strictly for parts-enabled items)
  const [fractionModal, setFractionModal] = useState<{
    isOpen: boolean;
    cartItemId: string;
    itemName: string;
    unit: string;
    unitPrice: number;
    wholeUnits: string;
    partsGiven: string;
    totalParts: string;
  }>({
    isOpen: false,
    cartItemId: '',
    itemName: '',
    unit: 'unit',
    unitPrice: 0,
    wholeUnits: '0',
    partsGiven: '1',
    totalParts: '12',
  });

  const [isWebcamOpen, setIsWebcamOpen] = useState(false);

  // Global Hardware USB Barcode Scanner Handler
  const handleGlobalBarcodeScan = (scannedCode: string) => {
    const clean = scannedCode.trim();
    let publicId = clean;
    if (clean.startsWith('ITEM:')) {
      publicId = clean.replace('ITEM:', '').trim();
    }

    const matchedItem = items.find(
      (it) =>
        it.id === clean ||
        it.publicItemId === publicId ||
        it.publicItemId === clean ||
        it.sku === clean ||
        it.barcode === clean
    );

    if (matchedItem) {
      handleAddToCart(matchedItem);
    }
  };

  useBarcodeScanner({
    onScan: handleGlobalBarcodeScan,
    enabled: true,
  });

  // Subscribe to store posCart updates (e.g. when cleared upon location switch)
  useEffect(() => {
    const unsubscribe = store.subscribePosCart((updatedCart) => {
      setCart(updatedCart);
    });
    return unsubscribe;
  }, []);

  const updateCart = (newCartOrUpdater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setCart((prev) => {
      const nextCart = typeof newCartOrUpdater === 'function' ? newCartOrUpdater(prev) : newCartOrUpdater;
      store.setPosCartSilent(nextCart);
      return nextCart;
    });
  };

  // Checkout Modal State (Post Item Selection)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Discount State (Inside Checkout Modal)
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [orderDiscountType, setOrderDiscountType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [orderDiscountValue, setOrderDiscountValue] = useState<string>('0');

  // Settlement State
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Close Category Dropdown on Outside Click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Data Refresh / Location Sync
  const refreshData = async (showLoadingState = false) => {
    if (showLoadingState) setIsRefreshing(true);
    try {
      const currentLoc = store.getActiveLocation();
      // Fetch latest live stocks, categories, and parties from backend MongoDB
      await Promise.allSettled([
        store.fetchItems(currentLoc.id),
        store.fetchCategories(),
        store.fetchParties(),
      ]);

      const branchItems = store.getItems(currentLoc.id, false);
      setItems(branchItems);
      setRawItems(store.getRawItems());
      setCategoriesList(store.getCategories());
      setParties(store.getParties(currentLoc.id).filter(p => p.type === 'CUSTOMER'));
      if (selectedLocationId !== currentLoc.id) {
        setSelectedLocationId(currentLoc.id);
        updateCart([]);
      }
    } finally {
      if (showLoadingState) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();
    // Initial fetch of cloud staged orders on load or branch switch
    store.fetchStagedOrders(selectedLocationId).then(orders => {
      setStagedOrders(orders);
    }).catch(() => {});

    const interval = setInterval(() => {
      const currentLocId = store.getActiveLocation().id;
      if (currentLocId !== selectedLocationId) {
        setSelectedLocationId(currentLocId);
        updateCart([]);
        refreshData();
      }
    }, 400);

    let lastFocusFetch = 0;
    const onFocus = () => {
      const now = Date.now();
      // Fetch only if at least 15s elapsed since last tab focus
      if (now - lastFocusFetch > 15000) {
        lastFocusFetch = now;
        store.fetchStagedOrders(store.getActiveLocation().id).then(orders => {
          setStagedOrders(orders);
        }).catch(() => {});
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [selectedLocationId]);

  // Global Keyboard Shortcuts (Alt+H for Hold, Alt+S for Save Order, Alt+D for Drafts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        if (cart.length > 0) {
          if (activeStagedOrderId) {
            handleQuickSaveActiveDraft();
          } else {
            handleOpenStageModal();
          }
        }
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (cart.length > 0 && activeStagedOrderId) {
          handleQuickSaveActiveDraft();
        }
      } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setIsDraftsDrawerOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, activeStagedOrderId, stagedOrders]);

  const activeLocation = store.getActiveLocation();

  // Compute available categories from active items & category master
  const availableCategories = Array.from(new Set([
    ...categoriesList.map(c => c.name),
    ...items.map(i => i.category)
  ])).filter(Boolean);

  const toggleCategoryFilter = (catName: string) => {
    if (catName === 'ALL') {
      setSelectedCategories([]);
      return;
    }
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  // Filter items based on search and selected categories
  const filteredItems = items.filter(item => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = 
      (item.name || '').toLowerCase().includes(q) ||
      (item.publicItemId || '').toLowerCase().includes(q) ||
      (item.sku ? item.sku.toLowerCase().includes(q) : false) ||
      (item.barcode ? item.barcode.toLowerCase().includes(q) : false);
    
    const matchesCategory = 
      selectedCategories.length === 0 || 
      selectedCategories.includes(item.category);

    return matchesSearch && matchesCategory;
  });

  // Format Indian Phone with space (e.g., 91730 58119) & preserve user digits
  const cleanAndFormatIndianPhone = (raw: string): { digits: string; formatted: string } => {
    let digits = raw.replace(/\D/g, '');
    // Only strip 91/0 if user pasted more than 10 digits (e.g. 12 digits like +919173058119)
    if (digits.length > 10 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length > 10 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    return { digits, formatted };
  };

  // Handle Customer Phone Input & Live DB Lookup ONLY when exactly 10 digits are entered
  const handlePhoneChange = async (rawInput: string) => {
    const { digits, formatted } = cleanAndFormatIndianPhone(rawInput);
    setCustomerPhone(formatted);

    // If phone number is empty / cleared, reset name and party selection to blank
    if (digits.length === 0) {
      setSelectedPartyId('');
      setCustomerName('');
      return;
    }

    // Only query backend if exactly 10 digits are entered
    if (digits.length === 10) {
      const matched = await store.lookupPartyByPhone(digits, activeLocation.id);
      if (matched) {
        setSelectedPartyId(matched.id);
        setCustomerName(matched.name);
        setParties(store.getParties(activeLocation.id).filter(p => p.type === 'CUSTOMER'));
      } else {
        // Customer not found in DB (response is null) -> reset to default Customer <last 4 digits>
        setSelectedPartyId('');
        setCustomerName(`Customer ${digits.slice(-4)}`);
      }
    } else {
      // Whenever number is revised to less than 10 digits, reset previously matched customer name and partyId
      setSelectedPartyId('');
      setCustomerName('');
    }
  };

  // Helper to extract best item image URL
  const getItemImage = (item: Item): string | undefined => {
    return item.imageUrl || item.images?.find(img => img.isPrimary)?.url || item.images?.[0]?.url;
  };

  // Helper to re-evaluate a cart item's line total, discounts, and gross
  const calculateCartLine = (
    c: CartItem,
    newQty: number,
    newPrice?: number,
    newDiscType?: 'PERCENT' | 'FLAT',
    newDiscVal?: number
  ): CartItem => {
    const price = newPrice !== undefined ? newPrice : Number(c.unitPrice || c.item?.salePrice || 0);
    const qty = newQty;
    const gross = price * qty;
    const discType = newDiscType !== undefined ? newDiscType : (c.discountType || 'PERCENT');
    let discVal = newDiscVal !== undefined ? newDiscVal : (c.discountValue !== undefined ? c.discountValue : (c.discountPercent || 0));

    let discAmount = 0;
    let discPct = 0;

    if (discType === 'PERCENT') {
      discVal = Math.min(100, Math.max(0, discVal));
      discAmount = (gross * discVal) / 100;
      discPct = discVal;
    } else {
      discVal = Math.min(gross, Math.max(0, discVal));
      discAmount = discVal;
      discPct = gross > 0 ? (discAmount / gross) * 100 : 0;
    }

    const lineTotal = Math.max(0, gross - discAmount);

    return {
      ...c,
      unitPrice: price,
      quantity: qty,
      discountType: discType,
      discountValue: Number(discVal.toFixed(2)),
      discountAmount: Number(discAmount.toFixed(2)),
      discountPercent: Number(discPct.toFixed(2)),
      lineTotal: Number(lineTotal.toFixed(2)),
      originalLineTotal: Number(gross.toFixed(2)),
    };
  };

  // Add Item to Cart (Quick Tap on Catalog Card or Barcode Scan)
  const handleAddToCart = (item: Item) => {
    const price = Number(item.salePrice || 0);
    const taxRate = Number(item.taxRate || 0);
    const mrp = Number(item.mrp || 0);
    let itemDiscountPercent = 0;
    let itemDiscountType: 'PERCENT' | 'FLAT' = 'PERCENT';
    let itemDiscountVal = 0;

    if (item.discountValue && Number(item.discountValue) > 0) {
      if (item.discountType === 'PERCENT') {
        itemDiscountPercent = Number(item.discountValue);
        itemDiscountType = 'PERCENT';
        itemDiscountVal = Number(item.discountValue);
      } else if (mrp > 0) {
        itemDiscountType = 'FLAT';
        itemDiscountVal = Number(item.discountValue);
        itemDiscountPercent = Number(((Number(item.discountValue) / mrp) * 100).toFixed(1));
      } else {
        itemDiscountType = 'FLAT';
        itemDiscountVal = Number(item.discountValue);
      }
    }

    setQtyInputMap((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    updateCart((prevCart) => {
      const existingIdx = prevCart.findIndex(c => c.item.id === item.id);
      if (existingIdx >= 0) {
        const nextCart = [...prevCart];
        const currentQty = Number(nextCart[existingIdx].quantity || 0);
        const newQty = item.allowParts
          ? Number((currentQty + 1).toFixed(3))
          : currentQty + 1;
        nextCart[existingIdx] = calculateCartLine(nextCart[existingIdx], newQty, price);
        return nextCart;
      } else {
        const initialLine: CartItem = {
          item,
          quantity: 1,
          unitPrice: price,
          discountPercent: itemDiscountPercent,
          discountType: itemDiscountType,
          discountValue: itemDiscountVal,
          discountAmount: 0,
          taxRate: taxRate,
          lineTotal: price,
          originalLineTotal: price,
          allowParts: !!item.allowParts,
        };
        return [
          ...prevCart,
          calculateCartLine(initialLine, 1, price, itemDiscountType, itemDiscountVal),
        ];
      }
    });
  };

  // Adjust Qty by step (strictly 3 decimal places for parts-enabled items)
  const handleUpdateQty = (itemId: string, delta: number) => {
    setQtyInputMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    updateCart((prevCart) => {
      return prevCart
        .map((c) => {
          if (c.item.id === itemId) {
            const currentQty = Number(c.quantity || 0);
            const unitPrice = Number(c.unitPrice || c.item?.salePrice || 0);
            const nextQty = c.item.allowParts
              ? Number((currentQty + delta).toFixed(3))
              : (currentQty + delta);
            if (nextQty <= 0) return null;
            return calculateCartLine(c, nextQty, unitPrice);
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Set Qty directly (manual input with exact typing preservation for 0.01, 4/30 etc.)
  const handleSetQty = (itemId: string, rawVal: string) => {
    const targetItem = cart.find(c => c.item.id === itemId)?.item;
    const isAllowParts = !!targetItem?.allowParts;

    if (rawVal !== '') {
      if (isAllowParts) {
        if (!/^[\d\.\/\+\s]*$/.test(rawVal)) return;
      } else {
        if (!/^\d*$/.test(rawVal)) return;
      }
    }

    setQtyInputMap((prev) => ({ ...prev, [itemId]: rawVal }));

    if (rawVal === '' || rawVal === '.' || rawVal.endsWith('.') || rawVal.includes('/') || rawVal.includes('+')) {
      if (rawVal === '') {
        updateCart((prevCart) =>
          prevCart.map((c) =>
            c.item.id === itemId
              ? { ...c, quantity: 0, lineTotal: 0, discountAmount: 0 }
              : c
          )
        );
      }
      return;
    }

    const val = isAllowParts ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (isNaN(val) || val < 0) return;

    updateCart((prevCart) =>
      prevCart.map((c) => {
        if (c.item.id === itemId) {
          const maxAvailable = (c.item?.currentStock && c.item.currentStock > 0) ? c.item.currentStock : 99999;
          const newQty = isAllowParts
            ? Number(Math.min(val, maxAvailable).toFixed(3))
            : Math.max(1, Math.min(val, maxAvailable));
          const unitPrice = Number(c.unitPrice || c.item?.salePrice || 0);
          return calculateCartLine(c, newQty, unitPrice);
        }
        return c;
      })
    );
  };

  // Handle onBlur for manual quantity input (evaluates fractions e.g. 4/30 -> 0.133)
  const handleBlurQty = (itemId: string) => {
    const rawVal = qtyInputMap[itemId];
    setQtyInputMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    if (rawVal !== undefined) {
      const targetItem = cart.find(c => c.item.id === itemId)?.item;
      const isAllowParts = !!targetItem?.allowParts;
      const parsedVal = isAllowParts ? parseFractionString(rawVal) : parseInt(rawVal, 10);

      let finalVal: number;
      if (parsedVal === null || isNaN(parsedVal) || parsedVal <= 0) {
        finalVal = 1;
      } else {
        finalVal = isAllowParts ? Number(parsedVal.toFixed(3)) : Math.round(parsedVal);
      }

      updateCart((prevCart) =>
        prevCart.map((c) => {
          if (c.item.id === itemId) {
            const unitPrice = Number(c.unitPrice || c.item?.salePrice || 0);
            return calculateCartLine(c, finalVal, unitPrice);
          }
          return c;
        })
      );
    }
  };

  // Update Item-Level Discount (% or Flat ₹)
  const handleUpdateItemDiscount = (itemId: string, discountType: 'PERCENT' | 'FLAT', discountValue: number) => {
    updateCart((prevCart) =>
      prevCart.map((c) => {
        if (c.item.id === itemId) {
          return calculateCartLine(c, c.quantity, c.unitPrice, discountType, discountValue);
        }
        return c;
      })
    );
  };

  // Open Fraction / Loose Parts Calculator (Only for parts-enabled items)
  const handleOpenFractionModal = (line: CartItem) => {
    const whole = Math.floor(line.quantity || 0);
    setFractionModal({
      isOpen: true,
      cartItemId: line.item.id,
      itemName: line.item.name,
      unit: line.item.unit || 'unit',
      unitPrice: Number(line.unitPrice || line.item.salePrice || 0),
      wholeUnits: whole > 0 ? String(whole) : '0',
      partsGiven: '1',
      totalParts: '12',
    });
  };

  // Apply Fraction / Loose Parts to Cart (strictly 3 decimal places)
  const handleApplyFraction = () => {
    const whole = parseFloat(fractionModal.wholeUnits) || 0;
    const parts = parseFloat(fractionModal.partsGiven) || 0;
    const total = parseFloat(fractionModal.totalParts) || 1;

    if (total <= 0 || (whole === 0 && parts === 0)) return;

    // Strict 3 decimal places rounding
    const calculatedQty = Number((whole + (parts / total)).toFixed(3));
    if (calculatedQty <= 0) return;

    setQtyInputMap((prev) => {
      const next = { ...prev };
      delete next[fractionModal.cartItemId];
      return next;
    });

    updateCart((prevCart) =>
      prevCart.map((c) => {
        if (c.item.id === fractionModal.cartItemId) {
          const unitPrice = Number(c.unitPrice || c.item?.salePrice || 0);
          return calculateCartLine(c, calculatedQty, unitPrice);
        }
        return c;
      })
    );

    setFractionModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Remove Item
  const handleRemoveFromCart = (itemId: string) => {
    setQtyInputMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    if (editingDiscountItemId === itemId) {
      setEditingDiscountItemId(null);
    }
    updateCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  // Financial Calculations with Item & Order Discounts (% and Flat ₹)
  const grossSubtotal = cart.reduce((sum, c) => sum + (Number(c.unitPrice || 0) * Number(c.quantity || 0)), 0);
  const itemDiscountTotal = cart.reduce((sum, c) => sum + (Number(c.discountAmount || 0)), 0);
  const itemDiscountedSubtotal = Math.max(0, grossSubtotal - itemDiscountTotal);

  // Calculate Order Discount (configured in checkout modal)
  const parsedDiscountVal = showDiscount ? Math.max(0, Number(orderDiscountValue) || 0) : 0;
  let orderDiscountAmount = 0;
  if (showDiscount && parsedDiscountVal > 0) {
    if (orderDiscountType === 'PERCENT') {
      orderDiscountAmount = (itemDiscountedSubtotal * Math.min(100, parsedDiscountVal)) / 100;
    } else {
      orderDiscountAmount = Math.min(itemDiscountedSubtotal, parsedDiscountVal);
    }
  }
  orderDiscountAmount = Number(orderDiscountAmount.toFixed(2));

  // Net subtotal after all discounts
  const netSubtotal = Math.max(0, itemDiscountedSubtotal - orderDiscountAmount);

  // Discount factor applied across line items for GST calculation
  const discountFactor = itemDiscountedSubtotal > 0 ? (netSubtotal / itemDiscountedSubtotal) : 1;

  // Base taxable amount & GST Taxes
  const taxBaseTotal = cart.reduce((sum, c) => {
    const rate = Number(c.taxRate || 0);
    const unitPrice = Number(c.unitPrice || 0);
    const qty = Number(c.quantity || 0);
    const lineGross = unitPrice * qty;
    const lineNetBeforeOrder = Math.max(0, lineGross - (c.discountAmount || 0));
    const discountedLinePrice = lineNetBeforeOrder * discountFactor;
    const base = rate > 0 ? discountedLinePrice * (100 / (100 + rate)) : discountedLinePrice;
    return sum + base;
  }, 0);

  const taxTotal = cart.reduce((sum, c) => {
    const rate = Number(c.taxRate || 0);
    const unitPrice = Number(c.unitPrice || 0);
    const qty = Number(c.quantity || 0);
    const lineGross = unitPrice * qty;
    const lineNetBeforeOrder = Math.max(0, lineGross - (c.discountAmount || 0));
    const discountedLinePrice = lineNetBeforeOrder * discountFactor;
    const base = rate > 0 ? discountedLinePrice * (100 / (100 + rate)) : discountedLinePrice;
    return sum + (base * (rate / 100));
  }, 0);

  const unroundedTotal = netSubtotal;
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

  // Default Paid Amount
  const effectivePaid = paidAmountInput !== '' ? Number(paidAmountInput) : (paymentMode === 'CREDIT' ? 0 : grandTotal);
  const balance = Math.max(0, grandTotal - effectivePaid);

  // Staged Orders / Multi-Draft Actions
  const handleOpenStageModal = () => {
    if (cart.length === 0) return;
    const activeDraft = activeStagedOrderId ? stagedOrders.find(o => o.id === activeStagedOrderId) : null;
    if (activeDraft) {
      setStageSaveMode('UPDATE');
      setStageLabelInput(activeDraft.label);
      setStageNotesInput(activeDraft.notes || notes || '');
    } else {
      setStageSaveMode('NEW');
      const count = stagedOrders.length + 1;
      let defaultLabel = customerName.trim();
      if (!defaultLabel || defaultLabel.startsWith('Customer ') || defaultLabel === 'Walk-in Retail Customer') {
        defaultLabel = `Order #${count}`;
      }
      setStageLabelInput(defaultLabel);
      setStageNotesInput(notes || '');
    }
    setIsStageModalOpen(true);
  };

  const handleQuickSaveActiveDraft = () => {
    if (cart.length === 0 || !activeStagedOrderId) return;
    const activeDraft = stagedOrders.find(o => o.id === activeStagedOrderId);
    const count = stagedOrders.length + 1;
    const label = activeDraft?.label || customerName.trim() || `Order #${count}`;
    store.stageCurrentOrder({
      id: activeStagedOrderId,
      label,
      cart,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      selectedPartyId: selectedPartyId || undefined,
      orderDiscountType,
      orderDiscountValue,
      paymentMode,
      notes: notes || activeDraft?.notes || undefined,
      locationId: activeLocation.id,
    });

    const updated = store.getStagedOrders(activeLocation.id);
    setStagedOrders(updated);
    setActiveStagedOrderId(null);

    // Clear active cart & customer inputs
    updateCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedPartyId('');
    setShowDiscount(false);
    setOrderDiscountValue('0');
    setPaidAmountInput('');
    setNotes('');
  };

  const handleConfirmStageOrder = (overrideMode?: 'UPDATE' | 'NEW') => {
    if (cart.length === 0) return;
    const mode = overrideMode || stageSaveMode;
    const count = stagedOrders.length + 1;
    const finalLabel = stageLabelInput.trim() || `Order #${count}`;
    const targetId = (mode === 'UPDATE' && activeStagedOrderId) ? activeStagedOrderId : undefined;

    store.stageCurrentOrder({
      id: targetId,
      label: finalLabel,
      cart,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      selectedPartyId: selectedPartyId || undefined,
      orderDiscountType,
      orderDiscountValue,
      paymentMode,
      notes: stageNotesInput.trim() || notes || undefined,
      locationId: activeLocation.id,
    });

    const updated = store.getStagedOrders(activeLocation.id);
    setStagedOrders(updated);
    setActiveStagedOrderId(null);

    // Clear active cart & customer inputs
    updateCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedPartyId('');
    setShowDiscount(false);
    setOrderDiscountValue('0');
    setPaidAmountInput('');
    setNotes('');
    setIsStageModalOpen(false);
  };

  const doResumeOrder = (order: StagedOrder) => {
    updateCart(order.cart);
    setCustomerName(order.customerName || '');
    setCustomerPhone(order.customerPhone || '');
    setSelectedPartyId(order.selectedPartyId || '');
    setOrderDiscountType(order.orderDiscountType || 'PERCENT');
    setOrderDiscountValue(order.orderDiscountValue || '0');
    if (order.orderDiscountValue && Number(order.orderDiscountValue) > 0) {
      setShowDiscount(true);
    } else {
      setShowDiscount(false);
    }
    const mode = order.paymentMode;
    if (mode === 'CASH' || mode === 'UPI' || mode === 'CARD' || mode === 'CREDIT') {
      setPaymentMode(mode);
    } else {
      setPaymentMode('CASH');
    }
    setNotes(order.notes || '');
    setActiveStagedOrderId(order.id);
    setIsDraftsDrawerOpen(false);
    setConflictDraftToResume(null);
  };

  const handleResumeStagedOrder = (order: StagedOrder) => {
    if (cart.length > 0 && activeStagedOrderId !== order.id) {
      setConflictDraftToResume(order);
      return;
    }
    doResumeOrder(order);
  };

  const handleResolveConflict = (action: 'stage' | 'discard') => {
    if (!conflictDraftToResume) return;

    if (action === 'stage') {
      const count = stagedOrders.length + 1;
      let label = customerName.trim();
      if (!label || label.startsWith('Customer ') || label === 'Walk-in Retail Customer') {
        label = `Order #${count}`;
      }
      store.stageCurrentOrder({
        label,
        cart,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        selectedPartyId: selectedPartyId || undefined,
        orderDiscountType,
        orderDiscountValue,
        paymentMode,
        notes: notes || undefined,
        locationId: activeLocation.id,
      });
    }

    doResumeOrder(conflictDraftToResume);
    setStagedOrders(store.getStagedOrders(activeLocation.id));
  };

  const handlePromptClearCart = () => {
    if (cart.length === 0) return;
    const activeDraft = activeStagedOrderId ? stagedOrders.find(o => o.id === activeStagedOrderId) : null;
    setConfirmModal({
      isOpen: true,
      title: activeDraft ? 'Discard Changes & Clear Cart?' : 'Clear Active Cart?',
      message: activeDraft 
        ? `You are currently editing held order "${activeDraft.label}". Are you sure you want to discard your unsaved changes and clear the cart?`
        : `Are you sure you want to clear all ${cart.length} item(s) (₹${grandTotal.toFixed(2)}) from the cart?`,
      confirmLabel: 'Yes, Clear Cart',
      confirmVariant: 'danger',
      onConfirm: () => {
        updateCart([]);
        setQtyInputMap({});
        setActiveStagedOrderId(null);
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteStagedOrder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const draft = stagedOrders.find(o => o.id === id);
    const draftLabel = draft?.label || 'Held Order';
    const draftTotal = draft?.cart?.reduce((s, c) => s + (Number(c.unitPrice || 0) * Number(c.quantity || 0)), 0) || 0;

    setConfirmModal({
      isOpen: true,
      title: 'Discard & Delete Held Order?',
      message: `Are you sure you want to permanently delete held draft "${draftLabel}" (${draft?.cart?.length || 0} items • ₹${draftTotal.toFixed(2)})? This cannot be undone.`,
      confirmLabel: 'Yes, Delete Order',
      confirmVariant: 'danger',
      onConfirm: () => {
        store.deleteStagedOrder(id);
        setStagedOrders(store.getStagedOrders(activeLocation.id));
        if (activeStagedOrderId === id) {
          setActiveStagedOrderId(null);
          updateCart([]);
          setQtyInputMap({});
        }
        setConfirmModal(null);
      }
    });
  };

  const handleSaveDraftLabel = (id: string) => {
    if (editLabelText.trim()) {
      store.updateStagedOrderLabel(id, editLabelText.trim());
      setStagedOrders(store.getStagedOrders(activeLocation.id));
    }
    setIsEditingLabelId(null);
    setEditLabelText('');
  };

  // Open Checkout / Customer Confirmation Modal post item selection
  const handleOpenCheckoutModal = () => {
    if (cart.length === 0) return;
    setPaidAmountInput(String(grandTotal));
    setIsCheckoutModalOpen(true);
  };

  // Complete & Generate Bill
  const handleConfirmGenerateBill = async () => {
    if (cart.length === 0) return;

    const rawDigits = customerPhone.replace(/\D/g, '');
    const trimmedPhone = rawDigits.length === 10
      ? `+91${rawDigits}`
      : (rawDigits ? `+91${rawDigits}` : '');
    const trimmedName = customerName.trim();

    let partyId = selectedPartyId || undefined;
    let finalCustomerName = trimmedName;

    // 1. Existing customer party linked
    if (partyId) {
      const existingParty = parties.find(p => p.id === partyId);
      if (existingParty && trimmedName && trimmedName !== existingParty.name) {
        // User edited the name -> Update party record in store & MongoDB
        store.updateParty(partyId, { name: trimmedName });
        finalCustomerName = trimmedName;
      } else if (existingParty) {
        finalCustomerName = existingParty.name;
      }
    } else if (rawDigits) {
      // 2. Lookup if phone matches an existing customer in DB
      const matched = await store.lookupPartyByPhone(rawDigits, activeLocation.id);
      if (matched) {
        partyId = matched.id;
        if (trimmedName && trimmedName !== matched.name) {
          store.updateParty(matched.id, { name: trimmedName });
          finalCustomerName = trimmedName;
        } else {
          finalCustomerName = matched.name;
        }
      } else {
        // 3. New Customer -> Auto-register in dedicated MongoDB customers table
        const defaultOrTypedName = trimmedName || `Customer ${rawDigits.slice(-4)}`;
        const newParty = await store.createCustomer({
          name: defaultOrTypedName,
          phone: trimmedPhone,
          type: 'CUSTOMER',
          locationIds: [activeLocation.id],
        });
        partyId = newParty.id;
        finalCustomerName = newParty.name;
      }
    }

    if (!finalCustomerName) {
      finalCustomerName = 'Walk-in Retail Customer';
    }

    const finalCustomerPhone = trimmedPhone || undefined;

    const invoiceLines = cart.map(c => {
      const lineGross = c.unitPrice * c.quantity;
      const lineNetBeforeOrder = Math.max(0, lineGross - (c.discountAmount || 0));
      const discountedLine = lineNetBeforeOrder * discountFactor;
      const base = c.taxRate > 0 ? discountedLine * (100 / (100 + c.taxRate)) : discountedLine;
      return {
        itemId: c.item.id,
        name: c.item.name,
        unit: c.item.unit || 'pcs',
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        discountPercent: c.discountPercent || 0,
        discountType: c.discountType || (c.discountPercent ? 'PERCENT' : 'FLAT'),
        discountValue: c.discountValue !== undefined ? c.discountValue : (c.discountPercent || 0),
        discountAmount: c.discountAmount || 0,
        taxRate: c.taxRate,
        taxAmount: Number((base * (c.taxRate / 100)).toFixed(2)),
        taxableAmount: Number(base.toFixed(2)),
        total: Number(lineNetBeforeOrder.toFixed(2)),
        originalTotal: Number(lineGross.toFixed(2)),
      };
    });

    const finalPaidAmount = paymentMode === 'CREDIT' 
      ? (paidAmountInput !== '' ? Math.max(0, Number(paidAmountInput) || 0) : 0)
      : (paidAmountInput !== '' ? Math.max(0, Number(paidAmountInput) || 0) : grandTotal);

    const finalBalanceDue = Math.max(0, grandTotal - finalPaidAmount);

    const status: 'PAID' | 'PARTIAL' | 'UNPAID' = 
      finalPaidAmount >= grandTotal ? 'PAID' : (finalPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    const created = await store.createInvoice({
      date: new Date().toISOString().split('T')[0],
      partyId: partyId || undefined,
      partyName: finalCustomerName,
      partyPhone: finalCustomerPhone,
      consumerName: finalCustomerName,
      consumerPhone: finalCustomerPhone,
      billedById: currentUser?.id,
      billedByName: currentUser?.name || 'Staff Cashier',
      billedByRole: currentUser?.role || 'CASHIER',
      locationId: activeLocation.id,
      locationName: activeLocation.name,
      locationCode: activeLocation.code,
      locationAddress: activeLocation.address,
      locationPhone: activeLocation.phone,
      locationGstin: activeLocation.gstin || store.getActiveTenant()?.gstin || undefined,
      type: 'SALE',
      items: invoiceLines,
      subtotal: Number(taxBaseTotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      discountTotal: Number((itemDiscountTotal + orderDiscountAmount).toFixed(2)),
      discountType: orderDiscountType,
      discountValue: parsedDiscountVal,
      roundOff,
      grandTotal,
      paidAmount: finalPaidAmount,
      balanceAmount: finalBalanceDue,
      paymentMode,
      status,
      notes,
    });

    // Auto-purge active staged order if billed
    if (activeStagedOrderId) {
      store.deleteStagedOrder(activeStagedOrderId);
      setActiveStagedOrderId(null);
      setStagedOrders(store.getStagedOrders(activeLocation.id));
    }

    // Reset State
    updateCart([]);
    setPaidAmountInput('');
    setNotes('');
    setShowDiscount(false);
    setOrderDiscountValue('0');
    setCustomerPhone('');
    setCustomerName('');
    setSelectedPartyId('');
    setIsCheckoutModalOpen(false);

    // Refresh items and stocks immediately
    refreshData();

    // Trigger Print Modal
    onInvoiceCreated(created);
  };

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  return (
    <div className="page-container" style={{ paddingBottom: 16 }}>
      <div className="pos-layout">
        {/* Left Column: Product Catalog & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'visible', position: 'relative' }}>
          
          {/* Top Search & Category Filter Bar */}
          <div className="card" style={{ padding: '12px 16px', position: 'relative', zIndex: 40, flexShrink: 0, overflow: 'visible' }}>
            {/* Active Branch Notice & Manual Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--neutral-700)', fontWeight: 600 }}>
                <MapPin size={14} color="var(--primary-600)" />
                <span>POS Active Branch: <strong>{activeLocation.name}</strong></span>
                <span style={{ fontSize: '0.68rem', padding: '1px 7px', borderRadius: 10, backgroundColor: 'var(--success-50)', color: 'var(--success-700)', fontWeight: 700 }}>
                  Live ({items.length} listed items)
                </span>
              </div>

              {/* Manual Refresh Stocks Button */}
              <button
                type="button"
                onClick={() => refreshData(true)}
                disabled={isRefreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isRefreshing ? 'var(--neutral-200)' : 'var(--neutral-100)',
                  border: '1px solid var(--neutral-300)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'var(--neutral-800)',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
                title="Refresh product list and real-time stock levels from server"
              >
                <RotateCw size={13} style={{ animation: isRefreshing ? 'spin 0.75s linear infinite' : 'none' }} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Stocks'}</span>
              </button>
            </div>

            {/* Staged Orders / Multi-Drafts Quick Ribbon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: stagedOrders.length > 0 ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${stagedOrders.length > 0 ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: 'var(--radius-md, 8px)',
              padding: '6px 10px',
              marginBottom: 10,
              gap: 8,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflowX: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setIsDraftsDrawerOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: stagedOrders.length > 0 ? '#d97706' : '#64748b',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                  }}
                  title="View all held orders / drafts (Alt+D)"
                >
                  <Layers size={13} />
                  <span>Drafts ({stagedOrders.length})</span>
                </button>

                {stagedOrders.length === 0 ? (
                  <span style={{ fontSize: '0.73rem', color: 'var(--neutral-500)' }}>
                    No orders on hold. Use <strong>Alt+H</strong> or click "Hold Order" to stage the current cart.
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                    {stagedOrders.slice(0, 5).map((draft) => {
                      const isActive = activeStagedOrderId === draft.id;
                      const draftTotal = draft.cart.reduce((s, c) => s + (c.unitPrice * c.quantity), 0);
                      return (
                        <div
                          key={draft.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: isActive ? '#fef3c7' : '#ffffff',
                            border: `1.5px solid ${isActive ? '#d97706' : '#cbd5e1'}`,
                            padding: '3px 8px',
                            borderRadius: 16,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: isActive ? '#92400e' : '#334155',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleResumeStagedOrder(draft)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              font: 'inherit',
                              fontWeight: 'inherit',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: 0
                            }}
                            title={`Click to resume draft: ${draft.label} (${formatTimeAgo(draft.createdAt)})`}
                          >
                            <Bookmark size={11} color={isActive ? '#d97706' : '#64748b'} />
                            <span>{draft.label}</span>
                            <span style={{ color: '#059669', fontWeight: 800 }}>₹{draftTotal.toFixed(0)}</span>
                            <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>({draft.cart.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteStagedOrder(draft.id, e)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '0 2px',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: '0.70rem',
                              lineHeight: 1
                            }}
                            title="Discard this draft"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    {stagedOrders.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setIsDraftsDrawerOpen(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#d97706',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          textDecoration: 'underline'
                        }}
                      >
                        +{stagedOrders.length - 5} more...
                      </button>
                    )}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenStageModal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  title="Stage / Hold active cart items (Alt+H)"
                >
                  <PauseCircle size={13} />
                  <span>Hold Active (Alt+H)</span>
                </button>
              )}
            </div>

            {/* Search Input & Multi-Select Category Dropdown */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Product Search */}
              <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
                <Search size={17} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
                <input
                  type="text"
                  placeholder="Scan QR barcode, or search by item name, SKU, ID..."
                  className="form-input"
                  style={{ paddingLeft: 38, width: '100%', boxSizing: 'border-box' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: 9,
                      background: 'none',
                      border: 'none',
                      color: 'var(--neutral-400)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      padding: '2px 6px',
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Webcam Camera Scanner Button */}
              <button
                type="button"
                onClick={() => setIsWebcamOpen(true)}
                title="Open Webcam Camera Scanner"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--primary-500)',
                  backgroundColor: 'var(--primary-50)',
                  color: 'var(--primary-700)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <QrCode size={16} color="var(--primary-600)" />
                <span>Webcam Scanner</span>
              </button>

              {/* Multi-Select Category Dropdown matching InventoryView */}
              <div style={{ position: 'relative', flexShrink: 0, zIndex: 50 }} ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCategoryDropdownOpen(prev => !prev);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${selectedCategories.length > 0 ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                    backgroundColor: selectedCategories.length > 0 ? 'var(--primary-50)' : '#ffffff',
                    color: selectedCategories.length > 0 ? 'var(--primary-700)' : 'var(--neutral-700)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-sm)',
                    minWidth: 155,
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={14} color={selectedCategories.length > 0 ? 'var(--primary-600)' : 'var(--neutral-500)'} />
                    <span>
                      {selectedCategories.length === 0
                        ? 'All Categories'
                        : selectedCategories.length === 1
                        ? selectedCategories[0]
                        : `${selectedCategories.length} Categories`}
                    </span>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {selectedCategories.length > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 18,
                        height: 18,
                        padding: '0 4px',
                        borderRadius: 9,
                        backgroundColor: 'var(--primary-600)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                      }}>
                        {selectedCategories.length}
                      </span>
                    )}
                    <ChevronDown size={14} style={{ transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </button>

                {/* Popover Dropdown Menu */}
                {isCategoryDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 9999,
                      width: 290,
                      maxHeight: 390,
                      backgroundColor: '#ffffff',
                      borderRadius: 'var(--radius-lg, 8px)',
                      border: '1px solid var(--neutral-300)',
                      boxShadow: '0 16px 36px rgba(0, 0, 0, 0.2), 0 6px 14px rgba(0, 0, 0, 0.08)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {/* Search inside Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--neutral-400)' }} />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', paddingLeft: 26, paddingRight: 24, paddingTop: 5, paddingBottom: 5, fontSize: '0.78rem', boxSizing: 'border-box' }}
                      />
                      {dropdownSearch && (
                        <button
                          type="button"
                          onClick={() => setDropdownSearch('')}
                          style={{
                            position: 'absolute',
                            right: 6,
                            top: 5,
                            background: 'none',
                            border: 'none',
                            color: 'var(--neutral-400)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Actions: Clear / Show All & Select All */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid var(--neutral-100)' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedCategories([])}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.75rem',
                          color: selectedCategories.length === 0 ? 'var(--primary-600)' : 'var(--neutral-500)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        Clear / Show All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCategories(availableCategories)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '0.75rem',
                          color: 'var(--primary-600)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        Select All ({availableCategories.length})
                      </button>
                    </div>

                    {/* Checkbox Category Items */}
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {availableCategories
                        .filter(cat => (cat || '').toLowerCase().includes((dropdownSearch || '').toLowerCase()))
                        .map(cat => {
                          const isChecked = selectedCategories.includes(cat);
                          const count = items.filter(i => (i.category || '').toLowerCase() === (cat || '').toLowerCase()).length;
                          return (
                            <div
                              key={cat}
                              onClick={() => toggleCategoryFilter(cat)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: 'var(--radius-sm, 6px)',
                                backgroundColor: isChecked ? 'var(--primary-50)' : '#ffffff',
                                border: `1px solid ${isChecked ? 'var(--primary-200)' : 'transparent'}`,
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                color: isChecked ? 'var(--primary-800)' : 'var(--neutral-800)',
                                fontWeight: isChecked ? 700 : 500,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer', pointerEvents: 'none' }}
                                />
                                <span>{cat}</span>
                              </div>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: 10,
                                backgroundColor: isChecked ? 'var(--primary-100)' : 'var(--neutral-100)',
                                color: isChecked ? 'var(--primary-700)' : 'var(--neutral-500)',
                                fontWeight: 700,
                              }}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      {availableCategories.filter(cat => cat.toLowerCase().includes(dropdownSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--neutral-400)', fontSize: '0.78rem' }}>
                          No categories found matching "{dropdownSearch}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Active Filter Badges */}
            {selectedCategories.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Active Filters:</span>
                {selectedCategories.map(cat => (
                  <span
                    key={cat}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--primary-50)',
                      border: '1px solid var(--primary-200)',
                      color: 'var(--primary-800)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => toggleCategoryFilter(cat)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-600)', cursor: 'pointer', padding: 0, fontSize: '0.8rem', lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  style={{ background: 'none', border: 'none', color: 'var(--danger-600)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: '0 4px' }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Fixed-Height Product Items Grid */}
          <div className="item-catalog-grid" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
            {filteredItems.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 36, color: 'var(--neutral-400)', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px dashed var(--neutral-300)' }}>
                <Package size={38} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--neutral-700)', fontSize: '0.95rem', fontWeight: 700 }}>No products found</h4>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>
                  {items.length === 0 
                    ? `No items are currently enabled for sale at ${activeLocation.name}. Enable items in Inventory Management.`
                    : 'Try searching with another keyword or adjusting your category filter.'}
                </p>
                {(searchQuery || selectedCategories.length > 0) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategories([]);
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => {
                const imageUrl = getItemImage(item);
                const isOutOfStock = item.currentStock <= 0;
                const isLowStock = !isOutOfStock && item.currentStock <= item.minStockAlert;

                return (
                  <div 
                    key={item.id} 
                    className="pos-item-card" 
                    onClick={() => handleAddToCart(item)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      backgroundColor: '#ffffff',
                      border: isOutOfStock ? '1.5px dashed var(--danger-300)' : '1px solid var(--neutral-200)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      padding: 0,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease-in-out',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      opacity: isOutOfStock ? 0.75 : 1,
                      minHeight: 205,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Top Segment: Product Image Banner */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: 105,
                      backgroundColor: 'var(--neutral-50)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid var(--neutral-100)',
                      overflow: 'hidden',
                    }}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.name}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            padding: 6,
                            boxSizing: 'border-box',
                          }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-400)' }}>
                          <Package size={34} strokeWidth={1.5} />
                        </div>
                      )}

                      {/* Category Pill Top-Left */}
                      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 1 }}>
                        <span style={{
                          fontSize: '0.65rem',
                          color: 'var(--neutral-700)',
                          backgroundColor: 'rgba(255, 255, 255, 0.92)',
                          backdropFilter: 'blur(4px)',
                          border: '1px solid rgba(0, 0, 0, 0.08)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 600,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          display: 'inline-block',
                          maxWidth: 100,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {item.category || 'General'}
                        </span>
                      </div>

                      {/* GST Pill Top-Right */}
                      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
                        <span style={{
                          fontSize: '0.62rem',
                          backgroundColor: 'rgba(238, 242, 255, 0.95)',
                          backdropFilter: 'blur(4px)',
                          border: '1px solid var(--primary-200)',
                          padding: '2px 5px',
                          borderRadius: 4,
                          color: 'var(--primary-700)',
                          fontWeight: 700,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}>
                          GST {item.taxRate}%
                        </span>
                      </div>

                      {/* Loose / Parts Tag Bottom-Left on Image */}
                      {item.allowParts && (
                        <div style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 1 }}>
                          <span style={{
                            fontSize: '0.62rem',
                            color: '#065f46',
                            backgroundColor: 'rgba(236, 253, 245, 0.95)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid #a7f3d0',
                            padding: '2px 5px',
                            borderRadius: 4,
                            fontWeight: 700,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            ⚖️ Loose / Parts
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Body: Full Product Title & Price Footer */}
                    <div style={{
                      padding: '10px 12px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      flex: 1,
                    }}>
                      <div>
                        {/* Full Product Name (100% width, no clamping, natural wrapping) */}
                        <h4 style={{
                          margin: '0 0 6px 0',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: 'var(--neutral-900)',
                          lineHeight: '1.35',
                          wordBreak: 'normal',
                          overflowWrap: 'break-word',
                        }}>
                          {item.name}
                        </h4>
                      </div>

                      {/* Card Bottom: Price & Quick Add Button */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 8,
                        marginTop: 6,
                        borderTop: '1px solid var(--neutral-100)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontSize: '1.10rem', fontWeight: 800, color: 'var(--primary-700)' }}>
                            ₹{Number(item.salePrice || 0).toFixed(2)}
                          </span>
                          {item.hasDiscount && item.discountValue && item.discountValue > 0 && (
                            <del style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                              ₹{Number(item.mrp || item.salePrice || 0).toFixed(2)}
                            </del>
                          )}
                        </div>

                        {/* Quick Add Button */}
                        <button
                          type="button"
                          aria-label={`Add ${item.name} to cart`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(item);
                          }}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            backgroundColor: 'var(--primary-600)',
                            border: 'none',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                          }}
                          title="Add to Bill"
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Cart & Billing Actions */}
        <div className="pos-cart-panel" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Cart Header */}
          <div className="card-header" style={{ padding: '10px 14px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={17} color="var(--primary-500)" />
              <span className="card-title" style={{ fontSize: '0.90rem', fontWeight: 800 }}>
                Cart ({cart.reduce((s, c) => s + (c.quantity || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 3 })})
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.70rem',
                  padding: '3px 8px',
                  backgroundColor: stagedOrders.length > 0 ? '#fffbeb' : undefined,
                  borderColor: stagedOrders.length > 0 ? '#fde68a' : undefined,
                  color: stagedOrders.length > 0 ? '#b45309' : undefined,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => setIsDraftsDrawerOpen(true)}
                title="View all staged orders / drafts (Alt+D)"
              >
                <Layers size={11} />
                <span>Drafts ({stagedOrders.length})</span>
              </button>

              {cart.length > 0 && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ fontSize: '0.70rem', padding: '3px 8px' }}
                  onClick={handlePromptClearCart}
                  title="Clear active cart / discard items"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List with Independent Scroll */}
          <div className="pos-cart-items" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '10px 12px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
            
            {/* Active Draft Banner */}
            {activeStagedOrderId && (() => {
              const currentDraft = stagedOrders.find(o => o.id === activeStagedOrderId);
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  backgroundColor: '#fffbeb',
                  borderRadius: 8,
                  border: '1.5px solid #fde68a',
                  color: '#92400e',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Bookmark size={13} color="#d97706" />
                    <span>Editing Held Order: <strong>{currentDraft?.label || 'Held Order'}</strong></span>
                  </div>
                  <span style={{ fontSize: '0.66rem', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: 4, border: '1px solid #fde68a' }}>
                    Auto-clears on Bill
                  </span>
                </div>
              );
            })()}

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--neutral-400)', padding: 24 }}>
                <ShoppingBag size={38} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontWeight: 700, fontSize: '0.90rem', color: 'var(--neutral-600)', margin: 0 }}>Cart is empty</p>
                <p style={{ fontSize: '0.76rem', marginTop: 4, color: 'var(--neutral-400)' }}>Select products or scan barcodes to begin billing</p>
              </div>
            ) : (
              cart.map((line) => {
                return (
                  <div 
                    key={line.item.id} 
                    className="pos-cart-card"
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Top Row: Product Name on Left & Quantity Stepper on Top-Right */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      {/* Left: Product Name & Parts Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                        <h5 style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a', margin: 0, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                          {line.item.name}
                        </h5>
                        {line.item.allowParts && (
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: 4,
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            fontWeight: 700,
                            border: '1px solid #a7f3d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            whiteSpace: 'nowrap'
                          }}>
                            ⚖️ {line.item.unit}
                          </span>
                        )}
                      </div>

                      {/* Top-Right: Quantity Stepper Pill */}
                      <div 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: 7, 
                          backgroundColor: '#f8fafc',
                          overflow: 'hidden',
                          flexShrink: 0,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      >
                        <button 
                          type="button"
                          onClick={() => handleUpdateQty(line.item.id, line.item.allowParts ? -0.5 : -1)} 
                          aria-label="Decrease quantity"
                          style={{
                            width: 24,
                            height: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'background-color 0.12s ease'
                          }}
                          title={line.item.allowParts ? "Reduce by 0.5" : "Reduce by 1"}
                        >
                          <Minus size={11} strokeWidth={2.5} />
                        </button>
                        <input 
                          type="text"
                          inputMode={line.item.allowParts ? "text" : "numeric"}
                          value={qtyInputMap[line.item.id] !== undefined ? qtyInputMap[line.item.id] : String(line.quantity)}
                          onChange={(e) => handleSetQty(line.item.id, e.target.value)}
                          onBlur={() => handleBlurQty(line.item.id)}
                          className="cart-qty-input"
                          style={{
                            width: line.item.allowParts ? 54 : 36,
                            height: 26,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            padding: '0 2px',
                            textAlign: 'center',
                            backgroundColor: '#ffffff',
                            borderTop: 'none',
                            borderBottom: 'none',
                            borderLeft: '1px solid #e2e8f0',
                            borderRight: '1px solid #e2e8f0',
                            outline: 'none'
                          }}
                          aria-label="Quantity"
                          placeholder="0"
                          title={line.item.allowParts ? "Enter decimal (0.5) or fraction (e.g. 4/30)" : "Enter quantity"}
                        />
                        <button 
                          type="button"
                          onClick={() => handleUpdateQty(line.item.id, line.item.allowParts ? 0.5 : 1)} 
                          aria-label="Increase quantity"
                          style={{
                            width: 24,
                            height: 26,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            cursor: 'pointer',
                            padding: 0,
                            transition: 'background-color 0.12s ease'
                          }}
                          title={line.item.allowParts ? "Add 0.5" : "Add 1"}
                        >
                          <Plus size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    {/* Subtle Internal Divider */}
                    <div style={{ height: 1, backgroundColor: '#f1f5f9', width: '100%' }} />

                    {/* Bottom Row: Unit Rate & Fraction Tools (Left) & Cost with Delete Button (Right) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      {/* Left: Unit Cost & Discount Controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                            ₹{line.unitPrice.toFixed(2)} / {line.item.unit || 'unit'}
                          </span>
                          
                          {/* Item Discount Trigger Badge / Button */}
                          {(line.discountAmount && line.discountAmount > 0) ? (
                            <button
                              type="button"
                              onClick={() => setEditingDiscountItemId(editingDiscountItemId === line.item.id ? null : line.item.id)}
                              style={{
                                fontSize: '0.66rem',
                                padding: '1px 6px',
                                borderRadius: 4,
                                backgroundColor: '#ecfdf5',
                                color: '#047857',
                                fontWeight: 700,
                                border: '1px solid #a7f3d0',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.12s ease'
                              }}
                              title="Click to edit or remove item discount"
                            >
                              <Tag size={10} />
                              <span>
                                {line.discountType === 'PERCENT'
                                  ? `${line.discountValue !== undefined ? line.discountValue : line.discountPercent}% OFF`
                                  : `₹${line.discountValue !== undefined ? line.discountValue : line.discountAmount} OFF`}
                                {' '}(-₹{(line.discountAmount || 0).toFixed(2)})
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDiscountItemId(editingDiscountItemId === line.item.id ? null : line.item.id)}
                              style={{
                                fontSize: '0.64rem',
                                padding: '1px 5px',
                                borderRadius: 4,
                                backgroundColor: editingDiscountItemId === line.item.id ? '#eff6ff' : '#f8fafc',
                                color: editingDiscountItemId === line.item.id ? '#1d4ed8' : '#64748b',
                                fontWeight: 600,
                                border: editingDiscountItemId === line.item.id ? '1px solid #bfdbfe' : '1px dashed #cbd5e1',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                transition: 'all 0.12s ease'
                              }}
                              title="Add discount for this specific item"
                            >
                              <Tag size={9} />
                              <span>+ Disc</span>
                            </button>
                          )}
                        </div>

                        {line.item.allowParts && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenFractionModal(line)}
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: '#eef2ff',
                                border: '1px solid #c7d2fe',
                                color: '#4338ca',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.12s ease',
                              }}
                              title="Calculate loose/fraction quantity"
                            >
                              <Divide size={10} strokeWidth={2.5} />
                              <span>Fraction</span>
                            </button>
                            {['0.25', '0.5', '1'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleUpdateQty(line.item.id, Number(preset))}
                                style={{
                                  fontSize: '0.63rem',
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.12s ease',
                                }}
                                title={`Add +${preset} ${line.item.unit}`}
                              >
                                +{preset}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Cost with strikethrough gross & Delete Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          {line.discountAmount && line.discountAmount > 0 ? (
                            <span style={{ fontSize: '0.70rem', textDecoration: 'line-through', color: '#94a3b8', lineHeight: 1 }}>
                              ₹{(line.originalLineTotal || (line.unitPrice * line.quantity)).toFixed(2)}
                            </span>
                          ) : null}
                          <span style={{ fontWeight: 800, fontSize: '0.96rem', color: line.discountAmount && line.discountAmount > 0 ? '#059669' : '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                            ₹{line.lineTotal.toFixed(2)}
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveFromCart(line.item.id)} 
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 5,
                            border: 'none',
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            transition: 'all 0.12s ease'
                          }}
                          title="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Inline Item Discount Editor Panel */}
                    {editingDiscountItemId === line.item.id && (
                      <div style={{
                        marginTop: 6,
                        padding: '6px 8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155' }}>Item Discount:</span>
                          
                          {/* % or ₹ Toggle */}
                          <div style={{ display: 'inline-flex', borderRadius: 4, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemDiscount(line.item.id, 'PERCENT', line.discountValue || 0)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: (line.discountType || 'PERCENT') === 'PERCENT' ? '#2563eb' : '#ffffff',
                                color: (line.discountType || 'PERCENT') === 'PERCENT' ? '#ffffff' : '#64748b',
                              }}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemDiscount(line.item.id, 'FLAT', line.discountValue || 0)}
                              style={{
                                padding: '2px 7px',
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: (line.discountType || 'PERCENT') === 'FLAT' ? '#2563eb' : '#ffffff',
                                color: (line.discountType || 'PERCENT') === 'FLAT' ? '#ffffff' : '#64748b',
                              }}
                            >
                              ₹
                            </button>
                          </div>

                          {/* Number Input */}
                          <input
                            type="number"
                            min="0"
                            step={line.discountType === 'PERCENT' ? "1" : "0.5"}
                            max={line.discountType === 'PERCENT' ? "100" : String(line.unitPrice * line.quantity)}
                            value={line.discountValue !== undefined && line.discountValue !== 0 ? line.discountValue : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateItemDiscount(line.item.id, line.discountType || 'PERCENT', val);
                            }}
                            placeholder={line.discountType === 'PERCENT' ? 'e.g. 10%' : 'e.g. 50₹'}
                            style={{
                              width: 70,
                              height: 24,
                              padding: '2px 6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderRadius: 4,
                              border: '1px solid #94a3b8',
                              textAlign: 'right'
                            }}
                          />

                          {/* Close / Done Button */}
                          <button
                            type="button"
                            onClick={() => setEditingDiscountItemId(null)}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              border: 'none',
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Done"
                          >
                            <Check size={12} strokeWidth={2.5} />
                          </button>
                        </div>

                        {/* Quick Presets */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>Quick:</span>
                          {(line.discountType === 'FLAT'
                            ? [10, 20, 50, 100]
                            : [5, 10, 15, 20, 50]
                          ).map((amt) => {
                            const isSelected = line.discountValue === amt;
                            return (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => handleUpdateItemDiscount(line.item.id, line.discountType || 'PERCENT', amt)}
                                style={{
                                  fontSize: '0.63rem',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  backgroundColor: isSelected ? '#dbeafe' : '#ffffff',
                                  border: isSelected ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                                  color: isSelected ? '#1d4ed8' : '#475569',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {line.discountType === 'FLAT' ? `₹${amt}` : `${amt}%`}
                              </button>
                            );
                          })}
                          {(line.discountValue && line.discountValue > 0) ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateItemDiscount(line.item.id, 'PERCENT', 0)}
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: 3,
                                backgroundColor: '#fee2e2',
                                border: '1px solid #fca5a5',
                                color: '#b91c1c',
                                fontWeight: 700,
                                cursor: 'pointer',
                                marginLeft: 'auto'
                              }}
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Bottom: Calculations & Billing Actions */}
          {cart.length > 0 && (
            <div style={{ padding: 12, borderTop: '1px solid var(--surface-border)', backgroundColor: '#ffffff', flexShrink: 0 }}>
              
              {/* Calculations Box */}
              <div style={{ backgroundColor: 'var(--neutral-50)', padding: 8, borderRadius: 6, marginBottom: 10, border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--neutral-600)' }}>
                  <span>Gross Subtotal:</span>
                  <span>₹{grossSubtotal.toFixed(2)}</span>
                </div>

                {itemDiscountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#059669', fontWeight: 600, marginTop: 2 }}>
                    <span>Item Discounts:</span>
                    <span>-₹{itemDiscountTotal.toFixed(2)}</span>
                  </div>
                )}

                {orderDiscountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#059669', fontWeight: 600, marginTop: 2 }}>
                    <span>Order Discount:</span>
                    <span>-₹{orderDiscountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  <span>Est. GST Taxes:</span>
                  <span>₹{taxTotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.02rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 4, borderTop: '1px solid var(--neutral-200)', paddingTop: 4 }}>
                  <span>Est. Total:</span>
                  <span style={{ color: 'var(--primary-600)' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons: Hold / Save Order & Proceed to Bill */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.7fr', gap: 8 }}>
                {activeStagedOrderId ? (
                  <button
                    type="button"
                    onClick={handleQuickSaveActiveDraft}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1.5px solid #86efac',
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(21, 128, 61, 0.12)'
                    }}
                    title="Save updated order to hold & sync across devices (Alt+S)"
                  >
                    <span>💾 Save Order (Alt+S)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenStageModal}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md, 8px)',
                      border: '1.5px solid #fde68a',
                      backgroundColor: '#fffbeb',
                      color: '#b45309',
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                    title="Stage / Hold this order with a label (Alt+H)"
                  >
                    <PauseCircle size={15} />
                    <span>Hold (Alt+H)</span>
                  </button>
                )}


                <button 
                  className="btn btn-primary" 
                  style={{ padding: '10px 12px', fontSize: '0.88rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={handleOpenCheckoutModal}
                >
                  <span>Bill ₹{grandTotal.toFixed(2)}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post-Item Selection: Consumer Information & Bill Generation Confirmation Modal */}
      {isCheckoutModalOpen && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', overflow: 'hidden', backgroundColor: '#ffffff' }}
          >
            {/* Modal Header */}
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 40 }}>
                <FileText size={18} color="var(--primary-600)" />
                <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                  Generate & Confirm Tax Bill
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => setIsCheckoutModalOpen(false)}
                title="Cancel"
                style={{ 
                  position: 'absolute',
                  top: 14,
                  right: 16,
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--neutral-100)',
                  border: '1px solid var(--neutral-300)',
                  color: 'var(--neutral-700)',
                  cursor: 'pointer'
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="card-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              
              {/* 1. Consumer / Customer Information Section */}
              <div style={{ backgroundColor: 'var(--neutral-50)', padding: 14, borderRadius: 8, border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={15} color="var(--primary-600)" />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-800)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Customer / Party Information
                    </span>
                  </div>
                  {selectedParty ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.72rem', background: 'var(--success-100)', color: 'var(--success-700)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        ✓ Existing Customer
                      </span>
                      {selectedParty.currentBalance !== undefined && selectedParty.currentBalance !== 0 && (
                        <span style={{ fontSize: '0.72rem', color: Number(selectedParty.currentBalance || 0) > 0 ? 'var(--danger-700)' : 'var(--success-700)', fontWeight: 700 }}>
                          Bal: ₹{Number(selectedParty.currentBalance || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ) : customerPhone.trim().length >= 5 ? (
                    <span style={{ fontSize: '0.72rem', background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                      🆕 New Customer (will auto-save)
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', fontWeight: 500 }}>
                      Walk-in Retail Customer
                    </span>
                  )}
                </div>

                {/* Phone Number (FIRST) & Customer Name (SECOND) Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10 }}>
                  {/* 1. Phone Number Input (First) with Default +91 Country Code Badge */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--neutral-600)', marginBottom: 3, fontWeight: 700 }}>
                      Mobile / Phone No. <span style={{ color: 'var(--primary-600)', fontWeight: 500 }}>(10 Digits)</span>
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      border: `1.5px solid ${selectedParty ? 'var(--success-500)' : 'var(--neutral-300)'}`,
                      borderRadius: 'var(--radius-sm, 6px)',
                      backgroundColor: selectedParty ? '#f0fdf4' : '#ffffff',
                      height: 38,
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '0 8px',
                        backgroundColor: selectedParty ? '#dcfce7' : 'var(--neutral-100, #f1f5f9)',
                        borderRight: `1px solid ${selectedParty ? 'var(--success-300, #86efac)' : 'var(--neutral-300)'}`,
                        height: '100%',
                        color: selectedParty ? 'var(--success-800)' : 'var(--neutral-700)',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        userSelect: 'none',
                        flexShrink: 0
                      }}>
                        <Phone size={13} color={selectedParty ? 'var(--success-600)' : 'var(--neutral-500)'} />
                        <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={customerPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        maxLength={11} // 10 digits + 1 space e.g. "98765 43210"
                        style={{
                          border: 'none',
                          outline: 'none',
                          boxShadow: 'none',
                          padding: '0 8px',
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          letterSpacing: '0.03em',
                          backgroundColor: 'transparent',
                          width: '100%',
                          height: '100%',
                          color: 'var(--neutral-900)'
                        }}
                      />
                      {customerPhone && (
                        <button
                          type="button"
                          onClick={() => handlePhoneChange('')}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: 'var(--neutral-400)',
                            cursor: 'pointer',
                            padding: '0 8px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Clear phone number"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Customer / Bill Name Input (Second) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--neutral-600)', marginBottom: 3, fontWeight: 700 }}>
                      Customer / Bill Name
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'absolute', left: 10, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: 'var(--neutral-400)' }}>
                        <User size={15} />
                      </div>
                      <input
                        type="text"
                        placeholder="Customer Name (e.g. Rahul Sharma)"
                        className="form-input"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        style={{ 
                          fontSize: '0.84rem', 
                          lineHeight: 1.4,
                          paddingLeft: 32, 
                          paddingTop: 8, 
                          paddingBottom: 8, 
                          height: 38,
                          width: '100%', 
                          boxSizing: 'border-box', 
                          fontWeight: 600 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Enhanced Order Discount Section (% & Absolute ₹) */}
              <div style={{ padding: '12px 14px', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={15} color="var(--primary-600)" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neutral-800)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Order Discount (Optional)
                    </span>
                  </div>

                  {!showDiscount ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDiscount(true);
                        if (orderDiscountValue === '0' || !orderDiscountValue) setOrderDiscountValue('5');
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--primary-400)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        color: 'var(--primary-700)',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <Plus size={12} />
                      <span>Add Discount</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDiscount(false);
                        setOrderDiscountValue('0');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger-600)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Remove Discount
                    </button>
                  )}
                </div>

                {showDiscount && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--neutral-200)' }}>
                    {/* Switcher & Custom Value Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Mode Selector Tabs */}
                      <div 
                        style={{ 
                          display: 'inline-flex', 
                          background: 'var(--neutral-200)', 
                          padding: 2, 
                          borderRadius: 'var(--radius-sm)', 
                          gap: 2 
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setOrderDiscountType('PERCENT')}
                          style={{
                            border: 'none',
                            padding: '5px 12px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-xs, 4px)',
                            backgroundColor: orderDiscountType === 'PERCENT' ? 'var(--primary-600)' : 'transparent',
                            color: orderDiscountType === 'PERCENT' ? '#ffffff' : 'var(--neutral-700)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Percent size={12} />
                          <span>Percentage (%)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderDiscountType('FLAT')}
                          style={{
                            border: 'none',
                            padding: '5px 12px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radius-xs, 4px)',
                            backgroundColor: orderDiscountType === 'FLAT' ? 'var(--primary-600)' : 'transparent',
                            color: orderDiscountType === 'FLAT' ? '#ffffff' : 'var(--neutral-700)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>₹ Flat (Absolute)</span>
                        </button>
                      </div>

                      {/* Numeric Input Box */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', flex: '1 1 120px', minWidth: 110 }}>
                        <span style={{ position: 'absolute', left: 10, fontSize: '0.84rem', fontWeight: 800, color: 'var(--neutral-500)' }}>
                          {orderDiscountType === 'PERCENT' ? '%' : '₹'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={orderDiscountType === 'PERCENT' ? 100 : grossSubtotal}
                          step={orderDiscountType === 'PERCENT' ? '1' : '10'}
                          value={orderDiscountValue}
                          onChange={(e) => setOrderDiscountValue(e.target.value)}
                          placeholder={orderDiscountType === 'PERCENT' ? 'e.g. 10' : 'e.g. 100'}
                          className="form-input"
                          style={{
                            width: '100%',
                            paddingLeft: 26,
                            paddingTop: 5,
                            paddingBottom: 5,
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    {/* Quick Preset Value Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Quick Presets:</span>
                      {(orderDiscountType === 'PERCENT' 
                        ? ['5', '10', '15', '20', '25'] 
                        : ['25', '50', '100', '200', '500']
                      ).map((preset) => {
                        const isSelected = orderDiscountValue === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setOrderDiscountValue(preset)}
                            style={{
                              border: `1px solid ${isSelected ? 'var(--primary-500)' : 'var(--neutral-300)'}`,
                              backgroundColor: isSelected ? 'var(--primary-100)' : '#ffffff',
                              color: isSelected ? 'var(--primary-800)' : 'var(--neutral-700)',
                              fontSize: '0.72rem',
                              fontWeight: isSelected ? 800 : 600,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm, 6px)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {orderDiscountType === 'PERCENT' ? `${preset}%` : `₹${preset}`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Live Calculation Savings Summary */}
                    {orderDiscountAmount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', padding: '6px 10px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700 }}>
                          Discount Applied: -₹{orderDiscountAmount.toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--neutral-600)' }}>
                          New Subtotal: ₹{netSubtotal.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Payment Mode & Settlement */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--neutral-600)', marginBottom: 4, fontWeight: 700 }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                  {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode);
                        if (mode === 'CREDIT') setPaidAmountInput('0');
                        else setPaidAmountInput(String(grandTotal));
                      }}
                      style={{
                        padding: '6px 4px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid',
                        borderColor: paymentMode === mode ? 'var(--primary-500)' : 'var(--neutral-300)',
                        backgroundColor: paymentMode === mode ? 'var(--primary-50)' : '#ffffff',
                        color: paymentMode === mode ? 'var(--primary-700)' : 'var(--neutral-600)',
                        cursor: 'pointer',
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--neutral-500)', marginBottom: 2, fontWeight: 600 }}>
                      Amount Received (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '5px 8px', width: '100%', boxSizing: 'border-box', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--neutral-500)', marginBottom: 2, fontWeight: 600 }}>
                      {balance > 0 ? 'Balance / Due (₹)' : 'Change Return (₹)'}
                    </label>
                    <div style={{
                      padding: '5px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--neutral-100)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: balance > 0 ? 'var(--danger-700)' : 'var(--success-700)'
                    }}>
                      ₹{balance > 0 ? balance.toFixed(2) : (effectivePaid > grandTotal ? (effectivePaid - grandTotal).toFixed(2) : '0.00')}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Order Financial Breakdown Summary */}
              <div style={{ backgroundColor: 'var(--neutral-50)', padding: 10, borderRadius: 8, border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--neutral-600)' }}>
                  <span>Total Items:</span>
                  <span style={{ fontWeight: 600 }}>{cart.reduce((s, c) => s + c.quantity, 0)} items</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  <span>Gross Items Subtotal:</span>
                  <span>₹{grossSubtotal.toFixed(2)}</span>
                </div>
                {itemDiscountTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--success-700)', fontWeight: 600, marginTop: 2 }}>
                    <span>Item Discounts:</span>
                    <span>-₹{itemDiscountTotal.toFixed(2)}</span>
                  </div>
                )}
                {orderDiscountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--success-700)', fontWeight: 600, marginTop: 2 }}>
                    <span>Order Discount ({orderDiscountType === 'PERCENT' ? `${parsedDiscountVal}%` : `₹${parsedDiscountVal}`}):</span>
                    <span>-₹{orderDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  <span>Taxable Base & GST:</span>
                  <span>₹{taxBaseTotal.toFixed(2)} + ₹{taxTotal.toFixed(2)}</span>
                </div>
                {roundOff !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--neutral-400)', marginTop: 2 }}>
                    <span>Round Off:</span>
                    <span>{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--neutral-200)' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--primary-600)' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer - Sticky & Balanced Visibility */}
            <div 
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--neutral-200)',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                flexShrink: 0,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
              }}
            >
              <button 
                type="button" 
                onClick={() => setIsCheckoutModalOpen(false)}
                style={{ 
                  height: 38,
                  fontSize: '0.86rem', 
                  padding: '0 16px', 
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--neutral-300)',
                  backgroundColor: '#ffffff',
                  color: 'var(--neutral-700)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--neutral-100)';
                  e.currentTarget.style.borderColor = 'var(--neutral-400)';
                  e.currentTarget.style.color = 'var(--neutral-900)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = 'var(--neutral-300)';
                  e.currentTarget.style.color = 'var(--neutral-700)';
                }}
              >
                <X size={15} />
                <span>Cancel</span>
              </button>

              <button 
                type="button" 
                onClick={handleConfirmGenerateBill}
                style={{ 
                  height: 38,
                  fontSize: '0.88rem', 
                  fontWeight: 700, 
                  padding: '0 22px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 7,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.3)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <CheckCircle size={16} />
                <span>Confirm & Generate Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Simple Fraction / Loose Calculator Modal (Strictly for parts-enabled items) */}
      {fractionModal.isOpen && (() => {
        const whole = parseFloat(fractionModal.wholeUnits) || 0;
        const parts = parseFloat(fractionModal.partsGiven) || 0;
        const total = parseFloat(fractionModal.totalParts) || 1;
        const calculatedQty = Number((whole + (parts / Math.max(1, total))).toFixed(3));
        const piecePrice = total > 0 ? (fractionModal.unitPrice / total) : 0;
        const calculatedTotal = Number((calculatedQty * fractionModal.unitPrice).toFixed(2));

        const packPresets = [
          { label: '12 (Dozen)', value: '12' },
          { label: '30 (Tray)', value: '30' },
          { label: '6 (Half)', value: '6' },
          { label: '24 (Box)', value: '24' },
          { label: '1000 (Kg➔g)', value: '1000' },
        ];

        return (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 16,
            }}
            onClick={() => setFractionModal(prev => ({ ...prev, isOpen: false }))}
          >
            <div 
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-lg, 12px)',
                width: '100%',
                maxWidth: 380,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Simple Modal Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--surface-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--neutral-50)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {fractionModal.itemName}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                    ₹{fractionModal.unitPrice.toFixed(2)} / {fractionModal.unit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFractionModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--neutral-400)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Simple Modal Body */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 1. Giving Pieces (Numerator) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--neutral-700)', marginBottom: 4 }}>
                    Pieces / Parts Giving
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFractionModal(prev => ({ ...prev, partsGiven: String(Math.max(1, (parseFloat(prev.partsGiven) || 1) - 1)) }))}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: '1px solid var(--neutral-300)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-700)'
                      }}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fractionModal.partsGiven}
                      onChange={(e) => setFractionModal(prev => ({ ...prev, partsGiven: e.target.value }))}
                      className="form-input"
                      placeholder="4"
                      style={{ fontSize: '0.90rem', padding: '5px 8px', flex: 1, textAlign: 'center', fontWeight: 700 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setFractionModal(prev => ({ ...prev, partsGiven: String((parseFloat(prev.partsGiven) || 0) + 1) }))}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: '1px solid var(--neutral-300)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-700)'
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* 2. Out of Total in Pack (Denominator) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                      Out of Total in 1 Full {fractionModal.unit || 'Unit'}
                    </label>
                    {piecePrice > 0 && (
                      <span style={{ fontSize: '0.70rem', color: 'var(--primary-700)', fontWeight: 700 }}>
                        ₹{piecePrice.toFixed(2)}/pc
                      </span>
                    )}
                  </div>

                  {/* Pack Presets */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {packPresets.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setFractionModal(prev => ({ ...prev, totalParts: preset.value }))}
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid',
                          borderColor: fractionModal.totalParts === preset.value ? 'var(--primary-500)' : 'var(--neutral-200)',
                          backgroundColor: fractionModal.totalParts === preset.value ? 'var(--primary-50)' : '#ffffff',
                          color: fractionModal.totalParts === preset.value ? 'var(--primary-700)' : 'var(--neutral-700)',
                          fontWeight: fractionModal.totalParts === preset.value ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={fractionModal.totalParts}
                    onChange={(e) => setFractionModal(prev => ({ ...prev, totalParts: e.target.value }))}
                    className="form-input"
                    placeholder="Total parts (e.g. 12 or 30)"
                    style={{ fontSize: '0.84rem', padding: '5px 8px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {/* 3. Optional Whole Packs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.74rem', color: 'var(--neutral-600)', fontWeight: 600 }}>
                    + Whole {fractionModal.unit || 'Units'} (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fractionModal.wholeUnits}
                    onChange={(e) => setFractionModal(prev => ({ ...prev, wholeUnits: e.target.value }))}
                    className="form-input"
                    placeholder="0"
                    style={{ fontSize: '0.80rem', padding: '4px 6px', width: 64, textAlign: 'center' }}
                  />
                </div>

                {/* Simple Live Result Card */}
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--neutral-900)',
                  borderRadius: 8,
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontFamily: 'monospace', fontWeight: 700 }}>
                      {whole > 0 ? `${whole} + ` : ''}{parts}/{total} = {calculatedQty.toFixed(3)} {fractionModal.unit}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--neutral-400)' }}>
                      Total Amount
                    </div>
                  </div>
                  <div style={{ fontSize: '1.20rem', fontWeight: 800, color: '#34d399' }}>
                    ₹{calculatedTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Simple Modal Footer */}
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--surface-border)',
                backgroundColor: 'var(--neutral-50)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8
              }}>
                <button
                  type="button"
                  onClick={() => setFractionModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    height: 34,
                    padding: '0 12px',
                    fontSize: '0.80rem',
                    borderRadius: 6,
                    border: '1px solid var(--neutral-300)',
                    backgroundColor: '#ffffff',
                    color: 'var(--neutral-700)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyFraction}
                  style={{
                    height: 34,
                    padding: '0 16px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: 'var(--primary-600)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Apply ({calculatedQty.toFixed(3)} {fractionModal.unit})</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal 1: Hold / Stage Current Order Prompt */}
      {isStageModalOpen && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            style={{ maxWidth: 460, width: '100%', borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', backgroundColor: '#ffffff' }}
          >
            {/* Header */}
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PauseCircle size={18} color="#d97706" />
                <span className="card-title" style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e' }}>
                  Hold / Stage Order
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => setIsStageModalOpen(false)}
                title="Cancel"
                style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* If editing an active resumed draft, show mode selector */}
              {activeStagedOrderId && (() => {
                const currentDraft = stagedOrders.find(o => o.id === activeStagedOrderId);
                return (
                  <div style={{
                    padding: '8px 10px',
                    backgroundColor: '#fffbeb',
                    borderRadius: 8,
                    border: '1px solid #fde68a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700 }}>
                      Currently editing resumed draft: <strong>{currentDraft?.label || 'Held Order'}</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setStageSaveMode('UPDATE');
                          if (currentDraft?.label) setStageLabelInput(currentDraft.label);
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `1.5px solid ${stageSaveMode === 'UPDATE' ? '#d97706' : '#cbd5e1'}`,
                          backgroundColor: stageSaveMode === 'UPDATE' ? '#fef3c7' : '#ffffff',
                          color: stageSaveMode === 'UPDATE' ? '#92400e' : '#475569',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4
                        }}
                      >
                        <span>🔄 Update Existing</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStageSaveMode('NEW');
                          setStageLabelInput(`Order #${stagedOrders.length + 1}`);
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: `1.5px solid ${stageSaveMode === 'NEW' ? '#d97706' : '#cbd5e1'}`,
                          backgroundColor: stageSaveMode === 'NEW' ? '#fef3c7' : '#ffffff',
                          color: stageSaveMode === 'NEW' ? '#92400e' : '#475569',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4
                        }}
                      >
                        <span>➕ Save as New</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Cart Summary Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#0f172a' }}>
                    Holding {cart.length} item{cart.length > 1 ? 's' : ''} ({cart.reduce((s, c) => s + (c.quantity || 0), 0)} units)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {customerName.trim() ? `Customer: ${customerName}` : 'Walk-in Customer'}
                  </div>
                </div>
                <div style={{ fontSize: '1.10rem', fontWeight: 800, color: '#059669' }}>
                  ₹{grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Quick Label Preset Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--neutral-600)', marginBottom: 6, fontWeight: 700 }}>
                  Quick Label Presets (Café / Retail)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {QUICK_STAGE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStageLabelInput(preset)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: `1px solid ${stageLabelInput === preset ? '#d97706' : '#e2e8f0'}`,
                        backgroundColor: stageLabelInput === preset ? '#fef3c7' : '#ffffff',
                        color: stageLabelInput === preset ? '#92400e' : '#475569',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Order Label Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--neutral-700)', marginBottom: 4, fontWeight: 700 }}>
                  Order Label / Identifier <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Table 4, Rohan Takeaway, Token #12"
                  value={stageLabelInput}
                  onChange={(e) => setStageLabelInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmStageOrder();
                    }
                  }}
                  style={{ width: '100%', fontSize: '0.86rem', padding: '8px 10px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--neutral-600)', marginBottom: 4, fontWeight: 600 }}>
                  Hold Notes (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Waiting for friend, pay by UPI later..."
                  value={stageNotesInput}
                  onChange={(e) => setStageNotesInput(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', padding: '6px 10px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsStageModalOpen(false)}
                style={{ fontSize: '0.80rem', padding: '6px 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmStageOrder()}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                }}
              >
                <PauseCircle size={14} />
                <span>
                  {activeStagedOrderId && stageSaveMode === 'UPDATE' 
                    ? `Update & Re-Hold (${stageLabelInput || 'Draft'})`
                    : 'Hold & Clear Cart'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Staged Orders / Multi-Drafts Drawer Modal */}
      {isDraftsDrawerOpen && (
        <div className="modal-overlay" onClick={() => setIsDraftsDrawerOpen(false)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', backgroundColor: '#ffffff' }}
          >
            {/* Header */}
            <div className="card-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#d97706" />
                <div>
                  <span className="card-title" style={{ fontSize: '1.02rem', fontWeight: 800 }}>
                    Held Orders & Drafts
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 8, fontWeight: 600 }}>
                    ({stagedOrders.length} staged at {activeLocation.name})
                  </span>
                </div>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => setIsDraftsDrawerOpen(false)}
                title="Close"
                style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Search */}
            {stagedOrders.length > 0 && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--neutral-200)', backgroundColor: '#ffffff' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--neutral-400)' }} />
                  <input
                    type="text"
                    placeholder="Search drafts by label, customer, or items..."
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: '0.80rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* Body: Drafts List */}
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              {stagedOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--neutral-400)' }}>
                  <Layers size={42} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--neutral-700)', margin: 0 }}>No orders currently on hold</h4>
                  <p style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--neutral-500)' }}>
                    When a customer asks to wait, click <strong>"Hold (Alt+H)"</strong> to store their cart and serve the next customer.
                  </p>
                </div>
              ) : (
                stagedOrders
                  .filter(d => {
                    if (!draftSearch.trim()) return true;
                    const q = draftSearch.toLowerCase();
                    return (
                      d.label.toLowerCase().includes(q) ||
                      (d.customerName && d.customerName.toLowerCase().includes(q)) ||
                      (d.customerPhone && d.customerPhone.toLowerCase().includes(q)) ||
                      (d.notes && d.notes.toLowerCase().includes(q)) ||
                      d.cart.some(c => c.item.name.toLowerCase().includes(q))
                    );
                  })
                  .map((draft) => {
                    const isActive = activeStagedOrderId === draft.id;
                    const draftTotal = draft.cart.reduce((s, c) => s + (c.unitPrice * c.quantity), 0);
                    const isEditing = isEditingLabelId === draft.id;

                    return (
                      <div
                        key={draft.id}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: 10,
                          border: `1.5px solid ${isActive ? '#d97706' : '#e2e8f0'}`,
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Top: Label + Time + Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                <input
                                  type="text"
                                  value={editLabelText}
                                  onChange={(e) => setEditLabelText(e.target.value)}
                                  className="form-input"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDraftLabel(draft.id);
                                    if (e.key === 'Escape') setIsEditingLabelId(null);
                                  }}
                                  style={{ padding: '3px 6px', fontSize: '0.82rem', height: 28 }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveDraftLabel(draft.id)}
                                  style={{ padding: '3px 8px', borderRadius: 4, backgroundColor: '#059669', color: '#fff', border: 'none', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingLabelId(null)}
                                  style={{ padding: '3px 6px', borderRadius: 4, backgroundColor: '#e2e8f0', color: '#475569', border: 'none', fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                                  {draft.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingLabelId(draft.id);
                                    setEditLabelText(draft.label);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                                  title="Rename label"
                                >
                                  <Edit3 size={12} />
                                </button>
                                {isActive && (
                                  <span style={{ fontSize: '0.64rem', padding: '1px 6px', borderRadius: 4, backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 800, border: '1px solid #fde68a' }}>
                                    ACTIVE CART
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>
                            <Clock size={12} />
                            <span>{formatTimeAgo(draft.createdAt)}</span>
                          </div>
                        </div>

                        {/* Middle: Customer & Items Preview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {draft.customerName && (
                            <div style={{ fontSize: '0.74rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <User size={12} color="#64748b" />
                              <span>{draft.customerName}</span>
                              {draft.customerPhone && <span style={{ color: '#94a3b8' }}>({draft.customerPhone})</span>}
                            </div>
                          )}

                          {/* Items summary */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            {draft.cart.map((c, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: '#f1f5f9',
                                  color: '#334155',
                                  fontWeight: 600,
                                }}
                              >
                                {c.quantity}x {c.item.name}
                              </span>
                            ))}
                          </div>

                          {draft.notes && (
                            <div style={{ fontSize: '0.70rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>
                              Note: {draft.notes}
                            </div>
                          )}
                        </div>

                        {/* Bottom: Total & Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 2 }}>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                            ₹{draftTotal.toFixed(2)}
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, marginLeft: 6 }}>
                              ({draft.cart.length} item{draft.cart.length > 1 ? 's' : ''})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteStagedOrder(draft.id, e)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: 6,
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Discard this staged draft"
                            >
                              <Trash2 size={12} />
                              <span>Discard</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResumeStagedOrder(draft)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: '#4f46e5',
                                color: '#ffffff',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)'
                              }}
                            >
                              <PlayCircle size={13} />
                              <span>Resume Order</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--neutral-200)', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
              <span>Shortcut: <strong>Alt+H</strong> to Hold, <strong>Alt+D</strong> to Drafts</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDraftsDrawerOpen(false)}
                style={{ fontSize: '0.75rem', padding: '4px 12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Cart Conflict Resolution Modal */}
      {conflictDraftToResume && (
        <div className="modal-overlay">
          <div 
            className="modal-content" 
            style={{ maxWidth: 460, width: '100%', borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', backgroundColor: '#ffffff' }}
          >
            {/* Header */}
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fef3c7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} color="#d97706" />
                <span className="card-title" style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e' }}>
                  Hold Active Cart First?
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => setConflictDraftToResume(null)}
                title="Cancel"
                style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="card-body" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '0.84rem', color: '#334155', margin: 0, lineHeight: 1.4 }}>
                Your current cart contains <strong>{cart.length} item(s) (₹{grandTotal.toFixed(2)})</strong>.
              </p>
              <p style={{ fontSize: '0.80rem', color: '#64748b', margin: 0 }}>
                Before opening <strong>"{conflictDraftToResume.label}"</strong>, what would you like to do with the current items?
              </p>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <button
                type="button"
                onClick={() => handleResolveConflict('stage')}
                style={{
                  padding: '9px 14px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)'
                }}
              >
                <PauseCircle size={15} />
                <span>Auto-Hold Current & Open Draft (Recommended)</span>
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleResolveConflict('discard')}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#ef4444',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Discard Current & Open
                </button>

                <button
                  type="button"
                  onClick={() => setConflictDraftToResume(null)}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--neutral-300)',
                    backgroundColor: '#ffffff',
                    color: 'var(--neutral-700)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Confirmation Dialog Modal (Clear Cart & Discard Actions) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 440, width: '100%', borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', backgroundColor: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
          >
            {/* Header */}
            <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: confirmModal.confirmVariant === 'danger' ? '#fef2f2' : 'var(--neutral-50)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} color={confirmModal.confirmVariant === 'danger' ? '#ef4444' : '#d97706'} />
                <span className="card-title" style={{ fontSize: '1rem', fontWeight: 800, color: confirmModal.confirmVariant === 'danger' ? '#991b1b' : 'var(--neutral-900)' }}>
                  {confirmModal.title}
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => setConfirmModal(null)}
                title="Cancel"
                style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="card-body" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: '0.86rem', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                {confirmModal.message}
              </p>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmModal(null)}
                style={{ padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: confirmModal.confirmVariant === 'danger' ? '#dc2626' : '#d97706',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: confirmModal.confirmVariant === 'danger' ? '0 2px 4px rgba(220, 38, 38, 0.25)' : '0 2px 4px rgba(217, 119, 6, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <WebcamScannerModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onScanSuccess={handleGlobalBarcodeScan}
      />
    </div>
  );
};
