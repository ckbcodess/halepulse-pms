import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import PageHeader from '@/components/layout/PageHeader';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

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
      <PageHeader title="Stock Value" description="Inventory valued at cost and selling price." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-right">Cost Value</TableHead>
              <TableHead className="text-right">Selling Value</TableHead>
              <TableHead className="text-right">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.category}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell className="text-right">{money(r.costPrice)}</TableCell>
                <TableCell className="text-right">{money(r.sellingPrice)}</TableCell>
                <TableCell className="text-right">{money(r.costValue)}</TableCell>
                <TableCell className="text-right">{money(r.sellingValue)}</TableCell>
                <TableCell className="text-right">{money(r.profit)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No stock items</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
