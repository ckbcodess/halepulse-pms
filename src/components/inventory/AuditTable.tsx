'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AuditActionBadge } from './AuditActionBadge';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';
import type { AuditEntry } from './AuditDetailSheet';

function getEntityLabel(entry: AuditEntry): string {
  const nv = (entry.newValue ?? {}) as Record<string, any>;
  switch (entry.actionType) {
    case 'SALE_COMPLETED':          return `Sale #${nv.saleId ?? ''}  —  $${nv.totalAmount ?? ''}`;
    case 'CUSTOMER_CREATED':        return nv.name ?? 'New customer';
    case 'BULK_IMPORT':             return `${nv.created ?? 0} products imported`;
    case 'CATEGORY_MARKUP_UPDATED': return 'Category markups';
    case 'SETTINGS_UPDATED':        return 'Tenant settings';
    case 'PASSWORD_CHANGED':        return 'Password';
    default:                        return entry.notes ?? '—';
  }
}

interface AuditTableProps {
  entries: AuditEntry[];
  isLoading: boolean;
  focusedIndex: number;
  onFocusedIndexChange: (index: number) => void;
  onSelectEntry: (entry: AuditEntry) => void;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AuditTable({
  entries,
  isLoading,
  focusedIndex,
  onFocusedIndexChange,
  onSelectEntry,
}: AuditTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // Keyboard navigation: j/k to move, Enter to select
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept if user is typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      onFocusedIndexChange(Math.min(focusedIndex + 1, entries.length - 1));
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      onFocusedIndexChange(Math.max(focusedIndex - 1, 0));
    } else if (e.key === 'Enter' && entries[focusedIndex]) {
      e.preventDefault();
      onSelectEntry(entries[focusedIndex]);
    }
  }, [entries, focusedIndex, onFocusedIndexChange, onSelectEntry]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused row into view
  useEffect(() => {
    const row = rowRefs.current.get(focusedIndex);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-2">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-[13px] text-muted-foreground">Loading audit log...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center space-y-1.5">
          <p className="text-[14px] text-muted-foreground">
            No audit entries found.
          </p>
          <p className="text-[13px] text-muted-foreground/70">
            Changes to inventory will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={tableRef} className="flex-1 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/50">
          <TableRow>
            <TableHead className="w-[140px] text-[12px] uppercase tracking-wider">Action</TableHead>
            <TableHead className="text-[12px] uppercase tracking-wider">Entity</TableHead>
            <TableHead className="w-[120px] text-[12px] uppercase tracking-wider">User</TableHead>
            <TableHead className="w-[100px] text-[12px] uppercase tracking-wider text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => (
            <TableRow
              key={entry.id}
              ref={el => { if (el) rowRefs.current.set(index, el); }}
              onClick={() => onSelectEntry(entry)}
              onKeyDown={e => { if (e.key === 'Enter') onSelectEntry(entry); }}
              tabIndex={0}
              role="button"
              aria-label={`Audit entry ${entry.id}: ${entry.actionType}`}
              className={cn(
                'cursor-pointer transition-colors duration-100',
                index === focusedIndex && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
                entry.revertedAt && 'opacity-60',
              )}
            >
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <AuditActionBadge actionType={entry.actionType} />
                  {entry.revertedAt && (
                    <RotateCcw className="size-3 text-orange-500/70" />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-[14px]">
                {entry.product?.name
                  ?? entry.supplier?.name
                  ?? getEntityLabel(entry)}
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">
                {entry.performer.username}
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground text-right tabular-nums">
                {formatRelativeTime(entry.performedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
