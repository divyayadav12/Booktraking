import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize = 10,
  onPageChange,
}) => {
  if (totalPages <= 1 && (!totalRecords || totalRecords <= pageSize)) {
    return null;
  }

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = totalRecords ? Math.min(currentPage * pageSize, totalRecords) : currentPage * pageSize;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
      <div>
        {totalRecords !== undefined ? (
          <span>
            Showing <strong className="text-slate-800">{startRecord}</strong> to{' '}
            <strong className="text-slate-800">{endRecord}</strong> of{' '}
            <strong className="text-slate-800">{totalRecords}</strong> results
          </span>
        ) : (
          <span>
            Page <strong className="text-slate-800">{currentPage}</strong> of{' '}
            <strong className="text-slate-800">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          icon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous
        </Button>

        <div className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-md">
          {currentPage} / {totalPages || 1}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          icon={<ChevronRight className="w-4 h-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
