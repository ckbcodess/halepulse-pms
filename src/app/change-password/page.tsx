'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      // Sign out and redirect to login so they can log in with new password
      setTimeout(() => {
        signOut({ callbackUrl: '/login' });
      }, 2000);
    } catch {
      setError('An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafa] p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-4 h-4 bg-emerald-500 rounded-sm"></div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">
            PHARM <span className="text-emerald-500 font-light">NEXT</span>
          </h1>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                Required
              </Badge>
            </div>
            <h2 className="text-2xl font-black text-card-foreground tracking-tight mb-2">Change Password</h2>
            <p className="text-muted-foreground text-sm">
              You must change your password before continuing. Choose a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-700 font-semibold">
                Password changed successfully! Redirecting to login...
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currentPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="h-12"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="h-12"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="h-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="text-xs text-muted-foreground flex flex-col gap-1 pt-1">
                <p className={newPassword.length >= 8 ? 'text-emerald-600' : ''}>
                  {newPassword.length >= 8 ? '\u2713' : '\u2022'} At least 8 characters
                </p>
                <p className={/[A-Z]/.test(newPassword) ? 'text-emerald-600' : ''}>
                  {/[A-Z]/.test(newPassword) ? '\u2713' : '\u2022'} One uppercase letter
                </p>
                <p className={/[a-z]/.test(newPassword) ? 'text-emerald-600' : ''}>
                  {/[a-z]/.test(newPassword) ? '\u2713' : '\u2022'} One lowercase letter
                </p>
                <p className={/[0-9]/.test(newPassword) ? 'text-emerald-600' : ''}>
                  {/[0-9]/.test(newPassword) ? '\u2713' : '\u2022'} One number
                </p>
                <p className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-emerald-600' : ''}>
                  {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? '\u2713' : '\u2022'} One special character
                </p>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-slate-950 hover:bg-slate-900 text-white font-bold mt-2"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
