'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Plus, Loader2, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

interface Reminder {
  id: number;
  patient: { id: number; name: string; phone: string | null };
  product: { id: number; name: string };
  nextRefillDate: string;
  refillIntervalDays: number;
  reminderDaysBefore: number;
  status: string;
  daysUntil: number;
}
interface Customer { id: number; name: string; phone: string | null }
interface Product { id: number; name: string }

export default function RefillsPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  // create form
  const [patientId, setPatientId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [interval, setInterval_] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/refills');
    if (res.ok) setReminders((await res.json()).reminders);
  }, []);

  useEffect(() => {
    load();
    fetch('/api/customers').then((r) => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
  }, [load]);

  useEffect(() => {
    const q = productSearch.trim();
    if (q.length < 2) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/inventory?search=${encodeURIComponent(q)}&limit=8`);
      if (r.ok) setProductResults((await r.json()).items ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  const submit = async () => {
    if (!patientId) { toast.error('Select a patient'); return; }
    if (!product) { toast.error('Select a product'); return; }
    const days = parseInt(interval, 10);
    if (!Number.isInteger(days) || days <= 0) { toast.error('Enter a valid interval'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/refills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: parseInt(patientId, 10), productId: product.id, refillIntervalDays: days }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      toast.success('Refill reminder created');
      setCreating(false); setPatientId(''); setProduct(null); setProductSearch(''); setInterval_('30');
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const act = async (id: number, action: 'dismiss' | 'fulfil' | 'snooze') => {
    setBusy(id);
    try {
      const res = await fetch(`/api/refills/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      toast.success(action === 'fulfil' ? 'Marked fulfilled — rescheduled' : action === 'snooze' ? 'Snoozed 3 days' : 'Dismissed');
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const dueBadge = (d: number) =>
    d <= 0 ? <Badge variant="destructive">Due now</Badge>
      : d <= 7 ? <Badge variant="warning">in {d}d</Badge>
        : <Badge variant="secondary">in {d}d</Badge>;

  return (
    <div className="space-y-6">
      <PageHeader title="Refill Reminders" description="Patients due for medication refills.">
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4" /> {creating ? 'Close' : 'New Reminder'}
        </Button>
      </PageHeader>

      {creating && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="patient">Patient *</Label>
              <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
                <SelectTrigger id="patient" className="w-full h-10"><SelectValue placeholder="Select patient…" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interval">Refill interval (days) *</Label>
              <Input id="interval" type="number" min={1} value={interval} onChange={(e) => setInterval_(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Medication *</Label>
            {product ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/40">
                <span className="text-sm font-medium">{product.name}</span>
                <Button variant="ghost" size="sm" onClick={() => { setProduct(null); setProductSearch(''); }}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search medication…" className="pl-9" />
                {productResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-56 overflow-auto">
                    {productResults.map((p) => (
                      <button key={p.id} onClick={() => { setProduct(p); setProductResults([]); }} className="w-full text-left px-3 py-2 hover:bg-muted text-sm">{p.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create Reminder
          </Button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarClock size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No active refill reminders.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reminders.map((r) => (
              <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{r.patient.name}</p>
                    {dueBadge(r.daysUntil)}
                    {r.status === 'snoozed' && <Badge variant="secondary">Snoozed</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.product.name} · every {r.refillIntervalDays}d · next {new Date(r.nextRefillDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.patient.phone ? ` · ${r.patient.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, 'fulfil')}>Fulfil</Button>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, 'snooze')}>Snooze</Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy === r.id} onClick={() => act(r.id, 'dismiss')}>Dismiss</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
