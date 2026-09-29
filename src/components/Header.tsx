import React from 'react';
import {
  Camera,
  Boxes,
  History,
  RotateCcw,
  MapPin,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  LogOut,
  UserCheck,
  FileDown,
  FileText,
  Code2,
  Wifi,
  Trash2,
  Zap,
  ClipboardList,
  Keyboard,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  onResetData: () => void;
  totalProductsCount: number;
  criticalProductsCount: number;
  totalTransactionsCount: number;
  totalPendingPoCount?: number;
  totalSuratJalanCount?: number;
  user: User | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onSyncSheets: () => void;
  isSyncing: boolean;
  sheetsUrl?: string | null;
  onOpenShareSheets?: () => void;
  onOpenAllBarcodesPdf?: () => void;
  onOpenAppsScript?: () => void;
  isCloudConnected?: boolean;
  appsScriptUrl?: string | null;
  onOpenShortcuts?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenStockIn,
  onOpenStockOut,
  onResetData,
  totalProductsCount,
  criticalProductsCount,
  totalTransactionsCount,
  totalPendingPoCount = 0,
  totalSuratJalanCount = 0,
  user,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncSheets,
  isSyncing,
  sheetsUrl,
  onOpenShareSheets,
  onOpenAllBarcodesPdf,
  onOpenAppsScript,
  isCloudConnected = true,
  appsScriptUrl,
  onOpenShortcuts,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-red-100 shadow-2xs">
      {/* Brand & Top Status */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Momoyo Store Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-red-600 to-rose-700 text-white shadow-md shadow-red-500/20">
              <span className="font-black text-xl tracking-tighter">M</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-neutral-900 leading-tight">
                  MOMOYO <span className="text-red-600">CILEDUG</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                  <MapPin className="h-2.5 w-2.5" />
                  Cirebon, Jabar
                </span>
                <span
                  id="cloud-online-sync-badge"
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    isCloudConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                  title="Data tersinkronisasi otomatis secara realtime ke seluruh perangkat (HP kasir, tablet, dan laptop)"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isCloudConnected && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        isCloudConnected ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    ></span>
                  </span>
                  <span>{isCloudConnected ? 'Cloud Sync Online' : 'Mode Offline'}</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-medium hidden xs:block">
                Sistem Inventory Barang Masuk (IN) & Keluar (OUT) + Surat Jalan
              </p>
            </div>
          </div>

          {/* Action Header Buttons & Google Account */}
          <div className="flex items-center gap-2">
            {/* Quick IN, OUT, and Barcode PDF buttons on Desktop */}
            <div className="hidden md:flex items-center gap-1.5">
              <button
                id="header-stock-in-btn"
                onClick={onOpenStockIn}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
              >
                <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                + Masuk Stok
              </button>
              <button
                id="header-stock-out-btn"
                onClick={onOpenStockOut}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
              >
                <MinusCircle className="h-3.5 w-3.5 text-amber-600" />
                - Out Keluar
              </button>
              {onOpenAllBarcodesPdf && (
                <button
                  id="header-print-barcodes-pdf-btn"
                  onClick={onOpenAllBarcodesPdf}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs active:scale-98"
                  title="Cetak Barcode Semua Barang & Download File PDF"
                >
                  <FileDown className="h-3.5 w-3.5 text-red-400" />
                  Cetak Barcode PDF
                </button>
              )}
            </div>

            {/* Mobile Barcode PDF Button */}
            {onOpenAllBarcodesPdf && (
              <button
                id="header-mobile-print-barcodes-pdf-btn"
                onClick={onOpenAllBarcodesPdf}
                className="md:hidden flex items-center justify-center h-8 w-8 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-95 shadow-2xs"
                title="Cetak Barcode Semua Barang & Download PDF"
              >
                <FileDown className="h-4 w-4 text-red-400" />
              </button>
            )}

            {/* Google Sheets Sync or Connect Button */}
            {user ? (
              <div className="flex items-center gap-1.5 bg-neutral-100/90 pl-2 pr-1.5 py-1 rounded-xl border border-neutral-200 text-xs">
                <span className="hidden lg:inline text-[11px] font-medium text-neutral-700 truncate max-w-[120px]">
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={onSyncSheets}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
                  title="Sync data stok & surat jalan ke Google Sheets"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sheets</span>
                </button>
                {onOpenShareSheets && (
                  <button
                    onClick={onOpenShareSheets}
                    className="p-1 text-neutral-600 hover:text-emerald-700 transition"
                    title="Atur akses publik: Bisa dibuka oleh siapapun"
                  >
                    <span className="text-[11px] font-bold text-emerald-700 hidden sm:inline px-1">Share</span>
                  </button>
                )}
                <button
                  onClick={onGoogleSignOut}
                  className="p-1 text-neutral-400 hover:text-neutral-700 transition"
                  title="Sign out dari akun Google"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="header-google-signin-btn"
                onClick={onGoogleSignIn}
                className="gsi-material-button inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-2xs transition"
                title="Hubungkan Google Sheets untuk backup online"
              >
                <div className="gsi-material-button-icon h-4 w-4 shrink-0">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full block">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="hidden sm:inline">Google Sheets</span>
              </button>
            )}

            {/* Google Apps Script Button with Auto-Sync Indicator */}
            {onOpenAppsScript && (
              <button
                id="header-apps-script-btn"
                onClick={onOpenAppsScript}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition shadow-2xs ${
                  appsScriptUrl
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
                title={
                  appsScriptUrl
                    ? 'Apps Script Web App Aktif - Setiap transaksi otomatis langsung update ke Google Sheets!'
                    : 'Atur Google Apps Script Web App untuk auto-update Google Sheets 24/7'
                }
              >
                {appsScriptUrl ? (
                  <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500 animate-pulse" />
                ) : (
                  <Code2 className="h-4 w-4 text-emerald-600" />
                )}
                <span className="hidden sm:inline">
                  {appsScriptUrl ? 'GS Auto-Update' : 'Apps Script GS'}
                </span>
                {appsScriptUrl && (
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            )}

            {/* Keyboard Shortcuts Dialog Button (Laptop/Desktop) */}
            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition"
                title="Lihat Pintasan Keyboard Laptop (Alt+1..5, Ctrl+K, Esc)"
              >
                <Keyboard className="h-3.5 w-3.5 text-neutral-500" />
                <span className="text-[11px]">Pintasan</span>
              </button>
            )}

            {/* Fullscreen Kiosk Toggle (Laptop/Desktop) */}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-xl border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 shadow-2xs transition"
                title={isFullscreen ? 'Keluar dari Layar Penuh' : 'Mode Layar Penuh (Kiosk)'}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}

            {/* Primary Mobile-Friendly Scan HP Button */}
            <button
              id="header-scanner-trigger-btn"
              onClick={onOpenScanner}
              className="relative inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-linear-to-r from-red-600 to-rose-600 px-3 sm:px-3.5 py-2 text-xs font-black text-white shadow-md shadow-red-500/25 hover:from-red-700 hover:to-rose-700 active:scale-95 transition"
            >
              <Camera className="h-4 w-4" />
              <span>Scan Barcode</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
            </button>

            {/* Reset / Clear data button */}
            <button
              onClick={() => {
                if (confirm('Kosongkan semua data stok & riwayat transaksi?')) {
                  onResetData();
                }
              }}
              title="Kosongkan semua data inventaris & transaksi"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Tab 1: Stok Barang */}
            <button
              id="tab-inventory-btn"
              onClick={() => setActiveTab('STOK')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'STOK'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Boxes className="h-3.5 w-3.5" />
              <span>Stok Barang</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'STOK' ? 'bg-red-500 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {totalProductsCount}
              </span>
            </button>

            {/* Tab 2: Barang Masuk (IN) */}
            <button
              id="tab-stock-in-btn"
              onClick={() => setActiveTab('MASUK')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'MASUK'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-emerald-700'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Barang Masuk (IN)</span>
            </button>

            {/* Tab 3: Barang Keluar (OUT) */}
            <button
              id="tab-stock-out-btn"
              onClick={() => setActiveTab('KELUAR')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'KELUAR'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-amber-700'
              }`}
            >
              <MinusCircle className="h-3.5 w-3.5 text-amber-500" />
              <span>Barang Keluar (OUT)</span>
            </button>

            {/* Tab: Surat Jalan (Non-Stok, Dokumen, Berat, Qty & Foto) */}
            <button
              id="tab-surat-jalan-btn"
              onClick={() => setActiveTab('SURAT_JALAN')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'SURAT_JALAN'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
              title="Input Dokumen Surat Jalan, Berat, Qty & Upload Foto (Tidak Mengubah Stok)"
            >
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span>Surat Jalan</span>
              {totalSuratJalanCount > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeTab === 'SURAT_JALAN' ? 'bg-blue-900 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {totalSuratJalanCount}
                </span>
              )}
            </button>

            {/* Tab 4: Riwayat Mutasi */}
            <button
              id="tab-history-btn"
              onClick={() => setActiveTab('RIWAYAT')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'RIWAYAT'
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Riwayat Mutasi</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === 'RIWAYAT' ? 'bg-neutral-700 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {totalTransactionsCount}
              </span>
            </button>

            {/* Tab: PO Otomatis & Kirim WA */}
            <button
              id="tab-po-btn"
              onClick={() => setActiveTab('PO')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'PO'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5 text-red-500" />
              <span>PO Otomatis & WA</span>
              {totalPendingPoCount > 0 ? (
                <span className="ml-1 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-extrabold animate-pulse">
                  {totalPendingPoCount}
                </span>
              ) : criticalProductsCount > 0 ? (
                <span className="ml-1 rounded-full bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.2 text-[10px] font-bold">
                  {criticalProductsCount} Kritis
                </span>
              ) : null}
            </button>

            {/* Tab 5: Hapus & Batalkan Transaksi (Slide Khusus Terpisah) */}
            <button
              id="tab-cancel-btn"
              onClick={() => setActiveTab('BATAL')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'BATAL'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'text-neutral-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>Hapus Transaksi</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-500 whitespace-nowrap pl-2">
            {user ? (
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <UserCheck className="h-3.5 w-3.5" />
                Terhubung ke Google Drive
              </span>
            ) : (
              <span>Momoyo Ciledug</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
