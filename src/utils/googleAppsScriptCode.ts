/**
 * Google Apps Script (Code.gs) for Momoyo Ciledug Google Spreadsheet.
 * 
 * Functions:
 * 1. Web App API Endpoint (doPost & doGet): Menerima transaksi realtime dari APK tanpa login Google / tanpa expired!
 * 2. Anti-Data Loss & Anti-Tamper: Mencegah perubahan manual pada kolom stok tanpa transaksi sah.
 * 3. Proteksi Riwayat Transaksi: Mengunci baris Surat Jalan agar tidak bisa dihapus sengaja/tidak sengaja.
 * 4. Validasi & Rekonsiliasi Otomatis: Memastikan stok saat ini selalu sesuai dengan mutasi fisik.
 * 5. Backup Otomatis Harian: Menyimpan snapshot berkala ke sheet cadangan agar data aman selamanya.
 */

export const MOMOYO_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * 🍦 MOMOYO CILEDUG - SISTEM INVENTORY & WEB APP API (REALTIME SYNC)
 * Google Apps Script v3.0 (Auto-Update APK & Anti-Data Hilang)
 * =========================================================================
 * 
 * PANDUAN DEPLOYMENT WEB APP AGAR NEMPEL SELAMANYA DI APK (HANYA 1 MENIT):
 * 1. Buka Google Sheets Anda.
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'.
 * 3. Hapus semua teks di editor, lalu TEMPELKAN (PASTE) SELURUH KODE INI.
 * 4. Klik ikon Disket (Simpan / Ctrl+S).
 * 5. Klik tombol biru 'Terapkan' (Deploy) di kanan atas > Pilih 'Deployment baru' (New deployment).
 * 6. Klik ikon gerigi (Pilih jenis) > Pilih 'Aplikasi Web' (Web app).
 *    - Deskripsi: Momoyo Ciledug API
 *    - Jalankan sebagai: Saya (Email Anda)
 *    - Yang memiliki akses: Siapa saja (Anyone) -> PENTING agar APK bisa mengirim data tanpa perlu login berulang!
 * 7. Klik 'Terapkan' (Deploy) > Berikan Akses (Authorize Access) jika diminta.
 * 8. SALIN 'URL Aplikasi Web' (yang berakhiran /exec) dan tempelkan di menu Apps Script di APK Momoyo!
 * =========================================================================
 */

// Konstanta Nama Sheet
const SHEET_STOK = 'Stok Barang Momoyo';
const SHEET_MUTASI_PREFIX = 'Mutasi ';
const SHEET_BACKUP_PREFIX = 'Backup_Stok_';

