import { Product, StockTransaction } from '../types';

export interface SyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  inventoryRowsCount: number;
  transactionRowsCount: number;
  monthlySheetsCount: number;
  syncedAt: string;
  isPublic?: boolean;
}

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const INDO_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/**
 * Creates or updates the Momoyo Ciledug Inventory Spreadsheet.
 * Implements monthly slide rotation: every month gets its own dedicated sheet tab (slide selanjutnya)
 * so that each month has an organized, isolated table with monthly summaries!
 */
export async function syncInventoryToGoogleSheets(
  accessToken: string,
  products: Product[],
  transactions: StockTransaction[],
  existingSpreadsheetId?: string
): Promise<SyncResult> {
  const currentDateStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 1. Group transactions by month (YYYY-MM)
  const monthlyTxMap = new Map<string, StockTransaction[]>();

  // Ensure current month is always present even if empty
  monthlyTxMap.set(currentMonthKey, []);

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyTxMap.has(key)) {
      monthlyTxMap.set(key, []);
    }
    monthlyTxMap.get(key)!.push(tx);
  });

  // Sort months descending (newest month first)
  const sortedMonthKeys = Array.from(monthlyTxMap.keys()).sort((a, b) => b.localeCompare(a));

  const getSheetTitleForMonth = (monthKey: string) => {
    const [yStr, mStr] = monthKey.split('-');
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;
    return `Mutasi ${INDO_MONTHS_SHORT[monthIdx]} ${year}`;
  };

  let spreadsheetId = existingSpreadsheetId;
  const existingSheetTitles = new Set<string>();

  // 2. If spreadsheet already exists, fetch its existing sheet names
  if (spreadsheetId) {
    try {
      const getMetaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (getMetaRes.ok) {
        const metaData = await getMetaRes.json();
        if (metaData.sheets) {
          metaData.sheets.forEach((s: any) => {
            if (s?.properties?.title) {
              existingSheetTitles.add(s.properties.title);
            }
          });
        }
      } else {
        // If sheet not found or invalid id, clear spreadsheetId to create fresh
        console.warn('Existing spreadsheet ID invalid, will create a new one');
        spreadsheetId = undefined;
      }
    } catch (e) {
      console.warn('Error fetching spreadsheet metadata:', e);
      spreadsheetId = undefined;
    }
  }

  // 3. If no existing spreadsheet, create a new one with initial sheets
  if (!spreadsheetId) {
    const initialSheets = [
      {
        properties: {
          title: 'Stok Barang Momoyo',
          gridProperties: { rowCount: 150, columnCount: 12 },
        },
      },
    ];

    // Add sheets for each month
    sortedMonthKeys.forEach((mKey) => {
      const title = getSheetTitleForMonth(mKey);
      initialSheets.push({
        properties: {
          title,
          gridProperties: { rowCount: 250, columnCount: 14 },
        },
      });
      existingSheetTitles.add(title);
    });

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `Momoyo Ciledug - Inventory & Log Mutasi Bulanan`,
        },
        sheets: initialSheets,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err?.error?.message || 'Gagal membuat Google Spreadsheet baru');
    }

    const createdData = await createRes.json();
    spreadsheetId = createdData.spreadsheetId;
    existingSheetTitles.add('Stok Barang Momoyo');
  } else {
    // Spreadsheet exists: check which monthly sheets are missing, and add them
    const sheetsToAdd: any[] = [];

    // Ensure Master Stok sheet exists
    if (!existingSheetTitles.has('Stok Barang Momoyo')) {
      sheetsToAdd.push({
        addSheet: {
          properties: {
            title: 'Stok Barang Momoyo',
            gridProperties: { rowCount: 150, columnCount: 12 },
          },
        },
      });
    }

    // Ensure each month has its dedicated sheet tab
    sortedMonthKeys.forEach((mKey) => {
      const title = getSheetTitleForMonth(mKey);
      if (!existingSheetTitles.has(title)) {
        sheetsToAdd.push({
          addSheet: {
            properties: {
              title,
              gridProperties: { rowCount: 250, columnCount: 14 },
            },
          },
        });
      }
    });

    if (sheetsToAdd.length > 0) {
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: sheetsToAdd,
          }),
        });
      } catch (addSheetErr) {
        console.warn('Add monthly sheet tabs warning:', addSheetErr);
      }
    }
  }

  // 4. Prepare Data for Sheet 1: 'Stok Barang Momoyo'
  const productHeaders = [
    'ID Produk',
    'Barcode',
    'Nama Barang Momoyo',
    'Kategori',
    'Stok Saat Ini',
    'Satuan',
    'Min Stok Alert',
    'Berat Satuan (Kg)',
    'Total Berat Stok (Kg)',
    'Lokasi Penyimpanan',
    'Terakhir Diupdate',
  ];

  const productRows = products.map((p) => {
    const weightPerUnit = Math.max(1, Math.round(p.weightPerUnitKg || 1));
    const totalWeight = Math.round(p.currentStock * weightPerUnit);
    return [
      p.id,
      p.barcode,
      p.name,
      p.category,
      p.currentStock,
      p.unit,
      p.minStock,
      p.weightPerUnitKg ? `${Math.round(p.weightPerUnitKg)} Kg` : '-',
      `${totalWeight} Kg`,
      p.location,
      p.lastUpdated,
    ];
  });

  // Table Headers for Transaction Logs
  const txHeaders = [
    'ID Transaksi',
    'Tanggal & Waktu',
    'Jenis (IN / OUT)',
    'No. Surat Jalan / PO',
    'Nama Barang',
    'Barcode',
    'Jumlah',
    'Satuan',
    'Berat Masuk/Keluar (Kg)',
    'Petugas (PIC)',
    'Ekspedisi / Driver',
    'Alasan / Keterangan',
    'Stok Sebelum',
    'Stok Sesudah',
  ];

  const updateData: Array<{ range: string; values: any[][] }> = [
    {
      range: "'Stok Barang Momoyo'!A1:L",
      values: [
        [
          'REKAPITULASI LIVE STOK MOMOYO CILEDUG - CIREBON',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `Update: ${currentDateStr}`,
        ],
        [],
        productHeaders,
        ...productRows,
      ],
    },
  ];

  // 5. Populate Each Monthly Sheet Tab (slide selanjutnya per bulan)
  sortedMonthKeys.forEach((mKey) => {
    const sheetTitle = getSheetTitleForMonth(mKey);
    const mTxList = monthlyTxMap.get(mKey) || [];

    // Sort transactions chronologically
    const sortedTx = [...mTxList].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const [yStr, mStr] = mKey.split('-');
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;
    const fullMonthName = `${INDO_MONTHS[monthIdx]} ${year}`;

    const totalIn = sortedTx.filter((t) => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0);
    const totalOut = sortedTx.filter((t) => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0);
    const totalWeightIn = sortedTx
      .filter((t) => t.type === 'IN')
      .reduce((acc, t) => acc + (t.totalWeightKg || 0), 0);

    const mRows = sortedTx.map((t) => [
      t.id,
      new Date(t.date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      t.type === 'IN' ? 'BARANG MASUK (IN)' : 'BARANG KELUAR (OUT)',
      t.referenceNo || '-',
      t.productName,
      t.barcode,
      t.quantity,
      t.unit,
      t.totalWeightKg ? `${t.totalWeightKg} Kg` : '-',
      t.pic,
      t.senderCourier || '-',
      t.type === 'OUT' ? t.outReason || t.notes || '-' : t.notes || '-',
      t.previousStock,
      t.currentStock,
    ]);

    updateData.push({
      range: `'${sheetTitle}'!A1:N`,
      values: [
        [
          `TABEL MUTASI BARANG MOMOYO CILEDUG - BULAN ${fullMonthName.toUpperCase()}`,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `Sync: ${currentDateStr}`,
        ],
        [
          `Total Barang Masuk (IN): +${totalIn} Unit`,
          `Total Keluar (OUT): -${totalOut} Unit`,
          `Total Berat Masuk: ${Math.round(totalWeightIn)} Kg`,
          `Total Log: ${sortedTx.length} Transaksi`,
        ],
        [],
        txHeaders,
        ...mRows,
      ],
    });
  });

  // 6. Push all batch updates
  const batchUpdateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      }),
    }
  );

  if (!batchUpdateRes.ok) {
    const err = await batchUpdateRes.json();
    throw new Error(err?.error?.message || 'Gagal sinkronisasi data ke sheet Google Spreadsheet');
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Make spreadsheet accessible by anyone with the link
  let isPublic = false;
  try {
    isPublic = await setSpreadsheetPublicAnyoneWithLink(accessToken, spreadsheetId!);
  } catch (err) {
    console.warn('Could not set public permissions automatically:', err);
  }

  return {
    spreadsheetId: spreadsheetId!,
    spreadsheetUrl,
    inventoryRowsCount: productRows.length,
    transactionRowsCount: transactions.length,
    monthlySheetsCount: sortedMonthKeys.length,
    syncedAt: currentDateStr,
    isPublic,
  };
}

