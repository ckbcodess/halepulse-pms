import prisma from '@/lib/prisma';
import InventoryView from './InventoryView';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const filter = params.filter || 'all';

  const products = await prisma.product.findMany({
    where: {
      AND: [
        { name: { contains: query.toUpperCase() } },
        filter === 'low' ? { stockQty: { lte: 5 } } : {},
        filter === 'expired' ? { expiryDate: { lte: new Date() } } : {},
      ]
    },
    orderBy: { name: 'asc' },
    take: 100 // Limit for performance, search handles the rest
  });

  // Convert Date objects to ISO strings for safe passing to Client Components
  const serializedProducts = products.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null
  }));

  return <InventoryView products={serializedProducts} query={query} filter={filter} />;
}
