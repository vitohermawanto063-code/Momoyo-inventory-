import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Product, StockTransaction, PurchaseOrder, SuratJalan, ActiveTab } from './types';
import {
  getStoredProducts,
  saveStoredProducts,
  getStoredTransactions,
  saveStoredTransactions,
  getStoredPurchaseOrders,
  saveStoredPurchaseOrders,
  getStoredSuratJalan,
  saveStoredSuratJalan,
  resetAllData,
  purgeLegacyStoredData,
} from './utils/storage';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getCachedAccessToken,
} from './services/googleAuth';
import {
  syncInventoryToGoogleSheets,
  sendToGoogleAppsScript,
  AppsScriptPayload,
} from './services/googleSheets';
import {
  subscribeToProducts,
  subscribeToTransactions,
  subscribeToPurchaseOrders,
  subscribeToSuratJalan,
  subscribeToStoreSettings,
  updateStockWithTransaction,
  saveProductToCloud,
  deleteProductFromCloud,
  savePurchaseOrderToCloud,
  deletePurchaseOrderFromCloud,
  saveSuratJalanToCloud,
  deleteSuratJalanFromCloud,
  batchSaveProductsToCloud,
  saveStoreSettingsToCloud,
  deleteTransactionFromCloud,
  batchDeleteTransactionsFromCloud,
  deleteTransactionWithStockReversion,
  batchRecordStockTransactions,
  purgeLegacyDataFromCloud,
} from './services/firestoreService';

