import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertTriangle, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRScannerModalProps {
  onClose: () => void;
  onScanSuccess: (decodedCode: string) => void;
}

export default function QRScannerModal({ onClose, onScanSuccess }: QRScannerModalProps) {
  const [hasCameras, setHasCameras] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);

  // Parse check-in code from decoded text (literal or URL)
  const extractEventCode = (text: string): string => {
    const trimmed = text.trim();
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const codeParam = url.searchParams.get('code');
        if (codeParam) return codeParam.toUpperCase();
        
        for (const [key, value] of url.searchParams.entries()) {
          if (key.toLowerCase().includes('code')) {
            return value.toUpperCase();
          }
        }
        
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          if (lastSegment && lastSegment.length >= 3 && lastSegment.length <= 15) {
            return lastSegment.toUpperCase();
          }
        }
      }
    } catch (e) {
      // Fallback
    }
    return trimmed.toUpperCase();
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    
    // Create element instance
    const timer = setTimeout(() => {
      try {
        html5QrCode = new Html5Qrcode("qr-reader-viewport");
        setScannerInstance(html5QrCode);

        const qrSuccess = (decodedText: string) => {
          const code = extractEventCode(decodedText);
          // Vibrate on successful scan if supported
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScanSuccess(code);
        };

        const qrError = () => {
          // Frame errors are very frequent and normal, keep quiet
        };

        Html5Qrcode.getCameras().then(devices => {
          if (devices && devices.length > 0) {
            setHasCameras(true);
            setCameras(devices);
            
            // Auto-select back/rear camera if available
            const back = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('rear')
            );
            const initialId = back ? back.id : devices[0].id;
            setActiveCameraId(initialId);

            html5QrCode?.start(
              initialId,
              {
                fps: 15,
                qrbox: (width, height) => {
                  const size = Math.min(width, height) * 0.7;
                  return { width: size, height: size };
                }
              },
              qrSuccess,
              qrError
            ).then(() => {
              setIsScanning(true);
            }).catch(err => {
              console.error("Scanner failed to start", err);
              setError("Failed to mount camera viewfinder stream.");
            });
          } else {
            setError("No active camera devices detected on this browser.");
          }
        }).catch(err => {
          console.error("Get cameras error", err);
          setError("Camera access is blocked or permission was denied. Please allow camera permissions in your settings.");
        });

      } catch (e) {
        console.error("Instantiate error", e);
        setError("Unable to initialize standard camera library.");
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop().catch(err => {
            console.error("Clean stop error", err);
          });
        }
      }
    };
  }, []);

  const switchCamera = async () => {
    if (!scannerInstance || cameras.length <= 1 || !activeCameraId) return;

    try {
      setIsScanning(false);
      if (scannerInstance.isScanning) {
        await scannerInstance.stop();
      }

      const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      setActiveCameraId(nextCamera.id);

      const qrSuccess = (decodedText: string) => {
        const code = extractEventCode(decodedText);
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        onScanSuccess(code);
      };

      await scannerInstance.start(
        nextCamera.id,
        {
          fps: 15,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          }
        },
        qrSuccess,
        () => {}
      );
      setIsScanning(true);
    } catch (e) {
      console.error("Switch camera error", e);
      setError("Failed to toggle camera switch.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border-2 border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden p-6 shadow-2xl flex flex-col relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-indigo-700">
            <QrCode className="w-4 h-4 animate-bounce" />
            <h3 className="text-sm font-black text-indigo-950 uppercase tracking-widest">Scan Event QR</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder area */}
        <div className="relative aspect-square w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner flex flex-col items-center justify-center">
          
          {/* Output viewport required for html5-qrcode */}
          <div id="qr-reader-viewport" className="absolute inset-0 w-full h-full object-cover [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

          {/* Scanner overlays / borders */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
              {/* Overlay Corners */}
              <div className="flex justify-between">
                <div className="w-5 h-5 border-t-4 border-l-4 border-indigo-500 rounded-tl-md" />
                <div className="w-5 h-5 border-t-4 border-r-4 border-indigo-500 rounded-tr-md" />
              </div>
              
              {/* Laser Scanning Line */}
              <div className="w-full h-1 bg-indigo-500 shadow-[0_0_10px_#4f46e5] rounded animate-[bounce_2s_infinite] opacity-75" />
              
              <div className="flex justify-between">
                <div className="w-5 h-5 border-b-4 border-l-4 border-indigo-500 rounded-bl-md" />
                <div className="w-5 h-5 border-b-4 border-r-4 border-indigo-500 rounded-br-md" />
              </div>
            </div>
          )}

          {/* Loader / Empty States */}
          {!isScanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2.5 bg-slate-900/90">
              <Camera className="w-8 h-8 text-indigo-400 animate-pulse" />
              <p className="text-[11px] font-bold uppercase tracking-wider">Accessing Camera Stream...</p>
              <p className="text-[9px] text-slate-500 max-w-[200px]">We're preparing your lens viewfinder. Please approve permission prompts.</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-rose-200 gap-2.5 bg-rose-950/95">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
              <p className="text-[11px] font-black uppercase tracking-wider">Scanner Locked</p>
              <p className="text-[9px] text-rose-300 leading-relaxed max-w-[230px]">{error}</p>
            </div>
          )}
        </div>

        {/* Scan instructions & controls */}
        <div className="mt-4 text-center">
          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
            Position the venue's check-in QR code within the frame to verify instantly.
          </p>

          {/* Switch Camera Action */}
          {cameras.length > 1 && isScanning && (
            <button 
              onClick={switchCamera}
              className="mt-4 mx-auto bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-700" />
              <span>Switch Camera ({cameras.length})</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
