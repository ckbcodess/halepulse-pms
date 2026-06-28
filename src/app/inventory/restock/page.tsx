'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import QuickRestock from './QuickRestock';
import BatchRestock from './BatchRestock';

const TABS = [
  { key: 'quick' as const, label: 'Quick Restock' },
  { key: 'batch' as const, label: 'Batch Restock' },
];

export default function RestockPage() {
  const [tab, setTab] = useState<'quick' | 'batch'>('quick');

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Restock"
        description="Top up stock — key items in manually, or import a supplier invoice CSV."
      />

      {/* Tabs */}
      <div className="mt-6 flex items-center gap-1 border-b border-border">
        {TABS.map(({ key, label }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`
                relative px-3 pb-2.5 pt-0.5 text-[13px] font-medium transition-colors
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

      <div className="mt-8">
        {tab === 'quick' ? <QuickRestock /> : <BatchRestock />}
      </div>
    </div>
  );
}
