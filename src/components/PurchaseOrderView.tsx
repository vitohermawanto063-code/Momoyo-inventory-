import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Send,
  CheckCircle2,
  Package,
  AlertTriangle,
  Scale,
  Calendar,
  User,
  Truck,
  FileText,
  Copy,
  ExternalLink,
  Trash2,
  Edit3,
  Search,
  ArrowRight,
  Sparkles,
  Download,
  Phone,
  Layers,
  Clock,
  ArrowDownCircle,
  RefreshCw,
  X,
  Boxes,
  Smartphone,
  Laptop,
  Check,
  MessageCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import { Product, StockTransaction, PurchaseOrder, PurchaseOrderItem, POStatus } from '../types';
import { soundManager } from '../utils/audio';

interface PurchaseOrderViewProps {
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  onSavePO: (po: PurchaseOrder) => void;
  onDeletePO: (poId: string) => void;
  onReceivePOIntoStock: (po: PurchaseOrder) => void;
  onGoToStockIn?: () => void;
}

export const PurchaseOrderView: React.FC<PurchaseOrderViewProps> = ({
  products,
  purchaseOrders,
  onSavePO,
  onDeletePO,
  onReceivePOIntoStock,
}) => {
  // Tabs for listing
  const [filterStatus, setFilterStatus] = useState<'ALL' | POStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // WhatsApp Format Mode preference: 'CONCISE' (Only Item Name & Qty - User requested) vs 'FULL'
  const [waFormatMode, setWaFormatMode] = useState<'CONCISE' | 'FULL'>('CONCISE');

  // Builder modal state
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);
  const [editingPoId, setEditingPoId] = useState<string | null>(null);

  // Form states for PO Builder
  const [formPoNumber, setFormPoNumber] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formSupplier, setFormSupplier] = useState<string>('Gudang Pusat Momoyo');
  const [formSupplierPhone, setFormSupplierPhone] = useState<string>('');
  const [formPic, setFormPic] = useState<string>('Staff Shift Momoyo');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formStatus, setFormStatus] = useState<POStatus>('DRAFT');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);

  // Delete modal state
  const [deleteTargetPo, setDeleteTargetPo] = useState<PurchaseOrder | null>(null);

  // WhatsApp Preview modal state for specific PO in list
  const [previewWaPo, setPreviewWaPo] = useState<PurchaseOrder | null>(null);
  const [copiedPoId, setCopiedPoId] = useState<string | null>(null);

  // Item selector in Builder
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogCategory, setCatalogCategory] = useState<string>('ALL');

  // Toast / Feedback
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Identify low-stock items automatically
  const criticalProducts = useMemo(() => {
    return products.filter((p) => Number(p.currentStock) <= Number(p.minStock));
  }, [products]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Generate unique PO Number
  const generateNewPoNumber = (): string => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-MMY-${y}${m}${d}-${rand}`;
  };

  // Open Builder for Automatic PO from Critical Stock
  const handleOpenAutoPo = () => {
    const nowIso = new Date().toISOString().slice(0, 16);
    setEditingPoId(null);
    setFormStatus('DRAFT');
    setFormPoNumber(generateNewPoNumber());
    setFormDate(nowIso);
    setFormSupplier('Gudang Pusat Momoyo');
    setFormSupplierPhone('');
    setFormPic('Staff Shift Momoyo');
    setFormNotes('Restock otomatis untuk barang yang stoknya di bawah batas aman minimum.');

    // Build items from critical products
    const initialItems: PurchaseOrderItem[] = criticalProducts.map((p) => {
      const cur = Math.max(0, Number(p.currentStock) || 0);
      const min = Math.max(1, Number(p.minStock) || 1);
      const suggestedQty = Math.max(1, Math.round(min * 2 - cur));
      const weightPerUnit = Math.max(1, Math.round(Number(p.weightPerUnitKg) || 1));

      return {
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        category: p.category,
        unit: p.unit,
        currentStock: cur,
        minStock: min,
        orderQty: suggestedQty,
        weightPerUnitKg: weightPerUnit,
        notes: `Stok sisa ${cur} ${p.unit} (Min: ${min})`,
      };
    });

    setPoItems(initialItems);
    setIsBuilderOpen(true);
    soundManager.playPop();
  };

  // Open Builder for Empty Manual PO
  const handleOpenManualPo = () => {
    const nowIso = new Date().toISOString().slice(0, 16);
    setEditingPoId(null);
    setFormStatus('DRAFT');
    setFormPoNumber(generateNewPoNumber());
    setFormDate(nowIso);
    setFormSupplier('Gudang Pusat Momoyo');
    setFormSupplierPhone('');
    setFormPic('Staff Shift Momoyo');
    setFormNotes('');
    setPoItems([]);
    setIsBuilderOpen(true);
    soundManager.playPop();
  };

  // Open Builder to Edit Existing PO ("edit po")
  const handleOpenEditPo = (po: PurchaseOrder) => {
    setEditingPoId(po.id);
    setFormStatus(po.status);
    setFormPoNumber(po.poNumber);
    setFormDate(po.date ? po.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setFormSupplier(po.supplierName);
    setFormSupplierPhone(po.supplierPhone || '');
    setFormPic(po.pic);
    setFormNotes(po.notes || '');
    setPoItems([...po.items]);
    setIsBuilderOpen(true);
    soundManager.playPop();
  };

  // Add Item to Current PO Builder from Catalog
  const handleAddItemFromCatalog = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    // Check if already in list
    const existingIndex = poItems.findIndex((item) => item.productId === prod.id);
    if (existingIndex >= 0) {
      // Increase qty by 1
      setPoItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, orderQty: item.orderQty + 1 } : item
        )
      );
      showToast(`Jumlah pesanan untuk ${prod.name} ditambah +1`, 'info');
      return;
    }

    const cur = Math.max(0, Number(prod.currentStock) || 0);
    const min = Math.max(1, Number(prod.minStock) || 1);
    const suggestedQty = cur <= min ? Math.max(1, Math.round(min * 2 - cur)) : Math.max(1, min);
    const weightPerUnit = Math.max(1, Math.round(Number(prod.weightPerUnitKg) || 1));

    const newItem: PurchaseOrderItem = {
      productId: prod.id,
      productName: prod.name,
      barcode: prod.barcode,
      category: prod.category,
      unit: prod.unit,
      currentStock: cur,
      minStock: min,
      orderQty: suggestedQty,
      weightPerUnitKg: weightPerUnit,
      notes: '',
    };

    setPoItems((prev) => [...prev, newItem]);
    setSelectedCatalogProductId('');
    soundManager.playSuccess();
  };

  // Update item quantity (strictly integer >= 1)
  const handleUpdateItemQty = (index: number, newQty: number) => {
    const safeQty = Math.max(1, Math.round(newQty));
    setPoItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, orderQty: safeQty } : item))
    );
  };

  // Remove item from PO list
  const handleRemoveItem = (index: number) => {
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
    soundManager.playPop();
  };

  // Calculate totals in Builder
  const { builderTotalItems, builderTotalQty, builderTotalWeightKg } = useMemo(() => {
    let qty = 0;
    let weight = 0;
    for (const item of poItems) {
      const q = Math.max(1, Math.round(Number(item.orderQty) || 1));
      const w = Math.max(1, Math.round(Number(item.weightPerUnitKg) || 1));
      qty += q;
      weight += q * w;
    }
    return {
      builderTotalItems: poItems.length,
      builderTotalQty: qty,
      builderTotalWeightKg: Math.round(weight),
    };
  }, [poItems]);

  // Construct PO object from form
  const buildCurrentPoObject = (statusOverride?: POStatus): PurchaseOrder => {
    const now = new Date().toISOString();
    const finalStatus = statusOverride || formStatus || 'DRAFT';
    return {
      id: editingPoId || `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      poNumber: formPoNumber.trim() || generateNewPoNumber(),
      date: formDate ? new Date(formDate).toISOString() : now,
      supplierName: formSupplier.trim() || 'Gudang Pusat Momoyo',
      supplierPhone: formSupplierPhone.trim() || undefined,
      pic: formPic.trim() || 'Staff Shift Momoyo',
      status: finalStatus,
      items: poItems.map((item) => ({
        ...item,
        orderQty: Math.max(1, Math.round(Number(item.orderQty) || 1)),
        weightPerUnitKg: Math.max(1, Math.round(Number(item.weightPerUnitKg) || 1)),
      })),
      totalItems: builderTotalItems,
      totalQty: builderTotalQty,
      totalEstimatedWeightKg: builderTotalWeightKg,
      notes: formNotes.trim() || undefined,
      createdAt: editingPoId
        ? purchaseOrders.find((p) => p.id === editingPoId)?.createdAt || now
        : now,
      updatedAt: now,
    };
  };

  // Save PO (Draft or Update)
  const handleSaveDraft = () => {
    if (poItems.length === 0) {
      alert('Pilih minimal 1 barang untuk membuat Purchase Order!');
      return;
    }
    const isEditing = Boolean(editingPoId);
    const po = buildCurrentPoObject(isEditing ? formStatus : 'DRAFT');
    onSavePO(po);
    setIsBuilderOpen(false);
    showToast(isEditing ? `Perubahan PO ${po.poNumber} berhasil disimpan!` : `PO ${po.poNumber} berhasil disimpan sebagai Draft!`);
    soundManager.playSuccess();
  };

  /**
   * FORMAT WHATSAPP TEXT
   * REQUEST 1: "untuk di poyang dikirim ke wa hanya menammpilkan nama barang dan jumlah yanag akan dipesan"
   * Mode CONCISE (Default): Hanya menampilkan nama barang dan jumlah yang dipesan.
   */
  const formatWhatsAppText = (
    po: PurchaseOrder | { items: PurchaseOrderItem[]; notes?: string; poNumber?: string; supplierName?: string; pic?: string; date?: string },
    mode: 'CONCISE' | 'FULL' = waFormatMode
  ): string => {
    // Mode Ringkas (Sesuai Permintaan: Hanya nama barang dan jumlah yang dipesan)
    if (mode === 'CONCISE') {
      const lines: string[] = [
        '*Pesanan Barang Momoyo Ciledug:*',
        '',
      ];

      po.items.forEach((item, idx) => {
        lines.push(`${idx + 1}. ${item.productName} : ${item.orderQty} ${item.unit}`);
      });

      if (po.notes && po.notes.trim()) {
        lines.push('');
        lines.push(`Catatan: ${po.notes.trim()}`);
      }

      return lines.join('\n');
    }

    // Mode Lengkap (Dengan Header No. PO, Supplier, Tanggal & PIC)
    const formattedDate = po.date
      ? new Date(po.date).toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('id-ID');

    const lines: string[] = [
      '📦 *PURCHASE ORDER (PO) RESTOCK*',
      '🏬 *MOMOYO CILEDUG*',
      '══════════════════════════',
      `📋 *No. PO:* ${po.poNumber || '-'}`,
      `📅 *Tanggal:* ${formattedDate}`,
      `🏢 *Tujuan:* ${po.supplierName || 'Gudang Pusat Momoyo'}`,
      `👤 *PIC:* ${po.pic || 'Staff Momoyo'}`,
      '',
      '📋 *DAFTAR BARANG YANG DIPESAN:*',
      '──────────────────────────',
    ];

    po.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. *${item.productName}* : ${item.orderQty} ${item.unit}`);
    });

    lines.push('──────────────────────────');
    const totalQty = po.items.reduce((acc, it) => acc + (Number(it.orderQty) || 0), 0);
    lines.push(`📊 *Total Pesanan:* ${totalQty} Unit (${po.items.length} Jenis Barang)`);

    if (po.notes && po.notes.trim()) {
      lines.push('');
      lines.push(`📝 *Catatan:* ${po.notes.trim()}`);
    }

    lines.push('══════════════════════════');
    lines.push('🙏 _Mohon konfirmasi pesanan ini. Terima kasih!_');

    return lines.join('\n');
  };

  // Kirim ke WhatsApp (Responsive untuk HP & Laptop)
  const handleSendWhatsApp = (po: PurchaseOrder) => {
    const waText = formatWhatsAppText(po, waFormatMode);
    const encodedText = encodeURIComponent(waText);

    // Sanitize phone number if provided (e.g. convert 0812 -> 62812)
    let phoneParam = '';
    if (po.supplierPhone) {
      let cleanPhone = po.supplierPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.substring(1);
      }
      phoneParam = cleanPhone;
    }

    // URL WhatsApp Web / App
    const waUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    // Mark as DIKIRIM_WA
    const updatedPo: PurchaseOrder = {
      ...po,
      status: 'DIKIRIM_WA',
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSavePO(updatedPo);

    // Open WhatsApp in new tab / app
    window.open(waUrl, '_blank');
    showToast(`Membuka WhatsApp untuk mengirim PO ${po.poNumber}!`, 'success');
    soundManager.playSuccess();
  };

  // Copy WhatsApp Text to Clipboard
  const handleCopyWhatsAppText = async (po: PurchaseOrder) => {
    const waText = formatWhatsAppText(po, waFormatMode);
    try {
      await navigator.clipboard.writeText(waText);
      setCopiedPoId(po.id);
      setTimeout(() => setCopiedPoId(null), 2500);
      showToast('Teks pesanan WA (Hanya Nama Barang & Jumlah) berhasil disalin!', 'success');
      soundManager.playSuccess();
    } catch {
      showToast('Gagal menyalin teks secara otomatis', 'error');
    }
  };

  // Direct Save & Send WA from Builder
  const handleSaveAndSendWaFromBuilder = () => {
    if (poItems.length === 0) {
      alert('Pilih minimal 1 barang untuk membuat Purchase Order!');
      return;
    }
    const po = buildCurrentPoObject('DIKIRIM_WA');
    po.sentAt = new Date().toISOString();
    onSavePO(po);
    setIsBuilderOpen(false);
    handleSendWhatsApp(po);
  };

  // Inbound: Receive PO into Inventory Stock ("untuk menambahkan barang")
  const handleReceivePo = (po: PurchaseOrder) => {
    if (po.status === 'DITERIMA') {
      alert('PO ini sudah pernah diterima dan ditambahkan ke stok.');
      return;
    }

    const confirmMsg = `Konfirmasi penerimaan barang untuk PO ${po.poNumber}?\n\n` +
      `Total ${po.totalQty} unit dari ${po.totalItems} barang akan langsung DITAMBAHKAN ke stok gudang dan dicatat dalam riwayat Surat Jalan / Barang Masuk (IN).`;

    if (!window.confirm(confirmMsg)) return;

    onReceivePOIntoStock(po);

    // Confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    showToast(`Barang dari PO ${po.poNumber} berhasil ditambahkan ke stok fisik!`, 'success');
  };

  // Export PO as PDF
  const handleDownloadPdf = (po: PurchaseOrder) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('PURCHASE ORDER (PO)', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text('MOMOYO CILEDUG', 105, 27, { align: 'center' });

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Jl. Merdeka No. 45, Ciledug, Cirebon, Jawa Barat', 105, 32, { align: 'center' });

      doc.setDrawColor(200, 200, 200);
      doc.line(15, 36, 195, 36);

      // Meta info
      doc.setFontSize(10);
      doc.text(`No. PO: ${po.poNumber}`, 15, 43);
      doc.text(
        `Tanggal: ${new Date(po.date).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}`,
        15,
        49
      );
      doc.text(`Tujuan: ${po.supplierName}`, 120, 43);
      doc.text(`PIC Pembuat: ${po.pic}`, 120, 49);

      // Table Header
      let y = 58;
      doc.setFillColor(245, 245, 245);
      doc.rect(15, y, 180, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('No', 18, y + 5.5);
      doc.text('Nama Barang', 30, y + 5.5);
      doc.text('Barcode', 95, y + 5.5);
      doc.text('Jumlah Order', 135, y + 5.5);
      doc.text('Estimasi Berat', 170, y + 5.5);

      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      po.items.forEach((item, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const weightStr = item.weightPerUnitKg ? `${item.orderQty * item.weightPerUnitKg} Kg` : '-';
        doc.text(String(idx + 1), 18, y);
        doc.text(item.productName.substring(0, 32), 30, y);
        doc.text(item.barcode, 95, y);
        doc.text(`${item.orderQty} ${item.unit}`, 135, y);
        doc.text(weightStr, 170, y);
        y += 7;
      });

      doc.line(15, y + 2, 195, y + 2);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.text(`Total Variasi: ${po.totalItems} Barang`, 15, y);
      doc.text(`Total Kuantitas: ${po.totalQty} Unit`, 80, y);
      if (po.totalEstimatedWeightKg) {
        doc.text(`Total Muatan: ~${po.totalEstimatedWeightKg} Kg`, 140, y);
      }

      if (po.notes) {
        y += 8;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.text(`Catatan: ${po.notes}`, 15, y);
      }

      // Signatures
      y += 20;
      if (y < 260) {
        doc.setFont('helvetica', 'normal');
        doc.text('Pemesan (Momoyo Ciledug),', 25, y);
        doc.text('Gudang Pusat / Supplier,', 140, y);
        doc.line(25, y + 20, 75, y + 20);
        doc.line(140, y + 20, 190, y + 20);
        doc.text(`( ${po.pic} )`, 35, y + 25);
        doc.text('( ........................... )', 145, y + 25);
      }

      doc.save(`PO_Momoyo_${po.poNumber}.pdf`);
      showToast('File dokumen PDF PO berhasil didownload!', 'success');
      soundManager.playSuccess();
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat dokumen PDF', 'error');
    }
  };

  // Filtered PO list
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchStatus = filterStatus === 'ALL' || po.status === filterStatus;
      const matchSearch =
        searchQuery === '' ||
        po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.pic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.items.some((item) => item.productName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [purchaseOrders, filterStatus, searchQuery]);

  // Catalog items filtered by search and category inside builder
  const filteredCatalogProducts = useMemo(() => {
    let result = products;
    if (catalogCategory !== 'ALL') {
      result = result.filter((p) => p.category === catalogCategory);
    }
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, catalogCategory, catalogSearch]);

  // Live WhatsApp preview for the builder
  const builderWaPreviewText = useMemo(() => {
    return formatWhatsAppText(
      {
        items: poItems,
        notes: formNotes,
        poNumber: formPoNumber,
        supplierName: formSupplier,
        pic: formPic,
        date: formDate,
      },
      waFormatMode
    );
  }, [poItems, formNotes, formPoNumber, formSupplier, formPic, formDate, waFormatMode]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
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

      {/* Top Banner / Hero - Optimized for HP & Laptop */}
      <div className="rounded-2xl bg-linear-to-r from-red-600 via-rose-600 to-red-700 p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold tracking-wide">
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Purchase Order Otomatis & Kirim WA</span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-300/40 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
                <Smartphone className="h-3 w-3" />
                <span>Nyaman di HP</span>
                <span className="opacity-60">•</span>
                <Laptop className="h-3 w-3" />
                <span>Responsif di Laptop</span>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Pemesanan & Restock Barang Momoyo
            </h2>
            <p className="text-xs sm:text-sm text-red-100 max-w-2xl leading-relaxed">
              Buat pesanan otomatis dari stok menipis, kirim format resmi via WhatsApp (hanya nama barang & jumlah pesan), edit atau hapus PO dengan cepat, dan terima ke stok dengan 1 klik saat barang tiba.
            </p>
          </div>

          {/* Action Buttons - Generous Touch Targets for HP & Laptop */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto PO from Critical Stock Button */}
            <button
              id="po-auto-create-btn"
              onClick={handleOpenAutoPo}
              className="min-h-[44px] relative inline-flex items-center gap-2 rounded-xl bg-white text-red-700 hover:bg-neutral-100 px-4 py-2.5 text-xs sm:text-sm font-black shadow-md active:scale-95 transition"
            >
              <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span>PO Otomatis Stok Kritis</span>
              {criticalProducts.length > 0 && (
                <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-extrabold animate-pulse">
                  {criticalProducts.length}
                </span>
              )}
            </button>

            {/* Manual New PO Button */}
            <button
              id="po-manual-create-btn"
              onClick={handleOpenManualPo}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-red-800/80 hover:bg-red-800 text-white border border-white/20 px-3.5 py-2.5 text-xs sm:text-sm font-bold active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Buat PO Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Critical Stock Alert Bar (if items need restocking) */}
      {criticalProducts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-900">
                Ada <span className="underline font-black">{criticalProducts.length} barang</span> yang stoknya di bawah batas aman minimum!
              </p>
              <p className="text-[11px] text-amber-700">
                Segera buat Purchase Order (PO) agar operasional Momoyo Ciledug tidak kehabisan stok bahan.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenAutoPo}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-bold transition shadow-xs shrink-0 self-stretch sm:self-auto justify-center active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate PO Otomatis Sekarang</span>
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar & WA Format Preference */}
      <div className="flex flex-col gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterStatus === 'ALL'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Semua PO ({purchaseOrders.length})
            </button>
            <button
              onClick={() => setFilterStatus('DRAFT')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterStatus === 'DRAFT'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Draft ({purchaseOrders.filter((p) => p.status === 'DRAFT').length})
            </button>
            <button
              onClick={() => setFilterStatus('DIKIRIM_WA')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterStatus === 'DIKIRIM_WA'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Terkirim WA ({purchaseOrders.filter((p) => p.status === 'DIKIRIM_WA').length})
            </button>
            <button
              onClick={() => setFilterStatus('DITERIMA')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterStatus === 'DITERIMA'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              Sudah Masuk Stok ({purchaseOrders.filter((p) => p.status === 'DITERIMA').length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. PO, Supplier, PIC, Barang..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[38px]"
            />
          </div>
        </div>

        {/* WhatsApp Format Preference Bar (Request 1) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-600 font-medium">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>Format Pesan WhatsApp:</span>
          </div>

          <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 border border-neutral-200">
            <button
              type="button"
              onClick={() => {
                setWaFormatMode('CONCISE');
                soundManager.playPop();
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                waFormatMode === 'CONCISE'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="Hanya menampilkan Nama Barang dan Jumlah yang Dipesan"
            >
              ✓ Hanya Nama Barang & Jumlah (Rekomendasi)
            </button>
            <button
              type="button"
              onClick={() => {
                setWaFormatMode('FULL');
                soundManager.playPop();
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                waFormatMode === 'FULL'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="Format lengkap dengan No. PO, PIC & Info Toko"
            >
              Format Lengkap
            </button>
          </div>
        </div>
      </div>

      {/* PO List Cards */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-white p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-800">Belum Ada Purchase Order (PO)</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Mulai buat pesanan barang otomatis dari stok menipis atau buat PO manual untuk dikirimkan ke Gudang Pusat via WhatsApp.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleOpenAutoPo}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-bold shadow-xs transition active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Buat PO Otomatis Sekarang</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredOrders.map((po) => {
            const isDraft = po.status === 'DRAFT';
            const isSentWa = po.status === 'DIKIRIM_WA';
            const isReceived = po.status === 'DITERIMA';
            const isCopied = copiedPoId === po.id;

            return (
              <div
                key={po.id}
                className={`rounded-2xl border bg-white p-3.5 sm:p-4 transition shadow-2xs hover:shadow-md ${
                  isReceived
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isSentWa
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-neutral-200'
                }`}
              >
                {/* PO Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs sm:text-sm font-black text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md">
                      {po.poNumber}
                    </span>

                    {/* Status Badge */}
                    {isDraft && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-700 border border-neutral-300">
                        <Clock className="h-3 w-3" />
                        <span>Draft PO</span>
                      </span>
                    )}
                    {isSentWa && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                        <Send className="h-3 w-3" />
                        <span>Terkirim WA</span>
                      </span>
                    )}
                    {isReceived && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Masuk ke Stok</span>
                      </span>
                    )}

                    <span className="text-[11px] text-neutral-500">
                      {new Date(po.date).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Supplier & PIC */}
                  <div className="flex items-center gap-3 text-xs text-neutral-600">
                    <span className="flex items-center gap-1 font-medium truncate max-w-[160px] sm:max-w-none">
                      <Truck className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      {po.supplierName}
                    </span>
                    <span className="flex items-center gap-1 font-medium truncate max-w-[120px] sm:max-w-none">
                      <User className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      {po.pic}
                    </span>
                  </div>
                </div>

                {/* Items View - Dual Layout: Clean Cards on HP, Table on Laptop */}
                {/* 1. HP Mobile View: Clean, Stacked Card Rows (no horizontal table scroll) */}
                <div className="my-3 space-y-1.5 sm:hidden">
                  <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                    Daftar Barang yang Dipesan ({po.items.length} item):
                  </div>
                  {po.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 border border-neutral-100 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-neutral-900 truncate">{item.productName}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{item.barcode}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block rounded-lg bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 font-black text-xs">
                          {item.orderQty} {item.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Laptop / Tablet View: Wide Informative Table */}
                <div className="hidden sm:block my-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400">
                        <th className="py-1 px-2">No</th>
                        <th className="py-1 px-2">Nama Barang</th>
                        <th className="py-1 px-2">Barcode</th>
                        <th className="py-1 px-2 text-center">Jumlah Order</th>
                        <th className="py-1 px-2 text-right">Estimasi Berat</th>
                        <th className="py-1 px-2">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {po.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/60">
                          <td className="py-1.5 px-2 text-neutral-400 text-[11px]">{idx + 1}</td>
                          <td className="py-1.5 px-2 font-bold text-neutral-800">
                            {item.productName}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-[11px] text-neutral-500">
                            {item.barcode}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="inline-block rounded-md bg-neutral-100 px-2.5 py-0.5 font-bold text-neutral-900">
                              {item.orderQty} {item.unit}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-neutral-600">
                            {item.weightPerUnitKg
                              ? `${item.orderQty * item.weightPerUnitKg} Kg`
                              : '-'}
                          </td>
                          <td className="py-1.5 px-2 text-neutral-500 text-[11px] truncate max-w-[150px]">
                            {item.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes if any */}
                {po.notes && (
                  <div className="mb-3 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 italic border border-neutral-100">
                    "{po.notes}"
                  </div>
                )}

                {/* Summary & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-neutral-700">
                    <span>
                      Total: <strong className="text-neutral-900">{po.totalItems} Barang</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Kuantitas: <strong className="text-neutral-900">{po.totalQty} Unit</strong>
                    </span>
                    {po.totalEstimatedWeightKg ? (
                      <>
                        <span>•</span>
                        <span className="hidden sm:inline-flex items-center gap-1 text-neutral-800">
                          <Scale className="h-3.5 w-3.5 text-neutral-400" />
                          <strong>~{po.totalEstimatedWeightKg} Kg</strong>
                        </span>
                      </>
                    ) : null}
                  </div>

                  {/* Actions Bar - Thumb-Friendly on Mobile, Compact on Laptop */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {/* Kirim via WhatsApp */}
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(po)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-2xs active:scale-95 transition"
                      title="Kirim detail pesanan langsung ke WhatsApp Gudang/Supplier"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Kirim WA</span>
                    </button>

                    {/* Salin Teks Format WA */}
                    <button
                      type="button"
                      onClick={() => handleCopyWhatsAppText(po)}
                      className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition active:scale-95"
                      title="Salin teks pesanan WA (Hanya Nama Barang & Jumlah)"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-neutral-500" />
                          <span>Salin WA</span>
                        </>
                      )}
                    </button>

                    {/* Terima Barang & Tambahkan ke Stok (Main Feature for RESTOCK) */}
                    {!isReceived ? (
                      <button
                        type="button"
                        onClick={() => handleReceivePo(po)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-3 py-1.5 text-xs font-black shadow-md active:scale-95 transition"
                        title="Barang dari PO ini telah tiba di toko? Klik untuk langsung menambahkan semua barang ke stok inventaris"
                      >
                        <ArrowDownCircle className="h-4 w-4" />
                        <span>Terima ke Stok</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Sudah di Stok
                      </span>
                    )}

                    {/* Pratinjau Teks WA Button */}
                    <button
                      type="button"
                      onClick={() => setPreviewWaPo(po)}
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50 border border-neutral-200 transition"
                      title="Lihat Pratinjau Pesan WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>

                    {/* Download PDF */}
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(po)}
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 border border-neutral-200 transition"
                      title="Download Dokumen PO (PDF)"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* EDIT PO BUTTON (Request 2: "dan juga hapus po atau edit po") */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditPo(po)}
                      className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95"
                      title="Edit data, barang, atau kuantitas Purchase Order ini"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-blue-600" />
                      <span>Edit PO</span>
                    </button>

                    {/* HAPUS PO BUTTON (Request 2: "dan juga hapus po atau edit po") */}
                    <button
                      type="button"
                      onClick={() => setDeleteTargetPo(po)}
                      className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95"
                      title="Hapus Purchase Order ini secara permanen"
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

      {/* PO BUILDER & EDIT MODAL - Optimized for HP & Laptop */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-linear-to-r from-red-600 to-rose-600 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingPoId ? 'Edit Purchase Order (PO)' : 'Buat Purchase Order (PO) Baru'}
                  </h3>
                  <p className="text-[11px] text-red-100 hidden sm:block">
                    Atur kuantitas barang & kirim format ke WhatsApp (hanya nama barang & jumlah yang dipesan)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                  title="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Dual-Pane Layout on Laptop / Stacked on Mobile */}
            <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Meta Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-neutral-50 p-3 sm:p-3.5 rounded-xl border border-neutral-200">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    No. PO
                  </label>
                  <input
                    type="text"
                    value={formPoNumber}
                    onChange={(e) => setFormPoNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-mono font-bold focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                    placeholder="PO-MMY-..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Tujuan / Supplier
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                    placeholder="Gudang Pusat Momoyo"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    No. WA Tujuan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formSupplierPhone}
                    onChange={(e) => setFormSupplierPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-mono focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                    placeholder="0812xxxx atau 628xxx"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    PIC Pemesan
                  </label>
                  <input
                    type="text"
                    value={formPic}
                    onChange={(e) => setFormPic(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                    placeholder="Nama Staff"
                  />
                </div>

                {editingPoId && (
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Status Purchase Order
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as POStatus)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-bold focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="DIKIRIM_WA">Terkirim via WA</option>
                      <option value="DITERIMA">Selesai (Sudah Masuk Stok)</option>
                    </select>
                  </div>
                )}

                <div className={`${editingPoId ? 'sm:col-span-1 md:col-span-3' : 'sm:col-span-2 md:col-span-4'}`}>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Catatan Pesanan
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
                    placeholder="Contoh: Kirim besok pagi jam 09:00 WIB..."
                  />
                </div>
              </div>

              {/* Main Builder Grid: Left (Catalog) & Right (Order Items + Live WA Preview) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* LEFT: Add Item from Catalog */}
                <div className="lg:col-span-5 bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-red-600" />
                      Pilih Barang ke PO:
                    </span>
                    {criticalProducts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          criticalProducts.forEach((p) => {
                            if (!poItems.some((item) => item.productId === p.id)) {
                              handleAddItemFromCatalog(p.id);
                            }
                          });
                          showToast(`Semua ${criticalProducts.length} barang kritis ditambahkan ke PO!`);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md transition"
                      >
                        <Sparkles className="h-3 w-3" />
                        + Tambah Kritis ({criticalProducts.length})
                      </button>
                    )}
                  </div>

                  {/* Search in catalog */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Cari nama barang atau barcode..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Category filter pills */}
                  {categories.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                      <button
                        type="button"
                        onClick={() => setCatalogCategory('ALL')}
                        className={`px-2 py-1 rounded-md font-bold whitespace-nowrap transition ${
                          catalogCategory === 'ALL'
                            ? 'bg-neutral-800 text-white'
                            : 'bg-white border text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        Semua
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCatalogCategory(cat)}
                          className={`px-2 py-1 rounded-md font-bold whitespace-nowrap transition ${
                            catalogCategory === cat
                              ? 'bg-neutral-800 text-white'
                              : 'bg-white border text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Catalog items list */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {filteredCatalogProducts.length === 0 ? (
                      <div className="text-center py-6 text-xs text-neutral-400">
                        Tidak ada barang ditemukan.
                      </div>
                    ) : (
                      filteredCatalogProducts.map((prod) => {
                        const inOrder = poItems.some((item) => item.productId === prod.id);
                        const isCritical = Number(prod.currentStock) <= Number(prod.minStock);

                        return (
                          <div
                            key={prod.id}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs transition ${
                              inOrder
                                ? 'bg-red-50/50 border-red-200'
                                : 'bg-white border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-neutral-900 truncate">
                                  {prod.name}
                                </span>
                                {isCritical && (
                                  <span className="rounded bg-red-100 text-red-700 text-[9px] font-bold px-1 py-0.2 shrink-0">
                                    Kritis
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-500 mt-0.5">
                                Stok: <strong>{prod.currentStock}</strong> {prod.unit} (Min: {prod.minStock})
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddItemFromCatalog(prod.id)}
                              className={`shrink-0 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${
                                inOrder
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                              }`}
                            >
                              {inOrder ? '+ Tambah' : '+ Pilih'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: Items in PO & Live WhatsApp Preview */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                    <span>Barang di dalam PO ({poItems.length} Item):</span>
                    <span className="text-neutral-500 font-normal">
                      Jumlah order harus angka bulat (1, 2, dst)
                    </span>
                  </div>

                  {poItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-xs text-neutral-500 bg-white">
                      Belum ada barang di dalam PO ini. Silakan pilih barang dari daftar katalog di sebelah kiri.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {poItems.map((item, index) => {
                        const isLow = item.currentStock <= item.minStock;

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 transition"
                          >
                            {/* Item Info */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-neutral-900 truncate">
                                  {item.productName}
                                </span>
                                {isLow && (
                                  <span className="rounded bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.2 shrink-0">
                                    Kritis
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-500 mt-0.5">
                                Stok sisa: {item.currentStock} {item.unit}
                              </div>
                            </div>

                            {/* Stepper Quantity (Comfortable Touch Targets for HP) */}
                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                              <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden bg-neutral-50">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(index, item.orderQty - 1)}
                                  className="min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center text-neutral-700 hover:bg-neutral-200 font-black transition text-sm active:scale-90"
                                  title="Kurangi 1"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.orderQty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    handleUpdateItemQty(index, isNaN(val) ? 1 : val);
                                  }}
                                  className="w-12 text-center py-1 text-xs font-black bg-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(index, item.orderQty + 1)}
                                  className="min-h-[36px] min-w-[32px] sm:min-w-[36px] flex items-center justify-center text-neutral-700 hover:bg-neutral-200 font-black transition text-sm active:scale-90"
                                  title="Tambah 1"
                                >
                                  +
                                </button>
                              </div>

                              <span className="text-xs font-bold text-neutral-600 min-w-[35px]">
                                {item.unit}
                              </span>

                              {/* Delete Item */}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 transition"
                                title="Hapus dari pesanan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Live WhatsApp Format Preview in Builder (Request 1) */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                        <span>Pratinjau Pesan yang Dikirim ke WhatsApp:</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-medium">
                        {waFormatMode === 'CONCISE' ? '✓ Hanya Nama & Jumlah' : 'Format Lengkap'}
                      </span>
                    </div>

                    <pre className="text-[11px] font-sans whitespace-pre-wrap bg-white p-3 rounded-lg border border-emerald-200 text-neutral-800 max-h-[140px] overflow-y-auto leading-relaxed shadow-2xs">
                      {builderWaPreviewText}
                    </pre>

                    <div className="flex items-center justify-between text-[11px] text-emerald-800">
                      <span>Total: <strong>{builderTotalItems} Barang ({builderTotalQty} Unit)</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(builderWaPreviewText);
                          showToast('Teks pesan WhatsApp berhasil disalin!');
                        }}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold"
                      >
                        <Copy className="h-3 w-3" />
                        Salin Pratinjau
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer - Sticky on Mobile for Maximum Ergonomics */}
            <div className="px-4 sm:px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl text-neutral-600 hover:bg-neutral-200 text-xs font-bold transition active:scale-95"
                >
                  Tutup
                </button>

                {editingPoId && (
                  <button
                    type="button"
                    onClick={() => {
                      const poToDelete = purchaseOrders.find((p) => p.id === editingPoId);
                      if (poToDelete) {
                        setDeleteTargetPo(poToDelete);
                      }
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Hapus PO Ini</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold transition shadow-2xs active:scale-95"
                >
                  {editingPoId ? 'Simpan Perubahan' : 'Simpan Draft'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndSendWaFromBuilder}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md active:scale-95 transition"
                  title="Simpan dan langsung kirim ke WhatsApp (Hanya nama barang & jumlah pesanan)"
                >
                  <Send className="h-4 w-4" />
                  <span>{editingPoId ? 'Simpan & Kirim WA' : 'Simpan & Kirim ke WA'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP PREVIEW MODAL */}
      {previewWaPo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                <div>
                  <h3 className="text-sm font-black">Pratinjau Pesan WhatsApp</h3>
                  <p className="text-[10px] text-emerald-100">{previewWaPo.poNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewWaPo(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-700">Tampilan Pesan WA:</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  Hanya Nama & Jumlah
                </span>
              </div>

              <div className="bg-[#EFEAE2] p-3 rounded-xl border border-neutral-300">
                <div className="bg-white p-3 rounded-lg shadow-xs text-xs font-sans whitespace-pre-wrap leading-relaxed text-neutral-900 border-l-4 border-emerald-500">
                  {formatWhatsAppText(previewWaPo, waFormatMode)}
                </div>
              </div>

              <p className="text-[11px] text-neutral-500">
                Format di atas hanya menampilkan nama barang dan kuantitas pesanan agar rapi dan ringkas saat dikirimkan ke supplier via WhatsApp.
              </p>
            </div>

            <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  handleCopyWhatsAppText(previewWaPo);
                  setPreviewWaPo(null);
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Teks</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSendWhatsApp(previewWaPo);
                  setPreviewWaPo(null);
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Buka WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (Request 2: "hapus po") */}
      {deleteTargetPo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 p-5 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-neutral-900">
                  Hapus Purchase Order?
                </h3>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  {deleteTargetPo.poNumber}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700 space-y-1.5 border border-neutral-200">
              <div className="flex justify-between">
                <span className="text-neutral-500">Tujuan:</span>
                <span className="font-bold">{deleteTargetPo.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Jumlah Barang:</span>
                <span className="font-bold">
                  {deleteTargetPo.totalItems} Barang ({deleteTargetPo.totalQty} Unit)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Status:</span>
                <span className="font-bold">
                  {deleteTargetPo.status === 'DITERIMA'
                    ? 'Sudah Masuk Stok'
                    : deleteTargetPo.status === 'DIKIRIM_WA'
                    ? 'Terkirim via WA'
                    : 'Draft'}
                </span>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-medium">
              ⚠️ Dokumen PO ini akan dihapus permanen dari sistem dan cloud database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeleteTargetPo(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteTargetPo.id;
                  const num = deleteTargetPo.poNumber;
                  onDeletePO(id);
                  setDeleteTargetPo(null);
                  if (editingPoId === id) {
                    setIsBuilderOpen(false);
                  }
                  showToast(`Purchase Order ${num} berhasil dihapus.`);
                  soundManager.playPop();
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md active:scale-95 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Ya, Hapus PO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
