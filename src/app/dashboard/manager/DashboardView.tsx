'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Card } from '@/components/ui/card';
import {
  Info, AlertTriangle, Clock, Calendar, ChevronDown, CircleAlert,
} from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardProps {
  userName: string;
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
}

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

const DONUT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  change,
  indicator,
}: {
  label: string;
  value: string;
  change?: number | null;
  indicator?: 'warning';
}) {
  return (
    <Card className="p-6 py-6 gap-0">
      <div className="flex items-center gap-1.5 mb-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Info className="size-4 text-muted-foreground/40" />
      </div>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-medium text-card-foreground leading-none tracking-tight">
          {value}
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

// Custom tooltip for the bar chart
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-card-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        ₵{Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DashboardView({
  userName,
  stats,
  monthlySales,
  todayByPayment,
  recentSales,
  alerts,
}: DashboardProps) {
  const firstName = userName.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const totalEarning = todayByPayment.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-[28px] font-medium text-card-foreground">
          {getGreeting()}, {firstName}
          <span className="ml-1">💙</span>
        </h1>
        <p className="text-muted-foreground mt-1">{getFormattedDate()}</p>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-3">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm text-card-foreground hover:bg-muted transition-colors"
        >
          <Calendar className="size-4" />
          Last 30 days
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm text-card-foreground hover:bg-muted transition-colors"
        >
          <CircleAlert className="size-4" />
          Compare: Previous period
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Inventory" value={stats.totalProducts.toLocaleString()} />
        <StatCard
          label="Low Stock Alerts"
          value={stats.lowStock.toLocaleString()}
          indicator={stats.lowStock > 0 ? 'warning' : undefined}
        />
        <StatCard label="Expiring Soon" value={stats.expiringSoon.toLocaleString()} />
        <StatCard
          label="Sales Today"
          value={`₵${stats.salesToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={stats.salesChange}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Monthly Progress */}
        <Card className="p-6 py-6 gap-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-card-foreground">Monthly Progress</h3>
            <span className="text-sm text-muted-foreground border border-border rounded-lg px-3 py-1">
              Monthly
            </span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Today's Report (Donut) */}
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
                      stroke="hsl(var(--card))"
                    >
                      {todayByPayment.map((_entry, index) => (
                        <Cell
                          key={index}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-muted-foreground">Total Earning</p>
                  <p className="text-xl font-medium text-card-foreground">
                    ₵{totalEarning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                {todayByPayment.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <Card className="py-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-medium text-card-foreground">Recent Transactions</h3>
            <Link
              href="/reports"
              className="text-sm font-medium text-primary hover:underline border border-border rounded-lg px-3 py-1"
            >
              View report
            </Link>
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

        {/* Inventory Alerts */}
        <Card className="py-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-medium text-card-foreground">Inventory Alerts</h3>
            <Link
              href="/inventory"
              className="text-sm font-medium text-primary hover:underline border border-border rounded-lg px-3 py-1"
            >
              View report
            </Link>
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
      </div>
    </div>
  );
}
