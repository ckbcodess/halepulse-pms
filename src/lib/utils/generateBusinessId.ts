/**
 * Generates a unique HQ Business ID for a new tenant.
 * Format: <3-letter prefix>000 (e.g. HAL000, MED000)
 * The prefix must be exactly 3 uppercase alpha characters.
 * Throws if the prefix is already taken.
 */
import prisma from '@/lib/prisma';

export async function generateBusinessId(prefix: string): Promise<string> {
  if (!/^[A-Za-z]{3}$/.test(prefix)) {
    throw new Error('Prefix must be exactly 3 alphabetic characters (e.g. HAL, MED).');
  }

  const upper = prefix.toUpperCase();
  const hqId = `${upper}000`;

  const existing = await prisma.tenant.findUnique({ where: { businessId: hqId } });
  if (existing) {
    throw new Error(`Prefix ${upper} is already taken. Choose a different 3-letter prefix.`);
  }

  return hqId;
}
