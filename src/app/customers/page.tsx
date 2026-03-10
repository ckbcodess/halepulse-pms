import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { User, Phone, Award, Search, ArrowRight, Plus } from "lucide-react";
import Link from 'next/link';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenantId } = await getTenantContext();
  const params = await searchParams;
  const query = params.q || '';

  const customers = await prisma.customer.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: query } },
        { phone: { contains: query } },
      ]
    },
    orderBy: { loyaltyPoints: 'desc' },
    take: 50
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Customers & Loyalty</h2>
          <p className="text-slate-500 dark:text-slate-400">Track customer purchases and award loyalty points.</p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Customer
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-[#18181b] p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
            <form className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search customers by name or phone..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-[#111113] text-slate-900 dark:text-slate-200"
              />
            </form>
          </div>

          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-xl shadow-sm overflow-hidden">
            {customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <User size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No customers found</p>
                <Link href="/customers/new" className="text-indigo-500 text-sm mt-2 hover:underline">Add your first customer</Link>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Phone</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Points</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Join Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                          <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-full text-blue-600 dark:text-blue-400">
                            <User size={16} />
                          </div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.name}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          {c.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Award size={14} className="text-orange-500" />
                          <span className="font-bold text-slate-900 dark:text-white">{c.loyaltyPoints}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-400">
                        <div className="flex items-center justify-end gap-2">
                          {new Date(c.createdAt).toLocaleDateString()}
                          <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Loyalty Insights Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl text-white shadow-lg">
            <Award size={32} className="mb-4 text-blue-200" />
            <h3 className="text-xl font-bold mb-2">Loyalty Program</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Customers earn 1 point for every ₵10 spent. Points can be redeemed for discounts on future prescriptions.
            </p>
            <div className="mt-6 pt-6 border-t border-blue-500/30">
              <p className="text-xs uppercase tracking-wider text-blue-200 font-bold mb-4">Top 5 Customers</p>
              <div className="space-y-4">
                {customers.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex justify-between items-center text-sm">
                    <span>{i+1}. {c.name}</span>
                    <span className="font-bold">{c.loyaltyPoints} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
