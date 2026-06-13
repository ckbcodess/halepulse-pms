import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';

/**
 * Tenant-scoped Prisma client.
 *
 * Multi-tenant safety in this app relies on every query carrying a `tenantId`
 * filter. Doing that by hand on every call is error-prone — one forgotten
 * `where: { tenantId }` is a cross-tenant data leak.
 *
 * `tenantScoped(tenantId)` returns a Prisma client that AUTOMATICALLY injects
 * the tenantId into reads, writes, updates and deletes for tenant-owned models.
 * Callers can no longer forget it.
 *
 * Design notes:
 * - This is OPT-IN. The default `prisma` client is unchanged, so auth lookups
 *   (by businessId/email) and cross-tenant super-admin queries keep working.
 * - Only models that actually have a `tenantId` column are scoped.
 * - For `create`, tenantId is forced into the data payload.
 * - For reads/updates/deletes, tenantId is merged into the `where` (AND), so an
 *   explicit filter can never widen the scope beyond the caller's tenant.
 */

// Models that own a `tenantId` column (must match prisma/schema.prisma).
const TENANT_MODELS = new Set([
  'Product',
  'Customer',
  'Sale',
  'SaleItem',
  'Payment',
  'Branch',
  'User',
  'Prescription',
  'RefillReminder',
  'StockAdjustment',
  'InventoryAuditLog',
  'GoodsReceivedNote',
  'StockMovement',
  'StockTakeSession',
  'ImportJob',
  'AuditLog',
  'PersonAssignment',
]);

const READ_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany',
]);

export function tenantScoped(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const a: any = args ?? {};

          if (operation === 'create') {
            a.data = { ...a.data, tenantId };
          } else if (operation === 'createMany') {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((r: any) => ({ ...r, tenantId }));
          } else if (operation === 'upsert') {
            a.create = { ...a.create, tenantId };
            a.where = { ...a.where, tenantId };
          } else if (READ_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
          }

          return query(a);
        },
      },
    },
  });
}

/**
 * Convenience: resolve the current request's tenant context and return a
 * client already scoped to it. Throws (via getTenantContext) if there is no
 * tenant context — which is the correct, safe failure for tenant routes.
 */
export async function getScopedPrisma() {
  const ctx = await getTenantContext();
  return { db: tenantScoped(ctx.tenantId), ctx };
}
