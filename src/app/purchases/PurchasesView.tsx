'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

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
      <PageHeader title="Expenses" description="Track operating costs and other outgoings.">
        <Button variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : 'Add Expense'}
        </Button>
      </PageHeader>

      <div className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">
        <span className="text-muted-foreground">Total expenses this month: </span>
        <span className="font-semibold">{monthTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Date
            <DatePicker className="mt-1 w-full" value={form.date}
              onChange={(v) => setForm({ ...form, date: v })} placeholder="Select date" />
          </label>
          <label className="text-sm">Category
            <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Button disabled={saving} onClick={submit}>
              Save Expense
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <DatePicker className="h-8 w-auto" value={filters.from}
          onChange={(v) => setFilters({ ...filters, from: v })} placeholder="From" />
        <DatePicker className="h-8 w-auto" value={filters.to}
          onChange={(v) => setFilters({ ...filters, to: v })} placeholder="To" />
        <Select value={filters.category} onValueChange={(v) => v && setFilters({ ...filters, category: v })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <input placeholder="Search description" className="rounded border px-2 py-1" value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No expenses</TableCell></TableRow>
            ) : expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell className="text-right">{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-muted-foreground">{e.description ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {e.roleAccount ?? '—'}{e.assignedPerson ? ` · ${e.assignedPerson}` : ''}
                </TableCell>
                <TableCell className="text-right">
                  <button onClick={() => del(e.id)} className="text-destructive text-xs">Delete</button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
