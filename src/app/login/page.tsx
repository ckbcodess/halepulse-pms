'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

function GoogleIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LoginContent() {
  const [businessId, setBusinessId] = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlError = searchParams.get('error');
  const urlErrorMessage = urlError === 'NotProvisioned'
    ? 'Your Google account is not linked to any provisioned account. Contact your system administrator.'
    : urlError === 'OAuthAccountNotLinked'
    ? 'This email is already registered with a different sign-in method.'
    : urlError
    ? 'Sign-in failed. Please try again or use your Business ID and password.'
    : null;

  const displayError = error || urlErrorMessage;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const result = await signIn('client-credentials', {
        businessId,
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes('Account locked') || result.error.includes('Too many failed')) {
          setError(result.error);
        } else {
          setError('Invalid Business ID, username, or password.');
        }
        setIsSubmitting(false);
        return;
      }

      if (result?.ok) {
        const session = await getSession();
        if (session?.user?.mustChangePassword) {
          router.push('/change-password');
        } else {
          const role = session?.user?.role;
          if (role === 'SUPER_ADMIN') router.push('/super-admin');
          else if (role === 'MANAGER') router.push('/dashboard/manager');
          else if (role === 'PHARMACIST') router.push('/dashboard/pharmacist');
          else if (role === 'MCA') router.push('/dashboard/mca');
          else if (role === 'AUDIT' || role === 'NES') router.push('/dashboard/audit');
          else router.push('/');
        }
        router.refresh();
      } else {
        setError('Invalid Business ID, username, or password.');
        setIsSubmitting(false);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError('');
    await signIn('google', { callbackUrl: '/dashboard' });
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-[#0a0a0a]">

      {/* Brand side — dark, minimal */}
      <div className="hidden md:flex flex-col flex-1 bg-[#0c0c0c] p-10 lg:p-16 xl:p-20 relative overflow-hidden justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(99,102,241,0.06),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(16,185,129,0.04),transparent_70%)]" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'var(--primary)' }}
          >
            <span className="text-primary-foreground text-xs font-medium leading-none">H</span>
          </div>
          <span className="text-[15px] font-medium text-white/90 tracking-tight">HalePulse</span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="text-3xl lg:text-[2.5rem] font-medium text-white/95 leading-[1.15] tracking-tight mb-5">
            Intelligent retail operations for the modern pharmacy.
          </p>
          <p className="text-[13px] text-white/40 font-medium tracking-wide font-mono">
            v3.0 — Multi-tenant
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-16 xl:p-20 bg-[var(--surface)] dark:bg-[#0a0a0a]">
        <div className="w-full max-w-[340px] animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2.5 mb-10">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'var(--primary)' }}
            >
              <span className="text-primary-foreground text-xs font-medium leading-none">H</span>
            </div>
            <span className="text-[15px] font-medium text-foreground tracking-tight">HalePulse</span>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-medium text-foreground tracking-tight mb-1">Sign in</h2>
            <p className="text-[13px] text-muted-foreground">Enter your business credentials to continue.</p>
          </div>

          {displayError && (
            <Alert variant="destructive" className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertDescription className="text-[13px]">{displayError}</AlertDescription>
            </Alert>
          )}

          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full h-10 gap-2.5 font-medium mb-5 text-[13px]"
          >
            {isGoogleLoading ? (
              <span>Redirecting<span className="animate-pulse">...</span></span>
            ) : (
              <>
                <GoogleIcon />
                <span>Sign in with Google</span>
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-[var(--surface)] dark:bg-[#0a0a0a] px-3 text-muted-foreground font-medium tracking-wider">
                or
              </span>
            </div>
          </div>

          {/* Credentials form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="businessId" className="text-[12px] font-medium text-muted-foreground">
                Business ID
              </Label>
              <Input
                id="businessId"
                type="text"
                required
                placeholder="HAL000"
                maxLength={6}
                autoComplete="organization"
                className="h-10 font-mono font-medium tracking-wider text-[13px] uppercase"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase())}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username" className="text-[12px] font-medium text-muted-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                required
                autoComplete="username"
                className="h-10 font-medium text-[13px]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loginPassword" className="text-[12px] font-medium text-muted-foreground">
                Password
              </Label>
              <Input
                id="loginPassword"
                type="password"
                required
                autoComplete="current-password"
                className="h-10 font-medium text-[13px]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full h-10 bg-foreground hover:bg-foreground/90 text-background font-medium mt-1 text-[13px]"
            >
              {isSubmitting ? (
                <>Authenticating<span className="animate-pulse">...</span></>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/sp-login"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              System Administrator? Sign in here
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 flex flex-col gap-1 text-[12px] text-muted-foreground font-medium border-t border-border pt-5">
              <p className="font-medium text-foreground/70 mb-1.5">Dev accounts:</p>
              <p className="font-medium text-[var(--active-border)] mb-1">Business ID: <code className="bg-[var(--active-bg)] px-1.5 py-0.5 rounded text-[11px]">DEM000</code></p>
              <p><code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">manager</code> / <code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">Manager@1234</code></p>
              <p><code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">pharmacist</code> / <code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">Mca@1234</code></p>
              <p><code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">viewer</code> / <code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">Nes@1234</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
