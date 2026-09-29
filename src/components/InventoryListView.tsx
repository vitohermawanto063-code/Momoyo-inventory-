import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Barcode,
  Edit2,
  Trash2,
  Printer,
  MapPin,
  CheckCircle2,
  Filter,
  FileDown,
  Ticket,
  Boxes,
  ClipboardList,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  Scale,
} from 'lucide-react';
import { Product, ProductCategory, StockTransaction } from '../types';
import { CATEGORIES } from '../data/momoyoInitialData';
import { InventorySummaryDashboard } from './InventorySummaryDashboard';
import { MobileQuickFab } from './MobileQuickFab';

interface InventoryListViewProps {
  products: Product[];
  transactions?: StockTransaction[];
  onOpenStockIn: (product: Product) => void;
  onOpenStockOut: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onPrintBarcode: (product: Product) => void;
  onAddNewProduct: () => void;
  onOpenBulkAdd?: () => void;
  onOpenScanner: () => void;
  onOpenAllBarcodesPdf?: () => void;
  onOpenAutoPo?: () => void;
}

export const InventoryListView: React.FC<InventoryListViewProps> = ({
  products,
  transactions = [],
  onOpenStockIn,
  onOpenStockOut,
  onEditProduct,
  onDeleteProduct,
  onPrintBarcode,
  onAddNewProduct,
  onOpenBulkAdd,
  onOpenScanner,
  onOpenAllBarcodesPdf,
  onOpenAutoPo,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'CRITICAL' | 'SAFE'>('ALL');

  // Ergonomic View Mode for Laptop & Mobile (Grid Cards vs Compact Data Table)
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>(() => {
    try {
      const saved = localStorage.getItem('momoyo_inventory_view_mode_v1');
      if (saved === 'GRID' || saved === 'TABLE') return saved;
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        return 'TABLE';
      }
    } catch {}
    return 'GRID';
  });

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'stock' | 'category'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleToggleSort = (field: 'name' | 'stock' | 'category') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSetViewMode = (mode: 'GRID' | 'TABLE') => {
    setViewMode(mode);
    try {
      localStorage.setItem('momoyo_inventory_view_mode_v1', mode);
    } catch {}
  };

  const filteredProducts = useMemo(() => {
    const matched = products.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

      const isCritical = item.currentStock <= item.minStock;
      const matchStockStatus =
        stockStatusFilter === 'ALL' ||
        (stockStatusFilter === 'CRITICAL' && isCritical) ||
        (stockStatusFilter === 'SAFE' && !isCritical);

      return matchSearch && matchCategory && matchStockStatus;
    });

    matched.sort((a, b) => {
      let res = 0;
      if (sortField === 'name') {
        res = a.name.localeCompare(b.name);
      } else if (sortField === 'stock') {
        res = a.currentStock - b.currentStock;
      } else if (sortField === 'category') {
        res = a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      }
      return sortDirection === 'asc' ? res : -res;
    });

    return matched;
  }, [products, searchTerm, selectedCategory, stockStatusFilter, sortField, sortDirection]);

  const criticalCount = products.filter((p) => p.currentStock <= p.minStock).length;
  const totalStockUnits = products.reduce((acc, curr) => acc + curr.currentStock, 0);

  return (
    <div className="space-y-4">
      {/* Dashboard Ringkasan Inventaris: Nilai Aset & Kategori Paling Cepat Habis */}
      <InventorySummaryDashboard
        products={products}
        transactions={transactions}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
        onOpenAutoPo={onOpenAutoPo}
      />

      {/* Quick Metrics Bar & Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-3.5 shadow-2xs">
          <p className="text-[11px] font-medium text-neutral-500">Total SKU Barang</p>
          <p className="text-xl sm:text-2xl font-black text-neutral-900 mt-0.5">{products.length}</p>
          <span className="text-[10px] text-neutral-500 font-medium">Momoyo Ciledug</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-3.5 shadow-2xs">
          <p className="text-[11px] font-medium text-neutral-500">Total Unit Stok</p>
          <p className="text-xl sm:text-2xl font-black text-neutral-900 mt-0.5">{totalStockUnits}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Tercatat di sistem</span>
        </div>

        <button
          onClick={() => setStockStatusFilter(stockStatusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`rounded-xl border p-3 sm:p-3.5 shadow-2xs text-left transition ${
            criticalCount > 0
              ? 'border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900'
              : 'border-neutral-200 bg-white text-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-amber-800">Stok Menipis / Kritis</p>
            {criticalCount > 0 && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">{criticalCount}</p>
          <span className="text-[10px] font-semibold text-amber-800 underline">
            {stockStatusFilter === 'CRITICAL' ? 'Tampilkan Semua' : 'Klik Filter Kritis'}
          </span>
        </button>

        <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-neutral-500">Cetak Vocer & Barcode</p>
            {onOpenAllBarcodesPdf && (
              <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                PDF & Print
              </span>
            )}
          </div>
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={onOpenScanner}
              className="flex-1 py-1.5 px-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition active:scale-98"
              title="Buka Kamera HP untuk Scan"
            >
              <Barcode className="h-3.5 w-3.5" />
              Scan HP
            </button>
            {onOpenAllBarcodesPdf && (
              <button
                onClick={onOpenAllBarcodesPdf}
                className="py-1.5 px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition active:scale-98"
                title="Cetak Vocer & Barcode Semua Barang (Urut Sesuai Produk)"
              >
                <Ticket className="h-3.5 w-3.5 text-red-400" />
                Cetak All (Urut)
              </button>
            )}
            {onOpenBulkAdd && (
              <button
                onClick={onOpenBulkAdd}
                className="py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center transition border border-red-200"
                title="Tambah Produk Sekaligus (Banyak Sekaligus / Excel / CSV)"
              >
                <Boxes className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onAddNewProduct}
              className="py-1.5 px-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold flex items-center justify-center transition"
              title="Tambah Barang Baru Satu-Satu"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input with Keyboard Shortcut hint */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              id="inventory-search-input"
              type="text"
              placeholder="Cari nama barang, barcode (899...), atau rak..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 pl-9 pr-18 py-2 text-base sm:text-sm text-neutral-800 placeholder-neutral-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
            />
            <div className="absolute right-2.5 top-2 flex items-center gap-1">
              {searchTerm ? (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-neutral-400 hover:text-neutral-600 px-1 py-0.5"
                >
                  Reset
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center text-[10px] font-mono font-bold bg-neutral-100 border border-neutral-300 text-neutral-500 px-1.5 py-0.5 rounded shadow-2xs">
                  Ctrl+K / /
                </kbd>
              )}
            </div>
          </div>

          {/* Cetak Barcode Semua (PDF) Button */}
          {onOpenAllBarcodesPdf && (
            <button
              id="btn-open-all-barcodes-pdf"
              onClick={onOpenAllBarcodesPdf}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3.5 py-2 text-xs font-bold transition shadow-2xs shrink-0 active:scale-98"
              title="Buka menu cetak barcode semua barang dan unduh dokumen PDF"
            >
              <FileDown className="h-3.5 w-3.5 text-red-600" />
              <span className="whitespace-nowrap">Cetak Barcode (PDF)</span>
            </button>
          )}

          {/* Tambah Sekaligus (Massal) Button */}
          {onOpenBulkAdd && (
            <button
              onClick={onOpenBulkAdd}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 px-3.5 py-2 text-xs font-bold transition shadow-2xs shrink-0 active:scale-98"
              title="Tambah produk sekaligus banyak (Form Tabel & Tempel Excel/CSV)"
            >
              <Boxes className="h-3.5 w-3.5 text-red-600" />
              <span className="whitespace-nowrap">+ Tambah Sekaligus</span>
            </button>
          )}

          <button
            onClick={onAddNewProduct}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 text-xs font-bold transition shadow-2xs shrink-0 active:scale-98"
            title="Tambah satu barang baru manual (Alt+N)"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">+ Tambah</span>
          </button>
        </div>

        {/* Filters and View Mode Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-neutral-100">
          {/* Stock Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStockStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition min-h-[36px] ${
                stockStatusFilter === 'ALL'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Semua ({products.length})
            </button>
            <button
              onClick={() => setStockStatusFilter('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition min-h-[36px] ${
                stockStatusFilter === 'CRITICAL'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              Menipis ({criticalCount})
            </button>
            <button
              onClick={() => setStockStatusFilter('SAFE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition min-h-[36px] ${
                stockStatusFilter === 'SAFE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              Aman
            </button>
          </div>

          {/* Ergonomic View Mode for Laptop & Mobile (Grid vs Table) */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSetViewMode('GRID')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === 'GRID'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Tampilan Kartu Grid (Visual & Nyaman di HP)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('TABLE')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
                title="Tampilan Tabel Kompak (Rinci & Nyaman di Layar Laptop/PC)"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Tabel Laptop</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Horizontal Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar border-t border-neutral-100">
          <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="h-3 w-3" />
            Kategori:
          </span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition min-h-[32px] ${
              selectedCategory === 'ALL'
                ? 'bg-red-600 text-white font-bold'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Semua Kategori
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition min-h-[32px] ${
                selectedCategory === cat
                  ? 'bg-red-600 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Grid */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            {products.length === 0 ? <Boxes className="h-6 w-6 text-red-500" /> : <Search className="h-6 w-6" />}
          </div>
          <h3 className="text-sm font-bold text-neutral-800">
            {products.length === 0 ? 'Belum Ada Barang yang Diinput' : 'Tidak ada barang yang cocok'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {products.length === 0
              ? 'Daftar inventaris masih kosong. Hanya barang yang Anda input secara manual, bulk import, atau scan yang akan tersimpan dan muncul di sini.'
              : 'Coba ganti kata kunci pencarian, ubah filter kategori, atau tambahkan barang baru.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={onAddNewProduct}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              Tambah Barang Baru
            </button>
            {onOpenBulkAdd && (
              <button
                onClick={onOpenBulkAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-800 text-xs font-bold hover:bg-neutral-100 transition shadow-2xs"
              >
                <Boxes className="h-4 w-4 text-red-600" />
                Tambah Sekaligus (Massal)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((product) => {
            const isLowStock = product.currentStock <= product.minStock;

            return (
              <div
                key={product.id}
                id={`product-card-${product.id}`}
                className={`rounded-2xl border bg-white p-4 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                  isLowStock ? 'border-amber-300 ring-1 ring-amber-200/60' : 'border-neutral-200'
                }`}
              >
                <div>
                  {/* Top line: Category and Status badge */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-neutral-500 truncate">{product.category}</span>
                    {isLowStock ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        Stok Menipis
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Stok Aman
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-sm font-bold text-neutral-900 leading-snug line-clamp-2">{product.name}</h3>

                  {/* Barcode & Location */}
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
                      <span className="text-[11px] text-neutral-400 font-sans">Barcode:</span>
                      <span className="font-bold text-neutral-800 tracking-wider">{product.barcode}</span>
                    </div>
                    <div className="flex items-center gap-1 text-neutral-500 text-[11px]">
                      <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                      <span className="truncate">{product.location}</span>
                    </div>
                  </div>

                  {/* Stock Counter Display */}
                  <div className="mt-3 flex items-baseline justify-between rounded-xl bg-neutral-50 p-2.5 border border-neutral-100">
                    <div>
                      <span className="text-[10px] font-medium text-neutral-500 block">Sisa Stok Gudang</span>
                      <p className="text-lg font-black text-neutral-900">
                        {product.currentStock}{' '}
                        <span className="text-xs font-semibold text-neutral-600">{product.unit}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block">Min. Order</span>
                      <p className="text-xs font-bold text-neutral-600">
                        {product.minStock} {product.unit}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                  {/* Primary IN / OUT Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id={`btn-in-${product.id}`}
                      onClick={() => onOpenStockIn(product)}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs active:scale-98 transition"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      + Masuk (IN)
                    </button>
                    <button
                      id={`btn-out-${product.id}`}
                      onClick={() => onOpenStockOut(product)}
                      disabled={product.currentStock <= 0}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-bold shadow-2xs active:scale-98 transition ${
                        product.currentStock <= 0
                          ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      <MinusCircle className="h-3.5 w-3.5" />
                      - Keluar (OUT)
                    </button>
                  </div>

                  {/* Secondary Tools: Print Label, Edit, Delete */}
                  <div className="flex items-center justify-between text-neutral-500 pt-1">
                    <button
                      onClick={() => onPrintBarcode(product)}
                      className="text-[11px] font-semibold flex items-center gap-1.5 text-neutral-600 hover:text-red-600 transition"
                      title="Cetak Vocer Kontrol Stok atau Label Barcode Produk ini (PDF & Print)"
                    >
                      <Ticket className="h-3.5 w-3.5 text-red-500" />
                      Cetak Vocer & Barcode
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditProduct(product)}
                        className="p-1 rounded-md hover:bg-neutral-100 hover:text-neutral-900 transition"
                        title="Edit Barang"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus ${product.name} dari inventory Momoyo Ciledug?`)) {
                            onDeleteProduct(product.id);
                          }
                        }}
                        className="p-1 rounded-md hover:bg-red-50 hover:text-red-600 transition"
                        title="Hapus Barang"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
