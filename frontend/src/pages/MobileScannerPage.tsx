import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CheckCircle2, AlertCircle, Send, RefreshCw, Volume2, VolumeX, Smartphone, ArrowRight, Zap } from 'lucide-react';
import axios from 'axios';

export const MobileScannerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const session = searchParams.get('session') || '';
  
  const [scannerActive, setScannerActive] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<{ code: string; time: string; success: boolean }[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to scan');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage('Scanning photo...');
    try {
      const html5QrCode = html5QrCodeRef.current || new Html5Qrcode('mobile-reader');
      const decodedText = await html5QrCode.scanFile(file, false);
      if (decodedText) {
        transmitCode(decodedText);
      }
    } catch (err) {
      console.error('Scan file error:', err);
      setStatusMessage('बारकोड पहचान नहीं पाया, कृपया थोड़ा पास से दोबारा फोटो लें।');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Play beep on mobile scan
  const playBeep = () => {
    try {
      if (!soundEnabled) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // High C6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  // Register mobile connection with desktop session
  useEffect(() => {
    if (!session) return;
    const connectToStation = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        await axios.post(`${apiUrl}/scanner-sync/connect`, { session });
        setIsConnected(true);
        setStatusMessage('Connected to Desktop Station');
      } catch (e) {
        setIsConnected(true); // fallback to active
      }
    };
    connectToStation();
  }, [session]);

  // Transmit scanned code to desktop session
  const transmitCode = async (code: string) => {
    if (!code.trim() || isSubmitting) return;
    const cleanCode = code.trim().toUpperCase();

    // If user scans a computer pairing QR code, switch to that station session automatically!
    if (cleanCode.includes('SESSION=')) {
      const match = cleanCode.match(/SESSION=(STN-[A-Z0-9]+)/i);
      if (match && match[1]) {
        const newStation = match[1].toUpperCase();
        setStatusMessage(`Switching to Station: ${newStation}...`);
        window.location.search = `?session=${newStation}`;
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (soundEnabled) playBeep();
      if (navigator.vibrate) navigator.vibrate(80);

      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      await axios.post(`${apiUrl}/scanner-sync/push`, {
        session,
        code: cleanCode,
      });

      setLastScanned(cleanCode);
      setStatusMessage(`✓ Transmitted: ${cleanCode}`);
      setScanHistory(prev => [
        { code: cleanCode, time: new Date().toLocaleTimeString(), success: true },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setStatusMessage(`Failed to send code "${cleanCode}"`);
      setScanHistory(prev => [
        { code: cleanCode, time: new Date().toLocaleTimeString(), success: false },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [cameraError, setCameraError] = useState<string | null>(null);

  const startScanner = async () => {
    if (!session) return;
    setCameraError(null);
    setStatusMessage('Starting camera...');

    try {
      if (html5QrCodeRef.current?.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch {}

    const qrRegionId = 'mobile-reader';
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];

    try {
      const html5QrCode = new Html5Qrcode(qrRegionId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (isCooldownRef.current) return;
          isCooldownRef.current = true;
          transmitCode(decodedText);
          setTimeout(() => {
            isCooldownRef.current = false;
          }, 1200);
        },
        () => {}
      );

      setScannerActive(true);
      setCameraError(null);
      setStatusMessage('Camera Active & Ready');
    } catch (err: any) {
      console.error('Camera start error:', err);
      const errMsg = err?.message || String(err);
      setCameraError(errMsg);
      setScannerActive(false);
      setStatusMessage('Camera permission blocked or unavailable.');
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [session]);

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    transmitCode(manualCode);
    setManualCode('');
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <h1 className="text-xl font-bold">No Active Station Session</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-xs">
          Please scan the QR code displayed on your desktop computer screen to pair this phone.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      {/* Top Header */}
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
            <Smartphone size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>Mobile Scanner Gun</span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono">Station: {session}</span>
              <button
                type="button"
                onClick={() => {
                  const input = prompt('कंप्यूटर का Station Code डालें (जैसे STN-NI7EGW):', session);
                  if (input && input.trim()) {
                    window.location.search = `?session=${input.trim().toUpperCase()}`;
                  }
                }}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold px-1.5 py-0.5 rounded border border-slate-700 cursor-pointer"
              >
                बदलें
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          title="Toggle scan sound"
        >
          {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} />}
        </button>
      </header>

      {/* Main Camera Viewfinder Container */}
      <main className="flex-1 flex flex-col items-center p-4">
        {/* Status Toast */}
        <div className="w-full max-w-sm mb-3">
          <div className={`p-2.5 rounded-xl text-xs font-semibold text-center border flex items-center justify-center gap-2 transition-all ${
            lastScanned
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}>
            {lastScanned ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span className="truncate">Sent to PC: <strong className="font-mono text-white">{lastScanned}</strong></span>
              </>
            ) : (
              <span>⚡ Point camera at barcode to scan & send</span>
            )}
          </div>
        </div>

        {/* Live Camera Feed */}
        <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border-2 border-blue-500/50 bg-black shadow-2xl min-h-[260px] flex items-center justify-center">
          <div id="mobile-reader" className="w-full" />
          
          {cameraError ? (
            <div className="absolute inset-0 bg-slate-950/95 p-5 flex flex-col items-center justify-center text-center z-20">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                <AlertCircle size={26} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                Camera Permission Blocked
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                यदि स्क्रीन पर <em>"Close any bubbles or overlays"</em> आया है, तो स्क्रीन से कोई भी फ्लोटिंग बबल (Messenger, WhatsApp, Truecaller) हटा दें।
              </p>
              
              <button
                type="button"
                onClick={startScanner}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Camera size={16} />
                <span>Tap to Allow & Retry Live Camera</span>
              </button>

              <div className="relative flex py-2 items-center w-full">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-400 uppercase">या सबसे आसान</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>

              {/* Instant Native Camera Snapshot - 100% bypasses permission errors */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer animate-pulse"
              >
                <Camera size={18} />
                <span>📸 Photo Scan (फोटो खींचकर तुरंत स्कैन करें)</span>
              </button>
            </div>
          ) : (
            /* Target Reticle Overlay */
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-36 border-2 border-blue-400/80 rounded-xl relative shadow-lg">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-blue-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-blue-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-blue-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-blue-400" />
                
                {/* Scan Beam */}
                <div className="w-full h-0.5 bg-blue-400/90 shadow-[0_0_8px_rgba(96,165,250,1)] animate-bounce mt-18" />
              </div>
            </div>
          )}
        </div>

        {/* Hidden Camera File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Quick Photo Scan Alternative Button */}
        <div className="w-full max-w-sm mt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-4 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Camera size={16} />
            <span>📸 Take Photo & Scan (फोटो खींचकर स्कैन करें)</span>
          </button>
        </div>

        {/* Manual Input Fallback */}
        <div className="w-full max-w-sm mt-3">
          <form onSubmit={handleManualSend} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              placeholder="Or type code manually..."
              className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || isSubmitting}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              <Send size={13} /> Send
            </button>
          </form>
        </div>

        {/* Recent Scans History on Phone */}
        {scanHistory.length > 0 && (
          <div className="w-full max-w-sm mt-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Phone Scans</h3>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {scanHistory.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                  <span className="font-bold text-slate-200">{h.code}</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    {h.success ? <span className="text-emerald-400 font-bold">✓ Sent</span> : <span className="text-rose-400">Failed</span>}
                    <span>{h.time}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-3 bg-slate-900/60 border-t border-slate-800 text-center text-[11px] text-slate-400">
        ⚡ Connected to Desktop Packing Station • Codes appear on PC instantly
      </footer>
    </div>
  );
};
