import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Package, MapPin, Barcode, Camera, Scale } from 'lucide-react';
import { Product, ProductCategory, ProductUnit } from '../types';
import { CATEGORIES } from '../data/momoyoInitialData';

const UNITS: ProductUnit[] = ['Pcs', 'Karton', 'Box', 'Kg', 'Gram', 'Pack', 'Roll', 'Botol', 'Liter'];

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  initialBarcode?: string;
  onSaveProduct: (product: Product) => void;
  onOpenScanner?: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  initialBarcode,
  onSaveProduct,
  onOpenScanner,
}) => {
  const [name, setName] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [category, setCategory] = useState<ProductCategory>('Bahan Es Krim & Susu');
  const [unit, setUnit] = useState<ProductUnit>('Pack');
  const [currentStock, setCurrentStock] = useState<number>(10);
  const [minStock, setMinStock] = useState<number>(5);
  const [weightPerUnitKg, setWeightPerUnitKg] = useState<number>(1);
  const [location, setLocation] = useState<string>('Gudang Momoyo Ciledug');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setBarcode(productToEdit.barcode);
      setCategory(productToEdit.category);
      setUnit(productToEdit.unit);
      setCurrentStock(productToEdit.currentStock);
      setMinStock(productToEdit.minStock);
      setWeightPerUnitKg(Math.max(1, Math.round(productToEdit.weightPerUnitKg || 1)));
      setLocation(productToEdit.location);
      setNotes(productToEdit.notes || '');
    } else {
      setName('');
      setBarcode(initialBarcode || generateNewBarcode());
      setCategory('Bahan Es Krim & Susu');
      setUnit('Pack');
      setCurrentStock(10);
      setMinStock(5);
      setWeightPerUnitKg(1);
      setLocation('Gudang Momoyo Ciledug');
      setNotes('');
    }
  }, [productToEdit, initialBarcode, isOpen]);

  if (!isOpen) return null;

  function generateNewBarcode(): string {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `8998${randomSuffix}`;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama barang wajib diisi');
      return;
    }

    if (!barcode.trim()) {
      setErrorMsg('Kode barcode wajib diisi');
      return;
    }

    const cleanWeight = Math.max(1, Math.round(Number(weightPerUnitKg) || 1));

    const newProduct: Product = {
      id: productToEdit ? productToEdit.id : `prod-${Date.now()}`,
      barcode: barcode.trim(),
      name: name.trim(),
      category,
      unit,
      currentStock: Number(currentStock) || 0,
      minStock: Number(minStock) || 0,
      weightPerUnitKg: cleanWeight,
      location: location.trim() || 'Gudang Momoyo Ciledug',
      lastUpdated: new Date().toISOString(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    onSaveProduct(newProduct);
    onClose();
  };

  return (
    <div
      id="product-form-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="product-form-card"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-900 px-4 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600">
              {productToEdit ? <Package className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {productToEdit ? 'Edit Barang Inventory' : 'Tambah Barang Baru'}
              </h2>
              <p className="text-xs text-neutral-400">Momoyo Ciledug Cirebon</p>
            </div>
          </div>
          <button
            id="close-product-form-btn"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
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

          {/* Barcode & Scan trigger */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Barcode className="h-4 w-4 text-red-600" />
                Nomor Barcode / QR Code:
              </label>
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScanner();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Scan dari HP
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                id="product-barcode-input"
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Contoh: 899100100101"
                className="flex-1 font-mono text-sm font-semibold rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                required
              />
              <button
                type="button"
                onClick={() => setBarcode(generateNewBarcode())}
                className="rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200 transition"
              >
                Auto Barcode
              </button>
            </div>
          </div>

          {/* Product Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700">Nama Barang Momoyo:</label>
            <input
              id="product-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Bubuk Es Krim Vanilla Original Momoyo"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
              required
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">Kategori:</label>
              <select
                id="product-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">Satuan Stok:</label>
              <select
                id="product-unit-select"
                value={unit}
                onChange={(e) => setUnit(e.target.value as ProductUnit)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Weight per Unit (Must be whole integer, e.g. 1, 2, 5 Kg - no decimals) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-emerald-600" />
                Berat per {unit} (Kg):
              </label>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Wajib Angka Bulat (1, 2, 3...)
              </span>
            </div>
            <input
              id="product-weight-input"
              type="number"
              min="1"
              step="1"
              value={weightPerUnitKg}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setWeightPerUnitKg(isNaN(parsed) ? 1 : Math.max(1, Math.round(parsed)));
              }}
              placeholder="Contoh: 1 (Bilangan bulat tanpa koma)"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
              required
            />
            <p className="text-[11px] text-neutral-500">
              Berat barang wajib diinput angka bulat seperti <strong>1</strong> (bukan desimal seperti 1,01 atau 1,1).
            </p>
          </div>

          {/* Current Stock & Min Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">Stok Awal ({unit}):</label>
              <input
                id="product-stock-input"
                type="number"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">Batas Stok Minimum ({unit}):</label>
              <input
                id="product-min-stock-input"
                type="number"
                min="1"
                value={minStock}
                onChange={(e) => setMinStock(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-neutral-500" />
              Lokasi Rak / Penyimpanan:
            </label>
            <input
              id="product-location-input"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Misal: Gudang Kering Rak A1"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700">Keterangan Tambahan:</label>
            <input
              id="product-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Kemasan karton isi 12, disimpan di chiller"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
            <button
              id="cancel-product-form-btn"
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition"
            >
              Batal
            </button>
            <button
              id="save-product-form-btn"
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 active:scale-98 transition shadow-sm"
            >
              <Save className="h-4 w-4" />
              {productToEdit ? 'Simpan Perubahan' : 'Tambah ke Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
