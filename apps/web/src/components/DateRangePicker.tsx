import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X, Clock } from 'lucide-react';

export type DatePreset = 
  | 'TODAY' 
  | 'YESTERDAY' 
  | 'LAST_7_DAYS' 
  | 'THIS_MONTH' 
  | 'LAST_30_DAYS' 
  | 'THIS_QUARTER' 
  | 'THIS_YEAR' 
  | 'ALL' 
  | 'CUSTOM';

export interface DateRangeValue {
  preset: DatePreset;
  fromDate: string; // ISO format 'YYYY-MM-DD'
  toDate: string;   // ISO format 'YYYY-MM-DD'
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
  compact?: boolean;
  allowAllTime?: boolean;
  variant?: 'strip' | 'dropdown';
}

// Format 'YYYY-MM-DD' to 'DD-MM-YYYY'
export const formatIsoToDisplay = (isoStr: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoStr;
};

// Format 'DD-MM-YYYY' to 'YYYY-MM-DD'
export const formatDisplayToIso = (displayStr: string): string => {
  if (!displayStr) return '';
  const parts = displayStr.trim().split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return displayStr;
};

// Helper to compute ISO dates from presets
export const calculatePresetDates = (preset: DatePreset): { fromDate: string; toDate: string } => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (preset === 'TODAY') {
    return { fromDate: todayStr, toDate: todayStr };
  }

  if (preset === 'YESTERDAY') {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];
    return { fromDate: yestStr, toDate: yestStr };
  }

  if (preset === 'LAST_7_DAYS') {
    const past = new Date(today);
    past.setDate(past.getDate() - 6);
    return { fromDate: past.toISOString().split('T')[0], toDate: todayStr };
  }

  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { fromDate: firstDay.toISOString().split('T')[0], toDate: todayStr };
  }

  if (preset === 'LAST_30_DAYS') {
    const past = new Date(today);
    past.setDate(past.getDate() - 29);
    return { fromDate: past.toISOString().split('T')[0], toDate: todayStr };
  }

  if (preset === 'THIS_QUARTER') {
    const currentQuarter = Math.floor(today.getMonth() / 3);
    const startOfQuarter = new Date(today.getFullYear(), currentQuarter * 3, 1);
    return { fromDate: startOfQuarter.toISOString().split('T')[0], toDate: todayStr };
  }

  if (preset === 'THIS_YEAR') {
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    return { fromDate: startOfYear.toISOString().split('T')[0], toDate: todayStr };
  }

  // ALL or CUSTOM default
  return { fromDate: '', toDate: '' };
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  compact = false,
  allowAllTime = true,
  variant = 'strip',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<string>(value.fromDate || new Date().toISOString().split('T')[0]);
  const [customToDate, setCustomToDate] = useState<string>(value.toDate || new Date().toISOString().split('T')[0]);
  const [inputError, setInputError] = useState<string>('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.fromDate) setCustomFromDate(value.fromDate);
    if (value.toDate) setCustomToDate(value.toDate);
  }, [value.fromDate, value.toDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handlePresetSelect = (preset: DatePreset) => {
    setIsDropdownOpen(false);
    if (preset === 'CUSTOM') {
      setIsCustomModalOpen(true);
      return;
    }
    const dates = calculatePresetDates(preset);
    onChange({
      preset,
      fromDate: dates.fromDate,
      toDate: dates.toDate,
    });
  };

  const handleApplyCustom = () => {
    if (!customFromDate || !customToDate) {
      setInputError('Please specify both Start and End dates.');
      return;
    }
    if (customFromDate > customToDate) {
      setInputError('Start date cannot be after End date.');
      return;
    }

    setInputError('');
    setIsCustomModalOpen(false);
    onChange({
      preset: 'CUSTOM',
      fromDate: customFromDate,
      toDate: customToDate,
    });
  };

  const presetsList: { key: DatePreset; label: string }[] = [
    ...(allowAllTime ? [{ key: 'ALL' as DatePreset, label: 'All Time' }] : []),
    { key: 'TODAY', label: 'Today' },
    { key: 'YESTERDAY', label: 'Yesterday' },
    { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
    { key: 'THIS_MONTH', label: 'This Month' },
    { key: 'LAST_30_DAYS', label: 'Last 30 Days' },
    { key: 'THIS_QUARTER', label: 'This Quarter' },
    { key: 'THIS_YEAR', label: 'This Year' },
    { key: 'CUSTOM', label: 'Custom Range...' },
  ];

  const getDropdownLabel = () => {
    if (value.preset === 'CUSTOM' && value.fromDate && value.toDate) {
      return `${formatIsoToDisplay(value.fromDate)} to ${formatIsoToDisplay(value.toDate)}`;
    }
    const matching = presetsList.find(p => p.key === value.preset);
    if (matching) return matching.label;
    if (value.fromDate && value.toDate) {
      return `${formatIsoToDisplay(value.fromDate)} to ${formatIsoToDisplay(value.toDate)}`;
    }
    return 'Select Date Range';
  };

  return (
    <div ref={dropdownRef} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {variant === 'dropdown' ? (
        /* Single Compact Dropdown Button */
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(prev => !prev)}
            className="form-select"
            style={{
              height: 36,
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '0 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              minWidth: 155,
              justifyContent: 'space-between',
              backgroundColor: value.preset !== 'ALL' ? 'var(--primary-50)' : '#ffffff',
              borderColor: value.preset !== 'ALL' ? 'var(--primary-300)' : 'var(--neutral-300)',
              color: value.preset !== 'ALL' ? 'var(--primary-800)' : 'var(--neutral-800)',
              appearance: 'none',
              WebkitAppearance: 'none',
              boxShadow: 'none',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Calendar size={14} style={{ color: value.preset !== 'ALL' ? 'var(--primary-600)' : 'var(--neutral-500)', flexShrink: 0 }} />
              <span>{getDropdownLabel()}</span>
            </span>
            <ChevronDown size={13} style={{ color: 'var(--neutral-400)', flexShrink: 0 }} />
          </button>

          {/* Dropdown Menu Overlay */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                background: '#ffffff',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--neutral-200)',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.14), 0 4px 10px rgba(0, 0, 0, 0.05)',
                zIndex: 1100,
                minWidth: 200,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Date Durations
              </div>
              {presetsList.map(({ key, label }) => {
                const isSelected = value.preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetSelect(key)}
                    style={{
                      border: 'none',
                      padding: '7px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      background: isSelected ? 'var(--primary-50)' : 'transparent',
                      color: isSelected ? 'var(--primary-700)' : 'var(--neutral-700)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.8rem',
                      textAlign: 'left',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--neutral-100)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {key === 'CUSTOM' ? <Clock size={13} style={{ color: 'var(--primary-600)' }} /> : null}
                      <span>{label}</span>
                    </span>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary-600)' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Preset Buttons Strip */
        <>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              background: 'var(--neutral-100)', 
              borderRadius: 'var(--radius-md)', 
              padding: 3, 
              border: '1px solid var(--neutral-200)',
              gap: 2,
              flexWrap: 'wrap'
            }}
          >
            {presetsList.map(({ key, label }) => {
              const isSelected = value.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetSelect(key)}
                  style={{
                    border: 'none',
                    padding: compact ? '4px 8px' : '5px 11px',
                    fontSize: compact ? '0.74rem' : '0.78rem',
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--surface-card)' : 'transparent',
                    color: isSelected ? 'var(--primary-600)' : 'var(--neutral-600)',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {key === 'CUSTOM' && <Calendar size={12} />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Formatted Date Range Indicator (in DD-MM-YYYY) */}
          {value.fromDate && value.toDate && (
            <div
              onClick={() => setIsCustomModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                color: 'var(--primary-700)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Click to change custom date range"
            >
              <Calendar size={13} />
              <span>
                {formatIsoToDisplay(value.fromDate)} to {formatIsoToDisplay(value.toDate)}
              </span>
              <ChevronDown size={12} style={{ opacity: 0.7 }} />
            </div>
          )}
        </>
      )}

      {/* Custom Date Range Popover / Modal (DD-MM-YYYY) */}
      {isCustomModalOpen && (
        <div 
          className="modal-overlay"
          onClick={() => setIsCustomModalOpen(false)}
          style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: 420, 
              width: '100%', 
              backgroundColor: '#ffffff', 
              borderRadius: '14px', 
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--neutral-200)',
              backgroundColor: 'var(--neutral-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  backgroundColor: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Calendar size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    Select Custom Date Range
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                    Format: DD-MM-YYYY
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {inputError && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--danger-50)',
                  color: 'var(--danger-700)',
                  border: '1px solid var(--danger-200)',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}>
                  {inputError}
                </div>
              )}

              {/* Start Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                  From Date (DD-MM-YYYY)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="date"
                    className="form-input"
                    value={customFromDate}
                    onChange={(e) => {
                      setCustomFromDate(e.target.value);
                      setInputError('');
                    }}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.86rem', borderRadius: '8px' }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                  Selected: {formatIsoToDisplay(customFromDate)}
                </div>
              </div>

              {/* End Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neutral-700)' }}>
                  To Date (DD-MM-YYYY)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="date"
                    className="form-input"
                    value={customToDate}
                    onChange={(e) => {
                      setCustomToDate(e.target.value);
                      setInputError('');
                    }}
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.86rem', borderRadius: '8px' }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                  Selected: {formatIsoToDisplay(customToDate)}
                </div>
              </div>

              {/* Quick Preset Buttons inside Modal */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px dashed var(--neutral-200)' }}>
                <span style={{ width: '100%', fontSize: '0.72rem', fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase' }}>
                  Quick Jump:
                </span>
                {[
                  { k: 'TODAY', l: 'Today' },
                  { k: 'LAST_7_DAYS', l: 'Last 7D' },
                  { k: 'THIS_MONTH', l: 'This Month' },
                  { k: 'LAST_30_DAYS', l: 'Last 30D' },
                  { k: 'THIS_YEAR', l: 'This Year' }
                ].map(p => (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => {
                      const d = calculatePresetDates(p.k as DatePreset);
                      setCustomFromDate(d.fromDate);
                      setCustomToDate(d.toDate);
                      setInputError('');
                    }}
                    style={{
                      background: 'var(--neutral-100)',
                      border: '1px solid var(--neutral-200)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--neutral-700)',
                      cursor: 'pointer'
                    }}
                  >
                    {p.l}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCustomModalOpen(false)}
                  style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyCustom}
                  style={{ padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={14} />
                  <span>Apply Filter ({formatIsoToDisplay(customFromDate)} to {formatIsoToDisplay(customToDate)})</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
