import React, { useState, useEffect } from 'react';
import { X, ArrowDownCircle, Check, Package, Calendar, User, FileText, Camera, Scale, Truck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, StockTransaction } from '../types';
import { soundManager } from '../utils/audio';

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProduct: Product | null;
  onConfirmStockIn: (transaction: Omit<StockTransaction, 'id'>) => void;
  onOpenScanner: () => void;
}

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProduct,
  onConfirmStockIn,
  onOpenScanner,
}) => {
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [senderCourier, setSenderCourier] = useState<string>('Ekspedisi Pusat Momoyo');
  const [pic, setPic] = useState<string>('Staff Shift Pagi');
  const [weightKg, setWeightKg] = useState<number>(0);
  const [autoCalculateWeight, setAutoCalculateWeight] = useState<boolean>(true);
  const [dateInput, setDateInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentProduct = products.find((p) => p.id === productId) || products[0];

  useEffect(() => {
    if (selectedProduct) {
      setProductId(selectedProduct.id);
    } else if (products.length > 0 && !productId) {
      setProductId(products[0].id);
    }

    // Default to current local datetime in YYYY-MM-DDTHH:mm format
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDateInput(localIso);
  }, [selectedProduct, products, isOpen]);

  // Recalculate weight when product or quantity changes if autoCalculateWeight is enabled (whole integer)
  useEffect(() => {
    if (currentProduct && autoCalculateWeight) {
      const perUnit = Math.max(1, Math.round(currentProduct.weightPerUnitKg || 1));
      setWeightKg(Math.round(perUnit * quantity));
    }
  }, [currentProduct, quantity, autoCalculateWeight]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) {
      setErrorMsg('Pilih barang terlebih dahulu');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Jumlah barang masuk harus lebih dari 0');
      return;
    }

    const previousStock = currentProduct.currentStock;
    const newStock = previousStock + Number(quantity);

    // Parse dateInput or fallback to current time
    let transactionDate: string;
    try {
      transactionDate = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    } catch {
      transactionDate = new Date().toISOString();
    }

    const transactionData: Omit<StockTransaction, 'id'> = {
      productId: currentProduct.id,
      productName: currentProduct.name,
      barcode: currentProduct.barcode,
      type: 'IN',
      quantity: Number(quantity),
      unit: currentProduct.unit,
      previousStock,
      currentStock: newStock,
      date: transactionDate,
      pic: pic.trim() || 'Staff Momoyo Ciledug',
      ...(weightKg > 0 ? { totalWeightKg: Math.round(Number(weightKg)) } : {}),
      ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
      ...(senderCourier.trim() ? { senderCourier: senderCourier.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    onConfirmStockIn(transactionData);
    soundManager.playSuccessBeep();

    try {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#34d399'],
      });
    } catch {
      // ignore
    }

    // Reset & close
    setQuantity(1);
    setReferenceNo('');
    setNotes('');
    setErrorMsg(null);
    onClose();
  };

  const newProjectedStock = currentProduct ? currentProduct.currentStock + (Number(quantity) || 0) : 0;

  return (
    <div
      id="stock-in-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="stock-in-card"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-emerald-700 px-4 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <ArrowDownCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Barang Masuk (IN) & Surat Jalan</h2>
              <p className="text-xs text-emerald-100">Catat penerimaan stok Momoyo Ciledug per tanggal</p>
            </div>
          </div>
          <button
            id="close-stock-in-btn"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Tanggal & Waktu Transaksi (Per Tanggal) */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-emerald-700" />
                Tanggal & Waktu Masuk (Surat Jalan):
              </label>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
                  setDateInput(localIso);
                }}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline"
              >
                Set Hari Ini
              </button>
            </div>
            <input
              id="stock-in-date-input"
              type="datetime-local"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
              required
            />
            <p className="text-[11px] text-emerald-800">
              Anda bisa memilih tanggal sesuai tanggal fisik di surat jalan atau tanggal barang tiba di gudang.
            </p>
          </div>

          {/* Product selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-emerald-600" />
                Pilih Barang Momoyo:
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
              >
                <Camera className="h-3.5 w-3.5" />
                Scan Barcode HP
              </button>
            </div>

            <select
              id="stock-in-product-select"
              value={currentProduct?.id || ''}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.category}] - Stok: {p.currentStock} {p.unit} {p.weightPerUnitKg ? `(${p.weightPerUnitKg}kg/${p.unit})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Product Quick Info Pill */}
          {currentProduct && (
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-2.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] uppercase font-semibold text-emerald-800">Barcode</span>
                <p className="font-mono text-xs font-bold text-neutral-800 truncate">{currentProduct.barcode}</p>
              </div>
              <div className="border-x border-emerald-200">
                <span className="text-[10px] uppercase font-semibold text-emerald-800">Stok Saat Ini</span>
                <p className="text-sm font-black text-neutral-900">
                  {currentProduct.currentStock}{' '}
                  <span className="text-[11px] font-normal text-neutral-600">{currentProduct.unit}</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-emerald-800">Setelah Masuk</span>
                <p className="text-sm font-black text-emerald-700">
                  {newProjectedStock}{' '}
                  <span className="text-[11px] font-normal text-emerald-600">{currentProduct.unit}</span>
                </p>
              </div>
            </div>
          )}

          {/* Surat Jalan Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                No. Surat Jalan / PO:
              </label>
              <input
                id="stock-in-ref-input"
                type="text"
                placeholder="Contoh: SJ-MMY-CRB-0921"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-neutral-500" />
                Ekspedisi / Pengirim / Driver:
              </label>
              <input
                id="stock-in-courier-input"
                type="text"
                placeholder="Contoh: Truk Distribusi Momoyo Pusat"
                value={senderCourier}
                onChange={(e) => setSenderCourier(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          {/* Quantity and Total Weight */}
          <div className="grid grid-cols-2 gap-3 bg-neutral-50/70 p-3 rounded-xl border border-neutral-200">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">
                Jumlah Masuk ({currentProduct?.unit || 'Item'}):
              </label>
              <input
                id="stock-in-qty-input"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-black text-neutral-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <Scale className="h-3.5 w-3.5 text-emerald-600" />
                  Total Berat (Kg):
                </label>
                <button
                  type="button"
                  onClick={() => setAutoCalculateWeight(!autoCalculateWeight)}
                  className={`text-[10px] font-semibold px-1 rounded ${
                    autoCalculateWeight ? 'text-emerald-700 bg-emerald-100' : 'text-neutral-500 bg-neutral-200'
                  }`}
                  title="Klik untuk ubah kalkulasi otomatis"
                >
                  {autoCalculateWeight ? 'Otomatis' : 'Manual'}
                </button>
              </div>
              <input
                id="stock-in-weight-input"
                type="number"
                min="0"
                step="1"
                value={weightKg}
                onChange={(e) => {
                  setAutoCalculateWeight(false);
                  const parsed = parseInt(e.target.value, 10);
                  setWeightKg(isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed)));
                }}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          {/* PIC Staff */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-neutral-500" />
              Petugas / PIC Penerima:
            </label>
            <input
              id="stock-in-pic-input"
              type="text"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              placeholder="Nama Staff / Leader"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700">Catatan Surat Jalan / Kondisi Barang:</label>
            <input
              id="stock-in-notes-input"
              type="text"
              placeholder="Contoh: Sesuai surat jalan, segel aman, kardus utuh tidak basah"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
            <button
              id="cancel-stock-in-btn"
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition"
            >
              Batal
            </button>
            <button
              id="submit-stock-in-btn"
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-98 transition shadow-sm"
            >
              <Check className="h-4 w-4" />
              Simpan Barang Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
