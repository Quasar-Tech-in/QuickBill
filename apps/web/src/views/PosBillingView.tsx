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
  RotateCw
} from 'lucide-react';
import { Item, Party, CartItem, Invoice, ItemCategory } from '../types';
import { store } from '../services/store';

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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Category Multi-Select Dropdown State (Matching InventoryView)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Cart State (Synchronized with store.posCart)
  const [cart, setCart] = useState<CartItem[]>(store.getPosCart());
  // Map of raw typed input string per item to allow typing "0.", "0.0", "0.01" without React resetting mid-keystroke
  const [qtyInputMap, setQtyInputMap] = useState<Record<string, string>>({});

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
      store.setPosCart(nextCart);
      return nextCart;
    });
  };

  // Checkout Modal State (Post Item Selection)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Retail Customer');
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
  const refreshData = () => {
    const currentLoc = store.getActiveLocation();
    // Strictly retrieve only listed items for this branch
    const branchItems = store.getItems(currentLoc.id, false);
    setItems(branchItems);
    setRawItems(store.getRawItems());
    setCategoriesList(store.getCategories());
    setParties(store.getParties(currentLoc.id).filter(p => p.type === 'CUSTOMER'));
    if (selectedLocationId !== currentLoc.id) {
      setSelectedLocationId(currentLoc.id);
      updateCart([]);
    }
  };

  useEffect(() => {
    refreshData();
    // Fetch live customers and parties from backend MongoDB
    store.fetchParties().then(fetched => {
      setParties(fetched.filter(p => p.type === 'CUSTOMER'));
    }).catch(() => {});

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
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.publicItemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    
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
    // Only query backend if exactly 10 digits are entered
    if (digits.length === 10) {
      const matched = await store.lookupPartyByPhone(digits, activeLocation.id);
      if (matched) {
        setSelectedPartyId(matched.id);
        setCustomerName(matched.name);
        setParties(store.getParties(activeLocation.id).filter(p => p.type === 'CUSTOMER'));
      } else {
        setSelectedPartyId('');
      }
    } else {
      setSelectedPartyId('');
    }
  };

  // Helper to extract best item image URL
  const getItemImage = (item: Item): string | undefined => {
    return item.imageUrl || item.images?.find(img => img.isPrimary)?.url || item.images?.[0]?.url;
  };

  // Add Item to Cart
  const handleAddToCart = (item: Item) => {
    let itemDiscountPercent = 0;
    if (item.hasDiscount && item.discountValue && item.discountValue > 0) {
      if (item.discountType === 'PERCENT') {
        itemDiscountPercent = item.discountValue;
      } else if (item.mrp && item.mrp > 0) {
        itemDiscountPercent = Number(((item.discountValue / item.mrp) * 100).toFixed(1));
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
        const newQty = item.allowParts
          ? Number((nextCart[existingIdx].quantity + 1).toFixed(3))
          : nextCart[existingIdx].quantity + 1;
        const lineTotal = Number((newQty * item.salePrice).toFixed(2));
        nextCart[existingIdx] = {
          ...nextCart[existingIdx],
          quantity: newQty,
          lineTotal,
        };
        return nextCart;
      } else {
        return [
          ...prevCart,
          {
            item,
            quantity: 1,
            unitPrice: item.salePrice,
            discountPercent: itemDiscountPercent,
            taxRate: item.taxRate,
            lineTotal: Number((1 * item.salePrice).toFixed(2)),
            allowParts: item.allowParts,
          },
        ];
      }
    });
  };

  // Adjust Qty by step
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
            const nextQty = c.item.allowParts
              ? Number((c.quantity + delta).toFixed(3))
              : (c.quantity + delta);
            if (nextQty <= 0) return null;
            return {
              ...c,
              quantity: nextQty,
              lineTotal: Number((nextQty * c.unitPrice).toFixed(2)),
            };
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Set Qty directly (manual input with exact typing preservation for 0.01 etc.)
  const handleSetQty = (itemId: string, rawVal: string) => {
    // Only allow digits and at most one decimal point
    if (rawVal !== '' && !/^\d*\.?\d*$/.test(rawVal)) {
      return;
    }

    setQtyInputMap((prev) => ({ ...prev, [itemId]: rawVal }));

    if (rawVal === '' || rawVal === '.' || rawVal.endsWith('.')) {
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

    const targetItem = cart.find(c => c.item.id === itemId)?.item;
    const isAllowParts = !!targetItem?.allowParts;
    const val = isAllowParts ? parseFloat(rawVal) : parseInt(rawVal, 10);
    if (isNaN(val) || val < 0) return;

    updateCart((prevCart) =>
      prevCart.map((c) => {
        if (c.item.id === itemId) {
          const maxAvailable = c.item.currentStock > 0 ? c.item.currentStock : 99999;
          const newQty = c.item.allowParts
            ? Math.min(val, maxAvailable)
            : Math.max(1, Math.min(val, maxAvailable));
          return {
            ...c,
            quantity: newQty,
            lineTotal: Number((newQty * c.unitPrice).toFixed(2)),
          };
        }
        return c;
      })
    );
  };

  // Handle onBlur for manual quantity input
  const handleBlurQty = (itemId: string) => {
    const rawVal = qtyInputMap[itemId];
    setQtyInputMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    if (rawVal !== undefined) {
      const val = parseFloat(rawVal);
      if (isNaN(val) || val <= 0) {
        updateCart((prevCart) =>
          prevCart.map((c) =>
            c.item.id === itemId
              ? { ...c, quantity: 1, lineTotal: 1 * c.unitPrice }
              : c
          )
        );
      }
    }
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
  const grossSubtotal = cart.reduce((sum, c) => sum + (c.unitPrice * c.quantity), 0);
  
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
    const discountedLinePrice = c.unitPrice * c.quantity * discountFactor;
    const base = discountedLinePrice * (100 / (100 + c.taxRate));
    return sum + base;
  }, 0);

  const taxTotal = cart.reduce((sum, c) => {
    const discountedLinePrice = c.unitPrice * c.quantity * discountFactor;
    const base = discountedLinePrice * (100 / (100 + c.taxRate));
    return sum + (base * (c.taxRate / 100));
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
      } else if (trimmedName && trimmedName.toLowerCase() !== 'walk-in retail customer') {
        // 3. New Customer -> Auto-register in dedicated MongoDB customers table
        const newParty = await store.createCustomer({
          name: trimmedName,
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

    const status: 'PAID' | 'PARTIAL' | 'UNPAID' = 
      effectivePaid >= grandTotal ? 'PAID' : (effectivePaid > 0 ? 'PARTIAL' : 'UNPAID');

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
      type: 'SALE',
      items: invoiceLines,
      subtotal: Number(taxBaseTotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      discountTotal: orderDiscountAmount,
      discountType: orderDiscountType,
      discountValue: parsedDiscountVal,
      roundOff,
      grandTotal,
      paidAmount: effectivePaid,
      balanceAmount: balance,
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
    setCustomerName('Walk-in Retail Customer');
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
                onClick={refreshData}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--neutral-100)',
                  border: '1px solid var(--neutral-300)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--neutral-700)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Refresh product list and real-time stock levels"
              >
                <RotateCw size={12} />
                <span>Refresh Stocks</span>
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
                        .filter(cat => cat.toLowerCase().includes(dropdownSearch.toLowerCase()))
                        .map(cat => {
                          const isChecked = selectedCategories.includes(cat);
                          const count = items.filter(i => i.category.toLowerCase() === cat.toLowerCase()).length;
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
                      height: 188,
                      minHeight: 188,
                      maxHeight: 188,
                      boxSizing: 'border-box',
                      opacity: isOutOfStock ? 0.7 : 1,
                      border: isOutOfStock ? '1px dashed var(--danger-300)' : '1px solid var(--neutral-200)',
                    }}
                  >
                    {/* Card Top: Image + Header Info (Fixed Height Segment) */}
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                        {/* 48x48 Product Image Thumbnail */}
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          backgroundColor: 'var(--neutral-100)',
                          border: '1px solid var(--neutral-200)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package size={20} color="var(--neutral-400)" />
                          )}
                        </div>

                        {/* Public ID & Tax */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--neutral-500)', fontWeight: 600 }}>
                              {item.publicItemId}
                            </span>
                            <span style={{ fontSize: '0.64rem', backgroundColor: 'var(--neutral-100)', padding: '1px 4px', borderRadius: 4, color: 'var(--neutral-600)', fontWeight: 600 }}>
                              GST {item.taxRate}%
                            </span>
                          </div>
                          {/* Title with exact 2-line clamp height */}
                          <p style={{
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            color: 'var(--neutral-900)',
                            lineHeight: '1.2em',
                            height: '2.4em',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {item.name}
                          </p>
                        </div>
                      </div>

                      {/* Category & Parts Tag (Single Line) */}
                      <div style={{ height: 18, overflow: 'hidden', display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.66rem',
                          color: 'var(--neutral-500)',
                          backgroundColor: 'var(--neutral-50)',
                          border: '1px solid var(--neutral-200)',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontWeight: 500,
                          display: 'inline-block',
                          maxWidth: '70%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {item.category}
                        </span>
                        {item.allowParts && (
                          <span style={{
                            fontSize: '0.62rem',
                            color: 'var(--primary-700)',
                            backgroundColor: 'var(--primary-50)',
                            border: '1px solid var(--primary-200)',
                            padding: '1px 4px',
                            borderRadius: 4,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            ⚖️ Loose / Parts
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom: Pricing, Stock Alert & Add Trigger (Fixed Height Segment) */}
                    <div style={{ paddingTop: 6, borderTop: '1px solid var(--neutral-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                            ₹{item.salePrice.toFixed(2)}
                          </span>
                          {item.hasDiscount && item.discountValue && item.discountValue > 0 && (
                            <del style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>
                              ₹{(item.mrp || item.salePrice).toFixed(2)}
                            </del>
                          )}
                        </div>

                        {/* Stock Status Badge */}
                        <div style={{ marginTop: 2, height: 16 }}>
                          {isOutOfStock ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--danger-600)', fontWeight: 700, backgroundColor: 'var(--danger-50)', padding: '0 4px', borderRadius: 3 }}>
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--warning-700)', fontWeight: 700, backgroundColor: 'var(--warning-50)', padding: '0 4px', borderRadius: 3 }}>
                              Low: {item.currentStock} {item.unit}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', fontWeight: 600 }}>
                              Stock: {item.currentStock} {item.unit}
                            </span>
                          )}
                        </div>
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
                          borderRadius: 6,
                          backgroundColor: 'var(--primary-50)',
                          border: '1px solid var(--primary-300)',
                          color: 'var(--primary-700)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}
                        title="Add to Bill"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                      </button>
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
          <div className="pos-cart-items" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--neutral-400)', padding: 20 }}>
                <ShoppingBag size={34} style={{ margin: '0 auto 6px', opacity: 0.35 }} />
                <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-600)', margin: 0 }}>Cart is empty</p>
                <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Select products or scan barcodes to begin billing</p>
              </div>
            ) : (
              cart.map((line) => {
                return (
                  <div 
                    key={line.item.id} 
                    className="pos-cart-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderBottom: '1px solid var(--neutral-100)',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {/* Full Item Name & Unit Price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--neutral-900)', margin: 0, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                          {line.item.name}
                        </p>
                        {line.item.allowParts && (
                          <span style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: 3, backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontWeight: 700, border: '1px solid var(--primary-200)' }}>
                            ⚖️ {line.item.unit}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', margin: '2px 0 0 0' }}>
                        ₹{line.unitPrice.toFixed(2)} / {line.item.unit || 'unit'}
                        {line.discountPercent > 0 && (
                          <span style={{ color: 'var(--success-700)', fontWeight: 700, marginLeft: 4 }}>
                            ({line.discountPercent}% off)
                          </span>
                        )}
                      </p>
                      {line.item.allowParts && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--neutral-400)', fontWeight: 600 }}>+Quick:</span>
                          {['0.25', '0.5', '1'].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleUpdateQty(line.item.id, Number(preset))}
                              style={{
                                fontSize: '0.64rem',
                                padding: '1px 5px',
                                borderRadius: 3,
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                              title={`Add +${preset} ${line.item.unit}`}
                            >
                              +{preset}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Perfectly Centered Manual Editable Quantity Stepper */}
                    <div 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        border: '1px solid var(--neutral-300)', 
                        borderRadius: 'var(--radius-sm, 6px)', 
                        backgroundColor: 'var(--neutral-50)',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      <button 
                        type="button"
                        onClick={() => handleUpdateQty(line.item.id, line.item.allowParts ? -0.5 : -1)} 
                        aria-label="Decrease quantity"
                        style={{
                          width: 24,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          color: 'var(--neutral-700)',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title={line.item.allowParts ? "Reduce by 0.5" : "Reduce by 1"}
                      >
                        <Minus size={12} />
                      </button>
                      <input 
                        type="text"
                        inputMode="decimal"
                        value={qtyInputMap[line.item.id] !== undefined ? qtyInputMap[line.item.id] : String(line.quantity)}
                        onChange={(e) => handleSetQty(line.item.id, e.target.value)}
                        onBlur={() => handleBlurQty(line.item.id)}
                        className="cart-qty-input"
                        style={{ width: line.item.allowParts ? 58 : 40, fontSize: '0.82rem' }}
                        aria-label="Quantity"
                        placeholder="0"
                      />
                      <button 
                        type="button"
                        onClick={() => handleUpdateQty(line.item.id, line.item.allowParts ? 0.5 : 1)} 
                        aria-label="Increase quantity"
                        style={{
                          width: 24,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          color: 'var(--neutral-700)',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title={line.item.allowParts ? "Add 0.5" : "Add 1"}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div style={{ width: 72, textAlign: 'right', fontWeight: 800, fontSize: '0.86rem', color: 'var(--neutral-900)', flexShrink: 0 }}>
                      ₹{line.lineTotal.toFixed(2)}
                    </div>

                    {/* Remove Action */}
                    <button 
                      type="button"
                      onClick={() => handleRemoveFromCart(line.item.id)} 
                      style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: '3px 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
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
                      {selectedParty.currentBalance !== 0 && (
                        <span style={{ fontSize: '0.72rem', color: selectedParty.currentBalance > 0 ? 'var(--danger-700)' : 'var(--success-700)', fontWeight: 700 }}>
                          Bal: ₹{selectedParty.currentBalance.toFixed(2)}
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
    </div>
  );
};
