import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { BookSummaryItem } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { BookOpen, Download, Search } from 'lucide-react';

export const BookSummaryPage: React.FC = () => {
  const [books, setBooks] = useState<BookSummaryItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/reports/book-summary');
      if (res.data.success) {
        setBooks(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load book summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookSummary();
  }, []);

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/export?type=book-summary', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Book_Code_Summary_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const filteredBooks = books.filter(
    (b) =>
      b.bookCode.toLowerCase().includes(search.toLowerCase()) ||
      b.bookName.toLowerCase().includes(search.toLowerCase())
  );

  const totalRequiredAll = books.reduce((acc, b) => acc + b.totalRequired, 0);
  const totalDispatchedAll = books.reduce((acc, b) => acc + b.totalDispatched, 0);
  const totalPendingAll = books.reduce((acc, b) => acc + b.totalPending, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Book Code Summary</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Aggregated physical stock requirements and dispatch progress per book title
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleExport} icon={<Download className="w-4 h-4" />}>
          Export to Excel
        </Button>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Distinct Book Codes</span>
          <div className="text-xl font-bold text-slate-800 mt-1">{books.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Required Copies</span>
          <div className="text-xl font-bold text-slate-800 mt-1">{totalRequiredAll}</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 uppercase">Total Dispatched Copies</span>
          <div className="text-xl font-bold text-emerald-800 mt-1">{totalDispatchedAll}</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 uppercase">Total Pending Copies</span>
          <div className="text-xl font-bold text-amber-800 mt-1">{totalPendingAll}</div>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search book code or title..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Calculating book code totals..." />
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            title="No book records found"
            description="No orders found matching the book filter."
            icon={<BookOpen className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Book Code</th>
                  <th className="py-3 px-4">Book Title</th>
                  <th className="py-3 px-4 text-center">Orders Count</th>
                  <th className="py-3 px-4 text-center">Required Copies</th>
                  <th className="py-3 px-4 text-center">Dispatched</th>
                  <th className="py-3 px-4 text-center">Pending</th>
                  <th className="py-3 px-4">Fulfillment Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBooks.map((book) => {
                  const pct =
                    book.totalRequired > 0
                      ? Math.round((book.totalDispatched / book.totalRequired) * 100)
                      : 0;
                  return (
                    <tr key={book.bookCode} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{book.bookCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{book.bookName}</td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">{book.ordersCount}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {book.totalRequired}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                        {book.totalDispatched}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                        {book.totalPending}
                      </td>
                      <td className="py-3 px-4 w-44">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-600' : 'bg-slate-300'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-medium text-slate-600">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
