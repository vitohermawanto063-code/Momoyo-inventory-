import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, StockTransaction, PurchaseOrder, SuratJalan } from '../types';
import {
  INITIAL_PRODUCTS,
  isDefaultLegacyProduct,
  isDefaultLegacyTransaction,
  LEGACY_DEFAULT_PRODUCT_IDS,
  LEGACY_DEFAULT_TX_IDS,
} from '../data/momoyoInitialData';
import { auth } from './googleAuth';

// Initialize Firebase App & Firestore
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const PRODUCTS_COLLECTION = 'products';
const TRANSACTIONS_COLLECTION = 'transactions';
const PURCHASE_ORDERS_COLLECTION = 'purchase_orders';
const SURAT_JALAN_COLLECTION = 'surat_jalan';
const SETTINGS_COLLECTION = 'settings';
const STORE_SETTINGS_DOC = 'momoyo_store_config';

// Local storage backup keys
const PRODUCTS_KEY = 'momoyo_ciledug_inventory_products_v1';
const TRANSACTIONS_KEY = 'momoyo_ciledug_inventory_transactions_v1';
const PURCHASE_ORDERS_KEY = 'momoyo_ciledug_inventory_pos_v1';
const SURAT_JALAN_KEY = 'momoyo_ciledug_inventory_surat_jalan_v1';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on boot
 */
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Kick off connection test
testConnection();

/**
 * Seeding initial demo products is permanently disabled.
 * Only user-inputted products will be displayed and persisted.
 */
export async function seedInitialDataIfEmpty(): Promise<boolean> {
  return false;
}

/**
 * Permanently deletes legacy 16 demo products and demo transactions from Firestore.
 * Ensures they never appear on any device even after cloud synchronization.
 */
export async function purgeLegacyDataFromCloud(): Promise<void> {
  try {
    const batch = writeBatch(db);
    let hasDeletes = false;

    for (const legacyId of LEGACY_DEFAULT_PRODUCT_IDS) {
      batch.delete(doc(db, PRODUCTS_COLLECTION, legacyId));
      hasDeletes = true;
    }
    for (const legacyTxId of LEGACY_DEFAULT_TX_IDS) {
      batch.delete(doc(db, TRANSACTIONS_COLLECTION, legacyTxId));
      hasDeletes = true;
    }

    if (hasDeletes) {
      await batch.commit();
      console.log('Purged legacy demo data from Cloud Firestore');
    }
  } catch (err) {
    console.warn('purgeLegacyDataFromCloud notice:', err);
  }
}

/**
 * Subscribes to real-time product updates across all devices.
 * Automatically filters out and cleans up any legacy demo products.
 */
export function subscribeToProducts(
  onUpdate: (products: Product[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, PRODUCTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const productsList: Product[] = [];
        const legacyDocsToDelete: string[] = [];

        snapshot.forEach((d) => {
          const item = d.data() as Product;
          if (isDefaultLegacyProduct(item) || isDefaultLegacyProduct({ id: d.id })) {
            legacyDocsToDelete.push(d.id);
          } else {
            productsList.push(item);
          }
        });

        // If legacy items are found in Firestore, clean them up
        if (legacyDocsToDelete.length > 0) {
          const batch = writeBatch(db);
          for (const docId of legacyDocsToDelete) {
            batch.delete(doc(db, PRODUCTS_COLLECTION, docId));
          }
          batch.commit().catch((err) => console.warn('Legacy delete notice:', err));
        }

        // Sort alphabetically by category then name
        productsList.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

        // Cache locally for offline availability (dual layer)
        try {
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(productsList));
        } catch {
          // ignore quota
        }
        import('../utils/indexedDbBackup').then((m) => m.saveProductsToIndexedDB(productsList)).catch(() => {});

        onUpdate(productsList);
      } else {
        // Empty inventory - only show what user has inputted
        onUpdate([]);
      }
    },
    (err) => {
      console.error('Real-time products subscription error:', err);
      if (onError) onError(err);
      try {
        handleFirestoreError(err, OperationType.LIST, PRODUCTS_COLLECTION);
      } catch {
        // Error logged
      }
    }
  );
}

/**
 * Subscribes to real-time transaction updates across all devices.
 * Filters out legacy demo transactions.
 */
