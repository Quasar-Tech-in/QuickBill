import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  QrCode, 
  Edit, 
  Trash2, 
  SlidersHorizontal, 
  X,
  AlertCircle
} from 'lucide-react';
import { Item } from '../types';
import { store } from '../services/store';
import { StatusBadge } from '../components/StatusBadge';
import { QRModal } from '../components/QRModal';

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<Item[]>(store.getItems());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // Modals
  const [selectedItemForQR, setSelectedItemForQR] = useState<Item | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<Item | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<'ADD' | 'REDUCE'>('ADD');

  // New Item Form State
  const [newItem, setNewItem] = useState<Omit<Item, 'id' | 'publicItemId'>>({
    name: '',
    sku: '',
    category: 'Grocery',
    salePrice: 100,
    purchasePrice: 80,
    taxRate: 5,
    unit: 'pcs',
    currentStock: 20,
    minStockAlert: 5,
  });

  const refreshItems = () => {
    setItems(store.getItems());
  };

  const categories = ['ALL', ...Array.from(new Set(items.map(i => i.category)))];

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.publicItemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    store.addItem(newItem);
    refreshItems();
    setIsAddModalOpen(false);
    setNewItem({
      name: '',
      sku: '',
      category: 'Grocery',
      salePrice: 100,
      purchasePrice: 80,
      taxRate: 5,
      unit: 'pcs',
      currentStock: 20,
      minStockAlert: 5,
    });
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;
    const delta = adjustType === 'ADD' ? Math.abs(adjustDelta) : -Math.abs(adjustDelta);
    store.adjustStock(selectedItemForAdjust.id, delta);
    refreshItems();
    setIsAdjustModalOpen(false);
    setSelectedItemForAdjust(null);
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      store.deleteItem(id);
      refreshItems();
    }
  };

  return (
    <div className="page-container">
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Inventory & Stock Master
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Manage catalog items, track real-time stock levels, and generate QR scanning barcodes.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} />
          <span>+ Add New Product</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search by item name, SKU, or public ID..."
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? 'var(--primary-500)' : 'var(--neutral-200)',
                  backgroundColor: selectedCategory === cat ? 'var(--primary-50)' : '#ffffff',
                  color: selectedCategory === cat ? 'var(--primary-700)' : 'var(--neutral-600)',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Sale Price</th>
                <th>Purchase</th>
                <th>Tax %</th>
                <th>Stock Level</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const stockStatus = 
                  item.currentStock === 0 ? 'OUT_OF_STOCK' : (item.currentStock <= item.minStockAlert ? 'LOW_STOCK' : 'IN_STOCK');
                return (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.8rem' }}>
                      {item.publicItemId}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{item.name}</div>
                      {item.sku && <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>SKU: {item.sku}</span>}
                    </td>
                    <td>
                      <span style={{ backgroundColor: 'var(--neutral-100)', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--primary-600)' }}>
                      ₹{item.salePrice.toFixed(2)}
                    </td>
                    <td style={{ color: 'var(--neutral-600)' }}>
                      ₹{item.purchasePrice.toFixed(2)}
                    </td>
                    <td>{item.taxRate}%</td>
                    <td>
                      <span style={{ fontWeight: 700, color: stockStatus === 'OUT_OF_STOCK' ? 'var(--danger-600)' : 'var(--neutral-900)' }}>
                        {item.currentStock} {item.unit}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginLeft: 4 }}>
                        (Min: {item.minStockAlert})
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={stockStatus} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="Generate QR Barcode"
                          onClick={() => setSelectedItemForQR(item)}
                        >
                          <QrCode size={15} color="var(--primary-600)" />
                        </button>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="Adjust Stock Quantity"
                          onClick={() => {
                            setSelectedItemForAdjust(item);
                            setIsAdjustModalOpen(true);
                          }}
                        >
                          <SlidersHorizontal size={15} />
                        </button>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          title="Delete Item"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          style={{ color: 'var(--danger-500)' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Modal */}
      {selectedItemForQR && (
        <QRModal item={selectedItemForQR} onClose={() => setSelectedItemForQR(null)} />
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="card-title">Add New Product</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Register a new item in your inventory catalog</p>
                </div>
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAddModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateItem} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Section 1: Basic Information */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      1. General Details
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Product / Item Name *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Basmati Rice (1kg Pack)"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      autoFocus
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Grocery, Electronics, Snacks"
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">SKU / Item Barcode</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. RICE-001 or 890123456789"
                        value={newItem.sku}
                        onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Pricing & Tax */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      2. Pricing & GST
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Selling Price (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="form-input"
                        placeholder="0.00"
                        value={newItem.salePrice}
                        onChange={(e) => setNewItem({ ...newItem, salePrice: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Purchase Price (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0.00"
                        value={newItem.purchasePrice}
                        onChange={(e) => setNewItem({ ...newItem, purchasePrice: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">GST Tax Rate (%)</label>
                    <select
                      className="form-select"
                      value={newItem.taxRate}
                      onChange={(e) => setNewItem({ ...newItem, taxRate: Number(e.target.value) })}
                    >
                      <option value={0}>0% (Exempt / Nil Rated)</option>
                      <option value={5}>5% GST (Standard Essentials)</option>
                      <option value={12}>12% GST (Processed Foods / Apparel)</option>
                      <option value={18}>18% GST (Standard Commercial Goods)</option>
                      <option value={28}>28% GST (Luxury / High Slab)</option>
                    </select>
                  </div>
                </div>

                {/* Section 3: Stock & Inventory Tracking */}
                <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      3. Stock & Units
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Unit of Measurement</label>
                      <select
                        className="form-select"
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      >
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="ltr">Liter (ltr)</option>
                        <option value="box">Box (box)</option>
                        <option value="pkt">Packet (pkt)</option>
                        <option value="gm">Gram (gm)</option>
                        <option value="meter">Meter (m)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Initial Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        placeholder="0"
                        value={newItem.currentStock}
                        onChange={(e) => setNewItem({ ...newItem, currentStock: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="e.g. 5"
                      value={newItem.minStockAlert}
                      onChange={(e) => setNewItem({ ...newItem, minStockAlert: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', marginTop: 2 }}>
                      Triggers a restock alert when quantity drops to or below this level
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '9px 24px' }}>
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedItemForAdjust && (
        <div className="modal-overlay" onClick={() => setIsAdjustModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-header">
              <span className="card-title">Adjust Stock Level</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAdjustModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleStockAdjustment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ backgroundColor: 'var(--neutral-50)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--neutral-900)' }}>
                    {selectedItemForAdjust.name}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                    Current Stock: <strong style={{ color: 'var(--primary-600)' }}>{selectedItemForAdjust.currentStock} {selectedItemForAdjust.unit}</strong>
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid',
                      borderColor: adjustType === 'ADD' ? 'var(--success-500)' : 'var(--neutral-200)',
                      backgroundColor: adjustType === 'ADD' ? 'var(--success-50)' : '#ffffff',
                      color: adjustType === 'ADD' ? 'var(--success-700)' : 'var(--neutral-600)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    + Add Stock (In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('REDUCE')}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid',
                      borderColor: adjustType === 'REDUCE' ? 'var(--danger-500)' : 'var(--neutral-200)',
                      backgroundColor: adjustType === 'REDUCE' ? 'var(--danger-50)' : '#ffffff',
                      color: adjustType === 'REDUCE' ? 'var(--danger-700)' : 'var(--neutral-600)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    - Reduce Stock (Out)
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity to Adjust ({selectedItemForAdjust.unit})</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Stock Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
