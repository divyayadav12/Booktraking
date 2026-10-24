import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { Order, OrderItem } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  User,
  Phone,
  Mail,
  Hash,
  ShieldCheck,
  Clock,
  History,
  PackageOpen,
} from 'lucide-react';
import { DispatchBoxModal } from '../../components/dispatch/DispatchBoxModal';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDispatchBoxOpen, setIsDispatchBoxOpen] = useState(false);
  const [isMarkingEmailSent, setIsMarkingEmailSent] = useState(false);
  const [isRetryingWhatsApp, setIsRetryingWhatsApp] = useState(false);

  // Verification Modal State
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [enteredCode, setEnteredCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    type: 'success' | 'warning' | null;
    message: string;
  }>({ type: null, message: '' });

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchOrderDetail = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/orders/${id}`);
      if (res.data.success) {
        setOrder(res.data.data);
      }
    } catch (err: any) {
      toastError('Failed to load order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  // Focus input when modal opens
  useEffect(() => {
    if (selectedItem) {
      setEnteredCode('');
      setVerificationFeedback({ type: null, message: '' });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [selectedItem]);

  const handleOpenVerification = (item: OrderItem) => {
    if (item.pendingQuantity <= 0) {
      toastWarning('All copies of this book are already dispatched.');
      return;
    }
    setSelectedItem(item);
  };

  const handleMarkEmailSent = async () => {
    if (!id || !order || (order.emailSentAt && order.whatsappSentAt)) return;

    const confirmed = window.confirm(
      `Send or retry pending email/WhatsApp notifications for ${order.studentName}?`
    );

    if (!confirmed) return;

    setIsMarkingEmailSent(true);

    try {
      const res = await api.post(`/orders/${id}/mark-email-sent`);
      if (res.data.success) {
        const { emailDelivery, whatsappDelivery, emailSentAt, whatsappSentAt } = res.data.data || {};
        setOrder((prev) => (prev ? {
          ...prev,
          emailSentAt: emailSentAt || prev.emailSentAt,
          whatsappSentAt: whatsappSentAt || prev.whatsappSentAt,
        } : prev));
        const deliverySummary = `Email: ${emailDelivery?.sent ? 'sent' : 'not sent'}; WhatsApp: ${whatsappDelivery?.sent ? 'sent' : 'not sent'}.`;
        const emailDeliveredOrNotNeeded = !order.email || Boolean(emailSentAt);
        if (emailDeliveredOrNotNeeded && whatsappSentAt) {
          toastSuccess(deliverySummary);
          navigate(backUrl, { replace: true });
        } else {
          toastWarning(deliverySummary);
        }
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to mark the student email as sent.');
    } finally {
      setIsMarkingEmailSent(false);
    }
  };

  const handleRetryWhatsApp = async () => {
    if (!id || !order || order.status !== 'COMPLETED') return;

    if (!window.confirm(`Send the WhatsApp dispatch message again to ${order.studentName}?`)) return;

    setIsRetryingWhatsApp(true);
    try {
      const res = await api.post(`/orders/${id}/retry-whatsapp`);
      if (res.data.success) {
        const { whatsappDelivery, whatsappSentAt } = res.data.data || {};
        setOrder((prev) => (prev ? { ...prev, whatsappSentAt: whatsappSentAt || null } : prev));
        if (whatsappDelivery?.sent) {
          toastSuccess('Teleobi accepted the WhatsApp request. Check Teleobi delivery logs and the recipient phone.');
        } else {
          toastWarning(`WhatsApp was not sent: ${whatsappDelivery?.reason || 'check Render logs/configuration'}.`);
        }
      }
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to retry the WhatsApp notification.');
    } finally {
      setIsRetryingWhatsApp(false);
    }
  };

  const handleVerifyAndDispatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedItem || !enteredCode.trim() || isVerifying) return;

    setIsVerifying(true);
    setVerificationFeedback({ type: null, message: '' });

    const idempotencyKey = `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    try {
      const res = await api.post('/dispatch/verify', {
        orderItemId: selectedItem.id,
        enteredBookCode: enteredCode.trim(),
        requestId: idempotencyKey,
      });

      if (res.data.success) {
        setVerificationFeedback({
          type: 'success',
          message: res.data.message || 'Book code verified. One copy dispatched successfully.',
        });
        toastSuccess('Book verified! One copy dispatched successfully.');

        // Refresh whole order to get accurate quantities & status
        await fetchOrderDetail();

        // Update active modal selected item pending count
        if (res.data.data?.orderItem) {
          const updated = res.data.data.orderItem;
          setSelectedItem((prev) => (prev ? { ...prev, ...updated } : null));
          if (updated.pendingQuantity === 0) {
            setTimeout(() => {
              setSelectedItem(null);
            }, 1200);
          } else {
            // Clear input for next copy
            setEnteredCode('');
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          }
        }
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        'Warning: Book code does not match this order. Please verify the book.';
      setVerificationFeedback({
        type: 'warning',
        message: errorMsg,
      });
      toastWarning(errorMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading || !order) {
    return <LoadingSpinner message="Loading student order..." />;
  }

  const backUrl = isAdmin ? '/admin/outgoing-orders' : '/employee/outgoing-orders';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button & Title */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Outgoing Orders
        </Link>
        <div className="flex items-center gap-2">
          {order.status === 'COMPLETED' && (
            <Button
              variant="success"
              size="sm"
              onClick={handleRetryWhatsApp}
              isLoading={isRetryingWhatsApp}
              icon={<Phone className="w-4 h-4" />}
            >
              Retry WhatsApp
            </Button>
          )}
          {((order.email && !order.emailSentAt) || !order.whatsappSentAt) && (
            <Button
              variant="success"
              size="sm"
              onClick={handleMarkEmailSent}
              isLoading={isMarkingEmailSent}
              icon={<Mail className="w-4 h-4" />}
            >
              Send / Retry Notifications
            </Button>
          )}
          {order.emailSentAt && (
            <Badge variant="green">Email Sent</Badge>
          )}
          {order.whatsappSentAt && (
            <Badge variant="green">WhatsApp Sent</Badge>
          )}
          <Badge status={order.status} size="md" />
        </div>
      </div>

      {/* Student & Order Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-red-600 bg-red-50 px-2.5 py-0.5 rounded-md border border-red-200">
                {order.trackingId}
              </span>
              <h1 className="text-xl font-bold text-slate-800">{order.studentName}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Order registered on {new Date(order.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </div>

          <div className="flex items-center gap-6 text-center">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Required</span>
              <div className="text-xl font-bold text-slate-800 font-mono">{order.totalRequired}</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[11px] text-emerald-600 uppercase font-semibold">Dispatched</span>
              <div className="text-xl font-bold text-emerald-600 font-mono">{order.totalDispatched}</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[11px] text-amber-600 uppercase font-semibold">Pending</span>
              <div className="text-xl font-bold text-amber-600 font-mono">{order.totalPending}</div>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="flex items-center gap-2.5 text-slate-600">
            <User className="w-4 h-4 text-slate-400" />
            <span>
              Student: <strong className="text-slate-800">{order.studentName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600">
            <Phone className="w-4 h-4 text-slate-400" />
            <span>
              Phone: <strong className="text-slate-800 font-mono">{order.mobileNumber}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-600">
            <Mail className="w-4 h-4 text-slate-400" />
            <span>
              Email: <strong className="text-slate-800">{order.email || 'Not provided'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Book Items List */}
      <Card
        title="Books in This Order"
        subtitle="Select a pending book or use the Dispatch Box to scan codes rapidly"
        action={
          order.totalPending > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsDispatchBoxOpen(true)}
              icon={<PackageOpen className="w-4 h-4" />}
            >
              Open Dispatch Box
            </Button>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Book Code</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4 text-center">Required</th>
                <th className="py-3 px-4 text-center">Dispatched</th>
                <th className="py-3 px-4 text-center">Pending</th>
                <th className="py-3 px-4">Item Status</th>
                <th className="py-3 px-4 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items.map((item) => {
                const isPending = item.pendingQuantity > 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.bookCode}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{item.bookName}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      {item.requiredQuantity}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                      {item.dispatchedQuantity}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                      {item.pendingQuantity}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant={isPending ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={!isPending}
                        onClick={() => handleOpenVerification(item)}
                        icon={<ShieldCheck className="w-4 h-4" />}
                      >
                        {isPending ? 'Verify & Dispatch' : 'All Dispatched'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dispatch History for this Student Order */}
      <Card
        title="Order Dispatch Activity Logs"
        subtitle="Immutable timestamps and verified employee records for this order"
      >
        {order.items.flatMap((i) => i.dispatchLogs || []).length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">No books have been dispatched for this order yet.</p>
        ) : (
          <div className="space-y-2">
            {order.items
              .flatMap((item) =>
                (item.dispatchLogs || []).map((log) => ({
                  ...log,
                  bookCode: item.bookCode,
                  bookName: item.bookName,
                }))
              )
              .sort((a, b) => new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime())
              .map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">
                        1 copy of <span className="font-mono text-red-600">{log.verifiedBookCode}</span> ({log.bookName})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Dispatched by <strong>{log.employee?.name || 'Employee'}</strong> •{' '}
                        {new Date(log.dispatchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </div>
                    </div>
                  </div>
                  <Badge variant="green">Verified</Badge>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* VERIFY & DISPATCH MODAL */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => {
          setSelectedItem(null);
          setVerificationFeedback({ type: null, message: '' });
        }}
        title="Book Code Verification & Dispatch"
        subtitle={`Student: ${order.studentName} (Tracking ID: ${order.trackingId})`}
      >
        {selectedItem && (
          <form onSubmit={handleVerifyAndDispatch} className="space-y-4">
            {/* Selected Book Specs */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Book Name:</span>
                <span className="font-bold text-slate-800">{selectedItem.bookName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Expected Book Code:</span>
                <span className="font-mono font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded text-sm">
                  {selectedItem.bookCode}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500">Pending Copies Remaining:</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded text-sm">
                  {selectedItem.pendingQuantity} of {selectedItem.requiredQuantity}
                </span>
              </div>
            </div>

            {/* Input Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Scan or Enter Physical Book Code
              </label>
              <input
                ref={inputRef}
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                placeholder={`Type "${selectedItem.bookCode}" to verify`}
                disabled={isVerifying || selectedItem.pendingQuantity <= 0}
                className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-600 uppercase"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter the book code on the back of the physical book and press Enter.
              </p>
            </div>

            {/* Live Feedback Banner */}
            {verificationFeedback.type === 'success' && (
              <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-medium">{verificationFeedback.message}</span>
              </div>
            )}

            {verificationFeedback.type === 'warning' && (
              <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-medium">{verificationFeedback.message}</span>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedItem(null);
                  setVerificationFeedback({ type: null, message: '' });
                }}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!enteredCode.trim() || isVerifying || selectedItem.pendingQuantity <= 0}
                isLoading={isVerifying}
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Verify & Dispatch 1 Copy
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* RAPID DISPATCH BOX MODAL */}
      <DispatchBoxModal
        isOpen={isDispatchBoxOpen}
        onClose={() => setIsDispatchBoxOpen(false)}
        order={order}
        onOrderUpdated={(updated) => setOrder(updated)}
      />
    </div>
  );
};
