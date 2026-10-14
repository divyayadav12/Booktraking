import React, { useRef, useState, useEffect } from 'react';
import { Download, Printer, Search, RefreshCw, Package, BookOpen } from 'lucide-react';
import { BarcodeDisplay } from '../components/common/BarcodeDisplay';
import api from '../services/api';

interface OrderItem {
  id: string;
  bookCode: string;
  bookName: string;
  requiredQuantity: number;
  dispatchedQuantity: number;
  pendingQuantity: number;
  status: string;
}

interface BarcodeOrder {
  id: string;
  productCode: string;
  studentName: string;
  mobileNumber: string;
  email: string | null;
  trackingId: string;
  totalRequired: number;
  totalDispatched: number;
  status: string;
  items: OrderItem[];
}

export const BarcodeSheetPage: React.FC = () => {
  const [orders, setOrders] = useState<BarcodeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const fetchOrders = async (searchTerm = '') => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      const res = await api.get('/orders/barcode-sheet', { params });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch barcode sheet', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    fetchOrders(searchInput);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Barcode Sheet - Book Dispatch</title>
          <style>
            body { font-family: Arial, sans-serif; background: white; }
            .page-title { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 20px; }
            .order-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
            .order-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
            .student-name { font-size: 16px; font-weight: bold; }
            .meta { font-size: 12px; color: #6b7280; }
            .barcodes-section { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 12px; }
            .barcode-block { text-align: center; }
            .barcode-label { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 4px; }
            .product-section { border-top: 2px solid #3b82f6; padding-top: 12px; }
            .book-section { border-top: 1px dashed #9ca3af; padding-top: 8px; margin-top: 8px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="page-title">📦 Book Dispatch — Barcode Sheet</div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleDownloadCSV = () => {
    const rows = [['Product Code', 'Student Name', 'Mobile', 'Tracking ID', 'Book Code', 'Book Name', 'Required Qty']];
    orders.forEach(order => {
      order.items.forEach(item => {
        rows.push([order.productCode, order.studentName, order.mobileNumber, order.trackingId, item.bookCode, item.bookName, String(item.requiredQuantity)]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode_sheet_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-green-100 text-green-700';
    if (status === 'PARTIALLY_DISPATCHED') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Barcode Sheet</h1>
          <p className="text-sm text-gray-500 mt-1">Print or download barcode sheets for all orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Printer size={16} /> Print All
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Download size={16} /> Download CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student name, tracking ID, product code..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Search</button>
        <button type="button" onClick={() => { setSearchInput(''); setSearch(''); fetchOrders(''); }}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw size={16} className="text-gray-500" />
        </button>
      </form>

      {/* Stats Bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-6 text-sm">
        <span className="text-blue-700 font-medium">Total Orders: <strong>{orders.length}</strong></span>
        <span className="text-blue-700 font-medium">Total Books: <strong>{orders.reduce((s, o) => s + o.items.length, 0)}</strong></span>
        <span className="text-blue-700 font-medium">Total Copies: <strong>{orders.reduce((s, o) => s + o.totalRequired, 0)}</strong></span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading barcode sheet...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No orders found. Upload an Excel file first.</div>
      ) : (
        <div ref={printRef} className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="border border-gray-200 rounded-xl p-5 shadow-sm bg-white">
              {/* Order Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-lg font-bold text-gray-900">{order.studentName}</p>
                  <p className="text-sm text-gray-500">📞 {order.mobileNumber} &nbsp;|&nbsp; Tracking: <strong>{order.trackingId}</strong></p>
                  <p className="text-xs text-gray-400 mt-1">{order.totalDispatched}/{order.totalRequired} books dispatched</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(order.status)}`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              {/* Product Code Barcode */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <Package size={16} className="text-blue-600" />
                  <span className="text-sm font-bold text-blue-700">Product Code (Scan to dispatch ALL books)</span>
                </div>
                <BarcodeDisplay value={order.productCode} height={70} width={2} fontSize={13} />
              </div>

              {/* Individual Book Barcodes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={15} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-600">Individual Book Codes</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {order.items.map(item => (
                    <div key={item.id} className={`border rounded-lg p-3 flex flex-col items-center text-center ${item.status === 'COMPLETED' ? 'border-green-200 bg-green-50 opacity-60' : 'border-gray-200 bg-gray-50'}`}>
                      <p className="text-xs font-bold text-gray-700 mb-1 max-w-[140px] truncate" title={item.bookName}>{item.bookName}</p>
                      <BarcodeDisplay value={item.bookCode} height={50} width={1.6} fontSize={11} />
                      <p className="text-xs text-gray-500 mt-1">Qty: {item.dispatchedQuantity}/{item.requiredQuantity}</p>
                      {item.status === 'COMPLETED' && <span className="text-xs text-green-600 font-semibold mt-1">✓ Done</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
