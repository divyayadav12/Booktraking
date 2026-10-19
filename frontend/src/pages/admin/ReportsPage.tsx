import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { DateFilterSelect } from '../../components/common/DateFilterSelect';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Users,
  BookOpen,
  Boxes,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const fetchSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/reports/summary?${params.toString()}`);
      if (res.data.success) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load report summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [dateFilter, startDate, endDate]);

  const handleExport = async (type: string, fileName: string) => {
    setDownloadingType(type);
    try {
      const params = new URLSearchParams();
      params.append('type', type);
      if (dateFilter) params.append('dateFilter', dateFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/reports/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName}_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toastSuccess(`Exported ${fileName} successfully.`);
    } catch (err: any) {
      toastError('Failed to generate Excel report.');
    } finally {
      setDownloadingType(null);
    }
  };

  const reportCards = [
    {
      id: 'dispatches',
      title: 'Successful Dispatches Report',
      description: 'Itemized list of every verified outgoing book copy, dispatch timestamp (IST), student, tracking ID, and employee.',
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      fileName: 'Dispatch_History_Report',
      color: 'border-emerald-200 bg-emerald-50/30',
    },
    {
      id: 'orders',
      title: 'Student Orders & Fulfillment Report',
      description: 'Master record of all student orders, contact information, required, dispatched, and pending quantities.',
      icon: <Boxes className="w-6 h-6 text-red-600" />,
      fileName: 'Orders_Fulfillment_Report',
      color: 'border-red-200 bg-red-50/30',
    },
    {
      id: 'book-summary',
      title: 'Book-Code Demand & Stock Summary',
      description: 'Consolidated physical copy requirement by book code, fulfilled quantity, and pending deficit.',
      icon: <BookOpen className="w-6 h-6 text-indigo-600" />,
      fileName: 'Book_Code_Summary_Report',
      color: 'border-indigo-200 bg-indigo-50/30',
    },
    {
      id: 'employees',
      title: 'Employee Dispatch Performance',
      description: 'Total dispatches per employee, verification accuracy rate, and failed attempt counts.',
      icon: <Users className="w-6 h-6 text-purple-600" />,
      fileName: 'Employee_Dispatch_Performance',
      color: 'border-purple-200 bg-purple-50/30',
    },
    {
      id: 'failed-attempts',
      title: 'Failed Code Verification Log',
      description: 'Detailed security log of incorrect book codes entered during dispatch attempts with error reasons.',
      icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
      fileName: 'Failed_Verification_Attempts',
      color: 'border-rose-200 bg-rose-50/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports & Excel Exports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Generate audit-ready Excel reports formatted with Asia/Kolkata timestamps and custom date filters
        </p>
      </div>

      {/* Date Filter Card */}
      <Card title="Report Period Filter" subtitle="Selected date range applies to all generated reports below">
        <div className="flex items-center gap-4">
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

      {/* KPI Preview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Period Dispatches</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            {isLoadingSummary ? '...' : summary?.totalDispatches ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Period Failed Scans</span>
          <div className="text-xl font-bold text-rose-600 mt-1">
            {isLoadingSummary ? '...' : summary?.failedAttempts ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Active Employees</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            {isLoadingSummary ? '...' : summary?.activeEmployeesInPeriod ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Book Types Dispatched</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            {isLoadingSummary ? '...' : summary?.activeBooksInPeriod ?? 0}
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportCards.map((card) => (
          <div
            key={card.id}
            className={`p-6 rounded-xl border ${card.color} bg-white shadow-sm flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-white border border-slate-100 shadow-xs">{card.icon}</div>
                <h3 className="font-bold text-slate-800 text-base">{card.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">{card.description}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">Format: Microsoft Excel (.xlsx)</span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleExport(card.id, card.fileName)}
                isLoading={downloadingType === card.id}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Download Excel
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
