'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

const REPORT_TYPES = [
  { key: 'sales',     label: 'Sales Summary' },
  { key: 'products',  label: 'Top Products' },
  { key: 'frequency', label: 'Purchase Frequency' },
  { key: 'payments',  label: 'Payments' },
  { key: 'inventory', label: 'Inventory / Low Stock' },
  { key: 'expiry',    label: 'Expiring Soon' },
  { key: 'monthly',   label: 'Monthly Summary' },
  { key: 'valuation', label: 'Stock Valuation' },
];

// Export is available for the types the export API can produce.
const EXPORTABLE = ['sales', 'products', 'frequency', 'payments', 'inventory', 'expiry'];

export default function ReportControls({
  type, from, to,
}: { type: string; from: string; to: string }) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const apply = (next: { type?: string; from?: string; to?: string }) => {
    const t = next.type ?? type;
    const f = next.from ?? localFrom;
    const tt = next.to ?? localTo;
    const qs = new URLSearchParams({ tab: t });
    if (f) qs.set('from', f);
    if (tt) qs.set('to', tt);
    router.push(`/reports?${qs.toString()}`);
  };

  const exportHref = `/api/reports/export?type=${type}` +
    (localFrom ? `&from=${localFrom}` : '') +
    (localTo ? `&to=${localTo}` : '');

  // Stock Valuation is a point-in-time snapshot, so the date range is meaningless.
  const isSnapshot = type === 'valuation';

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
      {/* Report type */}
      <div className="flex flex-col gap-1.5 sm:w-64">
        <label className="text-xs font-semibold text-muted-foreground">Report Type</label>
        <Select value={type} onValueChange={(v) => v && apply({ type: v })}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REPORT_TYPES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Date range — hidden for point-in-time snapshot reports */}
      {!isSnapshot && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">From</label>
            <input
              type="date"
              value={localFrom}
              onChange={(e) => setLocalFrom(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">To</label>
            <input
              type="date"
              value={localTo}
              onChange={(e) => setLocalTo(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>

          <Button onClick={() => apply({})} className="h-10">Apply</Button>
        </>
      )}

      {EXPORTABLE.includes(type) && (
        <Button variant="outline" className="h-10 sm:ml-auto" nativeButton={false} render={<a href={exportHref} />}>
          <Download size={14} /> Export CSV
        </Button>
      )}
    </div>
  );
}
