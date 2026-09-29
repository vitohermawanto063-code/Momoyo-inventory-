import React, { useMemo } from 'react';
import {
  Flame,
  TrendingDown,
  Boxes,
  Zap,
  Package,
  Layers,
  Activity,
  ArrowUpRight,
  Sparkles,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { Product, StockTransaction, ProductCategory } from '../types';
import { CATEGORIES } from '../data/momoyoInitialData';

interface InventorySummaryDashboardProps {
  products: Product[];
  transactions: StockTransaction[];
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
  onOpenAutoPo?: () => void;
}

export const InventorySummaryDashboard: React.FC<InventorySummaryDashboardProps> = ({
  products,
  transactions,
  onSelectCategory,
  selectedCategory = 'ALL',
  onOpenAutoPo,
}) => {
  // 1. Total Stok & Kapasitas Fisik Gudang (tanpa harga)
  const { totalStockUnits, totalStockWeightKg, criticalCount, safeCount } = useMemo(() => {
    let units = 0;
    let weight = 0;
    let critical = 0;
    let safe = 0;

    for (const p of products) {
      const stock = Math.max(0, Number(p.currentStock) || 0);
      const unitWeight = Math.max(1, Math.round(Number(p.weightPerUnitKg) || 1));
      units += stock;
      weight += stock * unitWeight;

      if (stock <= p.minStock) {
        critical++;
      } else {
        safe++;
      }
    }

    return {
      totalStockUnits: units,
      totalStockWeightKg: Math.round(weight),
      criticalCount: critical,
      safeCount: safe,
    };
  }, [products]);

  // 2. Analisis Kategori Paling Cepat Habis Berdasarkan Riwayat Transaksi (OUT)
  const { fastestCategory, categoryRankings, totalOutQtyAll } = useMemo(() => {
    // Map productId -> category & name
    const prodMap = new Map<string, { category: ProductCategory; name: string }>();
    for (const p of products) {
      prodMap.set(p.id, { category: p.category, name: p.name });
    }

    // Collect stats per category
    const catMap = new Map<
      string,
      {
        category: ProductCategory;
        totalOutQty: number;
        txCount: number;
        productOutMap: Map<string, number>;
      }
    >();

    for (const cat of CATEGORIES) {
      catMap.set(cat, {
        category: cat,
        totalOutQty: 0,
        txCount: 0,
        productOutMap: new Map(),
      });
    }

    let allOutQty = 0;

    for (const tx of transactions) {
      if (tx.type === 'OUT') {
        const qty = Math.max(0, Number(tx.quantity) || 0);
        allOutQty += qty;

        const prodInfo = prodMap.get(tx.productId);
        const category =
          prodInfo?.category ||
          products.find((p) => p.name === tx.productName || p.barcode === tx.barcode)?.category;

        if (category) {
          const entry = catMap.get(category) || {
            category,
            totalOutQty: 0,
            txCount: 0,
            productOutMap: new Map(),
          };

          entry.totalOutQty += qty;
          entry.txCount += 1;

          const pName = tx.productName || prodInfo?.name || 'Item';
          const prevP = entry.productOutMap.get(pName) || 0;
          entry.productOutMap.set(pName, prevP + qty);

          catMap.set(category, entry);
        }
      }
    }

    // Convert map to sorted array
    const sorted = Array.from(catMap.values())
      .map((item) => {
        let topProdName = '';
        let topProdQty = 0;
        item.productOutMap.forEach((q, name) => {
          if (q > topProdQty) {
            topProdQty = q;
            topProdName = name;
          }
        });

        const catCurrentStock = products
          .filter((p) => p.category === item.category)
          .reduce((acc, curr) => acc + curr.currentStock, 0);

        return {
          category: item.category,
          totalOutQty: item.totalOutQty,
          txCount: item.txCount,
          topProductName: topProdName,
          topProductQty: topProdQty,
          currentStock: catCurrentStock,
          percentage: allOutQty > 0 ? Math.round((item.totalOutQty / allOutQty) * 100) : 0,
        };
      })
      .sort((a, b) => b.totalOutQty - a.totalOutQty);

    const fastest = sorted.length > 0 && sorted[0].totalOutQty > 0 ? sorted[0] : null;

    return {
      fastestCategory: fastest,
      categoryRankings: sorted,
      totalOutQtyAll: allOutQty,
    };
  }, [products, transactions]);

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-red-600 to-rose-700 text-white shadow-md shadow-red-500/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-neutral-900 leading-tight flex items-center gap-1.5">
              <span>Dashboard Ringkasan Inventaris</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Real-Time
              </span>
            </h2>
            <p className="text-xs text-neutral-500">
              Kapasitas stok fisik & perputaran kategori paling cepat habis Momoyo Ciledug
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-800">{products.length} SKU</span>
          <span>•</span>
          <span className="font-semibold text-neutral-800">{totalStockUnits} Unit Stok</span>
          <span>•</span>
          <span className="font-semibold text-neutral-800">{transactions.length} Transaksi</span>
        </div>
      </div>

      {/* Main 2-Column Focus Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Card 1: Total Stok Fisik & Estimasi Berat Gudang */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-500/5 via-teal-50/20 to-white p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-emerald-300 transition-all">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100/90 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <Boxes className="h-3.5 w-3.5 text-emerald-700" />
                Total Stok Fisik Gudang
              </span>
              <span className="text-[11px] font-semibold text-neutral-500">
                {products.length} SKU Terdaftar
              </span>
            </div>

            <div>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 mt-1">
                {totalStockUnits}{' '}
                <span className="text-base font-bold text-neutral-500">Unit Stok</span>
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-600">
                <span className="flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  <Scale className="h-3 w-3 text-emerald-700" />
                  Estimasi Total: {totalStockWeightKg} Kg
                </span>
                <span className="text-neutral-500">
                  (Rata-rata {products.length > 0 ? Math.round(totalStockUnits / products.length) : 0} unit / SKU)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {criticalCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  {criticalCount} SKU Menipis
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Semua Stok Aman
                </span>
              )}
              <span className="text-neutral-500 text-[11px]">{safeCount} SKU status aman</span>
            </div>

            {criticalCount > 0 && onOpenAutoPo ? (
              <button
                type="button"
                onClick={onOpenAutoPo}
                className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-linear-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 px-2.5 py-1 rounded-lg shadow-2xs active:scale-95 transition"
                title="Buka PO Otomatis untuk restock barang kritis dan kirim via WhatsApp"
              >
                <ClipboardList className="h-3 w-3" />
                <span>Buat PO Otomatis ({criticalCount})</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                <Package className="h-3 w-3" />
                Gudang Aktif
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Kategori Paling Cepat Habis Berdasarkan Riwayat Transaksi OUT */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-linear-to-br from-amber-500/5 via-orange-50/20 to-white p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:border-amber-300 transition-all">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                <Flame className="h-3.5 w-3.5 text-amber-600 fill-amber-600" />
                Kategori Paling Cepat Habis
              </span>
              <span className="text-[11px] font-semibold text-neutral-500">
                {totalOutQtyAll > 0 ? `${totalOutQtyAll} Unit Total Keluar` : 'Riwayat OUT'}
              </span>
            </div>

            {fastestCategory ? (
              <div>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                    {fastestCategory.category}
                  </h3>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                    {fastestCategory.percentage}% Konsumsi
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-xs text-neutral-600">
                  <p className="flex items-center gap-1.5">
                    <span className="font-bold text-neutral-900">
                      {fastestCategory.totalOutQty} Unit Keluar
                    </span>
                    <span>dari</span>
                    <span className="font-semibold text-neutral-800">
                      {fastestCategory.txCount} kali transaksi keluar
                    </span>
                  </p>
                  {fastestCategory.topProductName && (
                    <p className="text-[11px] text-neutral-500 truncate">
                      Barang paling cepat keluar:{' '}
                      <span className="font-bold text-neutral-800">
                        {fastestCategory.topProductName} ({fastestCategory.topProductQty} unit)
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-2 space-y-1">
                <p className="text-sm font-bold text-neutral-800">Belum Ada Transaksi Keluar (OUT)</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Kategori tercepat habis akan terkalkulasi secara otomatis saat barista atau staf mencatat pengeluaran stok di tab KELUAR.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between text-xs">
            {fastestCategory && onSelectCategory ? (
              <button
                type="button"
                onClick={() => onSelectCategory(fastestCategory.category)}
                className="inline-flex items-center gap-1 font-bold text-amber-800 hover:text-amber-950 underline text-xs"
              >
                <span>Lihat Barang Kategori Ini</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="text-neutral-500 text-[11px]">Berdasarkan mutasi riwayat OUT</span>
            )}

            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded-md">
              <Zap className="h-3 w-3 text-amber-600" />
              Fast Moving Velocity
            </div>
          </div>
        </div>
      </div>

      {/* Mini Breakdown of Category Turnover / Outgoing Velocity */}
      {totalOutQtyAll > 0 && categoryRankings.length > 0 && (
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
            <span className="flex items-center gap-1 text-[11px]">
              <TrendingDown className="h-3.5 w-3.5 text-neutral-500" />
              Perbandingan Kecepatan Habis per Kategori (Total Pengeluaran Stok):
            </span>
            <span className="text-[10px] text-neutral-500 font-normal">
              Klik kategori untuk filter cepat
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
            {categoryRankings.map((cat, idx) => {
              const isSelected = selectedCategory === cat.category;
              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => onSelectCategory?.(cat.category)}
                  className={`text-left rounded-xl p-2.5 border transition-all ${
                    isSelected
                      ? 'border-red-500 bg-red-50/80 ring-1 ring-red-400'
                      : idx === 0 && cat.totalOutQty > 0
                      ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-100/50'
                      : 'border-neutral-200 bg-white hover:bg-neutral-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold text-neutral-500 truncate">
                      #{idx + 1} {cat.category}
                    </span>
                    {idx === 0 && cat.totalOutQty > 0 && (
                      <Flame className="h-3 w-3 text-amber-600 shrink-0 fill-amber-600" />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-black text-neutral-900">
                      {cat.totalOutQty} <span className="text-[10px] font-normal text-neutral-500">Unit</span>
                    </span>
                    <span className="text-[10px] font-bold text-neutral-600">{cat.percentage}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-neutral-100 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        idx === 0 ? 'bg-amber-500' : 'bg-neutral-400'
                      }`}
                      style={{ width: `${Math.max(4, cat.percentage)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
