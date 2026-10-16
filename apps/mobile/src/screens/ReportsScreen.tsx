import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert, 
  Share,
  ActivityIndicator
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../theme/colors';
import { store } from '../services/store';
import { Invoice, Item, PurchaseOrder, Expense, StoreLocation, Party } from '../types';

type ReportTab = 'PNL' | 'STOCK_VALUATION' | 'DAY_BOOK' | 'PURCHASES';
type PeriodPreset = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export const ReportsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('PNL');
  const [period, setPeriod] = useState<PeriodPreset>('THIS_MONTH' as any);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Search & Filter for Stock Valuation tab
  const [stockSearch, setStockSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Live Data states from store
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [items, setItems] = useState<Item[]>(() => store.getItems());
  const [expenses, setExpenses] = useState<Expense[]>(() => store.getExpenses());
  const [pos, setPos] = useState<PurchaseOrder[]>(() => store.getPurchaseOrders());
  const [locations, setLocations] = useState<StoreLocation[]>(() => store.getLocations());
  const [parties, setParties] = useState<Party[]>(() => store.getParties());

  useEffect(() => {
    // Initial fetch from backend to ensure freshness
    store.fetchInvoices();
    store.fetchItems();
    store.fetchExpenses();
    store.fetchPurchaseOrders();
    store.fetchLocations();
    store.fetchParties();

    const unsubscribe = store.subscribe(() => {
      setInvoices(store.getInvoices());
      setItems(store.getItems());
      setExpenses(store.getExpenses());
      setPos(store.getPurchaseOrders());
      setLocations(store.getLocations());
      setParties(store.getParties());
    });
    return () => { unsubscribe(); };
  }, []);

  // Compute Date Boundaries based on Period Preset
  const dateBoundaries = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'TODAY') {
      return { from: todayStr, to: todayStr };
    }
    if (period === 'WEEK') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      return { from: past7.toISOString().split('T')[0], to: todayStr };
    }
    if (period === 'MONTH' || (period as any) === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth.toISOString().split('T')[0], to: todayStr };
    }
    return { from: '', to: '' }; // ALL
  }, [period]);

  // Filter Invoices by Date & Branch
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (selectedLocationId !== 'ALL') {
        const invLocId = inv.locationId || inv.locationName;
        if (invLocId !== selectedLocationId) return false;
      }
      if (inv.status === 'CANCELLED') return false;
      const invDate = inv.date ? inv.date.split('T')[0] : '';
      if (dateBoundaries.from && invDate < dateBoundaries.from) return false;
      if (dateBoundaries.to && invDate > dateBoundaries.to) return false;
      return true;
    });
  }, [invoices, selectedLocationId, dateBoundaries]);

  // Filter Expenses by Date & Branch
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (selectedLocationId !== 'ALL' && exp.locationId && exp.locationId !== selectedLocationId) {
        return false;
      }
      const expDate = exp.expenseDate ? exp.expenseDate.split('T')[0] : '';
      if (dateBoundaries.from && expDate < dateBoundaries.from) return false;
      if (dateBoundaries.to && expDate > dateBoundaries.to) return false;
      return true;
    });
  }, [expenses, selectedLocationId, dateBoundaries]);

  // Filter Purchase Orders by Date & Branch
  const filteredPOs = useMemo(() => {
    return pos.filter(po => {
      if (selectedLocationId !== 'ALL' && po.locationId && po.locationId !== selectedLocationId) {
        return false;
      }
      if (po.status === 'CANCELLED') return false;
      const poDate = po.orderDate || (po.createdAt ? po.createdAt.split('T')[0] : '');
      if (dateBoundaries.from && poDate < dateBoundaries.from) return false;
      if (dateBoundaries.to && poDate > dateBoundaries.to) return false;
      return true;
    });
  }, [pos, selectedLocationId, dateBoundaries]);

  // --- Financial Calculations (Trading P&L Web Parity) ---
  const totalInvoicedRevenue = filteredInvoices.reduce((acc, inv) => acc + (Number(inv.grandTotal) || 0), 0);
  const totalTaxCollected = filteredInvoices.reduce((acc, inv) => acc + (Number(inv.taxTotal) || 0), 0);
  const totalSalesReturns = filteredInvoices.reduce((acc, inv) => acc + (Number(inv.returnTotal) || 0), 0);

  // Tax-Exclusive Net Turnover
  const totalNetSales = Math.max(0, filteredInvoices.reduce((s, i) => {
    const base = i.subtotal !== undefined ? Number(i.subtotal) : (Number(i.grandTotal || 0) - Number(i.taxTotal || 0));
    return s + base;
  }, 0) - totalSalesReturns);

  // True Server-Authoritative Cost of Goods Sold (COGS)
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
  const grossMargin = totalNetSales > 0 ? ((grossProfit / totalNetSales) * 100) : 0;
  const totalOperatingExpenses = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = grossProfit - totalOperatingExpenses;
  const netMargin = totalNetSales > 0 ? ((netProfit / totalNetSales) * 100) : 0;

  // GST Slabs Liability Breakdown (0%, 5%, 12%, 18%, 28%)
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

  // --- Stock Valuation Metrics ---
  const categories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (selectedCategory !== 'ALL' && it.category !== selectedCategory) return false;
      if (stockSearch.trim()) {
        const q = stockSearch.toLowerCase().trim();
        const mName = it.name.toLowerCase().includes(q);
        const mSku = it.sku ? it.sku.toLowerCase().includes(q) : false;
        const mCode = it.publicItemId ? it.publicItemId.toLowerCase().includes(q) : false;
        if (!mName && !mSku && !mCode) return false;
      }
      return true;
    });
  }, [items, selectedCategory, stockSearch]);

  const totalStockUnits = items.reduce((s, i) => s + (Number(i.currentStock) || 0), 0);
  const totalStockValuationCost = items.reduce((s, i) => s + ((Number(i.currentStock) || 0) * (Number(i.purchasePrice) || 0)), 0);
  const totalStockValuationRetail = items.reduce((s, i) => s + ((Number(i.currentStock) || 0) * (Number(i.salePrice) || 0)), 0);
  const potentialInventoryProfit = totalStockValuationRetail - totalStockValuationCost;
  const stockMarginPct = totalStockValuationRetail > 0 ? ((potentialInventoryProfit / totalStockValuationRetail) * 100) : 0;

  // --- Day Book Breakdown ---
  const dayBookStats = useMemo(() => {
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let bankSales = 0;
    let duesCollected = 0;

    filteredInvoices.forEach(inv => {
      const mode = inv.paymentMode || 'CASH';
      const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : inv.grandTotal);
      if (mode === 'CASH') cashSales += paid;
      else if (mode === 'UPI') upiSales += paid;
      else if (mode === 'CARD') cardSales += paid;
      else if (mode === 'BANK_TRANSFER') bankSales += paid;
      else cashSales += paid;

      // Customer payments towards partial balance
      const invPayments = (inv as any).payments;
      if (invPayments && Array.isArray(invPayments) && invPayments.length > 1) {
        invPayments.slice(1).forEach((p: any) => {
          duesCollected += Number(p.amount || 0);
        });
      }
    });

    let cashExpense = 0;
    let digitalExpense = 0;
    filteredExpenses.forEach(exp => {
      if (exp.paymentMode === 'CASH') cashExpense += Number(exp.amount || 0);
      else digitalExpense += Number(exp.amount || 0);
    });

    const totalInflow = cashSales + upiSales + cardSales + bankSales;
    const totalOutflow = totalOperatingExpenses;
    const netCashflow = totalInflow - totalOutflow;

    return {
      cashSales,
      upiSales,
      cardSales,
      bankSales,
      duesCollected,
      totalInflow,
      cashExpense,
      digitalExpense,
      totalOutflow,
      netCashflow,
    };
  }, [filteredInvoices, filteredExpenses, totalOperatingExpenses]);

  // --- Purchases & Procurement Breakdown ---
  const poStats = useMemo(() => {
    const totalOrdered = filteredPOs.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);
    const totalReceived = filteredPOs.reduce((s, p) => s + (p.totalReceivedAmount !== undefined ? p.totalReceivedAmount : (p.status === 'FULLY_RECEIVED' ? p.grandTotal : 0)), 0);
    const totalPaid = filteredPOs.reduce((s, p) => s + (Number(p.totalPaidAmount) || 0), 0);
    const totalBalanceDue = filteredPOs.reduce((s, p) => s + (p.balanceDue !== undefined ? p.balanceDue : Math.max(0, (p.totalReceivedAmount || p.grandTotal) - (p.totalPaidAmount || 0))), 0);
    const totalInputTax = filteredPOs.reduce((s, p) => s + (Number(p.taxTotal) || 0), 0);

    const supplierDues = parties
      .filter(p => p.type === 'SUPPLIER' || p.currentBalance < 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        payable: p.currentBalance < 0 ? Math.abs(p.currentBalance) : 0,
      }))
      .filter(p => p.payable > 0);

    return {
      totalOrdered,
      totalReceived,
      totalPaid,
      totalBalanceDue,
      totalInputTax,
      supplierDues,
    };
  }, [filteredPOs, parties]);

  // --- Export Report Handlers ---
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      let csvContent = `QuickBill Financial Statement\n`;
      csvContent += `Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `Period: ${period}\n`;
      csvContent += `Branch: ${selectedLocationId === 'ALL' ? 'All Branches' : selectedLocationId}\n\n`;

      if (activeTab === 'PNL') {
        csvContent += `Metric,Amount (INR)\n`;
        csvContent += `Gross Invoiced Revenue,${totalInvoicedRevenue.toFixed(2)}\n`;
        csvContent += `Sales Returns & Refunds,-${totalSalesReturns.toFixed(2)}\n`;
        csvContent += `Net Sales Turnover,${totalNetSales.toFixed(2)}\n`;
        csvContent += `Cost of Goods Sold (COGS),-${actualCOGS.toFixed(2)}\n`;
        csvContent += `Gross Profit,${grossProfit.toFixed(2)}\n`;
        csvContent += `Gross Margin (%),${grossMargin.toFixed(2)}%\n`;
        csvContent += `Operating Expenses,-${totalOperatingExpenses.toFixed(2)}\n`;
        csvContent += `Net Profit / Loss,${netProfit.toFixed(2)}\n`;
        csvContent += `Net Margin (%),${netMargin.toFixed(2)}%\n`;
        csvContent += `Output GST Collected,${totalTaxCollected.toFixed(2)}\n\n`;

        csvContent += `GST Slab Breakdown\nRate %,Taxable Base,CGST,SGST,Total GST\n`;
        gstSlabBreakdown.forEach(s => {
          csvContent += `${s.rate}%,${s.taxable.toFixed(2)},${s.cgst.toFixed(2)},${s.sgst.toFixed(2)},${s.totalTax.toFixed(2)}\n`;
        });
      } else if (activeTab === 'STOCK_VALUATION') {
        csvContent += `Item Name,SKU,Category,Current Stock,Unit,Cost Price,Retail Price,Total Cost Value,Total Retail Value\n`;
        filteredItems.forEach(it => {
          const costVal = (Number(it.currentStock) || 0) * (Number(it.purchasePrice) || 0);
          const retailVal = (Number(it.currentStock) || 0) * (Number(it.salePrice) || 0);
          csvContent += `"${it.name}","${it.sku || ''}","${it.category}","${it.currentStock}","${it.unit}","${it.purchasePrice}","${it.salePrice}","${costVal.toFixed(2)}","${retailVal.toFixed(2)}"\n`;
        });
      } else if (activeTab === 'DAY_BOOK') {
        csvContent += `Cash Inflow / Outflow,Amount (INR)\n`;
        csvContent += `Cash Inflow (Sales),${dayBookStats.cashSales.toFixed(2)}\n`;
        csvContent += `UPI Payments Received,${dayBookStats.upiSales.toFixed(2)}\n`;
        csvContent += `Card Payments Received,${dayBookStats.cardSales.toFixed(2)}\n`;
        csvContent += `Bank Transfers,${dayBookStats.bankSales.toFixed(2)}\n`;
        csvContent += `Total Daily Inflow,${dayBookStats.totalInflow.toFixed(2)}\n`;
        csvContent += `Cash Expenses Outflow,-${dayBookStats.cashExpense.toFixed(2)}\n`;
        csvContent += `Digital Expenses Outflow,-${dayBookStats.digitalExpense.toFixed(2)}\n`;
        csvContent += `Total Daily Outflow,-${dayBookStats.totalOutflow.toFixed(2)}\n`;
        csvContent += `Net Daily Cashflow,${dayBookStats.netCashflow.toFixed(2)}\n`;
      } else {
        csvContent += `Purchase Metric,Amount (INR)\n`;
        csvContent += `Total POs Ordered,${poStats.totalOrdered.toFixed(2)}\n`;
        csvContent += `Goods Inwarded (GRN),${poStats.totalReceived.toFixed(2)}\n`;
        csvContent += `Supplier Payments Disbursed,${poStats.totalPaid.toFixed(2)}\n`;
        csvContent += `Balance Payable Due,${poStats.totalBalanceDue.toFixed(2)}\n`;
        csvContent += `Input Tax Credit (ITC),${poStats.totalInputTax.toFixed(2)}\n`;
      }

      const fileName = `QuickBill_Report_${activeTab}_${Date.now()}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${activeTab} Report CSV`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        await Share.share({
          message: csvContent,
          title: `QuickBill Report: ${activeTab}`,
        });
      }
    } catch (e: any) {
      console.error('Export CSV failed:', e);
      Alert.alert('Export Error', e?.message || 'Could not export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const business = store.getBusinessProfile();
      const activeLoc = store.getActiveLocation();
      const dateLabel = period === 'TODAY' ? 'Today' : period === 'WEEK' ? 'This Week' : period === 'MONTH' ? 'This Month' : 'All Time';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Financial Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
            .kpi-row { display: flex; gap: 12px; margin-bottom: 20px; }
            .kpi-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .kpi-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 20px; font-weight: 800; color: #0284c7; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
            td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
            .num { text-align: right; }
            .bold { font-weight: 800; }
            .green { color: #16a34a; }
            .red { color: #dc2626; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${business.name || 'QuickBill Store'}</h1>
            <div class="subtitle">${business.address || activeLoc.address || 'Retail Counter'} • GSTIN: ${business.gstin || activeLoc.gstin || 'N/A'}</div>
            <div class="subtitle"><strong>Statement:</strong> ${activeTab} • <strong>Period:</strong> ${dateLabel} • <strong>Generated:</strong> ${new Date().toLocaleString()}</div>
          </div>

          <div class="kpi-row">
            <div class="kpi-box">
              <div class="kpi-label">Net Sales Revenue</div>
              <div class="kpi-val">₹${totalNetSales.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">COGS (Actual)</div>
              <div class="kpi-val" style="color: #dc2626;">₹${actualCOGS.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Operating Expenses</div>
              <div class="kpi-val" style="color: #ea580c;">₹${totalOperatingExpenses.toFixed(2)}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">Net Profit</div>
              <div class="kpi-val" style="color: #16a34a;">₹${netProfit.toFixed(2)}</div>
            </div>
          </div>

          <h3>Trading & Profit & Loss Statement</h3>
          <table>
            <thead>
              <tr>
                <th>Financial Item</th>
                <th class="num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Gross Invoiced Turnover (+)</td><td class="num">₹${totalInvoicedRevenue.toFixed(2)}</td></tr>
              <tr><td>Sales Returns & Defect Refunds (-)</td><td class="num red">-₹${totalSalesReturns.toFixed(2)}</td></tr>
              <tr class="bold"><td>Net Turnover Base</td><td class="num">₹${totalNetSales.toFixed(2)}</td></tr>
              <tr><td>Output GST Tax Liability Collected</td><td class="num">₹${totalTaxCollected.toFixed(2)}</td></tr>
              <tr><td>Cost of Goods Sold (Catalog Purchase Valuation) (-)</td><td class="num red">-₹${actualCOGS.toFixed(2)}</td></tr>
              <tr class="bold green"><td>Gross Trading Profit (${grossMargin.toFixed(1)}% Margin)</td><td class="num green">₹${grossProfit.toFixed(2)}</td></tr>
              <tr><td>Operating Expenses & Overheads (-)</td><td class="num red">-₹${totalOperatingExpenses.toFixed(2)}</td></tr>
              <tr class="bold" style="background: #f0fdf4;"><td>Net Realized Profit (${netMargin.toFixed(1)}% Margin)</td><td class="num green" style="font-size: 13px;">₹${netProfit.toFixed(2)}</td></tr>
            </tbody>
          </table>

          <h3 style="margin-top: 24px;">GST Slabs Output Liability</h3>
          <table>
            <thead>
              <tr>
                <th>Tax Slab</th>
                <th class="num">Taxable Base (₹)</th>
                <th class="num">CGST (₹)</th>
                <th class="num">SGST (₹)</th>
                <th class="num">Total Tax (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${gstSlabBreakdown.map(s => `
                <tr>
                  <td>${s.rate}% GST</td>
                  <td class="num">₹${s.taxable.toFixed(2)}</td>
                  <td class="num">₹${s.cgst.toFixed(2)}</td>
                  <td class="num">₹${s.sgst.toFixed(2)}</td>
                  <td class="num bold">₹${s.totalTax.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Generated securely by QuickBill • ${business.name} • Automated Double-Entry Statement
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${activeTab} Financial PDF`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Created', `Report PDF generated at: ${uri}`);
      }
    } catch (e: any) {
      console.error('Export PDF failed:', e);
      Alert.alert('PDF Export Error', e?.message || 'Could not generate PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period Filter Selector */}
      <View style={styles.filterBar}>
        <View style={styles.periodRow}>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'WEEK', label: '7 Days' },
            { id: 'MONTH', label: 'This Month' },
            { id: 'ALL', label: 'All Time' },
          ].map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              onPress={() => setPeriod(p.id as PeriodPreset)}
            >
              <Text style={[styles.periodBtnText, period === p.id && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Branch / Location Filter if multi-branch */}
        {locations.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationScroll}>
            <TouchableOpacity
              style={[styles.locChip, selectedLocationId === 'ALL' && styles.locChipActive]}
              onPress={() => setSelectedLocationId('ALL')}
            >
              <Text style={[styles.locChipText, selectedLocationId === 'ALL' && styles.locChipTextActive]}>
                🏢 All Branches ({locations.length})
              </Text>
            </TouchableOpacity>
            {locations.map(loc => (
              <TouchableOpacity
                key={loc.id}
                style={[styles.locChip, selectedLocationId === loc.id && styles.locChipActive]}
                onPress={() => setSelectedLocationId(loc.id)}
              >
                <Text style={[styles.locChipText, selectedLocationId === loc.id && styles.locChipTextActive]}>
                  📍 {loc.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Segmented Report Navigation Tabs */}
      <View style={styles.navTabs}>
        <TouchableOpacity 
          style={[styles.navTab, activeTab === 'PNL' && styles.navTabActive]} 
          onPress={() => setActiveTab('PNL')}
        >
          <Text style={[styles.navTabText, activeTab === 'PNL' && styles.navTabTextActive]}>📊 Trading P&L</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navTab, activeTab === 'STOCK_VALUATION' && styles.navTabActive]} 
          onPress={() => setActiveTab('STOCK_VALUATION')}
        >
          <Text style={[styles.navTabText, activeTab === 'STOCK_VALUATION' && styles.navTabTextActive]}>📦 Stock Value</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navTab, activeTab === 'DAY_BOOK' && styles.navTabActive]} 
          onPress={() => setActiveTab('DAY_BOOK')}
        >
          <Text style={[styles.navTabText, activeTab === 'DAY_BOOK' && styles.navTabTextActive]}>📒 Day Book</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navTab, activeTab === 'PURCHASES' && styles.navTabActive]} 
          onPress={() => setActiveTab('PURCHASES')}
        >
          <Text style={[styles.navTabText, activeTab === 'PURCHASES' && styles.navTabTextActive]}>🛒 Procurement</Text>
        </TouchableOpacity>
      </View>

      {/* ================= TAB 1: TRADING P&L ================= */}
      {activeTab === 'PNL' && (
        <>
          {/* Main Financial KPI Banner */}
          <View style={styles.kpiCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.kpiLabel}>Net Profit / Loss ({period})</Text>
              <View style={[styles.marginBadge, { backgroundColor: netProfit >= 0 ? colors.success[50] : colors.danger[50] }]}>
                <Text style={[styles.marginBadgeText, { color: netProfit >= 0 ? colors.success[700] : colors.danger[700] }]}>
                  {netMargin.toFixed(1)}% Net Margin
                </Text>
              </View>
            </View>
            <Text style={[styles.kpiAmount, { color: netProfit >= 0 ? colors.success[700] : colors.danger[700] }]}>
              ₹ {netProfit.toFixed(2)}
            </Text>

            <View style={styles.kpiGrid}>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Net Turnover</Text>
                <Text style={styles.gridVal}>₹ {totalNetSales.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Actual COGS</Text>
                <Text style={[styles.gridVal, { color: colors.danger[600] }]}>₹ {actualCOGS.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Expenses</Text>
                <Text style={[styles.gridVal, { color: colors.warning[700] }]}>₹ {totalOperatingExpenses.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Detailed Trading P&L Card */}
          <Text style={styles.sectionHeading}>📋 Authoritative Trading Statement</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Gross Invoiced Turnover (+)</Text>
              <Text style={styles.rowVal}>₹ {totalInvoicedRevenue.toFixed(2)}</Text>
            </View>

            {totalSalesReturns > 0 && (
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.danger[600] }]}>Sales Returns & Refunds (-)</Text>
                <Text style={[styles.rowVal, { color: colors.danger[600] }]}>-₹ {totalSalesReturns.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Tax-Exclusive Net Sales</Text>
              <Text style={[styles.rowVal, { fontWeight: '700' }]}>₹ {totalNetSales.toFixed(2)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.danger[600] }]}>Cost of Goods Sold (Catalog Cost) (-)</Text>
              <Text style={[styles.rowVal, { color: colors.danger[600] }]}>-₹ {actualCOGS.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View>
                <Text style={[styles.rowLabel, { fontWeight: '800', color: colors.neutral[900] }]}>Gross Profit</Text>
                <Text style={{ fontSize: 10, color: colors.neutral[500] }}>Margin: {grossMargin.toFixed(1)}%</Text>
              </View>
              <Text style={[styles.rowVal, { fontWeight: '800', color: colors.success[700], fontSize: 14 }]}>
                ₹ {grossProfit.toFixed(2)}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.warning[800] }]}>Operating Expenses & Overheads (-)</Text>
              <Text style={[styles.rowVal, { color: colors.warning[800] }]}>-₹ {totalOperatingExpenses.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View>
                <Text style={[styles.rowLabel, { fontWeight: '900', fontSize: 14, color: colors.primary[900] }]}>Net Operating Profit</Text>
                <Text style={{ fontSize: 10, color: colors.neutral[500] }}>Total Bills: {filteredInvoices.length}</Text>
              </View>
              <Text style={[styles.rowVal, { fontWeight: '900', fontSize: 16, color: netProfit >= 0 ? colors.success[700] : colors.danger[700] }]}>
                ₹ {netProfit.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* GST Slabs Breakdown */}
          <Text style={styles.sectionHeading}>🏛️ GST Output Liability Breakdown</Text>
          <View style={styles.card}>
            {gstSlabBreakdown.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.neutral[500], paddingVertical: 6 }}>No taxable sales recorded in this period.</Text>
            ) : (
              gstSlabBreakdown.map((s, idx) => (
                <View key={s.rate} style={[styles.gstRow, idx < gstSlabBreakdown.length - 1 && styles.gstRowBorder]}>
                  <View style={styles.gstBadge}>
                    <Text style={styles.gstBadgeText}>{s.rate}% GST</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 11, color: colors.neutral[600] }}>
                      Taxable: <Text style={{ fontWeight: '700', color: colors.neutral[900] }}>₹{s.taxable.toFixed(2)}</Text>
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.neutral[500], marginTop: 2 }}>
                      CGST: ₹{s.cgst.toFixed(2)} • SGST: ₹{s.sgst.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary[700] }}>
                    ₹{s.totalTax.toFixed(2)}
                  </Text>
                </View>
              ))
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '800' }]}>Total GST Tax Liability</Text>
              <Text style={[styles.rowVal, { fontWeight: '800', color: colors.primary[700] }]}>
                ₹ {totalTaxCollected.toFixed(2)}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ================= TAB 2: STOCK VALUATION ================= */}
      {activeTab === 'STOCK_VALUATION' && (
        <>
          {/* Stock KPI Banner */}
          <View style={[styles.kpiCard, { backgroundColor: colors.warning[50], borderColor: colors.warning[200] }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.kpiLabel, { color: colors.warning[800] }]}>Inventory Asset Valuation (At Cost)</Text>
              <View style={[styles.marginBadge, { backgroundColor: '#fff' }]}>
                <Text style={[styles.marginBadgeText, { color: colors.warning[800] }]}>
                  {stockMarginPct.toFixed(1)}% Markup
                </Text>
              </View>
            </View>
            <Text style={[styles.kpiAmount, { color: colors.warning[900] }]}>
              ₹ {totalStockValuationCost.toFixed(2)}
            </Text>

            <View style={[styles.kpiGrid, { borderTopColor: colors.warning[200] }]}>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Catalog SKUs</Text>
                <Text style={styles.gridVal}>{items.length}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Total Units</Text>
                <Text style={styles.gridVal}>{totalStockUnits}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Retail Value</Text>
                <Text style={[styles.gridVal, { color: colors.primary[700] }]}>₹ {totalStockValuationRetail.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Search & Category Filter */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Search SKU, barcode, or product name..."
              value={stockSearch}
              onChangeText={setStockSearch}
            />
          </View>

          {categories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              <TouchableOpacity
                style={[styles.catChip, selectedCategory === 'ALL' && styles.catChipActive]}
                onPress={() => setSelectedCategory('ALL')}
              >
                <Text style={[styles.catChipText, selectedCategory === 'ALL' && styles.catChipTextActive]}>All ({items.length})</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Itemized Stock Table */}
          <Text style={styles.sectionHeading}>📦 Item Stock & Valuation ({filteredItems.length})</Text>
          <View style={styles.card}>
            {filteredItems.slice(0, 50).map((it, idx) => {
              const costVal = (Number(it.currentStock) || 0) * (Number(it.purchasePrice) || 0);
              const retailVal = (Number(it.currentStock) || 0) * (Number(it.salePrice) || 0);
              const isLowStock = Number(it.currentStock) <= (it.minStockAlert || 5);

              return (
                <View key={it.id} style={[styles.stockRow, idx < filteredItems.length - 1 && styles.stockRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.stockItemName}>{it.name}</Text>
                      {isLowStock && (
                        <View style={styles.lowStockBadge}>
                          <Text style={styles.lowStockText}>LOW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.stockItemMeta}>
                      Stock: <Text style={{ fontWeight: '800', color: colors.neutral[900] }}>{it.currentStock} {it.unit}</Text> • Cost: ₹{it.purchasePrice} • Retail: ₹{it.salePrice}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.stockItemVal}>₹{costVal.toFixed(2)}</Text>
                    <Text style={{ fontSize: 10, color: colors.neutral[500] }}>Retail: ₹{retailVal.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}
            {filteredItems.length > 50 && (
              <Text style={{ fontSize: 11, color: colors.neutral[500], textAlign: 'center', marginVertical: 6 }}>
                Showing first 50 items. Use CSV export for complete catalog.
              </Text>
            )}
          </View>
        </>
      )}

      {/* ================= TAB 3: DAY BOOK ================= */}
      {activeTab === 'DAY_BOOK' && (
        <>
          <View style={[styles.kpiCard, { backgroundColor: colors.primary[50], borderColor: colors.primary[200] }]}>
            <Text style={styles.kpiLabel}>Net Daily Cash Position ({period})</Text>
            <Text style={[styles.kpiAmount, { color: dayBookStats.netCashflow >= 0 ? colors.success[700] : colors.danger[700] }]}>
              ₹ {dayBookStats.netCashflow.toFixed(2)}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Total Inflow</Text>
                <Text style={[styles.gridVal, { color: colors.success[700] }]}>₹ {dayBookStats.totalInflow.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Total Outflow</Text>
                <Text style={[styles.gridVal, { color: colors.danger[700] }]}>₹ {dayBookStats.totalOutflow.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionHeading}>📥 Inflow by Payment Mode</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>💵 Cash Sales Counter</Text>
              <Text style={[styles.rowVal, { fontWeight: '800' }]}>₹ {dayBookStats.cashSales.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>📱 UPI QR & App Receipts</Text>
              <Text style={[styles.rowVal, { fontWeight: '800' }]}>₹ {dayBookStats.upiSales.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>💳 Card Terminal (POS)</Text>
              <Text style={[styles.rowVal, { fontWeight: '800' }]}>₹ {dayBookStats.cardSales.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>🏦 Bank Transfers / Cheques</Text>
              <Text style={[styles.rowVal, { fontWeight: '800' }]}>₹ {dayBookStats.bankSales.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '800' }]}>Total Receipts Inflow</Text>
              <Text style={[styles.rowVal, { fontWeight: '800', color: colors.success[700] }]}>
                ₹ {dayBookStats.totalInflow.toFixed(2)}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>📤 Outflow Breakdown (Expenses)</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Cash Petty Cash Disbursed</Text>
              <Text style={[styles.rowVal, { color: colors.danger[600] }]}>₹ {dayBookStats.cashExpense.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Digital Bank/UPI Expenses</Text>
              <Text style={[styles.rowVal, { color: colors.danger[600] }]}>₹ {dayBookStats.digitalExpense.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '800' }]}>Total Expense Outflow</Text>
              <Text style={[styles.rowVal, { fontWeight: '800', color: colors.danger[700] }]}>
                ₹ {dayBookStats.totalOutflow.toFixed(2)}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ================= TAB 4: PURCHASES & PROCUREMENT ================= */}
      {activeTab === 'PURCHASES' && (
        <>
          <View style={[styles.kpiCard, { backgroundColor: colors.neutral[100], borderColor: colors.neutral[300] }]}>
            <Text style={[styles.kpiLabel, { color: colors.neutral[700] }]}>Outstanding Supplier Payables</Text>
            <Text style={[styles.kpiAmount, { color: colors.danger[700] }]}>
              ₹ {poStats.totalBalanceDue.toFixed(2)}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>POs Inwarded</Text>
                <Text style={styles.gridVal}>₹ {poStats.totalReceived.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Payments Made</Text>
                <Text style={[styles.gridVal, { color: colors.success[700] }]}>₹ {poStats.totalPaid.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiGridItem}>
                <Text style={styles.gridLabel}>Input Tax (ITC)</Text>
                <Text style={styles.gridVal}>₹ {poStats.totalInputTax.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Supplier Payables List */}
          <Text style={styles.sectionHeading}>👥 Supplier Outstanding Balances ({poStats.supplierDues.length})</Text>
          <View style={styles.card}>
            {poStats.supplierDues.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.neutral[500], paddingVertical: 6 }}>All vendor accounts settled. No pending dues.</Text>
            ) : (
              poStats.supplierDues.map((sup, idx) => (
                <View key={sup.id} style={[styles.stockRow, idx < poStats.supplierDues.length - 1 && styles.stockRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stockItemName}>{sup.name}</Text>
                    <Text style={styles.stockItemMeta}>{sup.phone || 'No phone recorded'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.stockItemVal, { color: colors.danger[700] }]}>
                      ₹{sup.payable.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.danger[600] }}>Pending Due</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {/* Export Action Buttons */}
      <View style={styles.exportBtnGroup}>
        <TouchableOpacity 
          style={[styles.exportBtn, styles.exportBtnPrimary]} 
          onPress={handleExportPDF}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.exportBtnTextPrimary}>📄 Export Printable PDF</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.exportBtn, styles.exportBtnOutline]} 
          onPress={handleExportCSV}
          disabled={isExporting}
        >
          <Text style={styles.exportBtnTextOutline}>📊 Export Spreadsheet (CSV)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: 16, paddingBottom: 40 },
  filterBar: {
    marginBottom: 12,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[700],
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  periodBtnTextActive: {
    color: '#fff',
  },
  locationScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  locChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginRight: 8,
  },
  locChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  locChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  locChipTextActive: {
    color: colors.primary[800],
    fontWeight: '800',
  },
  navTabs: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[200],
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  navTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  navTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  navTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  navTabTextActive: {
    color: colors.primary[700],
    fontWeight: '800',
  },
  kpiCard: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[800],
    textTransform: 'uppercase',
  },
  marginBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  marginBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  kpiAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary[900],
    marginVertical: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.primary[200],
  },
  kpiGridItem: {
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 10,
    color: colors.neutral[600],
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[800],
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.neutral[700],
  },
  rowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: 8,
  },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gstRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  gstBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gstBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[800],
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
  },
  catScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginRight: 6,
  },
  catChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  catChipTextActive: {
    color: '#fff',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stockRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  stockItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  stockItemMeta: {
    fontSize: 10,
    color: colors.neutral[500],
    marginTop: 2,
  },
  stockItemVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  lowStockBadge: {
    backgroundColor: colors.danger[100],
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.danger[700],
  },
  exportBtnGroup: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  exportBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnPrimary: {
    backgroundColor: colors.primary[600],
  },
  exportBtnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  exportBtnTextPrimary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  exportBtnTextOutline: {
    color: colors.primary[700],
    fontSize: 13,
    fontWeight: '800',
  },
});
