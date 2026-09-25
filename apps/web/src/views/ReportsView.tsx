import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  FileSpreadsheet,
  MapPin
} from 'lucide-react';
import { store } from '../services/store';
import { Invoice, Item } from '../types';

export const ReportsView: React.FC = () => {
  const [reportType, setReportType] = useState<'PNL' | 'STOCK_VALUATION' | 'DAY_BOOK'>('PNL');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [invoices, setInvoices] = useState<Invoice[]>(store.getInvoices(selectedLocationId));
  const [items, setItems] = useState<Item[]>(selectedLocationId === 'ALL' ? store.getItems(undefined, true) : store.getItems(selectedLocationId, true));

  const locations = store.getAllLocations();

  useEffect(() => {
    store.fetchInvoices(selectedLocationId).then(data => {
      setInvoices(data);
    }).catch(() => {});
    store.fetchItems(selectedLocationId === 'ALL' ? undefined : selectedLocationId).then(data => {
      setItems(data);
    }).catch(() => {});
  }, [selectedLocationId]);

  // Financial Metrics
  const totalRevenue = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalTaxCollected = invoices.reduce((s, i) => s + i.taxTotal, 0);
  const totalNetSales = totalRevenue - totalTaxCollected;
  
  // Cost of Goods Sold (COGS) Estimation
  const estimatedCOGS = totalNetSales * 0.72; // ~72% average cost
  const grossProfit = totalNetSales - estimatedCOGS;
  const operatingExpenses = selectedLocationId === 'ALL' ? 3600.0 : 1200.0;
  const netProfit = grossProfit - operatingExpenses;

  // Stock Valuation
  const totalStockValueRetail = items.reduce((s, i) => s + (i.currentStock * i.salePrice), 0);
  const totalStockValueCost = items.reduce((s, i) => s + (i.currentStock * i.purchasePrice), 0);
  const potentialInventoryProfit = totalStockValueRetail - totalStockValueCost;

  // Export CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (reportType === 'STOCK_VALUATION') {
      csvContent += 'Item Code,Name,Category,Stock,Purchase Price,Sale Price,Valuation (Cost),Valuation (Retail)\n';
      items.forEach(i => {
        csvContent += `"${i.publicItemId}","${i.name}","${i.category}",${i.currentStock},${i.purchasePrice},${i.salePrice},${i.currentStock * i.purchasePrice},${i.currentStock * i.salePrice}\n`;
      });
    } else {
      csvContent += 'Invoice Number,Date,Branch,Party,Payment Mode,Subtotal,Tax Total,Grand Total,Status\n';
      invoices.forEach(i => {
        csvContent += `"${i.invoiceNumber}","${i.date}","${i.locationName || 'Main Store'}","${i.partyName}","${i.paymentMode}",${i.subtotal},${i.taxTotal},${i.grandTotal},"${i.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QuickBill_Report_${reportType}_${selectedLocationId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeLocObj = locations.find(l => l.id === selectedLocationId);

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Financial Reports & Branch Analytics
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: 2 }}>
            Instant Profit & Loss statements, Multi-Branch Stock Valuation, and CSV accounting exports.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Branch Location Scope Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} color="var(--primary-600)" />
            <select
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, width: 'auto' }}
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="ALL">🌐 Consolidated (All Branches)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  📍 {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} color="var(--success-600)" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Scope Pill */}
      <div style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--neutral-100)', borderRadius: 20, fontSize: '0.78rem', color: 'var(--neutral-700)', fontWeight: 600 }}>
        <span>Analytics Filter:</span>
        <span style={{ color: 'var(--primary-700)' }}>
          {selectedLocationId === 'ALL' ? '🌐 All Store Branches (Consolidated Total)' : `📍 ${activeLocObj?.name} (${activeLocObj?.code})`}
        </span>
      </div>

      {/* Report Switcher Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { id: 'PNL', label: '📊 Profit & Loss Statement' },
          { id: 'STOCK_VALUATION', label: '📦 Inventory Valuation' },
          { id: 'DAY_BOOK', label: '📅 Day Book Sales Ledger' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: reportType === tab.id ? 'var(--primary-500)' : 'var(--neutral-300)',
              backgroundColor: reportType === tab.id ? 'var(--primary-50)' : '#ffffff',
              color: reportType === tab.id ? 'var(--primary-700)' : 'var(--neutral-700)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* P&L View */}
      {reportType === 'PNL' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Income Summary Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Trading & Income Statement ({selectedLocationId === 'ALL' ? 'Consolidated' : activeLocObj?.name})</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)' }}>
                <span style={{ color: 'var(--neutral-600)', fontWeight: 600 }}>Gross Total Sales Revenue:</span>
                <span style={{ fontWeight: 800 }}>₹{totalRevenue.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: 'var(--neutral-500)' }}>
                <span>Less: GST / Output Taxes:</span>
                <span>-₹{totalTaxCollected.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', fontWeight: 700 }}>
                <span>Net Sales Revenue:</span>
                <span>₹{totalNetSales.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: 'var(--danger-600)' }}>
                <span>Less: Cost of Goods Sold (COGS):</span>
                <span>-₹{estimatedCOGS.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--neutral-200)', borderBottom: '2px solid var(--neutral-200)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-700)' }}>
                <span>Gross Margin (Profit):</span>
                <span>₹{grossProfit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: 'var(--neutral-500)' }}>
                <span>Less: Operating Expenses:</span>
                <span>-₹{operatingExpenses.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, backgroundColor: 'var(--success-50)', borderRadius: 'var(--radius-md)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--success-700)' }}>
                <span>Net Profit / (Loss):</span>
                <span>₹{netProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Insights Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Key Performance Indicators</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>Gross Profit Margin</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  {totalNetSales > 0 ? ((grossProfit / totalNetSales) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>Net Profit Margin</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-700)' }}>
                  {totalNetSales > 0 ? ((netProfit / totalNetSales) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>Total Bills Processed</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                  {invoices.length} Invoices
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Valuation View */}
      {reportType === 'STOCK_VALUATION' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="card-title">Inventory Valuation ({selectedLocationId === 'ALL' ? 'All Branches' : activeLocObj?.name})</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                Current asset value of products in stock at this location
              </p>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', textTransform: 'uppercase' }}>At Cost Price</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  ₹{totalStockValueCost.toFixed(2)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', textTransform: 'uppercase' }}>At Sale Price</span>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                  ₹{totalStockValueRetail.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Branch Stock</th>
                  <th>Cost / Unit</th>
                  <th>Total Cost Valuation</th>
                  <th>Sale / Unit</th>
                  <th>Total Retail Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 700 }}>{i.name}</td>
                    <td>{i.category}</td>
                    <td style={{ fontWeight: 600 }}>{i.currentStock} {i.unit}</td>
                    <td>₹{i.purchasePrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>₹{(i.currentStock * i.purchasePrice).toFixed(2)}</td>
                    <td>₹{i.salePrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary-600)' }}>
                      ₹{(i.currentStock * i.salePrice).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Day Book View */}
      {reportType === 'DAY_BOOK' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Day Book Journal ({selectedLocationId === 'ALL' ? 'All Branches' : activeLocObj?.name})</h3>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No</th>
                  <th>Branch Location</th>
                  <th>Party / Customer</th>
                  <th>Payment Mode</th>
                  <th>Debit / Credit</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--neutral-400)' }}>
                      No transactions found for the selected branch.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.date}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{inv.invoiceNumber}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10, background: 'var(--neutral-100)', color: 'var(--neutral-700)' }}>
                          📍 {inv.locationName || 'Main Store'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{inv.partyName}</td>
                      <td>{inv.paymentMode}</td>
                      <td style={{ color: 'var(--success-700)', fontWeight: 700 }}>Credit (Sale)</td>
                      <td style={{ fontWeight: 800 }}>₹{inv.grandTotal.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
