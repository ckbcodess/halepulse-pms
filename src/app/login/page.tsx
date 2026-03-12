'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import Link from 'next/link';

// ── Google "G" logo — matches Google brand guidelines ─────────────────────────
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ── Main login form — separated into its own component so useSearchParams
//    can be used inside a Suspense boundary (Next.js App Router requirement)
function LoginContent() {
  const [businessId, setBusinessId] = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Map NextAuth error codes (from ?error= URL param) to friendly messages
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
          router.push('/');
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
    // If signIn redirects back (e.g. error), reset loading state
    setIsGoogleLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white selection:bg-emerald-200 selection:text-emerald-900">

      {/* Brand Side */}
      <div className="hidden md:flex flex-col flex-1 bg-slate-950 p-12 lg:p-24 relative overflow-hidden justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.08),transparent_50%)]"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(to_bottom,transparent_0%,rgba(15,23,42,0.8)_100%)] z-0"></div>

        <div className="relative z-10 flex items-center gap-3 animate-in fade-in duration-1000">
          <div className="w-4 h-4 bg-emerald-500 rounded-sm"></div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            HALE<span className="text-emerald-500 font-light">PULSE</span>
          </h1>
        </div>

        <div className="relative z-10 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-300 fill-mode-both">
          <blockquote className="text-3xl lg:text-5xl font-light text-white leading-tight mb-6">
            Intelligent retail operations for the modern, fast-paced pharmacy.
          </blockquote>
          <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">System version 3.0 — Multi-tenant</p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 relative z-10 bg-[#f8fafa]">
        <div className="w-full max-w-sm animate-in slide-in-from-bottom-8 fade-in duration-700 delay-150 fill-mode-both">

          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-4 h-4 bg-emerald-500 rounded-sm"></div>
            <h1 className="text-2xl font-bold text-slate-950 tracking-tight">
              HALE<span className="text-emerald-500 font-light">PULSE</span>
            </h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-950 tracking-tight mb-2">Sign in</h2>
            <p className="text-slate-500 font-medium">Enter your business credentials to continue.</p>
          </div>

          {displayError && (
            <div className="bg-rose-50 border border-rose-200/50 text-rose-700 p-4 rounded-md mb-6 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
              {displayError}
            </div>
          )}

          {/* ── Google Sign-In ──────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200/60 text-slate-700 font-semibold py-3.5 rounded-md transition-all hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 shadow-sm mb-5"
          >
            {isGoogleLoading ? (
              <span className="text-sm">Redirecting<span className="animate-pulse">...</span></span>
            ) : (
              <>
                <GoogleIcon />
                <span className="text-sm">Sign in with Google</span>
              </>
            )}
          </button>

          {/* ── Divider ─────────────────────────────────────────────────────── */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#f8fafa] px-3 text-slate-400 font-semibold tracking-wider">
                or sign in with credentials
              </span>
            </div>
          </div>

          {/* ── Credentials Form ─────────────────────────────────────────────── */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Business ID
              </label>
              <input
                type="text"
                required
                placeholder="0000"
                maxLength={4}
                autoComplete="organization"
                className="w-full px-4 py-3 bg-white border border-slate-200/60 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm font-mono font-medium tracking-wider"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                className="w-full px-4 py-3 bg-white border border-slate-200/60 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm font-medium"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white border border-slate-200/60 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full bg-slate-950 hover:bg-slate-900 disabled:bg-slate-800 text-white font-bold py-3.5 rounded-md transition-all mt-2 flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <>Authenticating<span className="animate-pulse">...</span></>
              ) : (
                'Sign In \u2192'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/sp-login"
              className="text-xs text-slate-400 hover:text-emerald-600 transition-colors font-medium"
            >
              System Administrator? Sign in here
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 space-y-1 text-xs text-slate-400 font-medium border-t border-slate-200 pt-6">
              <p className="font-semibold text-slate-500 mb-2">Development accounts:</p>
              <p className="font-semibold text-emerald-600 mb-1">Business ID: <code className="bg-emerald-50 px-1.5 py-0.5 rounded">0721</code></p>
              <p><code className="bg-slate-100 px-1 py-0.5 rounded">manager</code> / <code className="bg-slate-100 px-1 py-0.5 rounded">Manager@1234</code></p>
              <p><code className="bg-slate-100 px-1 py-0.5 rounded">pharmacist</code> / <code className="bg-slate-100 px-1 py-0.5 rounded">Mca@1234</code></p>
              <p><code className="bg-slate-100 px-1 py-0.5 rounded">viewer</code> / <code className="bg-slate-100 px-1 py-0.5 rounded">Nes@1234</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page export wraps LoginContent in Suspense ────────────────────────────────
// Required by Next.js App Router when useSearchParams() is used in a
// client component — prevents the route from accidentally opting out of
// static rendering at the boundary level.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
