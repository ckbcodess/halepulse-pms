import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getTenantBranding } from '@/lib/branding/getTenantBranding';
import SessionProvider from '@/components/SessionProvider';
import AppShell from '@/components/layout/AppShell';
import HeartbeatProvider from '@/components/layout/HeartbeatProvider';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title:       'PharmNext',
  description: 'Multi-tenant pharmacy management system',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Load tenant branding for CSS variable injection
  let primaryColor   = '#6366f1';
  let secondaryColor = '#8b5cf6';

  if (session?.user?.tenantId) {
    const branding = await getTenantBranding(session.user.tenantId);
    if (branding) {
      primaryColor   = branding.primaryColor;
      secondaryColor = branding.secondaryColor;
    }
  }

  const brandingCSS = `
    :root {
      --primary-color: ${primaryColor};
      --secondary-color: ${secondaryColor};
    }
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandingCSS }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider session={session}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <HeartbeatProvider>
              <AppShell session={session}>
                {children}
              </AppShell>
            </HeartbeatProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
