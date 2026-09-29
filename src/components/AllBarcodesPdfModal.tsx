import React, { useState, useMemo } from 'react';
import {
  X,
  FileDown,
  Printer,
  Barcode as BarcodeIcon,
  Search,
  CheckSquare,
  Square,
  MapPin,
  Layers,
  Scale,
  Sparkles,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ArrowUpDown,
  Ticket,
  Tag,
  Scissors,
  Package,
} from 'lucide-react';
import { Product } from '../types';
import { CATEGORIES } from '../data/momoyoInitialData';
import { BarcodeGenerator } from './BarcodeGenerator';
import {
  generateBarcodesPDF,
  printPdfDirectly,
  printLabelsHtmlDirectly,
  openPdfPreview,
  getItemsPerSheetForLayout,
  BarcodePdfLayout,
  BarcodePdfOptions,
  ProductSortOrder,
  PrintDocumentType,
  ProductPageMode,
  sortProducts,
} from '../utils/pdfExport';

interface AllBarcodesPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export const AllBarcodesPdfModal: React.FC<AllBarcodesPdfModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [docType, setDocType] = useState<PrintDocumentType>('VOUCHER');
  const [sortOrder, setSortOrder] = useState<ProductSortOrder>('CATEGORY_NAME_ASC');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    () => new Set(products.map((p) => p.id))
  );

  // Printing mode: PER_PRODUCT_SHEET_MULTI (1 lembar khusus 1 produk isi banyak), SINGLE_PER_PAGE (1 lembar jumbo), MIXED_CONTINUOUS (campur)
  const [pageMode, setPageMode] = useState<ProductPageMode>('PER_PRODUCT_SHEET_MULTI');
  const [sheetsPerProduct, setSheetsPerProduct] = useState<number>(1);

  // Print & PDF formatting options
  const [layout, setLayout] = useState<BarcodePdfLayout>('voucher-a4');
  const [includeLocation, setIncludeLocation] = useState(true);
  const [includeUnit, setIncludeUnit] = useState(true);
  const [includeStoreHeader, setIncludeStoreHeader] = useState(true);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Reset selectedProductIds when modal opens or products change
  React.useEffect(() => {
    if (isOpen) {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
      setPdfSuccessMessage(null);
    }
  }, [isOpen, products]);

  // Adjust default layout when docType or pageMode changes
  React.useEffect(() => {
    if (pageMode === 'PER_PRODUCT_SHEET_MULTI') {
      if (docType === 'VOUCHER') {
        setLayout('voucher-a4');
      } else {
        setLayout('3x6');
      }
    } else if (pageMode === 'SINGLE_PER_PAGE') {
      if (docType === 'VOUCHER') {
        setLayout('voucher-1per-page');
      } else {
        setLayout('1x1');
      }
    }
  }, [docType, pageMode]);

  // Filtered & strictly sorted products list
  const filteredSortedProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory =
        selectedCategory === 'ALL' || product.category === selectedCategory;
      return matchSearch && matchCategory;
    });

    return sortProducts(filtered, sortOrder);
  }, [products, searchTerm, selectedCategory, sortOrder]);

  // Selected products to be printed (strictly keeping the sorted sequence)
  const productsToPrint = useMemo(() => {
    return filteredSortedProducts.filter((p) => selectedProductIds.has(p.id));
  }, [filteredSortedProducts, selectedProductIds]);

  const itemsPerSheet = getItemsPerSheetForLayout(layout, docType);

  // Estimated sheets calculation
  const estimatedPages = useMemo(() => {
    const count = productsToPrint.length;
    if (count === 0) return 0;
    if (pageMode === 'PER_PRODUCT_SHEET_MULTI' || pageMode === 'SINGLE_PER_PAGE') {
      return count * sheetsPerProduct;
    }
    // MIXED_CONTINUOUS
    if (layout === '1x1' || layout === 'voucher-1per-page') return count;
    if (layout.startsWith('thermal') || layout === 'voucher-thermal') return count;
    return Math.ceil(count / itemsPerSheet);
  }, [productsToPrint.length, pageMode, sheetsPerProduct, layout, itemsPerSheet]);

  const totalCards = useMemo(() => {
    if (pageMode === 'PER_PRODUCT_SHEET_MULTI') {
      return productsToPrint.length * sheetsPerProduct * itemsPerSheet;
    }
    if (pageMode === 'SINGLE_PER_PAGE') {
      return productsToPrint.length * sheetsPerProduct;
    }
    return productsToPrint.length;
  }, [productsToPrint.length, pageMode, sheetsPerProduct, itemsPerSheet]);

  if (!isOpen) return null;

  const handleToggleSelectAll = () => {
    if (selectedProductIds.size === filteredSortedProducts.length && filteredSortedProducts.length > 0) {
      const next = new Set(selectedProductIds);
      filteredSortedProducts.forEach((p) => next.delete(p.id));
      setSelectedProductIds(next);
    } else {
      const next = new Set(selectedProductIds);
      filteredSortedProducts.forEach((p) => next.add(p.id));
      setSelectedProductIds(next);
    }
  };

  const handleToggleProduct = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProductIds(next);
  };

  const getOptions = (): BarcodePdfOptions => ({
    layout,
    docType,
    sortOrder,
    pageMode,
    sheetsPerProduct,
    includeLocation,
    includeUnit,
    includeStoreHeader,
    includeWeight: true,
  });

  // 1. Direct Instant Print via Browser (HTML Print)
  const handleDirectPrintHtml = () => {
    if (productsToPrint.length === 0) return;

    try {
      printLabelsHtmlDirectly(productsToPrint, getOptions());
      setPdfSuccessMessage(
        `Membuka dialog cetak untuk ${estimatedPages} lembar (${totalCards} ${
          docType === 'VOUCHER' ? 'vocer' : 'label'
        })...`
      );
      setTimeout(() => setPdfSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Failed to direct print:', err);
      handlePrintViaPDF();
    }
  };

  // 2. Direct Print via PDF
  const handlePrintViaPDF = async () => {
    if (productsToPrint.length === 0) return;

    try {
      setIsGeneratingPdf(true);
      setPdfSuccessMessage(null);

      const doc = await generateBarcodesPDF(productsToPrint, getOptions());
      printPdfDirectly(doc);

      setPdfSuccessMessage(
        `Membuka dialog cetak PDF untuk ${estimatedPages} lembar (${totalCards} ${
          docType === 'VOUCHER' ? 'vocer' : 'barcode'
        })...`
      );
      setTimeout(() => setPdfSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to print PDF:', err);
      alert('Gagal memproses cetak PDF. Silakan coba download file PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 3. Download PDF file
  const handleDownloadPDF = async () => {
    if (productsToPrint.length === 0) return;

    try {
      setIsGeneratingPdf(true);
      setPdfSuccessMessage(null);

      const doc = await generateBarcodesPDF(productsToPrint, getOptions());
      const dateStr = new Date().toISOString().split('T')[0];
      const modeTag = pageMode === 'PER_PRODUCT_SHEET_MULTI' ? '_PerProduk_IsiBanyak' : '';
      const filename = `${
        docType === 'VOUCHER' ? 'Vocer_Semua_Barang' : 'Barcode_Semua_Barang'
      }${modeTag}_Momoyo_Ciledug_${dateStr}.pdf`;

      doc.save(filename);
      setPdfSuccessMessage(
        `File PDF berhasil diunduh (${estimatedPages} lembar / ${totalCards} ${
          docType === 'VOUCHER' ? 'vocer' : 'barcode'
        })!`
      );
      setTimeout(() => setPdfSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Gagal membuat file PDF. Silakan coba kembali.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 4. Preview PDF in New Tab
  const handlePreviewPDF = async () => {
    if (productsToPrint.length === 0) return;

    try {
      setIsGeneratingPdf(true);
      const doc = await generateBarcodesPDF(productsToPrint, getOptions());
      openPdfPreview(doc);
    } catch (err) {
      console.error('Failed to preview PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'CATEGORY_NAME_ASC':
        return 'Kategori lalu Nama Produk (A → Z)';
      case 'NAME_ASC':
        return 'Nama Produk (A → Z)';
      case 'NAME_DESC':
        return 'Nama Produk (Z → A)';
      case 'LOCATION_ASC':
        return 'Lokasi Rak (Gudang & Chiller)';
      case 'BARCODE_ASC':
        return 'Kode Barcode / SKU';
      case 'STOCK_ASC':
        return 'Sisa Stok (Kritis Terlebih Dahulu)';
      default:
        return 'Urut Produk';
    }
  };

  return (
    <div
      id="all-barcodes-pdf-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="all-barcodes-pdf-card"
        className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-neutral-200 flex flex-col my-auto max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-linear-to-r from-neutral-900 via-neutral-900 to-neutral-800 px-4 sm:px-6 py-3.5 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/90 text-white shadow-xs">
              {docType === 'VOUCHER' ? <Ticket className="h-5 w-5" /> : <BarcodeIcon className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">
                  {docType === 'VOUCHER'
                    ? 'Cetak Vocer Semua Barang (Urut Sesuai Produk)'
                    : 'Cetak Barcode Semua Barang (Urut Sesuai Produk)'}
                </h3>
                <span className="rounded-full bg-red-600/30 text-red-300 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold">
                  {docType === 'VOUCHER' ? 'Vocer All' : 'Label All'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Pencetakan Massal Terurut Rapi &bull; Momoyo Ciledug
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

        {/* Toolbar Controls */}
        <div className="border-b border-neutral-200 bg-neutral-50/90 p-3 sm:p-4 shrink-0 space-y-3">
          {/* Top Bar: Mode (Vocer vs Label) & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 p-1 bg-neutral-200/70 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setDocType('VOUCHER')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                  docType === 'VOUCHER'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-neutral-700 hover:text-neutral-900'
                }`}
              >
                <Ticket className="h-3.5 w-3.5" />
                Vocer Kontrol Stok
              </button>
              <button
                type="button"
                onClick={() => setDocType('LABEL')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                  docType === 'LABEL'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-700 hover:text-neutral-900'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                Label Barcode Rak
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={handlePreviewPDF}
                disabled={productsToPrint.length === 0 || isGeneratingPdf}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs active:scale-98 disabled:opacity-50"
                title="Buka preview dokumen PDF di tab baru browser"
              >
                <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
                Preview PDF
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={productsToPrint.length === 0 || isGeneratingPdf}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3.5 py-1.5 text-xs font-bold transition shadow-2xs active:scale-98 disabled:opacity-50"
                title="Download file PDF semua barang terurut"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 text-red-600" />
                )}
                Download PDF
              </button>

              <button
                type="button"
                onClick={handleDirectPrintHtml}
                disabled={productsToPrint.length === 0 || isGeneratingPdf}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 text-xs font-bold transition shadow-sm active:scale-98 disabled:opacity-50"
                title="Buka dialog cetak browser langsung (HP & Komputer)"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Langsung ({estimatedPages} Lembar &bull; {totalCards} {docType === 'VOUCHER' ? 'Vocer' : 'Label'})
              </button>
            </div>
          </div>

          {/* Mode Cetak Selector: Per Lembar 1 Produk Isi Banyak vs Jumbo vs Campur */}
          <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-[11px] font-bold text-neutral-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-red-600" />
                Mode Cetak Lembaran:
              </label>
              {pageMode === 'PER_PRODUCT_SHEET_MULTI' && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full self-start sm:self-auto">
                  1 Produk 1 Lembar Isi Banyak ⭐
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-neutral-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setPageMode('PER_PRODUCT_SHEET_MULTI');
                  if (docType === 'VOUCHER') setLayout('voucher-a4');
                  else setLayout('3x6');
                }}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-left transition ${
                  pageMode === 'PER_PRODUCT_SHEET_MULTI'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>⭐ 1 Lembar 1 Produk Isi Banyak</span>
                </div>
                <div
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                    pageMode === 'PER_PRODUCT_SHEET_MULTI' ? 'text-red-100' : 'text-neutral-500'
                  }`}
                >
                  {docType === 'VOUCHER'
                    ? 'Tiap lembar khusus 1 produk (4 vocer)'
                    : 'Tiap lembar khusus 1 produk (18/8 label)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPageMode('SINGLE_PER_PAGE');
                  if (docType === 'VOUCHER') setLayout('voucher-1per-page');
                  else setLayout('1x1');
                }}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-left transition ${
                  pageMode === 'SINGLE_PER_PAGE'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>1 Produk 1 Lembar Jumbo</span>
                </div>
                <div
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                    pageMode === 'SINGLE_PER_PAGE' ? 'text-neutral-300' : 'text-neutral-500'
                  }`}
                >
                  1 Halaman Penuh A4 Audit Lengkap
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPageMode('MIXED_CONTINUOUS')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-left transition ${
                  pageMode === 'MIXED_CONTINUOUS'
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>Campur Bersambung</span>
                </div>
                <div
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                    pageMode === 'MIXED_CONTINUOUS' ? 'text-neutral-300' : 'text-neutral-500'
                  }`}
                >
                  Hemat kertas, produk campur berjejer
                </div>
              </button>
            </div>
          </div>

          {/* Secondary Controls Bar: Sort, Paper Format & Sheet Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {/* Sort Order Selector (MANDATORY REQUIREMENT) */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-neutral-200 shadow-2xs">
              <ArrowUpDown className="h-4 w-4 text-red-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Urutan Produk:
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as ProductSortOrder)}
                  className="w-full bg-transparent text-xs font-bold text-neutral-900 outline-hidden cursor-pointer"
                >
                  <option value="CATEGORY_NAME_ASC">1. Kategori lalu Nama (A → Z) [Rekomendasi]</option>
                  <option value="NAME_ASC">2. Nama Produk (A → Z)</option>
                  <option value="NAME_DESC">3. Nama Produk (Z → A)</option>
                  <option value="LOCATION_ASC">4. Lokasi Rak (Gudang & Chiller)</option>
                  <option value="BARCODE_ASC">5. Kode Barcode / SKU</option>
                  <option value="STOCK_ASC">6. Sisa Stok (Kritis Terlebih Dahulu)</option>
                </select>
              </div>
            </div>

            {/* Layout format */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-neutral-200 shadow-2xs">
              <Layers className="h-4 w-4 text-neutral-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Format Kertas:
                </label>
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as BarcodePdfLayout)}
                  className="w-full bg-transparent text-xs font-bold text-neutral-900 outline-hidden cursor-pointer"
                >
                  {pageMode === 'PER_PRODUCT_SHEET_MULTI' ? (
                    docType === 'VOUCHER' ? (
                      <option value="voucher-a4">Kertas A4 (4 Vocer / Lembar Penuh) ⭐</option>
                    ) : (
                      <>
                        <option value="3x6">Kertas A4 (18 Label / Lembar - Standar Rak) ⭐</option>
                        <option value="2x4">Kertas A4 (8 Label / Lembar - Dus Besar)</option>
                        <option value="3x4">Kertas A4 (12 Label / Lembar - Sedang)</option>
                      </>
                    )
                  ) : pageMode === 'SINGLE_PER_PAGE' ? (
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
            </div>

            {/* Sheets per product counter (if mode is per product) */}
            {pageMode !== 'MIXED_CONTINUOUS' && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-neutral-200 shadow-2xs">
                <Printer className="h-4 w-4 text-neutral-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    Lembar Tiap Produk:
                  </label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={sheetsPerProduct}
                      onChange={(e) => setSheetsPerProduct(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs font-bold text-neutral-900 outline-hidden focus:border-red-500"
                    />
                    <div className="flex gap-1">
                      {[1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSheetsPerProduct(num)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                            sheetsPerProduct === num
                              ? 'bg-neutral-800 text-white'
                              : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                          }`}
                        >
                          {num} lbr
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Estimates info badge */}
            <div className={`flex items-center justify-between bg-red-50/70 border border-red-200/80 px-3 py-2 rounded-xl text-xs font-medium text-red-900 ${pageMode === 'MIXED_CONTINUOUS' ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <span>Terpilih: <strong>{productsToPrint.length}</strong> barang</span>
              </div>
              <span className="font-bold text-red-700 bg-red-100/90 px-2 py-0.5 rounded text-[11px]">
                {estimatedPages} {layout.startsWith('thermal') || layout === 'voucher-thermal' ? 'stiker/struk' : 'lembar A4'}
              </span>
            </div>
          </div>

          {/* Active Mode Assurance Banner */}
          <div className="bg-emerald-50 border border-emerald-200/80 px-3.5 py-2 rounded-xl text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                {pageMode === 'PER_PRODUCT_SHEET_MULTI' ? (
                  <>
                    Mode <strong>1 Lembar 1 Produk Isi Banyak</strong> Aktif &bull; Setiap lembar HANYA berisi 1 produk (isi {itemsPerSheet} per lembar tanpa tercampur)
                  </>
                ) : pageMode === 'SINGLE_PER_PAGE' ? (
                  <>
                    Mode <strong>1 Lembar 1 Jumbo</strong> Aktif &bull; 1 Produk per Halaman Penuh A4 Audit Lengkap
                  </>
                ) : (
                  <>
                    Mode <strong>Campur Bersambung</strong> &bull; Produk disusun urut berjejer hemat kertas
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-mono text-emerald-800">
              <span className="font-bold bg-emerald-100/90 px-2 py-0.5 rounded">
                Total: {totalCards} {docType === 'VOUCHER' ? 'Vocer' : 'Label'} ({estimatedPages} Lembar)
              </span>
            </div>
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Cari nama, barcode, atau rak..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 shadow-2xs focus:border-red-500 outline-hidden"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs focus:border-red-500 outline-hidden"
              >
                <option value="ALL">Semua Kategori ({products.length})</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-300 hover:bg-neutral-50 px-3 py-1.5 rounded-xl shadow-2xs transition self-start sm:self-auto"
            >
              {selectedProductIds.size === filteredSortedProducts.length && filteredSortedProducts.length > 0 ? (
                <>
                  <CheckSquare className="h-4 w-4 text-red-600" />
                  <span>Batal Pilih Semua</span>
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 text-neutral-400" />
                  <span>Pilih Semua ({filteredSortedProducts.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success / Status Banner */}
        {pdfSuccessMessage && (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{pdfSuccessMessage}</span>
          </div>
        )}

        {/* Product Cards List in Strict Sorted Order */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-neutral-100/60">
          {filteredSortedProducts.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 bg-white rounded-2xl border border-neutral-200">
              <Package className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">Tidak ada barang yang cocok dengan pencarian.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSortedProducts.map((product, index) => {
                const isChecked = selectedProductIds.has(product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => handleToggleProduct(product.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition shadow-2xs flex flex-col justify-between ${
                      isChecked
                        ? 'border-red-500/70 bg-white ring-2 ring-red-500/10'
                        : 'border-neutral-200 bg-white/70 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div>
                      {/* Top Order Badge & Checkbox */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-900 text-[10px] font-black text-white font-mono">
                            #{index + 1}
                          </div>
                          <span className="text-[10px] font-bold text-neutral-500 truncate max-w-[140px]">
                            {product.category}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-red-600" />
                          ) : (
                            <Square className="h-4 w-4 text-neutral-300" />
                          )}
                        </div>
                      </div>

                      {/* Product Name */}
                      <h4 className="text-xs font-black text-neutral-900 line-clamp-2 mt-1.5 leading-snug">
                        {product.name}
                      </h4>

                      {/* Location & Unit Badges */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-500 mt-1.5">
                        <span className="inline-flex items-center gap-0.5 bg-neutral-100 px-1.5 py-0.5 rounded font-medium">
                          <MapPin className="h-2.5 w-2.5 text-red-500" />
                          {product.location}
                        </span>
                        <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-semibold border border-red-100">
                          {product.unit}
                        </span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Stok: {product.currentStock}
                        </span>
                      </div>
                    </div>

                    {/* Barcode visual preview */}
                    <div className="mt-2 pt-2 border-t border-neutral-100 flex flex-col items-center justify-center bg-neutral-50 rounded-lg p-1.5">
                      <BarcodeGenerator
                        value={product.barcode}
                        width={1.6}
                        height={38}
                        fontSize={11}
                        className="max-w-[210px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-neutral-200 bg-white px-4 py-3 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-xs text-neutral-600 text-center sm:text-left">
            <span>Terpilih </span>
            <strong className="text-neutral-900">{productsToPrint.length}</strong>
            <span> dari {products.length} produk &bull; Urutan: </span>
            <strong className="text-red-700">{getSortLabel()}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none rounded-xl border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleDirectPrintHtml}
              disabled={productsToPrint.length === 0 || isGeneratingPdf}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-bold transition shadow-sm disabled:opacity-50 active:scale-98"
            >
              <Printer className="h-4 w-4" />
              Cetak Sekarang ({productsToPrint.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
