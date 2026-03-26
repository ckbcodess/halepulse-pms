import { getTenantContext } from '@/lib/auth/getTenantContext';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { ArrowLeft, Phone, Award, ShoppingBag, Calendar, TrendingUp, User } from 'lucide-react';
import Link from 'next/link';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await getTenantContext();

  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) notFound();

  const tenantFilter = { tenantId };

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...tenantFilter },
  });

  if (!customer) notFound();

  const sales = await prisma.sale.findMany({
    where: { customerId, ...tenantFilter },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      items: {
        include: { product: { select: { name: true, category: true } } },
      },
    },
  });

  const totalSpent = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const avgSale = sales.length > 0 ? totalSpent / sales.length : 0;
  const lastVisit = sales[0]?.createdAt ?? null;

  const tier =
    customer.loyaltyPoints >= 500 ? { label: 'Gold', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' } :
    customer.loyaltyPoints >= 200 ? { label: 'Silver', color: 'text-muted-foreground dark:text-muted-foreground', bg: 'bg-muted dark:bg-sidebar' } :
    { label: 'Bronze', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link href="/customers" className="p-2 rounded-xl border border-border dark:border-white/5 hover:bg-muted dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={16} className="text-muted-foreground" />
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-primary/20 flex items-center justify-center text-lg font-bold text-indigo-700 dark:text-primary/70">
            {customer.name[0]}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground dark:text-white">{customer.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              {customer.phone && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone size={12} /> {customer.phone}
                </span>
              )}
              <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                <Award size={10} /> {tier.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Spent',    value: `₵${totalSpent.toFixed(2)}`,         icon: TrendingUp,  color: 'text-primary' },
          { label: 'Transactions',   value: sales.length.toString(),              icon: ShoppingBag, color: 'text-emerald-600' },
          { label: 'Avg Sale',       value: `₵${avgSale.toFixed(2)}`,             icon: TrendingUp,  color: 'text-amber-600'  },
          { label: 'Loyalty Points', value: customer.loyaltyPoints.toString(),    icon: Award,       color: 'text-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-[#18181b] border border-border dark:border-white/5 rounded-2xl p-5">
            <s.icon size={18} className={`${s.color} mb-3`} />
            <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-1">{s.label}</p>
            <p className="text-xl font-bold text-foreground dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Customer info card */}
      <div className="bg-white dark:bg-[#18181b] border border-border dark:border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground dark:text-muted-foreground mb-4 flex items-center gap-2">
          <User size={14} /> Customer Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
            <p className="text-sm font-medium text-foreground dark:text-muted-foreground">{customer.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Member Since</p>
            <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
              {new Date(customer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Last Visit</p>
            <p className="text-sm font-medium text-foreground dark:text-muted-foreground">
              {lastVisit ? new Date(lastVisit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No visits'}
            </p>
          </div>
        </div>
      </div>

      {/* Purchase History */}
      <div className="bg-white dark:bg-[#18181b] border border-border dark:border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border dark:border-white/5">
          <h3 className="text-base font-semibold text-foreground dark:text-white">Purchase History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{sales.length} transaction{sales.length !== 1 ? 's' : ''}</p>
        </div>

        {sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingBag size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No purchase history yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {sales.map(sale => (
              <div key={sale.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-foreground dark:text-muted-foreground">
                        ₵{sale.totalAmount.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        {sale.paymentType}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sale.items.map((item, i) => (
                        <span key={i} className="text-[11px] bg-muted dark:bg-sidebar text-muted-foreground dark:text-muted-foreground px-2 py-0.5 rounded-md font-medium">
                          {item.product.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
