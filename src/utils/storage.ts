import { Product, StockTransaction, PurchaseOrder, SuratJalan } from '../types';
import {
  INITIAL_PRODUCTS,
  isDefaultLegacyProduct,
  isDefaultLegacyTransaction,
} from '../data/momoyoInitialData';
import {
  saveProductsToIndexedDB,
  saveTransactionsToIndexedDB,
  loadProductsFromIndexedDB,
  loadTransactionsFromIndexedDB,
  purgeLegacyFromIndexedDB,
} from './indexedDbBackup';

const PRODUCTS_KEY = 'momoyo_ciledug_inventory_products_v1';
const TRANSACTIONS_KEY = 'momoyo_ciledug_inventory_transactions_v1';
const PURCHASE_ORDERS_KEY = 'momoyo_ciledug_inventory_pos_v1';
const SURAT_JALAN_KEY = 'momoyo_ciledug_inventory_surat_jalan_v1';

export const INITIAL_TRANSACTIONS: StockTransaction[] = [];

/**
 * Loads products from localStorage and IndexedDB, strictly ensuring no legacy bawaan products exist.
 * Only returns products actually inputted by the user.
 */
export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) {
      // Async trigger recovery from IndexedDB in background if needed
      loadProductsFromIndexedDB().then((idbProducts) => {
        if (idbProducts && idbProducts.length > 0) {
          const cleanIdb = idbProducts.filter((p) => !isDefaultLegacyProduct(p));
          saveStoredProducts(cleanIdb);
        }
      });
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify([]));
      return [];
    }

    const cleanProducts = (parsed as Product[]).filter((p) => !isDefaultLegacyProduct(p));
    // If legacy demo items were present in localStorage, overwrite with clean list immediately
    if (cleanProducts.length !== parsed.length) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(cleanProducts));
      saveProductsToIndexedDB(cleanProducts);
    }
    return cleanProducts;
  } catch (err) {
    console.error('Failed to load products from storage:', err);
    return [];
  }
}

/**
 * Saves products to localStorage and IndexedDB, filtering out any legacy items.
 */
export function saveStoredProducts(products: Product[]): void {
  try {
    const cleanProducts = (products || []).filter((p) => !isDefaultLegacyProduct(p));
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(cleanProducts));
    saveProductsToIndexedDB(cleanProducts);
  } catch (err) {
    console.error('Failed to save products:', err);
  }
}

/**
 * Loads transactions from localStorage, filtering out legacy demo transactions.
 */
export function getStoredTransactions(): StockTransaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) {
      loadTransactionsFromIndexedDB().then((idbTx) => {
        if (idbTx && idbTx.length > 0) {
          const cleanTx = idbTx.filter((t) => !isDefaultLegacyTransaction(t));
          saveStoredTransactions(cleanTx);
        }
      });
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
      return [];
    }

    const cleanTx = (parsed as StockTransaction[]).filter((t) => !isDefaultLegacyTransaction(t));
    if (cleanTx.length !== parsed.length) {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(cleanTx));
      saveTransactionsToIndexedDB(cleanTx);
    }
    return cleanTx;
  } catch (err) {
    console.error('Failed to load transactions:', err);
    return [];
  }
}

/**
 * Saves transactions to localStorage and IndexedDB.
 */
export function saveStoredTransactions(transactions: StockTransaction[]): void {
  try {
    const cleanTx = (transactions || []).filter((t) => !isDefaultLegacyTransaction(t));
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(cleanTx));
    saveTransactionsToIndexedDB(cleanTx);
  } catch (err) {
    console.error('Failed to save transactions:', err);
  }
}

/**
 * Loads Purchase Orders from localStorage.
 */
export function getStoredPurchaseOrders(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(PURCHASE_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PurchaseOrder[]) : [];
  } catch (err) {
    console.warn('Failed to load purchase orders from storage:', err);
    return [];
  }
}

/**
 * Saves Purchase Orders to localStorage.
 */
export function saveStoredPurchaseOrders(orders: PurchaseOrder[]): void {
  try {
    localStorage.setItem(PURCHASE_ORDERS_KEY, JSON.stringify(orders || []));
  } catch (err) {
    console.warn('Failed to save purchase orders to storage:', err);
  }
}

/**
 * Loads Surat Jalan delivery notes from localStorage.
 */
export function getStoredSuratJalan(): SuratJalan[] {
  try {
    const raw = localStorage.getItem(SURAT_JALAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SuratJalan[]) : [];
  } catch (err) {
    console.warn('Failed to load surat jalan from storage:', err);
    return [];
  }
}

/**
 * Saves Surat Jalan delivery notes to localStorage.
 */
export function saveStoredSuratJalan(notes: SuratJalan[]): void {
  try {
    localStorage.setItem(SURAT_JALAN_KEY, JSON.stringify(notes || []));
  } catch (err) {
    console.warn('Failed to save surat jalan to storage:', err);
  }
}

/**
 * Actively purges any legacy demo products and demo transactions from all client stores
 */
export function purgeLegacyStoredData(): void {
  try {
    // 1. Purge from localStorage
    const rawProd = localStorage.getItem(PRODUCTS_KEY);
    if (rawProd) {
      try {
        const parsed = JSON.parse(rawProd);
        if (Array.isArray(parsed)) {
          const clean = (parsed as Product[]).filter((p) => !isDefaultLegacyProduct(p));
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(clean));
        }
      } catch {
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify([]));
      }
    }

    const rawTx = localStorage.getItem(TRANSACTIONS_KEY);
    if (rawTx) {
      try {
        const parsed = JSON.parse(rawTx);
        if (Array.isArray(parsed)) {
          const clean = (parsed as StockTransaction[]).filter((t) => !isDefaultLegacyTransaction(t));
          localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(clean));
        }
      } catch {
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
      }
    }

    // 2. Purge from IndexedDB
    purgeLegacyFromIndexedDB().catch(() => {});
  } catch (err) {
    console.warn('purgeLegacyStoredData notice:', err);
  }
}

/**
 * Clears all inventory data to a pristine, clean slate (no demo items)
 */
export function resetAllData(): { products: Product[]; transactions: StockTransaction[] } {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify([]));
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([]));
  saveProductsToIndexedDB([]);
  saveTransactionsToIndexedDB([]);
  purgeLegacyFromIndexedDB().catch(() => {});
  return { products: [], transactions: [] };
}

export function exportTransactionsToCSV(transactions: StockTransaction[]): void {
  const headers = [
    'ID',
    'Waktu',
    'Tipe',
    'Nama Barang',
    'Barcode',
    'Jumlah',
    'Satuan',
    'Stok Sebelum',
    'Stok Sesudah',
    'PIC / Petugas',
    'Alasan Keluar',
    'No Surat Jalan',
    'Catatan',
  ];

  const rows = transactions.map((t) => [
    t.id,
    new Date(t.date).toLocaleString('id-ID'),
    t.type === 'IN' ? 'MASUK (IN)' : 'KELUAR (OUT)',
    `"${(t.productName || '').replace(/"/g, '""')}"`,
    `'${t.barcode}`,
    t.quantity,
    t.unit,
    t.previousStock,
    t.currentStock,
    `"${(t.pic || '').replace(/"/g, '""')}"`,
    `"${(t.outReason || '-').replace(/"/g, '""')}"`,
    `"${(t.referenceNo || '-').replace(/"/g, '""')}"`,
    `"${(t.notes || '-').replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `Momoyo_Ciledug_Mutasi_Stok_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
