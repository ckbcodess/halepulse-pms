'use client';

import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Product stock statuses
  OUT_OF_STOCK: { label: 'Out of Stock', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  LOW_STOCK: { label: 'Low Stock', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  IN_STOCK: { label: 'In Stock', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  EXPIRED: { label: 'Expired', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },

  // Product/Supplier active status
  ARCHIVED: { label: 'Archived', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  ACTIVE: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  INACTIVE: { label: 'Inactive', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400' },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (!config) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium backdrop-blur-sm whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {label ?? config.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
