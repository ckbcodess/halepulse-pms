import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function StockValuePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const ctx = await getTenantContext();

  // Source of truth: the Product table — the same data inventory, the dashboard,
  // and the POS use. (The old StockItem batch ledger was only partially populated,
  // so it badly under-reported stock value.)
  const products = await prisma.product.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    select: { id: true, name: true, category: true, stockQty: true, costPrice: true, price: true },
  });

  const rows = products.map((p) => {
    const costPrice = p.costPrice ?? 0;
    const sellingPrice = p.price;
    const costValue = costPrice * p.stockQty;
    const sellingValue = sellingPrice * p.stockQty;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      quantity: p.stockQty,
      costPrice,
      sellingPrice,
      costValue,
      sellingValue,
      profit: sellingValue - costValue,
    };
  });
  rows.sort((a, b) => b.sellingValue - a.sellingValue);

  const totalProducts = products.length;
  const totalQty = rows.reduce((a, r) => a + r.quantity, 0);
  const totalCost = rows.reduce((a, r) => a + r.costValue, 0);
  const totalSelling = rows.reduce((a, r) => a + r.sellingValue, 0);
  const totalProfit = totalSelling - totalCost;

  const cards = [
    { label: 'Total Products', value: totalProducts.toLocaleString() },
    { label: 'Total Quantity', value: totalQty.toLocaleString() },
    { label: 'Total Cost Value', value: money(totalCost) },
    { label: 'Total Selling Value', value: money(totalSelling) },
    { label: 'Potential Profit', value: money(totalProfit) },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Stock Value</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="text-xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Cost Price</th>
              <th className="px-3 py-2 text-right">Selling Price</th>
              <th className="px-3 py-2 text-right">Cost Value</th>
              <th className="px-3 py-2 text-right">Selling Value</th>
              <th className="px-3 py-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-gray-500">{r.category}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="px-3 py-2 text-right">{money(r.costPrice)}</td>
                <td className="px-3 py-2 text-right">{money(r.sellingPrice)}</td>
                <td className="px-3 py-2 text-right">{money(r.costValue)}</td>
                <td className="px-3 py-2 text-right">{money(r.sellingValue)}</td>
                <td className="px-3 py-2 text-right">{money(r.profit)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No stock items</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
