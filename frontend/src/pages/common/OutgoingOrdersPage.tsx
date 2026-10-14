import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Order, ImportBatch } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { DateFilterSelect } from '../../components/common/DateFilterSelect';
import { DispatchBoxModal } from '../../components/dispatch/DispatchBoxModal';
import {
  Search,
  ArrowRight,
  Truck,
  Upload,
  FileSpreadsheet,
  PackageOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  BookOpen,
  ScanLine,
  Package,
  Zap,
  X,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { playSuccessChime, playErrorTone, playOrderCompleteFanfare } from '../../utils/sound';

export const OutgoingOrdersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Queue Statistics (Live summary)
  const [queueStats, setQueueStats] = useState({
    totalOrders: 0,
    totalRequiredCopies: 0,
    totalDispatchedCopies: 0,
    totalPendingCopies: 0,
  });

  // Filter States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [batchId, setBatchId] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Available Excel Import Batches
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);

  // Dispatch Box Modal State
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [isDispatchBoxOpen, setIsDispatchBoxOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete ALL existing orders, batches, and dispatch history? This will completely reset the database.'
    );
    if (!confirmed) return;

    setIsClearing(true);
    try {
      await api.post('/orders/clear-all');
      alert('All orders and data have been wiped successfully.');
      fetchOutgoingOrders(1);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to clear orders.');
    } finally {
      setIsClearing(false);
    }
  };

  // ─── Global Scanner State ────────────────────────────────────────────────────
  const [scannerCode, setScannerCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedOrder, setLastScannedOrder] = useState<any>(null);
  const [scanResult, setScanResult] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    scanType?: string;
    studentName?: string;
    trackingId?: string;
    itemsDispatched?: number;
  }>({ type: null, message: '' });
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimerRef = useRef<any>(null);

  // Clear auto-close timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // Auto-focus barcode scanner input perpetually for hands-free scanning
  useEffect(() => {
    const focusTimer = setInterval(() => {
      if (!isDispatchBoxOpen) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'select') {
          scanInputRef.current?.focus();
        }
      }
    }, 1200);
    return () => clearInterval(focusTimer);
  }, [isDispatchBoxOpen]);

  const handleGlobalScan = useCallback(async (code: string) => {
    if (!code.trim() || isScanning) return;
    const cleanCode = code.trim().toUpperCase();

    // Cancel any pending auto-close timers when a new scan starts
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    setIsScanning(true);
    setScanResult({ type: null, message: '' });

    try {
      // If code starts with ORD- or UNQ-, it's a new Order Code scan (do not pass active orderId)
      const isNewOrderCode = cleanCode.startsWith('ORD-') || cleanCode.startsWith('UNQ-');
      const activeOrderId = !isNewOrderCode && lastScannedOrder?.id && lastScannedOrder.totalPending > 0
        ? lastScannedOrder.id
        : undefined;

      const res = await api.post('/dispatch/verify', {
        enteredCode: cleanCode,
        orderId: activeOrderId,
      });

      if (res.data.success) {
        const data = res.data.data;
        let scanType = '📖 Book Code';
        if (data.scanType === 'ORDER_LOADED') {
          scanType = '🔖 Order Loaded';
        } else if (data.scanType === 'ORDER_CODE') {
          scanType = '🔖 Order Dispatched';
        } else if (data.scanType === 'PRODUCT_CODE') {
          scanType = '📦 Product Verified';
        }

        const updatedOrder = data.order;
        const isComplete = updatedOrder ? updatedOrder.totalPending === 0 : false;
        const isLoadedOnly = data.scanType === 'ORDER_LOADED';

        // Play audio feedback
        if (soundEnabled) {
          if (isComplete && !isLoadedOnly) {
            playOrderCompleteFanfare();
          } else {
            playSuccessChime();
          }
        }

        if (updatedOrder) {
          setLastScannedOrder({
            id: updatedOrder.id,
            orderCode: updatedOrder.orderCode,
            productCode: updatedOrder.productCode,
            studentName: updatedOrder.studentName,
            mobileNumber: updatedOrder.mobileNumber,
            trackingId: updatedOrder.trackingId,
            status: updatedOrder.status,
            scanType,
            message: data.message,
            itemsDispatched: data.itemsDispatched || 0,
            totalRequired: updatedOrder.totalRequired,
            totalDispatched: updatedOrder.totalDispatched,
            totalPending: updatedOrder.totalPending,
            items: updatedOrder.items || [],
          });

          // Live update orders list in table
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? {
            ...o,
            totalDispatched: updatedOrder.totalDispatched,
            totalPending: updatedOrder.totalPending,
            status: updatedOrder.status,
            items: updatedOrder.items || o.items,
          } : o));
        }

        const countDispatched = data.itemsDispatched || 0;
        if (countDispatched > 0) {
          setQueueStats(prev => ({
            ...prev,
            totalDispatchedCopies: prev.totalDispatchedCopies + countDispatched,
            totalPendingCopies: Math.max(0, prev.totalPendingCopies - countDispatched),
          }));
        }

        setScanResult({
          type: 'success',
          message: data.message,
          scanType,
          studentName: updatedOrder?.studentName,
          trackingId: updatedOrder?.trackingId,
          itemsDispatched: countDispatched > 0 ? countDispatched : undefined,
        });

        // 🌟 Auto-close preview card and feedback after 2.5 seconds when the order is DONE / fully dispatched
        if (isComplete && !isLoadedOnly) {
          autoCloseTimerRef.current = setTimeout(() => {
            setLastScannedOrder(null);
            setScanResult({ type: null, message: '' });
          }, 2500);
        }
      }
    } catch (err: any) {
      if (soundEnabled) playErrorTone();
      setScanResult({
        type: 'error',
        message: err.response?.data?.message || `Code "${cleanCode}" could not be verified or has no pending books.`,
      });
      // Auto-dismiss error alert after 3.5 seconds so employee screen stays clean
      autoCloseTimerRef.current = setTimeout(() => {
        setScanResult({ type: null, message: '' });
      }, 3500);
    } finally {
      setIsScanning(false);
      setScannerCode('');
      // Instantly refocus so employee never touches keyboard or mouse
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 50);
    }
  }, [isScanning, soundEnabled, lastScannedOrder]);

  const handleManualFinish = async () => {
    if (!lastScannedOrder?.id || isScanning) return;
    setIsScanning(true);
    try {
      const res = await api.post('/dispatch/verify', {
        action: 'MANUAL_FINISH_ORDER',
        orderId: lastScannedOrder.id,
      });
      if (res.data.success) {
        if (soundEnabled) playSuccessChime();
        const data = res.data.data;
        const updatedOrder = data.order;
        if (updatedOrder) {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? {
            ...o,
            totalDispatched: updatedOrder.totalDispatched,
            totalPending: updatedOrder.totalPending,
            status: updatedOrder.status,
            items: updatedOrder.items || o.items,
          } : o));
        }
        setScanResult({
          type: 'success',
          message: res.data.message,
          scanType: '📦 Partial Order Finished',
          studentName: updatedOrder?.studentName,
          trackingId: updatedOrder?.trackingId,
        });
        autoCloseTimerRef.current = setTimeout(() => {
          setLastScannedOrder(null);
          setScanResult({ type: null, message: '' });
        }, 2500);
      }
    } catch (err: any) {
      if (soundEnabled) playErrorTone();
      setScanResult({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update order.',
      });
    } finally {
      setIsScanning(false);
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  const handleQuickDispatchAll = async () => {
    if (!lastScannedOrder?.id || isScanning) return;
    setIsScanning(true);
    try {
      const res = await api.post('/dispatch/verify', {
        action: 'QUICK_DISPATCH_ALL',
        orderId: lastScannedOrder.id,
      });
      if (res.data.success) {
        if (soundEnabled) playOrderCompleteFanfare();
        const data = res.data.data;
        const updatedOrder = data.order;
        if (updatedOrder) {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? {
            ...o,
            totalDispatched: updatedOrder.totalDispatched,
            totalPending: updatedOrder.totalPending,
            status: updatedOrder.status,
            items: updatedOrder.items || o.items,
          } : o));
          setLastScannedOrder((prev: any) => prev ? {
            ...prev,
            totalDispatched: updatedOrder.totalDispatched,
            totalPending: 0,
            status: 'COMPLETED',
            items: updatedOrder.items,
          } : null);
        }
        setScanResult({
          type: 'success',
          message: res.data.message,
          scanType: '⚡ Quick Dispatched',
          studentName: updatedOrder?.studentName,
          trackingId: updatedOrder?.trackingId,
        });
        autoCloseTimerRef.current = setTimeout(() => {
          setLastScannedOrder(null);
          setScanResult({ type: null, message: '' });
        }, 2500);
      }
    } catch (err: any) {
      if (soundEnabled) playErrorTone();
      setScanResult({
        type: 'error',
        message: err.response?.data?.message || 'Failed to dispatch all items.',
      });
    } finally {
      setIsScanning(false);
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  // Auto-trigger verification as soon as number/code is entered (no Enter click required)
  useEffect(() => {
    const trimmed = scannerCode.trim().toUpperCase();
    if (!trimmed || isScanning) return;

    // 1. Instant trigger if complete Order Code format (ORD-YYMM-NNNNN or UNQ-YYMM-NNNNN, 14 chars)
    if (/^(ORD|UNQ)-\d{4}-\d{5}$/i.test(trimmed)) {
      handleGlobalScan(trimmed);
      return;
    }

    // If user is currently typing an Order Code prefix, DO NOT fire prematurely!
    if (trimmed.startsWith('ORD') || trimmed.startsWith('UNQ')) {
      return;
    }

    // 2. Active Order Context: Check against loaded order's Product Code & Book Codes
    if (lastScannedOrder && lastScannedOrder.totalPending > 0) {
      const activeProdCode = lastScannedOrder.productCode?.toUpperCase();
      const activeBookCodes = (lastScannedOrder.items || []).map((i: any) => i.bookCode?.toUpperCase()).filter(Boolean);

      // A. Instant 0ms trigger if exact match with Product Code or any Book Code
      if (activeProdCode && trimmed === activeProdCode) {
        handleGlobalScan(trimmed);
        return;
      }
      if (activeBookCodes.includes(trimmed)) {
        handleGlobalScan(trimmed);
        return;
      }

      // B. Prefix protection: If user is actively typing a prefix of product code or any book code, DO NOT trigger!
      if (activeProdCode && activeProdCode.startsWith(trimmed)) {
        return;
      }
      if (activeBookCodes.some((bc: string) => bc.startsWith(trimmed))) {
        return;
      }
    }

    // Avoid premature firing for incomplete prefixes
    if (['PRD', 'PRD-', 'BK', 'BK-'].includes(trimmed)) {
      return;
    }

    // 3. Fallback auto-trigger for non-matching codes or external scanner guns (after 800ms typing pause)
    if (trimmed.length >= 5) {
      const timer = setTimeout(() => {
        handleGlobalScan(trimmed);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [scannerCode, isScanning, handleGlobalScan, lastScannedOrder]);

  // Load available Excel batches for filter dropdown
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.get('/imports?limit=30');
        if (res.data.success) {
          setImportBatches(res.data.data.batches || []);
        }
      } catch {
        // Silently ignore if employee has restricted access to imports endpoint
      }
    };
    fetchBatches();
  }, []);

  const fetchOutgoingOrders = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '10');
      if (search) params.append('search', search);
      if (status !== 'ALL') params.append('status', status);
      if (batchId) params.append('batchId', batchId);
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/orders/outgoing?${params.toString()}`);
      if (res.data.success) {
        const fetchedOrders: Order[] = res.data.data.orders;
        setOrders(fetchedOrders);
        setPagination(res.data.data.pagination);

        if (res.data.data.stats) {
          setQueueStats(res.data.data.stats);
        } else {
          const reqCount = fetchedOrders.reduce((acc, o) => acc + o.totalRequired, 0);
          const dispCount = fetchedOrders.reduce((acc, o) => acc + o.totalDispatched, 0);
          setQueueStats({
            totalOrders: res.data.data.pagination.total,
            totalRequiredCopies: reqCount,
            totalDispatchedCopies: dispCount,
            totalPendingCopies: Math.max(0, reqCount - dispCount),
          });
        }
      }
    } catch (err) {
      console.error('Failed to load outgoing orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOutgoingOrders(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, status, batchId, dateFilter, startDate, endDate]);

  const handleOpenDispatchBox = (order: Order) => {
    setSelectedOrderForDispatch(order);
    setIsDispatchBoxOpen(true);
  };

  const handleCloseDispatchBox = () => {
    setIsDispatchBoxOpen(false);
    setSelectedOrderForDispatch(null);
  };

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setSelectedOrderForDispatch(updatedOrder);
    setQueueStats((prev) => ({
      ...prev,
      totalDispatchedCopies: prev.totalDispatchedCopies + 1,
      totalPendingCopies: Math.max(0, prev.totalPendingCopies - 1),
    }));
  };

  const pendingOrdersList = orders.filter((o) => o.totalPending > 0);
  const currentPendingIndex = selectedOrderForDispatch
    ? pendingOrdersList.findIndex((o) => o.id === selectedOrderForDispatch.id)
    : -1;
  const nextOrder =
    currentPendingIndex >= 0 && currentPendingIndex < pendingOrdersList.length - 1
      ? pendingOrdersList[currentPendingIndex + 1]
      : pendingOrdersList.find((o) => o.id !== selectedOrderForDispatch?.id);

  const handleProceedNextOrder = () => {
    if (nextOrder) {
      setSelectedOrderForDispatch(nextOrder);
    } else {
      handleCloseDispatchBox();
    }
  };

  const baseOrderUrl = isAdmin ? '/admin/orders' : '/employee/orders';

  return (
    <div className="space-y-6">
      {/* ─── Global Scanner Box ───────────────────────────────────────────────── */}
      <div className={`rounded-xl border-2 p-4 transition-all shadow-xs ${
        scanResult.type === 'success' ? 'border-emerald-400 bg-emerald-50/70' :
        scanResult.type === 'error' ? 'border-rose-400 bg-rose-50/70' :
        'border-blue-300 bg-blue-50/60'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ScanLine size={20} className="text-blue-600 animate-pulse" />
            <span className="font-bold text-blue-900 text-sm">3-Tier Global Barcode Scanner Station</span>
            <span className="text-xs text-blue-700 bg-blue-100 font-semibold px-2.5 py-0.5 rounded-full">
              Hands-Free Continuous Scanning Active
            </span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 shadow-2xs"
            title="Toggle Scan Sound Feedback"
          >
            {soundEnabled ? <Volume2 size={14} className="text-emerald-600" /> : <VolumeX size={14} className="text-slate-400" />}
            <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={scanInputRef}
              type="text"
              value={scannerCode}
              onChange={e => setScannerCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter' && scannerCode.trim()) handleGlobalScan(scannerCode); }}
              placeholder={
                lastScannedOrder && lastScannedOrder.totalPending > 0
                  ? `⚡ Step 2: Now scan Product Barcode (${lastScannedOrder.productCode || 'PRD-...'}) or individual Book Barcodes...`
                  : "⚡ Step 1: Aim scanner at Student Order Barcode (ORD-...) to load details..."
              }
              className="w-full px-4 py-3.5 text-sm font-mono border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 bg-white shadow-xs font-bold"
              autoFocus
              disabled={isScanning}
            />
            {scannerCode && (
              <button onClick={() => setScannerCode('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={16} className="text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <button
            onClick={() => handleGlobalScan(scannerCode)}
            disabled={!scannerCode.trim() || isScanning}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold flex items-center gap-2 shrink-0 shadow-xs"
          >
            <Zap size={16} /> {isScanning ? 'Verifying...' : lastScannedOrder && lastScannedOrder.totalPending > 0 ? 'Verify Item' : 'Load Order'}
          </button>
        </div>

        {/* Scan Result Feedback */}
        {scanResult.type && (
          <div className={`mt-3 p-3.5 rounded-lg text-sm font-medium border flex items-start justify-between gap-3 ${
            scanResult.type === 'success' ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950' : 'bg-rose-100/90 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-start gap-3 flex-1">
              <span className="text-xl shrink-0 mt-0.5">{scanResult.type === 'success' ? '✅' : '❌'}</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {scanResult.scanType && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-current shadow-2xs">
                      {scanResult.scanType}
                    </span>
                  )}
                  <span className="font-semibold">{scanResult.message}</span>
                </div>
                {scanResult.studentName && (
                  <div className="text-xs mt-1.5 flex flex-wrap gap-4 text-emerald-900 font-medium">
                    <span>Student: <strong>{scanResult.studentName}</strong></span>
                    {scanResult.trackingId && <span>Tracking ID: <strong className="font-mono">{scanResult.trackingId}</strong></span>}
                    {scanResult.itemsDispatched !== undefined && <span>Copies Dispatched: <strong>{scanResult.itemsDispatched}</strong></span>}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
                setScanResult({ type: null, message: '' });
              }}
              className="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-white/50 transition-colors shrink-0"
              title="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Hint */}
        <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-blue-700 font-medium">
          <span className="flex items-center gap-1"><Tag size={13} className="text-emerald-700" /> <strong>Step 1</strong>: Scan <strong>ORD-YYMM-NNNNN</strong> to load order</span>
          <span className="flex items-center gap-1"><Package size={13} className="text-purple-700" /> <strong>Step 2 (Combo)</strong>: Scan <strong>Product Barcode</strong> to tick & dispatch all books</span>
          <span className="flex items-center gap-1"><BookOpen size={13} className="text-blue-700" /> <strong>Step 2 (Single)</strong>: Scan individual <strong>Book Barcodes</strong> to tick one-by-one</span>
        </div>

        {/* ─── Zero-Click Live Verification Deck (Shows immediately on scan) ──── */}
        {lastScannedOrder && (
          <div className="mt-4 bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-700 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-mono text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded">
                  {lastScannedOrder.trackingId}
                </span>
                <span className="text-lg font-bold text-white">
                  {lastScannedOrder.studentName}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  📞 {lastScannedOrder.mobileNumber}
                </span>
                {lastScannedOrder.orderCode && (
                  <span className="text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-600 px-2.5 py-1 rounded font-bold">
                    🔖 {lastScannedOrder.orderCode}
                  </span>
                )}
                {lastScannedOrder.productCode && (
                  <span className="text-xs font-mono bg-purple-950 text-purple-300 border border-purple-600 px-2.5 py-1 rounded font-bold">
                    📦 {lastScannedOrder.productCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  lastScannedOrder.totalPending === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {lastScannedOrder.totalPending === 0 ? '✓ Order Completed (Auto-closing...)' : 'In Progress'}
                </span>
                <button
                  onClick={() => {
                    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
                    setLastScannedOrder(null);
                    setScanResult({ type: null, message: '' });
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                  title="Close preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Metric counters: Total Required, Dispatched, Remaining */}
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Required</div>
                <div className="text-2xl font-black text-white font-mono mt-0.5">{lastScannedOrder.totalRequired}</div>
              </div>
              <div className="bg-emerald-950/40 rounded-xl p-3 border border-emerald-800/60">
                <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Dispatched</div>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{lastScannedOrder.totalDispatched}</div>
              </div>
              <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/60">
                <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Remaining Left</div>
                <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">{lastScannedOrder.totalPending}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${lastScannedOrder.totalRequired > 0
                    ? Math.round((lastScannedOrder.totalDispatched / lastScannedOrder.totalRequired) * 100)
                    : 0}%`
                }}
              />
            </div>

            {/* ─── 1. Dedicated Product Code Verification Box ──── */}
            {lastScannedOrder.productCode && (() => {
              const isProductDone = lastScannedOrder.items
                .filter((i: any) => !i.productCode || i.productCode === lastScannedOrder.productCode)
                .every((i: any) => i.dispatchedQuantity >= i.requiredQuantity);
              return (
                <div className={`mb-4 p-4 rounded-xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isProductDone
                    ? 'bg-emerald-950/60 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                    : 'bg-purple-950/40 border-purple-500/70 shadow-sm'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                      isProductDone ? 'bg-emerald-500 text-slate-950' : 'bg-purple-600 text-white'
                    }`}>
                      <Package size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Product Package Code (Combo)</span>
                        <span className="text-xs bg-purple-900/80 text-purple-200 border border-purple-600 px-2 py-0.5 rounded font-mono font-bold">
                          {lastScannedOrder.productCode}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white mt-0.5">
                        {isProductDone
                          ? `All ${lastScannedOrder.items.length} book(s) in combo verified & dispatched`
                          : `Scan product barcode or click mark to verify & dispatch all combo books`}
                      </div>
                    </div>
                  </div>

                  {/* Verification Mark / Box for Product */}
                  <div className="shrink-0">
                    {isProductDone ? (
                      <div className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md">
                        <CheckCircle2 size={18} className="text-slate-950" />
                        <span>Code Verified & Done</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGlobalScan(lastScannedOrder.productCode)}
                        disabled={isScanning}
                        className="flex items-center gap-2.5 bg-purple-600 hover:bg-purple-500 text-white border-2 border-purple-400 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:scale-102 cursor-pointer group disabled:opacity-50"
                        title="Scan product barcode or click this mark to verify and dispatch entire combo"
                      >
                        <div className="w-5 h-5 rounded-md border-2 border-white/70 group-hover:border-white flex items-center justify-center bg-purple-700/50">
                          {/* Unchecked square box */}
                        </div>
                        <span>Scan or Click Mark to Verify & Done</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ─── 2. Dedicated Individual Book Codes Verification Boxes ──── */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Individual Book Codes ({lastScannedOrder.items.length} titles)</span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {lastScannedOrder.totalPending === 0 ? '✓ All Books Verified & Done' : 'Scan book barcode or click mark to verify & dispatch'}
                </span>
              </div>
              <div className="space-y-2">
                {lastScannedOrder.items.map((item: any, i: number) => {
                  const isDone = item.dispatchedQuantity >= item.requiredQuantity;
                  return (
                    <div
                      key={item.id || i}
                      className={`p-3.5 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isDone
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/40'
                          : 'bg-slate-800/90 border-slate-700 hover:border-slate-600 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                          isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-700 text-slate-300'
                        }`}>
                          <BookOpen size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-base">{item.bookCode}</span>
                            <span className="text-xs text-slate-400 font-mono">Qty: {item.dispatchedQuantity}/{item.requiredQuantity}</span>
                          </div>
                          <div className="text-slate-300 text-xs mt-0.5">{item.bookName}</div>
                        </div>
                      </div>

                      {/* Verification Mark / Box for Book */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-3.5 py-2 rounded-lg font-bold text-xs shadow-xs">
                            <CheckCircle2 size={16} className="text-slate-950" />
                            <span>Code Verified & Done ({item.dispatchedQuantity}/{item.requiredQuantity})</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGlobalScan(item.bookCode)}
                            disabled={isScanning}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white border border-slate-600 hover:border-blue-400 px-3.5 py-2 rounded-lg font-bold text-xs transition-all hover:scale-102 cursor-pointer group disabled:opacity-50"
                            title={`Scan barcode or click mark to verify & dispatch ${item.bookCode}`}
                          >
                            <div className="w-4 h-4 rounded border-2 border-slate-400 group-hover:border-white flex items-center justify-center bg-slate-900/50">
                              {/* Unchecked square box */}
                            </div>
                            <span>Scan or Click Mark to Verify ({item.dispatchedQuantity}/{item.requiredQuantity})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons for manual or quick dispatch */}
              {lastScannedOrder.totalPending > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">
                    ⚡ Aim scanner gun at <strong>Product Barcode</strong> or <strong>Book Barcodes</strong> to verify each item.
                  </div>
                  <div className="flex items-center gap-2">
                    {lastScannedOrder.totalDispatched > 0 && (
                      <button
                        onClick={handleManualFinish}
                        disabled={isScanning}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                        title="Dispatch only scanned books, keep remaining as Pending"
                      >
                        <CheckCircle2 size={14} />
                        Finish Partial Order ({lastScannedOrder.totalDispatched}/{lastScannedOrder.totalRequired})
                      </button>
                    )}
                    <button
                      onClick={handleQuickDispatchAll}
                      disabled={isScanning}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Quickly dispatch all remaining books for this order without scanning"
                    >
                      <Zap size={14} />
                      Quick Dispatch All Books
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Outgoing Sheet
            </h1>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
              Active Dispatch Station
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time book verification queue: click any order to open its Dispatch Box & scan books one by one.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAllData}
              disabled={isClearing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              title="Delete all current orders and reset database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isClearing ? 'Clearing...' : 'Clear All Orders'}
            </button>
            <Link to="/admin/upload-excel">
              <Button variant="primary" size="sm" icon={<Upload className="w-4 h-4" />}>
                Upload New Excel Sheet
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Top Real-time Queue Statistics Cards ("total count mese ek kam hoge") */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Orders In Queue
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {pagination.total}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Books Required
            </div>
            <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">
              {queueStats.totalRequiredCopies}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Dispatched Books
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
              {queueStats.totalDispatchedCopies}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4.5 border border-amber-200/80 bg-amber-50/20 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Pending Books Remaining
            </div>
            <div className="text-2xl font-black text-amber-600 font-mono mt-0.5">
              {queueStats.totalPendingCopies}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, tracking ID, mobile, book code..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Excel Batch ("jo exel upload kare vo outgoing sheet me bhi dekhna chahiye") */}
            {importBatches.length > 0 && (
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[200px] truncate"
                title="Filter by uploaded Excel sheet"
              >
                <option value="">All Uploaded Excel Sheets</option>
                {importBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    📄 {b.originalFileName}
                  </option>
                ))}
              </select>
            )}

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Active (Pending & Partial)</option>
              <option value="PENDING">Pending Only</option>
              <option value="PARTIALLY_DISPATCHED">Partially Dispatched</option>
              <option value="COMPLETED">Completed Orders</option>
            </select>

            <DateFilterSelect
              filter={dateFilter}
              startDate={startDate}
              endDate={endDate}
              onChange={(f, s, e) => {
                setDateFilter(f);
                if (s !== undefined) setStartDate(s);
                if (e !== undefined) setEndDate(e);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Outgoing Orders Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading outgoing orders sheet..." />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders found in outgoing sheet"
            description="Either all books are already dispatched, or no orders match your search filters."
            icon={<Truck className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Student & Contact</th>
                    <th className="py-3 px-4">Order Code (Tier 1)</th>
                    <th className="py-3 px-4">Product Code (Tier 2)</th>
                    <th className="py-3 px-4">Tracking ID</th>
                    <th className="py-3 px-4">Books Required (Tier 3)</th>
                    <th className="py-3 px-4 text-center">Required</th>
                    <th className="py-3 px-4 text-center">Dispatched</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Dispatch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const isPending = order.totalPending > 0;
                    return (
                      <tr
                        key={order.id}
                        className={`transition-colors ${
                          isPending ? 'hover:bg-blue-50/40' : 'hover:bg-slate-50/60 opacity-85'
                        }`}
                      >
                        {/* Student Name & Mobile */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{order.studentName}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {order.mobileNumber}
                          </div>
                        </td>

                        {/* Order Unique Code */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-300 inline-flex items-center gap-1 shadow-2xs" title="Order Unique Barcode (Tier 1)">
                            🔖 {order.orderCode || 'ORD-GEN'}
                          </span>
                        </td>

                        {/* Product Code */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded border border-purple-300 inline-flex items-center gap-1 shadow-2xs" title="Product Combo Barcode (Tier 2)">
                            📦 {order.productCode || 'PRD-01'}
                          </span>
                        </td>

                        {/* Tracking ID */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs inline-block">
                            {order.trackingId}
                          </span>
                        </td>

                        {/* Books Preview Pills */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {order.items.map((it) => (
                              <span
                                key={it.id}
                                className={`text-[11px] font-mono px-2 py-1 rounded font-semibold border flex items-center gap-1 shadow-2xs ${
                                  it.pendingQuantity === 0
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                                title={`${it.bookName} (${it.pendingQuantity} pending)`}
                              >
                                📖 {it.bookCode}
                                {it.requiredQuantity > 1 ? ` ×${it.requiredQuantity}` : ''}
                                {it.pendingQuantity > 0 && it.dispatchedQuantity > 0 ? ` (${it.pendingQuantity} left)` : ''}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Total Counts */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {order.totalRequired}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                          {order.totalDispatched}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                          {order.totalPending}
                        </td>

                        {/* Order Status */}
                        <td className="py-3 px-4">
                          <Badge status={order.status} />
                        </td>

                        {/* Action: Open Dispatch Box / Details ("har order ke samne click karne par vha ek box open ho") */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant={isPending ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => handleOpenDispatchBox(order)}
                              icon={<PackageOpen className="w-3.5 h-3.5" />}
                            >
                              {isPending ? 'Dispatch Box' : 'View Box'}
                            </Button>

                            <Link to={`${baseOrderUrl}/${order.id}`} title="View Full Order Details">
                              <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.total}
              onPageChange={(p) => fetchOutgoingOrders(p)}
            />
          </div>
        )}
      </Card>

      {/* DISPATCH BOX MODAL */}
      <DispatchBoxModal
        isOpen={isDispatchBoxOpen}
        onClose={handleCloseDispatchBox}
        order={selectedOrderForDispatch}
        onOrderUpdated={handleOrderUpdated}
        onProceedNextOrder={handleProceedNextOrder}
        hasNextOrder={!!nextOrder}
      />
    </div>
  );
};
