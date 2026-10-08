import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Tag, 
  Plus, 
  Check, 
  X, 
  ChevronDown, 
  FolderPlus,
  Sparkles,
  Layers,
  Edit3
} from 'lucide-react';
import { ExpenseCategory } from '../types';

interface SearchableCategorySelectProps {
  categories: ExpenseCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryName: string) => void;
  onAddNewCategory?: (newCategoryName: string) => Promise<string | void> | string | void;
  placeholder?: string;
  disabled?: boolean;
}

// Popular suggested categories for quick 1-click selection
const QUICK_SUGGESTIONS = [
  'Electricity Bill',
  'Shop Rent',
  'Staff Salary',
  'Tea & Refreshments',
  'Generator Fuel',
  'Packaging Material',
  'Internet & Phone',
  'Store Maintenance'
];

export const SearchableCategorySelect: React.FC<SearchableCategorySelectProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddNewCategory,
  placeholder = 'Select or search expense category...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchDesc = c.description ? c.description.toLowerCase().includes(q) : false;
      return matchName || matchDesc;
    });
  }, [categories, searchQuery]);

  // Check if search query exactly matches an existing category
  const exactMatchExists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return categories.some((c) => c.name.toLowerCase() === q);
  }, [categories, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreatingInline(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input
  useEffect(() => {
    if (isOpen && !isCreatingInline) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isCreatingInline]);

  useEffect(() => {
    if (isCreatingInline) {
      setTimeout(() => {
        newCatInputRef.current?.focus();
      }, 50);
    }
  }, [isCreatingInline]);

  useEffect(() => {
    if (isManualMode) {
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 50);
    }
  }, [isManualMode]);

  const handleSelect = (catName: string) => {
    onSelectCategory(catName);
    setIsOpen(false);
    setSearchQuery('');
    setIsCreatingInline(false);
  };

  const handleQuickAdd = async (catNameToAdd: string) => {
    const trimmed = catNameToAdd.trim();
    if (!trimmed) return;
    setIsAdding(true);
    try {
      if (onAddNewCategory) {
        await onAddNewCategory(trimmed);
      }
      onSelectCategory(trimmed);
      setIsOpen(false);
      setSearchQuery('');
      setIsCreatingInline(false);
      setNewCategoryInput('');
    } catch (e) {
      console.error('Error adding category:', e);
    } finally {
      setIsAdding(false);
    }
  };

  // If in manual mode, render direct text input
  if (isManualMode) {
    return (
      <div ref={containerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={manualInputRef}
              type="text"
              disabled={disabled}
              className="form-input"
              placeholder="Write expense category name (e.g. Chai, Printing, Courier)..."
              value={selectedCategory}
              onChange={(e) => onSelectCategory(e.target.value)}
              style={{ width: '100%', height: 38, fontSize: '0.85rem', fontWeight: 600, paddingLeft: 12 }}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsManualMode(false)}
            title="Switch back to category picker list"
            style={{ height: 38, padding: '0 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
          >
            <Layers size={13} />
            <span>Pick List</span>
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Writing manually: &quot;{selectedCategory || '...'}&quot;</span>
          <button
            type="button"
            onClick={() => setIsManualMode(false)}
            style={{ border: 'none', background: 'none', color: 'var(--primary-600)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
          >
            Choose from preset list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            borderRadius: 'var(--radius-md, 8px)',
            border: `1.5px solid ${isOpen ? 'var(--primary-500, #4f46e5)' : 'var(--neutral-300, #cbd5e1)'}`,
            backgroundColor: disabled ? 'var(--neutral-100, #f1f5f9)' : '#ffffff',
            color: selectedCategory ? 'var(--neutral-900, #0f172a)' : 'var(--neutral-400, #94a3b8)',
            fontSize: '0.85rem',
            fontWeight: selectedCategory ? 600 : 400,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.15)' : 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
            transition: 'all 0.15s ease',
            outline: 'none',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                backgroundColor: 'var(--danger-50, #fef2f2)',
                color: 'var(--danger-600, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Tag size={13} />
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedCategory || placeholder}
            </span>
          </div>

          <ChevronDown
            size={16}
            color={isOpen ? 'var(--primary-600, #4f46e5)' : 'var(--neutral-400, #94a3b8)'}
            style={{
              flexShrink: 0,
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Quick Manual Toggle Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsOpen(false);
            setIsManualMode(true);
          }}
          className="btn btn-secondary btn-sm"
          title="Type category name manually"
          style={{ height: 38, padding: '0 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
        >
          <Edit3 size={13} />
          <span>Write Manual</span>
        </button>
      </div>

      {/* Dropdown Menu */}
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
              placeholder="Type to filter or add category..."
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

          {/* Quick Suggestions Pills (when not searching or just opened) */}
          {!searchQuery && (
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--neutral-100, #f1f5f9)',
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-400, #94a3b8)', letterSpacing: '0.04em' }}>
                Quick Suggestions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {QUICK_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleSelect(sug)}
                    style={{
                      border: '1px solid var(--neutral-200, #e2e8f0)',
                      borderRadius: 'var(--radius-full, 9999px)',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: selectedCategory === sug ? 700 : 500,
                      backgroundColor: selectedCategory === sug ? 'var(--primary-50, #eef2ff)' : 'var(--neutral-50, #f8fafc)',
                      color: selectedCategory === sug ? 'var(--primary-700, #4338ca)' : 'var(--neutral-700, #334155)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categories List */}
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px' }}>
            {filteredCategories.length > 0 ? (
              filteredCategories.map((cat) => {
                const isSelected = cat.name.toLowerCase() === selectedCategory.toLowerCase();
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleSelect(cat.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Tag size={14} color={isSelected ? 'var(--primary-600)' : 'var(--neutral-400)'} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--primary-700, #4338ca)' : 'var(--neutral-800, #1e293b)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cat.name}
                        </span>
                        {cat.description && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>
                            {cat.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check size={14} color="var(--primary-600, #4f46e5)" />}
                  </div>
                );
              })
            ) : null}

            {/* If search query doesn't match existing, offer 1-click creation */}
            {searchQuery.trim() && !exactMatchExists && (
              <div
                onClick={() => handleQuickAdd(searchQuery.trim())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  margin: '4px 0',
                  borderRadius: 6,
                  backgroundColor: 'var(--primary-50, #eef2ff)',
                  color: 'var(--primary-700, #4338ca)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px dashed var(--primary-300, #a5b4fc)',
                }}
              >
                <Plus size={15} />
                <span>
                  Add <strong>"{searchQuery.trim()}"</strong> as new category
                </span>
              </div>
            )}
          </div>

          {/* Footer Action: Add New Custom Category */}
          <div
            style={{
              borderTop: '1px solid var(--neutral-200, #e2e8f0)',
              padding: '8px 10px',
              backgroundColor: 'var(--neutral-50, #f8fafc)',
            }}
          >
            {isCreatingInline ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQuickAdd(newCategoryInput);
                }}
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <input
                  ref={newCatInputRef}
                  type="text"
                  placeholder="Enter new category name..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '0.8rem',
                    borderRadius: 4,
                    border: '1px solid var(--primary-400)',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!newCategoryInput.trim() || isAdding}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                >
                  {isAdding ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingInline(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: 28 }}
                >
                  <X size={13} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingInline(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '5px 0',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--primary-600, #4f46e5)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>Create Custom Category</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
