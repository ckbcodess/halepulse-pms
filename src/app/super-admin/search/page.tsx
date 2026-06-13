import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Search, Building2, GitBranch, Users, Package, ShoppingCart } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';

type SearchResult =
  | { type: 'business'; id: string; name: string; businessId: string | null; isActive: boolean }
  | { type: 'branch'; id: string; name: string; businessId: string | null; tenantId: string; tenantName: string }
  | { type: 'user'; id: number; email: string | null; role: string | null; tenantId: string | null }
  | { type: 'product'; id: number; name: string; category: string; tenantId: string | null }
  | { type: 'sale'; id: number; totalAmount: number; createdAt: Date; tenantId: string | null; clientToken: string | null };

async function doSearch(q: string): Promise<SearchResult[]> {
  if (!q || q.length < 2) return [];

  const [tenants, branches, users, products, sales] = await Promise.all([
    prisma.tenant.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { businessId: { contains: q, mode: 'insensitive' } },
        { subdomain: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, name: true, businessId: true, isActive: true },
      take: 5,
    }),
    prisma.branch.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { businessId: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, name: true, businessId: true, tenantId: true, tenant: { select: { name: true } } },
      take: 5,
    }),
    prisma.user.findMany({
      where: { OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { businessUsername: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, email: true, saasRole: true, tenantId: true },
      take: 5,
    }),
    prisma.product.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ]},
      select: { id: true, name: true, category: true, tenantId: true },
      take: 5,
    }),
    prisma.sale.findMany({
      where: { clientToken: q },
      select: { id: true, totalAmount: true, createdAt: true, tenantId: true, clientToken: true },
      take: 5,
    }),
  ]);

  return [
    ...tenants.map(t => ({ type: 'business' as const, id: t.id, name: t.name, businessId: t.businessId, isActive: t.isActive })),
    ...branches.map(b => ({ type: 'branch' as const, id: b.id, name: b.name, businessId: b.businessId, tenantId: b.tenantId, tenantName: b.tenant.name })),
    ...users.map(u => ({ type: 'user' as const, id: u.id, email: u.email, role: u.saasRole, tenantId: u.tenantId })),
    ...products.map(p => ({ type: 'product' as const, id: p.id, name: p.name, category: p.category, tenantId: p.tenantId })),
    ...sales.map(s => ({ type: 'sale' as const, id: s.id, totalAmount: s.totalAmount, createdAt: s.createdAt, tenantId: s.tenantId, clientToken: s.clientToken })),
  ];
}

const GROUP_CONFIG = {
  business: { label: 'Businesses', icon: Building2, color: 'text-primary' },
  branch: { label: 'Branches', icon: GitBranch, color: 'text-sky-500' },
  user: { label: 'Users', icon: Users, color: 'text-violet-500' },
  product: { label: 'Products', icon: Package, color: 'text-amber-500' },
  sale: { label: 'Sales', icon: ShoppingCart, color: 'text-emerald-500' },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const results = await doSearch(q);

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r as never);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Results"
        description={q ? `Showing results for "${q}" — ${results.length} found` : 'Enter a search term'}
      />

      {!q && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Search size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Use the search bar above to search across businesses, branches, users, products and sales.</p>
        </div>
      )}

      {q && results.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Search size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No results found for &ldquo;{q}&rdquo;. Try a different search term.</p>
        </div>
      )}

      {(Object.keys(grouped) as Array<keyof typeof GROUP_CONFIG>).map(type => {
        const group = grouped[type];
        if (!group?.length) return null;
        const config = GROUP_CONFIG[type];
        return (
          <div key={type} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-3 border-b border-border flex items-center gap-2">
              <config.icon size={16} className={config.color} />
              <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">{group.length}</Badge>
            </div>
            <div className="divide-y divide-border">
              {group.map((result) => (
                <div key={`${result.type}-${result.id}`} className="px-6 py-3">
                  {result.type === 'business' && (
                    <Link href={`/super-admin/tenants/${result.id}`} className="flex items-center justify-between hover:text-primary transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{result.name}</p>
                        {result.businessId && <code className="text-xs text-muted-foreground font-mono">{result.businessId}</code>}
                      </div>
                      <Badge variant={result.isActive ? 'success' : 'destructive'}>{result.isActive ? 'Active' : 'Inactive'}</Badge>
                    </Link>
                  )}
                  {result.type === 'branch' && (
                    <Link href={`/super-admin/tenants/${result.tenantId}/branches`} className="flex items-center justify-between hover:text-primary transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{result.name}</p>
                        <p className="text-xs text-muted-foreground">{result.tenantName} {result.businessId ? `· ${result.businessId}` : ''}</p>
                      </div>
                    </Link>
                  )}
                  {result.type === 'user' && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{result.email ?? 'No email'}</p>
                        {result.tenantId && (
                          <Link href={`/super-admin/tenants/${result.tenantId}`} className="text-xs text-primary hover:underline">
                            View business
                          </Link>
                        )}
                      </div>
                      {result.role && <Badge variant="secondary">{result.role}</Badge>}
                    </div>
                  )}
                  {result.type === 'product' && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{result.name}</p>
                        <p className="text-xs text-muted-foreground">{result.category}</p>
                      </div>
                      {result.tenantId && (
                        <Link href={`/super-admin/tenants/${result.tenantId}`} className="text-xs text-primary hover:underline">
                          View business
                        </Link>
                      )}
                    </div>
                  )}
                  {result.type === 'sale' && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Sale #{result.id} — ₵{result.totalAmount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(result.createdAt).toLocaleString()}{result.clientToken ? ` · ${result.clientToken}` : ''}</p>
                      </div>
                      {result.tenantId && (
                        <Link href={`/super-admin/tenants/${result.tenantId}`} className="text-xs text-primary hover:underline">
                          View business
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