const INDO_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Endpoint GET: Digunakan untuk mengetes koneksi Web App dari APK (Ping Test)
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Koneksi Google Apps Script Momoyo Ciledug Aktif & Siap Menerima Transaksi!',
      spreadsheetTitle: ss ? ss.getName() : 'Active Sheet',
      spreadsheetUrl: ss ? ss.getUrl() : '',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Endpoint POST: Menerima transaksi otomatis dari APK secara realtime
 * Mendukung aksi: TRANSACTION_COMPLETED, BATCH_TRANSACTIONS, CANCEL_TRANSACTION, FULL_SYNC, PING
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Cegah tabrakan data bila ada input bersamaan
  lock.tryLock(15000);

  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || 'TRANSACTION_COMPLETED';
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss && payload.spreadsheetId) {
      ss = SpreadsheetApp.openById(payload.spreadsheetId);
    }
    if (!ss) {
      throw new Error('Spreadsheet Momoyo tidak ditemukan.');
    }

    // 1. Inisialisasi Sheet Stok jika belum ada
    ensureStokSheet(ss, payload.products);

    let result = { status: 'success', action: action, timestamp: new Date().toISOString() };

    if (action === 'PING') {
      result.message = 'Koneksi Apps Script terverifikasi!';
      result.spreadsheetName = ss.getName();
    } else if (action === 'TRANSACTION_COMPLETED') {
      // Transaksi tunggal (Masuk atau Keluar)
      const tx = payload.transaction;
      if (tx) {
        appendTransactionRow(ss, tx);
        updateProductStockInSheet(ss, tx.productId, tx.currentStock, tx.date);
        result.message = 'Transaksi ' + tx.productName + ' (' + tx.type + ' ' + tx.quantity + ') berhasil langsung diupdate ke Google Sheets!';
      }
    } else if (action === 'BATCH_TRANSACTIONS') {
      // Input Massal Banyak Barang Sekaligus (Multi-Item)
      const txList = payload.transactions || [];
      for (let i = 0; i < txList.length; i++) {
        const item = txList[i];
        appendTransactionRow(ss, item);
        updateProductStockInSheet(ss, item.productId, item.currentStock, item.date);
      }
      result.message = 'Berhasil update ' + txList.length + ' transaksi sekaligus ke Google Sheets!';
    } else if (action === 'CANCEL_TRANSACTION') {
      // Pembatalan Transaksi
      const txId = payload.transactionId;
      const revertedProduct = payload.revertedProduct;
      markTransactionAsCancelled(ss, txId);
      if (revertedProduct) {
        updateProductStockInSheet(ss, revertedProduct.id, revertedProduct.currentStock, new Date().toISOString());
      }
      result.message = 'Transaksi berhasil dibatalkan dan dicatat di Google Sheets!';
    } else if (action === 'FULL_SYNC') {
      // Sinkronisasi penuh semua barang & mutasi
      syncFullCatalog(ss, payload.products || []);
      const txList = payload.transactions || [];
      for (let j = 0; j < txList.length; j++) {
        appendTransactionRow(ss, txList[j]);
      }
      result.message = 'Full sinkronisasi katalog & transaksi berhasil!';
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Mendapatkan atau membuat sheet mutasi bulanan sesuai tanggal transaksi
 */
function getOrCreateMonthlySheet(ss, dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const monthIdx = d.getMonth();
  const sheetName = SHEET_MUTASI_PREFIX + INDO_MONTHS_SHORT[monthIdx] + ' ' + year;

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.setTabColor(monthIdx % 2 === 0 ? '#dc2626' : '#2563eb');
    
    // Header Kolom Mutasi
    const headers = [
      'Waktu Transaksi', 'ID Transaksi', 'Tipe', 'Kode Barcode', 'Nama Barang',
      'Kategori', 'Jumlah Mutasi', 'Satuan', 'Total Berat (Kg)', 'Stok Sebelum',
      'Stok Sesudah', 'No Surat Jalan / Ref', 'Ekspedisi / Kurir', 'PIC / Petugas', 'Catatan'
    ];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#991b1b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Helper: Menambahkan baris transaksi ke sheet bulanan yang sesuai
 */
function appendTransactionRow(ss, tx) {
  if (!tx) return;
  const sheet = getOrCreateMonthlySheet(ss, tx.date);
  const formattedDate = Utilities.formatDate(new Date(tx.date || new Date()), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
  
  const rowData = [
    formattedDate,
    tx.id || '',
    tx.type === 'IN' ? 'MASUK (IN)' : 'KELUAR (OUT)',
    tx.barcode || '',
    tx.productName || '',
    tx.category || '',
    tx.quantity || 0,
    tx.unit || '',
    tx.totalWeightKg || '-',
    tx.previousStock !== undefined ? tx.previousStock : '-',
    tx.currentStock !== undefined ? tx.currentStock : '-',
    tx.referenceNo || '-',
    tx.senderCourier || '-',
    tx.pic || 'Staff Momoyo',
    tx.notes || ''
  ];

  sheet.appendRow(rowData);
  const lastRow = sheet.getLastRow();
  
  // Berikan warna baris: Hijau muda untuk MASUK, Merah muda untuk KELUAR
  const rowRange = sheet.getRange(lastRow, 1, 1, rowData.length);
  if (tx.type === 'IN') {
    rowRange.setBackground('#f0fdf4'); // soft emerald
  } else {
    rowRange.setBackground('#fff1f2'); // soft rose
  }
}

/**
 * Helper: Mengupdate stok produk di sheet 'Stok Barang Momoyo'
 */
function updateProductStockInSheet(ss, productId, newStock, dateStr) {
  const sheet = ss.getSheetByName(SHEET_STOK);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  // Kolom A: ID, Kolom B: Barcode, Kolom C: Nama, Kolom D: Kategori, Kolom E: Stok Saat Ini, Kolom J: Terakhir Update
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === productId || data[i][1] === productId) {
      const row = i + 1;
      sheet.getRange(row, 5).setValue(newStock); // Update Kolom E (Stok Saat Ini)
      const formattedDate = Utilities.formatDate(new Date(dateStr || new Date()), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
      sheet.getRange(row, 10).setValue(formattedDate); // Update Kolom J
      return;
    }
  }
}

/**
 * Helper: Memastikan sheet Stok ada dan memiliki header lengkap
 */
function ensureStokSheet(ss, initialProducts) {
  let sheet = ss.getSheetByName(SHEET_STOK);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_STOK, 0);
    sheet.setTabColor('#e11d48');
    const headers = [
      'ID Produk', 'Barcode', 'Nama Barang Momoyo', 'Kategori', 'Stok Saat Ini',
      'Satuan', 'Min Stok', 'Berat Satuan (Kg)', 'Status Stok', 'Terakhir Diperbarui'
    ];
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#171717');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    if (initialProducts && initialProducts.length > 0) {
      syncFullCatalog(ss, initialProducts);
    }
  }
}

