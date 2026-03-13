import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getTenantBranding } from '@/lib/branding/getTenantBranding';
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
  const session = await getServerSession(authOptions);

  // Load tenant branding for CSS variable injection
  let primaryColor   = '#6366f1';
  let secondaryColor = '#8b5cf6';

  // Resolve impersonation context (super admin previewing a tenant role)
  const impersonation = await getImpersonation();

  // Effective identity for menu + branding — impersonation overrides session
  const effectiveTenantId = impersonation?.tenantId ?? session?.user?.tenantId ?? null;
  const effectiveRole     = impersonation?.role     ?? session?.user?.role     ?? '';

  if (effectiveTenantId) {
    const branding = await getTenantBranding(effectiveTenantId);
    if (branding) {
      primaryColor   = branding.primaryColor;
      secondaryColor = branding.secondaryColor;
    }
  }

  // Fetch sidebar menu items server-side so the sidebar always reflects the full MASTER_MENU
  const menuItems = await getMenuForUser(effectiveRole, effectiveTenantId);

  const brandingCSS = `
    :root {
      --primary-color: ${primaryColor};
      --secondary-color: ${secondaryColor};
    }
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${geistMono.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandingCSS }} />
      </head>
      <body className="antialiased">
        <ReactQueryProvider>
          <SessionProvider session={session}>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              <Toaster position="top-right" richColors />
              <HeartbeatProvider>
                <AppShell session={session} menuItems={menuItems}>
                  {children}
                </AppShell>
              </HeartbeatProvider>
            </ThemeProvider>
          </SessionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