export function subscribeToTransactions(
  onUpdate: (transactions: StockTransaction[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, TRANSACTIONS_COLLECTION);
  const q = query(colRef, orderBy('date', 'desc'), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const txList: StockTransaction[] = [];
      const legacyTxToDelete: string[] = [];

      snapshot.forEach((d) => {
        const item = d.data() as StockTransaction;
        if (isDefaultLegacyTransaction(item) || isDefaultLegacyTransaction({ id: d.id })) {
          legacyTxToDelete.push(d.id);
        } else {
          txList.push(item);
        }
      });

      if (legacyTxToDelete.length > 0) {
        const batch = writeBatch(db);
        for (const docId of legacyTxToDelete) {
          batch.delete(doc(db, TRANSACTIONS_COLLECTION, docId));
        }
        batch.commit().catch((err) => console.warn('Legacy tx delete notice:', err));
      }

      // Cache locally
      try {
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txList));
      } catch {
        // ignore
      }
      import('../utils/indexedDbBackup').then((m) => m.saveTransactionsToIndexedDB(txList)).catch(() => {});

      onUpdate(txList);
    },
    (err) => {
      console.error('Real-time transactions subscription error:', err);
      if (onError) onError(err);
      try {
        handleFirestoreError(err, OperationType.LIST, TRANSACTIONS_COLLECTION);
      } catch {
        // Error logged
      }
    }
  );
}

/**
 * Recursively cleans an object by removing any properties with value `undefined`.
 * Firestore throws a fatal error if setDoc or batch.set receives any field with value `undefined`.
 */
export function cleanDataForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanDataForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = cleanDataForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

/**
 * Saves or updates a product in Firestore (instantly syncing to all devices).
 */
export async function saveProductToCloud(product: Product): Promise<void> {
  const ref = doc(db, PRODUCTS_COLLECTION, product.id);
  try {
    const sanitized = cleanDataForFirestore(product);
    await setDoc(ref, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PRODUCTS_COLLECTION}/${product.id}`);
  }
}

/**
 * Deletes a product from Firestore (instantly syncing to all devices).
 */
export async function deleteProductFromCloud(productId: string): Promise<void> {
  const ref = doc(db, PRODUCTS_COLLECTION, productId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${productId}`);
  }
}

/**
 * Deletes a stock transaction from Firestore (instantly syncing across devices).
 */
export async function deleteTransactionFromCloud(transactionId: string): Promise<void> {
  const ref = doc(db, TRANSACTIONS_COLLECTION, transactionId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${TRANSACTIONS_COLLECTION}/${transactionId}`);
  }
}

/**
 * Deletes multiple stock transactions in batch from Firestore.
 */
export async function batchDeleteTransactionsFromCloud(transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const txId of transactionIds) {
      const ref = doc(db, TRANSACTIONS_COLLECTION, txId);
      batch.delete(ref);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, TRANSACTIONS_COLLECTION);
  }
}

/**
 * Deletes a transaction and optionally updates the product's stock back to previous level.
 */
export async function deleteTransactionWithStockReversion(
  transactionId: string,
  revertedProduct?: Product
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const txRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    batch.delete(txRef);

    if (revertedProduct) {
      const prodRef = doc(db, PRODUCTS_COLLECTION, revertedProduct.id);
      batch.set(prodRef, cleanDataForFirestore(revertedProduct), { merge: true });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${TRANSACTIONS_COLLECTION}/${transactionId}`);
  }
}

/**
 * Records a stock transaction in Firestore (instantly syncing to all devices).
 */
export async function recordTransactionToCloud(tx: StockTransaction): Promise<void> {
  const ref = doc(db, TRANSACTIONS_COLLECTION, tx.id);
  try {
    const sanitized = cleanDataForFirestore(tx);
    await setDoc(ref, sanitized);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${TRANSACTIONS_COLLECTION}/${tx.id}`);
  }
}

/**
 * Atomically updates product stock and logs transaction in Firestore.
 */
export async function updateStockWithTransaction(
  updatedProduct: Product,
  transaction: StockTransaction
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const prodRef = doc(db, PRODUCTS_COLLECTION, updatedProduct.id);
    const txRef = doc(db, TRANSACTIONS_COLLECTION, transaction.id);

    batch.set(prodRef, cleanDataForFirestore(updatedProduct), { merge: true });
    batch.set(txRef, cleanDataForFirestore(transaction));

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PRODUCTS_COLLECTION}/${updatedProduct.id}`);
  }
}

/**
 * Atomically records multiple stock transactions and updates their product stocks in Firestore in a single batch.
 */
export async function batchRecordStockTransactions(
  updates: Array<{ updatedProduct: Product; transaction: StockTransaction }>
): Promise<void> {
  if (updates.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const item of updates) {
      const prodRef = doc(db, PRODUCTS_COLLECTION, item.updatedProduct.id);
      const txRef = doc(db, TRANSACTIONS_COLLECTION, item.transaction.id);
      batch.set(prodRef, cleanDataForFirestore(item.updatedProduct), { merge: true });
      batch.set(txRef, cleanDataForFirestore(item.transaction));
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batchRecordStockTransactions');
  }
}

/**
 * Batch import products into Firestore (for CSV or initial restore), excluding legacy items.
 */
