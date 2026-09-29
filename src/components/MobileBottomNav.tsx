import React from 'react';
import { Camera, PlusCircle, MinusCircle, Boxes, History, ClipboardList, FileText } from 'lucide-react';
import { ActiveTab } from '../types';
import { soundManager } from '../utils/audio';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenScanner: () => void;
  onOpenStockIn: () => void;
  onOpenStockOut: () => void;
  pendingPoCount?: number;
  totalSuratJalanCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  pendingPoCount = 0,
  totalSuratJalanCount = 0,
}) => {
  const handleTabClick = (tab: ActiveTab) => {
    if (activeTab !== tab) {
      soundManager.playPop();
      setActiveTab(tab);
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-1 pt-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* Tab 1: Stok */}
        <button
          type="button"
          onClick={() => handleTabClick('STOK')}
          className={`min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[9px] font-bold transition active:scale-90 ${
            activeTab === 'STOK'
              ? 'text-red-600 bg-red-50/70 font-black'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <Boxes className={`h-4.5 w-4.5 mb-0.5 ${activeTab === 'STOK' ? 'text-red-600' : 'text-neutral-400'}`} />
          <span>Stok</span>
        </button>

        {/* Tab 2: Barang Masuk (IN) */}
        <button
          type="button"
          onClick={() => handleTabClick('MASUK')}
          className={`min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[9px] font-bold transition active:scale-90 ${
            activeTab === 'MASUK'
              ? 'text-emerald-700 bg-emerald-50/70 font-black'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <PlusCircle className={`h-4.5 w-4.5 mb-0.5 ${activeTab === 'MASUK' ? 'text-emerald-600' : 'text-neutral-400'}`} />
          <span>+ Masuk</span>
        </button>

        {/* Tab 3: Surat Jalan (Non-Stok & Upload Foto) */}
        <button
          type="button"
          onClick={() => handleTabClick('SURAT_JALAN')}
          className={`relative min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[9px] font-bold transition active:scale-90 ${
            activeTab === 'SURAT_JALAN'
              ? 'text-blue-700 bg-blue-50/70 font-black'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
          title="Input Dokumen Surat Jalan & Foto"
        >
          <FileText className={`h-4.5 w-4.5 mb-0.5 ${activeTab === 'SURAT_JALAN' ? 'text-blue-600' : 'text-neutral-400'}`} />
          <span>Surat Jalan</span>
          {totalSuratJalanCount > 0 && (
            <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-blue-600 text-white text-[8px] font-extrabold">
              {totalSuratJalanCount}
            </span>
          )}
        </button>

        {/* Big Center Scanner Button */}
        <div className="-mt-4 px-0.5">
          <button
            type="button"
            onClick={() => {
              soundManager.playPop();
              onOpenScanner();
            }}
            className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-linear-to-tr from-red-600 via-rose-600 to-red-700 text-white shadow-xl shadow-red-500/40 ring-3 ring-white active:scale-90 transition"
            title="Scan Barcode Kamera HP"
          >
            <Camera className="h-5 w-5" />
          </button>
        </div>

        {/* Tab 4: Barang Keluar (OUT) */}
        <button
          type="button"
          onClick={() => handleTabClick('KELUAR')}
          className={`min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[9px] font-bold transition active:scale-90 ${
            activeTab === 'KELUAR'
              ? 'text-amber-700 bg-amber-50/70 font-black'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <MinusCircle className={`h-4.5 w-4.5 mb-0.5 ${activeTab === 'KELUAR' ? 'text-amber-600' : 'text-neutral-400'}`} />
          <span>- Keluar</span>
        </button>

        {/* Tab 5: PO Otomatis & WA */}
        <button
          type="button"
          onClick={() => handleTabClick('PO')}
          className={`relative min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[9px] font-bold transition active:scale-90 ${
            activeTab === 'PO'
              ? 'text-red-600 bg-red-50/70 font-black'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
          title="Purchase Order Otomatis & Kirim WA"
        >
          <ClipboardList className={`h-4.5 w-4.5 mb-0.5 ${activeTab === 'PO' ? 'text-red-600' : 'text-neutral-400'}`} />
          <span>PO WA</span>
          {pendingPoCount > 0 && (
            <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-red-600 text-white text-[8px] font-extrabold animate-pulse">
              {pendingPoCount}
            </span>
          )}
        </button>

        {/* Tab 6: Riwayat */}
        <button
          type="button"
          onClick={() => handleTabClick('RIWAYAT')}
          className={`min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[9px] font-bold transition active:scale-90 ${
            activeTab === 'RIWAYAT'
              ? 'text-neutral-900 bg-neutral-100 font-black'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <History className={`h-4.5 w-4.5 mb-0.5 ${activeTab === 'RIWAYAT' ? 'text-neutral-900' : 'text-neutral-400'}`} />
          <span>Riwayat</span>
        </button>
      </div>
    </nav>
  );
};
