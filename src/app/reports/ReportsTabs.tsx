'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const TABS = [
  { key: 'sales', label: 'Sales & Finance' },
  { key: 'inventory', label: 'Inventory Health' },
  { key: 'products', label: 'Product Performance' },
];

export default function ReportsTabs({ tab }: { tab: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.push(`/reports?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-none">
      {TABS.map(({ key, label }) => {
        const isActive = tab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={`
              relative px-3 pb-2.5 pt-0.5 text-[13px] font-semibold transition-colors whitespace-nowrap focus:outline-none
              ${isActive
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground after:rounded-t-full'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
