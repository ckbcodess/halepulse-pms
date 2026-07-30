'use client';
import { useState, useEffect, useRef } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function SPLoginPage() {
  const { status } = useSession();
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoggingInRef = useRef(false);
  const initialCheckDoneRef = useRef(false);

  // Automatically sign out any pre-existing session on initial mount ONLY
  useEffect(() => {
    if (initialCheckDoneRef.current) return;
    if (status === 'authenticated' && !isLoggingInRef.current) {
      initialCheckDoneRef.current = true;
      signOut({ redirect: false });
    }
  }, [status]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    isLoggingInRef.current = true;
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
            System administration portal.
          </p>
          <p className="text-[13px] text-white/40 font-medium tracking-wide font-mono">
            Super Admin Access Only
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
            <div className="mb-2">
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-primary border-primary/20 bg-primary/5">
                Admin Portal
              </Badge>
            </div>
            <h2 className="text-xl font-medium text-foreground tracking-tight mb-1">SP Login</h2>
            <p className="text-[13px] text-muted-foreground">Authorized system administrators only.</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertDescription className="text-[13px]">{error}</AlertDescription>
            </Alert>
          )}

          {/* Credentials form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="h-10 font-medium text-[13px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spPassword" className="text-[12px] font-medium text-muted-foreground">
                Password
              </Label>
              <Input
                id="spPassword"
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
              disabled={isSubmitting}
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
              href="/login"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              ← Back to Client Portal
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 flex flex-col gap-1 text-[12px] text-muted-foreground font-medium border-t border-border pt-5">
              <p className="font-medium text-foreground/70 mb-1.5">Dev account:</p>
              <p><code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">superadmin@system.com</code> / <code className="bg-[var(--surface)] border border-border px-1 py-0.5 rounded text-[11px]">Admin@1234</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
