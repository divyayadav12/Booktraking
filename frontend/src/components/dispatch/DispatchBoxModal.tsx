import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Order, OrderItem } from '../../types';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Barcode,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  PackageCheck,
  User,
  Phone,
  Hash,
  FileSpreadsheet,
  ArrowRight,
  Volume2,
  VolumeX,
  History,
  RotateCcw,
} from 'lucide-react';
import { playSuccessChime, playErrorTone, playOrderCompleteFanfare, speakVoiceAnnouncement, speakVoiceTwice, speakErrorMessage } from '../../utils/sound';

interface DispatchBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onOrderUpdated?: (updatedOrder: Order) => void;
  onProceedNextOrder?: () => void;
  hasNextOrder?: boolean;
}

export const DispatchBoxModal: React.FC<DispatchBoxModalProps> = ({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
  onProceedNextOrder,
  hasNextOrder = false,
}) => {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastDispatchedItemId, setLastDispatchedItemId] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<
    Array<{ id: string; code: string; bookName: string; timestamp: string }>
  >([]);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'completed' | null;
    message: string;
    bookTitle?: string;
    bookCode?: string;
  }>({ type: null, message: '' });

  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize activeOrder whenever order prop changes or modal opens
  useEffect(() => {
    if (order) {
      setActiveOrder(order);
      setEnteredCode('');
      setFeedback({ type: null, message: '' });
      setLastDispatchedItemId(null);
      setScanHistory([]);
    }
  }, [order, isOpen]);

  // Focus input automatically whenever modal opens or an item is scanned
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeOrder?.totalPending]);

  if (!activeOrder) return null;

  const totalRequired = activeOrder.totalRequired;
  const totalDispatched = activeOrder.totalDispatched;
  const totalPending = activeOrder.totalPending;
  const isOrderFullyCompleted = totalPending === 0;
  const completionPercentage =
    totalRequired > 0 ? Math.round((totalDispatched / totalRequired) * 100) : 0;

  const handleScanOrSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = enteredCode.trim().toUpperCase();

    if (!code || isVerifying || isOrderFullyCompleted) return;

    setIsVerifying(true);
    setFeedback({ type: null, message: '' });

    const idempotencyKey = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await api.post('/dispatch/verify', {
        orderId: activeOrder.id,
        enteredCode: code,
        enteredBookCode: code,
        requestId: idempotencyKey,
      });

      if (res.data.success) {
        const isOrderScan = res.data.data.scanType === 'ORDER_CODE';
        const isProductScan = res.data.data.scanType === 'PRODUCT_CODE';
        const isBulkScan = isOrderScan || isProductScan;
        const updatedOrderData: Order = res.data.data.order;
        const updatedItemData: OrderItem | undefined = res.data.data.orderItem;

        setActiveOrder(updatedOrderData);
        if (updatedItemData) {
          setLastDispatchedItemId(updatedItemData.id);
        }

        // Add to live scan log
        const logBookName = isOrderScan
          ? `All order books dispatched (${res.data.data.itemsDispatched} items)`
          : isProductScan
          ? `Product books dispatched (${res.data.data.itemsDispatched} items)`
          : (updatedItemData?.bookName || 'Book');

        const newLogEntry = {
          id: idempotencyKey,
          code: isOrderScan
            ? (res.data.data.orderCode || code)
            : isProductScan
            ? (res.data.data.productCode || code)
            : (updatedItemData?.bookCode || code),
          bookName: logBookName,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: true }),
        };
        setScanHistory((prev) => [newLogEntry, ...prev.slice(0, 9)]);

        // Notify parent sheet/table for instant synchronization
        if (onOrderUpdated) {
          onOrderUpdated(updatedOrderData);
        }

        const orderIsNowComplete = updatedOrderData.totalPending === 0;

        if (orderIsNowComplete || isBulkScan) {
          if (soundEnabled) {
            playOrderCompleteFanfare();
            speakVoiceTwice('Order of upcoming CA is fulfilled at FAST Education. Next order please.');
          }
          setFeedback({
            type: 'completed',
            message: res.data.data.message || `All books for ${activeOrder.studentName} have been verified & dispatched! Order Complete.`,
            bookTitle: isOrderScan
              ? 'Entire Order Dispatched'
              : isProductScan
              ? 'Product Dispatched'
              : updatedItemData?.bookName,
            bookCode: isOrderScan
              ? (res.data.data.orderCode || code)
              : isProductScan
              ? (res.data.data.productCode || code)
              : updatedItemData?.bookCode,
          });
        } else {
          if (soundEnabled) playSuccessChime();
          const remainingMsg =
            updatedItemData && updatedItemData.pendingQuantity > 0
              ? `${updatedItemData.pendingQuantity} copy remaining for this book`
              : 'All copies for this book dispatched';

          setFeedback({
            type: 'success',
            message: res.data.data.message || `1 copy of "${updatedItemData?.bookCode}" dispatched successfully! (${remainingMsg})`,
            bookTitle: updatedItemData?.bookName,
            bookCode: updatedItemData?.bookCode,
          });
        }

        // Reset code input for the next physical book scan
        setEnteredCode('');
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message ||
        `Warning: Book code "${code}" does not match any pending books for this student order.`;

      if (soundEnabled) {
        playErrorTone();
        speakErrorMessage(serverMsg);
      }

      setFeedback({
        type: 'warning',
        message: serverMsg,
      });

      // Highlight input so user can re-scan or fix
      setTimeout(() => {
        inputRef.current?.select();
      }, 50);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickCodeFill = (codeToFill: string) => {
    setEnteredCode(codeToFill);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Book Dispatch & Barcode Verification Box"
      subtitle="Scan or enter book codes one by one to verify and decrement remaining quantities"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* ─── HIGHLIGHTED: KIS CHEEJ KA ORDER HAI (BIG FONT & HIGHLIGHT) ─── */}
        <div className="p-4.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-xl border-2 border-red-300 ring-2 ring-red-500/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/20 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-red-100">
                ORDER ITEM / COURSE (किस चीज़ का आर्डर है)
              </span>
            </div>
            <span className="text-xs font-bold bg-white text-red-700 px-3 py-1 rounded-full shadow-xs">
              {activeOrder.items?.length || 0} {(activeOrder.items?.length || 0) === 1 ? 'Book' : 'Books'} in Package
            </span>
          </div>

          {/* Big Font Highlighted Item Name */}
          <div className="space-y-2">
            {(() => {
              const productNames = Array.from(new Set(activeOrder.items?.map((i: any) => i.productName).filter(Boolean) || []));
              if (productNames.length > 0) {
                return (
                  <div className="text-2xl sm:text-3xl font-black text-white tracking-wide leading-tight drop-shadow-md">
                    📦 {productNames.join(' + ')}
                  </div>
                );
              }
              return null;
            })()}

            {/* Book Titles in Big Highlighted Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {activeOrder.items?.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/25 flex items-center gap-2 shadow-sm"
                >
                  <span className="text-sm sm:text-base font-black text-white">{item.bookName}</span>
                  <span className="font-mono text-xs font-bold bg-yellow-400 text-slate-950 px-2 py-0.5 rounded">
                    {item.bookCode}
                  </span>
                  <span className="text-xs text-red-100 font-semibold">
                    ({item.dispatchedQuantity}/{item.requiredQuantity})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Order Information Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4.5 shadow-md border border-slate-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-400/30">
                  {activeOrder.trackingId}
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {activeOrder.studentName}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <strong className="font-mono">{activeOrder.mobileNumber}</strong>
                </span>
                {activeOrder.importBatch?.originalFileName && (
                  <span className="flex items-center gap-1 text-emerald-300 font-mono text-[11px] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-700/40">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    {activeOrder.importBatch.originalFileName}
                  </span>
                )}
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                  soundEnabled
                    ? 'bg-slate-700 text-red-300 hover:bg-slate-600'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title={soundEnabled ? 'Scanner Sound Enabled' : 'Scanner Sound Muted'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="text-[11px] hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
              </button>
              <Badge status={activeOrder.status} />
            </div>
          </div>

          {/* Real-time Order Quantities Bar ("total count mese ek kam hoge or us bache ki books mese bhi ek kaam hoge") */}
          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Total Required
              </span>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {totalRequired}
              </div>
            </div>

            <div className="bg-emerald-950/30 rounded-xl p-2.5 border border-emerald-800/40">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                Dispatched
              </span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                <span>{totalDispatched}</span>
                {totalDispatched > 0 && <span className="text-xs">✓</span>}
              </div>
            </div>

            <div className={`rounded-xl p-2.5 border ${
              totalPending === 0
                ? 'bg-emerald-900/40 border-emerald-600/50'
                : 'bg-amber-950/30 border-amber-800/40'
            }`}>
              <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">
                Child's Remaining
              </span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {totalPending}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium mb-1">
              <span>Student Dispatch Progress</span>
              <span>
                {completionPercentage}% ({totalDispatched} of {totalRequired} books)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700/80 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  isOrderFullyCompleted ? 'bg-emerald-400' : 'bg-red-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scan / Input Box Section ("fir vo us book ka code type karega ans vo match hoga to order ki book niklege ek kaam hoge") */}
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 shadow-inner">
          <form onSubmit={handleScanOrSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="book-code-input"
                className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Barcode className="w-4 h-4 text-red-600" />
                Scan or Type Physical Book Code
              </label>
              {totalPending > 0 && (
                <span className="text-[11px] text-slate-500 font-medium">
                  {totalPending} book{totalPending > 1 ? 's' : ''} left to dispatch
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                id="book-code-input"
                ref={inputRef}
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                placeholder={
                  isOrderFullyCompleted
                    ? 'All books for this order have been dispatched!'
                    : 'Type book code (e.g. QB101) & press Enter'
                }
                disabled={isVerifying || isOrderFullyCompleted}
                autoFocus
                className={`w-full pl-4 pr-32 py-3.5 rounded-xl font-mono font-bold text-base uppercase tracking-wide transition-all ${
                  isOrderFullyCompleted
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-white border-2 border-red-500/70 text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-red-100 focus:border-red-600'
                }`}
              />

              <div className="absolute right-2 flex items-center gap-1.5">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!enteredCode.trim() || isVerifying || isOrderFullyCompleted}
                  isLoading={isVerifying}
                >
                  Verify
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>Compatible with physical USB barcode scanners and keyboard entry.</span>
              <span>Press <kbd className="bg-white border border-slate-300 rounded px-1 text-[10px] font-mono">Enter ↵</kbd></span>
            </p>
          </form>

          {/* Quick-fill chips for pending books */}
          {!isOrderFullyCompleted && (
            <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 text-[11px] mr-1">Expected in this order:</span>
              {activeOrder.items
                .filter((item) => item.pendingQuantity > 0)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleQuickCodeFill(item.bookCode)}
                    className="font-mono text-[11px] font-bold bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:border-red-400 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                    title={`Click to fill ${item.bookCode}`}
                  >
                    <span>{item.bookCode}</span>
                    <span className="text-slate-400 font-normal">({item.pendingQuantity} left)</span>
                  </button>
                ))}
            </div>
          )}

          {/* Feedback Banners */}
          {feedback.type === 'completed' && (
            <div className="mt-3 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs flex items-center gap-3 animate-pulse">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">{feedback.message}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  You can now close this dispatch box or open the next student order in queue.
                </p>
              </div>
            </div>
          )}

          {feedback.type === 'success' && (
            <div className="mt-3 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="font-medium">{feedback.message}</div>
            </div>
          )}

          {feedback.type === 'warning' && (
            <div className="mt-3 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="font-medium">{feedback.message}</div>
            </div>
          )}
        </div>

        {/* Books Checklist for this student */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-semibold">
            <span>Books In This Order ({activeOrder.items.length} titles)</span>
            <span>Quantity Breakdown</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {activeOrder.items.map((item) => {
              const isDone = item.pendingQuantity === 0;
              const isJustScanned = lastDispatchedItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    isJustScanned
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
                      : isDone
                      ? 'bg-slate-50/70 border-slate-200 opacity-80'
                      : 'bg-white border-slate-200 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {isDone ? '✓' : item.dispatchedQuantity + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                          {item.bookCode}
                        </span>
                        <span className="font-semibold text-slate-800">{item.bookName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {item.requiredQuantity > 1 ? (
                          <span>
                            Multiple copies: {item.dispatchedQuantity} of {item.requiredQuantity} dispatched (
                            <strong className="text-slate-600">{item.pendingQuantity} remaining</strong>)
                          </span>
                        ) : (
                          <span>Single copy order</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Status Indicator */}
                  <div className="flex items-center gap-3 text-right">
                    <div className="font-mono text-xs">
                      <span className="text-emerald-600 font-bold">{item.dispatchedQuantity}</span>
                      <span className="text-slate-400"> / </span>
                      <span className="text-slate-700 font-bold">{item.requiredQuantity}</span>
                    </div>

                    <Badge status={item.status} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Scanned Activity for this session */}
        {scanHistory.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-[11px]">
            <div className="flex items-center justify-between text-slate-500 font-medium mb-1.5">
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-slate-400" /> Recent Scans in this Box
              </span>
              <span>{scanHistory.length} scan{scanHistory.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scanHistory.map((h) => (
                <span
                  key={h.id}
                  className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px]"
                >
                  ✓ {h.code} <span className="text-slate-400">({h.timestamp})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            {isOrderFullyCompleted
              ? 'Order is 100% complete. Student package ready to seal.'
              : 'Keep scanning until all books for this order are completed.'}
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              {isOrderFullyCompleted ? 'Done & Close' : 'Close Box'}
            </Button>

            {isOrderFullyCompleted && hasNextOrder && onProceedNextOrder && (
              <Button
                variant="primary"
                size="sm"
                onClick={onProceedNextOrder}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Next Pending Order
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
