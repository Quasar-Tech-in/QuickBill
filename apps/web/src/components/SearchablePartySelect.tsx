import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  User, 
  Building, 
  Phone, 
  Check, 
  X, 
  ChevronDown, 
  AlertCircle, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { Party } from '../types';

interface SearchablePartySelectProps {
  parties: Party[];
  selectedPartyId: string;
  onSelect: (party: Party | null) => void;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  placeholder?: string;
  disabled?: boolean;
  onAutoFillBalance?: (balanceAmount: number) => void;
}

export const SearchablePartySelect: React.FC<SearchablePartySelectProps> = ({
  parties,
  selectedPartyId,
  onSelect,
  partyType,
  placeholder,
  disabled = false,
  onAutoFillBalance,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isCustomer = partyType === 'CUSTOMER';
  const defaultPlaceholder = isCustomer ? 'Search customer by name or phone...' : 'Search supplier by name or phone...';

  // Find currently selected party
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Filtered parties based on search query
  const filteredParties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
      const matchEmail = p.email ? p.email.toLowerCase().includes(q) : false;
      const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
      return matchName || matchPhone || matchEmail || matchAddress;
    });
  }, [parties, searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Calculate party balance details
  const getBalanceInfo = (party: Party) => {
    const bal = party.currentBalance || 0;
    if (isCustomer) {
      if (bal > 0) {
        return { label: `Due: ₹${bal.toFixed(2)}`, type: 'DUE', color: '#dc2626', bg: '#fee2e2', absAmount: bal };
      }
      if (bal < 0) {
        return { label: `Advance: ₹${Math.abs(bal).toFixed(2)}`, type: 'ADVANCE', color: '#059669', bg: '#ecfdf5', absAmount: Math.abs(bal) };
      }
      return { label: 'Settled (₹0.00)', type: 'ZERO', color: '#64748b', bg: '#f1f5f9', absAmount: 0 };
    } else {
      // Supplier
      if (bal < 0) {
        return { label: `Payable: ₹${Math.abs(bal).toFixed(2)}`, type: 'DUE', color: '#d97706', bg: '#fef3c7', absAmount: Math.abs(bal) };
      }
      if (bal > 0) {
        return { label: `Advance: ₹${bal.toFixed(2)}`, type: 'ADVANCE', color: '#059669', bg: '#ecfdf5', absAmount: bal };
      }
      return { label: 'Settled (₹0.00)', type: 'ZERO', color: '#64748b', bg: '#f1f5f9', absAmount: 0 };
    }
  };

  const handleSelect = (party: Party) => {
    onSelect(party);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Selected State Card / Trigger */}
      {selectedParty ? (
        <div
          style={{
            border: '1.5px solid var(--primary-300, #a5b4fc)',
            backgroundColor: 'var(--primary-50, #eef2ff)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: isCustomer ? '#dbeafe' : '#fef3c7',
                  color: isCustomer ? '#1d4ed8' : '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  flexShrink: 0,
                }}
              >
                {isCustomer ? <User size={18} /> : <Building size={18} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--neutral-900, #0f172a)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedParty.name}
                </span>
                {selectedParty.phone && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500, #64748b)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={11} />
                    {selectedParty.phone}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(() => {
                const balInfo = getBalanceInfo(selectedParty);
                return (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      backgroundColor: balInfo.bg,
                      color: balInfo.color,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {balInfo.label}
                  </span>
                );
              })()}

              <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.75rem', height: 28 }}
                title="Change contact"
              >
                Change
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="btn btn-secondary btn-icon btn-sm"
                style={{ height: 28, width: 28, padding: 0 }}
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Outstanding Balance Auto-fill button */}
          {(() => {
            const balInfo = getBalanceInfo(selectedParty);
            if (balInfo.type === 'DUE' && balInfo.absAmount > 0 && onAutoFillBalance) {
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: '#ffffff',
                    border: '1px dashed var(--primary-300, #cbd5e1)',
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ color: 'var(--neutral-600, #475569)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={13} color="var(--primary-600, #4f46e5)" />
                    Outstanding Balance: <strong>₹{balInfo.absAmount.toFixed(2)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => onAutoFillBalance(balInfo.absAmount)}
                    style={{
                      border: 'none',
                      backgroundColor: 'var(--primary-600, #4f46e5)',
                      color: '#ffffff',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>Auto-fill Amount</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              );
            }
            return null;
          })()}
        </div>
      ) : (
        /* Empty / Trigger Button */
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md, 8px)',
            border: `1.5px solid ${isOpen ? 'var(--primary-500, #4f46e5)' : 'var(--neutral-300, #cbd5e1)'}`,
            backgroundColor: disabled ? 'var(--neutral-100, #f1f5f9)' : '#ffffff',
            color: 'var(--neutral-500, #64748b)',
            fontSize: '0.85rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.15)' : 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} color="var(--neutral-400, #94a3b8)" />
            <span>{placeholder || defaultPlaceholder}</span>
          </div>
          <ChevronDown
            size={16}
            color={isOpen ? 'var(--primary-600, #4f46e5)' : 'var(--neutral-400, #94a3b8)'}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      )}

      {/* Searchable Dropdown Overlay */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--neutral-200, #e2e8f0)',
            boxShadow: '0 12px 28px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
            zIndex: 2000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--neutral-200, #e2e8f0)',
              backgroundColor: 'var(--neutral-50, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Search size={15} color="var(--primary-600, #4f46e5)" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={isCustomer ? 'Type customer name, phone...' : 'Type supplier name, phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '0.84rem',
                outline: 'none',
                color: 'var(--neutral-900, #0f172a)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--neutral-400)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick List Status */}
          <div
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--neutral-500, #64748b)',
              backgroundColor: 'var(--neutral-100, #f1f5f9)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{isCustomer ? 'CUSTOMERS' : 'SUPPLIERS'} ({filteredParties.length})</span>
            <span>OUTSTANDING BALANCE</span>
          </div>

          {/* Parties List */}
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px' }}>
            {filteredParties.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--neutral-500, #64748b)' }}>
                <AlertCircle size={22} color="var(--neutral-400)" style={{ margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                  No {isCustomer ? 'customers' : 'suppliers'} found
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--neutral-400)' }}>
                  {searchQuery ? `No results matching "${searchQuery}"` : 'No contacts available'}
                </div>
              </div>
            ) : (
              filteredParties.map((party) => {
                const isSelected = party.id === selectedPartyId;
                const balInfo = getBalanceInfo(party);

                return (
                  <div
                    key={party.id}
                    onClick={() => handleSelect(party)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      backgroundColor: isSelected ? 'var(--primary-50, #eef2ff)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--neutral-50, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          backgroundColor: isCustomer ? '#e0f2fe' : '#fef3c7',
                          color: isCustomer ? '#0369a1' : '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isCustomer ? <User size={15} /> : <Building size={15} />}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? 'var(--primary-700, #4338ca)' : 'var(--neutral-900, #0f172a)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {party.name}
                        </span>
                        {party.phone && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500, #64748b)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={10} />
                            {party.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          backgroundColor: balInfo.bg,
                          color: balInfo.color,
                        }}
                      >
                        {balInfo.label}
                      </span>
                      {isSelected && <Check size={15} color="var(--primary-600, #4f46e5)" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
