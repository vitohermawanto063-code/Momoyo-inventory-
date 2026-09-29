import React, { useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  X,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Info,
  Boxes,
  Loader2,
  FileText,
  User,
  Clock,
  CheckSquare,
  Square,
  Truck,
} from 'lucide-react';
import { Product, StockTransaction, TransactionType } from '../types';

interface CancelTransactionSlideViewProps {
  products: Product[];
  transactions: StockTransaction[];
  onDeleteTransaction: (txId: string, revertStock: boolean) => Promise<void> | void;
  onBatchDeleteTransactions: (txIds: string[], revertStock: boolean) => Promise<void> | void;
  onNavigateToHistory?: () => void;
  onNavigateToStockIn?: () => void;
  onNavigateToStock?: () => void;
}

export const CancelTransactionSlideView: React.FC<CancelTransactionSlideViewProps> = ({
  products,
  transactions,
  onDeleteTransaction,
  onBatchDeleteTransactions,
  onNavigateToHistory,
  onNavigateToStockIn,
  onNavigateToStock,
}) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'>('ALL');

  // Selection for Batch Delete
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Modal State for Single Delete
  const [txToDelete, setTxToDelete] = useState<StockTransaction | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [revertStock, setRevertStock] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type filter
      if (filterType !== 'ALL' && tx.type !== filterType) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = tx.productName.toLowerCase().includes(q);
        const matchBarcode = tx.barcode.toLowerCase().includes(q);
        const matchPic = tx.pic.toLowerCase().includes(q);
        const matchRef = (tx.referenceNo || '').toLowerCase().includes(q);
        const matchCourier = (tx.senderCourier || '').toLowerCase().includes(q);
        const matchReason = (tx.outReason || '').toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchBarcode && !matchPic && !matchRef && !matchCourier && !matchReason && !matchNotes) {
          return false;
        }
      }

      // Date filter
      if (dateFilter !== 'ALL') {
        const txDate = new Date(tx.date);
        const now = new Date();

        if (dateFilter === 'TODAY') {
          const isToday =
            txDate.getDate() === now.getDate() &&
            txDate.getMonth() === now.getMonth() &&
            txDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === 'YESTERDAY') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday =
            txDate.getDate() === yesterday.getDate() &&
            txDate.getMonth() === yesterday.getMonth() &&
            txDate.getFullYear() === yesterday.getFullYear();
          if (!isYesterday) return false;
        } else if (dateFilter === 'WEEK') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (txDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'MONTH') {
          const isSameMonth =
            txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
          if (!isSameMonth) return false;
        }
      }

      return true;
    });
  }, [transactions, filterType, searchQuery, dateFilter]);

  // Overall Statistics
  const totalInCount = useMemo(() => transactions.filter((t) => t.type === 'IN').length, [transactions]);
  const totalOutCount = useMemo(() => transactions.filter((t) => t.type === 'OUT').length, [transactions]);

  // Live stock for single transaction deletion
  const targetProduct = useMemo(() => {
    if (!txToDelete) return null;
    return products.find((p) => p.id === txToDelete.productId) || null;
  }, [txToDelete, products]);

  const liveStockNow = targetProduct ? targetProduct.currentStock : txToDelete ? txToDelete.currentStock : 0;

  const projectedSingleRevertStock = useMemo(() => {
    if (!txToDelete) return 0;
    if (txToDelete.type === 'IN') {
      return Math.max(0, liveStockNow - txToDelete.quantity);
    } else {
      return liveStockNow + txToDelete.quantity;
    }
  }, [txToDelete, liveStockNow]);

  // Live product breakdown for batch deletion
  const batchAffectedItems = useMemo(() => {
    if (!isBatchModalOpen || selectedTxIds.size === 0) return [];
    const list = transactions.filter((t) => selectedTxIds.has(t.id));

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        barcode: string;
        unit: string;
        currentStock: number;
        inCount: number;
        outCount: number;
        totalInQty: number;
        totalOutQty: number;
        netDelta: number;
        projectedStock: number;
      }
    >();

    list.forEach((tx) => {
      const p = products.find((prod) => prod.id === tx.productId);
      const curr = map.get(tx.productId) || {
        productId: tx.productId,
        productName: tx.productName,
        barcode: tx.barcode,
        unit: tx.unit,
        currentStock: p ? p.currentStock : tx.currentStock,
        inCount: 0,
        outCount: 0,
        totalInQty: 0,
        totalOutQty: 0,
        netDelta: 0,
        projectedStock: p ? p.currentStock : tx.currentStock,
      };

      if (tx.type === 'IN') {
        curr.inCount += 1;
        curr.totalInQty += tx.quantity;
        curr.netDelta -= tx.quantity;
      } else {
        curr.outCount += 1;
        curr.totalOutQty += tx.quantity;
        curr.netDelta += tx.quantity;
      }
      curr.projectedStock = Math.max(0, curr.currentStock + curr.netDelta);
      map.set(tx.productId, curr);
    });

    return Array.from(map.values());
  }, [isBatchModalOpen, selectedTxIds, transactions, products]);

  // Checkbox toggle helpers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTxIds(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  // Confirm Single Delete
  const handleConfirmSingleDelete = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteTransaction(txToDelete.id, revertStock);
      setTxToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirm Batch Delete
  const handleConfirmBatchDelete = async () => {
    if (selectedTxIds.size === 0) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedTxIds);
      await onBatchDeleteTransactions(ids, revertStock);
      setSelectedTxIds(new Set());
      setIsBatchModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Slide Header */}
      <div className="rounded-3xl border border-red-200 bg-linear-to-r from-red-600 via-rose-600 to-red-700 p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-xs">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Slide Khusus: Hapus &amp; Pembatalan Transaksi</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Koreksi &amp; Pembatalan Mutasi Stok
            </h2>
            <p className="text-xs sm:text-sm text-red-100 max-w-2xl leading-relaxed">
              Halaman terpisah untuk menghapus salah input penerimaan barang (IN) atau pengeluaran barang (OUT). Anda dapat memilih untuk <strong>mengembalikan stok gudang ke kondisi sebelum transaksi</strong> atau hanya menghapus catatan log.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToStockIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20 backdrop-blur-xs"
            >
              <span>+ Input Barang Masuk</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-red-700 hover:bg-neutral-100 text-xs font-black transition shadow-sm"
            >
              <span>Lihat Log Riwayat &rarr;</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/20 text-white">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <span className="text-[11px] text-red-100 font-medium block">Total Transaksi</span>
            <strong className="text-lg sm:text-xl font-black">{transactions.length}</strong>
            <span className="text-[10px] text-red-200 block">Tercatat di sistem</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <span className="text-[11px] text-emerald-200 font-medium block">Barang Masuk (IN)</span>
            <strong className="text-lg sm:text-xl font-black">{totalInCount}</strong>
            <span className="text-[10px] text-emerald-100 block">Penerimaan &amp; SJ</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <span className="text-[11px] text-amber-200 font-medium block">Barang Keluar (OUT)</span>
            <strong className="text-lg sm:text-xl font-black">{totalOutCount}</strong>
            <span className="text-[10px] text-amber-100 block">Pemakaian &amp; Waste</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-xs border border-white/10">
            <span className="text-[11px] text-red-100 font-medium block">Dipilih Saat Ini</span>
            <strong className="text-lg sm:text-xl font-black">{selectedTxIds.size}</strong>
            <span className="text-[10px] text-red-200 block">Siap dihapus massal</span>
          </div>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700 shrink-0">
            <Info className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-neutral-900 text-sm">
              Cara Kerja Penghapusan &amp; Pengembalian Stok
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 text-emerald-950">
                <span className="font-black text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Pilihan 1: Kembalikan Stok Gudang (Rekomendasi)
                </span>
                <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                  Jika Anda salah input Surat Jalan IN, membatalkan transaksi ini akan <strong>mengurangi kembali stok barang</strong>. Jika salah input Pengeluaran OUT, membatalkan transaksi akan <strong>menambah kembali stok barang</strong>.
                </p>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-neutral-800">
                <span className="font-black text-neutral-900 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-neutral-600" />
                  Pilihan 2: Hanya Hapus Catatan Riwayat
                </span>
                <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
                  Hanya membersihkan baris catatan ini dari tabel log. Seluruh angka stok barang di gudang <strong>tidak akan diubah</strong> sama sekali.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter Toolbar */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no. surat jalan, nama barang, barcode, nama petugas (PIC)..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-xs sm:text-sm bg-neutral-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'ALL'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Semua Mutasi
            </button>
            <button
              type="button"
              onClick={() => setFilterType('IN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'IN'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Barang Masuk (IN)
            </button>
            <button
              type="button"
              onClick={() => setFilterType('OUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'OUT'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 hover:bg-amber-100'
              }`}
            >
              Barang Keluar (OUT)
            </button>
          </div>
        </div>

        {/* Date Filter Pills & Multi-select trigger */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-neutral-400 font-semibold flex items-center gap-1 mr-1">
              <Calendar className="h-3.5 w-3.5" />
              Waktu:
            </span>
            {[
              { id: 'ALL', label: 'Semua Waktu' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'YESTERDAY', label: 'Kemarin' },
              { id: 'WEEK', label: '7 Hari Terakhir' },
              { id: 'MONTH', label: 'Bulan Ini' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDateFilter(p.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                  dateFilter === p.id
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs font-bold text-neutral-700 hover:text-red-700 underline flex items-center gap-1"
            >
              {selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-red-600" />
                  Batal Pilih Semua
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Pilih Semua ({filteredTransactions.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Batch Action Bar when items selected */}
      {selectedTxIds.size > 0 && (
        <div className="sticky top-20 z-30 rounded-2xl border-2 border-red-500 bg-red-50/95 p-3.5 sm:px-5 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white font-black text-sm shadow-xs">
              {selectedTxIds.size}
            </span>
            <div>
              <span className="text-xs sm:text-sm font-black text-red-950 block">
                {selectedTxIds.size} Transaksi Siap Dihapus Sekaligus
              </span>
              <span className="text-[11px] text-red-700">
                Pilih opsi kembalikan stok gudang atau hanya bersihkan catatan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTxIds(new Set())}
              className="px-3 py-1.5 rounded-xl border border-red-300 bg-white hover:bg-red-100 text-red-800 text-xs font-bold transition shadow-2xs"
            >
              Batal Pilih
            </button>
            <button
              type="button"
              onClick={() => {
                setRevertStock(true);
                setIsBatchModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition shadow-sm flex items-center gap-2 active:scale-98"
            >
              <Trash2 className="h-4 w-4" />
              <span>Hapus {selectedTxIds.size} Transaksi Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-800">
              Tidak Ada Transaksi yang Cocok
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ditemukan transaksi dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                : 'Belum ada transaksi di database atau filter yang dipilih tidak memiliki data.'}
            </p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isSelected = selectedTxIds.has(tx.id);
            const prod = products.find((p) => p.id === tx.productId);
            const liveStock = prod ? prod.currentStock : tx.currentStock;
            const projectedStock =
              tx.type === 'IN'
                ? Math.max(0, liveStock - tx.quantity)
                : liveStock + tx.quantity;

            return (
              <div
                key={tx.id}
                className={`rounded-2xl border transition shadow-2xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-red-500 bg-red-50/60 ring-1 ring-red-400'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Checkbox for batch */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(tx.id)}
                      className="text-neutral-400 hover:text-red-600 transition"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-red-600" />
                      ) : (
                        <Square className="h-5 w-5 text-neutral-300" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border ${
                          tx.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {tx.type === 'IN' ? (
                          <>
                            <TrendingUp className="h-3 w-3" />
                            MASUK (IN)
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3" />
                            KELUAR (OUT)
                          </>
                        )}
                      </span>

                      {tx.referenceNo && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-bold text-neutral-700 border border-neutral-200">
                          <FileText className="h-3 w-3 text-neutral-500" />
                          SJ: {tx.referenceNo}
                        </span>
                      )}

                      <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(tx.date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Product & Qty */}
                    <div>
                      <h4 className="font-black text-neutral-900 text-base">
                        {tx.productName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 mt-0.5">
                        <span className="font-mono">Barcode: {tx.barcode}</span>
                        {prod?.location && <span>&bull; Lokasi: {prod.location}</span>}
                        <span>
                          &bull; Petugas (PIC): <strong className="text-neutral-700">{tx.pic}</strong>
                        </span>
                        {tx.senderCourier && (
                          <span>
                            &bull; Kurir: <strong className="text-neutral-700">{tx.senderCourier}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notes / Reason */}
                    {(tx.outReason || tx.notes) && (
                      <p className="text-xs text-neutral-600 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                        {tx.outReason && (
                          <strong className="text-neutral-800 mr-1.5">[{tx.outReason}]</strong>
                        )}
                        {tx.notes}
                      </p>
                    )}

                    {/* Stock Projection preview if deleted */}
                    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-neutral-100/80 px-2.5 py-1 text-[11px] text-neutral-600 border border-neutral-200/60">
                      <span className="font-semibold">Simulasi jika dibatalkan:</span>
                      <span className="text-neutral-700">Stok Saat Ini: <strong>{liveStock} {tx.unit}</strong></span>
                      <ArrowRight className="h-3 w-3 text-neutral-400" />
                      <span className="text-emerald-700 font-bold">
                        Stok Baru: <strong>{projectedStock} {tx.unit}</strong> ({tx.type === 'IN' ? `-${tx.quantity}` : `+${tx.quantity}`})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Amount & Delete Button */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-neutral-400 block font-semibold uppercase">
                      Jumlah Mutasi
                    </span>
                    <strong
                      className={`text-lg font-black ${
                        tx.type === 'IN' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {tx.type === 'IN' ? '+' : '-'}
                      {tx.quantity} <span className="text-xs font-semibold">{tx.unit}</span>
                    </strong>
                    {tx.totalWeightKg !== undefined && tx.totalWeightKg > 0 && (
                      <span className="text-[10px] text-neutral-400 block">
                        ~{tx.totalWeightKg} Kg
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRevertStock(true);
                      setTxToDelete(tx);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 text-xs font-black transition shadow-2xs group active:scale-95"
                    title="Batalkan atau hapus mutasi transaksi ini"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500 group-hover:text-white transition" />
                    <span>Hapus / Batalkan</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SINGLE TRANSACTION DELETE CONFIRMATION MODAL */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-neutral-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-red-500 bg-linear-to-r from-red-600 to-red-700 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white shadow-xs">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight">
                    Konfirmasi Pembatalan Transaksi
                  </h3>
                  <p className="text-[11px] text-red-100 font-medium">Momoyo Ciledug &bull; Log Mutasi Stok</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="rounded-xl p-1.5 text-white/80 hover:text-white hover:bg-black/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase inline-flex items-center gap-1 ${
                      txToDelete.type === 'IN'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {txToDelete.type === 'IN' ? (
                      <>
                        <TrendingUp className="h-3 w-3" />
                        BARANG MASUK (IN)
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3 w-3" />
                        BARANG KELUAR (OUT)
                      </>
                    )}
                  </span>
                  <span className="text-neutral-500 font-mono text-[11px]">
                    {new Date(txToDelete.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-neutral-900 text-base">{txToDelete.productName}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 mt-0.5">
                    <span className="font-mono">Barcode: {txToDelete.barcode}</span>
                    {targetProduct?.location && (
                      <span>&bull; Lokasi: <strong className="text-neutral-700">{targetProduct.location}</strong></span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-200 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-neutral-200/80">
                    <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Jumlah Mutasi</span>
                    <strong
                      className={`text-base font-black ${
                        txToDelete.type === 'IN' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {txToDelete.type === 'IN' ? '+' : '-'}
                      {txToDelete.quantity}{' '}
                      <span className="text-xs font-semibold">{txToDelete.unit}</span>
                    </strong>
                    {txToDelete.totalWeightKg !== undefined && txToDelete.totalWeightKg > 0 && (
                      <span className="block text-[10px] text-neutral-500 font-medium">
                        Total berat: ~{txToDelete.totalWeightKg} Kg
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-neutral-200/80">
                    <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Petugas (PIC)</span>
                    <strong className="text-neutral-800 text-xs truncate block mt-0.5">
                      {txToDelete.pic}
                    </strong>
                    {txToDelete.senderCourier && (
                      <span className="text-[10px] text-neutral-500 block truncate">
                        Kurir: {txToDelete.senderCourier}
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-neutral-200/80 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-neutral-400 block font-semibold uppercase">No. Surat Jalan</span>
                    <strong className="text-neutral-800 font-mono text-xs truncate block mt-0.5">
                      {txToDelete.referenceNo || 'Tanpa Surat Jalan'}
                    </strong>
                  </div>

                  {(txToDelete.outReason || txToDelete.notes) && (
                    <div className="bg-white p-2.5 rounded-xl border border-neutral-200/80 col-span-2 sm:col-span-3">
                      <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Keterangan / Alasan</span>
                      <p className="text-xs text-neutral-700 mt-0.5">
                        {txToDelete.outReason && (
                          <span className="font-bold text-neutral-900 mr-1.5">[{txToDelete.outReason}]</span>
                        )}
                        {txToDelete.notes || 'Tidak ada catatan tambahan'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-900 block flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-red-600" />
                  <span>Pilih Tindakan Terhadap Stok Gudang:</span>
                </label>

                {/* Option 1: Revert Stock */}
                <div
                  onClick={() => setRevertStock(true)}
                  className={`rounded-2xl border-2 p-3.5 transition cursor-pointer select-none ${
                    revertStock
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <input
                        type="radio"
                        name="revertSingle"
                        checked={revertStock}
                        onChange={() => setRevertStock(true)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-black text-neutral-900">
                          ⭐ Batalkan Transaksi &amp; Kembalikan Stok Gudang
                        </span>
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                          DIREKOMENDASIKAN (KOREKSI SALAH INPUT)
                        </span>
                      </div>

                      {/* Stock Math Simulation */}
                      <div className="rounded-xl bg-white border border-emerald-200 p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-neutral-400 block font-medium">Stok Sistem Saat Ini</span>
                          <strong className="text-neutral-800 text-sm font-black">
                            {liveStockNow} {txToDelete.unit}
                          </strong>
                        </div>

                        <div className="flex items-center gap-1 text-emerald-700 font-black">
                          <ArrowRight className="h-4 w-4" />
                          <span className="text-[11px] bg-emerald-100 px-1.5 py-0.5 rounded-md">
                            {txToDelete.type === 'IN' ? `-${txToDelete.quantity}` : `+${txToDelete.quantity}`} {txToDelete.unit}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 block font-medium">Stok Baru Setelah Dihapus</span>
                          <strong className="text-emerald-700 text-sm font-black">
                            {projectedSingleRevertStock} {txToDelete.unit}
                          </strong>
                        </div>
                      </div>

                      <p className="text-[11px] text-emerald-900/90 leading-relaxed pt-0.5">
                        {txToDelete.type === 'IN' ? (
                          <>
                            Penerimaan barang ini dibatalkan. Sistem akan <strong>mengurangi kembali {txToDelete.quantity} {txToDelete.unit}</strong> dari stok gudang sehingga jumlah fisik dan komputer tetap sinkron.
                          </>
                        ) : (
                          <>
                            Pengeluaran barang ini dibatalkan. Sistem akan <strong>mengembalikan {txToDelete.quantity} {txToDelete.unit}</strong> ke stok gudang.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option 2: Delete Log Only */}
                <div
                  onClick={() => setRevertStock(false)}
                  className={`rounded-2xl border-2 p-3.5 transition cursor-pointer select-none ${
                    !revertStock
                      ? 'border-neutral-600 bg-neutral-100/90 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <input
                        type="radio"
                        name="revertSingle"
                        checked={!revertStock}
                        onChange={() => setRevertStock(false)}
                        className="h-4 w-4 text-neutral-800 focus:ring-neutral-700 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-black text-neutral-900">
                          Hanya Hapus Catatan Riwayat Log Saja
                        </span>
                        <span className="bg-neutral-200 text-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          STOK TETAP
                        </span>
                      </div>

                      <div className="rounded-xl bg-white border border-neutral-300 p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-neutral-400 block font-medium">Stok Sistem Saat Ini</span>
                          <strong className="text-neutral-800 text-sm font-black">
                            {liveStockNow} {txToDelete.unit}
                          </strong>
                        </div>

                        <div className="text-neutral-400 font-bold text-xs flex items-center gap-1">
                          <ArrowRight className="h-4 w-4" />
                          <span>Tidak Berubah</span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 block font-medium">Stok Setelah Dihapus</span>
                          <strong className="text-neutral-800 text-sm font-black">
                            {liveStockNow} {txToDelete.unit} (Tetap)
                          </strong>
                        </div>
                      </div>

                      <p className="text-[11px] text-neutral-600 leading-relaxed pt-0.5">
                        Hanya menghapus baris riwayat ini dari tabel log. Angka stok barang di gudang <strong>tidak akan bertambah atau berkurang</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Cloud Notice */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Perubahan akan langsung disinkronkan secara real-time ke database cloud seluruh perangkat staf Momoyo Ciledug.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="w-full sm:w-auto rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 px-4 py-2.5 text-xs font-bold transition shadow-2xs"
              >
                Batal (Jangan Hapus)
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmSingleDelete}
                className="w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-xs font-black transition shadow-sm active:scale-98 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>
                      {revertStock
                        ? `Ya, Hapus & Kembalikan Stok (${txToDelete.type === 'IN' ? `-${txToDelete.quantity}` : `+${txToDelete.quantity}`} ${txToDelete.unit})`
                        : `Ya, Hapus Catatan Saja (Stok Tetap ${liveStockNow} ${txToDelete.unit})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH CONFIRMATION MODAL */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-neutral-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-red-500 bg-linear-to-r from-red-600 to-red-700 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white shadow-xs">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight">
                    Hapus Massal: {selectedTxIds.size} Transaksi Terpilih
                  </h3>
                  <p className="text-[11px] text-red-100 font-medium">Momoyo Ciledug &bull; Hapus Sekaligus &amp; Koreksi Stok</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="rounded-xl p-1.5 text-white/80 hover:text-white hover:bg-black/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs text-red-950 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-sm">
                    Anda akan menghapus {selectedTxIds.size} data mutasi transaksi sekaligus.
                  </p>
                  <p className="text-red-700 text-[11px] mt-0.5 leading-relaxed">
                    Tindakan ini mempengaruhi <strong>{batchAffectedItems.length} produk</strong> di inventaris gudang. Tentukan apakah stok barang ingin disesuaikan kembali secara otomatis atau tidak.
                  </p>
                </div>
              </div>

              {/* Stock Reversion Choice */}
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-900 block flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-red-600" />
                  <span>Pilihan Penyesuaian Stok untuk {selectedTxIds.size} Transaksi:</span>
                </label>

                {/* Option 1: Batch Revert */}
                <div
                  onClick={() => setRevertStock(true)}
                  className={`rounded-2xl border-2 p-3.5 transition cursor-pointer select-none ${
                    revertStock
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <input
                        type="radio"
                        name="revertBatch"
                        checked={revertStock}
                        onChange={() => setRevertStock(true)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-black text-neutral-900">
                          ⭐ Otomatis Sesuaikan &amp; Kembalikan Stok Semua Produk Terpilih
                        </span>
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                          DIREKOMENDASIKAN
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                        Setiap transaksi <strong>IN</strong> yang dihapus akan mengurangi stok barang terkait, dan transaksi <strong>OUT</strong> yang dihapus akan menambahkan kembali stok barang ke gudang.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Option 2: Batch Log Only */}
                <div
                  onClick={() => setRevertStock(false)}
                  className={`rounded-2xl border-2 p-3.5 transition cursor-pointer select-none ${
                    !revertStock
                      ? 'border-neutral-600 bg-neutral-100/90 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <input
                        type="radio"
                        name="revertBatch"
                        checked={!revertStock}
                        onChange={() => setRevertStock(false)}
                        className="h-4 w-4 text-neutral-800 focus:ring-neutral-700 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-black text-neutral-900">
                          Hanya Hapus Catatan Riwayat Saja
                        </span>
                        <span className="bg-neutral-200 text-neutral-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          SEMUA STOK TETAP
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-relaxed">
                        Data transaksi terpilih akan dihapus dari riwayat log, namun seluruh angka stok barang saat ini di gudang <strong>tidak akan diubah</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Breakdown Table of Affected Products */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-neutral-500" />
                    <span>Rincian {batchAffectedItems.length} Produk yang Terdampak:</span>
                  </h4>
                  <span className="text-[11px] text-neutral-500 font-semibold">
                    {revertStock ? 'Simulasi Stok Otomatis' : 'Stok Tetap'}
                  </span>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 overflow-hidden divide-y divide-neutral-200 text-xs">
                  {batchAffectedItems.map((item) => (
                    <div key={item.productId} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
                      <div>
                        <p className="font-bold text-neutral-900">{item.productName}</p>
                        <p className="text-[11px] text-neutral-500 font-mono">
                          Barcode: {item.barcode} &bull; Transaksi:{' '}
                          {item.inCount > 0 && <span className="text-emerald-700 font-bold">+{item.totalInQty} IN </span>}
                          {item.outCount > 0 && <span className="text-amber-700 font-bold">-{item.totalOutQty} OUT</span>}
                        </p>
                      </div>

                      <div className="text-right self-end sm:self-auto">
                        {revertStock ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-500 text-[11px]">{item.currentStock}</span>
                            <ArrowRight className="h-3 w-3 text-neutral-400" />
                            <strong className="text-emerald-700 font-black text-xs">
                              {item.projectedStock} {item.unit}
                            </strong>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                              {item.netDelta >= 0 ? `+${item.netDelta}` : item.netDelta}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-neutral-700">
                            Stok Tetap: {item.currentStock} {item.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 px-4 py-2.5 text-xs font-bold transition shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmBatchDelete}
                className="w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-xs font-black transition shadow-sm active:scale-98 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghapus {selectedTxIds.size} Transaksi...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>
                      {revertStock
                        ? `Ya, Hapus ${selectedTxIds.size} Transaksi & Sesuaikan Stok`
                        : `Ya, Hapus ${selectedTxIds.size} Catatan Saja (Stok Tetap)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
