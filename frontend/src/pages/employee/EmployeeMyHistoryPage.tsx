import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { DispatchLog } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { DateFilterSelect } from '../../components/common/DateFilterSelect';
import { Clock } from 'lucide-react';

export const EmployeeMyHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Date filters
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchMyHistory = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '10');
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/dispatch/my-history?${params.toString()}`);
      if (res.data.success) {
        setLogs(res.data.data.logs);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load personal dispatch history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyHistory(1);
  }, [dateFilter, startDate, endDate]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">My Dispatch History</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Record of all book packages you have verified and dispatched
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <DateFilterSelect
            filter={dateFilter}
            startDate={startDate}
            endDate={endDate}
            onChange={(f, s, e) => {
              setDateFilter(f);
              if (s !== undefined) setStartDate(s);
              if (e !== undefined) setEndDate(e);
            }}
          />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading your dispatch records..." />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No dispatches found"
            description="You haven't dispatched any books in the selected period."
            icon={<Clock className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Dispatch Time (IST)</th>
                    <th className="py-3 px-4">Tracking ID</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Book Code & Name</th>
                    <th className="py-3 px-4 text-center">Quantity</th>
                    <th className="py-3 px-4 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                        {new Date(log.dispatchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-600">
                        {log.orderItem?.order?.trackingId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {log.orderItem?.order?.studentName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 mr-2">{log.verifiedBookCode}</span>
                        <span className="text-slate-500 text-xs">{log.orderItem?.bookName}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">{log.quantity}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant="green">Verified</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalRecords={pagination.total}
              onPageChange={(p) => fetchMyHistory(p)}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
