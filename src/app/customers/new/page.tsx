'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Check } from 'lucide-react';
import { createCustomer } from '@/app/actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NewCustomerPage() {
  const router = useRouter();
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCustomer(name, phone);
      setSuccess(true);
      toast.success('Customer added successfully');
      setTimeout(() => router.push('/customers'), 1200);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
          <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">Customer Added!</p>
        <p className="text-sm text-slate-500">Redirecting to customers list...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers" className="p-2 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={16} className="text-slate-500" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add Customer</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Register a new customer for loyalty tracking.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Full Name *</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer full name"
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium dark:text-slate-200 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Phone Number *</label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 XX XXX XXXX"
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium dark:text-slate-200 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          <UserPlus size={16} />
          {submitting ? 'Adding...' : 'Add Customer'}
        </button>
      </form>
    </div>
  );
}
