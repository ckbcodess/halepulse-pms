'use client';

import {
  BarChart, Bar, XAxis, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Info, AlertTriangle, Clock, Calendar, ChevronDown, GitCompareArrows, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Calligraph } from 'calligraph';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardProps {
  userName: string;
  firstName?: string | null;
  stats: {
    totalProducts: number;
    lowStock: number;
    expiringSoon: number;
    salesToday: number;
    salesChange: number | null;
  };
  monthlySales: { month: string; amount: number }[];
  todayByPayment: { name: string; value: number }[];
  recentSales: {
    id: number;
    customerName: string;
    time: string;
    itemCount: number;
    amount: number;
  }[];
  alerts: {
    lowStockCount: number;
    expiringCount: number;
  };
  /** Widget keys hidden for this user's role (set by Super Admin). */
  hiddenWidgets?: string[];
  /** Period filter — only the manager dashboard wires these. When `range`
   *  is omitted the filter bar is hidden. */
  range?: string;
  compare?: boolean;
  salesLabel?: string;
}

const PERIOD_OPTIONS: { value: string; label: string; compareLabel: string }[] = [
  { value: 'today', label: 'Today',         compareLabel: 'yesterday' },
  { value: '7',     label: 'Last 7 days',   compareLabel: 'previous 7 days' },
  { value: '30',    label: 'Last 30 days',  compareLabel: 'previous 30 days' },
  { value: '90',    label: 'Last 90 days',  compareLabel: 'previous 90 days' },
  { value: '365',   label: 'Last 12 months', compareLabel: 'previous year' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Fixed per-payment-method colors (light/dark handled by the CSS vars in globals.css).
// Any other payment type falls back to the secondary chart palette.
const PAYMENT_COLORS: Record<string, string> = {
  Cash: 'var(--pay-cash)',
  MoMo: 'var(--pay-momo)',
  Split: 'var(--pay-split)',
};
const DONUT_FALLBACK = [
  'var(--chart-secondary-1)',
  'var(--chart-secondary-2)',
  'var(--chart-secondary-3)',
  'var(--chart-secondary-4)',
  'var(--chart-secondary-5)',
];
const paymentColor = (name: string, index: number): string =>
  PAYMENT_COLORS[name] ?? DONUT_FALLBACK[index % DONUT_FALLBACK.length];

const salesChartConfig = {
  amount: {
    label: 'Revenue',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  change,
  indicator,
  hint,
}: {
  label: string;
  value: string;
  change?: number | null;
  indicator?: 'warning';
  hint?: string;
}) {
  return (
    <Card className="p-6 py-6 gap-0">
      <div className="flex items-center gap-1.5 mb-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        {hint && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  className="inline-flex text-muted-foreground/40 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:text-muted-foreground"
                />
              }
            >
              <Info className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-medium text-card-foreground leading-none tracking-tight">
          <Calligraph variant="number" animation="snappy" initial>{value}</Calligraph>
        </p>
        {indicator === 'warning' && (
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mb-1.5" />
        )}
        {change != null && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-md mb-0.5 ${
              change >= 0
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  );
}



// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DashboardView({
  userName,
  firstName: firstNameProp,
  stats,
  monthlySales,
  todayByPayment,
  recentSales,
  alerts,
  hiddenWidgets = [],
  range,
  compare = true,
  salesLabel,
}: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const goFilter = (next: { range?: string; compare?: boolean }) => {
    const params = new URLSearchParams();
    params.set('range', next.range ?? range ?? '30');
    params.set('compare', (next.compare ?? compare) ? '1' : '0');
    router.push(`${pathname}?${params.toString()}`);
  };
  const compareLabel =
    (PERIOD_OPTIONS.find((o) => o.value === range) ?? PERIOD_OPTIONS[2]).compareLabel;
  const firstName = firstNameProp
    ? firstNameProp
    : userName.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const totalEarning = todayByPayment.reduce((sum, item) => sum + item.value, 0);
  const hidden = new Set(hiddenWidgets);
  const show = (key: string) => !hidden.has(key);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description={getFormattedDate()}
      />

      {/* ── Filter bar ── */}
      {range && (
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
              <Calendar className="size-4" />
              {salesLabel ?? 'Last 30 days'}
              <ChevronDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PERIOD_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => goFilter({ range: opt.value })}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
              <GitCompareArrows className="size-4" />
              {compare ? `vs ${compareLabel}` : 'No comparison'}
              <ChevronDown className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => goFilter({ compare: true })}>
                Compare vs {compareLabel}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goFilter({ compare: false })}>
                No comparison
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {show('kpi_total_inventory') && (
          <StatCard
            label="Total Inventory"
            value={stats.totalProducts.toLocaleString()}
            hint="The total number of distinct products currently tracked in your inventory."
          />
        )}
        {show('kpi_low_stock') && (
          <StatCard
            label="Low Stock Alerts"
            value={stats.lowStock.toLocaleString()}
            indicator={stats.lowStock > 0 ? 'warning' : undefined}
            hint="Products that have dropped below the minimum stock threshold of 5 units."
          />
        )}
        {show('kpi_expiring') && (
          <StatCard
            label="Expiring Soon"
            value={stats.expiringSoon.toLocaleString()}
            hint="Products with a batch expiring within the next 30 days."
          />
        )}
        {show('kpi_sales_today') && (
          <StatCard
            label={salesLabel ? `Sales · ${salesLabel}` : 'Sales Today'}
            value={`₵${stats.salesToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={stats.salesChange}
            hint={
              salesLabel
                ? `Total revenue for ${salesLabel}${compare ? `, compared with the ${compareLabel}.` : '.'}`
                : `Total revenue from sales completed today${compare ? ', compared with yesterday.' : '.'}`
            }
          />
        )}
      </div>

      {/* ── Charts row ── */}
      {(show('monthly_revenue') || show('todays_report')) && (
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Monthly Progress */}
        {show('monthly_revenue') && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Progress</CardTitle>
            <CardDescription>
              Revenue over the last {monthlySales.length} months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={salesChartConfig}>
              <BarChart accessibilityLayer data={monthlySales} barCategoryGap="20%">
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={8} maxBarSize={32} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="flex gap-2 leading-none font-medium">
              {stats.salesChange != null && stats.salesChange >= 0
                ? `Trending up ${stats.salesChange.toFixed(1)}% this month`
                : 'Showing monthly revenue'}
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Total revenue by month
            </div>
          </CardFooter>
        </Card>
        )}

        {/* Today's Report (Donut) */}
        {show('todays_report') && (
        <Card className="p-6 py-6 gap-0">
          <h3 className="text-lg font-medium text-card-foreground mb-2">Today&apos;s Report</h3>
          {todayByPayment.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px]">
              <p className="text-sm text-muted-foreground">No sales data for today</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-[200px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={todayByPayment}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="var(--card)"
                    >
                      {todayByPayment.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={paymentColor(entry.name, index)}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-muted-foreground">Total Earning</p>
                  <p className="text-xl font-medium text-card-foreground">
                    <Calligraph variant="number" animation="snappy" initial>
                      {`₵${totalEarning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </Calligraph>
                  </p>
                </div>
              </div>
              {/* Per-payment breakdown */}
              <div className="mt-3 flex flex-col gap-1.5 w-full max-w-[240px] mx-auto">
                {todayByPayment.map((item, i) => {
                  const pct = totalEarning > 0 ? (item.value / totalEarning) * 100 : 0;
                  return (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: paymentColor(item.name, i) }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="text-muted-foreground/60 tabular-nums">{pct.toFixed(0)}%</span>
                      <span className="ml-auto font-medium text-foreground tabular-nums">
                        ₵{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
        )}
      </div>
      )}

      {/* ── Bottom row ── */}
      {(show('recent_transactions') || show('inventory_alerts')) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        {show('recent_transactions') && (
        <Card className="py-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-medium text-card-foreground">Recent Transactions</h3>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/reports" />}>
              View report
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentSales.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                      {sale.customerName[0]?.toUpperCase() || 'W'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        {sale.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.time} · {sale.itemCount} items
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-card-foreground">
                    ₵{sale.amount.toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
        )}

        {/* Inventory Alerts */}
        {show('inventory_alerts') && (
        <Card className="py-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-medium text-card-foreground">Inventory Alerts</h3>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/inventory" />}>
              View report
            </Button>
          </div>
          <div className="p-6 flex flex-col gap-5">
            {alerts.lowStockCount > 0 && (
              <div className="flex gap-4">
                <div className="w-12 h-12 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="size-6 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">Low Stock Remaining</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {alerts.lowStockCount} products have dropped below the minimum stock
                    threshold of 5 units.
                  </p>
                </div>
              </div>
            )}
            {alerts.expiringCount > 0 && (
              <div className="flex gap-4">
                <div className="w-12 h-12 shrink-0 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                  <Clock className="size-6 text-rose-500" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">Expiring Soon</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {alerts.expiringCount} products are expiring within the next 30 days.
                  </p>
                </div>
              </div>
            )}
            {alerts.lowStockCount === 0 && alerts.expiringCount === 0 && (
              <p className="text-sm text-muted-foreground">No alerts at this time.</p>
            )}
          </div>
        </Card>
        )}
      </div>
      )}
    </div>
  );
}
