import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'records',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, safePage - 1);
      let end = Math.min(totalPages - 1, safePage + 1);

      if (safePage <= 3) {
        start = 2;
        end = 4;
      } else if (safePage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--neutral-200, #e2e8f0)',
        backgroundColor: 'var(--neutral-50, #f8fafc)',
        flexWrap: 'wrap',
        gap: 12,
        borderRadius: '0 0 var(--radius-md, 8px) var(--radius-md, 8px)',
      }}
    >
      {/* Left: Range and total count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--neutral-600, #475569)' }}>
          {totalItems > 0 ? (
            <>
              Showing <strong>{startIdx}</strong>–<strong>{endIdx}</strong> of <strong>{totalItems}</strong> {itemLabel}
            </>
          ) : (
            <>No {itemLabel} found</>
          )}
        </span>

        {/* Page size selector */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--neutral-500, #64748b)' }}>
              Rows per page:
            </label>
            <select
              className="form-select"
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              style={{
                padding: '4px 28px 4px 10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                height: 30,
                minWidth: 68,
                width: 'auto',
                borderRadius: 'var(--radius-sm, 6px)',
                borderColor: 'var(--neutral-300, #cbd5e1)',
                backgroundColor: '#ffffff',
                color: 'var(--neutral-800, #1e293b)',
                cursor: 'pointer',
                lineHeight: 1.2,
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* First Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          title="First Page"
          style={{
            padding: '4px 8px',
            height: 28,
            minWidth: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          title="Previous Page"
          style={{
            padding: '4px 8px',
            height: 28,
            minWidth: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page Numbers */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis_${idx}`}
                style={{
                  padding: '0 4px',
                  fontSize: '0.8rem',
                  color: 'var(--neutral-400, #94a3b8)',
                  userSelect: 'none',
                }}
              >
                ...
              </span>
            );
          }

          const pageNum = Number(p);
          const isActive = pageNum === safePage;

          return (
            <button
              key={`page_${pageNum}`}
              type="button"
              className={isActive ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => onPageChange(pageNum)}
              style={{
                padding: '0 8px',
                height: 28,
                minWidth: 28,
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          title="Next Page"
          style={{
            padding: '4px 8px',
            height: 28,
            minWidth: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronRight size={14} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last Page"
          style={{
            padding: '4px 8px',
            height: 28,
            minWidth: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};
