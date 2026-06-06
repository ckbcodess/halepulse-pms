'use client';

import { useRouter } from 'next/navigation';
import { TrendingUp, Package, Calendar, BarChart2, Wallet, Repeat, CalendarRange } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = [
  { key: 'sales', label: 'Sales Summary', icon: TrendingUp },
  { key: 'monthly', label: 'Monthly', icon: CalendarRange },
  { key: 'payments', label: 'Payments', icon: Wallet },
  { key: 'products', label: 'Top Products', icon: BarChart2 },
  { key: 'frequency', label: 'Frequency', icon: Repeat },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'expiry', label: 'Expiry', icon: Calendar },
];

export function ReportsTabs({ tab, range }: { tab: string; range: string }) {
  const router = useRouter();

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => router.push(`/reports?tab=${value}&range=${range}`)}
    >
      <TabsList className="w-full">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            <t.icon size={14} />
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
