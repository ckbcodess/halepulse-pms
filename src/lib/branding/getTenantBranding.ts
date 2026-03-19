import prisma from '@/lib/prisma';

export interface TenantBranding {
  primaryColor:   string;
  secondaryColor: string;
  baseColor:      string | null;
  logoUrl:        string | null;
  name:           string;
}

/**
 * Fetches branding config for a given tenantId.
 * Returns null if tenant not found.
 * Always filters by tenantId — no cross-tenant data leakage.
 */
export async function getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { primaryColor: true, secondaryColor: true, baseColor: true, logoUrl: true, name: true },
    });
    return tenant;
  } catch (error) {
    console.error('[getTenantBranding] DB unavailable, falling back to defaults:', error);
    return null;
  }
}
