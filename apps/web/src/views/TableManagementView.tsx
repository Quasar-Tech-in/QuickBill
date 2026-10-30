import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Utensils, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  QrCode, 
  Printer, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Coffee, 
  X,
  ExternalLink,
  Users
} from 'lucide-react';
import { store } from '../services/store';
import { CafeTable, TableStatus } from '../types';

export const TableManagementView: React.FC = () => {
  const [tables, setTables] = useState<CafeTable[]>(store.getCafeTables());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('ALL');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<CafeTable | null>(null);
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [tableName, setTableName] = useState('');
  const [capacity, setCapacity] = useState<number>(4);
  const [section, setSection] = useState('Main Dining');
  const [floor, setFloor] = useState<number>(1);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Standee / QR Preview Modal state
  const [previewTable, setPreviewTable] = useState<CafeTable | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const printStandeeRef = useRef<HTMLDivElement>(null);

  const activeTenant = store.getActiveTenant();

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await store.fetchTables();
      setTables(res);
    } catch (err) {
      console.warn('Failed to load tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    const unsub = store.subscribe(() => {
      setTables(store.getCafeTables());
    });
    return unsub;
  }, []);

  // Distinct sections
  const sections = useMemo(() => {
    const s = new Set<string>();
    tables.forEach(t => {
      if (t.section) s.add(t.section);
    });
    return Array.from(s);
  }, [tables]);

  // Next suggested table number
  const nextTableNumber = useMemo(() => {
    if (tables.length === 0) return 1;
    return Math.max(...tables.map(t => Number(t.tableNumber) || 0)) + 1;
  }, [tables]);

  const handleOpenAddModal = () => {
    setEditingTable(null);
    setTableNumber(nextTableNumber);
    setTableName(`Table ${nextTableNumber}`);
    setCapacity(4);
    setSection(sections[0] || 'Main Dining');
    setFloor(1);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: CafeTable) => {
    setEditingTable(t);
    setTableNumber(Number(t.tableNumber) || 1);
    setTableName(t.tableName || t.label || `Table ${t.tableNumber}`);
    setCapacity(t.capacity || t.seatingCapacity || 4);
    setSection(t.section || 'Main Dining');
    setFloor(t.floor || 1);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      setFormError('Table name is required.');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      if (editingTable) {
        await store.updateTable(editingTable.id, {
          tableNumber: String(tableNumber),
          tableName: tableName.trim(),
          label: tableName.trim(),
          capacity: Number(capacity),
          seatingCapacity: Number(capacity),
          section: section.trim(),
          floor: Number(floor),
        });
      } else {
        await store.createTable({
          tableNumber: String(tableNumber),
          tableName: tableName.trim(),
          label: tableName.trim(),
          capacity: Number(capacity),
          seatingCapacity: Number(capacity),
          section: section.trim(),
          floor: Number(floor),
        });
      }
      setIsModalOpen(false);
      await loadTables();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Failed to save table.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTable = async (tableId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await store.deleteTable(tableId);
      await loadTables();
    } catch (err) {
      alert('Failed to delete table.');
    }
  };

  // Generate QR Data URL when previewing standee
  const handleOpenStandee = async (table: CafeTable) => {
    setPreviewTable(table);
    const tenantSlug = activeTenant?.id || 'demo';
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/order/${tenantSlug}/${table.id}?token=${encodeURIComponent(table.qrCodeToken || '')}`;
    
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }
  };

  const handlePrintStandee = () => {
    window.print();
  };

  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      if (selectedSection !== 'ALL' && t.section !== selectedSection) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (t.tableName || t.label || '').toLowerCase().includes(q);
        const matchesNum = String(t.tableNumber).toLowerCase().includes(q);
        const matchesSec = t.section ? t.section.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesNum && !matchesSec) return false;
      }
      return true;
    });
  }, [tables, selectedSection, searchQuery]);

  return (
    <div className="view-container" style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            backgroundColor: 'var(--primary-100, #dbeafe)', 
            color: 'var(--primary-600, #2563eb)',
            width: 40,
            height: 40,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <QrCode size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-900)', margin: 0 }}>
              Table & QR Management
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', margin: '2px 0 0' }}>
              Create dine-in tables, generate encrypted QR codes, and print diner tent cards
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={loadTables}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenAddModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--neutral-200)',
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14
      }}>
        {/* Section Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', marginRight: 4 }}>
            Section:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${selectedSection === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontWeight: 600, padding: '4px 12px', fontSize: '0.8rem' }}
            onClick={() => setSelectedSection('ALL')}
          >
            All ({tables.length})
          </button>
          {sections.map(sec => (
            <button
              key={sec}
              type="button"
              className={`btn btn-sm ${selectedSection === sec ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: 600, padding: '4px 12px', fontSize: '0.8rem' }}
              onClick={() => setSelectedSection(sec)}
            >
              {sec} ({tables.filter(t => t.section === sec).length})
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 220 }}>
          <Search 
            size={14} 
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} 
          />
          <input
            type="text"
            placeholder="Search table or section..."
            className="form-input form-input-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 30, fontSize: '0.8rem', borderRadius: '8px' }}
          />
        </div>
      </div>

      {/* Tables Table / List */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--neutral-200)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)' }}>
              <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase' }}>
                Table No. & Name
              </th>
              <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase' }}>
                Section / Area
              </th>
              <th style={{ padding: '12px 18px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase' }}>
                Capacity
              </th>
              <th style={{ padding: '12px 18px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase' }}>
                Current Status
              </th>
              <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase' }}>
                QR Standee & Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTables.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--neutral-400)' }}>
                  No tables found. Click "Add New Table" to create your first dine-in table.
                </td>
              </tr>
            ) : (
              filteredTables.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--neutral-900)', fontSize: '0.92rem' }}>
                      {t.tableName || t.label || `Table ${t.tableNumber}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                      Table #{t.tableNumber} • Floor {t.floor || 1}
                    </div>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--neutral-100)',
                      color: 'var(--neutral-700)',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      {t.section || 'General'}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--neutral-700)', fontSize: '0.85rem' }}>
                      <Users size={14} color="var(--neutral-500)" />
                      <span>{t.capacity || t.seatingCapacity || 4} Seats</span>
                    </div>
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: t.currentStatus === 'AVAILABLE' ? 'var(--success-50, #f0fdf4)' : 'var(--warning-50, #fffbeb)',
                      color: t.currentStatus === 'AVAILABLE' ? 'var(--success-700, #15803d)' : 'var(--warning-700, #b45309)',
                      border: `1px solid ${t.currentStatus === 'AVAILABLE' ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      {t.currentStatus}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600 }}
                        onClick={() => handleOpenStandee(t)}
                        title="View & Print QR Standee"
                      >
                        <QrCode size={14} color="var(--primary-600)" />
                        <span>QR Standee</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => handleOpenEditModal(t)}
                        title="Edit Table Details"
                      >
                        <Edit3 size={15} color="var(--neutral-600)" />
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => handleDeleteTable(t.id, t.tableName || t.label || `Table ${t.tableNumber}`)}
                        title="Delete Table"
                      >
                        <Trash2 size={15} color="var(--danger-600, #dc2626)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Table Modal */}
      {isModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsModalOpen(false)}
          style={{ zIndex: 1500 }}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--neutral-900)' }}>
                {editingTable ? 'Edit Table Details' : 'Add New Dine-In Table'}
              </h3>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: 16
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveTable} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Table No. *</label>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    value={tableNumber}
                    onChange={e => setTableNumber(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Display Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Table 4 or Window Booth"
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Seating Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="form-input"
                    value={capacity}
                    onChange={e => setCapacity(Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Floor Number</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    value={floor}
                    onChange={e => setFloor(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section / Area</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Main Dining, Patio, Rooftop, Bar"
                  value={section}
                  onChange={e => setSection(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontWeight: 600 }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, fontWeight: 700 }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving Table...' : editingTable ? 'Update Table' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code & Tent Card Standee Preview Modal */}
      {previewTable && (
        <div 
          className="modal-overlay" 
          onClick={() => setPreviewTable(null)}
          style={{ zIndex: 2000 }}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            {/* Modal Controls Bar (hidden during print) */}
            <div className="no-print" style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--neutral-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--neutral-50)'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--neutral-800)' }}>
                Table Standee Tent Card
              </span>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon btn-sm"
                onClick={() => setPreviewTable(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Standee Body (Formatted for 4x6 / A6 Tent Card print) */}
            <div 
              ref={printStandeeRef}
              style={{
                padding: '32px 24px',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Brand Header */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary-600, #2563eb)',
                  color: '#ffffff',
                  marginBottom: 8
                }}>
                  <Coffee size={24} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--neutral-900)', margin: '0 0 2px' }}>
                  {activeTenant?.name || 'QuickBill Café'}
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--neutral-500)', margin: 0 }}>
                  Contactless Dine-In Self Ordering
                </p>
              </div>

              {/* Table Identifier Badge */}
              <div style={{
                display: 'inline-block',
                padding: '6px 18px',
                borderRadius: '20px',
                backgroundColor: 'var(--neutral-900)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                marginBottom: 20
              }}>
                {(previewTable.tableName || previewTable.label || `Table ${previewTable.tableNumber}`).toUpperCase()}
              </div>

              {/* QR Code Container */}
              <div style={{
                padding: 16,
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '2px dashed var(--neutral-300)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                marginBottom: 16
              }}>
                {qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt={`QR Code for ${previewTable.tableName || previewTable.label || 'Table'}`} 
                    style={{ width: 220, height: 220, display: 'block' }}
                  />
                ) : (
                  <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                )}
              </div>

              {/* Call to Action & Instructions */}
              <div style={{ maxWidth: 280 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--neutral-900)', marginBottom: 4 }}>
                  Scan with your phone camera
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', lineHeight: 1.4 }}>
                  View full digital menu, customize your order, and send directly to the barista/kitchen!
                </div>
              </div>

              {/* Security signature note */}
              <div style={{ fontSize: '0.68rem', color: 'var(--neutral-400)', marginTop: 18, borderTop: '1px solid var(--neutral-200)', paddingTop: 10, width: '100%' }}>
                Powered by QuickBill POS • {previewTable.section || 'Dining Area'}
              </div>
            </div>

            {/* Modal Bottom Print Button (hidden during print) */}
            <div className="no-print" style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              gap: 10
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, fontWeight: 600 }}
                onClick={() => setPreviewTable(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={handlePrintStandee}
              >
                <Printer size={16} />
                <span>Print Table Standee</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
