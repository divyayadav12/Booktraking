import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Barcode,
  Search,
  Printer,
  Download,
  BookOpen,
  Package,
  Layers,
  LayoutGrid,
  LayoutList,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
} from 'lucide-react';
import { BarcodeDisplay } from '../components/common/BarcodeDisplay';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

interface BookItem {
  id: string;
  bookCode: string;
  bookName: string;
  productCode?: string;
  availableQuantity: number;
  totalInward: number;
  totalDispatched: number;
  pendingQuantity: number;
  type: 'BOOK';
}

interface ProductItem {
  productCode: string;
  productName: string;
  books: string[];
  totalBooksCount: number;
  totalOrdersCount: number;
  type: 'PRODUCT';
}

export const BarcodeCatalogPage: React.FC = () => {
  const { success, error, warning } = useToast();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ALL' | 'BOOKS' | 'PRODUCTS'>('ALL');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Custom Barcode Tester
  const [testerInput, setTesterInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fetch Barcode Catalog
  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stock/barcode-catalog');
      if (res.data?.success && res.data?.data) {
        setBooks(res.data.data.books || []);
        setProducts(res.data.data.products || []);
      }
    } catch (err: any) {
      console.error('Failed to load barcode catalog:', err);
      error('Barcode Catalog load nahi ho paya.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  // Copy to clipboard
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    success(`"${code}" copy ho gaya!`);
  };

  // Filtered Books
  const filteredBooks = books.filter((b) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookCode.toLowerCase().includes(q) ||
      b.bookName.toLowerCase().includes(q) ||
      (b.productCode && b.productCode.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (stockFilter === 'IN_STOCK') return b.availableQuantity > 0;
    if (stockFilter === 'OUT_OF_STOCK') return b.availableQuantity === 0;
    return true;
  });

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.productCode.toLowerCase().includes(q) ||
      p.productName.toLowerCase().includes(q) ||
      p.books.some((b) => b.toLowerCase().includes(q))
    );
  });

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Books
      const booksData = filteredBooks.map((b, idx) => ({
        'S.No': idx + 1,
        'Book Code (Barcode)': b.bookCode,
        'Book Title / Name': b.bookName,
        'Product Code': b.productCode || '-',
        'Available Stock': b.availableQuantity,
        'Pending Stock': b.pendingQuantity,
        'Total Inward': b.totalInward,
        'Total Dispatched': b.totalDispatched,
        'Status': b.availableQuantity > 0 ? 'IN STOCK' : 'OUT OF STOCK',
      }));
      const booksSheet = XLSX.utils.json_to_sheet(booksData);
      booksSheet['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 32 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(workbook, booksSheet, 'Book Barcodes');

      // Sheet 2: Products
      const productsData = filteredProducts.map((p, idx) => ({
        'S.No': idx + 1,
        'Product Code (Barcode)': p.productCode,
        'Product / Course Name': p.productName,
        'Books in Combo': p.books.join(', '),
        'Total Books Count': p.totalBooksCount,
        'Total Dispatch Orders': p.totalOrdersCount,
      }));
      const productsSheet = XLSX.utils.json_to_sheet(productsData);
      productsSheet['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 32 },
        { wch: 36 },
        { wch: 16 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(workbook, productsSheet, 'Product Barcodes');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Master_Product_and_Book_Barcodes_${dateStr}.xlsx`);
      success('Master Barcode Excel file download ho gayi hai!');
    } catch (err: any) {
      console.error('Export Error:', err);
      error('Excel export me samasya aayi.');
    }
  };

  // Print All Filtered Barcode Stickers (5 Stickers per line / row - Zero Paper Waste)
  const handlePrintAllStickers = () => {
    const win = window.open('', '_blank', 'width=1150,height=850');
    if (!win) {
      error('Popup window block ho gayi hai. Browser settings me popups allow karein.');
      return;
    }

    // Prepare items to print based on active tab
    const itemsToPrint: Array<{ code: string; name: string }> = [];

    if (activeTab === 'ALL' || activeTab === 'PRODUCTS') {
      filteredProducts.forEach((p) => {
        itemsToPrint.push({
          code: p.productCode,
          name: p.productName,
        });
      });
    }

    if (activeTab === 'ALL' || activeTab === 'BOOKS') {
      filteredBooks.forEach((b) => {
        itemsToPrint.push({
          code: b.bookCode,
          name: b.bookName,
        });
      });
    }

    if (itemsToPrint.length === 0) {
      warning('Print karne ke liye koi barcodes nahi hain.');
      return;
    }

    // Circled Sticker Card: Barcode + [Code - Subject Name in 1 single line, not bold]
    const cardsHtml = itemsToPrint
      .map(
        (item) => `
      <div class="sticker-card">
        <div class="barcode-wrapper">
          <svg id="bc-${item.code.replace(/[^a-zA-Z0-9]/g, '_')}"></svg>
        </div>
        <div class="sticker-line" title="${item.code} - ${item.name}">
          ${item.code} - ${item.name}
        </div>
      </div>
    `
      )
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Master Barcode Stickers (5 Per Line) - ${new Date().toLocaleDateString('en-IN')}</title>
          <!-- JsBarcode for crisp printing in new window -->
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: A4 portrait;
              margin: 5mm 4mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #f8fafc;
              margin: 0;
              padding: 8px;
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
              padding: 10px 16px;
              border-radius: 8px;
              margin-bottom: 12px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
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
            }
            .btn-close {
              background: #475569;
              color: white;
              border: none;
              padding: 8px 14px;
              border-radius: 6px;
              font-size: 12px;
              cursor: pointer;
              margin-left: 8px;
            }

            /* ─── 5 Barcode Stickers Per Line / Row (Paper Saver) ─────────────── */
            .sticker-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 2.5mm;
            }

            .sticker-card {
              border: 1px dashed #94a3b8;
              border-radius: 3px;
              padding: 2px 2px;
              background: white;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 24.5mm;
              overflow: hidden;
            }

            .barcode-wrapper {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .barcode-wrapper svg {
              max-width: 98%;
              height: 32px;
              display: block;
              margin: 0 auto;
            }

            /* Single line: Code and Subject name together, simple regular text */
            .sticker-line {
              font-size: 8.5px;
              font-weight: 500;
              color: #0f172a;
              line-height: 1.15;
              margin-top: 1.5px;
              text-align: center;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              padding: 0 2px;
            }

            @media print {
              .no-print { display: none !important; }
              body { background: white !important; padding: 0 !important; }
              .sticker-card { border: 1px solid #475569 !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <div>
              <strong style="color: #38bdf8; font-size: 14px;">🏷️ Barcode Stickers (1 Line me 5 Barcodes - Paper Saver)</strong>
              <span style="font-size: 12px; margin-left: 10px; color: #cbd5e1;">
                💡 1 लाइन में 5 बारकोड | 'Destination' me <strong>"Save as PDF"</strong> chunein.
              </span>
            </div>
            <div>
              <button onclick="window.print()" class="btn-print">🖨️ Print / Save as PDF</button>
              <button onclick="window.close()" class="btn-close">✕ Close</button>
            </div>
          </div>

          <div class="sticker-grid">
            ${cardsHtml}
          </div>

          <script>
            // Render all SVG barcodes with JsBarcode (5 per line, displayValue: false so text is handled in single line)
            const items = ${JSON.stringify(itemsToPrint)};
            items.forEach(it => {
              const elId = '#bc-' + it.code.replace(/[^a-zA-Z0-9]/g, '_');
              try {
                JsBarcode(elId, it.code, {
                  format: "CODE128",
                  width: 1.15,
                  height: 32,
                  margin: 0,
                  displayValue: false
                });
              } catch(e) {}
            });

            setTimeout(() => {
              window.print();
            }, 600);
          </script>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

  // Print Single Barcode Sticker - Fills Full Page (50 stickers, 5 per row, 0 paper waste)
  const handlePrintSingleSticker = (code: string, name: string) => {
    const win = window.open('', '_blank', 'width=1150,height=850');
    if (!win) {
      error('Popup window block ho gayi hai. Browser settings me popups allow karein.');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Barcode Sticker Sheet (5 Per Row) - ${code}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: A4 portrait;
              margin: 5mm 4mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #f8fafc;
              margin: 0;
              padding: 8px;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: flex;
              flex-wrap: wrap;
              justify-content: space-between;
              align-items: center;
              background: #0f172a;
              color: white;
              padding: 10px 16px;
              border-radius: 8px;
              margin-bottom: 12px;
              gap: 10px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
            }
            .no-print-left {
              display: flex;
              align-items: center;
              gap: 12px;
              flex-wrap: wrap;
            }
            .title-info {
              font-size: 13px;
              font-weight: 700;
              color: #38bdf8;
            }
            .qty-selector {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              color: #cbd5e1;
            }
            .qty-btn {
              background: #334155;
              color: white;
              border: 1px solid #475569;
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s;
            }
            .qty-btn:hover, .qty-btn.active {
              background: #2563eb;
              border-color: #3b82f6;
            }
            .qty-input {
              width: 56px;
              padding: 3px 6px;
              border-radius: 4px;
              border: 1px solid #64748b;
              background: #1e293b;
              color: white;
              font-size: 12px;
              text-align: center;
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
            }
            .btn-print:hover {
              background: #1d4ed8;
            }
            .btn-close {
              background: #475569;
              color: white;
              border: none;
              padding: 8px 14px;
              border-radius: 6px;
              font-size: 12px;
              cursor: pointer;
              margin-left: 8px;
            }
            .btn-close:hover {
              background: #334155;
            }

            /* ─── 5 Barcode Stickers Per Line / Row (Paper Saver) ─────────────── */
            .sticker-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 2.5mm;
            }

            .sticker-card {
              border: 1px dashed #94a3b8;
              border-radius: 3px;
              padding: 2px 2px;
              background: white;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 24.5mm;
              overflow: hidden;
            }

            .barcode-wrapper {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .barcode-wrapper svg {
              max-width: 98%;
              height: 32px;
              display: block;
              margin: 0 auto;
            }

            /* Single line: Code and Subject name together, simple regular text */
            .sticker-line {
              font-size: 8.5px;
              font-weight: 500;
              color: #0f172a;
              line-height: 1.15;
              margin-top: 1.5px;
              text-align: center;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              padding: 0 2px;
            }

            @media print {
              .no-print { display: none !important; }
              body { background: white !important; padding: 0 !important; }
              .sticker-card { border: 1px solid #475569 !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <div class="no-print-left">
              <span class="title-info">🏷️ ${code} (1 Line me 5 Barcodes - Full Sheet)</span>
              <div class="qty-selector">
                <span>Stickers:</span>
                <button type="button" class="qty-btn active" onclick="setCount(50)">1 Sheet (50)</button>
                <button type="button" class="qty-btn" onclick="setCount(100)">2 Sheets (100)</button>
                <button type="button" class="qty-btn" onclick="setCount(25)">Half Sheet (25)</button>
                <input type="number" id="custom-qty" class="qty-input" value="50" min="1" max="500" onchange="setCount(this.value)" />
              </div>
            </div>
            <div>
              <button onclick="window.print()" class="btn-print">🖨️ Print / Save as PDF</button>
              <button onclick="window.close()" class="btn-close">✕ Close</button>
            </div>
          </div>

          <div class="sticker-grid" id="sticker-container"></div>

          <script>
            const code = ${JSON.stringify(code)};
            const name = ${JSON.stringify(name)};
            let currentCount = 50;

            function render(count) {
              currentCount = parseInt(count) || 50;
              document.getElementById('custom-qty').value = currentCount;
              const container = document.getElementById('sticker-container');
              let html = '';
              for (let i = 0; i < currentCount; i++) {
                html += \`
                  <div class="sticker-card">
                    <div class="barcode-wrapper">
                      <svg id="bc-single-\${i}"></svg>
                    </div>
                    <div class="sticker-line" title="\${code} - \${name}">
                      \${code} - \${name}
                    </div>
                  </div>
                \`;
              }
              container.innerHTML = html;

              for (let i = 0; i < currentCount; i++) {
                try {
                  JsBarcode('#bc-single-' + i, code, {
                    format: "CODE128",
                    width: 1.15,
                    height: 32,
                    margin: 0,
                    displayValue: false
                  });
                } catch(e) {}
              }
            }

            function setCount(num) {
              document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active'));
              if (num == 50) document.querySelectorAll('.qty-btn')[0]?.classList.add('active');
              if (num == 100) document.querySelectorAll('.qty-btn')[1]?.classList.add('active');
              if (num == 25) document.querySelectorAll('.qty-btn')[2]?.classList.add('active');
              render(num);
            }

            // Initial render: 50 stickers to fill the full A4 sheet
            render(50);

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

  const totalItemsCount = books.length + products.length;

  return (
    <div className="space-y-5">
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Barcode size={26} className="text-red-600" />
              <span>Barcode Directory & Labels (प्रोडक्ट व बुक बारकोड कैटलॉग)</span>
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
              Master Barcodes
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            यहाँ आपके सभी Products (`AFMEO-002`, `AFON-002`...) और Books (`AF-01`, `AF-02`...) के बारकोड उपलब्ध हैं। आप इन्हें देख सकते हैं, बारकोड गन से टेस्ट कर सकते हैं, और स्टिकर / PDF / Excel के रूप में डाउनलोड व प्रिंट कर सकते हैं।
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Excel (.xlsx) Button */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Download full barcode directory as Excel (.xlsx)"
          >
            <Download size={14} />
            <span>Export Excel (.xlsx)</span>
          </button>

          {/* Print All Barcodes Button */}
          <button
            onClick={handlePrintAllStickers}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Print Barcode Labels Grid / Save as PDF"
          >
            <Printer size={14} />
            <span>Print Stickers (PDF)</span>
          </button>
        </div>
      </div>

      {/* ─── Live Barcode Tester & Scanner Box ─────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-rose-950 to-red-950 text-white shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span className="text-sm font-bold tracking-wide text-red-200">
                Live Barcode Preview & Gun Tester (बारकोड परीक्षक)
              </span>
            </div>
            <p className="text-xs text-slate-300">
              कोई भी Product Code या Book Code यहाँ टाइप करें या बारकोड गन से स्कैन करें — तुरंत उसका बारकोड स्टिकर दिखेगा:
            </p>
          </div>

          <div className="flex items-center gap-2 max-w-md w-full">
            <input
              type="text"
              value={testerInput}
              onChange={(e) => setTesterInput(e.target.value.toUpperCase())}
              placeholder="e.g. AFMEO-002, AF-01, AFON-002..."
              className="flex-1 px-3.5 py-2 rounded-lg bg-white text-slate-900 font-mono font-bold text-xs uppercase focus:outline-none focus:ring-2 focus:ring-red-400 shadow-inner"
            />
            {testerInput && (
              <button
                onClick={() => setTesterInput('')}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Live Tested Barcode Display */}
        {testerInput && (
          <div className="mt-3 p-3 bg-white rounded-lg text-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-4">
              <div className="p-1 bg-slate-50 border border-slate-200 rounded">
                <BarcodeDisplay value={testerInput} height={42} width={1.6} fontSize={11} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                  Live Preview
                </span>
                <p className="font-mono font-black text-lg text-slate-900 mt-1">{testerInput}</p>
                <p className="text-xs text-slate-500">Scannable Code128 Barcode</p>
              </div>
            </div>

            <button
              onClick={() => handlePrintSingleSticker(testerInput, testerInput)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer size={13} />
              <span>Print This Barcode Sticker</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Tabs & Controls Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers size={13} />
            <span>All Barcodes ({totalItemsCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('BOOKS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BOOKS' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            <BookOpen size={13} />
            <span>Book Barcodes ({books.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PRODUCTS' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <Package size={13} />
            <span>Product Barcodes ({products.length})</span>
          </button>
        </div>

        {/* Search & Layout Toggle */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, book, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 w-56"
            />
          </div>

          {/* Stock filter (visible when on books tab or all) */}
          {(activeTab === 'ALL' || activeTab === 'BOOKS') && (
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700 cursor-pointer focus:outline-none"
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">In Stock Only</option>
              <option value="OUT_OF_STOCK">Zero Stock (0)</option>
            </select>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Sticker Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Compact Table View"
            >
              <LayoutList size={14} />
            </button>
          </div>

          <button
            onClick={fetchCatalog}
            className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Barcode Directory load ho rahi hai...</p>
        </div>
      ) : (
        <div ref={printAreaRef} className="space-y-6">
          {/* SECTION 1: PRODUCT BARCODES */}
          {(activeTab === 'ALL' || activeTab === 'PRODUCTS') && filteredProducts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Product / Course Barcodes ({filteredProducts.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  Used for complete student order bundles
                </span>
              </div>

              {viewMode === 'GRID' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.productCode}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {p.productCode}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {p.totalBooksCount} Books
                          </span>
                        </div>

                        {/* Barcode SVG */}
                        <div className="bg-slate-50/60 p-2 rounded-lg border border-slate-200/80 flex items-center justify-center">
                          <BarcodeDisplay value={p.productCode} height={40} width={1.4} fontSize={10} />
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                            {p.productName}
                          </h3>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.books.map((b) => (
                              <span
                                key={b}
                                className="text-[9.5px] font-mono font-semibold px-1 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          onClick={() => handleCopy(p.productCode)}
                          className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer text-[11px]"
                        >
                          {copiedCode === p.productCode ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handlePrintSingleSticker(p.productCode, p.productName)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
                        >
                          <Printer size={11} />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Product Table View */
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[10.5px] tracking-wider font-bold">
                        <th className="py-3 px-3 text-center w-40">Barcode Sticker</th>
                        <th className="py-3 px-3">Product Code</th>
                        <th className="py-3 px-3">Course Name</th>
                        <th className="py-3 px-3">Books in Bundle</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((p) => (
                        <tr key={p.productCode} className="hover:bg-indigo-50/30">
                          <td className="py-2 px-3 text-center">
                            <div className="inline-block p-1 bg-white rounded border border-slate-200">
                              <BarcodeDisplay value={p.productCode} height={32} width={1.3} fontSize={9} />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                            {p.productCode}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-xs">
                            {p.productName}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {p.books.map((b) => (
                                <span
                                  key={b}
                                  className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handlePrintSingleSticker(p.productCode, p.productName)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer size={12} />
                              <span>Print</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: BOOK BARCODES */}
          {(activeTab === 'ALL' || activeTab === 'BOOKS') && filteredBooks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-red-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Individual Book Barcodes ({filteredBooks.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  Stickered onto physical books for scanner gun verification
                </span>
              </div>

              {viewMode === 'GRID' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredBooks.map((b) => {
                    const isInStock = b.availableQuantity > 0;

                    return (
                      <div
                        key={b.bookCode}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-red-300 transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between space-y-2.5"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                              {b.bookCode}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                isInStock
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {isInStock ? `${b.availableQuantity} in stock` : '0 stock'}
                            </span>
                          </div>

                          {/* Barcode SVG */}
                          <div className="bg-slate-50/60 p-2 rounded-lg border border-slate-200/80 flex items-center justify-center">
                            <BarcodeDisplay value={b.bookCode} height={40} width={1.4} fontSize={10} />
                          </div>

                          <div>
                            <h3 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                              {b.bookName}
                            </h3>
                            {b.productCode && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Combo: <strong className="font-mono text-slate-600">{b.productCode}</strong>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <button
                            onClick={() => handleCopy(b.bookCode)}
                            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer text-[11px]"
                          >
                            {copiedCode === b.bookCode ? (
                              <>
                                <Check size={12} className="text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handlePrintSingleSticker(b.bookCode, b.bookName)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
                          >
                            <Printer size={11} />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Book Table View */
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[10.5px] tracking-wider font-bold">
                        <th className="py-3 px-3 text-center w-40">Barcode Sticker</th>
                        <th className="py-3 px-3">Book Code</th>
                        <th className="py-3 px-3">Book Name</th>
                        <th className="py-3 px-3">Product Combo</th>
                        <th className="py-3 px-3 text-center">Available Stock</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBooks.map((b) => (
                        <tr key={b.bookCode} className="hover:bg-red-50/30">
                          <td className="py-2 px-3 text-center">
                            <div className="inline-block p-1 bg-white rounded border border-slate-200">
                              <BarcodeDisplay value={b.bookCode} height={32} width={1.3} fontSize={9} />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-red-700">
                            {b.bookCode}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {b.bookName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {b.productCode || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                b.availableQuantity > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {b.availableQuantity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handlePrintSingleSticker(b.bookCode, b.bookName)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer size={12} />
                              <span>Print</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {filteredBooks.length === 0 && filteredProducts.length === 0 && (
            <div className="py-16 text-center bg-white rounded-xl border border-slate-200 p-8 space-y-3">
              <Barcode size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Koi barcode match nahi hua</p>
              <p className="text-xs text-slate-400">
                Search term badal kar dekhein ya upar custom barcode tester use karein.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BarcodeCatalogPage;
