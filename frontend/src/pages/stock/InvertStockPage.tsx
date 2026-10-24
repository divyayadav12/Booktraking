import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  PackagePlus,
  FileSpreadsheet,
  Calendar,
  Clock,
  ScanLine,
  Search,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  ArrowRight,
  UploadCloud,
  FileDown,
  Building2,
  FileText,
  Boxes,
  CheckCircle2,
} from 'lucide-react';

export const InvertStockPage: React.FC = () => {
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'single' | 'excel'>('single');

  // ─── Single Entry State ──────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentTimeStr = now.toLocaleTimeString('en-IN', { hour12: false });

  const [entryDate, setEntryDate] = useState<string>(todayStr);
  const [entryTime, setEntryTime] = useState<string>(currentTimeStr);
  const [bookCode, setBookCode] = useState<string>('');
  const [bookName, setBookName] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // ─── Excel Bulk Upload State ─────────────────────────────────────────────
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // ─── Inward Logs History State ───────────────────────────────────────────
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Autocomplete Catalog Lookup
  useEffect(() => {
    if (!bookCode.trim() || bookCode.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/stock/search-catalog?q=${encodeURIComponent(bookCode)}`);
        if (res.data.success) {
          setSuggestions(res.data.data || []);
        }
      } catch (err) {
        // quiet error
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [bookCode]);

  // Fetch Inward History Logs
  const fetchInwardLogs = async (targetPage = 1) => {
    setIsLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.append('page', targetPage.toString());
      params.append('limit', '15');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/stock/inward?${params.toString()}`);
      if (res.data.success) {
        setLogs(res.data.data.records || []);
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setTotalCount(res.data.data.pagination.total || 0);
        setPage(targetPage);
      }
    } catch (err: any) {
      console.error('Failed to load inward history:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchInwardLogs(1);
  }, [startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInwardLogs(1);
  };

  // Submit Single Inward Entry
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookCode.trim() || !bookName.trim()) {
      error('Book Code aur Book Name dono required hain');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      error('Quantity kam se kam 1 honi chahiye');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/stock/inward', {
        bookCode: bookCode.trim().toUpperCase(),
        bookName: bookName.trim(),
        quantity: qty,
        supplier: supplier.trim(),
        remarks: remarks.trim(),
        entryDate,
        entryTime,
        source: 'MANUAL',
      });

      if (res.data.success) {
        success(res.data.message || 'Stock entry successfully saved!');
        // Reset form but keep date/time fresh
        setBookCode('');
        setBookName('');
        setQuantity('');
        setRemarks('');
        setShowSuggestions(false);
        setEntryTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
        codeInputRef.current?.focus();
        fetchInwardLogs(1);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to save stock entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload Excel File
  const handleExcelUpload = async () => {
    if (!excelFile) {
      error('Kripya pehle Excel file select karein');
      return;
    }

    setIsUploadingExcel(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await api.post('/stock/inward/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        success(res.data.message || 'Excel Stock Imported successfully!');
        setUploadResult(res.data.data);
        setExcelFile(null);
        fetchInwardLogs(1);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Excel upload failed');
    } finally {
      setIsUploadingExcel(false);
    }
  };

  // Delete Inward Entry
  const handleDeleteEntry = async (id: string, name: string, qty: number) => {
    if (!window.confirm(`Kya aap sure hain ki "${name}" ka ${qty} copies ka inward entry delete karna chahte hain? Available stock me se ${qty} copies minus ho jayenge.`)) {
      return;
    }

    try {
      const res = await api.delete(`/stock/inward/${id}`);
      if (res.data.success) {
        success('Inward entry deleted and stock reverted');
        fetchInwardLogs(page);
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete inward entry');
    }
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const csvContent =
      'Book Code,Book Name,Quantity,Supplier,Remarks\n' +
      'IAEBR-001,CA Inter Auditing & Ethics Regular Batch,100,Vidyasagar Press,Challan #1049\n' +
      'AFON-002,CA Final AFM Regular Batch,50,Royal Printers,Batch A\n' +
      'ICHW-005,CA Inter COST Homework Book,200,National Press,Direct Delivery\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Stock_Inward_Sample_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Inward History to Excel
  const handleExportInwardExcel = async () => {
    try {
      const res = await api.get('/stock/export/inward', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Stock_Inward_History_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">📥 Stock Inward</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
              Daily Book Receiving
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Roj aane wali books ki date aur time ke sath entry karein. Entry hote hi Available Stock me count add ho jayega.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExportInwardExcel}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download size={14} />
            <span>Export Inward Excel</span>
          </Button>
          <a
            href="/admin/available-stock"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Boxes size={14} />
            <span>Check Available Stock</span>
          </a>
        </div>
      </div>

      {/* ─── Tabs: Single Entry vs Bulk Excel ─────────────────────────────────── */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl shadow-2xs">
        <button
          onClick={() => setActiveTab('single')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === 'single'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <PackagePlus size={18} />
          <span>Single / Barcode Gun Entry</span>
        </button>
        <button
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            activeTab === 'excel'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet size={18} />
          <span>Bulk Excel Upload</span>
        </button>
      </div>

      {/* ─── Tab 1: Single / Barcode Gun Entry Form ───────────────────────────── */}
      {activeTab === 'single' && (
        <Card className="p-6 bg-white border border-slate-200 rounded-b-xl shadow-xs">
          <form onSubmit={handleSingleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Entry Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar size={14} className="text-red-600" />
                  <span>Entry Date (तारीख)</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              {/* Entry Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock size={14} className="text-red-600" />
                  <span>Entry Timing (समय)</span>
                </label>
                <input
                  type="text"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  placeholder="HH:MM:SS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              {/* Book Code (Barcode) with Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ScanLine size={14} className="text-emerald-600" />
                    <span>Book Code / Barcode *</span>
                  </span>
                  <span className="text-[11px] text-red-600 font-normal">Scan / Type</span>
                </label>
                <input
                  ref={codeInputRef}
                  type="text"
                  value={bookCode}
                  onChange={(e) => {
                    setBookCode(e.target.value.toUpperCase());
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="e.g. IAEBR-001 or Scan"
                  className="w-full px-3 py-2 border-2 border-red-400 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-red-500 focus:outline-none bg-red-50/30"
                  required
                  autoFocus
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-56 overflow-y-auto">
                    <p className="px-3 py-1.5 text-[11px] font-bold text-slate-400 bg-slate-50 border-b">
                      Catalog Matches:
                    </p>
                    {suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setBookCode(item.bookCode);
                          setBookName(item.bookName);
                          setShowSuggestions(false);
                        }}
                        className="px-3 py-2 hover:bg-red-50 cursor-pointer text-xs border-b border-slate-100 flex items-center justify-between"
                      >
                        <div>
                          <strong className="font-mono text-red-700">{item.bookCode}</strong>
                          <p className="text-slate-600 truncate max-w-xs">{item.bookName}</p>
                        </div>
                        {item.availableQuantity !== undefined && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            Live: {item.availableQuantity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Plus size={14} className="text-emerald-600" />
                  <span>Quantity Received (कुल किताबें) *</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Kitni book aayi?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Quick Quantity Pills */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Quick Qty:</span>
              {[10, 50, 100, 250, 500, 1000].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num.toString())}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-800 rounded font-semibold transition-colors cursor-pointer"
                >
                  +{num}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Book Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Book Name (किताब का पूरा नाम) *
                </label>
                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="e.g. CA Inter Auditing & Ethics Regular Batch"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              {/* Supplier / Printer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 size={14} className="text-slate-500" />
                  <span>Supplier / Printer / Source (वेंडर)</span>
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Royal Press / Printer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Remarks / Challan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText size={14} className="text-slate-500" />
                <span>Remarks / Challan / Invoice No (अतिरिक्त विवरण)</span>
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Challan #5012 / Received in Box #4"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setBookCode('');
                  setBookName('');
                  setQuantity('');
                  setRemarks('');
                  setSupplier('');
                }}
              >
                Clear Form
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm"
              >
                {isSubmitting ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <PackagePlus size={16} />
                    <span>📥 Save Inward Stock (स्टॉक जोड़ें)</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ─── Tab 2: Bulk Excel Upload ─────────────────────────────────────────── */}
      {activeTab === 'excel' && (
        <Card className="p-6 bg-white border border-slate-200 rounded-b-xl shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Upload Inward Stock Excel File</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Agar printer se ya godown se badi sheet aayi hai, to yahan direct excel upload karke ek sath sari books add karein.
              </p>
            </div>
            <button
              onClick={handleDownloadSampleExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileDown size={14} className="text-red-600" />
              <span>Download Sample Template</span>
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-2xl p-8 text-center transition-all bg-slate-50/60">
            <UploadCloud size={44} className="mx-auto text-red-500 mb-3 animate-bounce" />
            <p className="text-sm font-bold text-slate-800">
              {excelFile ? `Selected: ${excelFile.name}` : 'Click here or drag & drop Inward Excel (.xlsx, .csv)'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Columns needed: <strong>Book Code</strong>, <strong>Book Name</strong>, <strong>Quantity</strong>, Supplier (optional)
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && setExcelFile(e.target.files[0])}
              className="mt-4 inline-block text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleExcelUpload}
              disabled={!excelFile || isUploadingExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isUploadingExcel ? (
                <LoadingSpinner />
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirm & Import Stock</span>
                </>
              )}
            </Button>
          </div>

          {/* Success Summary Alert */}
          {uploadResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
              <p className="font-bold text-sm text-emerald-800">✅ Bulk Stock Import Successful!</p>
              <p>Total Entries Added: <strong>{uploadResult.importedEntries}</strong></p>
              <p>Total Book Copies Added to Stock: <strong>{uploadResult.totalImportedCopies}</strong></p>
            </div>
          )}
        </Card>
      )}

      {/* ─── Daily Inward History Logs Table ─────────────────────────────────── */}
      <Card className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">📋 Daily Stock Inward Logs (रोज की एंट्री लिस्ट)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Total {totalCount} inward records recorded in database with exact date and entry time.
            </p>
          </div>
          <button
            onClick={() => fetchInwardLogs(page)}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer shrink-0"
            title="Refresh Inward Logs"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Filter Controls */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by book code, book name, supplier..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-xs text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <Button type="submit" variant="primary" className="text-xs py-2">
            Filter
          </Button>

          {(searchQuery || startDate || endDate) && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
                fetchInwardLogs(1);
              }}
              className="text-xs py-2"
            >
              Reset
            </Button>
          )}
        </form>

        {/* Inward History Table */}
        {isLoadingLogs ? (
          <div className="text-center py-12 text-slate-400 font-medium">
            <LoadingSpinner />
            <p className="mt-2 text-xs">Loading inward logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Boxes size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm">Koi inward entry nahi mili</p>
            <p className="text-xs text-slate-400 mt-1">Upar diye gaye form se aaj aayi hui books ki entry karein.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Book Code</th>
                  <th className="py-3 px-3">Book Name</th>
                  <th className="py-3 px-3 text-center">Qty Inwarded</th>
                  <th className="py-3 px-3">Supplier / Source</th>
                  <th className="py-3 px-3">Remarks</th>
                  <th className="py-3 px-3">Entered By</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {new Date(log.entryDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        ⏰ {log.entryTime || new Date(log.createdAt).toLocaleTimeString('en-IN')}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 text-xs">
                        {log.bookCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-xs truncate" title={log.bookName}>
                      {log.bookName}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 text-xs">
                        +{log.quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {log.supplier || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title={log.remarks}>
                      {log.remarks || <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      <span className="font-medium">{log.enteredBy?.name || 'User'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteEntry(log.id, log.bookName, log.quantity)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="Delete entry & revert stock"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => fetchInwardLogs(page - 1)}
                className="py-1 px-3 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => fetchInwardLogs(page + 1)}
                className="py-1 px-3 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
export default InvertStockPage;
