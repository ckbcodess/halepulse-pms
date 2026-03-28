'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { AuditFilterBar } from '@/components/inventory/AuditFilterBar';
import { AuditTable } from '@/components/inventory/AuditTable';
import { AuditDetailSheet, type AuditEntry } from '@/components/inventory/AuditDetailSheet';

// ── Types ─────────────────────────────────────────────────────────────────────
type PaginatedAuditResponse = {
  items: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const PAGE_SIZE = 30;

// ── Fetcher ──────────────────────────────────────────────────────────────────
async function fetchAuditLogs(
  page: number,
  limit: number,
  actionType: string,
  search: string,
  dateFrom: string,
  dateTo: string,
): Promise<PaginatedAuditResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (actionType) params.set('actionType', actionType);
  if (search) params.set('search', search);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const res = await fetch(`/api/inventory/audit-log?${params}`);
  if (!res.ok) throw new Error('Failed to load audit log');
  return res.json();
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AuditLogView() {
  const queryClient = useQueryClient();

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Table state
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Sheet state
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasFilters = !!actionType || !!dateFrom || !!dateTo || !!search;

  // Query — staleTime:0 ensures data is always fresh on focus/mount
  const { data, isLoading, isPlaceholderData, isFetching, refetch } = useQuery({
    queryKey: ['audit-log', page, debouncedSearch, actionType, dateFrom, dateTo],
    queryFn: () => fetchAuditLogs(page, PAGE_SIZE, actionType, debouncedSearch, dateFrom, dateTo),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const entries = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  // Handlers
  const handleSelectEntry = useCallback((entry: AuditEntry) => {
    setSelectedEntry(entry);
    setSheetOpen(true);
  }, []);

  const handleReverted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    setSheetOpen(false);
    setSelectedEntry(null);
  }, [queryClient]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setActionType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const handleActionTypeChange = useCallback((value: string) => {
    setActionType(value);
    setPage(1);
  }, []);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    setPage(1);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    setPage(1);
  }, []);

  // Keyboard: Esc closes sheet, / focuses search
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && sheetOpen) {
        setSheetOpen(false);
        return;
      }
      // / to focus search (when not in input)
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-slot="audit-search"]');
        searchInput?.focus();
      }
    }
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, [sheetOpen]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Audit Log"
        description="Track all inventory changes"
      />

      {/* Filter bar */}
      <div className="mb-4">
        <AuditFilterBar
          search={search}
          onSearchChange={setSearch}
          actionType={actionType}
          onActionTypeChange={handleActionTypeChange}
          dateFrom={dateFrom}
          onDateFromChange={handleDateFromChange}
          dateTo={dateTo}
          onDateToChange={handleDateToChange}
          onClear={handleClearFilters}
          hasFilters={hasFilters}
          onRefresh={handleRefresh}
          isRefreshing={isFetching}
        />
      </div>

      {/* Table */}
      <AuditTable
        entries={entries}
        isLoading={isLoading}
        focusedIndex={focusedIndex}
        onFocusedIndexChange={setFocusedIndex}
        onSelectEntry={handleSelectEntry}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 px-2 py-2.5 mt-auto">
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {total.toLocaleString()} entries
            {isPlaceholderData && ' (loading...)'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-[12px] text-muted-foreground px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <AuditDetailSheet
        entry={selectedEntry}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onReverted={handleReverted}
      />
    </div>
  );
}
