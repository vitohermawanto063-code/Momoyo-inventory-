import React, { useState, useEffect } from 'react';
import {
  Camera,
  MinusCircle,
  AlertTriangle,
  User,
  CheckCircle2,
  Package,
  Barcode as BarcodeIcon,
  Tag,
  Clock,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Product, StockTransaction, OutReason } from '../types';
import { soundManager } from '../utils/audio';

interface StockOutSlideViewProps {
  products: Product[];
  recentTransactions: StockTransaction[];
  onConfirmStockOut: (transaction: Omit<StockTransaction, 'id'>) => void;
  onOpenScanner: () => void;
}

const OUT_REASONS: OutReason[] = [
  'Operasional Bar',
  'Waste / Tumpah',
  'Expired / Rusak',
  'Sampling / Promo',
  'Transfer Outlet',
];

export const StockOutSlideView: React.FC<StockOutSlideViewProps> = ({
  products,
  recentTransactions,
  onConfirmStockOut,
  onOpenScanner,
}) => {
  // Primary sub-mode requested by user:
  // "dan untuk out barang bisa di scan dan bisa manual"
  const [outMode, setOutMode] = useState<'SCAN' | 'MANUAL'>('SCAN');

  // State for SCAN Mode
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [scanSelectedProductId, setScanSelectedProductId] = useState<string>('');
  const [scanQty, setScanQty] = useState<number>(1);
  const [scanReason, setScanReason] = useState<OutReason>('Operasional Bar');
  const [scanPic, setScanPic] = useState<string>('Barista Shift 1');
  const [scanNotes, setScanNotes] = useState<string>('');

  // State for MANUAL Mode
  const [manualSearch, setManualSearch] = useState<string>('');
  const [manualProductId, setManualProductId] = useState<string>('');
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualReason, setManualReason] = useState<OutReason>('Operasional Bar');
  const [manualPic, setManualPic] = useState<string>('Barista Shift 1');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Feedback Alert
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Set default products
  useEffect(() => {
    if (products.length > 0) {
      if (!scanSelectedProductId) setScanSelectedProductId(products[0].id);
      if (!manualProductId) setManualProductId(products[0].id);
    }
  }, [products]);

  // Match barcode in SCAN mode
  useEffect(() => {
    if (scannedBarcode.trim()) {
      const match = products.find(
        (p) =>
          p.barcode.toLowerCase() === scannedBarcode.trim().toLowerCase() ||
          p.barcode.toLowerCase().includes(scannedBarcode.trim().toLowerCase())
      );
      if (match) {
        setScanSelectedProductId(match.id);
      }
    }
  }, [scannedBarcode, products]);

  const scanProduct = products.find((p) => p.id === scanSelectedProductId) || products[0];
  const manualProduct = products.find((p) => p.id === manualProductId) || products[0];

  // Filter products for manual search
  const filteredProductsForManual = products.filter((p) => {
    if (!manualSearch.trim()) return true;
    return (
      p.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
      p.barcode.toLowerCase().includes(manualSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(manualSearch.toLowerCase())
    );
  });

  // Recent 5 OUT transactions
  const recentOutTransactions = recentTransactions
    .filter((t) => t.type === 'OUT')
    .slice(0, 5);

  // Handle Scan Submit
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanProduct) {
      setFeedback({ message: 'Pilih barang yang keluar terlebih dahulu.', type: 'error' });
      return;
    }
    if (scanQty <= 0) {
      setFeedback({ message: 'Jumlah barang keluar minimal 1.', type: 'error' });
      return;
    }
    if (scanQty > scanProduct.currentStock) {
      soundManager.playWarningBeep();
      setFeedback({
        message: `Stok tidak mencukupi! Stok saat ini hanya ${scanProduct.currentStock} ${scanProduct.unit}.`,
        type: 'error',
      });
      return;
    }

    const previousStock = scanProduct.currentStock;
    const currentStock = previousStock - Number(scanQty);

    onConfirmStockOut({
      productId: scanProduct.id,
      productName: scanProduct.name,
      barcode: scanProduct.barcode,
      type: 'OUT',
      quantity: Number(scanQty),
      unit: scanProduct.unit,
      previousStock,
      currentStock,
      date: new Date().toISOString(),
      pic: scanPic || 'Barista Momoyo Ciledug',
      outReason: scanReason,
      notes: scanNotes || 'Keluar via Scan Barcode',
    });

    soundManager.playSuccessBeep();
    setFeedback({
      message: `Berhasil! -${scanQty} ${scanProduct.unit} "${scanProduct.name}" telah dikeluarkan (${scanReason}). Sisa stok: ${currentStock} ${scanProduct.unit}.`,
      type: 'success',
    });
    setScannedBarcode('');
    setScanQty(1);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Handle Manual Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProduct) {
      setFeedback({ message: 'Pilih barang yang akan dikeluarkan.', type: 'error' });
      return;
    }
    if (manualQty <= 0) {
      setFeedback({ message: 'Jumlah barang keluar minimal 1.', type: 'error' });
      return;
    }
    if (manualQty > manualProduct.currentStock) {
      soundManager.playWarningBeep();
      setFeedback({
        message: `Stok tidak mencukupi! Stok saat ini hanya ${manualProduct.currentStock} ${manualProduct.unit}.`,
        type: 'error',
      });
      return;
    }

    const previousStock = manualProduct.currentStock;
    const currentStock = previousStock - Number(manualQty);

    onConfirmStockOut({
      productId: manualProduct.id,
      productName: manualProduct.name,
      barcode: manualProduct.barcode,
      type: 'OUT',
      quantity: Number(manualQty),
      unit: manualProduct.unit,
      previousStock,
      currentStock,
      date: new Date().toISOString(),
      pic: manualPic || 'Barista Momoyo Ciledug',
      outReason: manualReason,
      notes: manualNotes || 'Keluar via Input Manual',
    });

    soundManager.playSuccessBeep();
    setFeedback({
      message: `Berhasil! -${manualQty} ${manualProduct.unit} "${manualProduct.name}" telah dikeluarkan (${manualReason}). Sisa stok: ${currentStock} ${manualProduct.unit}.`,
      type: 'success',
    });
    setManualQty(1);
    setManualNotes('');
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/20">
              <MinusCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-neutral-900 leading-tight">
                Menu Barang Keluar (OUT)
              </h2>
              <p className="text-xs text-neutral-500">
                Pengurangan stok untuk operasional bar, waste, expired, atau transfer outlet
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
            <button
              type="button"
              onClick={() => setOutMode('SCAN')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                outMode === 'SCAN'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Camera className="h-3.5 w-3.5 text-amber-600" />
              1. Scan Barcode
            </button>
            <button
              type="button"
              onClick={() => setOutMode('MANUAL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                outMode === 'MANUAL'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
              2. Input Manual (Tanpa Scan)
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Empty products warning notice */}
        {products.length === 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Daftar barang inventaris masih kosong. Silakan input barang terlebih dahulu sebelum mencatat pengeluaran stok.</span>
            </div>
          </div>
        )}

        {/* MODE 1: SCAN BARCODE KELUAR */}
        {outMode === 'SCAN' && (
          <div className="pt-4 space-y-4">
            <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shrink-0">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                    Scan Barcode Barang yang Dikeluarkan
                  </h3>
                  <p className="text-[11px] text-neutral-600">
                    Arahkan kamera ke barcode kemasan barang yang akan dipakai oleh barista atau dibuang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenScanner}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm active:scale-98 shrink-0"
              >
                <Camera className="h-4 w-4" />
                Buka Kamera Scanner HP
              </button>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Nomor Barcode atau Tembak Scanner
                  </label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Ketik/Scan barcode (e.g. MMY-TSB-001)..."
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-mono font-medium text-neutral-900 focus:border-amber-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Barang Terpilih
                  </label>
                  <select
                    value={scanSelectedProductId}
                    onChange={(e) => setScanSelectedProductId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 focus:border-amber-500 outline-hidden bg-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Sisa: {p.currentStock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Info Preview */}
              {scanProduct && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md uppercase">
                      {scanProduct.category}
                    </span>
                    <h4 className="text-sm font-bold text-neutral-900 mt-1">
                      {scanProduct.name}
                    </h4>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">
                      Barcode: {scanProduct.barcode} • Rak: {scanProduct.location}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[11px] text-neutral-500 font-medium">Stok Saat Ini</p>
                      <p className="text-base font-black text-neutral-900">
                        {scanProduct.currentStock} {scanProduct.unit}
                      </p>
                    </div>
                    <div className="text-amber-700 font-bold text-sm">
                      ➔ Sisa Stok:{' '}
                      <span className="text-base font-black">
                        {Math.max(0, scanProduct.currentStock - Number(scanQty))} {scanProduct.unit}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity, Reason & PIC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Jumlah Keluar ({scanProduct?.unit || 'Unit'})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScanQty((prev) => Math.max(1, prev - 1))}
                      className="h-9 w-9 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-700 hover:bg-neutral-100 flex items-center justify-center text-sm"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={scanProduct?.currentStock || 999}
                      value={scanQty}
                      onChange={(e) => setScanQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center rounded-xl border border-neutral-300 py-1.5 text-sm font-bold text-neutral-900 focus:border-amber-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setScanQty((prev) => prev + 1)}
                      className="h-9 w-9 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-700 hover:bg-neutral-100 flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Keperluan / Alasan Keluar
                  </label>
                  <select
                    value={scanReason}
                    onChange={(e) => setScanReason(e.target.value as OutReason)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-amber-500 outline-hidden bg-white"
                  >
                    {OUT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Nama Petugas (PIC)
                  </label>
                  <input
                    type="text"
                    value={scanPic}
                    onChange={(e) => setScanPic(e.target.value)}
                    placeholder="Barista Shift"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-900 focus:border-amber-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-sm active:scale-98"
                >
                  <MinusCircle className="h-4 w-4" />
                  Konfirmasi Pengeluaran (-{scanQty} {scanProduct?.unit})
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE 2: INPUT MANUAL (PILIH DARI LIST TANPA SCAN) */}
        {outMode === 'MANUAL' && (
          <div className="pt-4 space-y-4">
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-white shrink-0">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                  Input Pengeluaran Manual (Pilih Barang Langsung)
                </h3>
                <p className="text-[11px] text-neutral-600">
                  Keluarkan barang tanpa perlu menggunakan kamera scanner, cukup pilih nama barang dari katalog
                </p>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              {/* Quick Search for product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Cari Nama / Barcode Barang
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder="Ketik untuk memfilter list..."
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-medium text-neutral-900 focus:border-amber-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Pilih Barang yang Dikeluarkan *
                  </label>
                  <select
                    value={manualProductId}
                    onChange={(e) => setManualProductId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-amber-500 outline-hidden bg-white"
                  >
                    {filteredProductsForManual.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Sisa: {p.currentStock} {p.unit} ({p.location})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status preview */}
              {manualProduct && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">{manualProduct.name}</h4>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      Lokasi: {manualProduct.location} • Min Stok: {manualProduct.minStock} {manualProduct.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        manualProduct.currentStock <= manualProduct.minStock
                          ? 'bg-red-100 text-red-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Stok: {manualProduct.currentStock} {manualProduct.unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Quantity, Reason & PIC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Jumlah Keluar ({manualProduct?.unit || 'Unit'}) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max={manualProduct?.currentStock || 999}
                      value={manualQty}
                      onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-amber-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setManualQty((prev) => prev + 1)}
                      className="px-3 py-2 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700 hover:bg-neutral-200"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualQty((prev) => prev + 5)}
                      className="px-3 py-2 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700 hover:bg-neutral-200"
                    >
                      +5
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Alasan Pengeluaran
                  </label>
                  <select
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value as OutReason)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-900 focus:border-amber-500 outline-hidden bg-white"
                  >
                    {OUT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Nama Petugas (PIC)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={manualPic}
                      onChange={(e) => setManualPic(e.target.value)}
                      placeholder="Nama Barista"
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-medium text-neutral-900 focus:border-amber-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="e.g. Pemakaian reguler shift pagi, es krim matcha 2 karton"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-800 focus:border-amber-500 outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-sm active:scale-98"
                >
                  <MinusCircle className="h-4 w-4" />
                  Simpan Pengeluaran Manual (-{manualQty} {manualProduct?.unit})
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Recent OUT Transactions Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" />
            5 Pengeluaran Barang Terakhir
          </h3>
          <span className="text-[11px] text-neutral-400">Pengurangan tercatat</span>
        </div>

        {recentOutTransactions.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center py-4">Belum ada transaksi keluar.</p>
        ) : (
          <div className="divide-y divide-neutral-100 text-xs">
            {recentOutTransactions.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-neutral-900">{tx.productName}</p>
                  <p className="text-[11px] text-neutral-500">
                    Alasan: <span className="font-semibold text-neutral-700">{tx.outReason || 'Operasional'}</span> •{' '}
                    {new Date(tx.date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • PIC: {tx.pic}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-md bg-amber-100 text-amber-800 font-bold px-2 py-0.5 text-xs">
                    -{tx.quantity} {tx.unit}
                  </span>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    Stok: {tx.previousStock} ➔ {tx.currentStock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
