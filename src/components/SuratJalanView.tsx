import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  Plus,
  Truck,
  Calendar,
  User,
  Scale,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit3,
  Search,
  Download,
  X,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Eye,
  RotateCw,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Product, SuratJalan, SuratJalanItem } from '../types';
import { soundManager } from '../utils/audio';

interface SuratJalanViewProps {
  products: Product[];
  suratJalanList: SuratJalan[];
  onSaveSuratJalan: (sj: SuratJalan) => void;
  onDeleteSuratJalan: (sjId: string) => void;
}

export const SuratJalanView: React.FC<SuratJalanViewProps> = ({
  products,
  suratJalanList,
  onSaveSuratJalan,
  onDeleteSuratJalan,
}) => {
  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingSjId, setEditingSjId] = useState<string | null>(null);

  // Form Fields
  const [formSjNumber, setFormSjNumber] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formSenderCourier, setFormSenderCourier] = useState<string>('Ekspedisi Gudang Pusat Momoyo');
  const [formPic, setFormPic] = useState<string>('Staff Penerimaan Momoyo');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | null>(null);
  const [formItems, setFormItems] = useState<SuratJalanItem[]>([
    { productName: '', quantity: 1, unit: 'Karton', weightKg: 10, notes: '' },
  ]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Image Preview Modal
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [zoomPhotoTitle, setZoomPhotoTitle] = useState<string>('');
  const [photoRotation, setPhotoRotation] = useState<number>(0);

  // Delete Target Modal
  const [deleteTargetSj, setDeleteTargetSj] = useState<SuratJalan | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to generate a new SJ Number
  const generateNewSjNumber = (): string => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(100 + Math.random() * 900);
    return `SJ-MMY-${y}${m}${d}-${rand}`;
  };

  // Open Form to create new Surat Jalan
  const handleOpenNewForm = () => {
    const nowIso = new Date();
    const localNow = new Date(nowIso.getTime() - nowIso.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setEditingSjId(null);
    setFormSjNumber(generateNewSjNumber());
    setFormDate(localNow);
    setFormSenderCourier('Ekspedisi Gudang Pusat Momoyo');
    setFormPic('Staff Penerimaan Momoyo');
    setFormNotes('');
    setFormPhotoUrl(null);
    setFormItems([
      {
        productName: products[0]?.name || '',
        productId: products[0]?.id || '',
        quantity: 1,
        unit: products[0]?.unit || 'Karton',
        weightKg: Number(products[0]?.weightPerUnitKg) || 10,
        notes: '',
      },
    ]);
    setIsFormOpen(true);
    soundManager.playPop();
  };

  // Open Form to edit an existing Surat Jalan
  const handleOpenEditForm = (sj: SuratJalan) => {
    setEditingSjId(sj.id);
    setFormSjNumber(sj.sjNumber);
    setFormDate(sj.date ? sj.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setFormSenderCourier(sj.senderCourier);
    setFormPic(sj.pic);
    setFormNotes(sj.notes || '');
    setFormPhotoUrl(sj.photoUrl || null);
    setFormItems(
      sj.items.map((it) => ({
        ...it,
        quantity: Number(it.quantity) || 1,
        weightKg: Number(it.weightKg) || 0,
      }))
    );
    setIsFormOpen(true);
    soundManager.playPop();
  };

  // Compress image client-side to keep Firestore doc size light & performance snappy
  const handleProcessImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Harap pilih file gambar (JPG, PNG, atau WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with 0.75 quality (~120KB - 200KB)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setFormPhotoUrl(compressedDataUrl);
        showToast('Foto Surat Jalan berhasil diunggah!');
        soundManager.playSuccess();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Item rows management in form
  const handleAddItemRow = () => {
    const defaultProd = products.find((p) => !formItems.some((it) => it.productId === p.id)) || products[0];
    setFormItems([
      ...formItems,
      {
        productId: defaultProd?.id || '',
        productName: defaultProd?.name || '',
        quantity: 1,
        unit: defaultProd?.unit || 'Karton',
        weightKg: Number(defaultProd?.weightPerUnitKg) || 10,
        notes: '',
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length <= 1) {
      alert('Surat Jalan wajib memiliki minimal 1 barang!');
      return;
    }
    setFormItems(formItems.filter((_, idx) => idx !== index));
    soundManager.playPop();
  };

  const handleUpdateItemRow = (index: number, updates: Partial<SuratJalanItem>) => {
    setFormItems(
      formItems.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, ...updates };

        // If product selected, auto fill unit & weight
        if (updates.productId) {
          const prod = products.find((p) => p.id === updates.productId);
          if (prod) {
            updated.productName = prod.name;
            updated.unit = prod.unit;
            if (!updates.weightKg) {
              const defaultUnitWeight = Number(prod.weightPerUnitKg) || 10;
              updated.weightKg = Math.round(defaultUnitWeight * (updated.quantity || 1));
            }
          }
        }
        return updated;
      })
    );
  };

  // Calculate live totals for the form
  const { formTotalItems, formTotalQty, formTotalWeightKg } = useMemo(() => {
    let qty = 0;
    let weight = 0;
    formItems.forEach((it) => {
      const q = Math.max(1, Math.round(Number(it.quantity) || 1));
      const w = Math.max(0, Math.round(Number(it.weightKg) || 0));
      qty += q;
      weight += w;
    });
    return {
      formTotalItems: formItems.length,
      formTotalQty: qty,
      formTotalWeightKg: weight,
    };
  }, [formItems]);

  // Save Surat Jalan
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formSjNumber.trim()) {
      alert('Nomor Surat Jalan wajib diisi!');
      return;
    }

    if (formItems.length === 0 || !formItems.some((it) => it.productName.trim())) {
      alert('Masukkan minimal 1 barang dalam Surat Jalan!');
      return;
    }

    const now = new Date().toISOString();
    const finalDate = formDate ? new Date(formDate).toISOString() : now;

    const sjData: SuratJalan = {
      id: editingSjId || `sj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sjNumber: formSjNumber.trim(),
      date: finalDate,
      senderCourier: formSenderCourier.trim() || 'Ekspedisi Gudang Pusat Momoyo',
      pic: formPic.trim() || 'Staff Penerimaan Momoyo',
      photoUrl: formPhotoUrl || undefined,
      items: formItems.map((it) => ({
        ...it,
        productName: it.productName.trim() || 'Barang Surat Jalan',
        quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
        weightKg: Math.max(0, Math.round(Number(it.weightKg) || 0)),
      })),
      totalItems: formTotalItems,
      totalQty: formTotalQty,
      totalWeightKg: formTotalWeightKg,
      notes: formNotes.trim() || undefined,
      createdAt: editingSjId
        ? suratJalanList.find((s) => s.id === editingSjId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    onSaveSuratJalan(sjData);
    setIsFormOpen(false);
    showToast(
      editingSjId
        ? `Surat Jalan ${sjData.sjNumber} berhasil diperbarui!`
        : `Surat Jalan ${sjData.sjNumber} berhasil dicatat (tidak mempengaruhi stok)!`
    );
    soundManager.playSuccess();
  };

  // Filtered Surat Jalan list
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return suratJalanList;
    const q = searchQuery.toLowerCase();
    return suratJalanList.filter(
      (s) =>
        s.sjNumber.toLowerCase().includes(q) ||
        s.senderCourier.toLowerCase().includes(q) ||
        s.pic.toLowerCase().includes(q) ||
        s.items.some((it) => it.productName.toLowerCase().includes(q))
    );
  }, [suratJalanList, searchQuery]);

  // Export Surat Jalan document as PDF
  const handleDownloadPdf = (sj: SuratJalan) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('ARSIP DOKUMEN SURAT JALAN', 105, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text('MOMOYO CILEDUG', 105, 25, { align: 'center' });

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Pencatatan Dokumen Fisik, Kuantitas & Berat Pengiriman (Non-Stok)', 105, 30, { align: 'center' });

      doc.setDrawColor(200, 200, 200);
      doc.line(15, 34, 195, 34);

      // Meta info
      doc.setFontSize(10);
      doc.text(`No. Surat Jalan: ${sj.sjNumber}`, 15, 42);
      doc.text(
        `Tanggal Penerimaan: ${new Date(sj.date).toLocaleDateString('id-ID', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        15,
        48
      );
      doc.text(`Ekspedisi / Pengirim: ${sj.senderCourier}`, 120, 42);
      doc.text(`PIC Penerima: ${sj.pic}`, 120, 48);

      // Table Header
      let y = 56;
      doc.setFillColor(245, 245, 245);
      doc.rect(15, y, 180, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('No', 18, y + 5.5);
      doc.text('Nama Barang', 32, y + 5.5);
      doc.text('Kuantitas (Qty)', 110, y + 5.5);
      doc.text('Berat (Kg)', 150, y + 5.5);

      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      sj.items.forEach((item, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(String(idx + 1), 18, y);
        doc.text(item.productName.substring(0, 42), 32, y);
        doc.text(`${item.quantity} ${item.unit}`, 110, y);
        doc.text(`${item.weightKg} Kg`, 150, y);
        y += 7;
      });

      doc.line(15, y + 2, 195, y + 2);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.text(`Total Variasi: ${sj.totalItems} Barang`, 15, y);
      doc.text(`Total Kuantitas: ${sj.totalQty} Unit`, 80, y);
      doc.text(`Total Berat Muatan: ${sj.totalWeightKg} Kg`, 140, y);

      if (sj.notes) {
        y += 8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.text(`Catatan: ${sj.notes}`, 15, y);
      }

      // Add Photo if exists in document
      if (sj.photoUrl && y < 190) {
        try {
          y += 10;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('Bukti Foto Fisik Surat Jalan:', 15, y);
          y += 4;
          doc.addImage(sj.photoUrl, 'JPEG', 15, y, 90, 65);
        } catch {
          // ignore photo add error
        }
      }

      doc.save(`Surat_Jalan_${sj.sjNumber}.pdf`);
      showToast('Dokumen PDF Surat Jalan berhasil diunduh!');
      soundManager.playSuccess();
    } catch (err) {
      console.error(err);
      showToast('Gagal mencetak dokumen PDF', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg border text-sm font-semibold transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toastMessage.type === 'error'
              ? 'bg-red-600 text-white border-red-500'
              : 'bg-neutral-800 text-white border-neutral-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Hero Banner - Dedicated Surat Jalan (Does Not Affect Stock) */}
      <div className="rounded-2xl bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold tracking-wide">
                <FileText className="h-3.5 w-3.5" />
                <span>Pencatatan Surat Jalan (Non-Stok)</span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 border border-emerald-300/40 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
                <ShieldCheck className="h-3 w-3" />
                <span>Tidak Mempengaruhi Stok Fisik</span>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Input Dokumen Surat Jalan, Berat & Upload Foto
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Arsipkan data Surat Jalan pengiriman dari ekspedisi/supplier lengkap dengan rincian
              kuantitas (Qty), tonase berat (Kg), dan foto fisik dokumen tanda terima untuk pembukuan yang akurat tanpa mengubah saldo stok inventaris.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-input-surat-jalan"
              onClick={handleOpenNewForm}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-white text-blue-800 hover:bg-neutral-100 px-4 py-2.5 text-xs sm:text-sm font-black shadow-md active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Input Surat Jalan Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info Notice Box */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 flex items-start gap-2.5 text-xs text-blue-900 shadow-2xs">
        <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Ketentuan Fitur Surat Jalan:</span> Data yang diinputkan di sini murni disimpan sebagai arsip dokumen pengiriman (bukti foto, ekspedisi, berat tonase, dan kuantitas).
          <span className="underline font-bold ml-1">Tidak akan mengubah/menambah jumlah stok barang</span> di gudang maupun bar. Untuk penambahan stok fisik gudang, gunakan menu <em>Barang Masuk (IN)</em>.
        </div>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-700">
          <span>Total Arsip Surat Jalan:</span>
          <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-black">
            {suratJalanList.length} Dokumen
          </span>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari No. SJ, Ekspedisi, PIC, Barang..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[38px]"
          />
        </div>
      </div>

      {/* Surat Jalan List Cards */}
      {filteredList.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">Belum Ada Dokumen Surat Jalan</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Mulai input dokumen Surat Jalan dari pengirim atau supplier beserta berat, qty, dan foto fisik dokumen.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleOpenNewForm}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Input Surat Jalan Sekarang</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredList.map((sj) => {
            return (
              <div
                key={sj.id}
                className="rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 transition shadow-2xs hover:shadow-md"
              >
                {/* Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs sm:text-sm font-black text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                      {sj.sjNumber}
                    </span>

                    <span className="text-[11px] text-neutral-500">
                      {new Date(sj.date).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {sj.photoUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                        <Camera className="h-3 w-3" />
                        <span>Ada Foto Fisik</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-neutral-600">
                    <span className="flex items-center gap-1 font-medium truncate max-w-[180px] sm:max-w-none">
                      <Truck className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      {sj.senderCourier}
                    </span>
                    <span className="flex items-center gap-1 font-medium truncate max-w-[130px] sm:max-w-none">
                      <User className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      {sj.pic}
                    </span>
                  </div>
                </div>

                {/* Items & Photo Container */}
                <div className="my-3 flex flex-col md:flex-row gap-3">
                  {/* Photo Thumbnail if uploaded */}
                  {sj.photoUrl && (
                    <div className="shrink-0 w-full sm:w-44 md:w-36 flex flex-col gap-1.5">
                      <div
                        onClick={() => {
                          setZoomPhotoUrl(sj.photoUrl!);
                          setZoomPhotoTitle(`Foto Dokumen Surat Jalan ${sj.sjNumber}`);
                          setPhotoRotation(0);
                        }}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 aspect-4/3 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition"
                        title="Klik untuk memperbesar foto dokumen"
                      >
                        <img
                          src={sj.photoUrl}
                          alt="Foto Surat Jalan"
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye className="h-6 w-6 drop-shadow-md" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setZoomPhotoUrl(sj.photoUrl!);
                          setZoomPhotoTitle(`Foto Dokumen Surat Jalan ${sj.sjNumber}`);
                          setPhotoRotation(0);
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center justify-center gap-1"
                      >
                        <Maximize2 className="h-3 w-3" />
                        <span>Perbesar Foto</span>
                      </button>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="flex-1 overflow-x-auto">
                    {/* Mobile Card Rows */}
                    <div className="space-y-1.5 sm:hidden">
                      {sj.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 border border-neutral-100 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-neutral-900 truncate">{it.productName}</p>
                            {it.notes && (
                              <p className="text-[10px] text-neutral-500 truncate">{it.notes}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-1.5">
                            <span className="inline-block rounded-md bg-white border border-neutral-200 px-2 py-0.5 font-bold text-neutral-800 text-[11px]">
                              {it.quantity} {it.unit}
                            </span>
                            <span className="inline-block rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 font-black text-[11px]">
                              {it.weightKg} Kg
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tablet/Desktop Table View */}
                    <table className="hidden sm:table w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400">
                          <th className="py-1 px-2">No</th>
                          <th className="py-1 px-2">Nama Barang</th>
                          <th className="py-1 px-2 text-center">Jumlah (Qty)</th>
                          <th className="py-1 px-2 text-right">Berat (Kg)</th>
                          <th className="py-1 px-2">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {sj.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50/60">
                            <td className="py-1.5 px-2 text-neutral-400 text-[11px]">{idx + 1}</td>
                            <td className="py-1.5 px-2 font-bold text-neutral-800">
                              {item.productName}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span className="inline-block rounded-md bg-neutral-100 px-2.5 py-0.5 font-bold text-neutral-900">
                                {item.quantity} {item.unit}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-right font-semibold text-blue-800">
                              {item.weightKg} Kg
                            </td>
                            <td className="py-1.5 px-2 text-neutral-500 text-[11px] truncate max-w-[150px]">
                              {item.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes if any */}
                {sj.notes && (
                  <div className="mb-3 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 italic border border-neutral-100">
                    "{sj.notes}"
                  </div>
                )}

                {/* Summary & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-neutral-700">
                    <span>
                      Total: <strong className="text-neutral-900">{sj.totalItems} Barang</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Kuantitas: <strong className="text-neutral-900">{sj.totalQty} Unit</strong>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                      <Scale className="h-3.5 w-3.5 text-blue-600" />
                      <strong>Total Berat: {sj.totalWeightKg} Kg</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* View Photo if exists */}
                    {sj.photoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setZoomPhotoUrl(sj.photoUrl!);
                          setZoomPhotoTitle(`Foto Dokumen Surat Jalan ${sj.sjNumber}`);
                          setPhotoRotation(0);
                        }}
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-bold transition active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Foto</span>
                      </button>
                    )}

                    {/* Download PDF */}
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(sj)}
                      className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 transition"
                      title="Download Arsip Dokumen PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Edit Surat Jalan */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(sj)}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-blue-600" />
                      <span>Edit SJ</span>
                    </button>

                    {/* Delete Surat Jalan */}
                    <button
                      type="button"
                      onClick={() => setDeleteTargetSj(sj)}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INPUT / EDIT SURAT JALAN MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-linear-to-r from-blue-700 to-indigo-700 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingSjId ? 'Edit Dokumen Surat Jalan' : 'Input Dokumen Surat Jalan Baru'}
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    Catat nomor surat jalan, tonase berat, kuantitas & upload foto bukti fisik (tidak mempengaruhi stok)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Notice reminder */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 flex items-center gap-2 text-xs text-blue-900">
                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Perhatian:</strong> Data yang diinput hanya disimpan sebagai arsip dokumen pengiriman (berat & qty), <strong>tidak mengubah stok</strong> inventaris.
                </span>
              </div>

              {/* Basic Meta Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    No. Surat Jalan (Fisik) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSjNumber}
                    onChange={(e) => setFormSjNumber(e.target.value)}
                    placeholder="Contoh: SJ-MMY-2026..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Tanggal Penerimaan *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Ekspedisi / Pengirim / Sopir *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSenderCourier}
                    onChange={(e) => setFormSenderCourier(e.target.value)}
                    placeholder="Gudang Pusat / Nama Ekspedisi"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    PIC Penerima (Staff) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPic}
                    onChange={(e) => setFormPic(e.target.value)}
                    placeholder="Nama Staff Penerima"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-4">
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Catatan Dokumen Surat Jalan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Contoh: Kondisi paket kardus basah sedikit / truk tiba jam 10 malam"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Photo Upload Section (Feature Requested: "adakan fitur upload foto untuk Surat jalan nya") */}
              <div className="bg-neutral-50 p-3.5 sm:p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-blue-600" />
                    Upload Foto Dokumen Fisik Surat Jalan:
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Bisa foto langsung dari kamera HP atau upload file
                  </span>
                </div>

                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessImageFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessImageFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {formPhotoUrl ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-neutral-200">
                    <div className="relative group shrink-0 w-36 h-28 rounded-lg overflow-hidden border border-neutral-300 bg-neutral-100 flex items-center justify-center">
                      <img
                        src={formPhotoUrl}
                        alt="Pratinjau Surat Jalan"
                        className="h-full w-full object-cover"
                      />
                      <div
                        onClick={() => {
                          setZoomPhotoUrl(formPhotoUrl);
                          setZoomPhotoTitle('Pratinjau Foto Dokumen Surat Jalan');
                          setPhotoRotation(0);
                        }}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition"
                      >
                        <Eye className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="space-y-2 flex-1 text-center sm:text-left">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Foto Surat Jalan Siap Disimpan</span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Foto telah dikompres secara otomatis agar tajam namun ringan untuk sinkronisasi cloud multi-device.
                      </p>

                      <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                        <button
                          type="button"
                          onClick={() => {
                            setZoomPhotoUrl(formPhotoUrl);
                            setZoomPhotoTitle('Pratinjau Foto Dokumen Surat Jalan');
                            setPhotoRotation(0);
                          }}
                          className="min-h-[34px] px-3 py-1 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Perbesar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="min-h-[34px] px-3 py-1 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>Ganti Foto</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormPhotoUrl(null)}
                          className="min-h-[34px] px-3 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus Foto</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="min-h-[64px] flex items-center justify-center gap-2.5 p-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 text-blue-800 transition active:scale-98"
                    >
                      <Camera className="h-6 w-6 text-blue-600" />
                      <div className="text-left">
                        <p className="text-xs font-black">Foto Kamera HP Langsung</p>
                        <p className="text-[10px] text-blue-600">Ambil foto kertas surat jalan</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[64px] flex items-center justify-center gap-2.5 p-3 rounded-xl border-2 border-dashed border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 transition active:scale-98"
                    >
                      <Upload className="h-6 w-6 text-neutral-500" />
                      <div className="text-left">
                        <p className="text-xs font-bold">Pilih File dari Galeri / Laptop</p>
                        <p className="text-[10px] text-neutral-500">Mendukung format JPG, PNG, WebP</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Items in Surat Jalan (Item, Qty, and Berat Kg) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-800">
                      Rincian Barang, Kuantitas (Qty) & Berat (Kg)
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Pilih dari master produk atau ketik nama barang secara manual
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Tambah Baris Barang</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {formItems.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl border border-neutral-200 bg-white shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-500">
                          Baris #{index + 1}
                        </span>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            className="p-1 text-neutral-400 hover:text-rose-600 transition"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        {/* Select Product or Type Name */}
                        <div className="sm:col-span-6">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Pilih Produk / Ketik Nama Barang
                          </label>
                          <div className="space-y-1">
                            <select
                              value={item.productId || ''}
                              onChange={(e) => handleUpdateItemRow(index, { productId: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-neutral-50"
                            >
                              <option value="">-- Pilih dari Master Inventaris (Opsi Cepat) --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.unit})
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              required
                              value={item.productName}
                              onChange={(e) => handleUpdateItemRow(index, { productName: e.target.value })}
                              placeholder="Atau ketik nama barang bebas di sini..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        {/* Qty & Unit */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Jumlah (Qty) & Satuan
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleUpdateItemRow(index, { quantity: isNaN(val) ? 1 : Math.max(1, val) });
                              }}
                              className="w-20 px-2 py-1.5 rounded-lg border border-neutral-300 text-xs font-black text-center focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleUpdateItemRow(index, { unit: e.target.value })}
                              placeholder="Karton/Dus"
                              className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 text-xs font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>

                        {/* Berat (Kg) */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-neutral-600 mb-0.5">
                            Berat Total Item (Kg)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              required
                              value={item.weightKg}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleUpdateItemRow(index, { weightKg: isNaN(val) ? 0 : Math.max(0, val) });
                              }}
                              className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-neutral-300 text-xs font-black focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="absolute right-2.5 top-1.5 text-xs font-bold text-neutral-400">
                              Kg
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Live Summary */}
                <div className="rounded-xl bg-neutral-900 text-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                    <div>
                      <span className="text-neutral-400">Total Variasi:</span>{' '}
                      <strong className="text-white text-sm">{formTotalItems} Barang</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400">Total Kuantitas:</span>{' '}
                      <strong className="text-white text-sm">{formTotalQty} Unit</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400">Total Berat Dokumen:</span>{' '}
                      <strong className="text-amber-400 text-sm">{formTotalWeightKg} Kg</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Tidak Mengubah Saldo Stok Gudang</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal Footer */}
              <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md active:scale-95 transition"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{editingSjId ? 'Simpan Perubahan Surat Jalan' : 'Simpan Dokumen Surat Jalan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO ZOOM MODAL */}
      {zoomPhotoUrl && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-4xl max-h-[92vh] flex flex-col items-center">
            {/* Controls Bar */}
            <div className="w-full flex items-center justify-between text-white pb-3 px-2">
              <span className="text-xs sm:text-sm font-bold truncate max-w-[260px] sm:max-w-md">
                {zoomPhotoTitle || 'Foto Surat Jalan'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoRotation((prev) => (prev + 90) % 360)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                  title="Putar Foto (Rotasi 90 derajat)"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <a
                  href={zoomPhotoUrl}
                  download="Foto_Surat_Jalan.jpg"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                  title="Download File Foto"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setZoomPhotoUrl(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                  title="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Photo Element */}
            <div className="overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 max-h-[80vh] flex items-center justify-center">
              <img
                src={zoomPhotoUrl}
                alt="Zoom Foto Surat Jalan"
                style={{ transform: `rotate(${photoRotation}deg)` }}
                className="max-h-[78vh] max-w-full object-contain transition-transform duration-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetSj && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 p-5 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">
                  Hapus Arsip Surat Jalan?
                </h3>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  {deleteTargetSj.sjNumber}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700 space-y-1.5 border border-neutral-200">
              <div className="flex justify-between">
                <span className="text-neutral-500">Pengirim:</span>
                <span className="font-bold">{deleteTargetSj.senderCourier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Jumlah Barang:</span>
                <span className="font-bold">
                  {deleteTargetSj.totalItems} Barang ({deleteTargetSj.totalQty} Unit)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Total Berat:</span>
                <span className="font-bold text-blue-700">{deleteTargetSj.totalWeightKg} Kg</span>
              </div>
            </div>

            <p className="text-xs text-neutral-500">
              Catatan: Menghapus arsip surat jalan ini tidak akan mengubah stok inventaris toko.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeleteTargetSj(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteTargetSj.id;
                  const num = deleteTargetSj.sjNumber;
                  onDeleteSuratJalan(id);
                  setDeleteTargetSj(null);
                  showToast(`Arsip Surat Jalan ${num} berhasil dihapus.`);
                  soundManager.playPop();
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md active:scale-95 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Ya, Hapus Dokumen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
