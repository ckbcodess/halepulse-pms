import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { DynamicThemeProvider } from '@/components/dynamic-theme-provider';
import { Toaster } from 'sonner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getTenantBranding } from '@/lib/branding/getTenantBranding';
import { generateThemeCSS } from '@/lib/theme/theme-utils';
import SessionProvider from '@/components/SessionProvider';
import AppShell from '@/components/layout/AppShell';
import HeartbeatProvider from '@/components/layout/HeartbeatProvider';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import { getMenuForUser } from '@/lib/menus/getMenuForUser';
import { getImpersonation } from '@/lib/auth/getImpersonation';

const instrumentSans = Instrument_Sans({ variable: '--font-sans', subsets: ['latin'] });
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

  // Load tenant branding for CSS variable injection
  let baseColor = '#6366f1';

  // Resolve impersonation context (super admin previewing a tenant role)
  const impersonation = await getImpersonation();

  // Effective identity for menu + branding — impersonation overrides session
  const effectiveTenantId = impersonation?.tenantId ?? session?.user?.tenantId ?? null;
  const effectiveRole     = impersonation?.role     ?? session?.user?.role     ?? '';

  if (effectiveTenantId) {
    const branding = await getTenantBranding(effectiveTenantId);
    if (branding) {
      // Prefer baseColor, fall back to primaryColor for backward compat
      baseColor = branding.baseColor ?? branding.primaryColor;
    }
  }

  // Fetch sidebar menu items server-side so the sidebar always reflects the full MASTER_MENU
  const menuItems = await getMenuForUser(effectiveRole, effectiveTenantId);

  // Generate full OKLCH palette from base color — injected server-side to prevent flash
  const brandingCSS = generateThemeCSS(baseColor);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${geistMono.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandingCSS }} />
        {/* figma capture — remove after capture */}
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
      </head>
      <body className="antialiased">
        <ReactQueryProvider>
          <SessionProvider session={session}>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              <DynamicThemeProvider initialBaseColor={baseColor}>
                <Toaster position="top-right" richColors />
                <HeartbeatProvider>
                  <AppShell session={session} menuItems={menuItems}>
                    {children}
                  </AppShell>
                </HeartbeatProvider>
              </DynamicThemeProvider>
            </ThemeProvider>
          </SessionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
