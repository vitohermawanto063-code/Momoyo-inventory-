import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Barcode as BarcodeIcon,
  MapPin,
  Copy,
  Check,
  Scale,
  FileDown,
  Loader2,
  ExternalLink,
  Layers,
  CheckCircle2,
  Ticket,
  Tag,
  Search,
  Package,
  Calendar,
  UserCheck,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { Product } from '../types';
import { BarcodeGenerator } from './BarcodeGenerator';
import {
  generateBarcodesPDF,
  printPdfDirectly,
  printLabelsHtmlDirectly,
  openPdfPreview,
  getItemsPerSheetForLayout,
  BarcodePdfLayout,
  BarcodePdfOptions,
  PrintDocumentType,
  ProductPageMode,
} from '../utils/pdfExport';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  products?: Product[];
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  product: initialProduct,
  products = [],
}) => {
  // Active product being printed (defaults to prop, but can be switched inside modal)
  const [activeProduct, setActiveProduct] = useState<Product | null>(initialProduct);
  const [docType, setDocType] = useState<PrintDocumentType>('VOUCHER');
  const [copied, setCopied] = useState(false);
  
  // Sheet mode: MULTI_PER_SHEET (1 lembar isi banyak), SINGLE_JUMBO (1 lembar jumbo), CUSTOM (biji satuan)
  const [sheetMode, setSheetMode] = useState<'MULTI_PER_SHEET' | 'SINGLE_JUMBO' | 'CUSTOM'>('MULTI_PER_SHEET');
  const [sheetsCount, setSheetsCount] = useState<number>(1);
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [layout, setLayout] = useState<BarcodePdfLayout>('voucher-a4');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Search product inside modal
  const [productSearch, setProductSearch] = useState('');
  const [isSelectingProduct, setIsSelectingProduct] = useState(false);

  useEffect(() => {
    if (initialProduct) {
      setActiveProduct(initialProduct);
    } else if (products.length > 0 && !activeProduct) {
      setActiveProduct(products[0]);
    }
  }, [initialProduct, products]);

  // Adjust default layout when docType or sheetMode changes
  useEffect(() => {
    if (sheetMode === 'MULTI_PER_SHEET') {
      if (docType === 'VOUCHER') {
        setLayout('voucher-a4');
      } else {
        setLayout('3x6');
      }
    } else if (sheetMode === 'SINGLE_JUMBO') {
      if (docType === 'VOUCHER') {
        setLayout('voucher-1per-page');
      } else {
        setLayout('1x1');
      }
    }
  }, [docType, sheetMode]);

  const itemsPerSheet = getItemsPerSheetForLayout(layout, docType);
  const totalItems = useMemo(() => {
    if (sheetMode === 'MULTI_PER_SHEET') {
      return sheetsCount * itemsPerSheet;
    }
    if (sheetMode === 'SINGLE_JUMBO') {
      return sheetsCount;
    }
    return printCopies;
  }, [sheetMode, sheetsCount, itemsPerSheet, printCopies]);

  if (!isOpen || !activeProduct) return null;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const filteredProductOptions = products.filter((p) => {
    if (!productSearch) return true;
    const term = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  });

  const getOptions = (): BarcodePdfOptions => ({
    layout,
    docType,
    pageMode:
      sheetMode === 'MULTI_PER_SHEET'
        ? 'PER_PRODUCT_SHEET_MULTI'
        : sheetMode === 'SINGLE_JUMBO'
        ? 'SINGLE_PER_PAGE'
        : 'MIXED_CONTINUOUS',
    sheetsPerProduct:
      sheetMode === 'MULTI_PER_SHEET' || sheetMode === 'SINGLE_JUMBO' ? sheetsCount : 1,
    includeLocation: true,
    includeUnit: true,
    includeStoreHeader: true,
    includeWeight: true,
  });

  // 1. Direct Instant Print via Browser (HTML Print)
  const handleDirectPrint = () => {
    try {
      const items =
        sheetMode === 'CUSTOM'
          ? Array.from({ length: printCopies }, () => activeProduct)
          : [activeProduct];

      printLabelsHtmlDirectly(items, getOptions());
      showStatus(`Membuka dialog cetak untuk ${totalItems} ${docType === 'VOUCHER' ? 'vocer' : 'label'}...`);
    } catch (err) {
      console.error('Error direct printing:', err);
      handlePrintViaPDF();
    }
  };

  // 2. Direct Print via PDF
  const handlePrintViaPDF = async () => {
    try {
      setIsProcessing(true);
      const items =
        sheetMode === 'CUSTOM'
          ? Array.from({ length: printCopies }, () => activeProduct)
          : [activeProduct];

      const doc = await generateBarcodesPDF(items, getOptions());
      printPdfDirectly(doc);
      showStatus(`Membuka dokumen PDF untuk ${totalItems} ${docType === 'VOUCHER' ? 'vocer' : 'label'}...`);
    } catch (err) {
      console.error('Error printing PDF:', err);
      alert('Gagal memproses cetak PDF. Silakan coba download file PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Download PDF File
  const handleDownloadPDF = async () => {
    try {
      setIsProcessing(true);
      const items =
        sheetMode === 'CUSTOM'
          ? Array.from({ length: printCopies }, () => activeProduct)
          : [activeProduct];

      const doc = await generateBarcodesPDF(items, getOptions());
      const cleanName = activeProduct.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${docType === 'VOUCHER' ? 'Vocer' : 'Barcode'}_${cleanName}_${activeProduct.barcode}.pdf`;
      doc.save(filename);
      showStatus(`File ${filename} berhasil diunduh!`);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Gagal mendownload file PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Open PDF in New Tab Preview
  const handlePreviewPDF = async () => {
    try {
      setIsProcessing(true);
      const items =
        sheetMode === 'CUSTOM'
          ? Array.from({ length: printCopies }, () => activeProduct)
          : [activeProduct];

      const doc = await generateBarcodesPDF(items, getOptions());
      openPdfPreview(doc);
    } catch (err) {
      console.error('Error previewing PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(activeProduct.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      id="barcode-print-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="barcode-print-card"
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-linear-to-r from-neutral-900 via-neutral-900 to-neutral-800 px-4 sm:px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
              {docType === 'VOUCHER' ? <Ticket className="h-5 w-5" /> : <BarcodeIcon className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold">
                  {docType === 'VOUCHER' ? 'Cetak Vocer Kontrol Produk' : 'Cetak Label Barcode Rak'}
                </h3>
                <span className="rounded-full bg-red-600/30 text-red-300 border border-red-500/40 px-2 py-0.2 text-[10px] font-bold">
                  {docType === 'VOUCHER' ? 'Vocer' : 'Label'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Siap Cetak Kertas A4 & Thermal Printer HP/PC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Status message */}
          {statusMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Mode Selector: Vocer Produk vs Label Barcode */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-xl">
            <button
              type="button"
              onClick={() => setDocType('VOUCHER')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
                docType === 'VOUCHER'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Ticket className="h-3.5 w-3.5" />
              Vocer Stok Produk
            </button>
            <button
              type="button"
              onClick={() => setDocType('LABEL')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
                docType === 'LABEL'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              Label Barcode Rak
            </button>
          </div>

          {/* Product Switcher Bar */}
          {products.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-600 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-red-500" />
                  Produk Terpilih:
                </span>
                <button
                  type="button"
                  onClick={() => setIsSelectingProduct(!isSelectingProduct)}
                  className="font-bold text-red-600 hover:text-red-700 underline text-[11px]"
                >
                  {isSelectingProduct ? 'Tutup Pilihan' : 'Ganti Produk Lain'}
                </button>
              </div>

              {/* Product quick-selection dropdown / search */}
              {isSelectingProduct ? (
                <div className="mt-2 space-y-2 pt-2 border-t border-neutral-200">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Ketik nama / barcode produk..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:border-red-500 outline-hidden"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white p-1">
                    {filteredProductOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActiveProduct(p);
                          setIsSelectingProduct(false);
                          setProductSearch('');
                        }}
                        className={`w-full text-left p-1.5 rounded-md text-xs flex items-center justify-between transition ${
                          activeProduct.id === p.id
                            ? 'bg-red-50 text-red-700 font-bold'
                            : 'hover:bg-neutral-50 text-neutral-800'
                        }`}
                      >
                        <span className="truncate pr-2">{p.name}</span>
                        <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                          {p.barcode}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-bold text-neutral-900 text-xs mt-1 truncate">
                  {activeProduct.name}
                </p>
              )}
            </div>
          )}

          {/* Realistic Live Preview of either Voucher or Label */}
          {docType === 'VOUCHER' ? (
            /* VOCER KONTROL STOK DESIGN */
            <div
              id="printable-voucher-preview"
              className="rounded-2xl border-2 border-dashed border-red-300 bg-linear-to-b from-white to-red-50/20 p-4 text-left shadow-xs flex flex-col relative"
            >
              {/* Scissors cut banner */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400 border-b border-dashed border-neutral-300 pb-1.5 mb-2 font-mono">
                <span className="flex items-center gap-1 font-bold text-red-600">
                  <Scissors className="h-3 w-3" />
                  VOCER / SLIP KONTROL STOK
                </span>
                <span>ID: {activeProduct.id}</span>
              </div>

              {/* Momoyo Badge & Date */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-red-600 uppercase">
                  MOMOYO CILEDUG
                </span>
                <span className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-neutral-400" />
                  {currentDateStr}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-black text-neutral-900 mt-1 line-clamp-2">
                {activeProduct.name}
              </h4>

              {/* Product Specifications Box */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-200 text-[11px]">
                <div>
                  <span className="text-neutral-500 block text-[10px]">Kategori:</span>
                  <span className="font-bold text-neutral-800">{activeProduct.category}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">Posisi Rak:</span>
                  <span className="font-bold text-neutral-800 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                    {activeProduct.location}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">Sisa Stok Gudang:</span>
                  <span className="font-black text-emerald-700 text-xs">
                    {activeProduct.currentStock} {activeProduct.unit}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">Batas Min. Order:</span>
                  <span className="font-semibold text-neutral-700">
                    {activeProduct.minStock} {activeProduct.unit}
                  </span>
                </div>
              </div>

              {/* Vector Barcode */}
              <div className="w-full flex flex-col items-center justify-center my-3 py-2 bg-white rounded-xl border border-neutral-200/80 shadow-2xs">
                <BarcodeGenerator
                  value={activeProduct.barcode}
                  width={2.2}
                  height={55}
                  fontSize={14}
                  className="max-w-[280px]"
                />
              </div>

              {/* Verification & PIC Line */}
              <div className="pt-2 border-t border-dashed border-neutral-200 text-[10px] text-neutral-600 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-neutral-500" />
                  Petugas PIC: [ .................... ]
                </span>
                <span className="font-semibold text-neutral-500">
                  Status: [ ] OK  [ ] Selisih
                </span>
              </div>
            </div>
          ) : (
            /* LABEL BARCODE RAK DESIGN */
            <div
              id="printable-shelf-label"
              className="rounded-2xl border-2 border-dashed border-neutral-300 bg-linear-to-b from-white to-neutral-50 p-4 text-center shadow-xs flex flex-col items-center"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-black tracking-widest text-red-600 uppercase mb-1">
                <span>MOMOYO CILEDUG &bull; LABEL RAK</span>
              </div>
              <h4 className="text-base sm:text-lg font-black text-neutral-900 line-clamp-2 mb-1">
                {activeProduct.name}
              </h4>

              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-neutral-600 mb-3">
                <span className="inline-flex items-center gap-1 font-medium bg-neutral-100 px-2 py-0.5 rounded">
                  <MapPin className="h-3 w-3 text-red-500" />
                  Rak: {activeProduct.location}
                </span>
                <span className="font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">
                  Satuan: {activeProduct.unit}
                </span>
                {activeProduct.weightPerUnitKg && (
                  <span className="inline-flex items-center gap-1 font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                    <Scale className="h-3 w-3" />
                    {activeProduct.weightPerUnitKg} Kg / {activeProduct.unit}
                  </span>
                )}
              </div>

              <div className="w-full flex flex-col items-center justify-center py-2 bg-white rounded-xl border border-neutral-200/80 shadow-2xs">
                <BarcodeGenerator
                  value={activeProduct.barcode}
                  width={2.2}
                  height={60}
                  fontSize={14}
                  className="max-w-[280px]"
                />
              </div>
            </div>
          )}

          {/* Settings: Mode Cetak Lembar & Rangkap */}
          <div className="space-y-2.5">
            {/* Mode Cetak Selector */}
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-2">
              <label className="block text-[11px] font-bold text-neutral-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-red-600" />
                  Mode Cetak Lembar (1 Produk):
                </span>
                {sheetMode === 'MULTI_PER_SHEET' && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    1 Lembar Jadi Banyak ⭐
                  </span>
                )}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-neutral-200/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSheetMode('MULTI_PER_SHEET');
                    if (docType === 'VOUCHER') setLayout('voucher-a4');
                    else setLayout('3x6');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold text-left transition ${
                    sheetMode === 'MULTI_PER_SHEET'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>⭐ 1 Lembar Isi Banyak</span>
                  </div>
                  <div
                    className={`text-[10px] font-medium leading-tight mt-0.5 ${
                      sheetMode === 'MULTI_PER_SHEET' ? 'text-red-100' : 'text-neutral-500'
                    }`}
                  >
                    {docType === 'VOUCHER' ? '4 Vocer per Lembar A4' : '18/8 Label per Lembar A4'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSheetMode('SINGLE_JUMBO');
                    if (docType === 'VOUCHER') setLayout('voucher-1per-page');
                    else setLayout('1x1');
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold text-left transition ${
                    sheetMode === 'SINGLE_JUMBO'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>1 Lembar 1 Jumbo</span>
                  </div>
                  <div
                    className={`text-[10px] font-medium leading-tight mt-0.5 ${
                      sheetMode === 'SINGLE_JUMBO' ? 'text-neutral-300' : 'text-neutral-500'
                    }`}
                  >
                    1 Halaman Penuh A4
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSheetMode('CUSTOM')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold text-left transition ${
                    sheetMode === 'CUSTOM'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>Kustom Satuan</span>
                  </div>
                  <div
                    className={`text-[10px] font-medium leading-tight mt-0.5 ${
                      sheetMode === 'CUSTOM' ? 'text-neutral-300' : 'text-neutral-500'
                    }`}
                  >
                    Bebas jumlah satuan / Thermal
                  </div>
                </button>
              </div>

              {/* Sub-controls depending on Sheet Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <Layers className="h-3 w-3 text-neutral-500" />
                    Format Kertas:
                  </label>
                  <select
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as BarcodePdfLayout)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-2xs focus:border-red-500 outline-hidden"
                  >
                    {sheetMode === 'MULTI_PER_SHEET' ? (
                      docType === 'VOUCHER' ? (
                        <option value="voucher-a4">Kertas A4 (4 Vocer per Lembar Penuh) ⭐</option>
                      ) : (
                        <>
                          <option value="3x6">Kertas A4 (18 Label / Lembar - Standar Rak) ⭐</option>
                          <option value="2x4">Kertas A4 (8 Label / Lembar - Kardus Besar)</option>
                          <option value="3x4">Kertas A4 (12 Label / Lembar - Sedang)</option>
                        </>
                      )
                    ) : sheetMode === 'SINGLE_JUMBO' ? (
                      docType === 'VOUCHER' ? (
                        <option value="voucher-1per-page">Kertas A4 - 1 Vocer Audit Jumbo / Lembar Penuh ⭐</option>
                      ) : (
                        <option value="1x1">Kertas A4 - 1 Label Jumbo / Lembar Penuh ⭐</option>
                      )
                    ) : docType === 'VOUCHER' ? (
                      <>
                        <option value="voucher-a4">Kertas A4 (4 Vocer / Lembar)</option>
                        <option value="voucher-1per-page">Kertas A4 (1 Vocer Jumbo)</option>
                        <option value="voucher-thermal">Printer Thermal 80mm</option>
                      </>
                    ) : (
                      <>
                        <option value="3x6">Kertas A4 (18 Label / Lembar)</option>
                        <option value="3x4">Kertas A4 (12 Label / Lembar)</option>
                        <option value="2x4">Kertas A4 (8 Label / Lembar)</option>
                        <option value="1x1">Kertas A4 (1 Label Jumbo)</option>
                        <option value="thermal-50x30">Thermal 50x30 mm (Satuan)</option>
                        <option value="thermal-70x40">Thermal 70x40 mm (Sedang)</option>
                        <option value="thermal-80x50">Thermal 80x50 mm (Besar)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <Printer className="h-3 w-3 text-neutral-500" />
                    {sheetMode === 'CUSTOM' ? 'Jumlah Cetak (Satuan):' : 'Jumlah Lembar Kertas:'}
                  </label>
                  {sheetMode === 'CUSTOM' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={printCopies}
                        onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-900 shadow-2xs focus:border-red-500 outline-hidden"
                      />
                      <div className="flex gap-1">
                        {[1, 2, 4, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setPrintCopies(num)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                              printCopies === num
                                ? 'bg-neutral-800 text-white'
                                : 'bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700'
                            }`}
                          >
                            {num}x
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={sheetsCount}
                        onChange={(e) => setSheetsCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-900 shadow-2xs focus:border-red-500 outline-hidden"
                      />
                      <div className="flex gap-1">
                        {[1, 2, 3, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setSheetsCount(num)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                              sheetsCount === num
                                ? 'bg-neutral-800 text-white'
                                : 'bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700'
                            }`}
                          >
                            {num} Lembar
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Informative Summary Banner */}
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    {sheetMode === 'MULTI_PER_SHEET'
                      ? `Mencetak ${sheetsCount} Lembar Kertas Penuh khusus produk ini (Isi ${itemsPerSheet} per lembar)`
                      : sheetMode === 'SINGLE_JUMBO'
                      ? `Mencetak ${sheetsCount} Lembar Kertas Penuh (Jumbo Audit)`
                      : `Mencetak ${printCopies} satuan`}
                  </span>
                </div>
                <span className="font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded text-[11px] self-start sm:self-auto">
                  Total: {totalItems} {docType === 'VOUCHER' ? 'Vocer' : 'Label'}
                </span>
              </div>
            </div>
          </div>

          {/* Copy Barcode Utility */}
          <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200 text-xs">
            <span className="font-mono text-neutral-600 truncate mr-2">
              Kode Barcode: <strong className="text-neutral-900">{activeProduct.barcode}</strong>
            </span>
            <button
              type="button"
              onClick={handleCopyBarcode}
              className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 transition shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            <button
              type="button"
              onClick={handlePreviewPDF}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 py-2.5 px-3 text-xs font-bold transition shadow-2xs disabled:opacity-50"
              title="Buka preview PDF di tab baru"
            >
              <ExternalLink className="h-4 w-4 text-neutral-500" />
              Preview PDF
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 py-2.5 px-4 text-xs font-bold transition shadow-2xs disabled:opacity-50"
              title="Download dokumen PDF"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 text-red-600" />
              )}
              Download PDF
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isProcessing}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 text-xs font-bold transition shadow-md shadow-red-600/25 active:scale-98 disabled:opacity-50"
              title="Cetak langsung menggunakan printer HP atau Komputer"
            >
              <Printer className="h-4 w-4" />
              Cetak Langsung ({totalItems} {docType === 'VOUCHER' ? 'Vocer' : 'Label'})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