export async function batchSaveProductsToCloud(products: Product[]): Promise<void> {
  const validProducts = (products || []).filter((p) => !isDefaultLegacyProduct(p));
  if (validProducts.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const p of validProducts) {
      const ref = doc(db, PRODUCTS_COLLECTION, p.id);
      batch.set(ref, cleanDataForFirestore(p), { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PRODUCTS_COLLECTION);
  }
}

export interface StoreSettings {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSynced?: string;
  isPublic?: boolean;
  appsScriptUrl?: string;
  autoSyncEnabled?: boolean;
}

/**
 * Syncs store Google Sheets and Apps Script configuration to Firestore so all devices share the same configuration.
 */
export async function saveStoreSettingsToCloud(settings: Partial<StoreSettings>): Promise<void> {
  try {
    const ref = doc(db, SETTINGS_COLLECTION, STORE_SETTINGS_DOC);
    await setDoc(ref, cleanDataForFirestore(settings), { merge: true });
  } catch (err) {
    console.warn('Could not save store settings to cloud:', err);
  }
}

/**
 * Listens for store Google Sheets and Apps Script configuration changes across devices.
 */
export function subscribeToStoreSettings(
  onUpdate: (settings: StoreSettings) => void
): () => void {
  const ref = doc(db, SETTINGS_COLLECTION, STORE_SETTINGS_DOC);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as StoreSettings);
      }
    },
    (err) => {
      console.warn('Settings subscription notice:', err);
      try {
        handleFirestoreError(err, OperationType.GET, `${SETTINGS_COLLECTION}/${STORE_SETTINGS_DOC}`);
      } catch {
        // Error logged
      }
    }
  );
}

/**
 * Subscribes to real-time Purchase Order updates across all devices.
 */
export function subscribeToPurchaseOrders(
  onUpdate: (orders: PurchaseOrder[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, PURCHASE_ORDERS_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const ordersList: PurchaseOrder[] = [];
      snapshot.forEach((d) => {
        ordersList.push(d.data() as PurchaseOrder);
      });

      // Cache locally
      try {
        localStorage.setItem(PURCHASE_ORDERS_KEY, JSON.stringify(ordersList));
      } catch {
        // ignore quota
      }

      onUpdate(ordersList);
    },
    (err) => {
      console.warn('Real-time purchase orders subscription notice:', err);
      if (onError) onError(err);
      try {
        handleFirestoreError(err, OperationType.LIST, PURCHASE_ORDERS_COLLECTION);
      } catch {
        // Error logged
      }
    }
  );
}

/**
 * Saves or updates a Purchase Order in Firestore (instantly syncing to all devices).
 */
export async function savePurchaseOrderToCloud(po: PurchaseOrder): Promise<void> {
  const ref = doc(db, PURCHASE_ORDERS_COLLECTION, po.id);
  try {
    const sanitized = cleanDataForFirestore(po);
    await setDoc(ref, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PURCHASE_ORDERS_COLLECTION}/${po.id}`);
  }
}

/**
 * Deletes a Purchase Order from Firestore.
 */
export async function deletePurchaseOrderFromCloud(poId: string): Promise<void> {
  const ref = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PURCHASE_ORDERS_COLLECTION}/${poId}`);
  }
}

/**
 * Batch saves multiple purchase orders to Firestore.
 */
export async function batchSavePurchaseOrdersToCloud(orders: PurchaseOrder[]): Promise<void> {
  if (orders.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const po of orders) {
      const ref = doc(db, PURCHASE_ORDERS_COLLECTION, po.id);
      batch.set(ref, cleanDataForFirestore(po), { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PURCHASE_ORDERS_COLLECTION);
  }
}

/**
 * Subscribes to real-time Surat Jalan delivery note updates across all devices.
 */
export function subscribeToSuratJalan(
  onUpdate: (notes: SuratJalan[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, SURAT_JALAN_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const sjList: SuratJalan[] = [];
      snapshot.forEach((d) => {
        sjList.push(d.data() as SuratJalan);
      });

      // Cache locally
      try {
        localStorage.setItem(SURAT_JALAN_KEY, JSON.stringify(sjList));
      } catch {
        // ignore quota
      }

      onUpdate(sjList);
    },
    (err) => {
      console.warn('Real-time surat jalan subscription notice:', err);
      if (onError) onError(err);
      try {
        handleFirestoreError(err, OperationType.LIST, SURAT_JALAN_COLLECTION);
      } catch {
        // Error logged
      }
    }
  );
}

/**
 * Saves or updates a Surat Jalan document in Firestore (instantly syncing to all devices).
 */
export async function saveSuratJalanToCloud(sj: SuratJalan): Promise<void> {
  const ref = doc(db, SURAT_JALAN_COLLECTION, sj.id);
  try {
    const sanitized = cleanDataForFirestore(sj);
    await setDoc(ref, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SURAT_JALAN_COLLECTION}/${sj.id}`);
  }
}

/**
 * Deletes a Surat Jalan document from Firestore.
 */
export async function deleteSuratJalanFromCloud(sjId: string): Promise<void> {
  const ref = doc(db, SURAT_JALAN_COLLECTION, sjId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${SURAT_JALAN_COLLECTION}/${sjId}`);
  }
}


