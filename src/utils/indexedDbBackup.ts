import { Product, StockTransaction } from '../types';
import {
  isDefaultLegacyProduct,
  isDefaultLegacyTransaction,
  LEGACY_DEFAULT_PRODUCT_IDS,
  LEGACY_DEFAULT_TX_IDS,
} from '../data/momoyoInitialData';

const DB_NAME = 'MomoyoCiledugPersistentVault';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'permanent_products';
const STORE_TRANSACTIONS = 'permanent_transactions';
const STORE_METADATA = 'permanent_meta';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves all user-inputted products to local IndexedDB, strictly excluding any legacy demo items.
 */
export async function saveProductsToIndexedDB(products: Product[]): Promise<void> {
  try {
    const validProducts = (products || []).filter((p) => !isDefaultLegacyProduct(p));
    const db = await openDatabase();
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);

    // Clear old snapshot and write only non-legacy user inputted items
    store.clear();
    for (const p of validProducts) {
      store.put(p);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveProducts warning:', err);
  }
}

/**
 * Saves transactions to IndexedDB, strictly excluding any legacy demo transactions.
 */
export async function saveTransactionsToIndexedDB(transactions: StockTransaction[]): Promise<void> {
  try {
    const validTransactions = (transactions || []).filter((t) => !isDefaultLegacyTransaction(t));
    const db = await openDatabase();
    const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_TRANSACTIONS);

    store.clear();
    for (const t of validTransactions) {
      store.put(t);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveTransactions warning:', err);
  }
}

/**
 * Loads products from IndexedDB, ensuring no legacy demo items are ever returned.
 */
export async function loadProductsFromIndexedDB(): Promise<Product[] | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const rawResult = (request.result as Product[]) || [];
        const cleanResult = rawResult.filter((p) => !isDefaultLegacyProduct(p));
        // If there were legacy items in IDB, clean them up in background
        if (rawResult.length !== cleanResult.length) {
          purgeLegacyFromIndexedDB().catch(() => {});
        }
        resolve(cleanResult && cleanResult.length > 0 ? cleanResult : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Loads transactions from IndexedDB, ensuring no legacy demo items are returned.
 */
export async function loadTransactionsFromIndexedDB(): Promise<StockTransaction[] | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const rawResult = (request.result as StockTransaction[]) || [];
        const cleanResult = rawResult.filter((t) => !isDefaultLegacyTransaction(t));
        if (cleanResult && cleanResult.length > 0) {
          cleanResult.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          resolve(cleanResult);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Completely purges legacy demo data from IndexedDB
 */
export async function purgeLegacyFromIndexedDB(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_PRODUCTS, STORE_TRANSACTIONS], 'readwrite');
    const prodStore = tx.objectStore(STORE_PRODUCTS);
    const txStore = tx.objectStore(STORE_TRANSACTIONS);

    for (const legacyId of LEGACY_DEFAULT_PRODUCT_IDS) {
      prodStore.delete(legacyId);
    }
    for (const legacyTxId of LEGACY_DEFAULT_TX_IDS) {
      txStore.delete(legacyTxId);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('purgeLegacyFromIndexedDB warning:', err);
  }
}
