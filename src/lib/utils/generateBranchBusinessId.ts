/**
 * Generates a unique Branch Business ID.
 * Format: <3-letter prefix><3-digit suffix> e.g. HAL001, HAL002
 * HQ branch always has suffix 000 (same as tenant businessId).
 * Non-HQ branches get 001, 002, ... up to 999.
 *
 * @param hqBusinessId  The tenant's businessId (e.g. "HAL000")
 */
import prisma from '@/lib/prisma';

export async function generateBranchBusinessId(hqBusinessId: string): Promise<string> {
  const prefix = hqBusinessId.slice(0, 3).toUpperCase();

  // Find the highest existing branch businessId with this prefix (excluding HQ 000)
  const branches = await prisma.branch.findMany({
    where: {
      businessId: { startsWith: prefix },
      NOT: { businessId: hqBusinessId }, // exclude HQ itself
    },
    select: { businessId: true },
    orderBy: { businessId: 'desc' },
  });

  let nextNum = 1; // first non-HQ branch gets 001
  if (branches.length > 0 && branches[0].businessId) {
    const suffix = branches[0].businessId.slice(3); // last 3 chars
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  if (nextNum > 999) {
    throw new Error(`Branch ID space exhausted for prefix ${prefix} (max 999 branches).`);
  }

  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}
