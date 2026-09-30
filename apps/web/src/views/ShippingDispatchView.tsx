import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Box, 
  PackageCheck, 
  Search, 
  ArrowRight, 
  Printer, 
  RefreshCw, 
  User, 
  Phone, 
  ShieldCheck, 
  Barcode, 
  Check, 
  Plus, 
  Minus,
  Sparkles
} from 'lucide-react';
import { WebcamScannerModal } from '../components/WebcamScannerModal';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { store } from '../services/store';
import { Invoice } from '../types';

interface ChecklistItem {
  itemId: string;
  name: string;
  sku: string;
  barcode: string;
  quantityRequired: number;
  quantityScanned: number;
  isVerified: boolean;
}

export const ShippingDispatchView: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>(() => store.getInvoices());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [courierPartner, setCourierPartner] = useState('In-House Rider');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchedOrderIds, setDispatchedOrderIds] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Sync with store
  useEffect(() => {
    const syncInvoices = () => {
      const invs = store.getInvoices();
      setInvoices(invs);
      if (!selectedInvoiceId && invs.length > 0) {
        setSelectedInvoiceId(invs[0].id);
      }
    };

    syncInvoices();
    const unsubscribe = store.subscribe(syncInvoices);
    return () => { unsubscribe(); };
  }, [selectedInvoiceId]);

  const activeInvoice = useMemo(() => {
    return invoices.find(inv => inv.id === selectedInvoiceId) || (invoices.length > 0 ? invoices[0] : null);
  }, [invoices, selectedInvoiceId]);

  // Load checklist items whenever active invoice changes
  useEffect(() => {
    if (activeInvoice) {
      const catalog = store.getItems();
      const items: ChecklistItem[] = activeInvoice.items.map((it) => {
        const matched = catalog.find(c => c.id === it.itemId || c.name === it.name);
        return {
          itemId: it.itemId,
          name: it.name,
          sku: matched?.sku || `SKU-${it.itemId.slice(-4)}`,
          barcode: matched?.barcode || `ITEM:${matched?.publicItemId || it.itemId}`,
          quantityRequired: Math.max(1, it.quantity),
          quantityScanned: 0,
          isVerified: false,
        };
      });
      setChecklist(items);
      setTrackingNumber(`TRK-${Date.now().toString().slice(-6)}`);
      setScanMessage(null);
    } else {
      setChecklist([]);
    }
  }, [activeInvoice?.id]);

  const isDispatched = activeInvoice ? dispatchedOrderIds.includes(activeInvoice.id) : false;
  const verifiedCount = checklist.filter(i => i.isVerified).length;
  const totalItemsCount = checklist.length;
  const progressPercent = totalItemsCount > 0 ? Math.round((verifiedCount / totalItemsCount) * 100) : 0;
  const isAllVerified = totalItemsCount > 0 && verifiedCount === totalItemsCount;

  const handleBarcodeScan = (scannedData: string) => {
    const cleanCode = scannedData.trim();

    // 1. If scanning an order / shipping label (e.g. `SHIP:INV-2026-0001` or `INV-2026-0001`)
    if (cleanCode.startsWith('SHIP:') || cleanCode.startsWith('INV-') || cleanCode.startsWith('ORD-')) {
      const targetNumber = cleanCode.replace('SHIP:', '').replace('ORD-', '').trim();
      const match = invoices.find(inv => inv.invoiceNumber === targetNumber || inv.invoiceNumber.includes(targetNumber) || inv.id === targetNumber);
      if (match) {
        setSelectedInvoiceId(match.id);
        setScanMessage({ text: `Switched active verification to Invoice #${match.invoiceNumber}`, type: 'info' });
        return;
      }
    }

    // 2. If scanning a product barcode / SKU inside the active box
    let matched = false;
    const updatedItems = checklist.map((item) => {
      const isMatch = 
        cleanCode === item.barcode ||
        cleanCode === item.sku ||
        cleanCode.replace('ITEM:', '') === item.barcode.replace('ITEM:', '') ||
        cleanCode.toLowerCase() === item.name.toLowerCase();

      if (isMatch && item.quantityScanned < item.quantityRequired) {
        matched = true;
        const newScanned = item.quantityScanned + 1;
        return {
          ...item,
          quantityScanned: newScanned,
          isVerified: newScanned >= item.quantityRequired,
        };
      }
      return item;
    });

    if (matched) {
      setChecklist(updatedItems);
      const allDone = updatedItems.every((i) => i.isVerified);
      if (allDone) {
        setScanMessage({ text: `✅ All ${updatedItems.length} items verified! Ready to seal box and dispatch.`, type: 'success' });
      } else {
        setScanMessage({ text: `✓ Barcode matched and verified in box.`, type: 'success' });
      }
    } else {
      const alreadyDone = checklist.some(i => (cleanCode === i.barcode || cleanCode === i.sku) && i.quantityScanned >= i.quantityRequired);
      if (alreadyDone) {
        setScanMessage({ text: `Item is already fully verified in this box.`, type: 'info' });
      } else {
        setScanMessage({ text: `⚠️ Barcode "${cleanCode}" does not match pending items in this invoice.`, type: 'error' });
      }
    }
  };

  // Connect global USB hardware scanner wedge
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
  });

  const handleManualIncrement = (itemId: string) => {
    const updated = checklist.map(item => {
      if (item.itemId === itemId) {
        const next = Math.min(item.quantityRequired, item.quantityScanned + 1);
        return {
          ...item,
          quantityScanned: next,
          isVerified: next >= item.quantityRequired,
        };
      }
      return item;
    });
    setChecklist(updated);
    if (updated.length > 0 && updated.every(i => i.isVerified)) {
      setScanMessage({ text: `✅ All items verified! Ready to seal box.`, type: 'success' });
    }
  };

  const handleManualDecrement = (itemId: string) => {
    const updated = checklist.map(item => {
      if (item.itemId === itemId) {
        const next = Math.max(0, item.quantityScanned - 1);
        return {
          ...item,
          quantityScanned: next,
          isVerified: false,
        };
      }
      return item;
    });
    setChecklist(updated);
  };

  const handleConfirmDispatch = () => {
    if (!activeInvoice) return;
    setDispatchedOrderIds(prev => [...prev, activeInvoice.id]);
    setScanMessage({ 
      text: `🚀 Invoice #${activeInvoice.invoiceNumber} sealed and handed over to ${courierPartner} (AWB: ${trackingNumber})!`, 
      type: 'success' 
    });
  };

  const handlePrintPackingSlip = () => {
    window.print();
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.partyName && inv.partyName.toLowerCase().includes(q)) ||
      (inv.partyPhone && inv.partyPhone.includes(q))
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Shipping & Dispatch Verification
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Quality control gatekeeper: scan product barcodes into boxes before courier handoff
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Webcam Scanner</span>
          </button>

          <button
            onClick={handlePrintPackingSlip}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Box Slip</span>
          </button>
        </div>
      </div>

      {/* Hardware Scanner & Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center space-x-3 shadow-sm">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <div>
            <p className="text-xs font-bold text-emerald-900">USB Scanner Wedge Active</p>
            <p className="text-[11px] text-emerald-700">Point handheld scanner anywhere to verify items</p>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Delivery Orders</p>
          <p className="text-xl font-black text-slate-900 mt-1">{invoices.length}</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Pending Packing</p>
          <p className="text-xl font-black text-amber-600 mt-1">
            {invoices.filter(i => !dispatchedOrderIds.includes(i.id)).length}
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Dispatched Today</p>
          <p className="text-xl font-black text-indigo-600 mt-1">{dispatchedOrderIds.length}</p>
        </div>
      </div>

      {/* Dynamic Feedback Toast / Banner */}
      {scanMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all shadow-sm ${
          scanMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          scanMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-indigo-50 border-indigo-200 text-indigo-800'
        }`}>
          <div className="flex items-center space-x-2">
            {scanMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
             scanMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-600" /> :
             <Sparkles className="w-4 h-4 text-indigo-600" />}
            <span>{scanMessage.text}</span>
          </div>
          <button onClick={() => setScanMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Main Dual-Pane QC Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Order Queue (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                📦 Order Queue ({filteredInvoices.length})
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Select to Inspect</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by invoice # or customer..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Orders Scroll List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No delivery orders found.
                </div>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = activeInvoice?.id === inv.id;
                  const isDone = dispatchedOrderIds.includes(inv.id);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-400 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-extrabold ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                          {inv.invoiceNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isDone 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {isDone ? 'DISPATCHED' : 'PENDING QC'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium flex items-center space-x-1 truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{inv.partyName || 'Counter Customer'}</span>
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-900">₹{inv.grandTotal.toFixed(2)}</span>
                        <span>{inv.items.length} items to pack</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Inspection & Packing Checklist (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeInvoice ? (
            <>
              {/* Order Inspection Header Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-black text-slate-900">{activeInvoice.invoiceNumber}</h2>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                        isDispatched 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : isAllVerified
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isDispatched ? '✓ DISPATCHED' : isAllVerified ? 'READY TO SEAL' : 'IN PACKING'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="font-bold text-slate-700">{activeInvoice.partyName || 'Counter Customer'}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{activeInvoice.partyPhone || 'Direct Store Order'}</span>
                      </span>
                      <span>₹{activeInvoice.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fulfillment Verification</p>
                    <p className="text-lg font-black text-indigo-600">
                      {verifiedCount} of {totalItemsCount} Verified ({progressPercent}%)
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${
                        isAllVerified ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Manual Search & Scanner Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (inputCode.trim()) {
                      handleBarcodeScan(inputCode.trim());
                      setInputCode('');
                    }
                  }}
                  className="flex items-center space-x-2 pt-2"
                >
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      placeholder="Scan product barcode, SKU, or type here..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Verify Item
                  </button>
                </form>
              </div>

              {/* Box Contents Checklist Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Box className="w-4 h-4 text-indigo-600" />
                    <span>Box Contents Quality Check</span>
                  </h3>
                  <span className="text-xs text-slate-500">Scan each physical item as you place it inside</span>
                </div>

                <div className="space-y-3">
                  {checklist.map((item) => (
                    <div
                      key={item.itemId}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                        item.isVerified
                          ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          item.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.isVerified ? '✓' : '📦'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.name}</p>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600">
                              SKU: {item.sku}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600">
                              Barcode: {item.barcode}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            item.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {item.quantityScanned} / {item.quantityRequired} {item.isVerified && '✓'}
                          </span>
                        </div>

                        {/* Manual Touch Adjustment Controls */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleManualDecrement(item.itemId)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Decrement scanned count"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleManualIncrement(item.itemId)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                            title="Add 1 to scanned count"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>1</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logistics & Seal Action Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-indigo-600" />
                  <span>Courier Partner & Handover</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">Select Courier Partner</label>
                    <div className="flex flex-wrap gap-2">
                      {['In-House Rider', 'Delhivery', 'BlueDart', 'Porter / Dunzo', 'Shadowfax'].map((courier) => (
                        <button
                          key={courier}
                          onClick={() => setCourierPartner(courier)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            courierPartner === courier
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {courier}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-2">Waybill / Tracking AWB #</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. TRK-984210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleConfirmDispatch}
                    disabled={isDispatched || !isAllVerified}
                    className={`w-full py-3.5 rounded-xl font-extrabold text-sm shadow-md transition-all flex items-center justify-center space-x-2 ${
                      isDispatched
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : !isAllVerified
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 cursor-pointer'
                    }`}
                  >
                    <PackageCheck className="w-5 h-5" />
                    <span>
                      {isDispatched
                        ? '✓ Order Dispatched & Sealed'
                        : isAllVerified
                        ? '🚀 Seal Box & Confirm Dispatch Handover'
                        : `⚠️ Verify ${totalItemsCount - verifiedCount} Remaining Items First`}
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No Orders Selected</h3>
              <p className="text-xs text-slate-500 mt-1">Create a sales invoice via POS to begin quality check and dispatch verification.</p>
            </div>
          )}
        </div>

      </div>

      {/* Webcam Scanner Modal */}
      <WebcamScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScan}
        initialStandbyMode={true}
      />
    </div>
  );
};
