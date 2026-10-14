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
} from 'lucide-react';

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

  // ─── Global Scanner State ────────────────────────────────────────────────────
  const [scannerCode, setScannerCode] = useState('');
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

  const handleGlobalScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setIsScanning(true);
    setScanResult({ type: null, message: '' });
    try {
      const res = await api.post('/dispatch/verify', { enteredCode: code.trim() });
      if (res.data.success) {
        const data = res.data.data;
        let scanType = '📖 Book Code';
        if (data.scanType === 'ORDER_CODE') {
          scanType = '🔖 Order Unique Code';
        } else if (data.scanType === 'PRODUCT_CODE') {
          scanType = '📦 Product Code';
        }

        setScanResult({
          type: 'success',
          message: data.message,
          scanType,
          studentName: data.order?.studentName,
          trackingId: data.order?.trackingId,
          itemsDispatched: data.itemsDispatched,
        });

        // Live update orders list
        if (data.order) {
          setOrders(prev => prev.map(o => o.id === data.order?.id ? {
            ...o,
            totalDispatched: data.order.totalDispatched,
            totalPending: data.order.totalPending,
            status: data.order.status,
            items: data.order.items || o.items,
          } : o));
        }

        const countDispatched = data.itemsDispatched || 1;
        setQueueStats(prev => ({
          ...prev,
          totalDispatchedCopies: prev.totalDispatchedCopies + countDispatched,
          totalPendingCopies: Math.max(0, prev.totalPendingCopies - countDispatched),
        }));
      }
    } catch (err: any) {
      setScanResult({
        type: 'error',
        message: err.response?.data?.message || 'Scan failed. Please try again.',
      });
    } finally {
      setIsScanning(false);
      setScannerCode('');
      // Auto-clear result after 5 seconds
      setTimeout(() => setScanResult({ type: null, message: '' }), 5000);
    }
  }, []);

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
        <div className="flex items-center gap-2 mb-3">
          <ScanLine size={20} className="text-blue-600" />
          <span className="font-bold text-blue-900 text-sm">3-Tier Global Barcode Scanner</span>
          <span className="text-xs text-blue-700 bg-blue-100 font-medium px-2.5 py-0.5 rounded-full">
            Ready for Barcode Scanner or Keyboard Input
          </span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={scanInputRef}
              type="text"
              value={scannerCode}
              onChange={e => setScannerCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter' && scannerCode.trim()) handleGlobalScan(scannerCode); }}
              placeholder="🔍 Scan Order Code (ORD-...), Product Code (PRD-...), or Book Code here..."
              className="w-full px-4 py-3 text-sm font-mono border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white shadow-xs"
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
            className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold flex items-center gap-2 shrink-0 shadow-xs"
          >
            <Zap size={16} /> {isScanning ? 'Scanning...' : 'Dispatch'}
          </button>
        </div>

        {/* Scan Result Feedback */}
        {scanResult.type && (
          <div className={`mt-3 p-3.5 rounded-lg text-sm font-medium border flex items-start gap-3 ${
            scanResult.type === 'success' ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950' : 'bg-rose-100/80 border-rose-300 text-rose-950'
          }`}>
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
        )}

        {/* Hint */}
        <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-blue-700 font-medium">
          <span className="flex items-center gap-1"><Tag size={13} className="text-emerald-700" /> <strong>ORD-YYMM-NNNNN</strong>: Dispatches all books for whole order</span>
          <span className="flex items-center gap-1"><Package size={13} className="text-purple-700" /> <strong>PRD-...</strong>: Dispatches all books under that product</span>
          <span className="flex items-center gap-1"><BookOpen size={13} className="text-blue-700" /> <strong>Book Code</strong>: Dispatches 1 book copy</span>
        </div>
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
                    <th className="py-3 px-4">Tracking ID</th>
                    <th className="py-3 px-4">Excel Source</th>
                    <th className="py-3 px-4">Books Required</th>
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

                        {/* Tracking ID, Order Code & Product Code */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {order.orderCode && (
                              <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300" title="Order Unique Code">
                                🔖 {order.orderCode}
                              </span>
                            )}
                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                              {order.trackingId}
                            </span>
                            {order.productCode && (
                              <span className="font-mono text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200" title="Product Code">
                                📦 {order.productCode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Excel Source File */}
                        <td className="py-3 px-4">
                          {order.importBatch?.originalFileName ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 max-w-[150px] truncate" title={order.importBatch.originalFileName}>
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{order.importBatch.originalFileName}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Direct Batch</span>
                          )}
                        </td>

                        {/* Books Preview Pills */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {order.items.map((it) => (
                              <span
                                key={it.id}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold border ${
                                  it.pendingQuantity === 0
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                                title={`${it.bookName}${it.productCode ? ` [Product: ${it.productCode}]` : ''} (${it.pendingQuantity} pending)`}
                              >
                                {it.productCode && <span className="text-purple-700 font-bold opacity-80">{it.productCode} • </span>}
                                {it.bookCode}
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