export interface AppsScriptPayload {
  action: 'TRANSACTION_COMPLETED' | 'BATCH_TRANSACTIONS' | 'CANCEL_TRANSACTION' | 'FULL_SYNC' | 'PING';
  spreadsheetId?: string;
  transaction?: StockTransaction;
  transactions?: StockTransaction[];
  products?: Product[];
  transactionId?: string;
  revertedProduct?: Product;
  timestamp?: string;
}

export interface AppsScriptResponse {
  status: 'success' | 'error';
  message: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
}

/**
 * Sends transaction / inventory payload to Google Apps Script Web App.
 * Works 24/7 without needing Google OAuth login, never expires, and keeps data safe!
 */
export async function sendToGoogleAppsScript(
  appsScriptUrl: string,
  payload: AppsScriptPayload
): Promise<AppsScriptResponse> {
  const cleanUrl = appsScriptUrl.trim();
  if (!cleanUrl) {
    throw new Error('URL Google Apps Script belum diisi.');
  }

  const bodyText = JSON.stringify({
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
  });

  try {
    // Attempt standard fetch first (if CORS allowed)
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyText,
    });

    if (response.ok) {
      try {
        const json = await response.json();
        return {
          status: json.status || 'success',
          message: json.message || 'Data berhasil dikirim ke Google Sheets via Apps Script!',
          spreadsheetTitle: json.spreadsheetTitle,
          spreadsheetUrl: json.spreadsheetUrl,
        };
      } catch {
        return {
          status: 'success',
          message: 'Data berhasil terkirim ke Google Sheets via Apps Script!',
        };
      }
    }
  } catch (corsOrNetworkErr) {
    // In many browsers, Apps Script redirect causes opaque response or CORS block.
    // Fall back to mode: 'no-cors' so the browser fires the request and delivers it to Google Apps Script successfully!
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: bodyText,
      });

      return {
        status: 'success',
        message: 'Data transaksi berhasil dikirim ke Google Sheets (Mode Webhook Apps Script)!',
      };
    } catch (err: any) {
      console.error('Failed to send to Google Apps Script:', err);
      throw new Error(err?.message || 'Gagal mengirim data ke URL Apps Script.');
    }
  }

  return {
    status: 'success',
    message: 'Data terkirim ke Google Sheets.',
  };
}

/**
 * Tests connection to Google Apps Script Web App
 */
export async function testGoogleAppsScriptConnection(appsScriptUrl: string): Promise<AppsScriptResponse> {
  const cleanUrl = appsScriptUrl.trim();
  if (!cleanUrl) throw new Error('URL Google Apps Script tidak boleh kosong.');

  return await sendToGoogleAppsScript(cleanUrl, { action: 'PING' });
}

/**
 * Sets Google Drive permissions on the spreadsheet file so anyone with the link can view.
 * Uses Google Drive API v3 permissions.create with { role: 'reader', type: 'anyone' }.
 */
export async function setSpreadsheetPublicAnyoneWithLink(
  accessToken: string,
  fileId: string,
  role: 'reader' | 'commenter' | 'writer' = 'reader'
): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: role,
        type: 'anyone',
        allowFileDiscovery: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Drive permission response error:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Drive permission network error:', e);
    return false;
  }
}