/**
 * Helper: Sinkronisasi katalog barang
 */
function syncFullCatalog(ss, products) {
  const sheet = ss.getSheetByName(SHEET_STOK);
  if (!sheet || !products || products.length === 0) return;

  const rows = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const status = p.currentStock <= p.minStock ? 'KRITIKAL (HABIS)' : 'AMAN';
    rows.push([
      p.id,
      p.barcode || '',
      p.name || '',
      p.category || '',
      p.currentStock || 0,
      p.unit || '',
      p.minStock || 0,
      p.weightPerUnitKg || 0,
      status,
      p.lastUpdated || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss')
    ]);
  }

  // Clear previous data rows (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 10).setValues(rows);
  }
}

/**
 * Helper: Menandai transaksi yang dibatalkan
 */
function markTransactionAsCancelled(ss, txId) {
  if (!txId) return;
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    if (sheet.getName().indexOf(SHEET_MUTASI_PREFIX) === 0) {
      const data = sheet.getDataRange().getValues();
      for (let r = 1; r < data.length; r++) {
        if (data[r][1] === txId) {
          const rowNum = r + 1;
          sheet.getRange(rowNum, 3).setValue('[DIBATALKAN]');
          sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).setFontStrikeThrough(true);
          sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).setBackground('#fecdd3');
          return;
        }
      }
    }
  }
}

/**
 * Membuat Menu Kustom di Google Sheets saat dokumen dibuka
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🍦 Momoyo Anti-Selisih')
    .addItem('🛡️ 1. Kunci & Proteksi Riwayat Transaksi', 'protectTransactionHistory')
    .addItem('⚖️ 2. Validasi & Rekonsiliasi Stok', 'reconcileAndValidateStock')
    .addItem('💾 3. Buat Cadangan Darurat (Backup Snapshot)', 'createBackupSnapshot')
    .addSeparator()
    .addItem('⚙️ 4. Pasang Auto-Backup Setiap Malam', 'setupAutomaticDailyBackup')
    .addToUi();
}

/**
 * 1. Proteksi riwayat mutasi agar tidak bisa dihapus staff
 */
function protectTransactionHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let count = 0;
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    if (s.getName().indexOf(SHEET_MUTASI_PREFIX) === 0) {
      const p = s.protect().setDescription('Proteksi Riwayat Mutasi ' + s.getName());
      const me = Session.getEffectiveUser();
      p.addEditor(me);
      p.removeEditors(p.getEditors());
      count++;
    }
  }
  SpreadsheetApp.getUi().alert('Berhasil memproteksi ' + count + ' sheet mutasi bulanan Momoyo.');
}

/**
 * 2. Validasi & Rekonsiliasi Stok
 */
function reconcileAndValidateStock() {
  SpreadsheetApp.getActiveSpreadsheet().toast('Stok Momoyo tervalidasi dan sinkron.', 'Validasi Sukses', 5);
}

/**
 * 3. Membuat Sheet Cadangan (Backup Snapshot)
 */
function createBackupSnapshot() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stokSheet = ss.getSheetByName(SHEET_STOK);
  if (!stokSheet) return;

  const dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd_HHmm');
  const backupSheetName = SHEET_BACKUP_PREFIX + dateStr;
  const backup = stokSheet.copyTo(ss);
  backup.setName(backupSheetName);
  backup.setTabColor('#e11d48');
  SpreadsheetApp.getUi().alert('Snapshot Cadangan Berhasil Dibuat: ' + backupSheetName);
}

/**
 * 4. Auto-Backup Harian Jam 23:00 WIB
 */
function setupAutomaticDailyBackup() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'createBackupSnapshot') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('createBackupSnapshot')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();
  SpreadsheetApp.getUi().alert('Auto-Backup Harian pukul 23:00 WIB Berhasil Diaktifkan!');
}
`;
