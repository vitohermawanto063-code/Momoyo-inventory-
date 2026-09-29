import React from 'react';
import { Camera, Search, Sparkles } from 'lucide-react';

interface MobileQuickFabProps {
  onOpenScanner: () => void;
  onFocusSearch?: () => void;
  onOpenAutoPo?: () => void;
  criticalCount?: number;
}

export const MobileQuickFab: React.FC<MobileQuickFabProps> = ({
  onOpenScanner,
  onFocusSearch,
  onOpenAutoPo,
  criticalCount = 0,
}) => {
  return (
    <div className="md:hidden fixed bottom-18 right-3.5 z-30 flex flex-col items-end gap-2 pointer-events-none">
      {/* Quick Critical Alert Button if any critical items */}
      {criticalCount > 0 && onOpenAutoPo && (
        <button
          type="button"
          onClick={onOpenAutoPo}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/30 active:scale-95 transition border border-white/40"
          title="Buat PO Otomatis untuk stok kritis"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{criticalCount} Kritis</span>
        </button>
      )}

      {/* Quick Search Shortcut */}
      {onFocusSearch && (
        <button
          type="button"
          onClick={onFocusSearch}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-md border border-neutral-200 active:scale-95 transition"
          title="Fokus ke Pencarian"
        >
          <Search className="h-4 w-4" />
        </button>
      )}

      {/* Primary Floating Camera Scanner Button */}
      <button
        type="button"
        onClick={onOpenScanner}
        className="pointer-events-auto flex h-13 w-13 items-center justify-center rounded-full bg-linear-to-tr from-red-600 via-rose-600 to-red-700 text-white shadow-xl shadow-red-600/40 ring-4 ring-white active:scale-90 transition"
        title="Scan Barcode Cepat"
      >
        <Camera className="h-6 w-6" />
      </button>
    </div>
  );
};
