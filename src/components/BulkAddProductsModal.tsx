import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileSpreadsheet,
  Upload,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Table,
  FileText,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { Product, ProductCategory, ProductUnit } from '../types';

interface BulkAddProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBulk: (products: Product[]) => void;
  existingProducts: Product[];
}

interface RowItem {
  id: string;
  name: string;
  category: ProductCategory;
  barcode: string;
  unit: ProductUnit;
  currentStock: number;
  minStock: number;
  location: string;
  weightPerUnitKg: number;
}

const CATEGORIES: ProductCategory[] = [
  'Bahan Es Krim & Susu',
  'Teh & Sirup Buah',
  'Topping & Isian',
  'Packaging & Cup',
  'Operasional & Sanitasi',
];

const UNITS: ProductUnit[] = [
  'Karton',
  'Box',
  'Pack',
  'Botol',
  'Pcs',
  'Kg',
  'Liter',
  'Roll',
  'Gram',
];

// Smart category guessing based on product name
const guessCategoryFromName = (name: string): ProductCategory => {
  const lower = name.toLowerCase();
  if (
    lower.includes('cup') ||
    lower.includes('gelas') ||
    lower.includes('lid') ||
    lower.includes('sealer') ||
    lower.includes('sedotan') ||
    lower.includes('kantong') ||
    lower.includes('kresek') ||
    lower.includes('paper') ||
    lower.includes('box takeaway') ||
    lower.includes('pack')
  ) {
    return 'Packaging & Cup';
  }
  if (
    lower.includes('teh') ||
    lower.includes('tea') ||
    lower.includes('sirup') ||
    lower.includes('syrup') ||
    lower.includes('lemon') ||
    lower.includes('mango') ||
    lower.includes('mangga') ||
    lower.includes('strawberry') ||
    lower.includes('jus')
  ) {
    return 'Teh & Sirup Buah';
  }
  if (
    lower.includes('boba') ||
    lower.includes('pearl') ||
    lower.includes('jelly') ||
    lower.includes('pudding') ||
    lower.includes('topping') ||
    lower.includes('red bean') ||
    lower.includes('taro') ||
    lower.includes('oreo') ||
    lower.includes('crumb')
  ) {
    return 'Topping & Isian';
  }
  if (
    lower.includes('sabun') ||
    lower.includes('sunlight') ||
    lower.includes('tisu') ||
    lower.includes('tissue') ||
    lower.includes('lap') ||
    lower.includes('pel') ||
    lower.includes('sanitasi') ||
    lower.includes('sarung tangan') ||
    lower.includes('sponge')
  ) {
    return 'Operasional & Sanitasi';
  }
  return 'Bahan Es Krim & Susu';
};

// Smart unit guessing based on product name
const guessUnitFromName = (name: string): ProductUnit => {
  const lower = name.toLowerCase();
  if (lower.includes('karton') || lower.includes('ctn')) return 'Karton';
  if (lower.includes('botol') || lower.includes('btl')) return 'Botol';
  if (lower.includes('roll') || lower.includes('sealer')) return 'Roll';
  if (lower.includes('pack') || lower.includes('pck')) return 'Pack';
  if (lower.includes('box')) return 'Box';
  if (lower.includes('liter') || lower.includes('2l') || lower.includes('1l')) return 'Liter';
  if (lower.includes('kg')) return 'Kg';
  return 'Pcs';
};

