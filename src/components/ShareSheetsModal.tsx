import React, { useState } from 'react';
import {
  X,
  Globe,
  Lock,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Users,
  FileSpreadsheet,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { setSpreadsheetPublicAnyoneWithLink } from '../services/googleSheets';

interface ShareSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetUrl: string | null;
  spreadsheetId: string | null;
  accessToken: string | null;
  isPublicAccess: boolean;
  onAccessUpdated?: (isPublic: boolean) => void;
  onOpenAppsScript?: () => void;
}

export const ShareSheetsModal: React.FC<ShareSheetsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetUrl,
  spreadsheetId,
  accessToken,
  isPublicAccess,
  onAccessUpdated,
  onOpenAppsScript,
}) => {
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPublic, setCurrentPublic] = useState(isPublicAccess);
  const [accessRole, setAccessRole] = useState<'reader' | 'commenter' | 'writer'>('reader');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!spreadsheetUrl) return;
    navigator.clipboard.writeText(spreadsheetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleMakePublic = async (role: 'reader' | 'commenter' | 'writer' = 'reader') => {
    if (!accessToken || !spreadsheetId) {
      setStatusNotice('Silakan login ke akun Google terlebih dahulu');
      return;
    }

    try {
      setIsUpdating(true);
      setStatusNotice(null);
      const success = await setSpreadsheetPublicAnyoneWithLink(accessToken, spreadsheetId, role);
      if (success) {
        setCurrentPublic(true);
        setAccessRole(role);
        if (onAccessUpdated) onAccessUpdated(true);
        setStatusNotice(
          role === 'reader'
            ? 'Akses publik aktif! Siapapun yang memiliki link sekarang bisa membuka dan melihat Google Sheets ini.'
            : 'Akses publik aktif! Siapapun dengan link dapat melihat/mengedit spreadsheet.'
        );
      } else {
        setStatusNotice('Gagal mengatur akses otomatis. Pastikan akun Google memiliki izin Drive.');
      }
    } catch (err: unknown) {
      console.error(err);
      setStatusNotice('Terjadi kesalahan saat mengubah izin Google Drive.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      id="share-sheets-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="share-sheets-card"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-emerald-700 px-4 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Pengaturan Akses Google Sheets</h2>
              <p className="text-xs text-emerald-100">Bisa diakses oleh siapapun dengan tautan (Anyone with link)</p>
            </div>
          </div>
          <button
            id="close-share-sheets-btn"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Status Badge */}
          <div
            className={`rounded-xl p-3 border flex items-start gap-3 ${
              currentPublic
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {currentPublic ? (
                <Globe className="h-5 w-5 text-emerald-600" />
              ) : (
                <Lock className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider">Status Akses File:</p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-black ${
                    currentPublic ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {currentPublic ? 'Siapapun Dengan Link (Public)' : 'Terbatas (Restricted)'}
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                {currentPublic
                  ? 'File spreadsheet ini dapat dibuka dan dibaca oleh siapa saja tanpa perlu request akses atau login email khusus.'
                  : 'Saat ini file hanya bisa dibuka oleh pemilik akun Google. Aktifkan tombol di bawah agar bisa diakses siapapun.'}
              </p>
            </div>
          </div>

          {/* Feedback notice */}
          {statusNotice && (
            <div className="rounded-xl bg-neutral-100 p-3 text-xs text-neutral-800 border border-neutral-200 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>{statusNotice}</p>
            </div>
          )}

          {/* Link Box */}
          {spreadsheetUrl ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Tautan / Link Google Sheets:
                </span>
                <span className="text-[11px] text-neutral-400">Google Docs Drive</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={spreadsheetUrl}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-mono text-neutral-800 focus:outline-hidden"
                />
                <button
                  id="copy-sheets-link-btn"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white px-3.5 py-2 text-xs font-bold shrink-0 transition active:scale-95 shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Salin Link
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-neutral-50 p-4 text-center border border-dashed border-neutral-300 space-y-1">
              <FileSpreadsheet className="mx-auto h-6 w-6 text-neutral-400" />
              <p className="text-xs font-bold text-neutral-700">Belum Ada Google Sheets Terbuat</p>
              <p className="text-[11px] text-neutral-500">
                Lakukan sinkronisasi pertama kali dengan tombol "Sync ke Sheets" untuk membuat file.
              </p>
            </div>
          )}

          {/* Action Buttons to Make Public */}
          {spreadsheetId && accessToken && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-emerald-950">Atur Akses Publik Otomatis:</h4>
              </div>

              <p className="text-[11px] text-emerald-900 leading-normal">
                Pilih izin akses agar tim toko, owner, supervisor, atau driver dapat membuka spreadsheet tanpa terkendala izin:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleMakePublic('reader')}
                  disabled={isUpdating}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-left transition disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-emerald-600" />
                    Siapapun Bisa Melihat (Viewer)
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-0.5">
                    Rekomendasi aman: Siapapun dapat membaca & download data tanpa bisa mengubah rumus.
                  </span>
                </button>

                <button
                  onClick={() => handleMakePublic('writer')}
                  disabled={isUpdating}
                  className="flex flex-col items-start p-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-left transition disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Siapapun Bisa Mengedit (Editor)
                  </span>
                  <span className="text-[10px] text-neutral-500 mt-0.5">
                    Semua orang yang punya link dapat menambahkan atau mengedit catatan langsung.
                  </span>
                </button>
              </div>

              {isUpdating && (
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 pt-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Mengubah perizinan file Google Drive...
                </div>
              )}
            </div>
          )}

          {/* Google Apps Script Anti-Tamper & Anti-Data Loss Banner */}
          <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50/40 p-3.5 space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-neutral-900 leading-tight">
                  Proteksi Anti-Data Hilang & Anti-Ubah Liar (Apps Script)
                </h4>
                <p className="text-[11px] text-neutral-600 leading-snug mt-0.5">
                  Pasang Google Apps Script di spreadsheet agar riwayat transaksi terkunci permanen, kolom stok tidak bisa diedit sembarangan tanpa input surat jalan, dan auto-backup setiap hari.
                </p>
              </div>
            </div>

            {onOpenAppsScript && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAppsScript();
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-2 text-xs font-bold transition shadow-xs active:scale-98"
              >
                <span>Lihat & Salin Kode Google Apps Script</span>
              </button>
            )}
          </div>

          {/* Panduan Manual Google Drive */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 space-y-1.5 text-xs text-neutral-600">
            <p className="font-bold text-neutral-800 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-neutral-500" />
              Bisa juga diatur langsung dari Google Sheets:
            </p>
            <ol className="list-decimal list-inside text-[11px] space-y-0.5 text-neutral-600 leading-relaxed pl-1">
              <li>Buka spreadsheet melalui tombol <strong>"Buka di Google Sheets"</strong>.</li>
              <li>Klik tombol hijau <strong>"Bagikan" (Share)</strong> di pojok kanan atas.</li>
              <li>Pada bagian <em>Akses Umum (General Access)</em>, ubah menjadi <strong>"Siapa saja yang memiliki link" (Anyone with the link)</strong>.</li>
              <li>Pilih peran sebagai <strong>Pelihat (Viewer)</strong> atau <strong>Editor</strong>, lalu klik <strong>Selesai</strong>.</li>
            </ol>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            {spreadsheetUrl ? (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold transition shadow-2xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka di Google Sheets
              </a>
            ) : <div />}

            <button
              onClick={onClose}
              className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 text-xs font-bold transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
