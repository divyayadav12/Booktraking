import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Eye,
  Info,
  Check,
} from 'lucide-react';

export const ExcelUploadPage: React.FC = () => {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingErrors, setIsDownloadingErrors] = useState(false);

  // Preview Result
  const [previewData, setPreviewData] = useState<{
    fileHash: string;
    originalFileName: string;
    totalRows: number;
    validRowsCount: number;
    invalidRowsCount: number;
    isDuplicateFile: boolean;
    previousBatch?: any;
    validRows: any[];
    invalidRows: any[];
  } | null>(null);

  // Active step in the wizard
  // 1: Upload, 2: Preview & Validation, 3: Completed Summary
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
    }
  };

  const handleParseAndPreview = async () => {
    if (!file) {
      toastError('Please choose an Excel (.xlsx, .xls) or CSV file first.');
      return;
    }

    setIsParsing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/imports/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setPreviewData(res.data.data);
        setCurrentStep(2);
        toastSuccess('Excel file parsed and validated successfully.');
        if (res.data.data.isDuplicateFile) {
          toastWarning('Notice: A file with this exact content was previously uploaded.');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to parse Excel file.';
      toastError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadInvalidRows = async () => {
    if (!previewData || previewData.invalidRows.length === 0) return;

    setIsDownloadingErrors(true);
    try {
      const res = await api.post(
        '/imports/download-invalid',
        { invalidRows: previewData.invalidRows },
        { responseType: 'blob' }
      );

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invalid_Rows_Report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toastSuccess('Invalid rows report downloaded.');
    } catch (err: any) {
      toastError('Failed to download invalid rows Excel.');
    } finally {
      setIsDownloadingErrors(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.validRows.length === 0) {
      toastError('No valid rows available to import.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await api.post('/imports/confirm', {
        originalFileName: previewData.originalFileName,
        fileHash: previewData.fileHash,
        validRows: previewData.validRows,
        invalidRowsSummary: previewData.invalidRows.map((r) => ({
          rowNumber: r.rowNumber,
          studentName: r.studentName,
          trackingId: r.trackingId,
          errors: r.errors,
        })),
      });

      if (res.data.success) {
        setImportSummary(res.data.data);
        setConfirmModalOpen(false);
        setCurrentStep(3);
        toastSuccess('Student orders imported into PostgreSQL successfully!');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Database import failed.';
      toastError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const resetWizard = () => {
    setFile(null);
    setPreviewData(null);
    setImportSummary(null);
    setCurrentStep(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Wizard Header Stepper */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Excel Import Wizard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Step-by-step validation, preview, duplicate detection, and transactional database import
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between text-xs sm:text-sm font-medium text-slate-500">
        <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-blue-600 font-semibold' : ''}`}>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              currentStep > 1 ? 'bg-blue-600 text-white' : currentStep === 1 ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600' : 'bg-slate-100'
            }`}
          >
            {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <span>Upload File</span>
        </div>

        <div className="h-px bg-slate-200 flex-1 mx-4" />

        <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-blue-600 font-semibold' : ''}`}>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              currentStep > 2 ? 'bg-blue-600 text-white' : currentStep === 2 ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600' : 'bg-slate-100'
            }`}
          >
            {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <span>Validate & Preview</span>
        </div>

        <div className="h-px bg-slate-200 flex-1 mx-4" />

        <div className={`flex items-center gap-2 ${currentStep === 3 ? 'text-emerald-600 font-semibold' : ''}`}>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              currentStep === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100'
            }`}
          >
            3
          </div>
          <span>Import Summary</span>
        </div>
      </div>

      {/* STEP 1: Upload */}
      {currentStep === 1 && (
        <Card title="Step 1: Upload Student Orders Excel or CSV" subtitle="Supported formats: .xlsx, .xls, .csv">
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-upload"
              />
              <label htmlFor="excel-file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  {file ? file.name : 'Click to select or drag and drop your Excel file'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Required columns: Student Name, Mobile Number, Email, Tracking ID, Book Code, Book Name, Quantity
                </p>
                {file && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-blue-100/70 text-blue-800 rounded-lg text-xs font-mono">
                    <span>Selected: {file.name}</span>
                    <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </label>
            </div>

            {/* Column Guide Card */}
            <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600">
              <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" /> Excel Column Requirements & Specifications
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Student Name</span>
                  <p className="text-slate-400 text-[10px]">Text, required</p>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Mobile Number</span>
                  <p className="text-slate-400 text-[10px]">Digits, keeps zeros</p>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Tracking ID</span>
                  <p className="text-slate-400 text-[10px]">Text/ID, required</p>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Book Code</span>
                  <p className="text-slate-400 text-[10px]">e.g. QB101, MCQ201</p>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Book Name</span>
                  <p className="text-slate-400 text-[10px]">Book Title</p>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Quantity</span>
                  <p className="text-slate-400 text-[10px]">Integer &gt; 0</p>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Email</span>
                  <p className="text-slate-400 text-[10px]">Optional format</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleParseAndPreview}
                disabled={!file}
                isLoading={isParsing}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Parse & Validate Data
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: Preview & Validation */}
      {currentStep === 2 && previewData && (
        <div className="space-y-6">
          {/* Duplicate Batch Warning Banner if detected */}
          {previewData.isDuplicateFile && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <h4 className="font-bold">Duplicate File Upload Detected</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  An identical file with file hash <code className="font-mono">{previewData.fileHash.slice(0, 10)}...</code> was
                  previously imported on{' '}
                  <strong>{new Date(previewData.previousBatch.uploadedAt).toLocaleString()}</strong>.
                  Importing will create new orders. Existing dispatches will NEVER be overwritten.
                </p>
              </div>
            </div>
          )}

          {/* Validation Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Rows Parsed</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{previewData.totalRows}</div>
              <p className="text-xs text-slate-400 mt-0.5">From file: {previewData.originalFileName}</p>
            </div>
            <div className="bg-emerald-50/70 p-5 rounded-xl border border-emerald-200/80 shadow-sm">
              <span className="text-xs font-semibold text-emerald-700 uppercase">Valid Rows Ready</span>
              <div className="text-2xl font-bold text-emerald-800 mt-1">{previewData.validRowsCount}</div>
              <p className="text-xs text-emerald-600 mt-0.5">Passed all schema constraints</p>
            </div>
            <div className="bg-rose-50/70 p-5 rounded-xl border border-rose-200/80 shadow-sm">
              <span className="text-xs font-semibold text-rose-700 uppercase">Invalid Rows Found</span>
              <div className="text-2xl font-bold text-rose-800 mt-1">{previewData.invalidRowsCount}</div>
              <p className="text-xs text-rose-600 mt-0.5">Will be skipped from import</p>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetWizard} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Upload Another File
              </Button>
              {previewData.invalidRowsCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadInvalidRows}
                  isLoading={isDownloadingErrors}
                  icon={<Download className="w-3.5 h-3.5 text-rose-600" />}
                >
                  Download Invalid Rows (.xlsx)
                </Button>
              )}
            </div>

            <Button
              variant="primary"
              disabled={previewData.validRowsCount === 0}
              onClick={() => setConfirmModalOpen(true)}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm & Import {previewData.validRowsCount} Orders
            </Button>
          </div>

          {/* Detailed Invalid Rows Table (if any) */}
          {previewData.invalidRowsCount > 0 && (
            <Card
              title={`Validation Errors (${previewData.invalidRowsCount} rows)`}
              subtitle="The following rows failed validation and will not be imported"
            >
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Row #</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Tracking ID</th>
                      <th className="py-2.5 px-3">Book Code</th>
                      <th className="py-2.5 px-3">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.invalidRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-600">{row.rowNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{row.studentName || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{row.trackingId || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{row.bookCode || '-'}</td>
                        <td className="py-2.5 px-3 text-rose-600">
                          <ul className="list-disc list-inside space-y-0.5">
                            {row.errors.map((err: string, eIdx: number) => (
                              <li key={eIdx}>{err}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Valid Rows Preview Table */}
          <Card
            title={`Preview Valid Records (${previewData.validRowsCount} rows)`}
            subtitle="Sample of student orders that will be committed to the database"
          >
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Row #</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Mobile Number</th>
                    <th className="py-2.5 px-3">Tracking ID</th>
                    <th className="py-2.5 px-3">Book Code</th>
                    <th className="py-2.5 px-3">Book Name</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.validRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono text-slate-400">{row.rowNumber}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{row.studentName}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{row.mobileNumber}</td>
                      <td className="py-2 px-3 font-mono font-medium text-blue-600">{row.trackingId}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">{row.bookCode}</td>
                      <td className="py-2 px-3 text-slate-600">{row.bookName}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800 text-right">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.validRowsCount > 50 && (
                <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100">
                  Showing first 50 rows of {previewData.validRowsCount} valid records.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* STEP 3: Final Import Summary */}
      {currentStep === 3 && importSummary && (
        <Card title="Import Completed Successfully!">
          <div className="text-center py-8 max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Orders Ready for Dispatch</h3>
            <p className="text-xs text-slate-500">
              The database transaction committed successfully. Quantities have been recalculated and added to the outgoing orders queue.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Import Batch ID:</span>
                <span className="font-mono font-bold text-slate-800">{importSummary.batchId.slice(0, 13)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Student Orders Created:</span>
                <span className="font-bold text-emerald-700">{importSummary.importedOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Book Items Created:</span>
                <span className="font-bold text-emerald-700">{importSummary.importedItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valid Rows Processed:</span>
                <span className="font-bold text-slate-800">{importSummary.validRows}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <Button variant="outline" onClick={resetWizard}>
                Upload Another File
              </Button>
              <Button variant="primary" onClick={() => navigate('/admin/outgoing-orders')}>
                View Outgoing Orders
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Database Import"
        subtitle={`File: ${previewData?.originalFileName}`}
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            You are about to import <strong>{previewData?.validRowsCount}</strong> valid student order items into PostgreSQL.
          </p>
          {previewData?.invalidRowsCount ? (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              Note: <strong>{previewData.invalidRowsCount}</strong> invalid rows will be skipped. You can download the error
              report if needed.
            </p>
          ) : null}

          {previewData?.isDuplicateFile && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Warning: This exact file was uploaded before. Proceeding will add new order records with batch ID.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmImport} isLoading={isImporting}>
              Confirm & Save to Database
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
