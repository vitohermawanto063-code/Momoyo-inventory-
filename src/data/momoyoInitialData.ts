import { Product, ProductCategory } from '../types';

export const CATEGORIES: ProductCategory[] = [
  'Bahan Es Krim & Susu',
  'Teh & Sirup Buah',
  'Topping & Isian',
  'Packaging & Cup',
  'Operasional & Sanitasi',
];

// No default products! Only user-inputted items should appear.
export const INITIAL_PRODUCTS: Product[] = [];

// Registry of legacy 16-17 demo items to permanently remove and prevent from reappearing
export const LEGACY_DEFAULT_PRODUCT_IDS: string[] = [
  'prod-001',
  'prod-002',
  'prod-003',
  'prod-004',
  'prod-005',
  'prod-006',
  'prod-007',
  'prod-008',
  'prod-009',
  'prod-010',
  'prod-011',
  'prod-012',
  'prod-013',
  'prod-014',
  'prod-015',
  'prod-016',
  'prod-017',
];

export const LEGACY_DEFAULT_BARCODES: string[] = [
  '899100100101',
  '899100100102',
  '899100100103',
  '899100100104',
  '899100200201',
  '899100200202',
  '899100200203',
  '899100200204',
  '899100300301',
  '899100300302',
  '899100300303',
  '899100400401',
  '899100400402',
  '899100400403',
  '899100400404',
  '899100500501',
  '899100500502',
];

export const LEGACY_DEFAULT_NAMES: string[] = [
  'Bubuk Es Krim Vanilla Original Momoyo',
  'Cone Waffle Momoyo Crispy (Isi 300 pcs)',
  'Susu UHT Fresh Milk Diamond (1 Liter)',
  'Susu Evaporasi Carnation',
  'Teh Daun Jasmine Green Tea Momoyo (500g)',
  'Teh Hitam Black Tea Supreme (500g)',
  'Sirup Puree Mango Juice Momoyo (2.5 Kg)',
  'Sirup Strawberry Puree with Pulp (2.5 Kg)',
  'Tapioca Boba Brown Sugar Momoyo (3 Kg)',
  'Nata de Coco Jelly Momoyo (3.2 Kg)',
  'Oreo Crumb Repack Momoyo (1 Kg)',
  'Cup Regular 500ml Momoyo Logo Printing (Isi 1000 pcs)',
  'Cup Jumbo 700ml Momoyo Logo Printing (Isi 1000 pcs)',
  'Sealing Film Cup Momoyo Roll (2000 cups/roll)',
  'Sedotan Boba Steril Momoyo (Isi 500 pcs)',
  'Sanitizer Food Grade Mesin Es Krim (5 Liter)',
  'Food Grade Lubricant Gel Mesin Taylor/Momoyo',
];

export const LEGACY_DEFAULT_TX_IDS: string[] = [
  'tx-001',
  'tx-002',
  'tx-003',
  'tx-004',
];

const legacyIdSet = new Set(LEGACY_DEFAULT_PRODUCT_IDS);
const legacyBarcodeSet = new Set(LEGACY_DEFAULT_BARCODES);
const legacyNameSet = new Set(LEGACY_DEFAULT_NAMES.map((n) => n.trim().toLowerCase()));
const legacyTxSet = new Set(LEGACY_DEFAULT_TX_IDS);

/**
 * Checks if a product belongs to the 16 demo bawaan items that must be permanently hidden
 */
export function isDefaultLegacyProduct(p: { id?: string; barcode?: string; name?: string } | null | undefined): boolean {
  if (!p) return false;
  if (p.id && legacyIdSet.has(p.id)) return true;
  if (p.barcode && legacyBarcodeSet.has(p.barcode.trim())) return true;
  if (p.name && legacyNameSet.has(p.name.trim().toLowerCase())) return true;
  return false;
}

/**
 * Checks if a transaction belongs to the legacy demo transactions
 */
export function isDefaultLegacyTransaction(
  t: { id?: string; productId?: string; barcode?: string; productName?: string } | null | undefined
): boolean {
  if (!t) return false;
  if (t.id && legacyTxSet.has(t.id)) return true;
  if (t.productId && legacyIdSet.has(t.productId)) return true;
  if (t.barcode && legacyBarcodeSet.has(t.barcode.trim())) return true;
  if (t.productName && legacyNameSet.has(t.productName.trim().toLowerCase())) return true;
  return false;
}
