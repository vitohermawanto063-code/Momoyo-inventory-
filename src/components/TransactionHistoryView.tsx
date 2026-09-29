import React, { useState, useMemo } from 'react';
import {
  Download,
  ArrowDownCircle,
  ArrowUpRight,
  Search,
  Calendar,
  User,
  FileText,
  Clock,
  Scale,
  Truck,
  CloudUpload,
  CheckCircle,
  ExternalLink,
  Loader2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
  Share2,
  Globe,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  RotateCcw,
  X,
  TrendingDown,
  TrendingUp,
  Info,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Boxes,
} from 'lucide-react';
import { Product, StockTransaction, TransactionType } from '../types';
import { exportTransactionsToCSV } from '../utils/storage';

const INDO_MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface TransactionHistoryViewProps {
  products?: Product[];
  transactions: StockTransaction[];
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onSyncGoogleSheets?: () => void;
  isSyncingSheets?: boolean;
  sheetsUrl?: string | null;
  lastSyncedTime?: string | null;
  onOpenShareSheets?: () => void;
  onDeleteTransaction?: (txId: string, revertStock: boolean) => void;
  onBatchDeleteTransactions?: (txIds: string[], revertStock: boolean) => void;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  products = [],
  transactions,
  onOpenStockIn,
  onOpenStockOut,
  onSyncGoogleSheets,
  isSyncingSheets = false,
  sheetsUrl = null,
  lastSyncedTime = null,
  onOpenShareSheets,
  onDeleteTransaction,
  onBatchDeleteTransactions,
}) => {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filter mode: 'MONTH' (1 Bulan Penuh), 'PRESET' (Hari ini, Kemarin, dll), 'CUSTOM' (Rentang bebas)
  const [filterMode, setFilterMode] = useState<'MONTH' | 'PRESET' | 'CUSTOM'>('MONTH');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickDatePreset, setQuickDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [groupByDate, setGroupByDate] = useState<boolean>(true);

  // Available months list derived from all transactions + current month
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);
    transactions.forEach((t) => {
      const d = new Date(t.date);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentMonthKey]);

  // Helpers for Month navigation
  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  // Compute active date boundaries based on filter mode
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    if (filterMode === 'MONTH') {
      const [yStr, mStr] = selectedMonth.split('-');
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);
      const lastDay = new Date(year, month, 0).getDate();
      return {
        effectiveStartDate: `${selectedMonth}-01`,
        effectiveEndDate: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    return {
      effectiveStartDate: startDate,
      effectiveEndDate: endDate,
    };
  }, [filterMode, selectedMonth, startDate, endDate]);

  // Transaction Deletion State
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [txToDelete, setTxToDelete] = useState<StockTransaction | null>(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [revertStock, setRevertStock] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Live stock calculations for the transaction selected for single deletion
  const targetProduct = useMemo(() => {
    if (!txToDelete) return null;
    return products.find((p) => p.id === txToDelete.productId) || null;
  }, [txToDelete, products]);

  // Current stock level in warehouse
  const liveStockNow = targetProduct ? targetProduct.currentStock : txToDelete ? txToDelete.currentStock : 0;

  // Projected stock level after deletion:
  // Reverting IN: stock decreases (Math.max(0, liveStockNow - txToDelete.quantity))
  // Reverting OUT: stock increases (liveStockNow + txToDelete.quantity)
  const projectedRevertedStock = useMemo(() => {
    if (!txToDelete) return 0;
    if (txToDelete.type === 'IN') {
      return Math.max(0, liveStockNow - txToDelete.quantity);
    } else {
      return liveStockNow + txToDelete.quantity;
    }
  }, [txToDelete, liveStockNow]);

  // Live calculation breakdown for batch deletion
  const batchAffectedItems = useMemo(() => {
    if (!isBatchDeleteModalOpen || selectedTxIds.size === 0) return [];
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
  }, [isBatchDeleteModalOpen, selectedTxIds, transactions, products]);

  // Quick Preset Click Handler
  const handleSelectPreset = (preset: 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH') => {
    setQuickDatePreset(preset);
    const toYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = toYMD(yesterday);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'THIS_WEEK') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Senin
      startOfWeek.setDate(diff);
      setStartDate(toYMD(startOfWeek));
      setEndDate(toYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(startOfMonth));
      setEndDate(toYMD(now));
    }
  };

  // Filter Transactions by Type, Search, and Date Range
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType = filterType === 'ALL' || tx.type === filterType;
      const matchSearch =
        tx.productName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        tx.barcode.includes(searchKeyword) ||
        tx.pic.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (tx.referenceNo && tx.referenceNo.toLowerCase().includes(searchKeyword.toLowerCase())) ||
        (tx.senderCourier && tx.senderCourier.toLowerCase().includes(searchKeyword.toLowerCase())) ||
        (tx.outReason && tx.outReason.toLowerCase().includes(searchKeyword.toLowerCase()));

      // Date filtering per date (YYYY-MM-DD comparison)
      let matchDate = true;
      if (effectiveStartDate || effectiveEndDate) {
        const txDateObj = new Date(tx.date);
        const txYMD = `${txDateObj.getFullYear()}-${String(txDateObj.getMonth() + 1).padStart(2, '0')}-${String(txDateObj.getDate()).padStart(2, '0')}`;

        if (effectiveStartDate && txYMD < effectiveStartDate) {
          matchDate = false;
        }
        if (effectiveEndDate && txYMD > effectiveEndDate) {
          matchDate = false;
        }
      }

      return matchType && matchSearch && matchDate;
    });
  }, [transactions, filterType, searchKeyword, effectiveStartDate, effectiveEndDate]);

  // Grouped by Date structure: Map YYYY-MM-DD -> transactions[]
  const dateGroupedData = useMemo(() => {
    const groups: {
      dateKey: string;
      displayDate: string;
      transactions: StockTransaction[];
      totalIn: number;
      totalOut: number;
      totalInWeight: number;
    }[] = [];

    // Sort descending by date
    const sorted = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const map = new Map<string, StockTransaction[]>();

    sorted.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(tx);
    });

    map.forEach((txList, dateKey) => {
      const d = new Date(dateKey + 'T00:00:00');
      const displayDate = d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const dayIn = txList.filter((t) => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0);
      const dayOut = txList.filter((t) => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0);
      const dayInWeight = txList
        .filter((t) => t.type === 'IN')
        .reduce((acc, t) => acc + (t.totalWeightKg || 0), 0);

      groups.push({
        dateKey,
        displayDate,
        transactions: txList,
        totalIn: dayIn,
        totalOut: dayOut,
        totalInWeight: dayInWeight,
      });
    });

    return groups;
  }, [filteredTransactions]);

  // Helper for formatted month label
  const formatMonthLabel = (mKey: string) => {
    const [yStr, mStr] = mKey.split('-');
    const year = parseInt(yStr, 10);
    const mIdx = parseInt(mStr, 10) - 1;
    const isCurrent = mKey === currentMonthKey;
    return `${INDO_MONTH_NAMES[mIdx]} ${year}${isCurrent ? ' (Bulan Ini)' : ''}`;
  };

  // Dedicated Monthly Summary Statistics for the selected month
  const monthSummary = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;
    const monthName = `${INDO_MONTH_NAMES[monthIdx]} ${year}`;

    const txInMonth = transactions.filter((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });

    const mIn = txInMonth.filter((t) => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0);
    const mOut = txInMonth.filter((t) => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0);
    const mWeight = txInMonth
      .filter((t) => t.type === 'IN')
      .reduce((acc, t) => acc + (t.totalWeightKg || 0), 0);
    const sjSet = new Set(txInMonth.map((t) => t.referenceNo).filter(Boolean));

    return {
      monthName,
      txCount: txInMonth.length,
      totalIn: mIn,
      totalOut: mOut,
      totalWeightIn: Math.round(mWeight * 10) / 10,
      netChange: mIn - mOut,
      sjCount: sjSet.size,
      transactions: txInMonth,
    };
  }, [transactions, selectedMonth]);

  const totalIn = filteredTransactions.filter((t) => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0);
  const totalOut = filteredTransactions.filter((t) => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0);
  const totalInWeight = filteredTransactions
    .filter((t) => t.type === 'IN')
    .reduce((acc, t) => acc + (t.totalWeightKg || 0), 0);

  // Selection & Deletion Helpers
  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!txToDelete || !onDeleteTransaction) return;
    try {
      setIsDeleting(true);
      await onDeleteTransaction(txToDelete.id, revertStock);
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        next.delete(txToDelete.id);
        return next;
      });
      setTxToDelete(null);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      alert('Gagal menghapus transaksi. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedTxIds.size === 0 || !onBatchDeleteTransactions) return;
    try {
      setIsDeleting(true);
      await onBatchDeleteTransactions(Array.from(selectedTxIds), revertStock);
      setSelectedTxIds(new Set());
      setIsBatchDeleteModalOpen(false);
    } catch (err) {
      console.error('Failed to delete transactions:', err);
      alert('Gagal menghapus transaksi terpilih. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Mutasi / Surat Jalan</span>
            <span className="rounded-full bg-neutral-100 p-1.5 text-neutral-600">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-neutral-900">{filteredTransactions.length}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {startDate || endDate ? `Periode terpilih (${dateGroupedData.length} hari mutasi)` : 'Seluruh catatan transaksi Momoyo Ciledug'}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Barang Masuk (IN)</span>
            <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
              <ArrowDownCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-black text-emerald-700">+{totalIn}</p>
            {totalInWeight > 0 && (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                ~{Math.round(totalInWeight * 10) / 10} Kg
              </span>
            )}
          </div>
          <p className="text-[11px] text-emerald-800 mt-0.5">Penerimaan dari Gudang Pusat / Pabrik</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Barang Keluar (OUT)</span>
            <span className="rounded-full bg-amber-100 p-1.5 text-amber-700">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700">-{totalOut}</p>
          <p className="text-[11px] text-amber-800 mt-0.5">Pemakaian Bar & Operasional Store</p>
        </div>
      </div>

      {/* Date Filter Toolbar (In Out Per Bulan / Per Tanggal) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-xs space-y-3">
        {/* Top bar: Mode Selector & Group View Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-700 flex items-center gap-1 mr-1">
              <Calendar className="h-4 w-4 text-red-600" />
              Mode Periode:
            </span>
            <div className="bg-neutral-100 p-1 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterMode('MONTH')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'MONTH'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Riwayat 1 Bulan
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('PRESET')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'PRESET'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Preset Cepat
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('CUSTOM')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'CUSTOM'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Kustom Tanggal
              </button>
            </div>
          </div>

          {/* Group View Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-medium">Tampilan:</span>
            <div className="bg-neutral-100 p-1 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGroupByDate(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  groupByDate ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600'
                }`}
              >
                Kelompokkan Per Hari
              </button>
              <button
                type="button"
                onClick={() => setGroupByDate(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  !groupByDate ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600'
                }`}
              >
                Tabel Lengkap
              </button>
            </div>
          </div>
        </div>

        {/* Mode Specific Controls */}
        {filterMode === 'MONTH' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-neutral-700">Pilih Bulan:</span>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 transition"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
              >
                {availableMonths.map((mKey) => (
                  <option key={mKey} value={mKey}>
                    {formatMonthLabel(mKey)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 transition"
                title="Bulan Selanjutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {selectedMonth !== currentMonthKey && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth(currentMonthKey)}
                  className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition"
                >
                  Kembali ke Bulan Ini
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">Periode:</span>
              <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-lg">
                {effectiveStartDate} s/d {effectiveEndDate}
              </span>
            </div>
          </div>
        )}

        {filterMode === 'PRESET' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-semibold text-neutral-700 mr-1">Preset:</span>
            <button
              type="button"
              onClick={() => handleSelectPreset('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                quickDatePreset === 'ALL' && !startDate && !endDate
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('TODAY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                quickDatePreset === 'TODAY'
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('YESTERDAY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                quickDatePreset === 'YESTERDAY'
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('THIS_WEEK')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                quickDatePreset === 'THIS_WEEK'
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                quickDatePreset === 'THIS_MONTH'
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Bulan Ini
            </button>
          </div>
        )}

        {/* Search Field & Filter Type Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-neutral-100 items-center">
          {filterMode === 'CUSTOM' && (
            <>
              {/* Dari Tanggal */}
              <div className="sm:col-span-3 flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500 whitespace-nowrap">Dari:</span>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setQuickDatePreset('ALL');
                  }}
                  className="w-full rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                />
              </div>

              {/* Sampai Tanggal */}
              <div className="sm:col-span-3 flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500 whitespace-nowrap">Sampai:</span>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setQuickDatePreset('ALL');
                  }}
                  className="w-full rounded-xl border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                />
              </div>
            </>
          )}

          {/* Search Field */}
          <div className={filterMode === 'CUSTOM' ? 'sm:col-span-4 relative' : 'sm:col-span-8 relative'}>
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari surat jalan, nama barang, barcode, kurir, PIC..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
            />
          </div>

          {/* Filter Type (Semua / IN / OUT) */}
          <div className={filterMode === 'CUSTOM' ? 'sm:col-span-2 flex justify-end' : 'sm:col-span-4 flex justify-end'}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'ALL' | TransactionType)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-2 py-1.5 text-xs font-bold text-neutral-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
            >
              <option value="ALL">Semua Tipe Transaksi</option>
              <option value="IN">Hanya IN (Barang Masuk)</option>
              <option value="OUT">Hanya OUT (Barang Keluar)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(startDate || endDate || searchKeyword || filterType !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-neutral-400">Filter Aktif:</span>
            {startDate && (
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                Dari: {startDate}
              </span>
            )}
            {endDate && (
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                Sampai: {endDate}
              </span>
            )}
            {filterType !== 'ALL' && (
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                Tipe: {filterType}
              </span>
            )}
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchKeyword('');
                setFilterType('ALL');
                setQuickDatePreset('ALL');
              }}
              className="text-[10px] font-bold text-red-600 hover:text-red-700 underline ml-auto"
            >
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* Monthly Recap Card for Selected Month */}
      {filterMode === 'MONTH' && (
        <div className="rounded-2xl border border-red-200 bg-linear-to-r from-red-50/80 via-white to-amber-50/50 p-4 shadow-2xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-red-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
                <Calendar className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-neutral-900">
                    Rekapitulasi Mutasi Bulan {monthSummary.monthName}
                  </h3>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    {monthSummary.txCount} Log Transaksi
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Data pergerakan barang masuk & keluar Momoyo Ciledug selama 1 bulan penuh
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportTransactionsToCSV(monthSummary.transactions)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                title="Download data transaksi khusus bulan ini ke format CSV / Excel"
              >
                <Download className="h-3.5 w-3.5 text-neutral-500" />
                Export CSV {monthSummary.monthName}
              </button>
            </div>
          </div>

          {/* 4 Stat Boxes for Month */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800">Barang Masuk (IN)</span>
                <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-700" />
              </div>
              <p className="text-xl font-black text-emerald-700 mt-1">
                +{monthSummary.totalIn} <span className="text-xs font-semibold text-emerald-600">Unit</span>
              </p>
              {monthSummary.totalWeightIn > 0 && (
                <p className="text-[10px] font-semibold text-emerald-800 mt-0.5">
                  Total Berat: ~{monthSummary.totalWeightIn} Kg
                </p>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800">Barang Keluar (OUT)</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <p className="text-xl font-black text-amber-700 mt-1">
                -{monthSummary.totalOut} <span className="text-xs font-semibold text-amber-600">Unit</span>
              </p>
              <p className="text-[10px] text-amber-800 mt-0.5">Pemakaian Store & Bar</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-600">Net Selisih Stok</span>
                {monthSummary.netChange >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
              <p
                className={`text-xl font-black mt-1 ${
                  monthSummary.netChange >= 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {monthSummary.netChange >= 0 ? `+${monthSummary.netChange}` : monthSummary.netChange}{' '}
                <span className="text-xs font-semibold text-neutral-500">Unit</span>
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {monthSummary.netChange >= 0 ? 'Surplus / Stok bertambah' : 'Defisit / Stok berkurang'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-600">Surat Jalan Tercatat</span>
                <FileText className="h-3.5 w-3.5 text-neutral-500" />
              </div>
              <p className="text-xl font-black text-neutral-900 mt-1">
                {monthSummary.sjCount}{' '}
                <span className="text-xs font-semibold text-neutral-500">Dokumen</span>
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Total {monthSummary.txCount} baris mutasi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Sync Banner Card */}
      <div className="rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50/80 via-teal-50/50 to-white p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
            <CloudUpload className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                Backup & Sinkronisasi Google Sheets (Rotasi Slide Per Bulan)
              </h3>
              {lastSyncedTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <CheckCircle className="h-3 w-3" />
                  Tersinkron: {lastSyncedTime}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-800">
              Simpan rekapitulasi surat jalan per tanggal, stok live, dan riwayat mutasi bulanan. Tabel mutasi otomatis berganti tab/slide baru setiap bulan sekali.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {sheetsUrl && (
            <>
              <a
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition shadow-2xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Spreadsheet
              </a>

              {onOpenShareSheets && (
                <button
                  type="button"
                  onClick={onOpenShareSheets}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-3 py-2 text-xs font-bold transition shadow-2xs"
                  title="Atur agar spreadsheet bisa dibuka oleh siapapun dengan link"
                >
                  <Globe className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Akses Publik</span>
                </button>
              )}
            </>
          )}
          {onSyncGoogleSheets && (
            <button
              onClick={onSyncGoogleSheets}
              disabled={isSyncingSheets}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {isSyncingSheets ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CloudUpload className="h-3.5 w-3.5" />
                  Sync ke Sheets
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Action buttons (Export & Add) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-500">
          Ditemukan <strong className="text-neutral-900">{filteredTransactions.length}</strong> transaksi
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportTransactionsToCSV(filteredTransactions)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-2xs transition"
            title="Download file CSV hasil filter tanggal"
          >
            <Download className="h-3.5 w-3.5 text-neutral-500" />
            Export CSV
          </button>
          <button
            onClick={onOpenStockIn}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
          >
            + In Surat Jalan
          </button>
          <button
            onClick={onOpenStockOut}
            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-2xs"
          >
            - Out Keluar
          </button>
        </div>
      </div>

      {/* Informative Guidance Banner for Fitur Hapus Transaksi */}
      <div className="rounded-2xl border border-red-200/80 bg-linear-to-r from-red-50/80 via-amber-50/40 to-white p-3.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700 shrink-0 shadow-2xs">
            <Trash2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-neutral-900 text-xs sm:text-sm">
                Fitur Hapus &amp; Pembatalan Transaksi
              </h4>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">
                Koreksi Stok Akurat
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">
              Salah input surat jalan atau salah catat pengeluaran barang? Klik tombol <strong className="text-red-700">"Hapus"</strong> di setiap baris atau centang kotak di sebelah kiri untuk hapus massal. Sistem menyediakan pilihan: <strong>otomatis mengembalikan stok gudang ke kondisi semula</strong> atau <strong>hanya menghapus catatan riwayat log</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 bg-white/80 border border-neutral-200/80 px-2.5 py-1 rounded-xl shrink-0">
          <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
          <span>Multi-Device Sync</span>
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedTxIds.size > 0 && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50/95 p-3.5 sm:px-4 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs shadow-xs">
              {selectedTxIds.size}
            </span>
            <div>
              <span className="text-xs font-black text-red-950 block">
                {selectedTxIds.size} Transaksi Dipilih untuk Dihapus
              </span>
              <span className="text-[11px] text-red-700">
                Pilih untuk hapus sekaligus atau koreksi stok massal
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-[11px] font-bold text-red-700 underline hover:text-red-900 ml-2"
            >
              {selectedTxIds.size === filteredTransactions.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTxIds(new Set())}
              className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition shadow-2xs"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                setRevertStock(true);
                setIsBatchDeleteModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition shadow-sm flex items-center gap-1.5 active:scale-98"
            >
              <Trash2 className="h-4 w-4" />
              Hapus {selectedTxIds.size} Transaksi Terpilih
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {filteredTransactions.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center space-y-2">
          <Clock className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="text-sm font-bold text-neutral-800">Tidak ada transaksi in/out pada tanggal yang dipilih</p>
          <p className="text-xs text-neutral-500">
            Coba ubah filter rentang tanggal atau klik tombol "Semua Waktu" di atas.
          </p>
        </div>
      ) : groupByDate ? (
        /* Grouped by Date View */
        <div className="space-y-4">
          {dateGroupedData.map((group) => (
            <div key={group.dateKey} className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
              {/* Daily Header Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-neutral-50 px-4 py-3 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700 font-bold">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-neutral-900 capitalize">
                      {group.displayDate}
                    </h3>
                    <span className="text-[11px] text-neutral-500">
                      {group.transactions.length} mutasi barang
                    </span>
                  </div>
                </div>

                {/* Daily Total Badges */}
                <div className="flex items-center gap-2 text-xs">
                  {group.totalIn > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 font-black text-emerald-800">
                      <ArrowDownCircle className="h-3.5 w-3.5" />
                      IN: +{group.totalIn}
                      {group.totalInWeight > 0 && (
                        <span className="font-normal text-[10px] ml-0.5">({group.totalInWeight} Kg)</span>
                      )}
                    </span>
                  )}
                  {group.totalOut > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 font-black text-amber-800">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      OUT: -{group.totalOut}
                    </span>
                  )}
                </div>
              </div>

              {/* Transactions in this Day */}
              <div className="divide-y divide-neutral-100">
                {group.transactions.map((tx) => {
                  const isIn = tx.type === 'IN';
                  const isChecked = selectedTxIds.has(tx.id);
                  const timeOnly = new Date(tx.date).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={tx.id}
                      className={`p-3.5 sm:px-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isChecked ? 'bg-red-50/50' : 'hover:bg-neutral-50/70'
                      }`}
                    >
                      {/* Left: Checkbox, Type icon, Product & Details */}
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectTx(tx.id)}
                          className="mt-1 h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                          title="Pilih untuk hapus massal"
                        />

                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 mt-0.5 ${
                            isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isIn ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </span>

                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${
                                isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isIn ? 'MASUK' : 'KELUAR'}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeOnly} WIB
                            </span>
                            {tx.referenceNo && (
                              <span className="rounded bg-neutral-100 px-1.5 py-0.2 font-mono text-[11px] font-bold text-neutral-800">
                                SJ: {tx.referenceNo}
                              </span>
                            )}
                            {tx.senderCourier && (
                              <span className="rounded bg-neutral-100 px-1.5 py-0.2 text-[10px] text-neutral-600 flex items-center gap-1">
                                <Truck className="h-2.5 w-2.5" />
                                {tx.senderCourier}
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-bold text-neutral-900 leading-snug">{tx.productName}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                            <span className="font-mono">{tx.barcode}</span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-0.5">
                              <User className="h-3 w-3 text-neutral-400" />
                              {tx.pic}
                            </span>
                            {tx.outReason && (
                              <>
                                <span>&bull;</span>
                                <span className="text-amber-800 font-semibold">{tx.outReason}</span>
                              </>
                            )}
                            {tx.notes && (
                              <>
                                <span>&bull;</span>
                                <span className="italic text-neutral-600">"{tx.notes}"</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantities, Stock, and Delete button */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-10 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-neutral-100 sm:border-none">
                        <div className="text-left sm:text-right">
                          <p
                            className={`text-base font-black ${
                              isIn ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}{' '}
                            <span className="text-xs font-semibold text-neutral-600">{tx.unit}</span>
                          </p>
                          {tx.totalWeightKg !== undefined && tx.totalWeightKg > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800">
                              <Scale className="h-3 w-3" />
                              {tx.totalWeightKg} Kg
                            </span>
                          )}
                        </div>

                        <div className="text-right bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-100">
                          <span className="text-[10px] text-neutral-400 block">Stok Sisa</span>
                          <span className="text-xs font-black text-neutral-900">
                            {tx.previousStock} &rarr; {tx.currentStock}
                          </span>
                        </div>

                        {onDeleteTransaction && (
                          <button
                            type="button"
                            onClick={() => {
                              setRevertStock(true);
                              setTxToDelete(tx);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-red-50 hover:border-red-300 text-neutral-600 hover:text-red-700 text-xs font-bold shadow-2xs transition group"
                            title="Hapus atau batalkan mutasi transaksi ini (tersedia pilihan kembalikan stok)"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-neutral-400 group-hover:text-red-600 transition" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Full Flat Table View */
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredTransactions.length > 0 &&
                        selectedTxIds.size === filteredTransactions.length
                      }
                      onChange={handleToggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-neutral-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      title="Pilih Semua Transaksi"
                    />
                  </th>
                  <th className="py-3 px-4">Tipe & Tanggal</th>
                  <th className="py-3 px-4">No. Surat Jalan / Ekspedisi</th>
                  <th className="py-3 px-4">Barang & Barcode</th>
                  <th className="py-3 px-4 text-center">Jumlah & Berat</th>
                  <th className="py-3 px-4 text-center">Stok (Lalu &rarr; Kini)</th>
                  <th className="py-3 px-4">PIC / Petugas</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-3 text-center w-12">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {filteredTransactions.map((tx) => {
                  const isIn = tx.type === 'IN';
                  const isChecked = selectedTxIds.has(tx.id);
                  const formattedDate = new Date(tx.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isChecked ? 'bg-red-50/50' : 'hover:bg-neutral-50/60'
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectTx(tx.id)}
                          className="h-3.5 w-3.5 rounded border-neutral-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isIn ? (
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                              <ArrowDownCircle className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
                              <ArrowUpRight className="h-4 w-4" />
                            </span>
                          )}
                          <div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isIn ? 'MASUK' : 'KELUAR'}
                            </span>
                            <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {formattedDate}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {tx.referenceNo ? (
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded text-xs">
                              {tx.referenceNo}
                            </span>
                            {tx.senderCourier && (
                              <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                                <Truck className="h-3 w-3 text-neutral-400" />
                                {tx.senderCourier}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs italic">Tanpa No. SJ</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-neutral-900 line-clamp-1">{tx.productName}</p>
                        <p className="font-mono text-[11px] text-neutral-500">{tx.barcode}</p>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`text-sm font-black ${
                            isIn ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}{' '}
                          <span className="text-[11px] font-normal text-neutral-600">{tx.unit}</span>
                        </span>
                        {tx.totalWeightKg !== undefined && tx.totalWeightKg > 0 && (
                          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-800 mt-0.5">
                            <Scale className="h-3 w-3" />
                            <span>{tx.totalWeightKg} Kg</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="text-neutral-500 font-medium">{tx.previousStock}</span>
                        <span className="mx-1 text-neutral-400">&rarr;</span>
                        <span className="font-bold text-neutral-900">{tx.currentStock}</span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-neutral-700 font-medium">
                          <User className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{tx.pic}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs space-y-0.5">
                          {tx.outReason && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium mr-1">
                              {tx.outReason}
                            </span>
                          )}
                          {tx.notes && <p className="text-neutral-500 text-[11px] italic">{tx.notes}</p>}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {onDeleteTransaction && (
                          <button
                            type="button"
                            onClick={() => {
                              setRevertStock(true);
                              setTxToDelete(tx);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-red-50 hover:border-red-300 text-neutral-600 hover:text-red-700 text-xs font-bold shadow-2xs transition group"
                            title="Hapus atau batalkan transaksi ini"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-neutral-400 group-hover:text-red-600 transition" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <h3 className="text-sm sm:text-base font-black tracking-tight">Konfirmasi Hapus / Pembatalan Transaksi</h3>
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
              {/* Transaction Summary Card */}
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
                      {txToDelete.type === 'IN' ? `+${txToDelete.quantity}` : `-${txToDelete.quantity}`}{' '}
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

              {/* Stock Reversion Section: Interactive & Crystal Clear */}
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-900 block flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-red-600" />
                  <span>Pilih Tindakan Terhadap Stok Gudang:</span>
                </label>

                {/* Option 1: Revert Stock (Recommended for mistake corrections) */}
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
                        name="revertStockSingle"
                        checked={revertStock}
                        onChange={() => setRevertStock(true)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
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
                            {projectedRevertedStock} {txToDelete.unit}
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

                {/* Option 2: Delete Log Only (Keep Current Stock) */}
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
                        name="revertStockSingle"
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

                      {/* Simulation: Stock remains identical */}
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

              {/* Warning alert */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Tindakan ini permanen dan akan langsung disinkronkan secara real-time ke database cloud seluruh perangkat staf Momoyo Ciledug.
                </p>
              </div>
            </div>

            {/* Modal Footer with Dynamic Action Text */}
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

      {/* BATCH TRANSACTIONS DELETE CONFIRMATION MODAL */}
      {isBatchDeleteModalOpen && (
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
                onClick={() => setIsBatchDeleteModalOpen(false)}
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
                        name="revertStockBatch"
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
                        name="revertStockBatch"
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
                onClick={() => setIsBatchDeleteModalOpen(false)}
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
