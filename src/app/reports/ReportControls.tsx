'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Export is available for the types the export API can produce.
const EXPORTABLE = ['sales', 'products', 'frequency', 'payments', 'inventory', 'expiry', 'valuation'];

export default function ReportControls({
  type, from, to,
}: { type: string; from: string; to: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (localFrom) params.set('from', localFrom);
    if (localTo) params.set('to', localTo);
    router.push(`/reports?${params.toString()}`);
  };

  const exportHref = `/api/reports/export?type=${type}` +
    (localFrom ? `&from=${localFrom}` : '') +
    (localTo ? `&to=${localTo}` : '');

  // Stock Valuation is a point-in-time snapshot, so the date range is meaningless.
  const isSnapshot = type === 'valuation';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between py-2 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {!isSnapshot && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</span>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={localFrom}
                  onChange={(e) => setLocalFrom(e.target.value)}
                  className="h-9 px-3 bg-background dark:bg-input/30 border border-border dark:border-input rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 transition-colors cursor-pointer hover:bg-muted/40"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</span>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={localTo}
                  onChange={(e) => setLocalTo(e.target.value)}
                  className="h-9 px-3 bg-background dark:bg-input/30 border border-border dark:border-input rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 transition-colors cursor-pointer hover:bg-muted/40"
                />
              </div>
            </div>

            <Button onClick={apply} size="sm" className="h-9 px-4 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-colors">
              Apply
            </Button>
          </>
        )}
      </div>

      {EXPORTABLE.includes(type) && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3.5 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2"
          nativeButton={false}
          render={<a href={exportHref} />}
        >
          <Download size={14} /> Export CSV
        </Button>
      )}
    </div>
  );
}
