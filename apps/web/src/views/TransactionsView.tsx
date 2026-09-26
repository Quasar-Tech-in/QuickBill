import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  MapPin,
  RefreshCw,
  Receipt,
  CreditCard,
  Clock,
  AlertCircle,
  Eye,
  CheckCircle2,
  RotateCcw,
  Edit3
} from 'lucide-react';
import { Invoice } from '../types';
import { store } from '../services/store';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { InvoiceUpdateModal } from '../components/InvoiceUpdateModal';

interface TransactionsViewProps {
  onViewInvoice: (invoice: Invoice) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onViewInvoice }) => {
  const locations = store.getAllLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [invoices, setInvoices] = useState<Invoice[]>(store.getInvoices());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL');
  const [updatingInvoice, setUpdatingInvoice] = useState<Invoice | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);

  const loadInvoices = useCallback(async (
    page: number = currentPage,
    size: number = pageSize,
    locId: string = selectedLocationId,
    search: string = searchQuery,
    status: string = statusFilter
  ) => {
    setIsLoading(true);
    try {
      const res = await store.fetchSalesPaginated({
        page,
        pageSize: size,
        search: search.trim() || undefined,
        status: status !== 'ALL' ? status : undefined,
        locationId: locId !== 'ALL' ? locId : undefined,
      });
      setInvoices(res.data);
      setTotalItems(res.total);
    } catch (e) {
      console.error('Error fetching paginated invoices:', e);
      const local = store.getInvoices(locId !== 'ALL' ? locId : undefined);
      setInvoices(local.slice((page - 1) * size, page * size));
      setTotalItems(local.length);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, selectedLocationId, searchQuery, statusFilter]);

  // When filters or search query change, reset page to 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, selectedLocationId]);

  // Fetch when page, size, or filters change
  useEffect(() => {
    loadInvoices(currentPage, pageSize, selectedLocationId, searchQuery, statusFilter);
  }, [currentPage, pageSize, selectedLocationId, searchQuery, statusFilter]);

  // Calculate summary stats
  const totalSalesAmount = invoices.reduce((sum, i) => sum + i.grandTotal, 0);
  const totalPaidAmount = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const totalDueAmount = invoices.reduce((sum, i) => sum + (i.balanceAmount || 0), 0);
  const totalReturnsAmount = invoices.reduce((sum, i) => sum + (i.returnTotal || 0), 0);
  const returnedBillsCount = invoices.filter(i => i.hasReturns || (i.returnTotal && i.returnTotal > 0)).length;
  const paidBillsCount = invoices.filter(i => i.status === 'PAID').length;

  const handleInvoiceUpdated = (updatedInv: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInv.id ? updatedInv : inv));
  };

  return (
    <div className="page-container" style={{ maxWidth: '100%', padding: '20px 24px' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--neutral-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={22} color="var(--primary-600)" />
            Invoices &amp; Billing History
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Audit live bills from MongoDB database across branch locations, process returns &amp; defective items, and print tax invoices.
          </p>
        </div>

        <button
          onClick={() => loadInvoices(1, pageSize, selectedLocationId, searchQuery, statusFilter)}
          className="btn btn-secondary"
          disabled={isLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700 }}
          title="Reload latest records from database"
        >
          <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
          {isLoading ? 'Syncing...' : 'Refresh Invoices'}
        </button>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="invoices-stat-grid">
        <div className="invoices-stat-card">
          <div className="invoices-stat-icon" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }}>
            <FileText size={18} />
          </div>
          <div>
            <div className="invoices-stat-label">Invoices Count</div>
            <div className="invoices-stat-value">{totalItems || invoices.length}</div>
          </div>
        </div>

        <div className="invoices-stat-card">
          <div className="invoices-stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success-700)' }}>
            <CreditCard size={18} />
          </div>
          <div>
            <div className="invoices-stat-label">Net Sales Revenue</div>
            <div className="invoices-stat-value" style={{ color: 'var(--success-700)' }}>
              ₹{totalSalesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="invoices-stat-card">
          <div className="invoices-stat-icon" style={{ backgroundColor: totalReturnsAmount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--neutral-100)', color: totalReturnsAmount > 0 ? 'var(--danger-700)' : 'var(--neutral-500)' }}>
            <RotateCcw size={18} />
          </div>
          <div>
            <div className="invoices-stat-label">Returns &amp; Defective</div>
            <div className="invoices-stat-value" style={{ color: totalReturnsAmount > 0 ? 'var(--danger-700)' : 'var(--neutral-700)' }}>
              -₹{totalReturnsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {returnedBillsCount > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--neutral-500)', marginLeft: 6 }}>
                  ({returnedBillsCount} bills)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="invoices-stat-card">
          <div className="invoices-stat-icon" style={{ backgroundColor: totalDueAmount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--neutral-100)', color: totalDueAmount > 0 ? 'var(--danger-700)' : 'var(--neutral-500)' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="invoices-stat-label">Outstanding Dues</div>
            <div className="invoices-stat-value" style={{ color: totalDueAmount > 0 ? 'var(--danger-700)' : 'var(--neutral-600)' }}>
              ₹{totalDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search invoice number, customer name, phone, branch..."
              className="form-input"
              style={{ paddingLeft: 36, width: '100%', height: 36, fontSize: '0.82rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Location & Status Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color="var(--primary-600)" />
              <select
                className="form-select"
                style={{ padding: '4px 10px', fontSize: '0.8rem', width: 'auto', height: 36 }}
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                <option value="ALL">🌐 All Branches</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--neutral-100)', padding: 3, borderRadius: 'var(--radius-full)' }}>
              {(['ALL', 'PAID', 'PARTIAL', 'UNPAID'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    backgroundColor: statusFilter === status ? '#ffffff' : 'transparent',
                    color: statusFilter === status ? 'var(--primary-700)' : 'var(--neutral-600)',
                    boxShadow: statusFilter === status ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Streamlined Invoices Table */}
      <div className="card" style={{ overflow: 'hidden', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table className="compact-invoices-table">
            <thead>
              <tr>
                <th style={{ width: '16%', minWidth: '130px', textAlign: 'center' }}>Invoice # &amp; Date</th>
                <th style={{ width: '23%', minWidth: '180px', textAlign: 'left', paddingLeft: 16 }}>Customer &amp; Branch</th>
                <th style={{ width: '14%', minWidth: '120px', textAlign: 'center' }}>Billed By &amp; Mode</th>
                <th style={{ width: '15%', minWidth: '120px', textAlign: 'center' }}>Total Amount</th>
                <th style={{ width: '14%', minWidth: '110px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '18%', minWidth: '165px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--neutral-400)' }}>
                    <Receipt size={36} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No invoices found matching current filters.</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr 
                    key={inv.id}
                    className="invoice-interactive-row"
                    onClick={() => onViewInvoice(inv)}
                    title="Click to preview and print invoice"
                  >
                    {/* Invoice # & Date (Centered) */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span className="invoice-num-badge">
                          {inv.invoiceNumber}
                        </span>
                        <span className="invoice-date-sub" style={{ justifyContent: 'center' }}>
                          📅 {inv.date}
                        </span>
                      </div>
                    </td>

                    {/* Customer & Location (Left aligned with padding) */}
                    <td style={{ textAlign: 'left', paddingLeft: 16 }}>
                      <div className="party-name-primary" style={{ fontSize: '0.88rem' }} title={inv.consumerName || inv.partyName || 'Walk-in Customer'}>
                        {inv.consumerName || inv.partyName || 'Walk-in Customer'}
                      </div>
                      <div className="party-meta-sub" style={{ marginTop: 4 }}>
                        {(inv.consumerPhone || inv.partyPhone) && (
                          <span style={{ fontWeight: 500 }}>📞 {inv.consumerPhone || inv.partyPhone}</span>
                        )}
                        <span className="branch-pill">
                          📍 {inv.locationName || 'Main Store'}
                        </span>
                      </div>
                    </td>

                    {/* Billed By & Payment Mode (Centered) */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'var(--neutral-800)', fontSize: '0.82rem' }}>
                        {inv.billedByName || 'Cashier'}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span className="pay-mode-badge">
                          {inv.paymentMode}
                        </span>
                      </div>
                    </td>

                    {/* Total Amount & Tax breakdown (Centered) */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="amount-grand-highlight" style={{ fontSize: '0.95rem' }}>
                        ₹{inv.grandTotal.toFixed(2)}
                      </div>
                      <div className="amount-tax-sub" style={{ marginTop: 2 }}>
                        Tax: ₹{inv.taxTotal.toFixed(2)}
                      </div>
                      {inv.returnTotal && inv.returnTotal > 0 ? (
                        <div style={{ marginTop: 2 }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--danger-700)', backgroundColor: 'rgba(239, 68, 68, 0.12)', padding: '1px 6px', borderRadius: 4 }}>
                            🔄 Ret: -₹{inv.returnTotal.toFixed(2)}
                          </span>
                        </div>
                      ) : null}
                    </td>

                    {/* Payment Status & Balance Due (Centered) */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <StatusBadge status={inv.status} />
                        {inv.balanceAmount > 0 && (
                          <span className="balance-due-pill">
                            Due: ₹{inv.balanceAmount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quick Print & Update Action Buttons (Centered) */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'nowrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: 5, 
                            padding: '5px 10px', 
                            fontSize: '0.76rem', 
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInvoice(inv);
                          }}
                          title="View / Print Tax Invoice"
                        >
                          <Printer size={13} color="var(--primary-600)" />
                          <span>Print</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: 5, 
                            padding: '5px 10px', 
                            fontSize: '0.76rem', 
                            fontWeight: 700,
                            borderRadius: 'var(--radius-md)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            backgroundColor: inv.hasReturns ? 'rgba(239, 68, 68, 0.08)' : undefined,
                            borderColor: inv.hasReturns ? 'rgba(239, 68, 68, 0.3)' : undefined,
                            color: inv.hasReturns ? 'var(--danger-700)' : undefined
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpdatingInvoice(inv);
                          }}
                          title="Update bill or process item returns / defective items"
                        >
                          <RotateCcw size={13} color={inv.hasReturns ? 'var(--danger-600)' : 'var(--neutral-600)'} />
                          <span>Return</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="invoices"
        />
      </div>

      {/* Invoice Update & Returns Modal */}
      {updatingInvoice && (
        <InvoiceUpdateModal 
          invoice={updatingInvoice}
          onClose={() => setUpdatingInvoice(null)}
          onUpdated={handleInvoiceUpdated}
        />
      )}
    </div>
  );
};


