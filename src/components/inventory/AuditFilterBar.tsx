'use client';

import { Search, X, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  // Inventory
  { value: 'PRODUCT_CREATED', label: 'Product Created' },
  { value: 'PRODUCT_UPDATED', label: 'Product Updated' },
  { value: 'PRICE_UPDATED', label: 'Price Changed' },
  { value: 'STOCK_ADJUSTED', label: 'Stock Adjusted' },
  { value: 'STOCK_RECEIVED', label: 'Restocked' },
  { value: 'PRODUCT_ARCHIVED', label: 'Archived' },
  { value: 'PRODUCT_RESTORED', label: 'Restored' },
  { value: 'PRODUCT_REVERTED', label: 'Reverted' },
  { value: 'BULK_IMPORT', label: 'Bulk Import' },
  { value: 'CATEGORY_MARKUP_UPDATED', label: 'Markup Changed' },
  // Suppliers
  { value: 'SUPPLIER_CREATED', label: 'Supplier Created' },
  { value: 'SUPPLIER_UPDATED', label: 'Supplier Updated' },
  { value: 'SUPPLIER_ARCHIVED', label: 'Supplier Archived' },
  { value: 'SUPPLIER_RESTORED', label: 'Supplier Restored' },
  // Sales & Customers
  { value: 'SALE_COMPLETED', label: 'Sale' },
  { value: 'CUSTOMER_CREATED', label: 'Customer Created' },
  // System
  { value: 'SETTINGS_UPDATED', label: 'Settings Updated' },
  { value: 'PASSWORD_CHANGED', label: 'Password Changed' },
];

interface AuditFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  actionType: string;
  onActionTypeChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onClear: () => void;
  hasFilters: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function AuditFilterBar({
  search,
  onSearchChange,
  actionType,
  onActionTypeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClear,
  hasFilters,
  onRefresh,
  isRefreshing,
}: AuditFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-1">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by product, user..."
          className="pl-8 h-8 text-[13px] bg-background/60 backdrop-blur-sm border-border/50"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Action type filter */}
      <Select value={actionType} onValueChange={v => onActionTypeChange(v ?? '')}>
        <SelectTrigger className="h-8 w-[160px] text-[13px] bg-background/60 backdrop-blur-sm border-border/50">
          <SlidersHorizontal className="size-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="All Actions" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={dateFrom}
          onChange={e => onDateFromChange(e.target.value)}
          className={cn(
            'h-8 rounded-md border border-border/50 bg-background/60 backdrop-blur-sm px-2 text-[13px] text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/30',
            !dateFrom && 'text-muted-foreground',
          )}
        />
        <span className="text-[12px] text-muted-foreground">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => onDateToChange(e.target.value)}
          className={cn(
            'h-8 rounded-md border border-border/50 bg-background/60 backdrop-blur-sm px-2 text-[13px] text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/30',
            !dateTo && 'text-muted-foreground',
          )}
        />
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5 mr-1" />
          Clear
        </Button>
      )}

      {/* Refresh */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh audit log"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground ml-auto"
      >
        <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
      </Button>
    </div>
  );
}
