import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  MapPin,
  RefreshCw
} from 'lucide-react';
import { Invoice } from '../types';
import { store } from '../services/store';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';

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

  const totalSalesAmount = invoices.reduce((sum, i) => sum + i.grandTotal, 0);

  return (
    <div className="page-container">
      {/* Top Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Invoices & Billing History
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Audit live bills from MongoDB database across branch locations, print tax receipts, and track settlements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button
            onClick={() => loadInvoices(1, pageSize, selectedLocationId, searchQuery, statusFilter)}
            className="btn btn-secondary"
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.82rem' }}
            title="Reload from MongoDB database"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            {isLoading ? 'Syncing...' : 'Refresh DB'}
          </button>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Filtered Total</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-600)' }}>
              ₹{totalSalesAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', minWidth: 280, flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Search invoice number, customer name, branch..."
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={15} color="var(--primary-600)" />
              <select
                className="form-select"
                style={{ padding: '5px 10px', fontSize: '0.82rem', width: 'auto' }}
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

            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 'PAID', 'PARTIAL', 'UNPAID'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: statusFilter === status ? 'var(--primary-500)' : 'var(--neutral-200)',
                    backgroundColor: statusFilter === status ? 'var(--primary-50)' : '#ffffff',
                    color: statusFilter === status ? 'var(--primary-700)' : 'var(--neutral-600)',
                    cursor: 'pointer',
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Branch Location</th>
                <th>Customer / Consumer</th>
                <th>Billed By</th>
                <th>Payment Mode</th>
                <th>Subtotal</th>
                <th>GST</th>
                <th>Grand Total</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 28, color: 'var(--neutral-400)' }}>
                    No invoices match your search.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>{inv.date}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10, background: 'var(--neutral-100)', color: 'var(--neutral-700)' }}>
                        📍 {inv.locationName || 'Main Store'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--neutral-900)' }}>
                        {inv.consumerName || inv.partyName}
                      </div>
                      {(inv.consumerPhone || inv.partyPhone) && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--neutral-500)' }}>
                          📞 {inv.consumerPhone || inv.partyPhone}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--neutral-700)', fontWeight: 600 }}>
                        {inv.billedByName || 'Cashier'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'var(--neutral-100)', padding: '3px 8px', borderRadius: 4 }}>
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td>₹{inv.subtotal.toFixed(2)}</td>
                    <td>₹{inv.taxTotal.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--neutral-900)' }}>
                      ₹{inv.grandTotal.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 700, color: inv.balanceAmount > 0 ? 'var(--danger-600)' : 'var(--neutral-400)' }}>
                      ₹{inv.balanceAmount.toFixed(2)}
                    </td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-icon btn-sm"
                        title="View / Print Tax Invoice"
                        onClick={() => onViewInvoice(inv)}
                      >
                        <Printer size={15} color="var(--primary-600)" />
                      </button>
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
    </div>
  );
};
