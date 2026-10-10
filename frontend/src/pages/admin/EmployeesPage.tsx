import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { Users, UserPlus, Power, CheckCircle2, ShieldCheck, Mail, Lock, User } from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const [empRes, statsRes] = await Promise.all([
        api.get('/employees'),
        api.get('/reports/employees'),
      ]);

      if (empRes.data.success && statsRes.data.success) {
        const statsMap = new Map();
        statsRes.data.data.forEach((s: any) => statsMap.set(s.id, s));

        const merged = empRes.data.data.map((emp: any) => {
          const stats = statsMap.get(emp.id) || {};
          return {
            ...emp,
            totalDispatches: stats.totalDispatches ?? emp._count?.dispatchLogs ?? 0,
            failedAttempts: stats.failedAttempts ?? 0,
            successRate: stats.successRate ?? 100,
          };
        });

        setEmployees(merged);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleToggleStatus = async (employeeId: string, currentStatus: boolean) => {
    try {
      const res = await api.patch(`/employees/${employeeId}/status`, {
        isActive: !currentStatus,
      });

      if (res.data.success) {
        toastSuccess(`Employee account ${!currentStatus ? 'activated' : 'deactivated'} successfully.`);
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === employeeId ? { ...emp, isActive: !currentStatus } : emp))
        );
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update employee status.';
      toastError(msg);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toastError('All fields are required.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await api.post('/employees', { name, email, password });
      if (res.data.success) {
        toastSuccess('Employee account created successfully!');
        setIsAddModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        fetchEmployees();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create employee.';
      toastError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Employee Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage dispatch staff accounts, credentials, and track verification performance
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          icon={<UserPlus className="w-4 h-4" />}
        >
          Add New Employee
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <LoadingSpinner message="Loading employee accounts..." />
        ) : employees.length === 0 ? (
          <EmptyState
            title="No employees found"
            description="Create your first employee account using the button above."
            icon={<Users className="w-6 h-6 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Dispatches Completed</th>
                  <th className="py-3 px-4 text-center">Failed Scans</th>
                  <th className="py-3 px-4 text-center">Accuracy Rate</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">{emp.name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs">{emp.email}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                      {emp.totalDispatches}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                      {emp.failedAttempts}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                      {emp.successRate}%
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={emp.isActive ? 'ACTIVE' : 'DEACTIVATED'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant={emp.isActive ? 'outline' : 'success'}
                        size="sm"
                        onClick={() => handleToggleStatus(emp.id, emp.isActive)}
                        icon={<Power className="w-3.5 h-3.5" />}
                      >
                        {emp.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Employee Account"
        subtitle="New staff will be granted EMPLOYEE dispatch permissions"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rohan Sharma"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rohan@example.com"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Temporary Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
