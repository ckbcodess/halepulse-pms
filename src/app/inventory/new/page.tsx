'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ArrowLeft, Save, Check } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const CATEGORIES = [
  'Analgesics', 'Antibiotics', 'Antihistamines', 'Antifungals', 'Antivirals',
  'Cardiovascular', 'Dermatology', 'Diabetes', 'Digestive', 'Eye & Ear',
  'Hormones', 'Multivitamins', 'Oral Health', 'Respiratory', 'Surgical',
  'Vaccines', 'Other',
];

export default function NewProductPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    category: '',
    price: '',
    costPrice: '',
    stockQty: '',
    expiryDate: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name.trim().toUpperCase(),
          category:    form.category,
          price:       parseFloat(form.price),
          costPrice:   form.costPrice ? parseFloat(form.costPrice) : null,
          stockQty:    parseInt(form.stockQty, 10),
          expiryDate:  form.expiryDate || null,
          description: form.description.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create product');
      }

      setSuccess(true);
      toast.success('Product created successfully');
      setTimeout(() => router.push('/inventory'), 1500);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/15 rounded-full flex items-center justify-center">
          <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Product Added!</h3>
        <p className="text-sm text-slate-500">Redirecting to inventory…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/inventory" className="p-2 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
          <ArrowLeft size={16} className="text-slate-500" />
        </Link>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Add Product</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Add a new product to your inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl divide-y divide-slate-100 dark:divide-white/5">

        {/* Basic Info */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Package size={14} /> Basic Information
          </h3>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. PARACETAMOL 500MG"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
            <p className="text-[11px] text-slate-400">Will be saved in uppercase</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional notes about this product…"
              rows={2}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pricing & Stock</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Selling Price (₵) <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Cost Price (₵)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={e => set('costPrice', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Opening Stock <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="number"
                min="0"
                value={form.stockQty}
                onChange={e => set('stockQty', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Expiry Date</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => set('expiryDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 flex items-center justify-between gap-3">
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {!error && <span />}
          <div className="flex gap-3">
            <Link href="/inventory" className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {isSubmitting ? 'Saving…' : 'Add Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
