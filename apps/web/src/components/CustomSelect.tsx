import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface CustomSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
  className?: string;
  size?: 'sm' | 'md';
}

export function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  style,
  size = 'md',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: size === 'sm' ? '6px 10px' : '8px 12px',
          height: size === 'sm' ? 32 : 38,
          borderRadius: 'var(--radius-md, 8px)',
          border: `1.5px solid ${isOpen ? 'var(--primary-500, #4f46e5)' : 'var(--neutral-300, #cbd5e1)'}`,
          backgroundColor: disabled ? 'var(--neutral-100, #f1f5f9)' : '#ffffff',
          color: selectedOption ? 'var(--neutral-900, #0f172a)' : 'var(--neutral-400, #94a3b8)',
          fontSize: size === 'sm' ? '0.78rem' : '0.85rem',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 3px var(--primary-glow, rgba(79, 70, 229, 0.2))' : 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          outline: 'none',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.icon && (
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--primary-600, #4f46e5)' }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: 4,
                backgroundColor: 'var(--primary-50, #eef2ff)',
                color: 'var(--primary-700, #3730a3)',
                fontWeight: 700,
              }}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={15}
          color={isOpen ? 'var(--primary-600, #4f46e5)' : 'var(--neutral-400, #94a3b8)'}
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Options Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            minWidth: 200,
            maxHeight: 220,
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--neutral-200, #e2e8f0)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 1500,
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxSizing: 'border-box',
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={String(option.value)}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  backgroundColor: isSelected ? 'var(--primary-50, #eef2ff)' : 'transparent',
                  color: isSelected ? 'var(--primary-700, #4338ca)' : 'var(--neutral-800, #1e293b)',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 600 : 400,
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {option.icon && (
                    <span style={{ display: 'flex', alignItems: 'center', color: isSelected ? 'var(--primary-600)' : 'var(--neutral-500)' }}>
                      {option.icon}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {option.label}
                    </span>
                    {option.subLabel && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>
                        {option.subLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {option.badge && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 5px',
                        borderRadius: 4,
                        backgroundColor: isSelected ? 'var(--primary-100)' : 'var(--neutral-100)',
                        color: isSelected ? 'var(--primary-800)' : 'var(--neutral-600)',
                        fontWeight: 600,
                      }}
                    >
                      {option.badge}
                    </span>
                  )}
                  {isSelected && <Check size={14} color="var(--primary-600, #4f46e5)" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