import { Header } from './components/Header';
import { InventoryListView } from './components/InventoryListView';
import { StockInSlideView } from './components/StockInSlideView';
import { StockOutSlideView } from './components/StockOutSlideView';
import { SuratJalanView } from './components/SuratJalanView';
import { TransactionHistoryView } from './components/TransactionHistoryView';
import { CancelTransactionSlideView } from './components/CancelTransactionSlideView';
import { PurchaseOrderView } from './components/PurchaseOrderView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { StockInModal } from './components/StockInModal';
import { StockOutModal } from './components/StockOutModal';
import { ProductFormModal } from './components/ProductFormModal';
import { BulkAddProductsModal } from './components/BulkAddProductsModal';
import { BarcodePrintModal } from './components/BarcodePrintModal';
import { AllBarcodesPdfModal } from './components/AllBarcodesPdfModal';
import { ShareSheetsModal } from './components/ShareSheetsModal';
import { GoogleAppsScriptModal } from './components/GoogleAppsScriptModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const SPREADSHEET_ID_KEY = 'momoyo_sheets_spreadsheet_id_v1';
const LAST_SYNC_KEY = 'momoyo_sheets_last_sync_v1';
const SPREADSHEET_URL_KEY = 'momoyo_sheets_spreadsheet_url_v1';
const SPREADSHEET_PUBLIC_KEY = 'momoyo_sheets_is_public_v1';
const APPS_SCRIPT_URL_KEY = 'momoyo_apps_script_url_v1';
const AUTO_SYNC_ENABLED_KEY = 'momoyo_auto_sync_enabled_v1';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    return getStoredPurchaseOrders();
  });
  const [suratJalanList, setSuratJalanList] = useState<SuratJalan[]>(() => {
    return getStoredSuratJalan();
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('STOK');

  // Apps Script Web App URL & Auto-Sync state (Permanently cached & synchronized to Firestore)
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem(APPS_SCRIPT_URL_KEY) || '';
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem(AUTO_SYNC_ENABLED_KEY) !== 'false';
  });

  // Cloud & Multi-Device Synchronization state
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  // Google OAuth User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isPublicAccess, setIsPublicAccess] = useState<boolean>(true);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isStockInOpen, setIsStockInOpen] = useState<boolean>(false);
  const [isStockOutOpen, setIsStockOutOpen] = useState<boolean>(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState<boolean>(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isAllBarcodesPdfOpen, setIsAllBarcodesPdfOpen] = useState<boolean>(false);
  const [isShareSheetsOpen, setIsShareSheetsOpen] = useState<boolean>(false);
  const [isAppsScriptOpen, setIsAppsScriptOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Selected item context
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newBarcodeInitial, setNewBarcodeInitial] = useState<string>('');

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  useEffect(() => {
    // Proactively purge legacy demo items from client storage and Firestore
    purgeLegacyStoredData();
    purgeLegacyDataFromCloud().catch(() => {});

    // 1. Load initial cached data from local storage for instant render (clean of demo items)
    const loadedProducts = getStoredProducts();
    const loadedTransactions = getStoredTransactions();
    setProducts(loadedProducts || []);
    setTransactions(loadedTransactions || []);

    // 2. Load saved sheets metadata
    const savedUrl = localStorage.getItem(SPREADSHEET_URL_KEY);
    const savedTime = localStorage.getItem(LAST_SYNC_KEY);
    const savedPublic = localStorage.getItem(SPREADSHEET_PUBLIC_KEY);
    if (savedUrl) setSheetsUrl(savedUrl);
    if (savedTime) setLastSyncedTime(savedTime);
    if (savedPublic !== null) setIsPublicAccess(savedPublic === 'true');

    // 3. Real-time Multi-Device synchronization with Cloud Firestore
    const unsubProducts = subscribeToProducts(
      (cloudProducts) => {
        setProducts(cloudProducts || []);
        setIsCloudConnected(true);
      },
      (err) => {
        console.warn('Real-time products sync notice:', err);
        setIsCloudConnected(false);
      }
    );

    const unsubTransactions = subscribeToTransactions(
      (cloudTx) => {
        setTransactions(cloudTx);
        setIsCloudConnected(true);
      },
      (err) => {
        console.warn('Real-time transactions sync notice:', err);
      }
    );

    const unsubPOs = subscribeToPurchaseOrders(
      (cloudPOs) => {
        if (cloudPOs) {
          setPurchaseOrders(cloudPOs);
          saveStoredPurchaseOrders(cloudPOs);
        }
      },
      (err) => {
        console.warn('Real-time purchase orders sync notice:', err);
      }
    );

    const unsubSuratJalan = subscribeToSuratJalan(
      (cloudSJ) => {
        if (cloudSJ) {
          setSuratJalanList(cloudSJ);
          saveStoredSuratJalan(cloudSJ);
        }
      },
      (err) => {
        console.warn('Real-time surat jalan sync notice:', err);
      }
    );

    const unsubSettings = subscribeToStoreSettings((cloudSettings) => {
      if (cloudSettings.spreadsheetUrl) {
        setSheetsUrl(cloudSettings.spreadsheetUrl);
        localStorage.setItem(SPREADSHEET_URL_KEY, cloudSettings.spreadsheetUrl);
      }
      if (cloudSettings.spreadsheetId) {
        localStorage.setItem(SPREADSHEET_ID_KEY, cloudSettings.spreadsheetId);
      }
      if (cloudSettings.lastSynced) {
        setLastSyncedTime(cloudSettings.lastSynced);
        localStorage.setItem(LAST_SYNC_KEY, cloudSettings.lastSynced);
      }
      if (cloudSettings.isPublic !== undefined) {
        setIsPublicAccess(cloudSettings.isPublic);
        localStorage.setItem(SPREADSHEET_PUBLIC_KEY, String(cloudSettings.isPublic));
      }
      if (cloudSettings.appsScriptUrl) {
        setAppsScriptUrl(cloudSettings.appsScriptUrl);
        localStorage.setItem(APPS_SCRIPT_URL_KEY, cloudSettings.appsScriptUrl);
      }
      if (cloudSettings.autoSyncEnabled !== undefined) {
        setAutoSyncEnabled(cloudSettings.autoSyncEnabled);
        localStorage.setItem(AUTO_SYNC_ENABLED_KEY, String(cloudSettings.autoSyncEnabled));
      }
    });

    // 4. Listen to Firebase Auth
    const unsubAuth = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );

    return () => {
      unsubProducts();
      unsubTransactions();
      unsubPOs();
      unsubSuratJalan();
      unsubSettings();
      unsubAuth();
    };
  }, []);

  // Keyboard Shortcuts for Laptop/Desktop & Fullscreen Sync
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Alt + 1..6 for Tab Navigation on Laptop
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('STOK');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('MASUK');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('KELUAR');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('SURAT_JALAN');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('RIWAYAT');
        } else if (e.key === '6') {
          e.preventDefault();
          setActiveTab('PO');
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          setIsScannerOpen(true);
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          handleToggleFullscreen();
        }
      }

      // ? for shortcuts dialog
      if (e.key === '?' && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      showToast('Membuka autentikasi Google...', 'info');
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        showToast(`Berhasil login Google sebagai ${res.user.displayName || res.user.email}!`, 'success');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      showToast('Gagal login Google. Pastikan mengizinkan popup autentikasi.', 'warning');
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      setCurrentUser(null);
      setAccessToken(null);
      showToast('Berhasil keluar dari akun Google.', 'info');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Sync Data to Google Sheets
  const handleSyncGoogleSheets = async () => {
    let token = accessToken || getCachedAccessToken();
    if (!token || !currentUser) {
      try {
        const signResult = await googleSignIn();
        if (!signResult) return;
        token = signResult.accessToken;
        setCurrentUser(signResult.user);
        setAccessToken(signResult.accessToken);
      } catch (err) {
        showToast('Login Google diperlukan untuk sinkronisasi ke Google Sheets.', 'warning');
        return;
      }
    }

    try {
      setIsSyncingSheets(true);
      showToast('Menyinkronkan stok & surat jalan ke Google Sheets...', 'info');

      const existingSpreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY) || undefined;
      const result = await syncInventoryToGoogleSheets(
        token,
        products,
        transactions,
        existingSpreadsheetId
      );

      localStorage.setItem(SPREADSHEET_ID_KEY, result.spreadsheetId);
      localStorage.setItem(SPREADSHEET_URL_KEY, result.spreadsheetUrl);
      localStorage.setItem(LAST_SYNC_KEY, result.syncedAt);
      if (result.isPublic !== undefined) {
        localStorage.setItem(SPREADSHEET_PUBLIC_KEY, String(result.isPublic));
        setIsPublicAccess(result.isPublic);
      }

      setSheetsUrl(result.spreadsheetUrl);
      setLastSyncedTime(result.syncedAt);

      // Broadcast spreadsheet settings to all devices via Firestore
      await saveStoreSettingsToCloud({
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        lastSynced: result.syncedAt,
        isPublic: result.isPublic ?? true,
      });

      showToast(`Berhasil Sync ke Google Sheets! Akses publik aktif untuk siapapun yang memiliki link. (${result.inventoryRowsCount} barang, ${result.transactionRowsCount} surat jalan)`, 'success');
    } catch (err: unknown) {
      console.error('Sync failed:', err);
      const msg = err instanceof Error ? err.message : 'Gagal sinkronisasi';
      showToast(`Gagal sinkronisasi ke Google Sheets: ${msg}`, 'warning');
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Permanently save Apps Script URL and auto-sync setting to both Firestore & localStorage
  const handleSaveAppsScriptUrl = async (url: string, autoSync: boolean) => {
    setAppsScriptUrl(url);
    setAutoSyncEnabled(autoSync);
    localStorage.setItem(APPS_SCRIPT_URL_KEY, url);
    localStorage.setItem(AUTO_SYNC_ENABLED_KEY, String(autoSync));

    try {
      await saveStoreSettingsToCloud({
        appsScriptUrl: url,
        autoSyncEnabled: autoSync,
        spreadsheetId: localStorage.getItem(SPREADSHEET_ID_KEY) || undefined,
        spreadsheetUrl: sheetsUrl || undefined,
      });
      showToast('Konfigurasi Apps Script tersimpan permanen di APK & Cloud Firestore!', 'success');
    } catch (e) {
      console.warn('Could not save store settings to cloud:', e);
      showToast('Konfigurasi disimpan secara lokal di perangkat.', 'info');
    }
  };

  // Instant real-time update to Google Sheets via Apps Script Web App
  const triggerInstantGoogleSheetsUpdate = async (params: {
    action: 'TRANSACTION_COMPLETED' | 'BATCH_TRANSACTIONS' | 'CANCEL_TRANSACTION';
    transaction?: StockTransaction;
    transactions?: StockTransaction[];
    transactionId?: string;
    revertedProduct?: Product;
    products?: Product[];
  }) => {
    if (!autoSyncEnabled) return;

    const scriptUrl = appsScriptUrl || localStorage.getItem(APPS_SCRIPT_URL_KEY);
    if (!scriptUrl) return;

    try {
      const payload: AppsScriptPayload = {
        action: params.action,
        transaction: params.transaction,
        transactions: params.transactions,
        transactionId: params.transactionId,
        revertedProduct: params.revertedProduct,
        products: params.products || products,
        spreadsheetId: localStorage.getItem(SPREADSHEET_ID_KEY) || undefined,
      };

      await sendToGoogleAppsScript(scriptUrl, payload);
      showToast('⚡ Data langsung terupdate otomatis di Google Sheets!', 'success');
    } catch (err) {
      console.warn('Instant GS auto-update notice:', err);
    }
  };

  // Trigger Full Sync to Apps Script Web App
  const handleTriggerFullSync = async () => {
    const scriptUrl = appsScriptUrl || localStorage.getItem(APPS_SCRIPT_URL_KEY);
    if (!scriptUrl) {
      throw new Error('URL Google Apps Script belum diisi');
    }
    const res = await sendToGoogleAppsScript(scriptUrl, {
      action: 'FULL_SYNC',
      products,
      transactions,
      spreadsheetId: localStorage.getItem(SPREADSHEET_ID_KEY) || undefined,
    });
    showToast(res.message || 'Sinkronisasi penuh ke Google Sheets berhasil!', 'success');
  };

  // Single Stock IN Handler
  const handleConfirmStockIn = (txData: Omit<StockTransaction, 'id'>) => {
    const newTx: StockTransaction = {
      ...txData,
      id: `tx-${Date.now()}`,
    };

    let targetProduct: Product | undefined;
    const updatedProducts = products.map((p) => {
      if (p.id === txData.productId) {
        targetProduct = {
          ...p,
          currentStock: txData.currentStock,
          lastUpdated: txData.date,
        };
        return targetProduct;
      }
      return p;
    });

    const updatedTransactions = [newTx, ...transactions];

    setProducts(updatedProducts);
    setTransactions(updatedTransactions);
    saveStoredProducts(updatedProducts);
    saveStoredTransactions(updatedTransactions);

    // Multi-Device Cloud Real-time Persistence
    if (targetProduct) {
      updateStockWithTransaction(targetProduct, newTx).catch((err) => {
        console.warn('Real-time sync to cloud on Stock In:', err);
      });
    }

    // Auto-update to Google Sheets instantly
    triggerInstantGoogleSheetsUpdate({
      action: 'TRANSACTION_COMPLETED',
      transaction: newTx,
      products: updatedProducts,
    });

    const weightInfo = txData.totalWeightKg ? ` (${txData.totalWeightKg} Kg)` : '';
    const sjInfo = txData.referenceNo ? ` [SJ: ${txData.referenceNo}]` : '';
    showToast(`Berhasil Masuk: +${txData.quantity} ${txData.unit} ${txData.productName}${weightInfo}${sjInfo}`, 'success');
  };

  // Multi-Item Batch Stock IN Handler (Input Sekaligus Banyak Barang tanpa scan)
  const handleConfirmBatchStockIn = (txDataList: Array<Omit<StockTransaction, 'id'>>) => {
    if (txDataList.length === 0) return;

    const newTxs: StockTransaction[] = txDataList.map((txData, index) => ({
      ...txData,
      id: `tx-${Date.now()}-${index}`,
    }));

    const productUpdateMap = new Map<string, Product>();
    newTxs.forEach((tx) => {
      const prod = products.find((p) => p.id === tx.productId);
      if (prod) {
        productUpdateMap.set(prod.id, {
          ...prod,
          currentStock: tx.currentStock,
          lastUpdated: tx.date,
        });
      }
    });

    const updatedProducts = products.map((p) => productUpdateMap.get(p.id) || p);
    const updatedTransactions = [...newTxs, ...transactions];

    setProducts(updatedProducts);
    setTransactions(updatedTransactions);
    saveStoredProducts(updatedProducts);
    saveStoredTransactions(updatedTransactions);

    // Multi-Device Batch Cloud Persistence
    const batchUpdates = newTxs.map((tx) => {
      const prod = productUpdateMap.get(tx.productId) || products.find((p) => p.id === tx.productId)!;
      return { updatedProduct: prod, transaction: tx };
    });
    batchRecordStockTransactions(batchUpdates).catch((err) => {
      console.warn('Real-time sync to cloud on Batch Stock In:', err);
    });

    // Auto-update to Google Sheets instantly
    triggerInstantGoogleSheetsUpdate({
      action: 'BATCH_TRANSACTIONS',
      transactions: newTxs,
      products: updatedProducts,
    });

    const totalQty = txDataList.reduce((sum, t) => sum + t.quantity, 0);
    showToast(`Sukses Masuk: ${txDataList.length} jenis barang sekaligus (+${totalQty} unit) ke stok Momoyo!`, 'success');
  };

  // Stock OUT Handler
  const handleConfirmStockOut = (txData: Omit<StockTransaction, 'id'>) => {
    const newTx: StockTransaction = {
      ...txData,
      id: `tx-${Date.now()}`,
    };

    let targetProduct: Product | undefined;
    const updatedProducts = products.map((p) => {
      if (p.id === txData.productId) {
        targetProduct = {
          ...p,
          currentStock: txData.currentStock,
          lastUpdated: txData.date,
        };
        return targetProduct;
      }
      return p;
    });

    const updatedTransactions = [newTx, ...transactions];

    setProducts(updatedProducts);
    setTransactions(updatedTransactions);
    saveStoredProducts(updatedProducts);
    saveStoredTransactions(updatedTransactions);

    // Multi-Device Cloud Real-time Persistence
    if (targetProduct) {
      updateStockWithTransaction(targetProduct, newTx).catch((err) => {
        console.warn('Real-time sync to cloud on Stock Out:', err);
      });
    }

    // Auto-update to Google Sheets instantly
    triggerInstantGoogleSheetsUpdate({
      action: 'TRANSACTION_COMPLETED',
      transaction: newTx,
      products: updatedProducts,
    });

    showToast(`Berhasil Keluar: -${txData.quantity} ${txData.unit} ${txData.productName}`, 'warning');
  };

  // Product Save (Add or Edit)
  const handleSaveProduct = (productData: Product) => {
    const exists = products.some((p) => p.id === productData.id);
    let updatedProducts: Product[];

    if (exists) {
      updatedProducts = products.map((p) => (p.id === productData.id ? productData : p));
      showToast(`Data barang ${productData.name} berhasil diperbarui`, 'success');
    } else {
      updatedProducts = [productData, ...products];
      showToast(`Barang baru ${productData.name} berhasil ditambahkan ke Momoyo Ciledug`, 'success');
    }

    setProducts(updatedProducts);
    saveStoredProducts(updatedProducts);
    setEditingProduct(null);
    setNewBarcodeInitial('');

    // Multi-Device Cloud Real-time Persistence
    saveProductToCloud(productData).catch((err) => {
      console.warn('Real-time sync to cloud on Product Save:', err);
    });
  };

  // Delete Product
  const handleDeleteProduct = (productId: string) => {
    const target = products.find((p) => p.id === productId);
    const updatedProducts = products.filter((p) => p.id !== productId);
    setProducts(updatedProducts);
    saveStoredProducts(updatedProducts);

    // Multi-Device Cloud Real-time Persistence
    deleteProductFromCloud(productId).catch((err) => {
      console.warn('Real-time sync to cloud on Product Delete:', err);
    });
    showToast(`Barang ${target?.name || ''} telah dihapus`, 'info');
  };

  // Bulk Save Products (Add multiple products at once)
  const handleSaveBulkProducts = (newProductsList: Product[]) => {
    if (newProductsList.length === 0) return;

    // Merge: update existing if ID matches or append new
    const existingMap = new Map(products.map((p) => [p.id, p]));
    newProductsList.forEach((p) => existingMap.set(p.id, p));
    const updated = Array.from(existingMap.values());

    setProducts(updated);
    saveStoredProducts(updated);

    // Sync to cloud
    batchSaveProductsToCloud(newProductsList).catch((err) => {
      console.warn('Real-time sync to cloud on Bulk Save:', err);
    });

    showToast(`Berhasil menambahkan/memperbarui ${newProductsList.length} produk sekaligus ke inventaris!`, 'success');
    setIsBulkAddOpen(false);
  };

  // Delete Single Transaction (with optional stock reversion)
  const handleDeleteTransaction = async (txId: string, revertStock: boolean) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    let updatedProduct: Product | undefined;
    if (revertStock) {
      const product = products.find((p) => p.id === tx.productId);
      if (product) {
        // If transaction was IN, revert means decrease stock
        // If transaction was OUT, revert means restore stock
        const revertedStockCount =
          tx.type === 'IN'
            ? Math.max(0, product.currentStock - tx.quantity)
            : product.currentStock + tx.quantity;

        updatedProduct = {
          ...product,
          currentStock: revertedStockCount,
          lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        };

        const updatedProducts = products.map((p) =>
          p.id === updatedProduct!.id ? updatedProduct! : p
        );
        setProducts(updatedProducts);
        saveStoredProducts(updatedProducts);
      }
    }

    const updatedTransactions = transactions.filter((t) => t.id !== txId);
    setTransactions(updatedTransactions);
    saveStoredTransactions(updatedTransactions);

    try {
      await deleteTransactionWithStockReversion(txId, updatedProduct);
      
      // Auto-update deletion to Google Sheets instantly
      triggerInstantGoogleSheetsUpdate({
        action: 'CANCEL_TRANSACTION',
        transactionId: txId,
        revertedProduct: updatedProduct,
      });

      if (revertStock && updatedProduct) {
        showToast(
          `Transaksi "${tx.referenceNo || tx.productName}" berhasil dibatalkan! Stok ${tx.productName} dikembalikan menjadi ${updatedProduct.currentStock} ${tx.unit} (${tx.type === 'IN' ? `-${tx.quantity}` : `+${tx.quantity}`}).`,
          'success'
        );
      } else {
        showToast(
          `Catatan transaksi "${tx.referenceNo || tx.productName}" berhasil dihapus (stok barang di gudang tetap).`,
          'info'
        );
      }
    } catch (err) {
      console.error('Delete transaction cloud sync error:', err);
      showToast('Transaksi dihapus secara lokal, sinkronisasi cloud tertunda', 'warning');
    }
  };

  // Batch Delete Transactions (with optional stock reversion)
  const handleBatchDeleteTransactions = async (txIds: string[], revertStock: boolean) => {
    if (txIds.length === 0) return;

    const targetTxs = transactions.filter((t) => txIds.includes(t.id));
    let updatedProductsList = [...products];

    if (revertStock) {
      const stockChangeMap = new Map<string, number>();
      targetTxs.forEach((tx) => {
        const delta = tx.type === 'IN' ? -tx.quantity : tx.quantity;
        stockChangeMap.set(tx.productId, (stockChangeMap.get(tx.productId) || 0) + delta);
      });

      const changedProducts: Product[] = [];
      updatedProductsList = updatedProductsList.map((p) => {
        if (stockChangeMap.has(p.id)) {
          const delta = stockChangeMap.get(p.id)!;
          const newStock = Math.max(0, p.currentStock + delta);
          const up = {
            ...p,
            currentStock: newStock,
            lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
          };
          changedProducts.push(up);
          return up;
        }
        return p;
      });

      setProducts(updatedProductsList);
      saveStoredProducts(updatedProductsList);

      if (changedProducts.length > 0) {
        batchSaveProductsToCloud(changedProducts).catch(console.warn);
      }
    }

    const updatedTransactions = transactions.filter((t) => !txIds.includes(t.id));
    setTransactions(updatedTransactions);
    saveStoredTransactions(updatedTransactions);

    try {
      await batchDeleteTransactionsFromCloud(txIds);

      // Auto-update batch cancellations to Google Sheets
      txIds.forEach((id) => {
        triggerInstantGoogleSheetsUpdate({
          action: 'CANCEL_TRANSACTION',
          transactionId: id,
        });
      });

      if (revertStock) {
        showToast(
          `${txIds.length} transaksi berhasil dihapus & stok gudang otomatis disesuaikan kembali!`,
          'success'
        );
      } else {
        showToast(
          `${txIds.length} catatan riwayat transaksi berhasil dibersihkan (stok gudang tetap).`,
          'info'
        );
      }
    } catch (err) {
      console.error('Batch delete transactions error:', err);
      showToast('Transaksi dihapus secara lokal', 'warning');
    }
  };

  // Reset all data to clean slate (no demo items)
  const handleResetData = async () => {
    resetAllData();
    setProducts([]);
    setTransactions([]);
    setPurchaseOrders([]);
    saveStoredPurchaseOrders([]);

    // Clear legacy from cloud
    await purgeLegacyDataFromCloud();
    showToast('Semua data inventaris & riwayat transaksi berhasil dikosongkan.', 'info');
  };

  // Save or Update Purchase Order
  const handleSavePO = (po: PurchaseOrder) => {
    setPurchaseOrders((prev) => {
      const idx = prev.findIndex((p) => p.id === po.id);
      let next: PurchaseOrder[];
      if (idx >= 0) {
        next = prev.map((item, i) => (i === idx ? po : item));
      } else {
        next = [po, ...prev];
      }
      saveStoredPurchaseOrders(next);
      return next;
    });

    savePurchaseOrderToCloud(po).catch((err) => {
      console.warn('Real-time sync to cloud on Save PO:', err);
    });
  };

  // Delete Purchase Order
  const handleDeletePO = (poId: string) => {
    setPurchaseOrders((prev) => {
      const next = prev.filter((p) => p.id !== poId);
      saveStoredPurchaseOrders(next);
      return next;
    });

    deletePurchaseOrderFromCloud(poId).catch((err) => {
      console.warn('Real-time sync to cloud on Delete PO:', err);
    });
  };

  // Save or Update Surat Jalan (Pencatatan Dokumen, Berat, Qty & Foto - Tidak Mengubah Stok)
  const handleSaveSuratJalan = (sj: SuratJalan) => {
    setSuratJalanList((prev) => {
      const idx = prev.findIndex((s) => s.id === sj.id);
      let next: SuratJalan[];
      if (idx >= 0) {
        next = prev.map((item, i) => (i === idx ? sj : item));
      } else {
        next = [sj, ...prev];
      }
      saveStoredSuratJalan(next);
      return next;
    });

    saveSuratJalanToCloud(sj).catch((err) => {
      console.warn('Real-time sync to cloud on Save Surat Jalan:', err);
    });
  };

  // Delete Surat Jalan Document from Archive
  const handleDeleteSuratJalan = (sjId: string) => {
    setSuratJalanList((prev) => {
      const next = prev.filter((s) => s.id !== sjId);
      saveStoredSuratJalan(next);
      return next;
    });

    deleteSuratJalanFromCloud(sjId).catch((err) => {
      console.warn('Real-time sync to cloud on Delete Surat Jalan:', err);
    });
  };

  // Inbound: Receive PO items directly into inventory stock ("untuk menambahkan barang")
  const handleReceivePOIntoStock = (po: PurchaseOrder) => {
    if (po.items.length === 0) return;

    const nowIso = new Date().toISOString();
    const txDataList: Array<Omit<StockTransaction, 'id'>> = [];

    for (const item of po.items) {
      // Match product by id or barcode or name
      let prod = products.find((p) => p.id === item.productId || p.barcode === item.barcode);
      if (!prod) {
        prod = products.find((p) => p.name.toLowerCase() === item.productName.toLowerCase());
      }

      if (prod) {
        const prev = Number(prod.currentStock) || 0;
        const qty = Math.max(1, Math.round(Number(item.orderQty) || 1));
        const curr = prev + qty;
        const unitWeight = item.weightPerUnitKg || prod.weightPerUnitKg;
        const totalWeight = unitWeight ? Math.round(unitWeight * qty) : undefined;

        txDataList.push({
          productId: prod.id,
          productName: prod.name,
          barcode: prod.barcode,
          type: 'IN',
          quantity: qty,
          unit: prod.unit,
          previousStock: prev,
          currentStock: curr,
          date: nowIso,
          pic: po.pic || 'Staff Penerimaan Momoyo',
          referenceNo: po.poNumber,
          senderCourier: po.supplierName || 'Gudang Pusat Momoyo',
          notes: `Penerimaan Restock dari PO: ${po.poNumber}${item.notes ? ` (${item.notes})` : ''}`,
          ...(totalWeight && totalWeight > 0 ? { totalWeightKg: totalWeight } : {}),
        });
      }
    }

    if (txDataList.length > 0) {
      handleConfirmBatchStockIn(txDataList);
    }

    // Mark PO as DITERIMA
    const updatedPo: PurchaseOrder = {
      ...po,
      status: 'DITERIMA',
      receivedAt: nowIso,
      updatedAt: nowIso,
    };

    handleSavePO(updatedPo);
  };

  // Modal open helpers
  const handleOpenStockIn = (product?: Product) => {
    setSelectedProduct(product || products[0] || null);
    setIsStockInOpen(true);
  };

  const handleOpenStockOut = (product?: Product) => {
    setSelectedProduct(product || products[0] || null);
    setIsStockOutOpen(true);
  };

  const handleAddNewFromScanner = (barcode: string) => {
    setEditingProduct(null);
    setNewBarcodeInitial(barcode);
    setIsProductFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewBarcodeInitial('');
    setIsProductFormOpen(true);
  };

  const handlePrintBarcode = (product: Product) => {
    setSelectedProduct(product);
    setIsPrintModalOpen(true);
  };

  const criticalCount = products.filter((p) => p.currentStock <= p.minStock).length;
  const pendingPoCount = purchaseOrders.filter((po) => po.status !== 'DITERIMA').length;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col pb-20 md:pb-8 selection:bg-red-500 selection:text-white">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          id="toast-notification"
          className="fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl transition-all animate-fade-in max-w-md"
          style={{
            backgroundColor:
              toast.type === 'success' ? '#059669' : toast.type === 'warning' ? '#d97706' : '#2563eb',
          }}
        >
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {toast.type === 'warning' && <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.type === 'info' && <Info className="h-4 w-4 shrink-0" />}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenStockIn={() => setActiveTab('MASUK')}
        onOpenStockOut={() => setActiveTab('KELUAR')}
        onResetData={handleResetData}
        totalProductsCount={products.length}
        criticalProductsCount={criticalCount}
        totalTransactionsCount={transactions.length}
        totalPendingPoCount={pendingPoCount}
        totalSuratJalanCount={suratJalanList.length}
        user={currentUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onSyncSheets={handleSyncGoogleSheets}
        isSyncing={isSyncingSheets}
        sheetsUrl={sheetsUrl}
        onOpenShareSheets={() => setIsShareSheetsOpen(true)}
        onOpenAllBarcodesPdf={() => setIsAllBarcodesPdfOpen(true)}
        onOpenAppsScript={() => setIsAppsScriptOpen(true)}
        isCloudConnected={isCloudConnected}
        appsScriptUrl={appsScriptUrl}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Body Content - Separate Slides for Simplicity with Comfortable HP Bottom Padding */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 pb-28 sm:pb-8">
        {activeTab === 'STOK' && (
          <InventoryListView
            products={products}
            transactions={transactions}
            onOpenStockIn={(prod) => {
              if (prod) {
                handleOpenStockIn(prod);
              } else {
                setActiveTab('MASUK');
              }
            }}
            onOpenStockOut={(prod) => {
              if (prod) {
                handleOpenStockOut(prod);
              } else {
                setActiveTab('KELUAR');
              }
            }}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onPrintBarcode={handlePrintBarcode}
            onAddNewProduct={() => {
              setEditingProduct(null);
              setNewBarcodeInitial('');
              setIsProductFormOpen(true);
            }}
            onOpenBulkAdd={() => setIsBulkAddOpen(true)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenAllBarcodesPdf={() => setIsAllBarcodesPdfOpen(true)}
            onOpenAutoPo={() => setActiveTab('PO')}
          />
        )}

        {/* Slide 2: Menu Barang Masuk (IN) - Scan Barcode, Surat Jalan & Input Sekaligus Banyak Barang */}
        {activeTab === 'MASUK' && (
          <StockInSlideView
            products={products}
            recentTransactions={transactions}
            purchaseOrders={purchaseOrders}
            onConfirmStockIn={handleConfirmStockIn}
            onConfirmBatchStockIn={handleConfirmBatchStockIn}
            onOpenScanner={() => setIsScannerOpen(true)}
            onGoToPoTab={() => setActiveTab('PO')}
            onGoToSuratJalan={() => setActiveTab('SURAT_JALAN')}
          />
        )}

        {/* Slide 3: Menu Barang Keluar (OUT) - Scan Barcode & Manual */}
        {activeTab === 'KELUAR' && (
          <StockOutSlideView
            products={products}
            recentTransactions={transactions}
            onConfirmStockOut={handleConfirmStockOut}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {/* Slide: Pencatatan Surat Jalan (Non-Stok: Berat, Qty & Upload Foto) */}
        {activeTab === 'SURAT_JALAN' && (
          <SuratJalanView
            products={products}
            suratJalanList={suratJalanList}
            onSaveSuratJalan={handleSaveSuratJalan}
            onDeleteSuratJalan={handleDeleteSuratJalan}
          />
        )}

        {/* Slide 4: Surat Jalan & Log Mutasi */}
        {activeTab === 'RIWAYAT' && (
          <TransactionHistoryView
            products={products}
            transactions={transactions}
            onOpenStockIn={() => setActiveTab('MASUK')}
            onOpenStockOut={() => setActiveTab('KELUAR')}
            onDeleteTransaction={handleDeleteTransaction}
            onBatchDeleteTransactions={handleBatchDeleteTransactions}
            onSyncGoogleSheets={handleSyncGoogleSheets}
            isSyncingSheets={isSyncingSheets}
            sheetsUrl={sheetsUrl}
            lastSyncedTime={lastSyncedTime}
            onOpenShareSheets={() => setIsShareSheetsOpen(true)}
          />
        )}

        {/* Slide: Purchase Order (PO) Otomatis & Kirim via WhatsApp */}
        {activeTab === 'PO' && (
          <PurchaseOrderView
            products={products}
            purchaseOrders={purchaseOrders}
            onSavePO={handleSavePO}
            onDeletePO={handleDeletePO}
            onReceivePOIntoStock={handleReceivePOIntoStock}
            onGoToStockIn={() => setActiveTab('MASUK')}
          />
        )}

        {/* Slide 5: Slide Khusus Terpisah Hapus & Batalkan Transaksi */}
        {activeTab === 'BATAL' && (
          <CancelTransactionSlideView
            transactions={transactions}
            products={products}
            onDeleteTransaction={handleDeleteTransaction}
            onBatchDeleteTransactions={handleBatchDeleteTransactions}
            onNavigateToStock={() => setActiveTab('STOK')}
          />
        )}
      </main>

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onSelectProductForIn={(prod) => {
          setSelectedProduct(prod);
          setIsStockInOpen(true);
        }}
        onSelectProductForOut={(prod) => {
          setSelectedProduct(prod);
          setIsStockOutOpen(true);
        }}
        onAddNewWithBarcode={(code) => handleAddNewFromScanner(code)}
        onSelectProductDetails={(prod) => handleEditProduct(prod)}
      />

      <StockInModal
        isOpen={isStockInOpen}
        onClose={() => setIsStockInOpen(false)}
        products={products}
        selectedProduct={selectedProduct}
        onConfirmStockIn={handleConfirmStockIn}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      <StockOutModal
        isOpen={isStockOutOpen}
        onClose={() => setIsStockOutOpen(false)}
        products={products}
        selectedProduct={selectedProduct}
        onConfirmStockOut={handleConfirmStockOut}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => {
          setIsProductFormOpen(false);
          setEditingProduct(null);
          setNewBarcodeInitial('');
        }}
        productToEdit={editingProduct}
        initialBarcode={newBarcodeInitial}
        onSaveProduct={handleSaveProduct}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      <BulkAddProductsModal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        onSaveBulk={handleSaveBulkProducts}
        existingProducts={products}
      />

      <BarcodePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        products={products}
      />

      <AllBarcodesPdfModal
        isOpen={isAllBarcodesPdfOpen}
        onClose={() => setIsAllBarcodesPdfOpen(false)}
        products={products}
      />

      <ShareSheetsModal
        isOpen={isShareSheetsOpen}
        onClose={() => setIsShareSheetsOpen(false)}
        spreadsheetUrl={sheetsUrl}
        spreadsheetId={localStorage.getItem(SPREADSHEET_ID_KEY)}
        accessToken={accessToken}
        isPublicAccess={isPublicAccess}
        onAccessUpdated={(isPublic) => {
          setIsPublicAccess(isPublic);
          localStorage.setItem(SPREADSHEET_PUBLIC_KEY, String(isPublic));
          showToast(
            isPublic
              ? 'Izin spreadsheet berhasil diatur: Siapapun dengan link sekarang bisa mengakses!'
              : 'Izin spreadsheet diperbarui.',
            'success'
          );
        }}
        onOpenAppsScript={() => setIsAppsScriptOpen(true)}
      />

      {/* Google Apps Script Modal */}
      <GoogleAppsScriptModal
        isOpen={isAppsScriptOpen}
        onClose={() => setIsAppsScriptOpen(false)}
        sheetsUrl={sheetsUrl}
        appsScriptUrl={appsScriptUrl}
        onSaveAppsScriptUrl={handleSaveAppsScriptUrl}
        autoSyncEnabled={autoSyncEnabled}
        products={products}
        transactions={transactions}
        onTriggerFullSync={handleTriggerFullSync}
      />

      {/* Laptop & Desktop Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* HP Smartphone Ergonomic Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenStockIn={() => setActiveTab('MASUK')}
        onOpenStockOut={() => setActiveTab('KELUAR')}
        pendingPoCount={pendingPoCount}
        totalSuratJalanCount={suratJalanList.length}
      />
    </div>
  );
}
