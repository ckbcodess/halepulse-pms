import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import type { TenantContext } from './getTenantContext';

/** Cookie holding the branch a tenant-wide actor has chosen to view. */
export const SELECTED_BRANCH_COOKIE = 'hp_branch';

/** A branchId that matches no row — used to fail closed. */
const NO_BRANCH = '__no_branch__';

/**
 * Resolves which branch a read should be scoped to (blueprint §4.4).
 *
 *   - Operational users (level >= 2: branch_manager / pharmacist / cashier) are
 *     locked to their own home branch. If somehow branch-less, they see nothing.
 *   - Tenant-wide actors (level <= 1: tenant_admin, impersonating super_admin)
 *     see all branches by default, or a single branch when one is selected via
 *     the branch switcher (validated against the tenant).
 *
 * Returns `null` when the read should span all branches.
 */
export async function getReadBranchId(ctx: TenantContext): Promise<string | null> {
  if (ctx.roleLevel >= 2) return ctx.branchId ?? NO_BRANCH;

  const selected = (await cookies()).get(SELECTED_BRANCH_COOKIE)?.value;
  if (!selected) return null; // all branches

  // Validate selection belongs to this tenant (cookie may be stale or tampered).
  const branch = await prisma.branch.findFirst({
    where: { id: selected, tenantId: ctx.tenantId },
    select: { id: true },
  });
  return branch?.id ?? null;
}

/**
 * Prisma where-fragment for branch scoping: `{}` (all branches) or `{ branchId }`.
 * Spread into an existing `where` alongside `tenantId`.
 */
export async function branchWhere(ctx: TenantContext): Promise<{ branchId?: string }> {
  const branchId = await getReadBranchId(ctx);
  return branchId ? { branchId } : {};
}

/** Whether the actor may switch branches (tenant-wide visibility). */
export function canSwitchBranch(ctx: TenantContext): boolean {
  return ctx.roleLevel <= 1;
}
