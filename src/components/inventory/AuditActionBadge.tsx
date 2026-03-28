'use client';

import { cn } from '@/lib/utils';

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  PRODUCT_CREATED:   { label: 'Created',            className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  PRODUCT_UPDATED:   { label: 'Updated',            className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  PRICE_UPDATED:     { label: 'Price Changed',      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  STOCK_ADJUSTED:    { label: 'Stock Adjusted',     className: 'bg-violet-500/15 text-violet-700 dark:text-violet-400' },
  STOCK_RECEIVED:    { label: 'Restocked',          className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400' },
  PRODUCT_ARCHIVED:  { label: 'Archived',           className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  PRODUCT_RESTORED:  { label: 'Restored',           className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  PRODUCT_REVERTED:  { label: 'Reverted',           className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  SUPPLIER_CREATED:  { label: 'Supplier Created',   className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' },
  SUPPLIER_UPDATED:  { label: 'Supplier Updated',   className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  SUPPLIER_ARCHIVED: { label: 'Supplier Archived',  className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  SUPPLIER_RESTORED: { label: 'Supplier Restored',  className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  SUPPLIER_REVERTED:       { label: 'Supplier Reverted',  className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  // Sales & POS
  SALE_COMPLETED:          { label: 'Sale',                className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  // Customers
  CUSTOMER_CREATED:        { label: 'Customer Created',    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  // Bulk operations
  BULK_IMPORT:             { label: 'Bulk Import',         className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
  // Category management
  CATEGORY_MARKUP_UPDATED: { label: 'Markup Changed',      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  // System
  SETTINGS_UPDATED:        { label: 'Settings Updated',    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400' },
  PASSWORD_CHANGED:        { label: 'Password Changed',    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
};

interface AuditActionBadgeProps {
  actionType: string;
  className?: string;
}

export function AuditActionBadge({ actionType, className }: AuditActionBadgeProps) {
  const config = ACTION_CONFIG[actionType] ?? {
    label: actionType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium backdrop-blur-sm whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export function getActionLabel(actionType: string): string {
  return ACTION_CONFIG[actionType]?.label ?? actionType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
