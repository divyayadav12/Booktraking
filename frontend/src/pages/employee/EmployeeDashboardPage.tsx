import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Truck,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Package,
} from 'lucide-react';

export const EmployeeDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [myRecentDispatches, setMyRecentDispatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployeeData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, myRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dispatch/my-history?limit=5'),
      ]);

      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (myRes.data.success) setMyRecentDispatches(myRes.data.data.logs);
    } catch (err) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  if (isLoading || !summary) {
    return <LoadingSpinner message="Loading employee dashboard..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">
              Staff Dispatch Station
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
            Hello, {user?.name}!
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ready to verify book barcodes and process student packages
          </p>
        </div>

        <Link to="/employee/outgoing-orders">
          <Button variant="primary" size="lg" icon={<Truck className="w-5 h-5" />}>
            Start Outgoing Dispatches
          </Button>
        </Link>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Today's Total Dispatches</span>
            <TrendingUp className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-slate-800">{summary.todayDispatches}</div>
          <p className="text-xs text-slate-400 mt-1">Dispatches registered today</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-700 uppercase">Orders Needing Dispatch</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-700">{summary.pendingOrders + summary.partiallyDispatchedOrders}</div>
          <p className="text-xs text-amber-600 mt-1">Waiting in active queue</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-700 uppercase">Completed Orders</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-700">{summary.completedOrders}</div>
          <p className="text-xs text-emerald-600 mt-1">Fully dispatched packages</p>
        </div>
      </div>

      {/* Recent Dispatches by This Employee */}
      <Card
        title="My Recent Dispatches"
        subtitle="Your latest successful book code verifications"
        action={
          <Link
            to="/employee/my-history"
            className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        {myRecentDispatches.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">
            You haven't dispatched any books yet today. Open Outgoing Orders to start!
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {myRecentDispatches.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">
                      Dispatched <span className="font-mono text-red-600">{log.verifiedBookCode}</span> ({log.orderItem?.bookName})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Student: <strong>{log.orderItem?.order?.studentName}</strong> (Tracking ID: {log.orderItem?.order?.trackingId})
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(log.dispatchedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
