import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  CreditCard, 
  CheckCircle, 
  ShoppingBag, 
  QrCode, 
  Plus, 
  Minus,
  Sparkles,
  Printer
} from 'lucide-react';
import { Item, Party, CartItem, Invoice } from '../types';
import { store } from '../services/store';

interface PosBillingViewProps {
  onInvoiceCreated: (invoice: Invoice) => void;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({ onInvoiceCreated }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [notes, setNotes] = useState('');

  const items = store.getItems();
  const parties = store.getParties().filter(p => p.type === 'CUSTOMER');

  // Categories list
  const categories = ['ALL', ...Array.from(new Set(items.map(i => i.category)))];

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.publicItemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Add Item to Cart
  const handleAddToCart = (item: Item) => {
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(c => c.item.id === item.id);
      if (existingIdx >= 0) {
        const nextCart = [...prevCart];
        const newQty = nextCart[existingIdx].quantity + 1;
        const lineTotal = newQty * item.salePrice;
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
            discountPercent: 0,
            taxRate: item.taxRate,
            lineTotal: item.salePrice,
          },
        ];
      }
    });
  };

  // Adjust Qty
  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((c) => {
          if (c.item.id === itemId) {
            const nextQty = c.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...c,
              quantity: nextQty,
              lineTotal: nextQty * c.unitPrice,
            };
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove Item
  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, c) => sum + (c.unitPrice * c.quantity * (100 / (100 + c.taxRate))), 0);
  const taxTotal = cart.reduce((sum, c) => {
    const base = c.unitPrice * c.quantity * (100 / (100 + c.taxRate));
    return sum + (base * (c.taxRate / 100));
  }, 0);
  const unroundedTotal = subtotal + taxTotal;
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

  // Default Paid Amount
  const effectivePaid = paidAmountInput !== '' ? Number(paidAmountInput) : (paymentMode === 'CREDIT' ? 0 : grandTotal);
  const balance = Math.max(0, grandTotal - effectivePaid);

  // Complete Sale
  const handleCheckout = () => {
    if (cart.length === 0) return;

    const selectedParty = parties.find(p => p.id === selectedPartyId);
    const partyName = selectedParty ? selectedParty.name : 'Walk-in Retail Customer';

    const invoiceLines = cart.map(c => {
      const base = c.unitPrice * c.quantity * (100 / (100 + c.taxRate));
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

    const created = store.createInvoice({
      date: new Date().toISOString().split('T')[0],
      partyId: selectedParty?.id,
      partyName,
      type: 'SALE',
      items: invoiceLines,
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      discountTotal: 0,
      roundOff,
      grandTotal,
      paidAmount: effectivePaid,
      balanceAmount: balance,
      paymentMode,
      status,
      notes,
    });

    // Reset Cart
    setCart([]);
    setPaidAmountInput('');
    setNotes('');

    // Open print preview modal
    onInvoiceCreated(created);
  };

  return (
    <div className="page-container" style={{ paddingBottom: 16 }}>
      <div className="pos-layout">
        {/* Left Column: Product Catalog & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search Bar & Category Filter */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
                <input
                  type="text"
                  placeholder="Scan QR barcode, or search item name / SKU..."
                  className="form-input"
                  style={{ paddingLeft: 38, width: '100%' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Category Chips */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: selectedCategory === cat ? 'var(--primary-500)' : 'var(--neutral-200)',
                    backgroundColor: selectedCategory === cat ? 'var(--primary-50)' : '#ffffff',
                    color: selectedCategory === cat ? 'var(--primary-700)' : 'var(--neutral-600)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Grid */}
          <div className="item-catalog-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className="pos-item-card" onClick={() => handleAddToCart(item)}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                      {item.publicItemId}
                    </span>
                    <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--neutral-100)', padding: '2px 6px', borderRadius: 4, color: 'var(--neutral-600)' }}>
                      GST {item.taxRate}%
                    </span>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-900)', lineHeight: 1.3 }}>
                    {item.name}
                  </p>
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                    ₹{item.salePrice.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: item.currentStock <= item.minStockAlert ? 'var(--danger-500)' : 'var(--neutral-400)', fontWeight: 600 }}>
                    Stock: {item.currentStock} {item.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Active Cart & Checkout Panel */}
        <div className="pos-cart-panel">
          {/* Cart Header */}
          <div className="card-header" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={18} color="var(--primary-500)" />
              <span className="card-title">Cart ({cart.reduce((s, c) => s + c.quantity, 0)} items)</span>
            </div>
            {cart.length > 0 && (
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => setCart([])}
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--neutral-400)', padding: 20 }}>
                <ShoppingBag size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Cart is empty</p>
                <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Click products or scan QR codes to add to bill</p>
              </div>
            ) : (
              cart.map((line) => (
                <div key={line.item.id} className="pos-cart-row">
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--neutral-900)' }}>{line.item.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                      ₹{line.unitPrice.toFixed(2)} × {line.quantity}
                    </p>
                  </div>

                  {/* Quantity Controller */}
                  <div className="qty-pill">
                    <button className="qty-btn" onClick={() => handleUpdateQty(line.item.id, -1)}>
                      <Minus size={12} />
                    </button>
                    <span className="qty-num">{line.quantity}</span>
                    <button className="qty-btn" onClick={() => handleUpdateQty(line.item.id, 1)}>
                      <Plus size={12} />
                    </button>
                  </div>

                  <div style={{ width: 70, textAlign: 'right', fontWeight: 700, fontSize: '0.88rem' }}>
                    ₹{line.lineTotal.toFixed(2)}
                  </div>

                  <button 
                    onClick={() => handleRemoveFromCart(line.item.id)} 
                    style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', paddingLeft: 6 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Checkout Configuration & Summary */}
          {cart.length > 0 && (
            <div style={{ padding: 16, borderTop: '1px solid var(--surface-border)', backgroundColor: '#ffffff' }}>
              {/* Customer Selection */}
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Customer / Party</label>
                <select 
                  className="form-select"
                  value={selectedPartyId} 
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                >
                  <option value="">Walk-in Retail Customer</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.currentBalance > 0 ? `(Bal: ₹${p.currentBalance})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.75rem',
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

              {/* Calculations Box */}
              <div style={{ backgroundColor: 'var(--neutral-50)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--neutral-600)' }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--neutral-600)', marginTop: 2 }}>
                  <span>GST Taxes:</span>
                  <span>₹{taxTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 6, borderTop: '1px solid var(--neutral-200)', paddingTop: 6 }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--primary-600)' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 700 }}
                onClick={handleCheckout}
              >
                <CheckCircle size={18} />
                <span>Complete & Print Bill (₹{grandTotal.toFixed(2)})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
