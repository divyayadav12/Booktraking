import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { VerificationAttempt } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { DateFilterSelect } from '../../components/common/DateFilterSelect';
import { ShieldAlert, Download } from 'lucide-react';

export const FailedAttemptsPage: React.FC = () => {
  const [attempts, setAttempts] = useState<VerificationAttempt[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchFailedAttempts = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '10');
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/dispatch/failed-attempts?${params.toString()}`);
      if (res.data.success) {
        setAttempts(res.data.data.attempts);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load failed attempts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFailedAttempts(1);
  }, [dateFilter, startDate, endDate]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', 'failed-attempts');
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/reports/export?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Failed_Verification_Report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Failed Verification Attempts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit log of wrong book code inputs. These attempts were safely rejected without modifying quantities.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleExport} icon={<Download className="w-4 h-4" />}>
          Export Report (.xlsx)
        </Button>
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
          <LoadingSpinner message="Loading failed verification attempts..." />
        ) : attempts.length === 0 ? (
          <EmptyState
            title="No failed attempts recorded"
            description="All employee verification scans matched expected book codes."
            icon={<ShieldAlert className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Attempt Time (IST)</th>
                    <th className="py-3 px-4">Tracking ID</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Expected Code</th>
                    <th className="py-3 px-4">Entered Code</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Failure Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {new Date(att.attemptedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-600">
                        {att.orderItem?.order?.trackingId || '-'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {att.orderItem?.order?.studentName || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {att.orderItem?.bookCode || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-rose-600">
                        {att.enteredBookCode}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{att.employee?.name || 'Employee'}</td>
                      <td className="py-3 px-4 text-rose-600 text-xs">
                        {att.failureReason || 'Mismatch'}
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
              onPageChange={(p) => fetchFailedAttempts(p)}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
