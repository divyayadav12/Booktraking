import React, { useRef, useState, useEffect } from 'react';
import { Download, Printer, Search, RefreshCw, Package, BookOpen, Tag } from 'lucide-react';
import { BarcodeDisplay } from '../components/common/BarcodeDisplay';
import api from '../services/api';

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
            body { font-family: Arial, sans-serif; background: white; margin: 20px; color: #111827; }
            .page-title { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 20px; }
            .order-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 24px; page-break-inside: avoid; }
            .order-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
            .student-name { font-size: 16px; font-weight: bold; }
            .meta { font-size: 12px; color: #6b7280; }
            .section-box { border-radius: 8px; padding: 12px; margin-bottom: 12px; }
            .order-code-box { background: #ecfdf5; border: 1px solid #a7f3d0; text-align: center; }
            .product-box { background: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 12px; }
            .books-box { border: 1px dashed #d1d5db; padding: 12px; border-radius: 8px; }
            .barcode-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; }
            .barcode-item { border: 1px solid #e5e7eb; background: #fafafa; border-radius: 6px; padding: 8px; text-align: center; }
            .badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 9999px; }
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
    const rows = [
      ['Order Code', 'Product Code', 'Product Name', 'Student Name', 'Mobile', 'Tracking ID', 'Book Code', 'Book Name', 'Required Qty', 'Status']
    ];
    orders.forEach(order => {
      const ordCode = order.orderCode || order.productCode;
      order.items.forEach(item => {
        rows.push([
          ordCode,
          item.productCode || order.productCode,
          item.productName || 'Product',
          order.studentName,
          order.mobileNumber,
          order.trackingId,
          item.bookCode,
          item.bookName,
          String(item.requiredQuantity),
          item.status
        ]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcode_sheet_${new Date().toISOString().slice(0, 10)}.csv`;
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
          <p className="text-sm text-gray-500 mt-1">
            Print or download 3-tier barcodes (Order Unique Code, Product Codes & Book Codes)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Printer size={16} /> Print Barcode Sheet
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
          >
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
            placeholder="Search by student name, order code (151026001 / ORD-...), tracking ID, product code, book code..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchInput('');
            setSearch('');
            fetchOrders('');
          }}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          title="Reset Search"
        >
          <RefreshCw size={16} className="text-gray-500" />
        </button>
      </form>

      {/* Stats Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap gap-8 text-sm">
        <div>
          <span className="text-gray-500">Total Orders: </span>
          <strong className="text-slate-900 font-bold">{orders.length}</strong>
        </div>
        <div>
          <span className="text-gray-500">Total Unique Books: </span>
          <strong className="text-slate-900 font-bold">{orders.reduce((s, o) => s + o.items.length, 0)}</strong>
        </div>
        <div>
          <span className="text-gray-500">Total Copies: </span>
          <strong className="text-slate-900 font-bold">{orders.reduce((s, o) => s + o.totalRequired, 0)}</strong>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 font-medium">Loading barcode sheet...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-medium">No orders found. Upload an Excel file first.</div>
      ) : (
        <div ref={printRef} className="space-y-6">
          {orders.map(order => {
            const orderCode = order.orderCode || order.productCode;
            const productList = order.products && order.products.length > 0
              ? order.products
              : [{ productCode: order.productCode, productName: 'Product Combo' }];

            return (
              <div key={order.id} className="border border-gray-200 rounded-xl p-5 shadow-sm bg-white space-y-4">
                {/* Order Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-gray-900">{order.studentName}</p>
                      {order.orderCode && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {order.orderCode}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      📞 {order.mobileNumber} &nbsp;|&nbsp; Tracking: <strong className="font-mono text-blue-600">{order.trackingId}</strong>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">
                      {order.totalDispatched}/{order.totalRequired} books dispatched
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor(order.status)}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* 1. ORDER UNIQUE CODE BARCODE */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={16} className="text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Tier 1: Order Unique Barcode (Scan to dispatch ALL books in order)
                    </span>
                  </div>
                  <BarcodeDisplay value={orderCode} height={65} width={2} fontSize={13} />
                </div>

                {/* 2. PRODUCT CODE BARCODE(S) */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={16} className="text-blue-700" />
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                      Tier 2: Product Barcode(s) (Scan to dispatch all books of that product)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {productList.map(prod => (
                      <div
                        key={prod.productCode}
                        className="bg-white border border-blue-200 rounded-lg p-3 flex flex-col items-center text-center shadow-2xs"
                      >
                        <p className="text-xs font-bold text-blue-900 mb-1 max-w-[200px] truncate" title={prod.productName}>
                          {prod.productName || prod.productCode}
                        </p>
                        <BarcodeDisplay value={prod.productCode} height={55} width={1.8} fontSize={12} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. INDIVIDUAL BOOK BARCODES */}
                <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={16} className="text-slate-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Tier 3: Individual Book Barcodes (Scan to dispatch 1 physical copy)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {order.items.map(item => (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-3 flex flex-col items-center text-center shadow-2xs transition-all ${
                          item.status === 'COMPLETED'
                            ? 'border-green-300 bg-green-50/60 opacity-60'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold text-gray-800 mb-0.5 max-w-[160px] truncate" title={item.bookName}>
                          {item.bookName}
                        </p>
                        {item.productCode && (
                          <span className="text-[10px] text-blue-600 font-medium mb-1">
                            [{item.productCode}]
                          </span>
                        )}
                        <BarcodeDisplay value={item.bookCode} height={45} width={1.5} fontSize={11} />
                        <p className="text-xs text-gray-500 mt-1 font-medium">
                          Qty: {item.dispatchedQuantity}/{item.requiredQuantity}
                        </p>
                        {item.status === 'COMPLETED' && (
                          <span className="text-xs text-green-700 font-bold mt-1">✓ Dispatched</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
