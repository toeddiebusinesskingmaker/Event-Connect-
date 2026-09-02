import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, QrCode, Calendar, MapPin, Share2 } from 'lucide-react';
import { motion } from 'motion/react';

interface QRCodeModalProps {
  onClose: () => void;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  checkInCode: string;
}

export default function QRCodeModal({ onClose, eventName, eventLocation, eventDate, checkInCode }: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Generate QR Code containing the literal check-in code.
    // Also support checking in via full URL (we include both code and a helper URL format)
    const generateQR = async () => {
      try {
        // We put a clear, easy-to-parse structure:
        // By default, just the literal uppercase code, so that standard QR scanners or our built-in scanner detects it instantly.
        // We also allow the current hostname + query parameters as fallback.
        const originUrl = window.location.origin;
        const scanPayload = `${originUrl}/?code=${checkInCode}`;
        
        // Generate high resolution, beautifully styled QR code with indigo accent if possible (or standard high-contrast black/white)
        const dataUrl = await QRCode.toDataURL(scanPayload, {
          width: 512,
          margin: 1,
          color: {
            dark: '#1e1b4b', // Deep indigo text/marker
            light: '#ffffff'
          }
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("Failed to generate QR Code", err);
        setError("Unable to render QR code canvas.");
      }
    };

    generateQR();
  }, [checkInCode]);

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${eventName.replace(/\s+/g, '_')}_CheckIn.png`;
    link.click();
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
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 text-indigo-700">
            <QrCode className="w-4 h-4 text-indigo-700 animate-bounce" />
            <h3 className="text-sm font-black text-indigo-950 uppercase tracking-widest">Venue QR Code</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Event Details Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <h4 className="font-bold text-xs text-indigo-950 uppercase truncate">{eventName}</h4>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <span className="truncate">{eventLocation}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <span>{eventDate}</span>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl shadow-inner relative min-h-[220px]">
          {qrDataUrl ? (
            <>
              <img 
                src={qrDataUrl} 
                alt="Event Check-in QR Code" 
                className="w-48 h-48 object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="mt-3 bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono text-xs font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-sm">
                CODE: {checkInCode}
              </span>
            </>
          ) : error ? (
            <div className="text-center text-rose-600 text-xs p-4 flex flex-col items-center gap-2">
              <span className="font-bold">Error Rendering QR</span>
              <p className="text-[10px] text-slate-500">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
              <QrCode className="w-10 h-10 animate-spin text-indigo-300" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Generating vector stream...</span>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed text-center mt-4">
          Point a phone camera at this code to join the event and sync your shared timeline instantly.
        </p>

        {/* Footer Actions */}
        {qrDataUrl && (
          <div className="grid grid-cols-2 gap-2 mt-5 pt-3 border-t border-slate-100">
            <button 
              onClick={downloadQR}
              className="w-full bg-indigo-700 hover:bg-indigo-800 border-b-2 border-indigo-950 text-white font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Image</span>
            </button>
            <button 
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center transition"
            >
              <span>Done</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
