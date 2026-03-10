'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);
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

        <div className="bg-white rounded-lg shadow-sm border border-slate-200/60 p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-[10px] font-bold uppercase tracking-widest">
                Required
              </div>
            </div>
            <h2 className="text-2xl font-black text-slate-950 tracking-tight mb-2">Change Password</h2>
            <p className="text-slate-500 text-sm">
              You must change your password before continuing. Choose a strong password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200/50 text-rose-700 p-3 rounded-md mb-4 text-sm font-semibold">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200/50 text-emerald-700 p-4 rounded-md text-sm font-semibold">
              Password changed successfully! Redirecting to login...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 bg-white border border-slate-200/60 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm font-medium"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-white border border-slate-200/60 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm font-medium"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-white border border-slate-200/60 rounded-md focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm font-medium"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="text-xs text-slate-400 space-y-1 pt-1">
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-950 hover:bg-slate-900 disabled:bg-slate-800 text-white font-bold py-3.5 rounded-md transition-all mt-2"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
