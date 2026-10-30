import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Coffee, 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle, 
  Leaf, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { CustomerCartDrawer, CartLineItem } from './CustomerCartDrawer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const DigitalMenuPage: React.FC = () => {
  const { businessId, tableId } = useParams<{ businessId: string; tableId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [menuData, setMenuData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  // Cart state
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (!businessId || !tableId) {
      setError('Invalid menu URL. Please scan the QR code located on your table.');
      setLoading(false);
      return;
    }

    const fetchMenu = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE_URL}/public/cafe/${businessId}/menu`, {
          params: { token: token || undefined }
        });
        setMenuData(res.data);
      } catch (err: any) {
        setError(
          err.response?.data?.detail || 
          'Unable to load the digital menu. Please check your network or call a staff member.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [businessId, tableId, token]);

  const rawItems: any[] = menuData?.items || [];

  // Extract categories
  const categories: string[] = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [rawItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (dietaryFilter === 'VEG' && item.dietaryFlags?.isVeg !== true && item.isVeg !== true) {
        return false;
      }
      if (dietaryFilter === 'NON_VEG' && (item.dietaryFlags?.isVeg === true || item.isVeg === true)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [rawItems, selectedCategory, dietaryFilter, searchQuery]);

  // Cart management helpers
  const handleAddToCart = (item: any, variantName?: string) => {
    setCartItems(prev => {
      const existingIdx = prev.findIndex(
        c => c.item.id === item.id && c.variantName === variantName
      );
      if (existingIdx !== -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [...prev, { item, quantity: 1, notes: '', variantName }];
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number, variantName?: string) => {
    setCartItems(prev => {
      return prev
        .map(c => {
          if (c.item.id === itemId && c.variantName === variantName) {
            return { ...c, quantity: c.quantity + delta };
          }
          return c;
        })
        .filter(c => c.quantity > 0);
    });
  };

  const handleUpdateNotes = (itemId: string, notes: string, variantName?: string) => {
    setCartItems(prev => {
      return prev.map(c => {
        if (c.item.id === itemId && c.variantName === variantName) {
          return { ...c, notes };
        }
        return c;
      });
    });
  };

  const totalCartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, c) => {
    const price = c.item.salePrice || c.item.unitPrice || 0;
    return sum + price * c.quantity;
  }, 0);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        textAlign: 'center'
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16
        }}>
          <Coffee size={28} />
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
          Loading Digital Menu...
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
          Fetching fresh menu items from the café counter
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        textAlign: 'center'
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16
        }}>
          <AlertCircle size={28} />
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
          Unable to Open Menu
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 20px', maxWidth: 320 }}>
          {error}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          Retry Scan
        </button>
      </div>
    );
  }

  const tenantName = menuData?.tenantName || 'Café & Bistro';
  const tableName = menuData?.tableName || `Table #${menuData?.tableNumber || tableId}`;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: cartItems.length > 0 ? 100 : 40,
    }}>
      {/* Brand Header */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '18px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: 680,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900
            }}>
              <Coffee size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {tenantName}
              </h1>
              <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Contactless Dine-In</span>
                <span>•</span>
                <span style={{
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  padding: '1px 8px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.72rem'
                }}>
                  {tableName}
                </span>
              </div>
            </div>
          </div>

          {/* Cart Icon in Header */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            style={{
              position: 'relative',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1e293b'
            }}
          >
            <ShoppingBag size={20} />
            {totalCartCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 900,
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 20px' }}>
        {/* Search Bar */}
        <div style={{
          position: 'relative',
          marginBottom: 16
        }}>
          <Search 
            size={16} 
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} 
          />
          <input
            type="text"
            placeholder="Search coffee, mains, shakes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 40px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '0.88rem',
              color: '#0f172a',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          />
        </div>

        {/* Dietary Filters: Veg / Non-Veg */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            type="button"
            onClick={() => setDietaryFilter('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: dietaryFilter === 'ALL' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
              backgroundColor: dietaryFilter === 'ALL' ? '#0f172a' : '#ffffff',
              color: dietaryFilter === 'ALL' ? '#ffffff' : '#475569',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            All Items
          </button>

          <button
            type="button"
            onClick={() => setDietaryFilter('VEG')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: dietaryFilter === 'VEG' ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
              backgroundColor: dietaryFilter === 'VEG' ? '#f0fdf4' : '#ffffff',
              color: '#15803d',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a' }} />
            Pure Veg
          </button>

          <button
            type="button"
            onClick={() => setDietaryFilter('NON_VEG')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: dietaryFilter === 'NON_VEG' ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
              backgroundColor: dietaryFilter === 'NON_VEG' ? '#fef2f2' : '#ffffff',
              color: '#b91c1c',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626' }} />
            Non-Veg
          </button>
        </div>

        {/* Category Pills Strip */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedCategory === 'ALL' ? '#2563eb' : '#ffffff',
                color: selectedCategory === 'ALL' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                whiteSpace: 'nowrap'
              }}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: selectedCategory === cat ? '#2563eb' : '#ffffff',
                  color: selectedCategory === cat ? '#ffffff' : '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
            padding: '48px 24px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <Coffee size={40} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>
              No dishes found
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
              Try searching for something else or clear dietary filters.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredItems.map(item => {
              const price = item.salePrice || item.unitPrice || 0;
              const isVeg = item.dietaryFlags?.isVeg ?? item.isVeg ?? true;
              
              // Find matching cart line
              const cartLine = cartItems.find(c => c.item.id === item.id);
              const currentQty = cartLine?.quantity || 0;

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {/* Veg / Non-Veg Icon */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 14,
                        height: 14,
                        border: `1.5px solid ${isVeg ? '#16a34a' : '#dc2626'}`,
                        borderRadius: '3px',
                        padding: 1
                      }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: isVeg ? '#16a34a' : '#dc2626'
                        }} />
                      </span>

                      <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                        {item.name}
                      </div>
                    </div>

                    {item.description && (
                      <p style={{
                        fontSize: '0.78rem',
                        color: '#64748b',
                        margin: '0 0 8px',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {item.description}
                      </p>
                    )}

                    <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a' }}>
                      ₹{Number(price).toFixed(2)}
                    </div>
                  </div>

                  {/* Add / Stepper Button */}
                  <div>
                    {currentQty > 0 ? (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: '#eff6ff',
                        border: '1.5px solid #2563eb',
                        borderRadius: '10px',
                        padding: '4px 10px',
                      }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#2563eb',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 2
                          }}
                        >
                          <Minus size={15} />
                        </button>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e3a8a', minWidth: 16, textAlign: 'center' }}>
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#2563eb',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 2
                          }}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #2563eb',
                          color: '#2563eb',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.12)'
                        }}
                      >
                        <Plus size={15} />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          right: 20,
          maxWidth: 640,
          margin: '0 auto',
          zIndex: 100,
          animation: 'slideUp 0.2s ease',
        }}>
          <div
            onClick={() => setIsCartOpen(true)}
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.35)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                {totalCartCount} {totalCartCount === 1 ? 'Item' : 'Items'} Selected
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900 }}>
                ₹{cartSubtotal.toFixed(2)} <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>+ GST</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.92rem', color: '#60a5fa' }}>
              <span>View Cart & Place Order</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CustomerCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateNotes={handleUpdateNotes}
        onClearCart={() => setCartItems([])}
        businessId={businessId || ''}
        tableId={tableId || ''}
        token={token}
        tableName={tableName}
        onOrderSuccess={() => {}}
      />
    </div>
  );
};

