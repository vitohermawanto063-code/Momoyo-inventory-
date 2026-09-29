export type ProductCategory =
  | 'Bahan Es Krim & Susu'
  | 'Teh & Sirup Buah'
  | 'Topping & Isian'
  | 'Packaging & Cup'
  | 'Operasional & Sanitasi';

export type ProductUnit = 'Pcs' | 'Karton' | 'Box' | 'Kg' | 'Gram' | 'Pack' | 'Roll' | 'Botol' | 'Liter';

export type TransactionType = 'IN' | 'OUT';

export type OutReason = 'Operasional Bar' | 'Waste / Tumpah' | 'Expired / Rusak' | 'Sampling / Promo' | 'Transfer Outlet';

export type ActiveTab = 'STOK' | 'MASUK' | 'KELUAR' | 'SURAT_JALAN' | 'RIWAYAT' | 'PO' | 'BATAL';

export interface SuratJalanItem {
  id?: string;
  productId?: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unit: string;
  weightKg: number;
  notes?: string;
}

export interface SuratJalan {
  id: string;
  sjNumber: string; // Nomor Surat Jalan fisik / DO
  date: string; // Tanggal & Jam ISO
  senderCourier: string; // Ekspedisi / Sopir / Pengirim
  pic: string; // PIC Penerima toko Momoyo
  photoUrl?: string; // Foto bukti dokumen fisik Surat Jalan (Base64 data URL)
  items: SuratJalanItem[];
  totalItems: number;
  totalQty: number;
  totalWeightKg: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type POStatus = 'DRAFT' | 'DIKIRIM_WA' | 'DITERIMA';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  barcode: string;
  category: ProductCategory;
  unit: ProductUnit;
  currentStock: number;
  minStock: number;
  orderQty: number; // Integer >= 1
  weightPerUnitKg?: number; // Integer Kg
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. PO-MMY-20260926-001
  date: string; // ISO date string
  supplierName: string; // e.g. 'Gudang Pusat Momoyo'
  supplierPhone?: string; // Optional WhatsApp phone number
  pic: string;
  status: POStatus;
  items: PurchaseOrderItem[];
  totalItems: number;
  totalQty: number;
  totalEstimatedWeightKg?: number;
  notes?: string;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  currentStock: number;
  minStock: number;
  costEstimate?: number; // Rupiah
  weightPerUnitKg?: number; // Berat per satuan (Kg), misal 1 Karton = 15 Kg atau 1 Kg = 1 Kg
  location: string; // e.g., 'Gudang Belakang Rak A1', 'Chiller 1', 'Storage Kasir'
  lastUpdated: string;
  notes?: string;
}

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  type: TransactionType;
  quantity: number;
  unit: ProductUnit;
  totalWeightKg?: number; // Total berat barang yang masuk atau keluar dalam Kg
  previousStock: number;
  currentStock: number;
  date: string; // ISO string
  pic: string; // Person In Charge (Staff name)
  outReason?: OutReason;
  referenceNo?: string; // Surat jalan / PO number
  senderCourier?: string; // Ekspedisi / Driver / Pengirim Surat Jalan
  notes?: string;
}

export interface QuickScanConfig {
  mode: 'LOOKUP' | 'FAST_IN' | 'FAST_OUT';
  defaultQty: number;
}
