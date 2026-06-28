import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ThemeScope from '@/components/layout/ThemeScope';
import { Toaster } from 'sonner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { generateAccentCSS, sanitizeBrand, DEFAULT_BRAND } from '@/lib/theme/accent';
import SessionProvider from '@/components/SessionProvider';
import AppShell from '@/components/layout/AppShell';
import HeartbeatProvider from '@/components/layout/HeartbeatProvider';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import { getMenuForUser } from '@/lib/menus/getMenuForUser';
import { getImpersonation } from '@/lib/auth/getImpersonation';
import { cn } from "@/lib/utils";
import { cookies } from 'next/headers';

const geist = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title:       'HalePulse',
  description: 'Multi-tenant pharmacy management system',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error('NextAuth session decryption failed. This usually happens after a secret change. Clearing session.');
  }

  // Resolve impersonation context (super admin previewing a tenant role)
  const impersonation = await getImpersonation();

  // Effective identity for menu + branding — impersonation overrides session
  const effectiveTenantId = impersonation?.tenantId ?? session?.user?.tenantId ?? null;
  const effectiveRole     = impersonation?.role     ?? session?.user?.role     ?? '';

  // The Super Admin console must ALWAYS use the default HalePulse palette —
  // tenant branding must never leak into it. Branding only applies when the
  // user is acting within a tenant (a tenant user, or an admin impersonating one).
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN' && !impersonation;

  // Read brand color from cookie written by the branding API when admin saves.
  // No DB query — zero latency, no Prisma errors on cold starts.
  // Super admins (not impersonating) always get the default HalePulse brand.
  let brandColor = DEFAULT_BRAND;
  if (effectiveTenantId && !isSuperAdmin) {
    const cookieStore = await cookies();
    const brandCookie = cookieStore.get(`hp_brand_${effectiveTenantId}`);
    brandColor = sanitizeBrand(brandCookie?.value);
  }

  // Fetch sidebar menu items server-side so the sidebar always reflects the full MASTER_MENU
  const menuItems = await getMenuForUser(effectiveRole, effectiveTenantId);

  // Override only the accent tokens for both modes — injected server-side so
  // there is no flash and no client recompute. Neutrals are static in globals.css
  // and dark mode is just the `.dark` class toggled by next-themes.
  const brandingCSS = generateAccentCSS(brandColor);

  // Per-tenant/admin dark-light key (ThemeScope refines this on the client for
  // logged-out and super-admin surfaces). Isolated so:
  //   1. Super-admins don't share dark/light with tenant users
  //   2. Different tenants on the same browser don't share dark/light
  //   3. Impersonation uses the impersonated tenant's preference
  const themeStorageKey = isSuperAdmin
    ? 'theme_admin'
    : `theme_${effectiveTenantId ?? 'default'}`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(geistMono.variable, "font-sans", geist.variable)}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandingCSS }} />
      </head>
      <body className="antialiased">
        <ReactQueryProvider>
          <SessionProvider session={session}>
            <ThemeScope serverKey={themeStorageKey}>
              <Toaster position="top-right" richColors />
              <HeartbeatProvider>
                <AppShell session={session} menuItems={menuItems}>
                  {children}
                </AppShell>
              </HeartbeatProvider>
            </ThemeScope>
          </SessionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
