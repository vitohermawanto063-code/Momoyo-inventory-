import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Flashlight,
  RefreshCw,
  X,
  PlusCircle,
  MinusCircle,
  Search,
  Sparkles,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/audio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProductForIn: (product: Product) => void;
  onSelectProductForOut: (product: Product) => void;
  onAddNewWithBarcode: (barcode: string) => void;
  onSelectProductDetails: (product: Product) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProductForIn,
  onSelectProductForOut,
  onAddNewWithBarcode,
  onSelectProductDetails,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [showHelperList, setShowHelperList] = useState<boolean>(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isComponentMounted = useRef<boolean>(true);
  const scannerContainerId = 'momoyo-html5-qr-reader';

  // Find product by scanned barcode
  const matchedProduct = scannedResult
    ? products.find((p) => p.barcode.toLowerCase() === scannedResult.toLowerCase().trim())
    : null;

  useEffect(() => {
    isComponentMounted.current = true;

    if (isOpen) {
      setScannedResult(null);
      setCameraError(null);
      initializeCamera();
    }

    return () => {
      isComponentMounted.current = false;
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const initializeCamera = async () => {
    try {
      setCameraError(null);
      // Get cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraError('Kamera tidak ditemukan pada perangkat HP / browser ini.');
        return;
      }

      setAvailableCameras(devices);
      // Prefer back/rear camera for HP scanning
      const backCam = devices.find(
        (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('belakang')
      );
      const camId = backCam ? backCam.id : devices[0].id;
      setSelectedCameraId(camId);

      await startScannerWithCamera(camId);
    } catch (err: unknown) {
      console.error('Camera init failed:', err);
      setCameraError(
        'Izin kamera belum aktif atau diblokir oleh browser. Pastikan mengizinkan akses kamera atau gunakan input barcode manual di bawah.'
      );
    }
  };

  const startScannerWithCamera = async (cameraId: string) => {
    try {
      await stopScanner();

      const qrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = qrCode;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.0,
      };

      await qrCode.start(
        cameraId,
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame scan failure (benign, scanning in progress)
        }
      );

      setIsScanning(true);

      // Check flashlight/torch capability
      try {
        const capabilities = qrCode.getRunningTrackCapabilities();
        if ('torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      console.error('Failed to start camera:', err);
      setCameraError('Gagal mengakses stream kamera. Silakan pilih kamera lain atau gunakan input manual.');
      setIsScanning(false);
    }
  };

  const handleSuccessfulScan = (barcodeText: string) => {
    const cleaned = barcodeText.trim();
    if (!cleaned) return;

    soundManager.playSuccessBeep();
    setScannedResult(cleaned);
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleSuccessfulScan(manualInput.trim());
    setManualInput('');
  };

  const handleSimulateScan = (barcode: string) => {
    handleSuccessfulScan(barcode);
  };

  if (!isOpen) return null;

  return (
    <div
      id="barcode-scanner-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="barcode-scanner-card"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-red-100 flex flex-col my-auto"
      >
        {/* Header with Momoyo branding */}
        <div className="flex items-center justify-between border-b border-red-100 bg-linear-to-r from-red-600 to-rose-700 px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Scan Barcode HP</h2>
              <p className="text-xs text-red-100">Momoyo Ciledug Cirebon</p>
            </div>
          </div>
          <button
            id="close-scanner-btn"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/25 transition-colors"
            title="Tutup Scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="p-4 space-y-4">
          <div className="relative overflow-hidden rounded-xl bg-neutral-950 border border-neutral-800 shadow-inner flex flex-col items-center justify-center min-h-[260px]">
            {/* The html5-qrcode container */}
            <div id={scannerContainerId} className="w-full max-w-sm rounded-lg overflow-hidden" />

            {/* Target Scanning Box Overlay */}
            {isScanning && !scannedResult && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                <div className="relative h-44 w-64 rounded-xl border-2 border-dashed border-red-400 bg-red-500/10">
                  {/* Corner accents */}
                  <span className="absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 border-red-500 rounded-tl-sm" />
                  <span className="absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 border-red-500 rounded-tr-sm" />
                  <span className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-red-500 rounded-bl-sm" />
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-red-500 rounded-br-sm" />

                  {/* Animated laser line */}
                  <div className="absolute inset-x-0 h-0.5 bg-linear-to-r from-transparent via-red-400 to-transparent shadow-[0_0_12px_#ef4444] animate-bounce" />
                </div>
                <p className="mt-3 text-xs font-medium text-white/80 drop-shadow-md bg-black/60 px-3 py-1 rounded-full">
                  Arahkan kamera ke barcode kemasan barang
                </p>
              </div>
            )}

            {/* Camera error fallback display */}
            {cameraError && (
              <div className="p-4 text-center max-w-xs space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                  <CameraOff className="h-5 w-5" />
                </div>
                <p className="text-xs text-neutral-300">{cameraError}</p>
                <button
                  id="retry-camera-btn"
                  onClick={initializeCamera}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Coba Akses Kamera Lagi
                </button>
              </div>
            )}

            {/* In-view camera controls */}
            {isScanning && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                {hasTorch && (
                  <button
                    id="torch-toggle-btn"
                    onClick={toggleTorch}
                    className={`p-2 rounded-lg text-xs font-medium backdrop-blur-md transition-colors ${
                      torchOn ? 'bg-amber-400 text-neutral-950 font-bold' : 'bg-black/60 text-white hover:bg-black/80'
                    }`}
                    title="Lampu Senter"
                  >
                    <Flashlight className="h-4 w-4" />
                  </button>
                )}
                {availableCameras.length > 1 && (
                  <button
                    id="switch-camera-btn"
                    onClick={() => {
                      const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
                      const nextIndex = (currentIndex + 1) % availableCameras.length;
                      const nextCam = availableCameras[nextIndex];
                      setSelectedCameraId(nextCam.id);
                      startScannerWithCamera(nextCam.id);
                    }}
                    className="p-2 rounded-lg text-xs bg-black/60 text-white hover:bg-black/80 backdrop-blur-md"
                    title="Ganti Kamera"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scanned Result Banner */}
          {scannedResult && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-red-100 text-red-700">
                    Barcode Terdeteksi
                  </span>
                  <p className="mt-1 font-mono text-sm font-semibold text-neutral-900 tracking-wider">
                    {scannedResult}
                  </p>
                </div>
                <button
                  id="rescan-btn"
                  onClick={() => setScannedResult(null)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-red-200 shadow-2xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Scan Ulang
                </button>
              </div>

              {matchedProduct ? (
                <div className="rounded-lg bg-white p-3 border border-red-100 shadow-2xs space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-neutral-500">{matchedProduct.category}</p>
                      <h4 className="text-sm font-bold text-neutral-900">{matchedProduct.name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-neutral-500">Stok Saat Ini</span>
                      <p className="text-base font-black text-neutral-900">
                        {matchedProduct.currentStock}{' '}
                        <span className="text-xs font-medium text-neutral-600">{matchedProduct.unit}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                    <button
                      id="action-scan-in-btn"
                      onClick={() => {
                        stopScanner();
                        onSelectProductForIn(matchedProduct);
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-98 transition shadow-xs"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Barang Masuk (IN)
                    </button>
                    <button
                      id="action-scan-out-btn"
                      onClick={() => {
                        stopScanner();
                        onSelectProductForOut(matchedProduct);
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 active:scale-98 transition shadow-xs"
                    >
                      <MinusCircle className="h-4 w-4" />
                      Barang Keluar (OUT)
                    </button>
                    <button
                      id="action-scan-detail-btn"
                      onClick={() => {
                        stopScanner();
                        onSelectProductDetails(matchedProduct);
                        onClose();
                      }}
                      className="py-2 px-3 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-medium hover:bg-neutral-200 transition"
                      title="Lihat Detail Produk"
                    >
                      Detail
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Barcode belum terdaftar di Momoyo Ciledug</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Barang dengan kode ini belum ada di database. Anda bisa mendaftarkannya sekarang.
                  </p>
                  <button
                    id="register-new-from-scan-btn"
                    onClick={() => {
                      stopScanner();
                      onAddNewWithBarcode(scannedResult);
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow-xs"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Daftarkan Sebagai Barang Baru
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Barcode Input Section (Essential for quick typing / testing without barcode) */}
          <form onSubmit={handleManualSearch} className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700">
              Input Barcode Manual / Uji Kode:
            </label>
            <div className="flex gap-2">
              <input
                id="manual-barcode-input"
                type="text"
                placeholder="Contoh: 899100100101"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
              />
              <button
                id="submit-manual-barcode-btn"
                type="submit"
                className="flex items-center gap-1 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition"
              >
                <Search className="h-4 w-4" />
                Cari
              </button>
            </div>
          </form>

          {/* Quick Barcode Simulator for Demo / Instant Testing */}
          <div className="pt-2 border-t border-neutral-100">
            <button
              id="toggle-simulator-btn"
              type="button"
              onClick={() => setShowHelperList(!showHelperList)}
              className="flex items-center justify-between w-full text-xs font-semibold text-neutral-600 hover:text-red-600 py-1"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Daftar Barcode Momoyo untuk Simulasi Scan (Klik untuk Scan)
              </span>
              <HelpCircle className="h-3.5 w-3.5" />
            </button>

            {showHelperList && (
              <div className="mt-2 grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1 text-xs">
                {products.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    id={`simulate-scan-${p.id}`}
                    type="button"
                    onClick={() => handleSimulateScan(p.barcode)}
                    className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 hover:bg-red-50 hover:border-red-200 border border-neutral-200 text-left transition"
                  >
                    <div className="truncate pr-2">
                      <p className="font-semibold text-neutral-800 truncate">{p.name}</p>
                      <p className="text-[11px] font-mono text-neutral-500">{p.barcode}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-red-600">
                      Scan Ini
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
