import prisma from '@/lib/prisma';
import type { TenantContext } from './getTenantContext';

/**
 * Resolves the branch a write should be attributed to.
 *
 * - Operational users (branch_manager / pharmacist / cashier) have a home
 *   `branchId` → use it.
 * - Tenant-wide actors (tenant_admin) and super-admin impersonation have no
 *   branch → fall back to the tenant's HQ branch. (Once the branch switcher
 *   lands, an explicitly selected branch will take precedence over HQ.)
 *
 * Throws if the tenant has no branch at all — every tenant should have an HQ
 * after the Phase 1B backfill.
 */
export async function resolveBranchId(ctx: TenantContext): Promise<string> {
  if (ctx.branchId) return ctx.branchId;

  const hq = await prisma.branch.findFirst({
    where: { tenantId: ctx.tenantId, isActive: true },
    orderBy: { isHeadquarters: 'desc' }, // HQ first, then any active branch
    select: { id: true },
  });
  if (!hq) throw new Error('No branch configured for this tenant');
  return hq.id;
}
