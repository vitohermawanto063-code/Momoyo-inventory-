import React from 'react';
import { X, Keyboard, Command, CornerDownLeft } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';

  const shortcuts = [
    {
      category: 'Pencarian & Barcode',
      items: [
        { keys: [modKey, 'K'], orKey: '/', description: 'Fokus cepat ke kolom pencarian / barcode' },
        { keys: [altKey, 'S'], description: 'Buka scanner barcode kamera HP/Webcam' },
        { keys: [altKey, 'N'], description: 'Tambah barang baru ke inventaris' },
      ],
    },
    {
      category: 'Navigasi Tab Menu (Laptop & PC)',
      items: [
        { keys: [altKey, '1'], description: 'Pindah ke Tab Stok Barang' },
        { keys: [altKey, '2'], description: 'Pindah ke Tab Barang Masuk (IN)' },
        { keys: [altKey, '3'], description: 'Pindah ke Tab Barang Keluar (OUT)' },
        { keys: [altKey, '4'], description: 'Pindah ke Tab Surat Jalan (Non-Stok & Foto)' },
        { keys: [altKey, '5'], description: 'Pindah ke Tab Riwayat Mutasi' },
        { keys: [altKey, '6'], description: 'Pindah ke Tab PO Otomatis & WA' },
      ],
    },
    {
      category: 'Tampilan & Kontrol',
      items: [
        { keys: [altKey, 'V'], description: 'Ganti Tampilan: Tabel Kompak ↔ Kartu Grid' },
        { keys: [altKey, 'F'], description: 'Mode Layar Penuh (Fullscreen Kiosk)' },
        { keys: ['Esc'], description: 'Tutup jendela modal / popup yang aktif' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-red-400 border border-neutral-700">
              <Keyboard className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Pintasan Keyboard (Laptop & Desktop)</h3>
              <p className="text-[11px] text-neutral-400">Navigasi dan input cepat dengan tombol keyboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {shortcuts.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {group.category}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 border border-neutral-100 text-xs"
                  >
                    <span className="text-neutral-700 font-medium">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md bg-white border border-neutral-300 font-mono text-[11px] font-bold text-neutral-800 shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                      {item.orKey && (
                        <>
                          <span className="text-[10px] text-neutral-400">atau</span>
                          <kbd className="px-2 py-0.5 rounded-md bg-white border border-neutral-300 font-mono text-[11px] font-bold text-neutral-800 shadow-2xs">
                            {item.orKey}
                          </kbd>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500">
          <span>Tip: Tekan tombol <kbd className="px-1.5 py-0.2 bg-white border border-neutral-200 rounded font-mono font-bold">Esc</kbd> kapan saja untuk menutup</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
