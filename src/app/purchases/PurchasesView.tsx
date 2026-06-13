'use client';

import { useEffect, useState, useCallback } from 'react';

const CATEGORIES = ['Rent', 'Fuel', 'Internet', 'Electricity', 'Repairs', 'Transport', 'Miscellaneous', 'Other'];

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string | null;
  roleAccount: string | null;
  assignedPerson: string | null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PurchasesView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', category: 'all', search: '' });
  const [form, setForm] = useState({ date: todayStr(), category: 'Rent', amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    if (filters.category !== 'all') qs.set('category', filters.category);
    if (filters.search) qs.set('search', filters.search);
    const res = await fetch(`/api/purchases?${qs}`);
    const data = await res.json();
    setExpenses(res.ok ? data.expenses : []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setShowForm(false);
      setForm({ date: todayStr(), category: 'Rent', amount: '', description: '' });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else alert('Failed to delete');
  }

  const now = new Date();
  const monthTotal = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((a, e) => a + e.amount, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white">
          {showForm ? 'Close' : 'Add Expense'}
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <span className="text-gray-500">Total expenses this month: </span>
        <span className="font-semibold">{monthTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Date
            <input type="date" className="mt-1 w-full rounded border px-2 py-1" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="text-sm">Category
            <select className="mt-1 w-full rounded border px-2 py-1" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-sm">Amount
            <input type="number" min="0" step="0.01" className="mt-1 w-full rounded border px-2 py-1" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label className="text-sm">Description
            <input className="mt-1 w-full rounded border px-2 py-1" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <button disabled={saving} onClick={submit} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
              Save Expense
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <input type="date" className="rounded border px-2 py-1" value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <input type="date" className="rounded border px-2 py-1" value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <select className="rounded border px-2 py-1" value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Search description" className="rounded border px-2 py-1" value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Added By</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No expenses</td></tr>
            ) : expenses.map((e) => (
              <tr key={e.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-3 py-2">{e.category}</td>
                <td className="px-3 py-2 text-right">{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-gray-600">{e.description ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {e.roleAccount ?? '—'}{e.assignedPerson ? ` · ${e.assignedPerson}` : ''}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => del(e.id)} className="text-red-600 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
