import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Edit3, 
  Trash2, 
  X, 
  Building, 
  UserCheck, 
  TrendingUp, 
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { Party } from '../types';
import { store } from '../services/store';

export const PartiesView: React.FC = () => {
  const currentUser = store.getCurrentUser();
  const isCashier = currentUser?.role === 'CASHIER';
  const locations = store.getAllLocations();

  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [parties, setParties] = useState<Party[]>(store.getParties());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>(isCashier ? 'CUSTOMER' : 'ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  // Add Form State
  const [newParty, setNewParty] = useState<{
    name: string;
    type: 'CUSTOMER' | 'SUPPLIER';
    phone: string;
    email: string;
    gstin: string;
    address: string;
    locationIds: string[];
  }>({
    name: '',
    type: isCashier ? 'CUSTOMER' : 'CUSTOMER',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    locationIds: [],
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    type: 'CUSTOMER' | 'SUPPLIER';
    phone: string;
    email: string;
    gstin: string;
    address: string;
    locationIds: string[];
  }>({
    id: '',
    name: '',
    type: 'CUSTOMER',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    locationIds: [],
  });

  const [isSaving, setIsSaving] = useState(false);

  const refreshData = () => {
    setParties(store.getParties(selectedLocationId === 'ALL' ? undefined : selectedLocationId));
  };

  useEffect(() => {
    refreshData();
    store.fetchParties(selectedLocationId === 'ALL' ? undefined : selectedLocationId)
      .then(fetched => setParties(fetched))
      .catch(() => {});
  }, [selectedLocationId]);

  // Summary Metrics
  const allCurrentParties = store.getParties(selectedLocationId === 'ALL' ? undefined : selectedLocationId);
  const totalCustomers = allCurrentParties.filter(p => p.type === 'CUSTOMER').length;
  const totalSuppliers = allCurrentParties.filter(p => p.type === 'SUPPLIER').length;
  const totalReceivables = allCurrentParties
    .filter(p => p.currentBalance > 0)
    .reduce((sum, p) => sum + p.currentBalance, 0);
  const totalPayables = allCurrentParties
    .filter(p => p.currentBalance < 0)
    .reduce((sum, p) => sum + Math.abs(p.currentBalance), 0);

  const filteredParties = parties.filter(p => {
    if (isCashier && p.type !== 'CUSTOMER') return false;
    
    // Branch Filter
    if (selectedLocationId !== 'ALL') {
      const matchLoc = !p.locationIds || p.locationIds.length === 0 || p.locationIds.includes(selectedLocationId) || p.locationId === selectedLocationId;
      if (!matchLoc) return false;
    }

    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery)) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'ALL' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParty.name.trim()) return;

    setIsSaving(true);
    try {
      const payload = {
        name: newParty.name.trim(),
        type: newParty.type,
        phone: newParty.phone.trim() || undefined,
        email: newParty.email.trim() || undefined,
        gstin: newParty.gstin.trim() || undefined,
        address: newParty.address.trim() || undefined,
        locationIds: newParty.locationIds.length > 0 ? newParty.locationIds : undefined,
      };

      if (newParty.type === 'CUSTOMER') {
        await store.createCustomer(payload);
      } else {
        store.addParty(payload);
      }

      refreshData();
      setIsAddModalOpen(false);
      setNewParty({
        name: '',
        type: isCashier ? 'CUSTOMER' : 'CUSTOMER',
        phone: '',
        email: '',
        gstin: '',
        address: '',
        locationIds: [],
      });
    } catch (err) {
      console.error('Error creating profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setEditForm({
      id: party.id,
      name: party.name,
      type: party.type,
      phone: party.phone || '',
      email: party.email || '',
      gstin: party.gstin || '',
      address: party.address || '',
      locationIds: party.locationIds || [],
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.id) return;

    setIsSaving(true);
    try {
      await store.updateParty(editForm.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        gstin: editForm.gstin.trim() || undefined,
        address: editForm.address.trim() || undefined,
        locationIds: editForm.locationIds.length > 0 ? editForm.locationIds : undefined,
      });

      refreshData();
      setIsEditModalOpen(false);
      setEditingParty(null);
    } catch (err) {
      console.error('Error updating party profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteParty = async (party: Party) => {
    const isConfirmed = window.confirm(`Are you sure you want to delete ${party.name} (${party.type})? This action cannot be undone.`);
    if (!isConfirmed) return;

    await store.deleteParty(party.id, party.type);
    refreshData();
  };

  const toggleLocationSelect = (locId: string, isEdit: boolean) => {
    if (isEdit) {
      const current = editForm.locationIds;
      if (current.includes(locId)) {
        setEditForm({ ...editForm, locationIds: current.filter(id => id !== locId) });
      } else {
        setEditForm({ ...editForm, locationIds: [...current, locId] });
      }
    } else {
      const current = newParty.locationIds;
      if (current.includes(locId)) {
        setNewParty({ ...newParty, locationIds: current.filter(id => id !== locId) });
      } else {
        setNewParty({ ...newParty, locationIds: [...current, locId] });
      }
    }
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            {isCashier ? 'Customer Directory' : 'Parties & Contact Profiles'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            {isCashier 
              ? 'Manage registered customer profiles, contact numbers, and branch permissions.' 
              : 'Directory of all Customers and Suppliers. Add, view, and update profile details.'}
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <UserPlus size={16} />
          <span>{isCashier ? 'Add Customer Profile' : 'Add New Profile'}</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase' }}>Customers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--neutral-900)' }}>{totalCustomers}</div>
          </div>
        </div>

        {!isCashier && (
          <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--warning-50)', color: 'var(--warning-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase' }}>Suppliers / Vendors</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--neutral-900)' }}>{totalSuppliers}</div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase' }}>Total Receivables</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>₹{totalReceivables.toFixed(2)}</div>
          </div>
        </div>

        {!isCashier && (
          <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600, textTransform: 'uppercase' }}>Total Payables</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>₹{totalPayables.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder={isCashier ? 'Search customer by name, phone, email...' : 'Search by profile name, phone, GSTIN, email...'}
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={15} color="var(--primary-600)" />
              <select
                className="form-select"
                style={{ padding: '5px 10px', fontSize: '0.82rem', width: 'auto' }}
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                <option value="ALL">🌐 All Branch Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            {!isCashier && (
              <div style={{ display: 'flex', gap: 6 }}>
                {(['ALL', 'CUSTOMER', 'SUPPLIER'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: filterType === t ? 'var(--primary-500)' : 'var(--neutral-200)',
                      backgroundColor: filterType === t ? 'var(--primary-50)' : '#ffffff',
                      color: filterType === t ? 'var(--primary-700)' : 'var(--neutral-600)',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'ALL' ? 'All Profiles' : t === 'CUSTOMER' ? 'Customers' : 'Suppliers'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profiles Directory Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Profile Name & Address</th>
                <th>Type</th>
                <th>Contact Details</th>
                <th>Branch Assignment</th>
                <th>Tax ID / GSTIN</th>
                <th>Outstanding Balance</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--neutral-400)' }}>
                    No contact profiles match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredParties.map((party) => {
                  const isReceivable = party.currentBalance > 0;
                  const isPayable = party.currentBalance < 0;

                  const assignedLocNames = (party.locationIds || []).map(id => {
                    const f = locations.find(l => l.id === id);
                    return f ? f.name : id;
                  });

                  return (
                    <tr key={party.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>{party.name}</div>
                        {party.address ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                            {party.address}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', fontStyle: 'italic' }}>
                            No address provided
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: party.type === 'CUSTOMER' ? 'var(--primary-50)' : 'var(--warning-50)',
                            color: party.type === 'CUSTOMER' ? 'var(--primary-700)' : 'var(--warning-700)',
                          }}
                        >
                          {party.type === 'CUSTOMER' ? '👤 Customer' : '🏢 Supplier'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {party.phone ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: 'var(--neutral-800)' }}>
                              <Phone size={12} color="var(--neutral-400)" />
                              <span>{party.phone}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)' }}>No Phone</span>
                          )}
                          {party.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                              <Mail size={12} color="var(--neutral-400)" />
                              <span>{party.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {assignedLocNames.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {assignedLocNames.map((name, i) => (
                              <span key={i} style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'var(--neutral-100)', borderRadius: 10, color: 'var(--neutral-700)' }}>
                                📍 {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>🌐 All Branches</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {party.gstin || <span style={{ color: 'var(--neutral-400)' }}>Unregistered</span>}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            color: isReceivable ? 'var(--warning-700)' : isPayable ? 'var(--danger-700)' : 'var(--neutral-500)',
                          }}
                        >
                          ₹{Math.abs(party.currentBalance).toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.72rem', marginLeft: 4, color: 'var(--neutral-400)' }}>
                          {isReceivable ? '(Receivable)' : isPayable ? '(Payable)' : '(Settled)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit Profile Details"
                            style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                            onClick={() => handleOpenEdit(party)}
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>
                          {!isCashier && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Delete Profile"
                              style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--danger-600)' }}
                              onClick={() => handleDeleteParty(party)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Profile Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="card-header">
              <span className="card-title">Add New Profile</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateParty} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {!isCashier && (
                  <div className="form-group">
                    <label className="form-label">Profile Classification *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setNewParty({ ...newParty, type: 'CUSTOMER' })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '2px solid',
                          borderColor: newParty.type === 'CUSTOMER' ? 'var(--primary-600)' : 'var(--neutral-200)',
                          backgroundColor: newParty.type === 'CUSTOMER' ? 'var(--primary-50)' : '#ffffff',
                          color: newParty.type === 'CUSTOMER' ? 'var(--primary-700)' : 'var(--neutral-700)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <UserCheck size={16} />
                        <span>Customer (Client)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewParty({ ...newParty, type: 'SUPPLIER' })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '2px solid',
                          borderColor: newParty.type === 'SUPPLIER' ? 'var(--warning-600)' : 'var(--neutral-200)',
                          backgroundColor: newParty.type === 'SUPPLIER' ? 'var(--warning-50)' : '#ffffff',
                          color: newParty.type === 'SUPPLIER' ? 'var(--warning-700)' : 'var(--neutral-700)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <Building size={16} />
                        <span>Supplier (Vendor)</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Full Name / Business Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder={newParty.type === 'CUSTOMER' ? 'e.g. Ramesh Kumar' : 'e.g. Metro Wholesale Suppliers'}
                    value={newParty.name}
                    onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+91 9876543210"
                      value={newParty.phone}
                      onChange={(e) => setNewParty({ ...newParty, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="contact@email.com"
                      value={newParty.email}
                      onChange={(e) => setNewParty({ ...newParty, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Address / Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Shop/Street address, Area, City"
                    value={newParty.address}
                    onChange={(e) => setNewParty({ ...newParty, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN / Tax ID (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="07AAAAA0000A1Z5"
                    value={newParty.gstin}
                    onChange={(e) => setNewParty({ ...newParty, gstin: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Branch Location Assignment</label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginBottom: 6 }}>
                    Select specific branches or leave blank for Global (All Branches).
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--neutral-50)', borderRadius: 6, border: '1px solid var(--neutral-200)' }}>
                    {locations.map((loc) => (
                      <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newParty.locationIds.includes(loc.id)}
                          onChange={() => toggleLocationSelect(loc.id, false)}
                        />
                        <span>{loc.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>({loc.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && editingParty && (
        <div className="modal-overlay" onClick={() => !isSaving && setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="card-header">
              <span className="card-title">Edit {editForm.type === 'CUSTOMER' ? 'Customer' : 'Supplier'} Profile</span>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ backgroundColor: 'var(--neutral-50)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--neutral-600)' }}>
                    Profile ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{editingParty.id}</code>
                  </div>
                  <span className="badge" style={{ backgroundColor: editForm.type === 'CUSTOMER' ? 'var(--primary-50)' : 'var(--warning-50)', color: editForm.type === 'CUSTOMER' ? 'var(--primary-700)' : 'var(--warning-700)' }}>
                    {editForm.type}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name / Business Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+91 9876543210"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="contact@email.com"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Address / Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Shop/Street address, Area, City"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="07AAAAA0000A1Z5"
                    value={editForm.gstin}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Branch Location Assignment</label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginBottom: 6 }}>
                    Select specific branches or leave blank for Global (All Branches).
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--neutral-50)', borderRadius: 6, border: '1px solid var(--neutral-200)' }}>
                    {locations.map((loc) => (
                      <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editForm.locationIds.includes(loc.id)}
                          onChange={() => toggleLocationSelect(loc.id, true)}
                        />
                        <span>{loc.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>({loc.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
