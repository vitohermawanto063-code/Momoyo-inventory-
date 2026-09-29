import React, { useState, useEffect } from 'react';
import {
  Camera,
  FileText,
  PlusCircle,
  Truck,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Package,
  Barcode as BarcodeIcon,
  Search,
  ArrowDownCircle,
  Clock,
  Layers,
  Trash2,
  Plus,
  Boxes,
  Sparkles,
  ClipboardList,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, StockTransaction, PurchaseOrder } from '../types';
import { soundManager } from '../utils/audio';

interface StockInSlideViewProps {
  products: Product[];
  recentTransactions: StockTransaction[];
  purchaseOrders?: PurchaseOrder[];
  onConfirmStockIn: (transaction: Omit<StockTransaction, 'id'>) => void;
  onConfirmBatchStockIn?: (transactions: Array<Omit<StockTransaction, 'id'>>) => void;
  onOpenScanner: () => void;
  onGoToPoTab?: () => void;
  onGoToSuratJalan?: () => void;
}

interface MultiItemRow {
  productId: string;
  quantity: number;
  notes?: string;
}

export const StockInSlideView: React.FC<StockInSlideViewProps> = ({
  products,
  recentTransactions,
  purchaseOrders = [],
  onConfirmStockIn,
  onConfirmBatchStockIn,
  onOpenScanner,
  onGoToPoTab,
  onGoToSuratJalan,
}) => {
  // Mode selection:
  // SCAN = Scan barcode via camera/scanner
  // SURAT_JALAN = Input from physical Surat Jalan (single item)
  // MANUAL_MULTI = Input manual sekaligus banyak barang tanpa scan barcode
  const [inMode, setInMode] = useState<'SCAN' | 'SURAT_JALAN' | 'MANUAL_MULTI'>('MANUAL_MULTI');

  // State for SCAN Mode
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [scanSelectedProductId, setScanSelectedProductId] = useState<string>('');
  const [scanQty, setScanQty] = useState<number>(1);
  const [scanPic, setScanPic] = useState<string>('Staff Shift Momoyo');
  const [scanNotes, setScanNotes] = useState<string>('Barang Masuk via Barcode Scanner');

  // State for SURAT JALAN (SJ) Mode
  const [sjNumber, setSjNumber] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `SJ-MMY/${y}${m}${d}/`;
  });
  const [sjCourier, setSjCourier] = useState<string>('Ekspedisi Gudang Pusat Momoyo');
  const [sjDate, setSjDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [sjProductId, setSjProductId] = useState<string>('');
  const [sjQty, setSjQty] = useState<number>(1);
  const [sjPic, setSjPic] = useState<string>('Staff Penerimaan');
  const [sjNotes, setSjNotes] = useState<string>('');

  // State for MANUAL MULTI-ITEM Mode (Input Sekaligus Banyak Barang tanpa scan)
  const [multiSjNumber, setMultiSjNumber] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `SJ-MMY/${y}${m}${d}/`;
  });
  const [multiCourier, setMultiCourier] = useState<string>('Ekspedisi Gudang Pusat Momoyo');
  const [multiDate, setMultiDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [multiPic, setMultiPic] = useState<string>('Staff Penerimaan');
  const [multiGeneralNotes, setMultiGeneralNotes] = useState<string>('Penerimaan Banyak Barang Sekaligus');
  const [multiRows, setMultiRows] = useState<MultiItemRow[]>([
    { productId: '', quantity: 1, notes: '' },
    { productId: '', quantity: 1, notes: '' },
  ]);

  // Status & Notifications
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Set default product when products list is loaded
  useEffect(() => {
    if (products.length > 0) {
      if (!sjProductId) setSjProductId(products[0].id);
      if (!scanSelectedProductId) setScanSelectedProductId(products[0].id);
      setMultiRows((prev) =>
        prev.map((r, idx) => ({
          ...r,
          productId: r.productId || (products[idx % products.length]?.id ?? products[0].id),
        }))
      );
    }
  }, [products]);

  // When barcode is entered in SCAN mode, match product
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
  const sjProduct = products.find((p) => p.id === sjProductId) || products[0];

  // Recent 5 IN transactions
  const recentInTransactions = recentTransactions
    .filter((t) => t.type === 'IN')
    .slice(0, 5);

  // Submit SCAN IN
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanProduct) {
      setFeedback({ message: 'Pilih barang yang masuk terlebih dahulu.', type: 'error' });
      return;
    }
    if (scanQty <= 0) {
      setFeedback({ message: 'Jumlah barang masuk minimal 1.', type: 'error' });
      return;
    }

    const previousStock = scanProduct.currentStock;
    const currentStock = previousStock + Number(scanQty);
    const weight = scanProduct.weightPerUnitKg
      ? Math.round(scanProduct.weightPerUnitKg * scanQty)
      : null;

    onConfirmStockIn({
      productId: scanProduct.id,
      productName: scanProduct.name,
      barcode: scanProduct.barcode,
      type: 'IN',
      quantity: Number(scanQty),
      unit: scanProduct.unit,
      previousStock,
      currentStock,
      date: new Date().toISOString(),
      pic: scanPic || 'Staff Shift Momoyo',
      notes: scanNotes || 'Masuk via Scan Barcode',
      ...(weight && weight > 0 ? { totalWeightKg: weight } : {}),
    });

    soundManager.playSuccessBeep();
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    setFeedback({
      message: `Berhasil! +${scanQty} ${scanProduct.unit} "${scanProduct.name}" telah ditambahkan ke stok. (Stok Baru: ${currentStock})`,
      type: 'success',
    });
    setScannedBarcode('');
    setScanQty(1);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Submit SURAT JALAN IN (Single Item)
  const handleSjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sjProduct) {
      setFeedback({ message: 'Pilih barang dari Surat Jalan.', type: 'error' });
      return;
    }
    if (!sjNumber.trim()) {
      setFeedback({ message: 'Nomor Surat Jalan wajib diisi.', type: 'error' });
      return;
    }
    if (sjQty <= 0) {
      setFeedback({ message: 'Jumlah barang masuk minimal 1.', type: 'error' });
      return;
    }

    const previousStock = sjProduct.currentStock;
    const currentStock = previousStock + Number(sjQty);
    const weight = sjProduct.weightPerUnitKg
      ? Math.round(sjProduct.weightPerUnitKg * sjQty)
      : null;

    let transactionDate: string;
    try {
      transactionDate = sjDate ? new Date(sjDate).toISOString() : new Date().toISOString();
    } catch {
      transactionDate = new Date().toISOString();
    }

    onConfirmStockIn({
      productId: sjProduct.id,
      productName: sjProduct.name,
      barcode: sjProduct.barcode,
      type: 'IN',
      quantity: Number(sjQty),
      unit: sjProduct.unit,
      previousStock,
      currentStock,
      date: transactionDate,
      pic: sjPic || 'Staff Penerimaan Momoyo',
      referenceNo: sjNumber.trim(),
      notes: sjNotes || `Diterima dari SJ ${sjNumber.trim()}`,
      ...(weight && weight > 0 ? { totalWeightKg: weight } : {}),
      ...(sjCourier.trim() ? { senderCourier: sjCourier.trim() } : {}),
    });

    soundManager.playSuccessBeep();
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    setFeedback({
      message: `Surat Jalan ${sjNumber} berhasil diinput! +${sjQty} ${sjProduct.unit} "${sjProduct.name}" telah masuk stok.`,
      type: 'success',
    });
    setSjQty(1);
    setSjNotes('');
    setTimeout(() => setFeedback(null), 4000);
  };

  // Helper functions for MULTI-ITEM MANUAL Mode
  const handleAddMultiRow = () => {
    const nextProd = products.find((p) => !multiRows.some((r) => r.productId === p.id)) || products[0];
    setMultiRows([
      ...multiRows,
      { productId: nextProd?.id || '', quantity: 1, notes: '' },
    ]);
  };

  const handleRemoveMultiRow = (index: number) => {
    if (multiRows.length <= 1) {
      setFeedback({ message: 'Minimal harus ada 1 barang dalam daftar penerimaan.', type: 'error' });
      return;
    }
    setMultiRows(multiRows.filter((_, idx) => idx !== index));
  };

  const handleUpdateMultiRow = (index: number, updates: Partial<MultiItemRow>) => {
    setMultiRows(
      multiRows.map((row, idx) => (idx === index ? { ...row, ...updates } : row))
    );
  };

  // Quick add product to multi-row
  const handleQuickAddProduct = (prodId: string) => {
    const exists = multiRows.some((r) => r.productId === prodId);
    if (exists) {
      setFeedback({ message: 'Barang tersebut sudah ada di tabel input.', type: 'error' });
      return;
    }
    setMultiRows([...multiRows, { productId: prodId, quantity: 1, notes: '' }]);
  };

  // Submit MULTI-ITEM IN
  const handleMultiSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (multiRows.length === 0) {
      setFeedback({ message: 'Belum ada barang yang dipilih untuk dimasukkan.', type: 'error' });
      return;
    }

    // Validate rows
    const validRows: Array<{ product: Product; qty: number; notes?: string }> = [];
    const seenIds = new Set<string>();

    for (const r of multiRows) {
      if (!r.productId) continue;
      if (seenIds.has(r.productId)) {
        const prod = products.find((p) => p.id === r.productId);
        setFeedback({
          message: `Barang "${prod?.name || 'Item'}" terpilih ganda. Harap gabungkan jumlahnya dalam 1 baris.`,
          type: 'error',
        });
        return;
      }
      seenIds.add(r.productId);

      const prod = products.find((p) => p.id === r.productId);
      if (!prod) continue;
      if (r.quantity <= 0) {
        setFeedback({
          message: `Jumlah untuk barang "${prod.name}" harus lebih dari 0.`,
          type: 'error',
        });
        return;
      }
      validRows.push({ product: prod, qty: Number(r.quantity), notes: r.notes });
    }

    if (validRows.length === 0) {
      setFeedback({ message: 'Harap pilih minimal 1 barang yang valid.', type: 'error' });
      return;
    }

    let transactionDate: string;
    try {
      transactionDate = multiDate ? new Date(multiDate).toISOString() : new Date().toISOString();
    } catch {
      transactionDate = new Date().toISOString();
    }

    const txList: Array<Omit<StockTransaction, 'id'>> = validRows.map(({ product, qty, notes }) => {
      const previousStock = product.currentStock;
      const currentStock = previousStock + qty;
      const totalWeightKg = product.weightPerUnitKg
        ? Math.round(product.weightPerUnitKg * qty)
        : null;

      const rowNote = notes?.trim()
        ? notes.trim()
        : multiGeneralNotes.trim() || `Masuk Sekaligus ${multiSjNumber.trim() || ''}`;

      return {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        type: 'IN',
        quantity: qty,
        unit: product.unit,
        previousStock,
        currentStock,
        date: transactionDate,
        pic: multiPic.trim() || 'Staff Penerimaan Momoyo',
        notes: rowNote,
        ...(totalWeightKg && totalWeightKg > 0 ? { totalWeightKg } : {}),
        ...(multiSjNumber.trim() ? { referenceNo: multiSjNumber.trim() } : {}),
        ...(multiCourier.trim() ? { senderCourier: multiCourier.trim() } : {}),
      };
    });

    if (onConfirmBatchStockIn) {
      onConfirmBatchStockIn(txList);
    } else {
      txList.forEach((tx) => onConfirmStockIn(tx));
    }

    soundManager.playSuccessBeep();
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });

    const totalQty = validRows.reduce((sum, r) => sum + r.qty, 0);
    setFeedback({
      message: `Sukses! Berhasil memasukkan ${validRows.length} jenis barang sekaligus (Total: +${totalQty} pcs) ke stok gudang Momoyo!`,
      type: 'success',
    });

    // Reset multi rows to fresh state
    setMultiRows([
      { productId: products[0]?.id || '', quantity: 1, notes: '' },
      { productId: products[1]?.id || '', quantity: 1, notes: '' },
    ]);
    setTimeout(() => setFeedback(null), 5000);
  };

  // Calculate totals for multi-item preview
  const multiTotalQty = multiRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const multiTotalWeight = multiRows.reduce((sum, r) => {
    const prod = products.find((p) => p.id === r.productId);
    if (!prod || !prod.weightPerUnitKg) return sum;
    return sum + prod.weightPerUnitKg * (Number(r.quantity) || 0);
  }, 0);

  const pendingOrders = purchaseOrders.filter((p) => p.status !== 'DITERIMA');

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Active PO Inbound Shortcut Banner */}
      {pendingOrders.length > 0 && onGoToPoTab && (
        <div className="rounded-2xl border border-red-200 bg-linear-to-r from-red-50 to-rose-50 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shrink-0 shadow-xs">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Ada <span className="text-red-600 font-black">{pendingOrders.length} Purchase Order</span> aktif yang siap diterima!
              </p>
              <p className="text-[11px] text-neutral-600">
                Barang kiriman dari gudang pusat/supplier tiba di toko? Langsung tambahkan ke stok tanpa ketik ulang.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToPoTab}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs active:scale-95 transition shrink-0"
          >
            <span>Terima dari PO Aktif</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </button>
        </div>
      )}

      {/* Slide Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-neutral-900 leading-tight">
                Menu Barang Masuk (IN)
              </h2>
              <p className="text-xs text-neutral-500">
                Pilih metode: Input manual banyak barang sekaligus, scan barcode HP, atau per Surat Jalan
              </p>
            </div>
          </div>

          {/* Quick Choice Buttons for Mode */}
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setInMode('MANUAL_MULTI')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                inMode === 'MANUAL_MULTI'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              1. Input Sekaligus Banyak Barang
            </button>
            <button
              type="button"
              onClick={() => setInMode('SCAN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                inMode === 'SCAN'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Camera className="h-3.5 w-3.5 text-emerald-400" />
              2. Scan Barcode
            </button>
            <button
              type="button"
              onClick={() => (onGoToSuratJalan ? onGoToSuratJalan() : setInMode('SURAT_JALAN'))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                inMode === 'SURAT_JALAN'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              3. Surat Jalan (Non-Stok & Foto)
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
              <span>Daftar barang inventaris masih kosong. Silakan input barang baru atau tambah barang terlebih dahulu.</span>
            </div>
          </div>
        )}

        {/* MODE 1: MANUAL MULTI-ITEM INPUT (Input Sekaligus Banyak Barang tanpa scan) */}
        {inMode === 'MANUAL_MULTI' && (
          <div className="pt-4 space-y-4">
            <div className="rounded-xl bg-linear-to-r from-emerald-50 via-teal-50/50 to-white border border-emerald-200 p-3.5 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                    Input Manual Sekaligus Banyak Barang Masuk (Multi-Item)
                  </h3>
                  <span className="rounded-full bg-emerald-600 text-white px-2 py-0.2 text-[10px] font-bold">
                    Tanpa Scan Barcode
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 mt-0.5">
                  Tambahkan beberapa macam bahan baku / barang sekaligus dalam 1 kali simpan (misal saat bongkar muatan truk dari pusat).
                </p>
              </div>
            </div>

            <form onSubmit={handleMultiSubmit} className="space-y-4">
              {/* Document Reference Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-xl bg-neutral-50/70 p-3.5 border border-neutral-200">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    No. Surat Jalan / Referensi
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={multiSjNumber}
                      onChange={(e) => setMultiSjNumber(e.target.value)}
                      placeholder="e.g. SJ-MMY/2026/09/01"
                      className="w-full rounded-xl border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Ekspedisi / Pengirim
                  </label>
                  <div className="relative">
                    <Truck className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={multiCourier}
                      onChange={(e) => setMultiCourier(e.target.value)}
                      placeholder="e.g. Ekspedisi Momoyo Pusat"
                      className="w-full rounded-xl border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Waktu Diterima
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="datetime-local"
                      value={multiDate}
                      onChange={(e) => setMultiDate(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 bg-white pl-8 pr-2 py-1.5 text-xs text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Petugas Penerima (PIC) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={multiPic}
                      onChange={(e) => setMultiPic(e.target.value)}
                      placeholder="Nama Staff Penerima"
                      className="w-full rounded-xl border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Multi-Item Table Container */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
                <div className="bg-neutral-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Daftar Barang yang Masuk ({multiRows.length} Barang)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMultiRow}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-xs font-bold text-white transition active:scale-95 shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    + Tambah Baris Barang
                  </button>
                </div>

                <div className="p-3 sm:p-4 bg-white space-y-3">
                  {multiRows.map((row, index) => {
                    const selectedProd = products.find((p) => p.id === row.productId);
                    const prevStock = selectedProd ? selectedProd.currentStock : 0;
                    const nextStock = prevStock + (Number(row.quantity) || 0);

                    return (
                      <div
                        key={index}
                        className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3 transition hover:border-emerald-300 hover:bg-emerald-50/20"
                      >
                        {/* Number Index */}
                        <div className="flex items-center justify-between md:justify-center">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-black text-neutral-700">
                            {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMultiRow(index)}
                            className="md:hidden text-neutral-400 hover:text-red-600 p-1"
                            title="Hapus baris"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Product Selector */}
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                            Pilih Barang:
                          </label>
                          <select
                            value={row.productId}
                            onChange={(e) => handleUpdateMultiRow(index, { productId: e.target.value })}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-900 focus:border-emerald-500 outline-hidden"
                          >
                            <option value="">-- Pilih Barang Momoyo --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.category}] {p.name} (Stok: {p.currentStock} {p.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Counter */}
                        <div className="w-full md:w-44">
                          <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                            Jumlah ({selectedProd?.unit || 'Unit'}):
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateMultiRow(index, {
                                  quantity: Math.max(1, (Number(row.quantity) || 1) - 1),
                                })
                              }
                              className="h-8 w-8 rounded-lg bg-neutral-200 text-neutral-700 font-bold hover:bg-neutral-300 transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateMultiRow(index, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-full rounded-xl border border-neutral-300 bg-white px-2 py-1.5 text-xs font-bold text-center text-neutral-900 focus:border-emerald-500 outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateMultiRow(index, {
                                  quantity: (Number(row.quantity) || 1) + 1,
                                })
                              }
                              className="h-8 w-8 rounded-lg bg-neutral-200 text-neutral-700 font-bold hover:bg-neutral-300 transition"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Stock Simulation Badge */}
                        <div className="w-full md:w-36 text-center md:text-right bg-white md:bg-transparent rounded-lg p-2 md:p-0 border md:border-none border-neutral-200">
                          <span className="text-[10px] text-neutral-500 block">Stok Gudang:</span>
                          <span className="text-xs font-bold text-neutral-700">
                            {prevStock} &rarr;{' '}
                            <span className="text-emerald-600 font-black">
                              {nextStock} {selectedProd?.unit || ''}
                            </span>
                          </span>
                        </div>

                        {/* Delete Row Button (Desktop) */}
                        <div className="hidden md:flex items-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveMultiRow(index)}
                            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Row Button Bottom */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleAddMultiRow}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3.5 py-2 rounded-xl transition"
                    >
                      <Plus className="h-4 w-4" />
                      + Tambah Baris Barang Lagi
                    </button>

                    {/* Quick Catalog Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-neutral-500">
                      <span className="font-semibold text-neutral-700">Pilih Cepat:</span>
                      {products.slice(0, 4).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleQuickAddProduct(p.id)}
                          className="rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 whitespace-nowrap transition"
                        >
                          + {p.name.slice(0, 16)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* General Note */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Catatan / Keterangan Tambahan
                </label>
                <input
                  type="text"
                  value={multiGeneralNotes}
                  onChange={(e) => setMultiGeneralNotes(e.target.value)}
                  placeholder="e.g. Pembongkaran bahan baku es krim & sirup kondisi segel aman"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-800 focus:border-emerald-500 outline-hidden bg-white"
                />
              </div>

              {/* Total Calculation & Big Submit Button */}
              <div className="rounded-2xl border-2 border-emerald-500 bg-linear-to-r from-emerald-50 to-teal-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-900 uppercase">
                      Ringkasan Penerimaan Massal:
                    </span>
                  </div>
                  <p className="text-sm font-black text-neutral-900 mt-1">
                    {multiRows.length} Jenis Barang &bull; Total Masuk: +{multiTotalQty} Unit
                    {multiTotalWeight > 0 ? ` (Est. ~${Math.round(multiTotalWeight * 10) / 10} Kg)` : ''}
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    Data akan langsung terupdate ke stok cloud & Google Sheets!
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-3 text-xs font-black shadow-md shadow-emerald-600/30 transition active:scale-95"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>SIMPAN & MASUKKAN SEMUA ({multiRows.length} BARANG)</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE 2: SCAN BARCODE */}
        {inMode === 'SCAN' && (
          <div className="pt-4 space-y-4">
            <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                    Scan Barcode Kamera HP / Scanner Fisik
                  </h3>
                  <p className="text-[11px] text-neutral-600">
                    Arahkan kamera ke barcode kemasan barang untuk menambahkan stok secara otomatis
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenScanner}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold transition shadow-xs active:scale-95"
              >
                <Camera className="h-4 w-4" />
                Buka Kamera Scanner HP
              </button>
            </div>

            {/* Quick Barcode & Qty Form */}
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Barcode Input */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Barcode / Kode Barang
                  </label>
                  <div className="relative">
                    <BarcodeIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder="Tempelkan atau ketik barcode..."
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden bg-white"
                    />
                  </div>
                </div>

                {/* Product Match */}
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Nama Barang Terdeteksi
                  </label>
                  <select
                    value={scanSelectedProductId}
                    onChange={(e) => setScanSelectedProductId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden bg-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.category}] {p.name} (Stok: {p.currentStock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity, PIC, Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Jumlah Masuk ({scanProduct?.unit || 'Unit'}) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={scanQty}
                      onChange={(e) => setScanQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setScanQty((prev) => prev + 10)}
                      className="px-2.5 py-2 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700 hover:bg-neutral-200"
                    >
                      +10
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Petugas Penerima (PIC)
                  </label>
                  <input
                    type="text"
                    value={scanPic}
                    onChange={(e) => setScanPic(e.target.value)}
                    placeholder="Nama Petugas"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:border-red-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Catatan Masuk
                  </label>
                  <input
                    type="text"
                    value={scanNotes}
                    onChange={(e) => setScanNotes(e.target.value)}
                    placeholder="e.g. Masuk shift siang"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:border-red-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Submit Scan Button */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-sm active:scale-98"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Konfirmasi Masuk (+{scanQty} {scanProduct?.unit})
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE 3: SURAT JALAN (Non-Stok & Upload Foto) */}
        {inMode === 'SURAT_JALAN' && (
          <div className="pt-4 space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 sm:p-8 text-center space-y-4 shadow-2xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <FileText className="h-7 w-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-black text-neutral-900">
                  Fitur Input Surat Jalan (Dokumen, Berat, Qty & Foto)
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Sesuai ketentuan terbaru, pencatatan Surat Jalan kini khusus untuk mencatat nomor surat jalan fisik, tonase berat (Kg), kuantitas, serta upload foto dokumen fisik <strong>tanpa mempengaruhi atau menambah stok gudang</strong>.
                </p>
              </div>
              {onGoToSuratJalan && (
                <button
                  type="button"
                  onClick={onGoToSuratJalan}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition active:scale-95"
                >
                  <FileText className="h-4 w-4" />
                  <span>Buka Menu Input Surat Jalan & Upload Foto</span>
                </button>
              )}
            </div>
          </div>
        )}

        {false && inMode === 'SURAT_JALAN' && (
          <div className="pt-4 space-y-4">
            <div className="rounded-xl bg-red-50/60 border border-red-100 p-3 sm:p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                  Input dari Lembar Fisik Surat Jalan (SJ) Tunggal
                </h3>
                <p className="text-[11px] text-neutral-600">
                  Catat nomor dokumen resmi, ekspedisi/kurir pengantar, dan waktu barang tiba di toko
                </p>
              </div>
            </div>

            <form onSubmit={handleSjSubmit} className="space-y-3">
              {/* Reference, Courier, Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Nomor Surat Jalan (SJ) *
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={sjNumber}
                      onChange={(e) => setSjNumber(e.target.value)}
                      placeholder="e.g. SJ-MMY/20260924/001"
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Ekspedisi / Kurir Pengantar
                  </label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={sjCourier}
                      onChange={(e) => setSjCourier(e.target.value)}
                      placeholder="e.g. Ekspedisi Momoyo Pusat"
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-medium text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Waktu Kedatangan Barang
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="datetime-local"
                      value={sjDate}
                      onChange={(e) => setSjDate(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Pilih Barang yang Diterima *
                </label>
                <select
                  value={sjProductId}
                  onChange={(e) => setSjProductId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category}] {p.name} — Stok Saat Ini: {p.currentStock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity, Weight, PIC */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Jumlah Masuk ({sjProduct?.unit || 'Unit'}) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={sjQty}
                      onChange={(e) => setSjQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setSjQty((prev) => prev + 5)}
                      className="px-2.5 py-2 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700 hover:bg-neutral-200"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => setSjQty((prev) => prev + 10)}
                      className="px-2.5 py-2 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700 hover:bg-neutral-200"
                    >
                      +10
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Estimasi Total Berat (Kg)
                  </label>
                  <div className="relative">
                    <Scale className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="number"
                      readOnly
                      value={
                        sjProduct?.weightPerUnitKg
                          ? Math.round((sjProduct.weightPerUnitKg || 0) * sjQty)
                          : 0
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-100 pl-9 pr-3 py-2 text-xs font-bold text-neutral-700 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Petugas Penerima (PIC) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={sjPic}
                      onChange={(e) => setSjPic(e.target.value)}
                      placeholder="Nama Staff"
                      className="w-full rounded-xl border border-neutral-300 pl-9 pr-3 py-2 text-xs font-medium text-neutral-900 focus:border-red-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Catatan / Kondisi Fisik Paket
                </label>
                <input
                  type="text"
                  value={sjNotes}
                  onChange={(e) => setSjNotes(e.target.value)}
                  placeholder="e.g. Dus kondisi mulus, segel utuh, suhu chiller terjaga"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-800 focus:border-red-500 outline-hidden"
                />
              </div>

              {/* Submit SJ */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-sm active:scale-98"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Simpan Barang Masuk dari SJ (+{sjQty} {sjProduct?.unit})
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Recent IN Transactions Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" />
            5 Penerimaan Barang Masuk Terakhir
          </h3>
          <span className="text-[11px] text-neutral-400">Terverifikasi otomatis</span>
        </div>

        {recentInTransactions.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center py-4">Belum ada transaksi masuk.</p>
        ) : (
          <div className="divide-y divide-neutral-100 text-xs">
            {recentInTransactions.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-neutral-900">{tx.productName}</p>
                  <p className="text-[11px] text-neutral-500">
                    {tx.referenceNo ? `SJ: ${tx.referenceNo} • ` : ''}
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
                  <span className="inline-block rounded-md bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 text-xs">
                    +{tx.quantity} {tx.unit}
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
