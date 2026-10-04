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
  QrCode
} from 'lucide-react';
import { Item, Party, CartItem, Invoice, ItemCategory } from '../types';
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
    const interval = setInterval(() => {
      const currentLocId = store.getActiveLocation().id;
      if (currentLocId !== selectedLocationId) {
        setSelectedLocationId(currentLocId);
        updateCart([]);
        refreshData();
      }
    }, 400);
    return () => clearInterval(interval);
  }, [selectedLocationId]);

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

  // Add Item to Cart
  const handleAddToCart = (item: Item) => {
    const price = Number(item.salePrice || 0);
    const mrp = Number(item.mrp || item.salePrice || 0);
    const taxRate = Number(item.taxRate || 0);

    let itemDiscountPercent = 0;
    if (item.hasDiscount && item.discountValue && item.discountValue > 0) {
      if (item.discountType === 'PERCENT') {
        itemDiscountPercent = Number(item.discountValue);
      } else if (mrp > 0) {
        itemDiscountPercent = Number(((Number(item.discountValue) / mrp) * 100).toFixed(1));
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
        const lineTotal = Number((newQty * price).toFixed(2));
        nextCart[existingIdx] = {
          ...nextCart[existingIdx],
          quantity: newQty,
          unitPrice: price,
          taxRate: taxRate,
          lineTotal,
        };
        return nextCart;
      } else {
        return [
          ...prevCart,
          {
            item,
            quantity: 1,
            unitPrice: price,
            discountPercent: itemDiscountPercent,
            taxRate: taxRate,
            lineTotal: Number((1 * price).toFixed(2)),
            allowParts: !!item.allowParts,
          },
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
            return {
              ...c,
              quantity: nextQty,
              unitPrice,
              lineTotal: Number((nextQty * unitPrice).toFixed(2)),
            };
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

    // For parts-enabled: allow digits, decimals, fractions (slash), plus, and spaces (e.g. "4/30", "1 4/12", "0.5")
    // For non-parts: only allow digits
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
              ? { ...c, quantity: 0, lineTotal: 0 }
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
          return {
            ...c,
            quantity: newQty,
            lineTotal: Number((newQty * unitPrice).toFixed(2)),
          };
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
            return {
              ...c,
              quantity: finalVal,
              lineTotal: Number((finalVal * unitPrice).toFixed(2)),
            };
          }
          return c;
        })
      );
    }
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
          return {
            ...c,
            quantity: calculatedQty,
            lineTotal: Number((calculatedQty * unitPrice).toFixed(2)),
          };
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
    updateCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  // Financial Calculations with Discounts (% and Flat ₹)
  const grossSubtotal = cart.reduce((sum, c) => sum + (Number(c.unitPrice || 0) * Number(c.quantity || 0)), 0);
  
  // Calculate Order Discount (configured in checkout modal)
  const parsedDiscountVal = showDiscount ? Math.max(0, Number(orderDiscountValue) || 0) : 0;
  let orderDiscountAmount = 0;
  if (showDiscount && parsedDiscountVal > 0) {
    if (orderDiscountType === 'PERCENT') {
      orderDiscountAmount = (grossSubtotal * Math.min(100, parsedDiscountVal)) / 100;
    } else {
      orderDiscountAmount = Math.min(grossSubtotal, parsedDiscountVal);
    }
  }
  orderDiscountAmount = Number(orderDiscountAmount.toFixed(2));

  // Net subtotal after order discount
  const netSubtotal = Math.max(0, grossSubtotal - orderDiscountAmount);

  // Discount factor applied across line items for GST calculation
  const discountFactor = grossSubtotal > 0 ? (netSubtotal / grossSubtotal) : 1;

  // Base taxable amount & GST Taxes
  const taxBaseTotal = cart.reduce((sum, c) => {
    const rate = Number(c.taxRate || 0);
    const unitPrice = Number(c.unitPrice || 0);
    const qty = Number(c.quantity || 0);
    const discountedLinePrice = unitPrice * qty * discountFactor;
    const base = rate > 0 ? discountedLinePrice * (100 / (100 + rate)) : discountedLinePrice;
    return sum + base;
  }, 0);

  const taxTotal = cart.reduce((sum, c) => {
    const rate = Number(c.taxRate || 0);
    const unitPrice = Number(c.unitPrice || 0);
    const qty = Number(c.quantity || 0);
    const discountedLinePrice = unitPrice * qty * discountFactor;
    const base = rate > 0 ? discountedLinePrice * (100 / (100 + rate)) : discountedLinePrice;
    return sum + (base * (rate / 100));
  }, 0);

  const unroundedTotal = netSubtotal;
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

  // Default Paid Amount
  const effectivePaid = paidAmountInput !== '' ? Number(paidAmountInput) : (paymentMode === 'CREDIT' ? 0 : grandTotal);
  const balance = Math.max(0, grandTotal - effectivePaid);

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
      const discountedLine = c.unitPrice * c.quantity * discountFactor;
      const base = discountedLine * (100 / (100 + c.taxRate));
      return {
        itemId: c.item.id,
        name: c.item.name,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        discountPercent: c.discountPercent,
        taxRate: c.taxRate,
        taxAmount: Number((base * (c.taxRate / 100)).toFixed(2)),
        total: Number((c.unitPrice * c.quantity).toFixed(2)),
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
      discountTotal: orderDiscountAmount,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0, overflow: 'hidden' }}>
          
          {/* Top Search & Category Filter Bar */}
          <div className="card" style={{ padding: '12px 16px', position: 'relative', zIndex: 5, flexShrink: 0 }}>
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
              <div style={{ position: 'relative', flexShrink: 0 }} ref={categoryDropdownRef}>
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
                      zIndex: 1000,
                      width: 280,
                      backgroundColor: '#ffffff',
                      borderRadius: 'var(--radius-lg, 8px)',
                      border: '1px solid var(--neutral-200)',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.06)',
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
          <div className="item-catalog-grid" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
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
          <div className="card-header" style={{ padding: '12px 14px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={17} color="var(--primary-500)" />
              <span className="card-title" style={{ fontSize: '0.92rem' }}>
                Cart ({cart.reduce((s, c) => s + (c.quantity || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} {cart.length === 1 ? 'item' : 'items'})
              </span>
            </div>
            {cart.length > 0 && (
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                onClick={() => {
                  updateCart([]);
                  setQtyInputMap({});
                }}
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Items List with Independent Scroll */}
          <div className="pos-cart-items" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '10px 12px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      {/* Left: Unit Cost & Fraction Part Below It */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                            ₹{line.unitPrice.toFixed(2)} / {line.item.unit || 'unit'}
                          </span>
                          {line.discountPercent > 0 && (
                            <span style={{
                              fontSize: '0.64rem',
                              padding: '1px 5px',
                              borderRadius: 3,
                              backgroundColor: '#ecfdf5',
                              color: '#059669',
                              fontWeight: 700,
                              border: '1px solid #a7f3d0'
                            }}>
                              {line.discountPercent}% OFF
                            </span>
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

                      {/* Right: Cost (Below Quantity Stepper) & Delete Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
                          ₹{line.lineTotal.toFixed(2)}
                        </span>
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
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Bottom: Calculations & Proceed to Billing Action */}
          {cart.length > 0 && (
            <div style={{ padding: 12, borderTop: '1px solid var(--surface-border)', backgroundColor: '#ffffff', flexShrink: 0 }}>
              
              {/* Calculations Box */}
              <div style={{ backgroundColor: 'var(--neutral-50)', padding: 8, borderRadius: 6, marginBottom: 10, border: '1px solid var(--neutral-200)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--neutral-600)' }}>
                  <span>Gross Subtotal:</span>
                  <span>₹{grossSubtotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  <span>Est. GST Taxes:</span>
                  <span>₹{taxTotal.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.02rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 4, borderTop: '1px solid var(--neutral-200)', paddingTop: 4 }}>
                  <span>Est. Total:</span>
                  <span style={{ color: 'var(--primary-600)' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Proceed to Bill Generation Button */}
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '11px', fontSize: '0.92rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={handleOpenCheckoutModal}
              >
                <span>Proceed to Bill (₹{grandTotal.toFixed(2)})</span>
                <ArrowRight size={16} />
              </button>
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
                  <span>Taxable Subtotal & GST:</span>
                  <span>₹{taxBaseTotal.toFixed(2)} + ₹{taxTotal.toFixed(2)}</span>
                </div>
                {orderDiscountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--success-700)', fontWeight: 600, marginTop: 2 }}>
                    <span>Order Discount ({orderDiscountType === 'PERCENT' ? `${parsedDiscountVal}%` : `₹${parsedDiscountVal}`}):</span>
                    <span>-₹{orderDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
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

      <WebcamScannerModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onScanSuccess={handleGlobalBarcodeScan}
      />
    </div>
  );
};
