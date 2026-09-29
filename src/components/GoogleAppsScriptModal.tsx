import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Lock,
  RefreshCw,
  Database,
  Link2,
  CheckCircle2,
  Zap,
  Globe,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { MOMOYO_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptCode';
import {
  sendToGoogleAppsScript,
  testGoogleAppsScriptConnection,
} from '../services/googleSheets';
import { Product, StockTransaction } from '../types';

interface GoogleAppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetsUrl: string | null;
  appsScriptUrl: string;
  onSaveAppsScriptUrl: (url: string, autoSync: boolean) => Promise<void> | void;
  autoSyncEnabled: boolean;
  products: Product[];
  transactions: StockTransaction[];
  onTriggerFullSync?: () => Promise<void>;
}

export const GoogleAppsScriptModal: React.FC<GoogleAppsScriptModalProps> = ({
  isOpen,
  onClose,
  sheetsUrl,
  appsScriptUrl: initialAppsScriptUrl,
  onSaveAppsScriptUrl,
  autoSyncEnabled: initialAutoSync,
  products,
  transactions,
  onTriggerFullSync,
}) => {
  const [copied, setCopied] = useState(false);
  const [inputUrl, setInputUrl] = useState(initialAppsScriptUrl || '');
  const [autoSync, setAutoSync] = useState(initialAutoSync);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [fullSyncMessage, setFullSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    setInputUrl(initialAppsScriptUrl || '');
    setAutoSync(initialAutoSync);
  }, [initialAppsScriptUrl, initialAutoSync, isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(MOMOYO_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setTestResult({
        success: false,
        message: 'Masukkan URL Google Apps Script Web App terlebih dahulu.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testGoogleAppsScriptConnection(trimmed);
      setTestResult({
        success: res.status === 'success',
        message: res.message || 'Koneksi ke Google Apps Script berhasil terverifikasi!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Gagal menghubungi Apps Script. Pastikan URL benar dan izin akses "Siapa saja (Anyone)".',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveAppsScriptUrl(inputUrl.trim(), autoSync);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert('Gagal menyimpan: ' + (e?.message || 'Error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualFullSync = async () => {
    const url = inputUrl.trim() || initialAppsScriptUrl;
    if (!url) {
      alert('Simpan URL Apps Script terlebih dahulu sebelum melakukan sinkronisasi.');
      return;
    }

    setIsFullSyncing(true);
    setFullSyncMessage(null);
    try {
      if (onTriggerFullSync) {
        await onTriggerFullSync();
        setFullSyncMessage('Sinkronisasi penuh Google Sheets berhasil!');
      } else {
        const res = await sendToGoogleAppsScript(url, {
          action: 'FULL_SYNC',
          products,
          transactions,
        });
        setFullSyncMessage(res.message || 'Semua stok & transaksi terkirim ke Google Sheets!');
      }
    } catch (err: any) {
      setFullSyncMessage('Gagal sync: ' + (err?.message || 'Periksa koneksi'));
    } finally {
      setIsFullSyncing(false);
      setTimeout(() => setFullSyncMessage(null), 5000);
    }
  };

  return (
    <div
      id="apps-script-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="apps-script-modal-card"
        className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-linear-to-r from-neutral-900 via-neutral-900 to-neutral-800 px-5 py-4 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">Google Apps Script & Realtime GS Update</h3>
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold">
                  v3.0 Auto-Sync
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Data nempel permanen di APK & update otomatis ke Google Sheets setiap kali transaksi selesai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Permanent Persistence Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <span>Konfigurasi Nempel Permanen di APK & Cloud</span>
                <span className="rounded-md bg-emerald-200 text-emerald-800 px-1.5 py-0.2 text-[10px] font-black uppercase">
                  Anti-Hilang
                </span>
              </div>
              <p className="text-emerald-700 leading-relaxed">
                Sekali URL Apps Script disimpan, URL akan <strong>tersimpan permanen di cloud (Firestore) dan perangkat Anda</strong>. 
                Anda <strong>TIDAK PERLU LOGIN BERULANG-ULANG</strong> walaupun APK ditutup, logout, atau dibuka dari HP staf lain!
              </p>
            </div>
          </div>

          {/* Apps Script Web App Input Section */}
          <div className="rounded-2xl border-2 border-red-200 bg-linear-to-b from-red-50/40 to-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-black text-neutral-900 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-red-600" />
                URL Web App Google Apps Script:
              </label>
              <div className="flex items-center gap-1.5">
                {initialAppsScriptUrl ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Tersimpan & Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 font-mono"
                />
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputUrl('');
                      setTestResult(null);
                    }}
                    className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700 p-0.5"
                    title="Hapus"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-500">
                Dapatkan URL ini dari menu <strong>Terapkan (Deploy) &rarr; Deployment baru &rarr; Aplikasi Web</strong> di Google Sheets Anda. Pastikan berakhiran <code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-red-600 font-bold">/exec</code>.
              </p>
            </div>

            {/* Toggle Auto-Sync */}
            <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-3">
              <div className="flex items-center gap-2.5">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-neutral-800">
                    Auto-Update Google Sheets Setiap Transaksi
                  </span>
                  <p className="text-[11px] text-neutral-500">
                    Otomatis kirim mutasi masuk/keluar ke GS langsung saat tombol simpan ditekan
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Action Buttons for URL */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !inputUrl.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition active:scale-95 disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" /> : <RefreshCw className="h-3.5 w-3.5 text-neutral-500" />}
                <span>{isTesting ? 'Menguji...' : 'Uji Koneksi Apps Script'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{saveSuccess ? 'Tersimpan Permanen!' : 'Simpan Konfigurasi'}</span>
              </button>

              <button
                type="button"
                onClick={handleManualFullSync}
                disabled={isFullSyncing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-95 disabled:opacity-50 ml-auto"
                title="Kirim seluruh katalog produk & mutasi ke Google Sheets sekarang"
              >
                {isFullSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" /> : <Send className="h-3.5 w-3.5 text-emerald-700" />}
                <span>{isFullSyncing ? 'Mengirim...' : 'Kirim Sync Lengkap Sekarang'}</span>
              </button>
            </div>

            {/* Test Connection / Sync Result Feedback */}
            {testResult && (
              <div
                className={`rounded-xl p-3 text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 font-medium">{testResult.message}</div>
              </div>
            )}

            {fullSyncMessage && (
              <div className="rounded-xl p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{fullSyncMessage}</span>
              </div>
            )}
          </div>

          {/* 3 Step Tutorial on how to deploy Web App */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-red-600" />
              Cara Memasang & Menghubungkan Apps Script (Hanya 1 Menit):
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-neutral-700 leading-relaxed">
              <li>
                Buka file spreadsheet Google Sheets Momoyo Ciledug Anda{' '}
                {sheetsUrl && (
                  <a
                    href={sheetsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-red-600 underline inline-flex items-center gap-0.5 ml-1"
                  >
                    (Buka Spreadsheet <ExternalLink className="h-3 w-3 inline" />)
                  </a>
                )}
              </li>
              <li>
                Di menu bar Google Sheets, klik menu <strong>Ekstensi</strong> &rarr; pilih <strong>Apps Script</strong>.
              </li>
              <li>
                Hapus teks bawaan editor, klik tombol <strong>"Salin Kode Script v3.0"</strong> di bawah lalu <strong>Paste</strong>.
              </li>
              <li>
                Simpan script dengan menekan <strong>Ctrl + S</strong> (atau klik ikon disket).
              </li>
              <li>
                Klik tombol biru <strong>"Terapkan" (Deploy)</strong> di pojok kanan atas &rarr; pilih <strong>"Deployment baru" (New deployment)</strong>.
              </li>
              <li>
                Pilih jenis <strong>"Aplikasi Web" (Web app)</strong>, atur:
                <ul className="list-disc list-inside pl-4 text-neutral-600 mt-1 space-y-0.5 font-medium">
                  <li>Jalankan sebagai: <strong>Saya (Email Anda)</strong></li>
                  <li>Yang memiliki akses: <strong className="text-red-700">Siapa saja (Anyone)</strong> <em>(Wajib agar APK bisa update tanpa login ulang!)</em></li>
                </ul>
              </li>
              <li>
                Klik <strong>Terapkan</strong>, berikan izin Google, lalu salin <strong>URL Aplikasi Web (/exec)</strong> dan tempelkan di kotak atas!
              </li>
            </ol>
          </div>

          {/* Code Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Code2 className="h-4 w-4 text-neutral-500" />
                Kode Google Apps Script v3.0 (Code.gs):
              </label>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-neutral-800 transition active:scale-95 shadow-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Kode Berhasil Disalin!' : 'Salin Kode Script v3.0'}</span>
              </button>
            </div>

            <div className="relative rounded-xl border border-neutral-300 bg-neutral-950 p-4 text-neutral-100 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto shadow-inner select-all">
              <pre className="whitespace-pre">{MOMOYO_APPS_SCRIPT_CODE}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-5 py-3.5 shrink-0">
          <div className="text-[11px] text-neutral-500">
            Sistem Inventaris Momoyo Ciledug &bull; Realtime Apps Script Webhook
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow-sm active:scale-98"
            >
              {saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>{saveSuccess ? 'Tersimpan!' : 'Simpan & Terapkan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
