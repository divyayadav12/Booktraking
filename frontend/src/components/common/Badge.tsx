import React from 'react';
import { OrderStatus, ItemStatus } from '../../types';

interface BadgeProps {
  status?: OrderStatus | ItemStatus | 'ACTIVE' | 'DEACTIVATED' | 'SUCCESS' | 'FAILED' | string;
  variant?: 'green' | 'amber' | 'blue' | 'red' | 'gray';
  children?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, children, size = 'sm' }) => {
  let computedVariant = variant || 'gray';
  let label = children;

  if (status) {
    switch (status) {
      case 'COMPLETED':
        computedVariant = 'green';
        label = label || 'Completed';
        break;
      case 'PARTIALLY_DISPATCHED':
        computedVariant = 'blue';
        label = label || 'Partially Dispatched';
        break;
      case 'PENDING':
        computedVariant = 'amber';
        label = label || 'Pending';
        break;
      case 'ACTIVE':
        computedVariant = 'green';
        label = label || 'Active';
        break;
      case 'DEACTIVATED':
        computedVariant = 'red';
        label = label || 'Deactivated';
        break;
      case 'SUCCESS':
        computedVariant = 'green';
        label = label || 'Success';
        break;
      case 'FAILED':
        computedVariant = 'red';
        label = label || 'Failed';
        break;
      default:
        label = label || status;
    }
  }

  const variantStyles = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
    blue: 'bg-sky-50 text-sky-700 border-sky-200/60',
    red: 'bg-rose-50 text-rose-700 border-rose-200/60',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[computedVariant]} ${sizeStyles[size]}`}
    >
      {label}
    </span>
  );
};