'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SPLoginPage() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        // Full-page navigation so the theme provider mounts fresh as the admin
        // identity (avoids a client remount of next-themes).
        window.location.assign('/super-admin');
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
          <div className="w-4 h-4 bg-primary rounded-sm"></div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            HALE<span className="text-blue-500 font-light">PULSE</span>
          </h1>
        </div>

        <div className="relative z-10 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-300 fill-mode-both">
          <blockquote className="text-3xl lg:text-5xl font-light text-white leading-tight mb-6">
            System administration portal.
          </blockquote>
          <p className="text-muted-foreground font-mono text-sm tracking-widest uppercase">Super Admin Access Only</p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 relative z-10 bg-sidebar">
        <div className="w-full max-w-sm animate-in slide-in-from-bottom-8 fade-in duration-700 delay-150 fill-mode-both">

          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-4 h-4 bg-primary rounded-sm"></div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              HALE<span className="text-blue-500 font-light">PULSE</span>
            </h1>
          </div>

          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-0.5 bg-primary/10 border border-blue-500/20 rounded text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                Admin Portal
              </div>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">SP Login</h2>
            <p className="text-muted-foreground font-medium">Authorized system administrators only.</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6 bg-rose-900/30 border-rose-500/30 animate-in fade-in slide-in-from-top-2">
              <AlertDescription className="text-rose-300 font-semibold">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="h-12 bg-sidebar border-border text-white font-medium placeholder:text-muted-foreground"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="spPassword"
                type="password"
                required
                autoComplete="current-password"
                className="h-12 bg-sidebar border-border text-white font-medium placeholder:text-muted-foreground"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold mt-4"
            >
              {isSubmitting ? (
                <>Authenticating<span className="animate-pulse">...</span></>
              ) : (
                'Sign In \u2192'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-blue-400 transition-colors font-medium"
            >
              \u2190 Back to Client Portal
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 flex flex-col gap-1 text-xs text-muted-foreground font-medium border-t border-border pt-6">
              <p className="font-semibold text-muted-foreground mb-2">Development:</p>
              <p><code className="bg-sidebar px-1 py-0.5 rounded text-muted-foreground">superadmin@system.com</code> / <code className="bg-sidebar px-1 py-0.5 rounded text-muted-foreground">Admin@1234</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
