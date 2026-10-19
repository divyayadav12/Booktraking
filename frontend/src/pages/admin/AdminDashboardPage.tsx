import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { DashboardSummary, BookSummaryItem } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Boxes,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Upload,
  ArrowRight,
  BookOpen,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const AdminDashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [bookSummary, setBookSummary] = useState<BookSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, trendRes, bookRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/dispatch-trends?days=14'),
        api.get('/reports/book-summary'),
      ]);

      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (trendRes.data.success) setTrends(trendRes.data.data);
      if (bookRes.data.success) setBookSummary(bookRes.data.data.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading || !summary) {
    return <LoadingSpinner message="Loading dashboard statistics..." />;
  }

  const statCards = [
    {
      title: 'Total Orders',
      value: summary.totalOrders,
      icon: <Boxes className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50 border-indigo-100',
      description: `${summary.totalStudents} student profiles`,
    },
    {
      title: 'Total Required Books',
      value: summary.totalRequiredCopies,
      icon: <BookOpen className="w-5 h-5 text-red-600" />,
      bg: 'bg-red-50 border-red-100',
      description: `${summary.totalBookTypes} distinct book types`,
    },
    {
      title: 'Total Dispatched',
      value: summary.totalDispatchedCopies,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-100',
      description: `${summary.completedOrders} completed orders`,
    },
    {
      title: 'Total Pending Books',
      value: summary.totalPendingCopies,
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-100',
      description: `${summary.pendingOrders} pending orders`,
    },
    {
      title: "Today's Dispatches",
      value: summary.todayDispatches,
      icon: <TrendingUp className="w-5 h-5 text-sky-600" />,
      bg: 'bg-sky-50 border-sky-100',
      description: 'Dispatches today (IST)',
    },
    {
      title: 'Partially Dispatched',
      value: summary.partiallyDispatchedOrders,
      icon: <Truck className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-100',
      description: 'Orders in progress',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Admin Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time book order fulfillment and dispatch operations</p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/upload-excel">
            <Button variant="primary" icon={<Upload className="w-4 h-4" />}>
              Import Orders Excel
            </Button>
          </Link>
          <Link to="/admin/outgoing-orders">
            <Button variant="outline" icon={<Truck className="w-4 h-4" />}>
              View Outgoing
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-xl border ${card.bg} shadow-sm bg-white flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.title}</span>
              <div className="p-2 rounded-lg bg-white shadow-xs border border-slate-100">{card.icon}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{card.value}</div>
              <p className="text-[11px] text-slate-500 mt-1">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Book Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dispatch Trend Chart */}
        <Card
          className="lg:col-span-2"
          title="Daily Dispatch Volume (Last 14 Days)"
          subtitle="Number of books successfully verified and dispatched per day"
        >
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dispatchGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="dispatches"
                  name="Dispatches"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#dispatchGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Book Code Summary Table Snippet */}
        <Card
          title="Top Book Demands"
          subtitle="Required vs pending by book code"
          action={
            <Link to="/admin/book-summary" className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-4">
            {bookSummary.map((book) => {
              const progressPct =
                book.totalRequired > 0 ? Math.round((book.totalDispatched / book.totalRequired) * 100) : 0;
              return (
                <div key={book.bookCode} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 font-mono">{book.bookCode}</span>
                    <span className="text-slate-500 font-medium">
                      {book.totalDispatched} / {book.totalRequired} copies ({progressPct}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mb-1.5">{book.bookName}</p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${
                        progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-red-600' : 'bg-slate-300'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
