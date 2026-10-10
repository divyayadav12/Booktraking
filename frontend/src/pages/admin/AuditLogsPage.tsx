import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { AuditLogItem } from '../../types';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { ShieldCheck, User } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuditLogs = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/audit?page=${page}&limit=15`);
      if (res.data.success) {
        setLogs(res.data.data.logs);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(1);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Immutable event log of all administrative actions, employee management, and verified dispatch events
        </p>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading audit logs..." />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit logs found"
            description="No system audit records have been generated yet."
            icon={<ShieldCheck className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp (IST)</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Event Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 text-xs">
                        {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{log.actorUser?.name || 'System'}</div>
                        <div className="text-[11px] text-slate-400">{log.actorUser?.email || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{log.entityType}</td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-mono text-[11px] text-slate-500 truncate bg-slate-50 p-1.5 rounded border border-slate-200">
                          {log.metadata ? JSON.stringify(log.metadata) : '-'}
                        </div>
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
              pageSize={15}
              onPageChange={(p) => fetchAuditLogs(p)}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