const createEmptyRow = (customId?: string): RowItem => ({
  id: customId || `MMY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  name: '',
  category: 'Bahan Es Krim & Susu',
  barcode: '',
  unit: 'Karton',
  currentStock: 0,
  minStock: 5,
  location: 'Gudang Belakang Rak A1',
  weightPerUnitKg: 1,
});

export const BulkAddProductsModal: React.FC<BulkAddProductsModalProps> = ({
  isOpen,
  onClose,
  onSaveBulk,
  existingProducts,
}) => {
  const [activeTab, setActiveTab] = useState<'TABLE' | 'PASTE'>('TABLE');

  // Mode 1: Table Rows
  const [rows, setRows] = useState<RowItem[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  // Mode 2: Paste Raw Text / CSV
  const [rawText, setRawText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Bulk Apply state
  const [applyCategoryToAll, setApplyCategoryToAll] = useState<ProductCategory>('Bahan Es Krim & Susu');
  const [applyLocationToAll, setApplyLocationToAll] = useState<string>('Gudang Belakang');

  if (!isOpen) return null;

  // Existing barcodes set for duplicate detection
  const existingBarcodeSet = new Set(existingProducts.map((p) => p.barcode.trim().toLowerCase()));

  // 1. Add new blank row to table
  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  // 2. Add multiple blank rows
  const handleAddMultipleRows = (count: number) => {
    const newItems: RowItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push(createEmptyRow());
    }
    setRows((prev) => [...prev, ...newItems]);
  };

  // 3. Remove row
  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 4. Update row field
  const handleUpdateRow = (index: number, field: keyof RowItem, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // 5. Generate missing barcodes automatically
  const handleGenerateMissingBarcodes = () => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (!row.barcode.trim()) {
          const timestamp = Date.now().toString().slice(-6);
          const rand = Math.floor(100 + Math.random() * 900);
          return {
            ...row,
            barcode: `899${timestamp}${rand}${idx}`,
          };
        }
        return row;
      })
    );
  };

  // 6. Apply category / location to all rows
  const handleApplyCategoryToAllRows = () => {
    setRows((prev) => prev.map((r) => ({ ...r, category: applyCategoryToAll })));
  };

  const handleApplyLocationToAllRows = () => {
    if (!applyLocationToAll.trim()) return;
    setRows((prev) => prev.map((r) => ({ ...r, location: applyLocationToAll.trim() })));
  };

  // 7. Smart parser: Accepts single column (only Product Name) OR full table CSV/TSV
  const parseContentToRows = (content: string): { parsed: RowItem[]; error?: string } => {
    if (!content.trim()) {
      return { parsed: [], error: 'Teks input atau file CSV masih kosong. Silakan tempel atau upload data.' };
    }

    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsedRows: RowItem[] = [];
    const usedBarcodes = new Set(existingProducts.map((p) => p.barcode.trim().toLowerCase()));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip header row if present
      if (
        i === 0 &&
        (line.toLowerCase().startsWith('nama') ||
          line.toLowerCase().startsWith('product') ||
          line.toLowerCase().startsWith('"nama') ||
          line.toLowerCase().startsWith('"product'))
      ) {
        continue;
      }

      // Delimiter detection: Tab (Excel paste), Semicolon, or Comma
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t');
      } else if (line.includes(';')) {
        cols = line.split(';');
      } else if (line.includes(',')) {
        cols = line.split(',');
      } else {
        cols = [line];
      }

      cols = cols.map((c) => c.trim().replace(/^["']|["']$/g, ''));

      const name = cols[0] || '';
      if (!name) continue;

      // Smart category matching (or guess from name if only name is provided)
      let category: ProductCategory = 'Bahan Es Krim & Susu';
      const rawCat = cols[1] || '';
      if (rawCat) {
        const matchedCat = CATEGORIES.find(
          (c) => c.toLowerCase() === rawCat.toLowerCase() || rawCat.toLowerCase().includes(c.toLowerCase())
        );
        if (matchedCat) {
          category = matchedCat;
        } else {
          category = guessCategoryFromName(name);
        }
      } else {
        category = guessCategoryFromName(name);
      }

      // Barcode: AUTO-GENERATE if empty or not provided in CSV!
      let barcode = cols[2] ? cols[2].trim() : '';
      if (!barcode) {
        const baseTimestamp = Date.now().toString().slice(-6);
        let generated = '';
        for (let attempt = 0; attempt < 50; attempt++) {
          const rand = Math.floor(100 + Math.random() * 900);
          const candidate = `899${baseTimestamp}${String(i % 100).padStart(2, '0')}${rand}`;
          if (!usedBarcodes.has(candidate.toLowerCase())) {
            generated = candidate;
            usedBarcodes.add(candidate.toLowerCase());
            break;
          }
        }
        barcode = generated || `899${Date.now().toString().slice(-7)}${i}`;
      } else {
        usedBarcodes.add(barcode.toLowerCase());
      }

      // Unit matching (or guess from name if only name is provided)
      let unit: ProductUnit = 'Karton';
      const rawUnit = cols[3] || '';
      if (rawUnit) {
        const matchedUnit = UNITS.find((u) => u.toLowerCase() === rawUnit.toLowerCase());
        if (matchedUnit) {
          unit = matchedUnit;
        } else {
          unit = 'Pcs';
        }
      } else {
        unit = guessUnitFromName(name);
      }

      // Stock, min stock, location, and weight: default values that can be edited later!
      const currentStock = cols[4] !== undefined && cols[4] !== '' ? Math.max(0, parseInt(cols[4], 10) || 0) : 0;
      const minStock = cols[5] !== undefined && cols[5] !== '' ? Math.max(1, parseInt(cols[5], 10) || 5) : 5;
      const location = cols[6] && cols[6].trim() ? cols[6].trim() : 'Gudang Momoyo Ciledug';
      const weightPerUnitKg = cols[7] !== undefined && cols[7] !== '' ? Math.max(1, Math.round(Number(cols[7]) || 1)) : 1;

      parsedRows.push({
        id: `MMY-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        name,
        category,
        barcode,
        unit,
        currentStock,
        minStock,
        location,
        weightPerUnitKg,
      });
    }

    if (parsedRows.length === 0) {
      return {
        parsed: [],
        error: 'Tidak ditemukan baris nama produk yang valid. Pastikan ada minimal 1 nama produk.',
      };
    }

    return { parsed: parsedRows };
  };

  // 8. Parse raw text (from Excel / CSV / WhatsApp paste)
  const handleParseRawText = () => {
    setParseError(null);
    setSuccessNotice(null);
    const result = parseContentToRows(rawText);
    if (result.error) {
      setParseError(result.error);
      return;
    }

    setRows(result.parsed);
    setActiveTab('TABLE');
    setSuccessNotice(
      `Berhasil memproses ${result.parsed.length} produk! Barcode telah otomatis dibuat. Stok awal diatur ke 0 dan berat 1 Kg — Anda dapat mengeditnya sekarang di tabel atau nanti di daftar stok.`
    );
  };

  // 9. Load Sample Templates
  const handleLoadSample = (sampleType: 'MOMOYO_NAMES_ONLY' | 'MOMOYO_RAW' | 'MOMOYO_CUP') => {
    if (sampleType === 'MOMOYO_NAMES_ONLY') {
      const sample = [
        'Susu UHT Diamond Momoyo',
        'Bubuk Soft Ice Cream Vanilla Momoyo',
        'Sirup Strawberry Momoyo 2L',
        'Daun Teh Jasmine Green Tea Momoyo',
        'Cup Plastik Momoyo 16oz',
        'Sedotan Steril Momoyo',
        'Boba Tapioca Pearl Hitam Momoyo',
        'Sabun Cuci Tangan Sanitasi',
      ].join('\n');
      setRawText(sample);
    } else if (sampleType === 'MOMOYO_RAW') {
      const sample = [
        'Susu UHT Diamond Full Cream\tBahan Es Krim & Susu\t89910010001\tKarton\t24\t5\tChiller Utama\t12',
        'Bubuk Soft Ice Cream Vanilla\tBahan Es Krim & Susu\t89910010002\tBox\t15\t4\tRak Bahan A1\t10',
        'Sirup Strawberry Momoyo 2L\tTeh & Sirup Buah\t89910010003\tBotol\t18\t6\tRak Sirup B1\t2.2',
        'Daun Teh Jasmine Green Tea\tTeh & Sirup Buah\t89910010004\tPack\t10\t3\tRak Teh B2\t1',
        'Boba Tapioca Pearl Hitam\tTopping & Isian\t89910010005\tKarton\t8\t3\tRak Topping C1\t12',
      ].join('\n');
      setRawText(sample);
    } else {
      const sample = [
        'Cup Plastik Momoyo 16oz\tPackaging & Cup\t89920020001\tKarton\t10\t3\tGudang Packaging Rak 1\t8',
        'Cup Plastik Momoyo 22oz\tPackaging & Cup\t89920020002\tKarton\t10\t3\tGudang Packaging Rak 1\t9',
        'Lid Sealer Roll Logo Momoyo\tPackaging & Cup\t89920020003\tRoll\t6\t2\tGudang Packaging Rak 2\t2.5',
        'Sedotan Steril Momoyo (Boba)\tPackaging & Cup\t89920020004\tPack\t20\t5\tGudang Packaging Rak 2\t1',
        'Plastik Kantong Takeaway 1 Cup\tPackaging & Cup\t89920020005\tPack\t15\t4\tGudang Packaging Rak 3\t0.5',
      ].join('\n');
      setRawText(sample);
    }
  };

  // 10. Download Simple CSV Template (Hanya Nama Produk Saja)
  const handleDownloadSimpleNameOnlyTemplate = () => {
    const csvContent =
      'Nama Produk\n' +
      'Susu UHT Diamond Momoyo\n' +
      'Bubuk Soft Ice Cream Vanilla Momoyo\n' +
      'Sirup Strawberry Momoyo 2L\n' +
      'Daun Teh Jasmine Green Tea Momoyo\n' +
      'Cup Plastik Momoyo 16oz\n' +
      'Sedotan Steril Momoyo\n' +
      'Boba Tapioca Pearl Hitam\n' +
      'Sabun Cuci Tangan Sanitasi Momoyo\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Momoyo_Hanya_Nama_Produk.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 11. Download Full CSV Template (Dengan semua kolom)
  const handleDownloadFullTemplate = () => {
    const csvContent =
      'Nama Produk,Kategori,Barcode,Satuan,Stok Awal,Min Stok,Lokasi Rak,Berat Per Satuan Kg\n' +
      'Susu Bubuk Vanilla Momoyo,Bahan Es Krim & Susu,89930030001,Karton,20,5,Gudang Utama Rak A1,15\n' +
      'Sirup Mangga Premium 2L,Teh & Sirup Buah,89930030002,Botol,12,4,Gudang Utama Rak B1,2.5\n' +
      'Boba Tapioca Momoyo,Topping & Isian,89930030003,Box,8,3,Gudang Utama Rak C1,10\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Lengkap_Produk_Momoyo.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 12. File upload handler: Direct import with auto-generated barcode
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setSuccessNotice(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = parseContentToRows(content);
        if (result.error) {
          setRawText(content);
          setParseError(result.error);
          setActiveTab('PASTE');
        } else {
          setRows(result.parsed);
          setActiveTab('TABLE');
          setSuccessNotice(
            `File CSV berhasil di-upload! ${result.parsed.length} nama produk dimuat dengan barcode otomatis. Anda dapat langsung mengedit stok, satuan, atau berat di tabel ini sekarang atau nanti di daftar stok.`
          );
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Validation
  const validRows = rows.filter((r) => r.name.trim().length > 0);
  const hasEmptyNameRows = rows.some((r) => r.name.trim().length === 0 && (r.barcode || r.currentStock > 0));

  // Save all
  const handleSaveAll = () => {
    if (validRows.length === 0) {
      alert('Harap masukkan minimal 1 nama produk yang valid.');
      return;
    }

    const nowIso = new Date().toISOString();
    const finalProducts: Product[] = validRows.map((r, idx) => {
      let barcode = r.barcode.trim();
      if (!barcode) {
        // Generate automatic CODE128 compatible barcode
        const ts = Date.now().toString().slice(-7);
        const rnd = Math.floor(10 + Math.random() * 90);
        barcode = `899${ts}${rnd}${idx}`;
      }

      return {
        id: r.id || `PROD-${Date.now()}-${idx}`,
        name: r.name.trim(),
        category: r.category,
        barcode,
        unit: r.unit,
        currentStock: Number(r.currentStock) || 0,
        minStock: Number(r.minStock) || 5,
        location: r.location.trim() || 'Gudang Utama',
        weightPerUnitKg: Math.max(1, Math.round(Number(r.weightPerUnitKg) || 1)),
        lastUpdated: nowIso,
      };
    });

    onSaveBulk(finalProducts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-linear-to-r from-red-600 to-red-700 px-4 sm:px-6 py-3.5 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20 shadow-xs">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">
                  Tambah Produk Sekaligus (Banyak Sekaligus)
                </h3>
                <span className="rounded-full bg-white/20 text-white px-2 py-0.5 text-[10px] font-bold">
                  Batch Multi-Input
                </span>
              </div>
              <p className="text-xs text-red-100">
                Momoyo Ciledug &bull; Tambah belasan hingga puluhan barang tanpa input satu-satu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/10 text-white hover:bg-black/20 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher & quick tools toolbar */}
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-neutral-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('TABLE')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                activeTab === 'TABLE'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Table className="h-3.5 w-3.5 text-red-600" />
              Tabel Multi-Baris ({validRows.length} Produk)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PASTE')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                activeTab === 'PASTE'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Tempel Teks / Excel / CSV
            </button>
          </div>

          {/* Quick Helper Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateMissingBarcodes}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs transition"
              title="Buat kode barcode otomatis untuk baris yang belum ada barcode"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Auto-Barcode
            </button>
            <button
              type="button"
              onClick={handleDownloadSimpleNameOnlyTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-bold shadow-2xs transition"
              title="Unduh file format CSV sederhana hanya 1 kolom Nama Produk (Barcode & detail auto-generate)"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Download Template CSV (Hanya Nama Produk) ⭐
            </button>
            <button
              type="button"
              onClick={handleDownloadFullTemplate}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 px-2 py-1.5 text-[11px] font-medium text-neutral-600 shadow-2xs transition"
              title="Unduh template dengan 8 kolom lengkap (opsional)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-neutral-400" />
              Template Lengkap
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer">
              <Upload className="h-3.5 w-3.5 text-red-600" />
              Upload CSV (Auto-Barcode)
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/* Success Notice Banner */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'TABLE' ? (
            /* TAB 1: SPREADSHEET MULTI-ROW FORM */
            <div className="space-y-3">
              {/* Guidance Callout */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="font-bold block text-amber-950">
                    💡 Cukup Masukkan Nama Produk — Barcode Otomatis Jadi!
                  </strong>
                  Untuk input lewat CSV maupun tabel, Anda hanya perlu mengisi nama produknya saja.
                  Barcode otomatis terbuat unik (`899...`), stok awal otomatis 0, dan berat 1 Kg.
                  Anda dapat langsung mengedit stok, satuan, kategori, lokasi, dan berat di tabel ini sekarang ataupun nanti kapan saja di menu Daftar Stok!
                </div>
              </div>

              {/* Batch Apply Header helper */}
              <div className="bg-red-50/60 border border-red-200/70 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-neutral-700">
                  <Layers className="h-4 w-4 text-red-600 shrink-0" />
                  <span>Isi Otomatis Cepat ke Semua Baris:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-neutral-500 font-semibold">Kategori:</span>
                    <select
                      value={applyCategoryToAll}
                      onChange={(e) => setApplyCategoryToAll(e.target.value as ProductCategory)}
                      className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleApplyCategoryToAllRows}
                      className="rounded-lg bg-neutral-800 hover:bg-neutral-900 text-white px-2 py-1 text-xs font-bold transition"
                    >
                      Terapkan
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-neutral-500 font-semibold">Lokasi:</span>
                    <input
                      type="text"
                      placeholder="e.g. Gudang Utama"
                      value={applyLocationToAll}
                      onChange={(e) => setApplyLocationToAll(e.target.value)}
                      className="w-32 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={handleApplyLocationToAllRows}
                      className="rounded-lg bg-neutral-800 hover:bg-neutral-900 text-white px-2 py-1 text-xs font-bold transition"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-100/90 text-neutral-700 font-bold border-b border-neutral-200 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Nama Produk *</th>
                      <th className="py-2.5 px-3 min-w-[170px]">Kategori *</th>
                      <th className="py-2.5 px-3 min-w-[150px]">
                        Barcode / SKU
                        <span className="text-[9px] text-neutral-400 font-normal block">
                          (Kosongkan jika auto)
                        </span>
                      </th>
                      <th className="py-2.5 px-3 min-w-[100px]">Satuan *</th>
                      <th className="py-2.5 px-3 w-20 text-center">Stok Awal</th>
                      <th className="py-2.5 px-3 w-20 text-center">Min Stok</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Lokasi Rak</th>
                      <th className="py-2.5 px-3 w-24 text-center">Berat (Kg)</th>
                      <th className="py-2.5 px-2 w-10 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((row, idx) => {
                      const isDuplicate =
                        row.barcode.trim() &&
                        existingBarcodeSet.has(row.barcode.trim().toLowerCase());

                      return (
                        <tr
                          key={row.id || idx}
                          className={`hover:bg-neutral-50/80 transition-colors ${
                            isDuplicate ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          {/* Row Number */}
                          <td className="py-2 px-3 text-center text-neutral-400 font-bold text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Nama Produk */}
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              required
                              placeholder="Misal: Sirup Mangga 2L"
                              value={row.name}
                              onChange={(e) => handleUpdateRow(idx, 'name', e.target.value)}
                              className={`w-full rounded-lg border px-2.5 py-1.5 text-xs text-neutral-900 outline-hidden font-semibold focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
                                !row.name.trim() && rows.length > 1
                                  ? 'border-neutral-200 bg-neutral-50/30'
                                  : 'border-neutral-300 bg-white'
                              }`}
                            />
                          </td>

                          {/* Kategori */}
                          <td className="py-1.5 px-3">
                            <select
                              value={row.category}
                              onChange={(e) =>
                                handleUpdateRow(idx, 'category', e.target.value as ProductCategory)
                              }
                              className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 font-medium outline-hidden focus:border-red-500"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Barcode */}
                          <td className="py-1.5 px-3">
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Auto jika kosong"
                                value={row.barcode}
                                onChange={(e) => handleUpdateRow(idx, 'barcode', e.target.value)}
                                className={`w-full rounded-lg border px-2 py-1.5 text-xs font-mono outline-hidden focus:border-red-500 ${
                                  isDuplicate
                                    ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                                    : 'border-neutral-300 bg-white text-neutral-800'
                                }`}
                              />
                              {isDuplicate && (
                                <span
                                  className="absolute right-2 top-2 text-[10px] text-amber-700 font-bold"
                                  title="Barcode ini sudah digunakan produk lain"
                                >
                                  Duplikat!
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Satuan */}
                          <td className="py-1.5 px-3">
                            <select
                              value={row.unit}
                              onChange={(e) =>
                                handleUpdateRow(idx, 'unit', e.target.value as ProductUnit)
                              }
                              className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 font-medium outline-hidden focus:border-red-500"
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Stok Awal */}
                          <td className="py-1.5 px-3">
                            <input
                              type="number"
                              min="0"
                              value={row.currentStock}
                              onChange={(e) =>
                                handleUpdateRow(idx, 'currentStock', parseInt(e.target.value) || 0)
                              }
                              className="w-full text-center rounded-lg border border-neutral-300 bg-white px-1.5 py-1.5 text-xs font-bold text-neutral-900 outline-hidden focus:border-red-500"
                            />
                          </td>

                          {/* Min Stok */}
                          <td className="py-1.5 px-3">
                            <input
                              type="number"
                              min="1"
                              value={row.minStock}
                              onChange={(e) =>
                                handleUpdateRow(idx, 'minStock', parseInt(e.target.value) || 1)
                              }
                              className="w-full text-center rounded-lg border border-neutral-300 bg-white px-1.5 py-1.5 text-xs font-bold text-neutral-900 outline-hidden focus:border-red-500"
                            />
                          </td>

                          {/* Lokasi Rak */}
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              placeholder="Rak / Posisi"
                              value={row.location}
                              onChange={(e) => handleUpdateRow(idx, 'location', e.target.value)}
                              className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-800 outline-hidden focus:border-red-500"
                            />
                          </td>

                          {/* Berat Per Satuan Kg (Wajib bilangan bulat 1, 2, dst) */}
                          <td className="py-1.5 px-3">
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={row.weightPerUnitKg}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                handleUpdateRow(
                                  idx,
                                  'weightPerUnitKg',
                                  isNaN(parsed) ? 1 : Math.max(1, Math.round(parsed))
                                );
                              }}
                              className="w-full text-center rounded-lg border border-neutral-300 bg-white px-1 py-1.5 text-xs font-bold text-neutral-800 outline-hidden focus:border-red-500"
                            />
                          </td>

                          {/* Delete Row Button */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Hapus baris ini"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Row Add Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah 1 Baris
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddMultipleRows(5)}
                    className="inline-flex items-center gap-1 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-1.5 text-xs font-semibold transition shadow-2xs"
                  >
                    +5 Baris
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddMultipleRows(10)}
                    className="inline-flex items-center gap-1 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-1.5 text-xs font-semibold transition shadow-2xs"
                  >
                    +10 Baris
                  </button>
                </div>

                <div className="text-xs text-neutral-500 font-medium">
                  Total terisi: <strong className="text-neutral-900">{validRows.length}</strong> produk
                  dari {rows.length} baris
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: PASTE RAW TEXT / EXCEL / CSV */
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Mode Paling Praktis: Cukup Tempel Nama Produk Saja!</span>
                </div>
                <p className="text-neutral-700 leading-relaxed">
                  Anda tidak perlu pusing mengisi kolom barcode, stok, atau berat. Cukup copy daftar <strong>Nama Produk</strong> dari WhatsApp, Catatan, atau Excel (1 baris = 1 nama produk), lalu klik tombol <strong>"Proses & Auto-Barcode"</strong> di bawah.
                </p>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-[11px] font-mono font-bold text-emerald-900">
                  Susu UHT Diamond Momoyo<br />
                  Bubuk Soft Ice Cream Vanilla<br />
                  Sirup Strawberry Momoyo 2L<br />
                  Cup Plastik Momoyo 16oz
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-semibold text-neutral-600">Muat Contoh:</span>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('MOMOYO_NAMES_ONLY')}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11px] font-bold shadow-2xs transition"
                  >
                    ⭐ Contoh 8 Nama Produk Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('MOMOYO_RAW')}
                    className="rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-800 px-2 py-0.5 text-[11px] font-semibold"
                  >
                    Contoh Lengkap Bahan Baku
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('MOMOYO_CUP')}
                    className="rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-800 px-2 py-0.5 text-[11px] font-semibold"
                  >
                    Contoh Lengkap Packaging
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700 flex items-center justify-between">
                  <span>Kotak Tempel Teks (Nama Produk per Baris):</span>
                  <span className="text-[11px] font-normal text-neutral-400">
                    Satu baris = satu produk (Barcode auto jadi, stok & berat bisa diedit)
                  </span>
                </label>
                <textarea
                  rows={9}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Contoh isi (Cukup nama produk saja, 1 baris per produk):\nSusu UHT Diamond Momoyo\nBubuk Soft Ice Cream Vanilla\nSirup Strawberry Momoyo 2L\nCup Plastik Momoyo 16oz\nSedotan Steril Momoyo\nBoba Tapioca Pearl Hitam`}
                  className="w-full rounded-xl border border-neutral-300 p-3 font-mono text-xs text-neutral-800 placeholder-neutral-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden leading-relaxed"
                />
              </div>

              {parseError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseRawText}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-xs font-bold transition shadow-sm"
                >
                  <Table className="h-4 w-4" />
                  Proses & Auto-Barcode ({rawText.split('\n').filter((l) => l.trim()).length} Produk)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Save */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">
              ✓
            </span>
            <span className="text-neutral-700 font-medium">
              Siap disimpan:{' '}
              <strong className="text-neutral-900 font-black text-sm">{validRows.length}</strong>{' '}
              produk baru ke sistem inventory Momoyo Ciledug
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 px-4 py-2.5 text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={validRows.length === 0}
              onClick={handleSaveAll}
              className="flex-1 sm:flex-none rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 text-xs font-black transition shadow-sm active:scale-98 flex items-center justify-center gap-2"
            >
              <Boxes className="h-4 w-4" />
              Simpan Semua ({validRows.length} Produk Sekaligus)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
