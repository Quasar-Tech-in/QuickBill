import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  FileSpreadsheet,
  MapPin,
  Search,
  Filter,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { DateRangePicker, DateRangeValue, calculatePresetDates, formatIsoToDisplay } from '../components/DateRangePicker';
import { store } from '../services/store';
import { Invoice, Item, Expense, StoreLocation } from '../types';

type ReportType = 'PNL' | 'STOCK_VALUATION' | 'DAY_BOOK';
const VALID_REPORT_TYPES: ReportType[] = ['PNL', 'STOCK_VALUATION', 'DAY_BOOK'];

export const ReportsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as ReportType | null;
  const initialType: ReportType = (typeParam && VALID_REPORT_TYPES.includes(typeParam)) ? typeParam : 'PNL';

  const [reportType, setReportType] = useState<ReportType>(initialType);

  useEffect(() => {
    const qType = searchParams.get('type') as ReportType | null;
    if (qType && VALID_REPORT_TYPES.includes(qType) && qType !== reportType) {
      setReportType(qType);
    }
  }, [searchParams]);

  const handleReportTypeChange = (newType: ReportType) => {
    setReportType(newType);
    setSearchParams({ type: newType });
  };
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    preset: 'THIS_MONTH',
    ...calculatePresetDates('THIS_MONTH'),
  }));
  const [invoices, setInvoices] = useState<Invoice[]>(store.getInvoices(selectedLocationId));
  const [items, setItems] = useState<Item[]>(store.getItems(selectedLocationId, true));
  const [expenses, setExpenses] = useState<Expense[]>(() => store.getExpenses(selectedLocationId));
  const [locations, setLocations] = useState<StoreLocation[]>(() => store.getAllLocations());
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invData, itemData, expData, locs] = await Promise.all([
        store.fetchInvoices(selectedLocationId),
        store.fetchItems(selectedLocationId),
        store.fetchExpenses(selectedLocationId),
        store.fetchLocations()
      ]);
      setInvoices(invData);
      setItems(itemData);
      setExpenses(expData);
      setLocations(locs);
      
      // Extract unique categories
      const cats = Array.from(new Set(itemData.map(i => i.category).filter(Boolean)));
      setCategories(cats);
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial sync from local store
    setInvoices(store.getInvoices(selectedLocationId));
    setItems(store.getItems(selectedLocationId, true));
    setExpenses(store.getExpenses(selectedLocationId));
    setLocations(store.getAllLocations());
    
    // Fetch live from backend
    loadData();
  }, [selectedLocationId]);

  // --- Filter Invoices and Expenses by Date Range ---
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = inv.date || (inv.createdAt ? inv.createdAt.split('T')[0] : '');
      if (dateRange.preset === 'ALL') return true;
      if (dateRange.fromDate && invDate < dateRange.fromDate) return false;
      if (dateRange.toDate && invDate > dateRange.toDate) return false;
      return true;
    });
  }, [invoices, dateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = exp.expenseDate || (exp.createdAt ? exp.createdAt.split('T')[0] : '');
      if (dateRange.preset === 'ALL') return true;
      if (dateRange.fromDate && expDate < dateRange.fromDate) return false;
      if (dateRange.toDate && expDate > dateRange.toDate) return false;
      return true;
    });
  }, [expenses, dateRange]);

  // --- Accurate GST & Financial Metrics (Tax-Inclusive Rates Reconciliation) ---
  const totalRevenue = filteredInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const totalTaxCollected = filteredInvoices.reduce((s, i) => s + (Number(i.taxTotal) || 0), 0);
  const totalSalesReturns = filteredInvoices.reduce((s, i) => s + (Number(i.returnTotal) || 0), 0);
  
  // Tax-Exclusive Net Turnover (Subtotal is already the tax-exclusive base when rates are tax-inclusive)
  const totalNetSales = Math.max(0, filteredInvoices.reduce((s, i) => {
    const base = i.subtotal !== undefined ? Number(i.subtotal) : (Number(i.grandTotal || 0) - Number(i.taxTotal || 0));
    return s + base;
  }, 0) - totalSalesReturns);
  
  // Accurate Cost of Goods Sold (COGS) from inventory purchase prices
  const actualCOGS = useMemo(() => {
    let cogs = 0;
    filteredInvoices.forEach(inv => {
      if (inv.type === 'SALE' && inv.status !== 'CANCELLED') {
        inv.items?.forEach(line => {
          const catItem = items.find(it => it.id === line.itemId || it.publicItemId === line.itemId);
          const costPrice = Number(catItem?.purchasePrice !== undefined ? catItem.purchasePrice : (line.unitPrice * 0.70));
          const netQty = Math.max(0, Number(line.quantity || 0) - Number(line.returnedQuantity || 0));
          if (netQty > 0) {
            cogs += costPrice * netQty;
          }
        });
      }
    });
    return Number(cogs.toFixed(2));
  }, [filteredInvoices, items]);

  const grossProfit = Math.max(0, totalNetSales - actualCOGS);
  const operatingExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = grossProfit - operatingExpenses;

  // GST Slabs Breakdown (Output Tax Liability by Rate)
  const gstSlabBreakdown = useMemo(() => {
    const slabs: Record<string, { rate: number; taxable: number; cgst: number; sgst: number; totalTax: number }> = {
      '0': { rate: 0, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 },
      '5': { rate: 5, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 },
      '12': { rate: 12, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 },
      '18': { rate: 18, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 },
      '28': { rate: 28, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 },
    };

    filteredInvoices.forEach(inv => {
      if (inv.type === 'SALE' && inv.status !== 'CANCELLED') {
        inv.items?.forEach(line => {
          const rateKey = String(Math.round(Number(line.taxRate || 0)));
          if (!slabs[rateKey]) {
            slabs[rateKey] = { rate: Number(line.taxRate || 0), taxable: 0, cgst: 0, sgst: 0, totalTax: 0 };
          }
          const lineTax = Number(line.taxAmount || 0);
          const lineTotal = Number(line.total || (line.unitPrice * line.quantity));
          const lineTaxable = Number(line.taxableAmount !== undefined ? line.taxableAmount : (lineTotal - lineTax));
          
          slabs[rateKey].taxable += lineTaxable;
          slabs[rateKey].totalTax += lineTax;
          slabs[rateKey].cgst += lineTax / 2;
          slabs[rateKey].sgst += lineTax / 2;
        });
      }
    });

    return Object.values(slabs).filter(s => s.taxable > 0 || s.totalTax > 0);
  }, [filteredInvoices]);

  // Filtered Stock Items for Valuation Tab
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (selectedCategory !== 'ALL' && i.category !== selectedCategory) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = i.name.toLowerCase().includes(q);
        const matchSku = i.sku ? i.sku.toLowerCase().includes(q) : false;
        const matchCode = i.publicItemId ? i.publicItemId.toLowerCase().includes(q) : false;
        const matchCategory = i.category ? i.category.toLowerCase().includes(q) : false;
        if (!matchName && !matchSku && !matchCode && !matchCategory) return false;
      }
      return true;
    });
  }, [items, selectedCategory, searchTerm]);

  // Stock Valuation Metrics (Computed on full dataset or filtered view)
  const totalItemsCount = items.length;
  const totalUnitsInStock = items.reduce((s, i) => s + (Number(i.currentStock) || 0), 0);
  const totalStockValueRetail = items.reduce((s, i) => s + ((Number(i.currentStock) || 0) * (Number(i.salePrice) || 0)), 0);
  const totalStockValueCost = items.reduce((s, i) => s + ((Number(i.currentStock) || 0) * (Number(i.purchasePrice) || 0)), 0);
  const potentialInventoryProfit = totalStockValueRetail - totalStockValueCost;
  const marginPercentage = totalStockValueRetail > 0 ? ((potentialInventoryProfit / totalStockValueRetail) * 100) : 0;

  // Filtered summary metrics for the table
  const filteredUnits = filteredItems.reduce((s, i) => s + (Number(i.currentStock) || 0), 0);
  const filteredCostValuation = filteredItems.reduce((s, i) => s + ((Number(i.currentStock) || 0) * (Number(i.purchasePrice) || 0)), 0);
  const filteredRetailValuation = filteredItems.reduce((s, i) => s + ((Number(i.currentStock) || 0) * (Number(i.salePrice) || 0)), 0);
  const filteredProfit = filteredRetailValuation - filteredCostValuation;

  // Export CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (reportType === 'STOCK_VALUATION') {
      csvContent += 'Item Code,Product Name,Category,Stock Qty,Unit,Cost Price,Sale Price,Valuation (Cost),Valuation (Retail),Potential Profit,Status\n';
      filteredItems.forEach(i => {
        const stock = Number(i.currentStock) || 0;
        const cost = Number(i.purchasePrice) || 0;
        const sale = Number(i.salePrice) || 0;
        const costVal = stock * cost;
        const retailVal = stock * sale;
        const profit = retailVal - costVal;
        const status = stock <= 0 ? 'OUT_OF_STOCK' : (stock <= (i.minStockAlert || 5) ? 'LOW_STOCK' : 'IN_STOCK');
        csvContent += `"${i.publicItemId || i.id}","${i.name.replace(/"/g, '""')}","${i.category || 'General'}",${stock},"${i.unit || 'pcs'}",${cost.toFixed(2)},${sale.toFixed(2)},${costVal.toFixed(2)},${retailVal.toFixed(2)},${profit.toFixed(2)},"${status}"\n`;
      });
    } else if (reportType === 'PNL') {
      csvContent += 'Financial Metric,Amount (INR),Notes\n';
      csvContent += `"Gross Total Billed Revenue (Tax Inclusive)",${totalRevenue.toFixed(2)},"Total amount collected from customers"\n`;
      csvContent += `"Less: Output GST Collected",-${totalTaxCollected.toFixed(2)},"100% segregated tax collected on behalf of Govt"\n`;
      csvContent += `"Net Taxable Turnover (Ex-Tax Sales)",${totalNetSales.toFixed(2)},"True net sales revenue"\n`;
      csvContent += `"Less: Actual Cost of Goods Sold (COGS)",-${actualCOGS.toFixed(2)},"Actual inventory asset acquisition cost"\n`;
      csvContent += `"Gross Trading Margin",${grossProfit.toFixed(2)},"Net Sales minus COGS"\n`;
      csvContent += `"Less: Operating Expenses",-${operatingExpenses.toFixed(2)},"Store operations, rent, utilities, staff"\n`;
      csvContent += `"Net Profit / (Loss)",${netProfit.toFixed(2)},"Bottom-line profit"\n`;
    } else {
      csvContent += 'Invoice Number,Date,Branch,Party,Payment Mode,Taxable Subtotal,GST Total,Grand Total,Status\n';
      invoices.forEach(i => {
        csvContent += `"${i.invoiceNumber}","${i.date}","${i.locationName || 'Main Store'}","${(i.partyName || 'Walk-in').replace(/"/g, '""')}","${i.paymentMode}",${i.subtotal || 0},${i.taxTotal || 0},${i.grandTotal || 0},"${i.status}"\n`;
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

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Universal Date Range Filter (DD-MM-YYYY) */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />

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

          <button className="btn btn-secondary" onClick={loadData} disabled={isLoading} title="Refresh Data">
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} color="var(--success-600)" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Scope Pill */}
      <div style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '5px 14px', background: 'var(--neutral-100)', borderRadius: 20, fontSize: '0.78rem', color: 'var(--neutral-700)', fontWeight: 600 }}>
        <span>Analytics Filter:</span>
        <span style={{ color: 'var(--primary-700)' }}>
          {selectedLocationId === 'ALL' ? '🌐 All Store Branches' : `📍 ${activeLocObj?.name} (${activeLocObj?.code})`}
        </span>
        <span>•</span>
        <span style={{ color: 'var(--primary-700)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={13} />
          {dateRange.preset === 'ALL' ? 'All-Time Period' : `${formatIsoToDisplay(dateRange.fromDate)} to ${formatIsoToDisplay(dateRange.toDate)}`}
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
            onClick={() => handleReportTypeChange(tab.id as any)}
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
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* P&L View */}
      {reportType === 'PNL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
            {/* Income Summary Card */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Trading & Income Statement ({selectedLocationId === 'ALL' ? 'Consolidated' : activeLocObj?.name})</h3>
                <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 12, backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontWeight: 700 }}>
                  GST Inclusive Rates
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)' }}>
                  <span style={{ color: 'var(--neutral-600)', fontWeight: 600 }}>Gross Total Sales (Tax-Inclusive):</span>
                  <span style={{ fontWeight: 800 }}>₹{totalRevenue.toFixed(2)}</span>
                </div>
                {totalSalesReturns > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: 'var(--danger-600)' }}>
                    <span>Less: Sales Returns & Refunds:</span>
                    <span>-₹{totalSalesReturns.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: '#d97706' }}>
                  <span>Less: Output GST Collected (Inclusive Tax):</span>
                  <span style={{ fontWeight: 700 }}>-₹{totalTaxCollected.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                  <span>Net Taxable Turnover (Ex-Tax Sales):</span>
                  <span style={{ fontWeight: 800 }}>₹{totalNetSales.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: 'var(--danger-600)' }}>
                  <span>Less: Cost of Goods Sold (Actual COGS):</span>
                  <span>-₹{actualCOGS.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--neutral-200)', borderBottom: '2px solid var(--neutral-200)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-700)' }}>
                  <span>Gross Trading Margin:</span>
                  <span>₹{grossProfit.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--neutral-100)', color: 'var(--neutral-500)' }}>
                  <span>Less: Operating Expenses:</span>
                  <span>-₹{operatingExpenses.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, backgroundColor: netProfit >= 0 ? 'var(--success-50)' : 'var(--danger-50)', borderRadius: 'var(--radius-md)', fontWeight: 800, fontSize: '1.2rem', color: netProfit >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
                  <span>Net Profit / (Loss):</span>
                  <span>₹{netProfit.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Quick Insights & KPI Card */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Key Performance Indicators</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>Gross Trading Margin</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {totalNetSales > 0 ? ((grossProfit / totalNetSales) * 100).toFixed(1) : 0}%
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Based on actual inventory acquisition costs</span>
                </div>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>Net Profit Margin</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: netProfit >= 0 ? 'var(--success-700)' : 'var(--danger-600)' }}>
                    {totalNetSales > 0 ? ((netProfit / totalNetSales) * 100).toFixed(1) : 0}%
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Net earnings after all store expenses</span>
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

          {/* GST Tax Output & Slab Breakdown Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 className="card-title">GST Tax Liability & Output Rate Breakdown</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                  Summary of tax collected across rate slabs for filing GSTR-1 and tax compliance.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontWeight: 600 }}>Total Output GST:</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-700)' }}>₹{totalTaxCollected.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tax Rate Slab</th>
                    <th style={{ textAlign: 'right' }}>Taxable Turnover (Ex-Tax Base)</th>
                    <th style={{ textAlign: 'right' }}>Central GST (CGST)</th>
                    <th style={{ textAlign: 'right' }}>State GST (SGST)</th>
                    <th style={{ textAlign: 'right' }}>Total Output Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {gstSlabBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--neutral-400)' }}>
                        No tax-bearing transactions found for the selected branch.
                      </td>
                    </tr>
                  ) : (
                    gstSlabBreakdown.map((slab) => (
                      <tr key={slab.rate}>
                        <td style={{ fontWeight: 700 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontSize: '0.8rem' }}>
                            GST @ {slab.rate}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{slab.taxable.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--neutral-600)' }}>
                          ₹{slab.cgst.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--neutral-600)' }}>
                          ₹{slab.sgst.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary-700)' }}>
                          ₹{slab.totalTax.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {gstSlabBreakdown.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--neutral-50)', fontWeight: 800 }}>
                      <td>Total Consolidated Output GST:</td>
                      <td style={{ textAlign: 'right' }}>₹{totalNetSales.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>₹{(totalTaxCollected / 2).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>₹{(totalTaxCollected / 2).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary-700)' }}>₹{totalTaxCollected.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--neutral-50)', borderTop: '1px solid var(--neutral-200)', fontSize: '0.78rem', color: 'var(--neutral-600)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="var(--success-600)" />
              <span>
                <strong>Tax Reconciled:</strong> Selling rates are configured as tax-inclusive. The base turnover (₹{totalNetSales.toFixed(2)}) and GST output liability (₹{totalTaxCollected.toFixed(2)}) sum accurately to the total customer billed revenue (₹{totalRevenue.toFixed(2)}) with no double deduction.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stock Valuation View */}
      {reportType === 'STOCK_VALUATION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* Total SKUs */}
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
                <Package size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Active Products</span>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 2 }}>
                  {totalItemsCount} SKUs
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>{totalUnitsInStock.toFixed(1)} units in stock</span>
              </div>
            </div>

            {/* Total Valuation @ Cost */}
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Valuation @ Cost</span>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--neutral-900)', marginTop: 2 }}>
                  ₹{totalStockValueCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Asset purchase value</span>
              </div>
            </div>

            {/* Total Valuation @ Retail */}
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-600)' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Valuation @ Retail</span>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success-700)', marginTop: 2 }}>
                  ₹{totalStockValueRetail.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>Estimated revenue value</span>
              </div>
            </div>

            {/* Potential Profit */}
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Layers size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Unrealized Profit</span>
                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d97706', marginTop: 2 }}>
                  ₹{potentialInventoryProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--neutral-500)', fontWeight: 600 }}>
                  Margin: {marginPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', minWidth: 260, flex: 1 }}>
                <Search size={17} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--neutral-400)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search product name, SKU, or item code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: 38, width: '100%' }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--neutral-400)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Clear search"
                  >
                    <XCircle size={15} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={15} color="var(--neutral-500)" />
                  <select
                    className="form-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '0.82rem', width: 'auto', minWidth: 160 }}
                  >
                    <option value="ALL">🌐 All Categories ({items.length})</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        📁 {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--neutral-500)', fontWeight: 600 }}>
                  Showing <span style={{ color: 'var(--primary-600)', fontWeight: 700 }}>{filteredItems.length}</span> of {items.length} items
                </div>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 className="card-title">Inventory Valuation Breakdown ({selectedLocationId === 'ALL' ? 'All Branches Consolidated' : activeLocObj?.name})</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: 2 }}>
                  Detailed itemized asset valuation at purchase cost and retail price
                </p>
              </div>
            </div>

            <div className="table-responsive" style={{ overflowX: 'hidden' }}>
              <table className="table" style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Product & Details</th>
                    <th style={{ width: '16%', textAlign: 'center' }}>Current Stock</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>Cost Valuation</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>Retail Valuation</th>
                    <th style={{ width: '18%', textAlign: 'right' }}>Unrealized Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--neutral-400)' }}>
                        <Package size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600 }}>No products found matching your search or category filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((i) => {
                      const stock = Number(i.currentStock) || 0;
                      const cost = Number(i.purchasePrice) || 0;
                      const sale = Number(i.salePrice) || 0;
                      const costValuation = stock * cost;
                      const retailValuation = stock * sale;
                      const profit = retailValuation - costValuation;
                      const minAlert = Number(i.minStockAlert) || 5;
                      const isOutOfStock = stock <= 0;
                      const isLowStock = !isOutOfStock && stock <= minAlert;

                      return (
                        <tr key={i.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.88rem' }}>{i.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
                                {i.publicItemId || i.sku || i.id}
                              </span>
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: 'var(--neutral-100)', color: 'var(--neutral-600)', fontWeight: 600 }}>
                                {i.category || 'General'}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--neutral-900)' }}>
                              {stock} <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 500 }}>{i.unit || 'pcs'}</span>
                            </div>
                            <div style={{ marginTop: 2 }}>
                              {isOutOfStock ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 10, background: 'var(--danger-50)', color: 'var(--danger-700)', fontSize: '0.7rem', fontWeight: 700 }}>
                                  <XCircle size={10} /> Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 10, background: 'var(--warning-50)', color: 'var(--warning-700)', fontSize: '0.7rem', fontWeight: 700 }}>
                                  <AlertTriangle size={10} /> Low Stock
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 10, background: 'var(--success-50)', color: 'var(--success-700)', fontSize: '0.7rem', fontWeight: 700 }}>
                                  <CheckCircle2 size={10} /> In Stock
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.88rem' }}>
                              ₹{costValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                              @ ₹{cost.toFixed(2)}/unit
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary-600)', fontSize: '0.88rem' }}>
                              ₹{retailValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--neutral-400)' }}>
                              @ ₹{sale.toFixed(2)}/unit
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: profit >= 0 ? 'var(--success-700)' : 'var(--danger-600)', fontSize: '0.88rem' }}>
                              ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: profit >= 0 ? 'var(--success-600)' : 'var(--danger-500)', fontWeight: 600 }}>
                              {retailValuation > 0 ? `${((profit / retailValuation) * 100).toFixed(1)}% margin` : '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filteredItems.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--neutral-50)', fontWeight: 800 }}>
                      <td style={{ color: 'var(--neutral-800)' }}>
                        Filtered Total ({filteredItems.length} items):
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--neutral-900)' }}>
                        {filteredUnits.toFixed(1)} units
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--neutral-900)' }}>
                        ₹{filteredCostValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--primary-700)' }}>
                        ₹{filteredRetailValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--success-700)' }}>
                        ₹{filteredProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
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
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--neutral-400)' }}>
                      No transactions found for the selected period and branch.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatIsoToDisplay(inv.date || '') || inv.date}</td>
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
