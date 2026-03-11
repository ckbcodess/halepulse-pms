'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import Link from 'next/link';

export default function LoginPage() {
  const [businessId, setBusinessId] = useState('');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

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
        // Check if it's a lockout error message
        if (result.error.includes('Account locked')) {
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white selection:bg-emerald-200 selection:text-emerald-900">

      {/* Brand Side */}
      <div className="hidden md:flex flex-col flex-1 bg-slate-950 p-12 lg:p-24 relative overflow-hidden justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.08),transparent_50%)]"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(to_bottom,transparent_0%,rgba(15,23,42,0.8)_100%)] z-0"></div>

        <div className="relative z-10 flex items-center gap-3 animate-in fade-in duration-1000">
          <div className="w-4 h-4 bg-emerald-500 rounded-sm"></div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            PHARM <span className="text-emerald-500 font-light">NEXT</span>
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
              PHARM <span className="text-emerald-500 font-light">NEXT</span>
            </h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-950 tracking-tight mb-2">Sign in</h2>
            <p className="text-slate-500 font-medium">Enter your business credentials to continue.</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200/50 text-rose-700 p-4 rounded-md mb-6 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

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
              disabled={isSubmitting}
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
