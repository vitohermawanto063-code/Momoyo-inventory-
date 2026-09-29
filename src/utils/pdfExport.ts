import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Product } from '../types';

export type BarcodePdfLayout =
  | '1x1' // 1 Label / 1 Lembar Penuh A4 (1 Produk 1 Lembar Jumbo)
  | '3x6' // 18 label / lembar A4 (Standar Rak)
  | '3x4' // 12 label / lembar A4 (Sedang)
  | '2x4' // 8 label / lembar A4 (Dus Besar)
  | 'thermal-50x30' // Thermal Roll 50x30 mm (1 label / halaman)
  | 'thermal-70x40' // Thermal Roll 70x40 mm (1 label / halaman)
  | 'thermal-80x50' // Thermal Roll 80x50 mm (1 label / halaman)
  | 'voucher-1per-page' // 1 Vocer / 1 Lembar Penuh A4 (1 Produk 1 Lembar Audit Lengkap)
  | 'voucher-a4' // 4 Vocer Kupon Kontrol Stok / Lembar A4 (dengan Garis Potong)
  | 'voucher-thermal'; // Vocer Struk Thermal Kasir 80mm

export type PrintDocumentType = 'LABEL' | 'VOUCHER';

export type ProductSortOrder =
  | 'CATEGORY_NAME_ASC'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'LOCATION_ASC'
  | 'BARCODE_ASC'
  | 'STOCK_ASC';

export type ProductPageMode =
  | 'PER_PRODUCT_SHEET_MULTI' // ⭐ 1 Lembar khusus 1 produk tapi isi banyak (4 vocer / 8-18 label per lembar)
  | 'SINGLE_PER_PAGE' // 1 Produk 1 Lembar Jumbo (Vocer / Label A4 Penuh)
  | 'MIXED_CONTINUOUS'; // Campur bersambung dalam 1 lembar (katalog rak)

export interface BarcodePdfOptions {
  layout?: BarcodePdfLayout;
  docType?: PrintDocumentType;
  sortOrder?: ProductSortOrder;
  pageMode?: ProductPageMode;
  sheetsPerProduct?: number; // Jumlah lembar per produk (default 1)
  includeLocation?: boolean;
  includeUnit?: boolean;
  includeStoreHeader?: boolean;
  includeWeight?: boolean;
  includeStockInfo?: boolean;
  includePicBox?: boolean;
}

/**
 * Returns how many labels or vouchers fit on 1 sheet of paper for the given layout.
 */
export function getItemsPerSheetForLayout(
  layout: BarcodePdfLayout = '3x6',
  docType: PrintDocumentType = 'LABEL'
): number {
  if (layout === 'voucher-1per-page' || layout === '1x1') return 1;
  if (docType === 'VOUCHER' || layout.startsWith('voucher-')) {
    if (layout === 'voucher-thermal') return 1;
    return 4; // voucher-a4 has 4 vouchers per sheet
  }
  if (layout === '3x6') return 18;
  if (layout === '3x4') return 12;
  if (layout === '2x4') return 8;
  return 1; // thermal printers
}

/**
 * Prepares and expands products based on chosen pageMode and layout.
 * Ensures that in PER_PRODUCT_SHEET_MULTI, each product fills its own entire sheet(s)
 * without ever mixing with other products on the same page!
 */
export function prepareProductsForPrint(
  inputProducts: Product[],
  options: BarcodePdfOptions = {}
): { preparedProducts: Product[]; productPagesCount: number } {
  const {
    layout = 'voucher-1per-page',
    docType = 'VOUCHER',
    sortOrder = 'CATEGORY_NAME_ASC',
    pageMode = 'PER_PRODUCT_SHEET_MULTI',
    sheetsPerProduct = 1,
  } = options;

  const sorted = sortProducts(inputProducts, sortOrder);
  const safeSheets = Math.max(1, sheetsPerProduct);

  if (pageMode === 'PER_PRODUCT_SHEET_MULTI') {
    const itemsPerSheet = getItemsPerSheetForLayout(layout, docType);
    const copiesPerProduct = itemsPerSheet * safeSheets;

    const expanded: Product[] = [];
    for (const p of sorted) {
      for (let c = 0; c < copiesPerProduct; c++) {
        expanded.push(p);
      }
    }
    return {
      preparedProducts: expanded,
      productPagesCount: sorted.length * safeSheets,
    };
  }

  if (pageMode === 'SINGLE_PER_PAGE') {
    const expanded: Product[] = [];
    for (const p of sorted) {
      for (let c = 0; c < safeSheets; c++) {
        expanded.push(p);
      }
    }
    return {
      preparedProducts: expanded,
      productPagesCount: sorted.length * safeSheets,
    };
  }

  // MIXED_CONTINUOUS
  const itemsPerSheet = getItemsPerSheetForLayout(layout, docType);
  return {
    preparedProducts: sorted,
    productPagesCount: Math.ceil(sorted.length / itemsPerSheet),
  };
}

/**
 * Sorts products strictly according to user-selected ordering criteria.
 */
export function sortProducts(
  products: Product[],
  sortOrder: ProductSortOrder = 'CATEGORY_NAME_ASC'
): Product[] {
  const sorted = [...products];
  switch (sortOrder) {
    case 'CATEGORY_NAME_ASC':
      return sorted.sort((a, b) => {
        const catCompare = (a.category || '').localeCompare(b.category || '');
        if (catCompare !== 0) return catCompare;
        return (a.name || '').localeCompare(b.name || '');
      });
    case 'NAME_ASC':
      return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'NAME_DESC':
      return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    case 'LOCATION_ASC':
      return sorted.sort((a, b) => {
        const locCompare = (a.location || '').localeCompare(b.location || '');
        if (locCompare !== 0) return locCompare;
        return (a.name || '').localeCompare(b.name || '');
      });
    case 'BARCODE_ASC':
      return sorted.sort((a, b) => (a.barcode || '').localeCompare(b.barcode || ''));
    case 'STOCK_ASC':
      return sorted.sort(
        (a, b) => a.currentStock - b.currentStock || (a.name || '').localeCompare(b.name || '')
      );
    default:
      return sorted;
  }
}

/**
 * Generates an off-screen high-DPI canvas data URL for barcode image.
 * Uses CODE128 for optimal scan compatibility with both laser and phone camera scanners.
 */
