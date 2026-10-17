import React, { useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Printer,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Package,
  BookOpen,
  Tag,
  ScanLine,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Mail,
  Phone,
  LayoutList,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { BarcodeDisplay } from '../components/common/BarcodeDisplay';
import { DispatchBoxModal } from '../components/dispatch/DispatchBoxModal';
import { Order } from '../types';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

interface OrderItem {
  id: string;
  productCode?: string;
  productName?: string;
  bookCode: string;
  bookName: string;
  requiredQuantity: number;
  dispatchedQuantity: number;
  pendingQuantity: number;
  status: string;
}

interface ProductSummary {
  productCode: string;
  productName: string;
}

interface BarcodeOrder {
  id: string;
  orderCode?: string;
  productCode: string;
  products?: ProductSummary[];
  studentName: string;
  mobileNumber: string;
  email: string | null;
  trackingId: string;
  totalRequired: number;
  totalDispatched: number;
  status: string;
  items: OrderItem[];
  createdAt?: string;
}

export const BarcodeSheetPage: React.FC = () => {
  const { success, error, warning } = useToast();
  const [orders, setOrders] = useState<BarcodeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');

  // Fast Barcode Scanner state
  const [fastScanInput, setFastScanInput] = useState('');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const fastScanRef = useRef<HTMLInputElement>(null);

  // Dispatch Box Modal state
  const [activeDispatchOrder, setActiveDispatchOrder] = useState<Order | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  const printTableRef = useRef<HTMLDivElement>(null);
  const printCardsRef = useRef<HTMLDivElement>(null);

  const fetchOrders = async (searchTerm = '') => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      const res = await api.get('/orders/barcode-sheet', { params });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch barcode sheet', err);
      error('Barcode sheet data load karne me samasya aayi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto-focus fast scanner
    fastScanRef.current?.focus();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    fetchOrders(searchInput);
  };

  // Fast Barcode Scan Trigger (Gun scanner or manual typing)
  const handleFastBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = fastScanInput.trim().toUpperCase();
    if (!query) return;

    // Search by trackingId, orderCode, student name or book code
    const matched = orders.find(
      (o) =>
        (o.trackingId && o.trackingId.toUpperCase() === query) ||
        (o.orderCode && o.orderCode.toUpperCase() === query) ||
        (o.mobileNumber && o.mobileNumber.includes(query)) ||
        o.items.some((i) => i.bookCode.toUpperCase() === query)
    );

    if (matched) {
      setHighlightedOrderId(matched.id);
      success(`Order matched: ${matched.studentName} (${matched.trackingId})`);
      openDispatchForOrder(matched);
      setFastScanInput('');
    } else {
      error(`Koi order nahi mila for barcode "${query}"`);
    }
  };

  // Open DispatchBoxModal for a specific student order
  const openDispatchForOrder = async (barcodeOrder: BarcodeOrder) => {
    try {
      const res = await api.get(`/orders/${barcodeOrder.id}`);
      if (res.data.success && res.data.data) {
        setActiveDispatchOrder(res.data.data);
        setIsDispatchModalOpen(true);
      }
    } catch (err: any) {
      error('Order details load nahi ho paye');
    }
  };

  // Export Orders to Real Excel File (.xlsx)
  const handleExportExcel = () => {
    if (filteredOrders.length === 0) {
      warning('Download karne ke liye koi orders nahi hain.');
      return;
    }

    try {
      const exportData = filteredOrders.map((order, idx) => {
        const courseName = order.products?.map((p) => p.productName).join(' / ') || 'Course';
        const productCode = order.products?.map((p) => p.productCode).join(', ') || order.productCode;
        const booksList = order.items.map((i) => i.bookCode).join(', ');
        const pendingCount = Math.max(0, order.totalRequired - order.totalDispatched);

        return {
          'S.No': idx + 1,
          'Tracking ID / Barcode': order.trackingId || order.orderCode || '-',
          'Student Name': order.studentName || '-',
          'Mobile Number': order.mobileNumber || '-',
          'Email': order.email || '-',
          'Course Name': courseName,
          'Product Code (P_Code)': productCode,
          'Books to Dispatch (p_Books)': booksList,
          'Total Books Required': order.totalRequired,
          'Dispatched Books': order.totalDispatched,
          'Pending Books': pendingCount,
          'Status':
            order.status === 'COMPLETED'
              ? 'COMPLETED (Dispatched)'
              : pendingCount === order.totalRequired
              ? 'PENDING'
              : 'PARTIALLY DISPATCHED',
          'Order Date': order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '-',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 24 }, // Tracking ID / Barcode
        { wch: 22 }, // Student Name
        { wch: 15 }, // Mobile
        { wch: 26 }, // Email
        { wch: 28 }, // Course
        { wch: 16 }, // Product Code
        { wch: 32 }, // Books
        { wch: 14 }, // Total Books
        { wch: 14 }, // Dispatched
        { wch: 14 }, // Pending
        { wch: 18 }, // Status
        { wch: 14 }, // Date
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Dispatch Barcodes');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Student_Dispatch_Barcode_Sheet_${dateStr}.xlsx`);
      success(`${filteredOrders.length} छात्रों का Excel फाइल सफलतापूर्वक डाउनलोड हो गया है!`);
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      error('Excel download me samasya aayi: ' + (err?.message || 'Unknown error'));
    }
  };

  // Print Complete Tabular Sheet / Save as PDF
  const handlePrintTable = () => {
    const printContent = printTableRef.current;
    if (!printContent) {
      warning('Print karne ke liye sheet available nahi hai.');
      return;
    }

    const clone = printContent.cloneNode(true) as HTMLElement;
    // Remove action column from printable copy
    const actions = clone.querySelectorAll('.action-header, .action-cell');
    actions.forEach((el) => el.remove());

    const win = window.open('', '_blank', 'width=1200,height=850');
    if (!win) {
      error('Popup window block ho gayi hai. Kripya browser me popups allow karein.');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Student Dispatch Barcode Sheet - ${new Date().toLocaleDateString('en-IN')}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 6mm 6mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background: #f8fafc;
              margin: 0;
              padding: 12px;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* On-screen control bar (auto-hidden in print / PDF) */
            .no-print {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #0f172a;
              color: white;
              padding: 12px 18px;
              border-radius: 8px;
              margin-bottom: 14px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
            }
            .toolbar-left {
              display: flex;
              align-items: center;
              gap: 12px;
              flex-wrap: wrap;
            }
            .toolbar-title {
              font-size: 15px;
              font-weight: 800;
              color: #38bdf8;
            }
            .toolbar-tip {
              font-size: 12px;
              color: #e2e8f0;
              background: rgba(255,255,255,0.1);
              padding: 4px 10px;
              border-radius: 6px;
            }
            .toolbar-tip strong {
              color: #fde047;
            }
            .toolbar-actions {
              display: flex;
              gap: 10px;
            }
            .btn-print {
              background: #2563eb;
              color: white;
              border: none;
              padding: 8px 18px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 13px;
              cursor: pointer;
              transition: background 0.15s;
            }
            .btn-print:hover { background: #1d4ed8; }
            .btn-close {
              background: #475569;
              color: white;
              border: none;
              padding: 8px 14px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            }
            .btn-close:hover { background: #334155; }

            /* Sheet Container */
            .sheet-wrapper {
              background: white;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #cbd5e1;
            }

            /* Sheet Header */
            .sheet-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .title {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0f172a;
              letter-spacing: 0.5px;
            }
            .meta {
              font-size: 11px;
              color: #475569;
              font-weight: 600;
              margin-top: 2px;
            }
            .brand {
              text-align: right;
              font-weight: 800;
              font-size: 13px;
              color: #1e3a8a;
            }

            /* Table layout */
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
            }
            th {
              background: #0f172a !important;
              color: white !important;
              padding: 6px 6px;
              text-align: left;
              font-size: 9.5px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              border: 1px solid #0f172a;
            }
            td {
              padding: 4px 6px;
              border: 1px solid #cbd5e1;
              vertical-align: middle;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }

            /* Barcode sizing */
            .barcode-cell {
              text-align: center;
              width: 140px;
              padding: 3px;
            }
            .barcode-cell svg {
              max-width: 135px;
              height: 32px;
              display: block;
              margin: 0 auto;
            }

            .tracking-cell {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-weight: bold;
              font-size: 11px;
            }
            .name-cell {
              font-weight: bold;
              font-size: 11.5px;
              color: #0f172a;
            }
            .course-cell {
              font-size: 10px;
              color: #1e293b;
              max-width: 180px;
            }
            .pcode-cell {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-weight: bold;
              color: #1d4ed8;
            }
            .books-cell {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 9.5px;
              font-weight: 600;
              color: #1e293b;
            }

            .badge {
              display: inline-block;
              padding: 2px 6px;
              font-size: 8.5px;
              font-weight: bold;
              border-radius: 4px;
            }
            .badge-pending {
              background: #fef3c7;
              color: #92400e;
              border: 1px solid #fde68a;
            }
            .badge-complete {
              background: #dcfce7;
              color: #166534;
              border: 1px solid #bbf7d0;
            }

            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: white !important;
                padding: 0 !important;
              }
              .sheet-wrapper {
                border: none !important;
                padding: 0 !important;
              }
              tr {
                page-break-inside: avoid;
              }
              thead {
                display: table-header-group;
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <div class="toolbar-left">
              <span class="toolbar-title">📄 Student Dispatch Sheet (Print & PDF)</span>
              <span class="toolbar-tip">
                💡 <strong>Kisi aur ko bhejne / Download karne ke liye:</strong> 'Destination' me <strong>"Save as PDF"</strong> chunein.
              </span>
            </div>
            <div class="toolbar-actions">
              <button onclick="window.print()" class="btn-print">🖨️ Print / Save as PDF</button>
              <button onclick="window.close()" class="btn-close">✕ Close</button>
            </div>
          </div>

          <div class="sheet-wrapper">
            <div class="sheet-header">
              <div>
                <div class="title">📦 Student Dispatch Barcode Sheet (छात्र बारकोड शीट)</div>
                <div class="meta">
                  Total Orders: ${filteredOrders.length} | Status: ${statusFilter} | Printed on: ${new Date().toLocaleString('en-IN')}
                </div>
              </div>
              <div class="brand">
                <div>BookDispatch Logistics</div>
                <div style="font-size: 9.5px; font-weight: normal; color: #64748b;">Fast Scan & Packing Desk</div>
              </div>
            </div>
            ${clone.innerHTML}
          </div>
          <script>
            setTimeout(() => {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

  // Print Single Student Dispatch Slip / Save as PDF
  const handlePrintSingleSlip = (order: BarcodeOrder) => {
    const courseName = order.products?.map((p) => p.productName).join(', ') || 'Course';
    const productCode = order.products?.map((p) => p.productCode).join(', ') || order.productCode;
    const booksList = order.items.map((i) => i.bookCode).join(', ');

    const win = window.open('', '_blank', 'width=750,height=550');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dispatch Slip - ${order.studentName}</title>
          <style>
            @page { margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 15px;
              margin: 0;
              background: #f8fafc;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #0f172a;
              color: white;
              padding: 10px 14px;
              border-radius: 6px;
              margin-bottom: 12px;
              font-size: 12px;
            }
            .btn-print {
              background: #2563eb;
              color: white;
              border: none;
              padding: 6px 14px;
              border-radius: 5px;
              font-weight: bold;
              cursor: pointer;
            }
            .btn-close {
              background: #475569;
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 5px;
              cursor: pointer;
              margin-left: 8px;
            }
            .slip {
              border: 2px dashed #0f172a;
              padding: 16px;
              border-radius: 8px;
              max-width: 550px;
              margin: auto;
              background: white;
            }
            .slip-header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
            }
            .title { font-size: 16px; font-weight: bold; }
            .row { display: flex; margin-bottom: 6px; font-size: 12px; }
            .label { width: 120px; font-weight: bold; color: #475569; }
            .val { flex: 1; font-weight: 600; color: #0f172a; }
            .books-box {
              margin-top: 10px;
              padding: 8px;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 6px;
              font-family: monospace;
              font-size: 12px;
              font-weight: bold;
            }
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; padding: 0 !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <span>💡 <strong>Save as PDF:</strong> Print dialog me 'Destination' me <strong>"Save as PDF"</strong> chunein.</span>
            <div>
              <button onclick="window.print()" class="btn-print">🖨️ Print / Save PDF</button>
              <button onclick="window.close()" class="btn-close">✕ Close</button>
            </div>
          </div>
          <div class="slip">
            <div class="slip-header">
              <span class="title">📦 Student Dispatch Slip</span>
              <span style="font-family: monospace; font-weight: bold;">${order.trackingId}</span>
            </div>
            <div class="row"><span class="label">Student Name:</span><span class="val" style="font-size: 14px;">${order.studentName}</span></div>
            <div class="row"><span class="label">Mobile / Phone:</span><span class="val">${order.mobileNumber || '-'}</span></div>
            <div class="row"><span class="label">Email:</span><span class="val">${order.email || '-'}</span></div>
            <div class="row"><span class="label">Course:</span><span class="val">${courseName}</span></div>
            <div class="row"><span class="label">Product Code:</span><span class="val" style="font-family: monospace; color: #1d4ed8;">${productCode}</span></div>
            <div class="books-box">
              <span style="display: block; font-size: 10px; color: #1e40af; margin-bottom: 2px;">BOOKS TO PACK (P_Books):</span>
              ${booksList} (${order.totalRequired} Copies)
            </div>
          </div>
          <script>
            setTimeout(() => {
              window.print();
            }, 400);
          </script>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

  // Filter orders by status
  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'PENDING') return order.status !== 'COMPLETED';
    if (statusFilter === 'COMPLETED') return order.status === 'COMPLETED';
    return true;
  });

  const pendingOrdersCount = orders.filter((o) => o.status !== 'COMPLETED').length;

  return (
    <div className="space-y-5">
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ScanLine size={24} className="text-blue-600" />
              <span>Student Dispatch Barcode Sheet (छात्र बारकोड व फास्ट स्कैन)</span>
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Live Dispatch Desk
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Excel अपलोड के बाद हर छात्र का बारकोड, नाम, ईमेल, कोर्स और प्रोडक्ट कोड देखें और तुरंत बारकोड स्कैन करके ऑर्डर डिस्पैच करें।
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Horizontal Table Strip View (जैसा फोटो में है)"
            >
              <LayoutList size={14} />
              <span>Table Sheet (फोटो व्यू)</span>
            </button>
            <button
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="3-Tier Barcode Cards View"
            >
              <Layers size={14} />
              <span>Card View</span>
            </button>
          </div>

          {/* Export Excel (.xlsx) Button */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Download full sheet as real Excel (.xlsx) file to share or print"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel (.xlsx)</span>
          </button>

          {/* Print / Download PDF Button */}
          <button
            onClick={handlePrintTable}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Print or Save as PDF to send to someone else"
          >
            <Printer size={14} />
            <span>Print / PDF Sheet</span>
          </button>
        </div>
      </div>

      {/* ─── ULTRA-FAST LIVE BARCODE SCANNER BOX ───────────────────────────────── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1">
              <Zap size={14} className="text-amber-400" />
              <span>Live Fast Barcode Scanner (बारकोड स्कैनर गन तैयार है)</span>
            </span>
          </div>
          <span className="text-[11px] text-blue-200/80">
            Student Barcode (08102026-1) या Book Code स्कैन करें
          </span>
        </div>

        <form onSubmit={handleFastBarcodeScan} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={fastScanRef}
              type="text"
              value={fastScanInput}
              onChange={(e) => setFastScanInput(e.target.value)}
              placeholder="⚡ Barcode Gun se yahan scan karein (e.g. 08102026-1 / AFMEO-002 / AFON-002)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 text-sm font-bold font-mono focus:outline-none focus:ring-4 focus:ring-blue-400 shadow-inner"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Zap size={15} />
            <span>Scan & Open</span>
          </button>
        </form>
      </div>



      {/* ─── Search & Status Filters ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Clock size={13} />
            <span>Pending ({pendingOrdersCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Completed ({orders.length - pendingOrdersCount})</span>
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student, email, tracking, course..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setSearch('');
              fetchOrders('');
            }}
            className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            title="Reset"
          >
            <RefreshCw size={14} />
          </button>
        </form>
      </div>

      {/* ─── MAIN CONTENT: TABLE OR CARDS ───────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Student Barcode Sheet load ho rahi hai...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 p-8 space-y-3">
          <Package size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Koi dispatch order nahi mila</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Dispatch karne ke liye pehle "Upload Excel" page se naye orders ki file upload karein.
          </p>
        </div>
      ) : (
        <>
          {/* ═════════════════════════════════════════════════════════════════════
             1. TABULAR STRIP VIEW (IDENTICAL TO USER'S UPLOADED PHOTO!)
          ═══════════════════════════════════════════════════════════════════════ */}
          <div
            ref={printTableRef}
            className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs ${
              viewMode === 'TABLE' ? 'block' : 'hidden'
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase text-[10.5px] tracking-wider font-bold">
                    <th className="py-3 px-3 text-center w-36">Bar Code (बारकोड)</th>
                    <th className="py-3 px-3 whitespace-nowrap">Tracking ID / Code</th>
                    <th className="py-3 px-3 whitespace-nowrap">Student Name</th>
                    <th className="py-3 px-3 whitespace-nowrap">Email & Mobile</th>
                    <th className="py-3 px-3">Course (कोर्स)</th>
                    <th className="py-3 px-3 whitespace-nowrap">P_Code</th>
                    <th className="py-3 px-3">Books to Dispatch (p_Books)</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap action-header">Fast Action</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const courseName = order.products?.map((p) => p.productName).join(' / ') || 'Course';
                  const productCode = order.products?.map((p) => p.productCode).join(', ') || order.productCode;
                  const booksString = order.items.map((i) => i.bookCode).join(', ');
                  const isCompleted = order.status === 'COMPLETED';
                  const isHighlighted = highlightedOrderId === order.id;

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-amber-100/90 ring-2 ring-amber-400'
                          : isCompleted
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      {/* 1. Barcode Column (Code128 Graphic) */}
                      <td className="py-2 px-3 text-center barcode-cell bg-white/60">
                        <div className="inline-block bg-white p-1 rounded border border-slate-200 shadow-2xs">
                          <BarcodeDisplay
                            value={order.trackingId || order.orderCode || 'ORDER'}
                            height={34}
                            width={1.3}
                            fontSize={9}
                          />
                        </div>
                      </td>

                      {/* 2. Tracking ID */}
                      <td className="py-2.5 px-3 tracking-cell whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {order.trackingId}
                        </span>
                        {order.orderCode && order.orderCode !== order.trackingId && (
                          <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                            {order.orderCode}
                          </span>
                        )}
                      </td>

                      {/* 3. Student Name */}
                      <td className="py-2.5 px-3 name-cell whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-[13px]">{order.studentName}</div>
                      </td>

                      {/* 4. Email & Phone */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        <div className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                          <Mail size={12} className="text-slate-400" />
                          <span>{order.email || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-slate-400" />
                          <span>{order.mobileNumber || '-'}</span>
                        </div>
                      </td>

                      {/* 5. Course */}
                      <td className="py-2.5 px-3 course-cell font-semibold text-slate-800 max-w-xs">
                        {courseName}
                      </td>

                      {/* 6. Product Code */}
                      <td className="py-2.5 px-3 pcode-cell whitespace-nowrap font-mono font-bold text-blue-700 bg-blue-50/50">
                        {productCode}
                      </td>

                      {/* 7. Required Books (p_Books) */}
                      <td className="py-2.5 px-3 books-cell">
                        <div className="font-mono text-[11px] font-bold text-slate-800 max-w-xs">
                          {booksString}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                          Total {order.totalRequired} books ({order.totalDispatched} dispatched)
                        </div>
                      </td>

                      {/* 8. Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={11} />
                            <span>Completed</span>
                          </span>
                        ) : order.totalDispatched > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock size={11} />
                            <span>Partial ({order.totalDispatched}/{order.totalRequired})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle size={11} />
                            <span>Pending (0/{order.totalRequired})</span>
                          </span>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap action-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDispatchForOrder(order)}
                            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded shadow-2xs transition-colors cursor-pointer"
                            title="Scan & verify books for this student"
                          >
                            <Zap size={12} />
                            <span>Dispatch</span>
                          </button>
                          <button
                            onClick={() => handlePrintSingleSlip(order)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                            title="Print Parcel Slip for this student"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
           2. DETAILED 3-TIER CARD VIEW
        ═══════════════════════════════════════════════════════════════════════ */}
        <div
          ref={printCardsRef}
          className={`space-y-4 ${viewMode === 'CARDS' ? 'block' : 'hidden'}`}
        >
          {filteredOrders.map((order) => {
            const courseName = order.products?.map((p) => p.productName).join(' / ') || 'Course';
            const productCode = order.products?.map((p) => p.productCode).join(', ') || order.productCode;

            return (
              <div key={order.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{order.studentName}</h3>
                    <p className="text-xs text-slate-500">
                      Tracking: <strong className="font-mono text-blue-700">{order.trackingId}</strong> | Course: {courseName} ({productCode})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDispatchForOrder(order)}
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg cursor-pointer"
                    >
                      <Zap size={13} />
                      <span>Fast Scan Books</span>
                    </button>
                    <button
                      onClick={() => handlePrintSingleSlip(order)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Student Order Barcode
                    </span>
                    <BarcodeDisplay value={order.trackingId} height={50} width={1.8} fontSize={12} />
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                      Required Books ({order.items.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {order.items.map((i) => (
                        <span
                          key={i.id}
                          className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-900"
                        >
                          {i.bookCode} ({i.dispatchedQuantity}/{i.requiredQuantity})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}

      {/* ─── DISPATCH BOX SCANNER MODAL ─────────────────────────────────────── */}
      <DispatchBoxModal
        isOpen={isDispatchModalOpen}
        onClose={() => {
          setIsDispatchModalOpen(false);
          setActiveDispatchOrder(null);
          // Refocus fast scanner
          setTimeout(() => fastScanRef.current?.focus(), 200);
        }}
        order={activeDispatchOrder}
        onOrderUpdated={(updated) => {
          setActiveDispatchOrder(updated);
          // Refresh list to update counts
          fetchOrders(search);
        }}
      />
    </div>
  );
};

export default BarcodeSheetPage;
