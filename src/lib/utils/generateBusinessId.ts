/**
 * Generates a unique, human-readable Business ID for new tenants.
 * Format: PH-XXXXX (e.g., PH-00001, PH-00042)
 * Auto-increments based on the highest existing Business ID in the database.
 */
import prisma from '@/lib/prisma';

export async function generateBusinessId(): Promise<string> {
  const lastTenant = await prisma.tenant.findFirst({
    where: { businessId: { not: null } },
    orderBy: { businessId: 'desc' },
    select: { businessId: true },
  });

  let nextNum = 1;
  if (lastTenant?.businessId) {
    const match = lastTenant.businessId.match(/PH-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  return `PH-${String(nextNum).padStart(5, '0')}`;
}
