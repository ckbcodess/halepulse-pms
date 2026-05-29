'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Field display config ─────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // Product fields
  name: 'Name',
  brand: 'Brand',
  category: 'Category',
  unit: 'Unit',
  sku: 'SKU',
  price: 'Selling Price',
  costPrice: 'Cost Price',
  markupPercent: 'Markup %',
  stockQty: 'Stock Qty',
  lowStockThreshold: 'Low Stock Threshold',
  expiryDate: 'Expiry Date',
  isActive: 'Active',
  // Supplier fields
  contactName: 'Contact Name',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  notes: 'Notes',
  // Stock adjustment fields
  quantity: 'Quantity',
  delta: 'Delta',
  reason: 'Reason',
  oldQuantity: 'Old Quantity',
  newQuantity: 'New Quantity',
  // Sale fields
  saleId: 'Sale ID',
  totalAmount: 'Total Amount',
  discount: 'Discount',
  paymentType: 'Payment Type',
  itemCount: 'Items',
  customerId: 'Customer ID',
  // Customer fields
  // Bulk import fields
  totalRows: 'Total Rows',
  created: 'Created',
  skipped: 'Skipped',
  errorCount: 'Errors',
  // Settings fields
  legalName: 'Legal Name',
  primaryPhone: 'Phone',
  primaryEmail: 'Email',
  primaryContact: 'Primary Contact',
  licenceNumber: 'Licence Number',
  taxVatNumber: 'Tax/VAT Number',
  // Auth fields
  userId: 'User ID',
  timestamp: 'Timestamp',
};

const CURRENCY_FIELDS = new Set(['price', 'costPrice', 'totalAmount', 'discount']);
const PERCENT_FIELDS = new Set(['markupPercent']);
const INTEGER_FIELDS = new Set(['stockQty', 'lowStockThreshold', 'quantity', 'delta', 'oldQuantity', 'newQuantity', 'saleId', 'customerId', 'userId', 'itemCount', 'totalRows', 'created', 'skipped', 'errorCount']);
const BOOLEAN_FIELDS = new Set(['isActive']);

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (CURRENCY_FIELDS.has(key)) return `$${Number(value).toFixed(2)}`;
  if (PERCENT_FIELDS.has(key)) return `${Number(value).toFixed(1)}%`;
  if (INTEGER_FIELDS.has(key)) return String(Math.round(Number(value)));
  if (BOOLEAN_FIELDS.has(key)) return value ? 'Yes' : 'No';
  if (key === 'expiryDate' && value) {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }
  return String(value);
}

interface AuditDiffViewProps {
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
}

export function AuditDiffView({ oldValue, newValue }: AuditDiffViewProps) {
  const [showRaw, setShowRaw] = useState(false);

  const old = oldValue ?? {};
  const next = newValue ?? {};

  // Collect all keys, prioritize whitelisted ones first
  const allKeys = new Set([...Object.keys(old), ...Object.keys(next)]);
  const knownKeys = Array.from(allKeys).filter(k => k in FIELD_LABELS);
  const unknownKeys = Array.from(allKeys).filter(k => !(k in FIELD_LABELS));

  // Only show fields that actually changed
  const changedKnown = knownKeys.filter(k => {
    const oldVal = old[k];
    const newVal = next[k];
    return String(oldVal ?? '') !== String(newVal ?? '');
  });

  if (changedKnown.length === 0 && unknownKeys.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground italic">
        No field-level changes detected.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {changedKnown.length > 0 && (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-0 text-[12px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 px-3 py-2">
            <span>Field</span>
            <span>Before</span>
            <span>After</span>
          </div>
          {changedKnown.map(key => (
            <div
              key={key}
              className="grid grid-cols-[1fr_1fr_1fr] gap-0 px-3 py-2 border-t border-border/30 text-[13px]"
            >
              <span className="text-muted-foreground">{FIELD_LABELS[key]}</span>
              <span className="font-mono text-red-600/80 dark:text-red-400/80 line-through decoration-red-400/40">
                {formatValue(key, old[key])}
              </span>
              <span className="font-mono text-emerald-600/80 dark:text-emerald-400/80">
                {formatValue(key, next[key])}
              </span>
            </div>
          ))}
        </div>
      )}

      {unknownKeys.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw(!showRaw)}
          className="mt-2 text-muted-foreground hover:text-foreground"
        >
          {showRaw ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {showRaw ? 'Hide' : 'Show'} raw data ({unknownKeys.length} field{unknownKeys.length !== 1 ? 's' : ''})
        </Button>
      )}

      {showRaw && (
        <pre className="mt-1 rounded-lg bg-muted/30 border border-border/50 p-3 text-[12px] font-mono text-muted-foreground overflow-x-auto max-h-48 custom-scrollbar">
          {JSON.stringify({ old: oldValue, new: newValue }, null, 2)}
        </pre>
      )}
    </div>
  );
}
