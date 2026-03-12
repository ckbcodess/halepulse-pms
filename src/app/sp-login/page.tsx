'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function SPLoginPage() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const result = await signIn('sp-credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes('Account locked')) {
          setError(result.error);
        } else {
          setError('Invalid credentials or insufficient privileges.');
        }
        setIsSubmitting(false);
        return;
      }

      if (result?.ok) {
        router.push('/super-admin');
        router.refresh();
      } else {
        setError('Invalid credentials or insufficient privileges.');
        setIsSubmitting(false);
      }
    } catch {
      setError('An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 selection:bg-blue-200 selection:text-blue-900">

      {/* Brand Side */}
      <div className="hidden md:flex flex-col flex-1 p-12 lg:p-24 relative overflow-hidden justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.08),transparent_50%)]"></div>

        <div className="relative z-10 flex items-center gap-3 animate-in fade-in duration-1000">
          <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            HALE<span className="text-blue-500 font-light">PULSE</span>
          </h1>
        </div>

        <div className="relative z-10 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-300 fill-mode-both">
          <blockquote className="text-3xl lg:text-5xl font-light text-white leading-tight mb-6">
            System administration portal.
          </blockquote>
          <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Super Admin Access Only</p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 relative z-10 bg-slate-900">
        <div className="w-full max-w-sm animate-in slide-in-from-bottom-8 fade-in duration-700 delay-150 fill-mode-both">

          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              HALE<span className="text-blue-500 font-light">PULSE</span>
            </h1>
          </div>

          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                Admin Portal
              </div>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">SP Login</h2>
            <p className="text-slate-400 font-medium">Authorized system administrators only.</p>
          </div>

          {error && (
            <div className="bg-rose-900/30 border border-rose-500/30 text-rose-300 p-4 rounded-md mb-6 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-white font-medium placeholder-slate-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-white font-medium placeholder-slate-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3.5 rounded-md transition-all mt-4 flex justify-center items-center gap-2"
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
              href="/login"
              className="text-xs text-slate-500 hover:text-blue-400 transition-colors font-medium"
            >
              \u2190 Back to Client Portal
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 space-y-1 text-xs text-slate-500 font-medium border-t border-slate-800 pt-6">
              <p className="font-semibold text-slate-400 mb-2">Development:</p>
              <p><code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">superadmin@system.com</code> / <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">Admin@1234</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
