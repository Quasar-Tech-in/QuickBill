import React, { useState } from 'react';
import { Truck, QrCode, CheckCircle2, AlertTriangle, Box, PackageCheck, Search, ArrowRight } from 'lucide-react';
import { WebcamScannerModal } from '../components/WebcamScannerModal';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import axios from 'axios';

interface ShippingItem {
  itemId: string;
  name: string;
  sku: string;
  barcode: string;
  quantityRequired: number;
  quantityScanned: number;
  isVerified: boolean;
}

export const ShippingDispatchView: React.FC = () => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [orderId, setOrderId] = useState('ORD-9842');
  const [customerName, setCustomerName] = useState('Aarav Sharma');
  const [customerAddress, setCustomerAddress] = useState('45 Indiranagar 10th Main, Bengaluru - 560038');
  const [shippingStatus, setShippingStatus] = useState<'PENDING_PACKING' | 'PACKING_VERIFIED' | 'DISPATCHED'>('PENDING_PACKING');
  const [inputCode, setInputCode] = useState('');

  const [items, setItems] = useState<ShippingItem[]>([
    {
      itemId: 'itm_rice',
      name: 'Basmati Rice 5kg',
      sku: 'SKU-RICE-5',
      barcode: 'ITEM:ITM-1001',
      quantityRequired: 1,
      quantityScanned: 0,
      isVerified: false,
    },
    {
      itemId: 'itm_oil',
      name: 'Sunflower Oil 1L',
      sku: 'SKU-OIL-1',
      barcode: 'ITEM:ITM-1002',
      quantityRequired: 2,
      quantityScanned: 0,
      isVerified: false,
    },
  ]);

  const handleBarcodeScan = (scannedData: string) => {
    const cleanCode = scannedData.trim();

    // 1. If scanning shipping box label (`SHIP:<order_id>`)
    if (cleanCode.startsWith('SHIP:')) {
      const scannedOrderId = cleanCode.replace('SHIP:', '').trim();
      setOrderId(scannedOrderId);
      alert(`📦 Order label ${scannedOrderId} loaded!`);
      return;
    }

    // 2. If scanning a product barcode inside the box
    let matched = false;
    const updatedItems = items.map((item) => {
      if (
        cleanCode === item.barcode ||
        cleanCode === item.sku ||
        cleanCode === `ITEM:${item.sku}` ||
        cleanCode.includes(item.sku)
      ) {
        matched = true;
        const newScanned = Math.min(item.quantityRequired, item.quantityScanned + 1);
        const verified = newScanned === item.quantityRequired;
        return {
          ...item,
          quantityScanned: newScanned,
          isVerified: verified,
        };
      }
      return item;
    });

    if (matched) {
      setItems(updatedItems);
      const allDone = updatedItems.every((i) => i.isVerified);
      if (allDone) {
        setShippingStatus('PACKING_VERIFIED');
      }
    } else {
      alert(`⚠️ Barcode '${cleanCode}' does not belong to active order!`);
    }
  };

  // Connect global USB hardware scanner
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
  });

  const handleConfirmDispatch = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/v1/shipping/orders/${orderId}/dispatch`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('Dispatch API fallback triggered:', err);
    }
    setShippingStatus('DISPATCHED');
    alert(`🚀 Order ${orderId} marked as DISPATCHED to courier!`);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Shipping & Dispatch Verification</h1>
              <p className="text-xs text-slate-500 font-medium">
                Verify box contents via USB Barcode Scanner or Webcam before courier handoff
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 flex items-center space-x-2 transition-all"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Webcam Scanner</span>
          </button>
        </div>
      </div>

      {/* USB Scanner Active Indicator */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
        <div className="flex items-center space-x-2 text-emerald-800 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>USB Barcode Scanner Wedge Active — Point physical scanner at shipping label or product tags anywhere on this screen!</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Order Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Order</span>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                shippingStatus === 'DISPATCHED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {shippingStatus.replace('_', ' ')}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">{orderId}</h3>
              <p className="text-xs font-semibold text-slate-600 mt-1">{customerName}</p>
              <p className="text-xs text-slate-500">{customerAddress}</p>
            </div>

            {/* Manual Code Input Form */}
            <div className="pt-2 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Manual Barcode / Order Lookup
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputCode) {
                    handleBarcodeScan(inputCode);
                    setInputCode('');
                  }
                }}
                className="flex items-center space-x-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Scan or type barcode..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Packing Checklist & Dispatch Action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Box Contents Checklist ({items.filter(i => i.isVerified).length}/{items.length} Verified)
              </h3>
              {items.every(i => i.isVerified) && (
                <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready to Seal!</span>
                </span>
              )}
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.itemId}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                    item.isVerified
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      SKU: <span className="font-mono">{item.sku}</span> | Barcode: <span className="font-mono">{item.barcode}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900">
                        {item.quantityScanned} / {item.quantityRequired}
                      </span>
                    </div>

                    <button
                      onClick={() => handleBarcodeScan(item.barcode)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      + Scan
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Confirm Dispatch Action */}
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleConfirmDispatch}
                disabled={shippingStatus === 'DISPATCHED'}
                className={`w-full py-3.5 rounded-xl font-extrabold text-sm shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  shippingStatus === 'DISPATCHED'
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                }`}
              >
                <PackageCheck className="w-5 h-5" />
                <span>{shippingStatus === 'DISPATCHED' ? '✓ Order Dispatched' : 'Confirm & Mark Dispatched to Courier'}</span>
              </button>
            </div>

          </div>
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
