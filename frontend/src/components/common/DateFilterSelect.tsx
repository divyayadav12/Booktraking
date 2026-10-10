import React from 'react';
import { Calendar } from 'lucide-react';

interface DateFilterSelectProps {
  filter: string;
  startDate?: string;
  endDate?: string;
  onChange: (filter: string, startDate?: string, endDate?: string) => void;
}

export const DateFilterSelect: React.FC<DateFilterSelectProps> = ({
  filter,
  startDate = '',
  endDate = '',
  onChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <select
          value={filter}
          onChange={(e) => onChange(e.target.value, startDate, endDate)}
          className="appearance-none bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-800 cursor-pointer"
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7days">Last 7 Days</option>
          <option value="thismonth">This Month</option>
          <option value="custom">Custom Date Range</option>
        </select>
        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
      </div>

      {filter === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange('custom', e.target.value, endDate)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange('custom', startDate, e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
        </div>
      )}
    </div>
  );
};
