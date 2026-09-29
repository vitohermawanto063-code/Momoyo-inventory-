import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, AlertTriangle, Package, Calendar, User, Camera, Tag } from 'lucide-react';
import { Product, StockTransaction, OutReason } from '../types';
import { soundManager } from '../utils/audio';

interface StockOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProduct: Product | null;
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

export const StockOutModal: React.FC<StockOutModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProduct,
  onConfirmStockOut,
  onOpenScanner,
}) => {
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<OutReason>('Operasional Bar');
  const [pic, setPic] = useState<string>('Barista Shift 1');
  const [dateInput, setDateInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === productId) || products[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) {
      setErrorMsg('Pilih barang terlebih dahulu');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Jumlah barang keluar harus lebih dari 0');
      return;
    }

    if (quantity > currentProduct.currentStock) {
      setErrorMsg(
        `Stok tidak mencukupi! Stok saat ini ${currentProduct.currentStock} ${currentProduct.unit}, diminta ${quantity} ${currentProduct.unit}`
      );
      soundManager.playWarningBeep();
      return;
    }

    const previousStock = currentProduct.currentStock;
    const newStock = previousStock - Number(quantity);

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
      type: 'OUT',
      quantity: Number(quantity),
      unit: currentProduct.unit,
      previousStock,
      currentStock: newStock,
      date: transactionDate,
      pic: pic.trim() || 'Barista Momoyo Ciledug',
      ...(reason ? { outReason: reason } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    onConfirmStockOut(transactionData);
    soundManager.playSuccessBeep();

    // Reset & close
    setQuantity(1);
    setNotes('');
    setErrorMsg(null);
    onClose();
  };

  const newProjectedStock = currentProduct ? currentProduct.currentStock - (Number(quantity) || 0) : 0;
  const isStockCritical = currentProduct && newProjectedStock <= currentProduct.minStock;

  return (
    <div
      id="stock-out-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="stock-out-card"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-amber-700 px-4 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <ArrowUpRight className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Barang Keluar (OUT)</h2>
              <p className="text-xs text-amber-100">Catat pemakaian atau pengeluaran barang per tanggal</p>
            </div>
          </div>
          <button
            id="close-stock-out-btn"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-800 text-white hover:bg-amber-900 transition-colors"
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

          {/* Tanggal & Waktu Keluar (Per Tanggal) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-amber-700" />
                Tanggal & Waktu Pemakaian / Keluar:
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
                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline"
              >
                Set Hari Ini
              </button>
            </div>
            <input
              id="stock-out-date-input"
              type="datetime-local"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-hidden"
              required
            />
            <p className="text-[11px] text-amber-800">
              Pilih tanggal mutasi keluar sesuai waktu pemakaian riil di bar atau toko.
            </p>
          </div>

          {/* Product selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-amber-600" />
                Pilih Barang Momoyo:
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
              >
                <Camera className="h-3.5 w-3.5" />
                Scan Barcode HP
              </button>
            </div>

            <select
              id="stock-out-product-select"
              value={currentProduct?.id || ''}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.category}] - Sisa: {p.currentStock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Product Quick Info Pill */}
          {currentProduct && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] uppercase font-semibold text-amber-800">Barcode</span>
                <p className="font-mono text-xs font-bold text-neutral-800 truncate">{currentProduct.barcode}</p>
              </div>
              <div className="border-x border-amber-200">
                <span className="text-[10px] uppercase font-semibold text-amber-800">Stok Saat Ini</span>
                <p className="text-sm font-black text-neutral-900">
                  {currentProduct.currentStock}{' '}
                  <span className="text-[11px] font-normal text-neutral-600">{currentProduct.unit}</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-amber-800">Sisa Nanti</span>
                <p
                  className={`text-sm font-black ${
                    newProjectedStock < 0
                      ? 'text-red-600'
                      : isStockCritical
                      ? 'text-amber-700'
                      : 'text-neutral-900'
                  }`}
                >
                  {newProjectedStock}{' '}
                  <span className="text-[11px] font-normal text-neutral-600">{currentProduct.unit}</span>
                </p>
              </div>
            </div>
          )}

          {isStockCritical && (
            <div className="rounded-lg bg-amber-100/70 border border-amber-300 p-2.5 flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Perhatian: Pengurangan ini menyebabkan sisa stok menyentuh batas minimum ({currentProduct?.minStock}{' '}
                {currentProduct?.unit}).
              </span>
            </div>
          )}

          {/* Quantity & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">
                Jumlah Keluar ({currentProduct?.unit || 'Item'}):
              </label>
              <input
                id="stock-out-qty-input"
                type="number"
                min="1"
                max={currentProduct?.currentStock || 1}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-neutral-500" />
                Alasan Pengeluaran:
              </label>
              <select
                id="stock-out-reason-select"
                value={reason}
                onChange={(e) => setReason(e.target.value as OutReason)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
              >
                {OUT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* PIC Staff */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-neutral-500" />
              PIC / Barista yang Mengambil:
            </label>
            <input
              id="stock-out-pic-input"
              type="text"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              placeholder="Nama Barista"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700">Catatan / Keterangan (Opsional):</label>
            <input
              id="stock-out-notes-input"
              type="text"
              placeholder="Contoh: Dipakai untuk shift siang, refill jar topping"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
            <button
              id="cancel-stock-out-btn"
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition"
            >
              Batal
            </button>
            <button
              id="submit-stock-out-btn"
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 active:scale-98 transition shadow-sm"
            >
              <ArrowUpRight className="h-4 w-4" />
              Konfirmasi Barang Keluar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