export function createBarcodeDataUrl(
  barcodeText: string,
  scaleWidth: number = 2.5,
  scaleHeight: number = 60
): string | null {
  const cleanBarcode = barcodeText.trim();
  if (!cleanBarcode) return null;

  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, cleanBarcode, {
      format: 'CODE128',
      width: scaleWidth,
      height: scaleHeight,
      displayValue: true,
      fontSize: 14,
      font: 'monospace',
      textMargin: 3,
      margin: 4,
      lineColor: '#000000',
      background: '#ffffff',
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn(`Failed primary barcode generate for "${barcodeText}":`, err);
    try {
      const fallbackCanvas = document.createElement('canvas');
      JsBarcode(fallbackCanvas, cleanBarcode, {
        format: 'CODE128',
        width: 2,
        height: 45,
        displayValue: true,
        fontSize: 12,
        margin: 2,
      });
      return fallbackCanvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }
}

/**
 * Generates a multi-item or multi-page PDF for printing barcodes or vouchers.
 * Supports standard A4 grids, Voucher slips (A4 4-up), and Thermal Label Printers.
 */
export async function generateBarcodesPDF(
  inputProducts: Product[],
  options: BarcodePdfOptions = {}
): Promise<jsPDF> {
  const {
    layout = '3x6',
    docType = 'LABEL',
    sortOrder = 'CATEGORY_NAME_ASC',
    pageMode,
    sheetsPerProduct = 1,
    includeLocation = true,
    includeUnit = true,
    includeStoreHeader = true,
    includeWeight = true,
  } = options;

  // Prepare products according to pageMode if passed
  let products: Product[];
  if (pageMode) {
    const prep = prepareProductsForPrint(inputProducts, options);
    products = prep.preparedProducts;
  } else {
    products = sortProducts(inputProducts, sortOrder);
  }

  // A0. 1 LABEL RAK JUMBO PER 1 LEMBAR A4 PENUH (1 PRODUK 1 LEMBAR)
  if (docType === 'LABEL' && layout === '1x1') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    for (let i = 0; i < products.length; i++) {
      if (i > 0) doc.addPage();
      const product = products[i];

      // Decorative outer border
      doc.setDrawColor(200, 20, 20);
      doc.setLineWidth(1.2);
      doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4, 'S');

      // Top Red Brand Banner
      doc.setFillColor(200, 20, 20);
      doc.roundedRect(margin, margin, contentWidth, 24, 4, 4, 'F');
      doc.rect(margin, margin + 16, contentWidth, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('MOMOYO CILEDUG - CIREBON', pageWidth / 2, margin + 10, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(255, 235, 235);
      doc.text('LABEL IDENTITAS BARANG & RAK GUDANG (1 PRODUK 1 LEMBAR)', pageWidth / 2, margin + 18, { align: 'center' });

      let curY = margin + 34;

      // Product Title Box (Huge & Bold)
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 6, curY, contentWidth - 12, 34, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      const splitTitle = doc.splitTextToSize(product.name, contentWidth - 24);
      doc.text(splitTitle[0], pageWidth / 2, curY + 13, { align: 'center' });
      if (splitTitle[1]) {
        doc.text(splitTitle[1], pageWidth / 2, curY + 23, { align: 'center' });
      }

      curY += 40;

      // Big Category & Location Badges
      const badgeW = (contentWidth - 16) / 2;
      // Category Box
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(margin + 6, curY, badgeW, 20, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 20, 20);
      doc.text('KATEGORI PRODUK', margin + 6 + badgeW / 2, curY + 6.5, { align: 'center' });
      doc.setFontSize(11);
      doc.setTextColor(153, 27, 27);
      doc.text(product.category, margin + 6 + badgeW / 2, curY + 14.5, { align: 'center' });

      // Location Box
      doc.setFillColor(243, 244, 246);
      doc.setDrawColor(209, 213, 219);
      doc.roundedRect(margin + 10 + badgeW, curY, badgeW, 20, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text('POSISI PENYIMPANAN / RAK', margin + 10 + badgeW + badgeW / 2, curY + 6.5, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(product.location || 'Gudang Momoyo', margin + 10 + badgeW + badgeW / 2, curY + 14.5, { align: 'center' });

      curY += 26;

      // Barcode Container (Huge Barcode)
      const barcodeDataUrl = createBarcodeDataUrl(product.barcode, 4, 110);
      if (barcodeDataUrl) {
        const bcWidth = 160;
        const bcHeight = 60;
        const bcX = (pageWidth - bcWidth) / 2;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.roundedRect(bcX - 4, curY, bcWidth + 8, bcHeight + 12, 4, 4, 'FD');

        doc.addImage(barcodeDataUrl, 'PNG', bcX, curY + 4, bcWidth, bcHeight);

        curY += bcHeight + 18;
      }

      // Specs Summary Row: Satuan, Berat, Stok Saat Ini, Min Order
      const specBoxW = (contentWidth - 18) / 4;
      const specs = [
        { label: 'SATUAN', val: product.unit },
        { label: 'BERAT', val: `${product.weightPerUnitKg || 1} Kg` },
        { label: 'SISA STOK', val: `${product.currentStock} ${product.unit}` },
        { label: 'MIN. ORDER', val: `${product.minStock} ${product.unit}` },
      ];

      for (let s = 0; s < 4; s++) {
        const sx = margin + 6 + s * (specBoxW + 2);
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(sx, curY, specBoxW, 18, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(specs[s].label, sx + specBoxW / 2, curY + 6, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);
        doc.text(specs[s].val, sx + specBoxW / 2, curY + 14, { align: 'center' });
      }

      // Footer
      const footerY = pageHeight - margin - 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Momoyo Ciledug Inventory • Item #${i + 1} dari ${products.length} • Kode Barcode: ${product.barcode}`, pageWidth / 2, footerY, { align: 'center' });
    }

    return doc;
  }

  // A1. VOUCHER / SLIP KONTROL STOK (1 PRODUK 1 LEMBAR PENUH A4)
  if (docType === 'VOUCHER' && layout === 'voucher-1per-page') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    for (let i = 0; i < products.length; i++) {
      if (i > 0) doc.addPage();
      const product = products[i];

      // Decorative border
      doc.setDrawColor(200, 20, 20);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4, 'S');

      // Header Banner
      doc.setFillColor(200, 20, 20); // Momoyo Red
      doc.roundedRect(margin, margin, contentWidth, 22, 4, 4, 'F');
      doc.rect(margin, margin + 14, contentWidth, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('MOMOYO CILEDUG - CIREBON', pageWidth / 2, margin + 9, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 240, 240);
      doc.text('LEMBAR KONTROL STOK & AUDIT FISIK GUDANG (1 PRODUK 1 LEMBAR)', pageWidth / 2, margin + 16, { align: 'center' });

      let curY = margin + 28;

      // Product Badge and Title
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin + 5, curY, contentWidth - 10, 22, 3, 3, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + 5, curY, contentWidth - 10, 22, 3, 3, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(20, 20, 20);
      const splitName = doc.splitTextToSize(product.name, contentWidth - 20);
      doc.text(splitName[0], pageWidth / 2, curY + 8.5, { align: 'center' });
      if (splitName[1]) {
        doc.text(splitName[1], pageWidth / 2, curY + 15, { align: 'center' });
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(180, 20, 20);
      doc.text(`[ ITEM #${i + 1} • SKU: ${product.id} • KATEGORI: ${product.category.toUpperCase()} ]`, pageWidth / 2, curY + (splitName[1] ? 20 : 16.5), { align: 'center' });

      curY += 28;

      // Product Info Grid Table
      const infoBoxWidth = (contentWidth - 14) / 4;
      const infoBoxHeight = 15;
      const infos = [
        { label: 'LOKASI RAK GUDANG', val: product.location || 'Gudang Utama' },
        { label: 'SATUAN BARANG', val: product.unit },
        { label: 'STOK TERCATAT', val: `${product.currentStock} ${product.unit}` },
        { label: 'MINIMUM AMAN', val: `${product.minStock} ${product.unit}` },
      ];

      for (let k = 0; k < 4; k++) {
        const boxX = margin + 5 + k * (infoBoxWidth + 1.3);
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.3);
        doc.roundedRect(boxX, curY, infoBoxWidth, infoBoxHeight, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(110, 110, 110);
        doc.text(infos[k].label, boxX + infoBoxWidth / 2, curY + 4.5, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);
        doc.text(infos[k].val, boxX + infoBoxWidth / 2, curY + 11.5, { align: 'center' });
      }

      curY += infoBoxHeight + 5;

      // Barcode Box
      const barcodeDataUrl = createBarcodeDataUrl(product.barcode, 3.5, 80);
      if (barcodeDataUrl) {
        const bcWidth = 140;
        const bcHeight = 42;
        const bcX = (pageWidth - bcWidth) / 2;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.roundedRect(bcX - 3, curY, bcWidth + 6, bcHeight + 10, 3, 3, 'FD');

        doc.addImage(barcodeDataUrl, 'PNG', bcX, curY + 3, bcWidth, bcHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 80);
        doc.text('SCAN BARCODE DENGAN SCANNER / HP UNTUK IN/OUT CEPAT TANPA KETIK', pageWidth / 2, curY + bcHeight + 7, { align: 'center' });

        curY += bcHeight + 15;
      }

      // Audit Inspection Table Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text('TABEL PEMERIKSAAN STOK FISIK (STOCK OPNAME RIIL GUDANG)', margin + 6, curY);

      curY += 4;

      const colWidths = [8, 28, 25, 25, 22, 28, contentWidth - 10 - 136];
      const tableHeaders = ['NO', 'TGL AUDIT', 'STOK SISTEM', 'FISIK RIIL', 'SELISIH', 'PARAF PIC', 'KONDISI & CATATAN'];

      doc.setFillColor(235, 235, 235);
      doc.rect(margin + 5, curY, contentWidth - 10, 6.5, 'F');
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(margin + 5, curY, contentWidth - 10, 6.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(50, 50, 50);

      let xOffset = margin + 5;
      for (let c = 0; c < tableHeaders.length; c++) {
        doc.text(tableHeaders[c], xOffset + colWidths[c] / 2, curY + 4.5, { align: 'center' });
        xOffset += colWidths[c];
      }

      curY += 6.5;

      // 6 Blank Audit rows
      for (let r = 1; r <= 6; r++) {
        doc.setFillColor(r % 2 === 0 ? 252 : 255, r % 2 === 0 ? 252 : 255, r % 2 === 0 ? 252 : 255);
        doc.rect(margin + 5, curY, contentWidth - 10, 8, 'F');
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.2);
        doc.rect(margin + 5, curY, contentWidth - 10, 8, 'S');

        let vertX = margin + 5;
        for (let c = 0; c < colWidths.length - 1; c++) {
          vertX += colWidths[c];
          doc.line(vertX, curY, vertX, curY + 8);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(`${r}`, margin + 5 + colWidths[0] / 2, curY + 5.2, { align: 'center' });

        curY += 8;
      }

      // Verification Signature Block at Bottom
      curY += 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin + 5, curY, margin + contentWidth - 5, curY);
      curY += 4;

      const printDateStr = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`Dicetak pada: ${printDateStr} • Momoyo Ciledug`, margin + 6, curY + 2);

      const sigY = pageHeight - margin - 20;
      doc.text('Petugas PIC Gudang:', margin + 15, sigY);
      doc.line(margin + 15, sigY + 12, margin + 65, sigY + 12);
      doc.text('( ........................................ )', margin + 15, sigY + 16);

      doc.text('Supervisor / Manager Outlet:', margin + contentWidth - 65, sigY);
      doc.line(margin + contentWidth - 65, sigY + 12, margin + contentWidth - 15, sigY + 12);
      doc.text('( ........................................ )', margin + contentWidth - 65, sigY + 16);

      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text(`Hal ${i + 1} dari ${products.length} - ${product.name}`, pageWidth / 2, pageHeight - margin + 3, { align: 'center' });
    }

    return doc;
  }

  // A2. VOUCHER / SLIP KONTROL STOK (4 PER LEMBAR A4)
  if (docType === 'VOUCHER' && layout !== 'voucher-thermal') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const cols = 2;
    const rows = 2;
    const itemsPerPage = cols * rows; // 4 vouchers per A4
    const cellWidth = (pageWidth - margin * 2) / cols;
    const cellHeight = (pageHeight - margin * 2) / rows;
    const padding = 3;

    for (let i = 0; i < products.length; i++) {
      const itemIndexOnPage = i % itemsPerPage;
      if (i > 0 && itemIndexOnPage === 0) {
        doc.addPage();
      }

      const colIndex = itemIndexOnPage % cols;
      const rowIndex = Math.floor(itemIndexOnPage / cols);
      const x = margin + colIndex * cellWidth + padding;
      const y = margin + rowIndex * cellHeight + padding;
      const w = cellWidth - padding * 2;
      const h = cellHeight - padding * 2;
      const product = products[i];

      // Outer dashed cutting border
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([2, 2], 0);
      doc.roundedRect(x, y, w, h, 2, 2, 'S');
      doc.setLineDashPattern([], 0); // reset

      // Scissor symbol in corner
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('✂ Gunting Disini', x + w - 22, y + 4.5);

      // Header Banner (Momoyo Red)
      let curY = y + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(200, 20, 20);
      doc.text('MOMOYO CILEDUG', x + 5, curY);

      curY += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text('VOCER / SLIP KONTROL STOK BARANG', x + 5, curY);

      // Divider line
      curY += 2.5;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(x + 4, curY, x + w - 4, curY);

      // Product Name
      curY += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 15, 15);
      const splitTitle = doc.splitTextToSize(product.name, w - 10);
      for (const line of splitTitle.slice(0, 2)) {
        doc.text(line, x + 5, curY);
        curY += 4.5;
      }

      // Metadata info box
      curY += 1;
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(x + 4, curY, w - 8, 23, 1.5, 1.5, 'F');
      doc.setDrawColor(225, 228, 232);
      doc.roundedRect(x + 4, curY, w - 8, 23, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);

      const infoY = curY + 4.5;
      doc.text(`Kategori: ${product.category}`, x + 7, infoY);
      doc.text(`Lokasi Rak: ${product.location}`, x + 7, infoY + 4.5);
      doc.text(`Satuan: ${product.unit}`, x + 7, infoY + 9);
      if (product.weightPerUnitKg) {
        doc.text(`Berat: ${product.weightPerUnitKg} Kg`, x + 7, infoY + 13.5);
      }

      // Right column of info box: Stock figures
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text(`Sisa Stok: ${product.currentStock} ${product.unit}`, x + w - 45, infoY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Min. Order: ${product.minStock} ${product.unit}`, x + w - 45, infoY + 4.5);
      doc.text(`SKU: ${product.id}`, x + w - 45, infoY + 9);

      curY += 27;

      // Barcode Vector Image
      const barcodeDataUrl = createBarcodeDataUrl(product.barcode, 2.4, 52);
      if (barcodeDataUrl) {
        const barcodeW = Math.min(w - 12, 70);
        const barcodeH = 22;
        const bX = x + (w - barcodeW) / 2;
        doc.addImage(barcodeDataUrl, 'PNG', bX, curY, barcodeW, barcodeH);
        curY += 24;
      }

      // PIC Verification & Signature Section
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(x + 4, curY, x + w - 4, curY);
      curY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      const printDateStr = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      doc.text(`Tgl Cetak: ${printDateStr}`, x + 5, curY);
      doc.text(`Petugas PIC: [ .................... ]`, x + 42, curY);

      curY += 4.5;
      doc.text(`Status:  [  ] Sesuai / OK     [  ] Kurang / Selisih     [  ] Rusak`, x + 5, curY);
    }

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Momoyo Ciledug - Vocer Kontrol Stok Berurutan (${products.length} Vocer) - Hal ${p}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 3,
        { align: 'center' }
      );
    }

    return doc;
  }

  // B. THERMAL PRINTER (Roll / Stiker Satuan)
  const isThermal = layout.startsWith('thermal-') || layout === 'voucher-thermal';
  if (isThermal) {
    let thermalWidth = 50;
    let thermalHeight = 30;

    if (layout === 'thermal-70x40') {
      thermalWidth = 70;
      thermalHeight = 40;
    } else if (layout === 'thermal-80x50') {
      thermalWidth = 80;
      thermalHeight = 50;
    } else if (layout === 'voucher-thermal') {
      thermalWidth = 80;
      thermalHeight = 90;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [thermalHeight, thermalWidth],
    });

    for (let i = 0; i < products.length; i++) {
      if (i > 0) {
        doc.addPage([thermalHeight, thermalWidth], 'landscape');
      }

      const product = products[i];
      let currentY = 3.5;

      // Header Tag
      if (includeStoreHeader) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout === 'thermal-50x30' ? 6 : 7.5);
        doc.setTextColor(200, 20, 20); // Momoyo Red
        doc.text(
          layout === 'voucher-thermal' ? 'MOMOYO CILEDUG • VOCER STOK' : 'MOMOYO CILEDUG',
          thermalWidth / 2,
          currentY,
          { align: 'center' }
        );
        currentY += layout === 'thermal-50x30' ? 3 : 3.8;
      }

      // Product Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(layout === 'thermal-50x30' ? 8 : 9.5);
      doc.setTextColor(20, 20, 20);
      const splitTitle = doc.splitTextToSize(product.name, thermalWidth - 4);
      const maxTitleLines = layout === 'thermal-50x30' ? 1 : 2;
      for (const line of splitTitle.slice(0, maxTitleLines)) {
        doc.text(line, thermalWidth / 2, currentY, { align: 'center' });
        currentY += layout === 'thermal-50x30' ? 3.2 : 3.8;
      }

      // Meta info (Rak, Satuan, Berat, Sisa Stok)
      const metaParts: string[] = [];
      if (includeLocation && product.location) metaParts.push(`Rak: ${product.location}`);
      if (includeUnit && product.unit) metaParts.push(product.unit);
      if (includeWeight && product.weightPerUnitKg) metaParts.push(`${product.weightPerUnitKg}kg`);
      if (layout === 'voucher-thermal') metaParts.push(`Stok: ${product.currentStock}`);

      if (metaParts.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(layout === 'thermal-50x30' ? 5.5 : 6.5);
        doc.setTextColor(80, 80, 80);
        doc.text(metaParts.join(' • '), thermalWidth / 2, currentY, { align: 'center' });
        currentY += layout === 'thermal-50x30' ? 2.5 : 3.2;
      }

      // High-res Barcode
      const barcodeDataUrl = createBarcodeDataUrl(
        product.barcode,
        layout === 'thermal-50x30' ? 2 : 2.6,
        layout === 'thermal-50x30' ? 45 : 60
      );

      if (barcodeDataUrl) {
        const barcodeWidth = thermalWidth - 6;
        const availableHeight = thermalHeight - currentY - (layout === 'voucher-thermal' ? 16 : 1.5);
        const barcodeHeight = Math.min(
          availableHeight,
          layout === 'thermal-50x30' ? 14 : 22
        );
        const barcodeX = (thermalWidth - barcodeWidth) / 2;

        doc.addImage(
          barcodeDataUrl,
          'PNG',
          barcodeX,
          currentY,
          barcodeWidth,
          barcodeHeight
        );
        currentY += barcodeHeight + 2;
      }

      // Extra section for thermal voucher
      if (layout === 'voucher-thermal') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text('PIC: [ ............ ]  Tgl: ' + new Date().toLocaleDateString('id-ID'), thermalWidth / 2, currentY, { align: 'center' });
      }
    }

    return doc;
  }

  // C. STANDARD A4 GRID LAYOUTS (3x6, 3x4, 2x4)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginTop = 10;
  const marginBottom = 10;
  const marginLeft = 10;
  const marginRight = 10;

  const printableWidth = pageWidth - marginLeft - marginRight;
  const printableHeight = pageHeight - marginTop - marginBottom;

  let cols = 3;
  let rows = 6;
  if (layout === '2x4') {
    cols = 2;
    rows = 4;
  } else if (layout === '3x4') {
    cols = 3;
    rows = 4;
  }

  const itemsPerPage = cols * rows;
  const cellWidth = printableWidth / cols;
  const cellHeight = printableHeight / rows;
  const cardPadding = 1.8;

  for (let i = 0; i < products.length; i++) {
    const itemIndexOnPage = i % itemsPerPage;

    if (i > 0 && itemIndexOnPage === 0) {
      doc.addPage();
    }

    const colIndex = itemIndexOnPage % cols;
    const rowIndex = Math.floor(itemIndexOnPage / cols);

    const x = marginLeft + colIndex * cellWidth + cardPadding;
    const y = marginTop + rowIndex * cellHeight + cardPadding;
    const w = cellWidth - cardPadding * 2;
    const h = cellHeight - cardPadding * 2;

    const product = products[i];

    // Subtle dashed cutting guide box
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 2, 2, 'S');

    // Store Header tag
    let currentY = y + 3.8;
    if (includeStoreHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(layout === '2x4' ? 8 : 6.5);
      doc.setTextColor(200, 20, 20); // Momoyo Red
      doc.text('MOMOYO CILEDUG', x + w / 2, currentY, { align: 'center' });
      currentY += layout === '2x4' ? 4.2 : 3.4;
    }

    // Product Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout === '2x4' ? 10 : 8.2);
    doc.setTextColor(20, 20, 20);

    const maxTitleWidth = w - 4;
    const splitTitle = doc.splitTextToSize(product.name, maxTitleWidth);
    const titleLines = splitTitle.slice(0, 2);
    for (const line of titleLines) {
      doc.text(line, x + w / 2, currentY, { align: 'center' });
      currentY += layout === '2x4' ? 4.2 : 3.4;
    }

    // Meta details (Rak / Satuan / Berat)
    const metaParts: string[] = [];
    if (includeLocation && product.location) metaParts.push(`Rak: ${product.location}`);
    if (includeUnit && product.unit) metaParts.push(`Satuan: ${product.unit}`);
    if (includeWeight && product.weightPerUnitKg) metaParts.push(`${product.weightPerUnitKg}kg`);

    if (metaParts.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(layout === '2x4' ? 7.5 : 6.5);
      doc.setTextColor(90, 90, 90);
      doc.text(metaParts.join('  •  '), x + w / 2, currentY, { align: 'center' });
      currentY += layout === '2x4' ? 3.5 : 2.8;
    }

    // Barcode image
    const barcodeDataUrl = createBarcodeDataUrl(
      product.barcode,
      layout === '2x4' ? 2.8 : 2.2,
      layout === '2x4' ? 65 : 50
    );

    if (barcodeDataUrl) {
      const remainingHeight = y + h - currentY - 2;
      const barcodeImgWidth = Math.min(w - 6, layout === '2x4' ? 75 : 50);
      const barcodeImgHeight = Math.max(12, Math.min(remainingHeight, layout === '2x4' ? 25 : 18));
      const barcodeX = x + (w - barcodeImgWidth) / 2;

      doc.addImage(
        barcodeDataUrl,
        'PNG',
        barcodeX,
        currentY + 0.8,
        barcodeImgWidth,
        barcodeImgHeight
      );
    }
  }

  // Page Footer Info with Sort Order indication
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Momoyo Ciledug - Katalog Barcode Terurut (${products.length} Barcode) - Hal. ${p}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Triggers printing using a dedicated hidden iframe.
 */
export function printPdfDirectly(doc: jsPDF): void {
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    let printed = false;
    const tryPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('Iframe print error, falling back to tab preview:', e);
        openPdfPreview(doc);
      }

      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }, 60000);
    };

    iframe.onload = () => {
      setTimeout(tryPrint, 300);
    };

    setTimeout(() => {
      if (!printed) {
        tryPrint();
      }
    }, 1500);
  } catch (err) {
    console.error('Print PDF failed, opening tab preview:', err);
    openPdfPreview(doc);
  }
}

/**
 * Opens the generated PDF in a new browser tab for full-screen preview.
 */
export function openPdfPreview(doc: jsPDF): void {
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
}

/**
 * Direct Instant HTML-based Label & Voucher Printing.
 * Guarantees 100% native print dialog support across all mobile devices (Chrome, Safari) & desktop!
 */
export function printLabelsHtmlDirectly(
  inputProducts: Product[],
  options: BarcodePdfOptions = {}
): void {
  const {
    layout = '3x6',
    docType = 'LABEL',
    sortOrder = 'CATEGORY_NAME_ASC',
    includeLocation = true,
    includeUnit = true,
    includeStoreHeader = true,
    includeWeight = true,
  } = options;

  // Strict sorting according to product order
  const products = sortProducts(inputProducts, sortOrder);
  const isVoucher = docType === 'VOUCHER' || layout === 'voucher-a4' || layout === 'voucher-thermal';
  const isThermal = layout.startsWith('thermal-') || layout === 'voucher-thermal';

  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Helper to render a single HTML item card
  const renderItemHtml = (product: Product, idx: number): string => {
    const barcodeUrl = createBarcodeDataUrl(product.barcode, 2.3, 50);
    const metaParts: string[] = [];
    if (includeLocation && product.location) metaParts.push(`Rak: ${product.location}`);
    if (includeUnit && product.unit) metaParts.push(product.unit);
    if (includeWeight && product.weightPerUnitKg) metaParts.push(`${product.weightPerUnitKg}kg`);

    // 1. Fullpage Voucher (1 Produk 1 Lembar A4)
    if (docType === 'VOUCHER' && layout === 'voucher-1per-page') {
      return `
      <div class="voucher-fullpage">
        <div class="fullpage-banner">
          <div class="fullpage-brand">MOMOYO CILEDUG - CIREBON</div>
          <div class="fullpage-subtitle">LEMBAR KONTROL STOK & AUDIT FISIK GUDANG (1 PRODUK 1 LEMBAR)</div>
        </div>

        <div class="product-box">
          <div class="product-title-large">${product.name}</div>
          <div class="product-id-sub">[ ITEM #${idx + 1} &bull; SKU: ${product.id} &bull; KATEGORI: ${product.category.toUpperCase()} ]</div>
        </div>

        <div class="specs-grid-fullpage">
          <div class="spec-card"><span class="spec-lbl">LOKASI RAK</span><span class="spec-val">${product.location || 'Gudang Utama'}</span></div>
          <div class="spec-card"><span class="spec-lbl">SATUAN</span><span class="spec-val">${product.unit}</span></div>
          <div class="spec-card"><span class="spec-lbl">STOK TERCATAT</span><span class="spec-val text-red">${product.currentStock} ${product.unit}</span></div>
          <div class="spec-card"><span class="spec-lbl">MINIMUM AMAN</span><span class="spec-val">${product.minStock} ${product.unit}</span></div>
        </div>

        <div class="barcode-box-fullpage">
          ${
            barcodeUrl
              ? `<img src="${barcodeUrl}" class="barcode-img-large" alt="${product.barcode}" />`
              : `<div class="barcode-fallback">${product.barcode}</div>`
          }
          <div class="scan-hint">SCAN BARCODE DENGAN SCANNER / HP UNTUK IN/OUT CEPAT TANPA KETIK</div>
        </div>

        <div class="audit-section">
          <div class="audit-heading">TABEL PEMERIKSAAN STOK FISIK (STOCK OPNAME RIIL GUDANG)</div>
          <table class="audit-table">
            <thead>
              <tr>
                <th style="width: 32px;">NO</th>
                <th style="width: 110px;">TGL AUDIT</th>
                <th style="width: 95px;">STOK SISTEM</th>
                <th style="width: 95px;">FISIK RIIL</th>
                <th style="width: 85px;">SELISIH</th>
                <th style="width: 120px;">PARAF PIC</th>
                <th>KONDISI & CATATAN</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              <tr><td>2</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              <tr><td>3</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              <tr><td>4</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              <tr><td>5</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              <tr><td>6</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            </tbody>
          </table>
        </div>

        <div class="fullpage-footer">
          <div class="footer-timestamp">Dicetak pada: ${printDateStr} &bull; Outlet Momoyo Ciledug</div>
          <div class="sig-container">
            <div class="sig-box">
              <div>Petugas PIC Gudang:</div>
              <div class="sig-line"></div>
              <div>( ........................................ )</div>
            </div>
            <div class="sig-box">
              <div>Supervisor / Manager Toko:</div>
              <div class="sig-line"></div>
              <div>( ........................................ )</div>
            </div>
          </div>
        </div>
      </div>
      `;
    }

    // 2. Fullpage Label Jumbo (1 Produk 1 Lembar A4)
    if (docType === 'LABEL' && layout === '1x1') {
      return `
      <div class="label-card-fullpage">
        <div class="fullpage-banner">
          <div class="fullpage-brand">MOMOYO CILEDUG - CIREBON</div>
          <div class="fullpage-subtitle">LABEL IDENTITAS BARANG & RAK GUDANG (1 PRODUK 1 LEMBAR)</div>
        </div>

        <div class="product-box">
          <div class="product-title-large">${product.name}</div>
        </div>

        <div class="badges-row">
          <div class="badge-card badge-red">
            <span class="badge-title">KATEGORI PRODUK</span>
            <span class="badge-val">${product.category}</span>
          </div>
          <div class="badge-card badge-gray">
            <span class="badge-title">POSISI PENYIMPANAN / RAK</span>
            <span class="badge-val">${product.location || 'Gudang Momoyo'}</span>
          </div>
        </div>

        <div class="barcode-box-fullpage">
          ${
            barcodeUrl
              ? `<img src="${barcodeUrl}" class="barcode-img-large" alt="${product.barcode}" />`
              : `<div class="barcode-fallback">${product.barcode}</div>`
          }
        </div>

        <div class="specs-grid-fullpage">
          <div class="spec-card"><span class="spec-lbl">SATUAN</span><span class="spec-val">${product.unit}</span></div>
          <div class="spec-card"><span class="spec-lbl">BERAT</span><span class="spec-val">${product.weightPerUnitKg || 1} Kg</span></div>
          <div class="spec-card"><span class="spec-lbl">SISA STOK</span><span class="spec-val text-red">${product.currentStock} ${product.unit}</span></div>
          <div class="spec-card"><span class="spec-lbl">MIN. ORDER</span><span class="spec-val">${product.minStock} ${product.unit}</span></div>
        </div>

        <div class="label-fullpage-footer">
          Momoyo Ciledug Inventory &bull; Item #${idx + 1} dari ${products.length} &bull; Kode Barcode: ${product.barcode}
        </div>
      </div>
      `;
    }

    if (isVoucher) {
      return `
      <div class="voucher-card">
        <div class="voucher-header">
          <div>
            <span class="store-badge">MOMOYO CILEDUG</span>
            <span class="voucher-sub">VOCER KONTROL STOK</span>
          </div>
          <div class="voucher-order-badge">#${idx + 1} &bull; ${product.id}</div>
        </div>
        <div class="product-title">${product.name}</div>
        
        <div class="voucher-grid-info">
          <div><strong>Kategori:</strong> ${product.category}</div>
          <div><strong>Lokasi Rak:</strong> ${product.location}</div>
          <div><strong>Sisa Stok:</strong> <span class="stock-num">${product.currentStock} ${product.unit}</span></div>
          <div><strong>Min Order:</strong> ${product.minStock} ${product.unit}</div>
        </div>

        <div class="barcode-box">
          ${
            barcodeUrl
              ? `<img src="${barcodeUrl}" class="barcode-img" alt="${product.barcode}" />`
              : `<div class="barcode-fallback">${product.barcode}</div>`
          }
        </div>

        <div class="voucher-footer">
          <div class="footer-meta">
            <span>Tgl: ${printDateStr}</span>
            <span>PIC: [ .................... ]</span>
          </div>
          <div class="status-checks">
            <span>[ ] Sesuai</span>
            <span>[ ] Kurang</span>
            <span>[ ] Cek Ulang</span>
          </div>
        </div>
        <div class="tear-line">✂ - - - - - - - - Gunting / Sobek Disini - - - - - - - -</div>
      </div>
    `;
    }

    // Standard Shelf Label
    return `
    <div class="label-card">
      ${includeStoreHeader ? '<div class="store-header">MOMOYO CILEDUG</div>' : ''}
      <div class="product-name">${product.name}</div>
      ${metaParts.length > 0 ? `<div class="meta-info">${metaParts.join(' • ')}</div>` : ''}
      <div class="barcode-container">
        ${
          barcodeUrl
            ? `<img src="${barcodeUrl}" class="barcode-img" alt="${product.barcode}" />`
            : `<div class="barcode-text">${product.barcode}</div>`
        }
      </div>
    </div>
  `;
  };

  const isFullpageSingle = layout === '1x1' || layout === 'voucher-1per-page';
  const itemsPerSheet = getItemsPerSheetForLayout(layout, docType);
  const safeSheets = Math.max(1, options.sheetsPerProduct || 1);

  let bodyContent = '';

  // Mode: Per lembar hanya 1 produk, tapi berisi banyak barcode/vocer
  if (options.pageMode === 'PER_PRODUCT_SHEET_MULTI') {
    const distinctProducts = products;
    bodyContent = distinctProducts
      .map((product, pIdx) => {
        let sheetsHtml = '';
        for (let s = 0; s < safeSheets; s++) {
          const sheetCards = Array.from({ length: itemsPerSheet }, (_, cIdx) =>
            renderItemHtml(product, pIdx * itemsPerSheet + cIdx)
          ).join('');

          sheetsHtml += `
            <div class="product-sheet-page">
              <div class="sheet-title-tag">
                MOMOYO CILEDUG &bull; LEMBAR KHUSUS PRODUK: <strong>${product.name}</strong> 
                (LEMBAR ${s + 1}/${safeSheets} &bull; ISI ${itemsPerSheet} ${isVoucher ? 'VOCER' : 'LABEL'})
              </div>
              ${
                isVoucher
                  ? `<div class="vouchers-grid">${sheetCards}</div>`
                  : `<div class="grid-container">${sheetCards}</div>`
              }
            </div>
          `;
        }
        return sheetsHtml;
      })
      .join('');
  } else if (isFullpageSingle) {
    bodyContent = products.map((p, i) => renderItemHtml(p, i)).join('');
  } else if (isVoucher) {
    const allCards = products.map((p, i) => renderItemHtml(p, i)).join('');
    bodyContent =
      layout === 'voucher-thermal'
        ? allCards
        : `<div class="vouchers-grid">${allCards}</div>`;
  } else if (isThermal) {
    bodyContent = products.map((p, i) => renderItemHtml(p, i)).join('');
  } else {
    const allCards = products.map((p, i) => renderItemHtml(p, i)).join('');
    bodyContent = `<div class="grid-container">${allCards}</div>`;
  }

  let pageStyle = '';

  if (layout === 'voucher-1per-page') {
    pageStyle = `
      @page { size: A4 portrait; margin: 10mm; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; }
      .voucher-fullpage {
        border: 2px solid #c81414;
        border-radius: 8px;
        padding: 5mm 7mm;
        box-sizing: border-box;
        page-break-after: always;
        break-after: page;
        min-height: 268mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: #fff;
      }
      .fullpage-banner {
        background: #c81414;
        color: #fff;
        padding: 3mm 4mm;
        border-radius: 5px;
        text-align: center;
      }
      .fullpage-brand { font-size: 14pt; font-weight: 900; letter-spacing: 0.5px; }
      .fullpage-subtitle { font-size: 8pt; font-weight: 500; opacity: 0.9; margin-top: 1mm; }
      .product-box {
        background: #f9f9f9;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 3mm 4mm;
        text-align: center;
        margin: 3mm 0;
      }
      .product-title-large { font-size: 15pt; font-weight: 900; color: #111; }
      .product-id-sub { font-size: 8pt; font-weight: 800; color: #c81414; margin-top: 1mm; font-family: monospace; }
      .specs-grid-fullpage {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 2.5mm;
        margin-bottom: 3mm;
      }
      .spec-card {
        border: 1px solid #ddd;
        border-radius: 5px;
        background: #fafafa;
        padding: 2.5mm;
        text-align: center;
      }
      .spec-lbl { font-size: 6.5pt; font-weight: bold; color: #666; display: block; }
      .spec-val { font-size: 10pt; font-weight: 900; color: #222; margin-top: 1mm; display: block; }
      .text-red { color: #c81414; }
      .barcode-box-fullpage {
        border: 1px solid #e2e2e2;
        border-radius: 6px;
        padding: 3mm;
        text-align: center;
        background: #fff;
        margin-bottom: 3mm;
      }
      .barcode-img-large { max-width: 85%; max-height: 38mm; object-fit: contain; }
      .scan-hint { font-size: 7.5pt; font-weight: bold; color: #666; margin-top: 1.5mm; }
      .audit-section { margin-top: 2mm; }
      .audit-heading { font-size: 9.5pt; font-weight: 900; color: #222; margin-bottom: 1.5mm; }
      .audit-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
      .audit-table th { background: #eee; border: 1px solid #bbb; padding: 1.5mm; font-weight: bold; text-align: center; }
      .audit-table td { border: 1px solid #ccc; height: 6.5mm; text-align: center; }
      .fullpage-footer { border-top: 1px solid #eee; padding-top: 2mm; margin-top: 2mm; }
      .footer-timestamp { font-size: 7pt; color: #777; margin-bottom: 3mm; }
      .sig-container { display: flex; justify-content: space-between; font-size: 8pt; color: #333; padding: 0 10mm; }
      .sig-box { text-align: center; width: 55mm; }
      .sig-line { border-bottom: 1px solid #333; height: 12mm; margin-bottom: 1.5mm; }
    `;
  } else if (layout === '1x1') {
    pageStyle = `
      @page { size: A4 portrait; margin: 10mm; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; }
      .label-card-fullpage {
        border: 3px solid #c81414;
        border-radius: 10px;
        padding: 6mm 8mm;
        box-sizing: border-box;
        page-break-after: always;
        break-after: page;
        min-height: 268mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: center;
        background: #fff;
      }
      .fullpage-banner {
        background: #c81414;
        color: #fff;
        padding: 4mm;
        border-radius: 6px;
      }
      .fullpage-brand { font-size: 16pt; font-weight: 900; letter-spacing: 0.5px; }
      .fullpage-subtitle { font-size: 8.5pt; font-weight: 500; opacity: 0.9; margin-top: 1mm; }
      .product-box {
        background: #fbfbfb;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 5mm;
        margin: 4mm 0;
      }
      .product-title-large { font-size: 20pt; font-weight: 900; color: #111; line-height: 1.2; }
      .badges-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3mm;
        margin-bottom: 4mm;
      }
      .badge-card {
        border-radius: 6px;
        padding: 2.5mm;
      }
      .badge-red { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
      .badge-gray { background: #f3f4f6; border: 1px solid #d1d5db; color: #1f2937; }
      .badge-title { font-size: 7pt; font-weight: bold; display: block; opacity: 0.8; }
      .badge-val { font-size: 11pt; font-weight: 900; display: block; margin-top: 0.5mm; }
      .barcode-box-fullpage {
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 5mm;
        background: #fff;
        margin-bottom: 4mm;
      }
      .barcode-img-large { max-width: 90%; max-height: 52mm; object-fit: contain; }
      .specs-grid-fullpage {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 2.5mm;
        margin-bottom: 4mm;
      }
      .spec-card {
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fafafa;
        padding: 2.5mm;
      }
      .spec-lbl { font-size: 7pt; font-weight: bold; color: #666; display: block; }
      .spec-val { font-size: 11pt; font-weight: 900; color: #222; margin-top: 1mm; display: block; }
      .text-red { color: #c81414; }
      .label-fullpage-footer {
        font-size: 7.5pt;
        color: #888;
        border-top: 1px solid #eee;
        padding-top: 2mm;
      }
    `;
  } else if (isVoucher) {
    if (layout === 'voucher-thermal') {
      pageStyle = `
        @page { size: 80mm auto; margin: 3mm; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
        .voucher-card { width: 74mm; margin-bottom: 5mm; border-bottom: 1px dashed #777; padding-bottom: 4mm; page-break-inside: avoid; }
        .store-badge { font-weight: 900; color: #c81414; font-size: 8pt; display: block; }
        .voucher-sub { font-size: 7pt; color: #666; font-weight: bold; }
        .voucher-order-badge { font-size: 7pt; color: #777; font-family: monospace; }
        .product-title { font-size: 10pt; font-weight: 800; margin: 2mm 0; line-height: 1.2; }
        .voucher-grid-info { font-size: 7.5pt; color: #333; margin-bottom: 2mm; display: grid; grid-template-columns: 1fr; gap: 1mm; }
        .stock-num { font-weight: bold; color: #111; }
        .barcode-box { text-align: center; margin: 2mm 0; }
        .barcode-img { max-width: 95%; max-height: 20mm; }
        .voucher-footer { font-size: 7pt; color: #555; margin-top: 2mm; }
        .footer-meta { display: flex; justify-content: space-between; margin-bottom: 1mm; }
        .status-checks { display: flex; justify-content: space-between; font-size: 6.5pt; color: #777; }
        .tear-line { text-align: center; font-size: 6.5pt; color: #999; margin-top: 2mm; }
      `;
    } else {
      // 4 vouchers per A4
      pageStyle = `
        @page { size: A4 portrait; margin: 8mm; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
        .vouchers-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; box-sizing: border-box; }
        .voucher-card {
          border: 1.5px dashed #bbb;
          border-radius: 6px;
          padding: 3.5mm 4mm;
          box-sizing: border-box;
          page-break-inside: avoid;
          break-inside: avoid;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 130mm;
          background: #fff;
        }
        .voucher-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #eee; padding-bottom: 1.5mm; }
        .store-badge { font-weight: 900; color: #c81414; font-size: 9pt; display: block; letter-spacing: 0.5px; }
        .voucher-sub { font-size: 7pt; color: #555; font-weight: bold; }
        .voucher-order-badge { font-size: 7pt; font-weight: bold; color: #555; font-family: monospace; background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
        .product-title { font-size: 11pt; font-weight: 800; color: #111; margin: 2mm 0; line-height: 1.25; min-height: 2.5em; }
        .voucher-grid-info { font-size: 8pt; color: #444; background: #fcfcfc; border: 1px solid #eee; padding: 2mm; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm; }
        .stock-num { font-weight: bold; color: #000; }
        .barcode-box { display: flex; justify-content: center; align-items: center; margin: 2.5mm 0; }
        .barcode-img { max-width: 95%; max-height: 24mm; }
        .voucher-footer { border-top: 1px solid #eee; padding-top: 2mm; font-size: 7.5pt; color: #555; }
        .footer-meta { display: flex; justify-content: space-between; margin-bottom: 1.5mm; }
        .status-checks { display: flex; justify-content: space-around; font-size: 7pt; color: #666; font-weight: 500; }
        .tear-line { text-align: center; font-size: 7pt; color: #aaa; margin-top: 1.5mm; font-family: monospace; }
      `;
    }
  } else if (isThermal) {
    let widthMm = 50;
    let heightMm = 30;
    if (layout === 'thermal-70x40') {
      widthMm = 70;
      heightMm = 40;
    } else if (layout === 'thermal-80x50') {
      widthMm = 80;
      heightMm = 50;
    }

    pageStyle = `
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
      .label-card { width: ${widthMm}mm; height: ${heightMm}mm; page-break-after: always; break-after: page; box-sizing: border-box; padding: 2mm 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
      .store-header { font-size: 7pt; font-weight: 800; color: #c81414; letter-spacing: 0.5px; margin-bottom: 1mm; }
      .product-name { font-size: 9pt; font-weight: 800; color: #111; line-height: 1.15; max-height: 2.3em; overflow: hidden; margin-bottom: 1mm; }
      .meta-info { font-size: 6.5pt; color: #555; font-weight: 600; margin-bottom: 1.5mm; }
      .barcode-container { width: 100%; display: flex; justify-content: center; }
      .barcode-img { max-width: 95%; max-height: ${heightMm - 14}mm; object-fit: contain; }
    `;
  } else {
    // Standard A4 Grid
    let cols = 3;
    if (layout === '2x4') cols = 2;

    pageStyle = `
      @page { size: A4 portrait; margin: 8mm; }
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
      .grid-container { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 3mm; box-sizing: border-box; }
      .label-card { border: 1px dashed #bbb; border-radius: 4px; padding: 2.5mm 3mm; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; page-break-inside: avoid; break-inside: avoid; min-height: ${layout === '2x4' ? '65mm' : '43mm'}; }
      .store-header { font-size: 7.5pt; font-weight: 800; color: #c81414; letter-spacing: 0.5px; margin-bottom: 1mm; }
      .product-name { font-size: 8.5pt; font-weight: 800; color: #111; line-height: 1.2; max-height: 2.4em; overflow: hidden; margin-bottom: 1mm; }
      .meta-info { font-size: 7pt; color: #666; font-weight: 600; margin-bottom: 1.5mm; }
      .barcode-container { width: 100%; display: flex; justify-content: center; margin-top: auto; }
      .barcode-img { max-width: 95%; max-height: ${layout === '2x4' ? '30mm' : '20mm'}; object-fit: contain; }
    `;
  }

  // Common sheet page-break styling for per-product multi printing
  pageStyle += `
    .product-sheet-page {
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
      width: 100%;
      min-height: 270mm;
      display: flex;
      flex-direction: column;
    }
    .sheet-title-tag {
      font-size: 7.5pt;
      color: #666;
      font-weight: bold;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border-bottom: 1px dashed #ccc;
      padding-bottom: 1.5mm;
      margin-bottom: 3mm;
      text-align: center;
      letter-spacing: 0.5px;
    }
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup diblokir browser. Silakan izinkan popup atau gunakan tombol "Download PDF".');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cetak ${isVoucher ? 'Vocer Stok' : 'Label Barcode'} - Momoyo Ciledug</title>
        <style>${pageStyle}</style>
      </head>
      <body>
        ${bodyContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
