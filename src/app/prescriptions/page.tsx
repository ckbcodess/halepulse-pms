'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Plus, Trash2, Loader2, Check, ShieldAlert, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

interface RxItem { id: number; drugName: string; dosage: string | null; quantity: number; instructions: string | null; product: { name: string; isControlled: boolean } | null }
interface Rx {
  id: number; status: string; prescriberName: string | null; notes: string | null; createdAt: string;
  patient: { id: number; name: string; knownAllergies: string | null };
  items: RxItem[];
}
interface Customer { id: number; name: string; phone: string | null; knownAllergies?: string | null }

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'warning'> = {
  issued: 'warning', verified: 'secondary', dispensed: 'default', voided: 'destructive',
};

type DraftItem = { drugName: string; dosage: string; quantity: string; instructions: string };
const emptyItem = (): DraftItem => ({ drugName: '', dosage: '', quantity: '1', instructions: '' });

export default function PrescriptionsPage() {
  const [list, setList] = useState<Rx[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<{ id: number; text: string } | null>(null);

  // create form
  const [patientId, setPatientId] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/prescriptions');
    if (res.ok) setList((await res.json()).prescriptions);
  }, []);

  useEffect(() => {
    load();
    fetch('/api/customers').then((r) => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
  }, [load]);

  const selectedPatient = customers.find((c) => String(c.id) === patientId);

  const submit = async () => {
    if (!patientId) { toast.error('Select a patient'); return; }
    const cleanItems = items.filter((i) => i.drugName.trim());
    if (cleanItems.length === 0) { toast.error('Add at least one drug'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: parseInt(patientId, 10),
          prescriberName: prescriber,
          notes,
          items: cleanItems.map((i) => ({ drugName: i.drugName, dosage: i.dosage, quantity: parseInt(i.quantity, 10) || 1, instructions: i.instructions })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      toast.success('Prescription issued');
      setCreating(false); setPatientId(''); setPrescriber(''); setNotes(''); setItems([emptyItem()]);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const act = async (id: number, action: 'verify' | 'dispense' | 'void') => {
    let reason: string | undefined;
    if (action === 'void') {
      reason = window.prompt('Reason for voiding?')?.trim();
      if (!reason) return;
    }
    setBusy(id);
    try {
      const res = await fetch(`/api/prescriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      toast.success(`Prescription ${action === 'void' ? 'voided' : action + 'd'}`);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const checkRx = async (id: number) => {
    setAiBusy(id);
    try {
      const res = await fetch(`/api/prescriptions/${id}/check`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed');
      setAiResult({ id, text: d.analysis });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI interaction-check result modal */}
      {aiResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setAiResult(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
              <h3 className="text-base font-semibold flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Interaction Check — Rx #{aiResult.id}</h3>
              <button onClick={() => setAiResult(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiResult.text}</div>
          </div>
        </div>
      )}

      <PageHeader title="Prescriptions" description="Issue, verify and dispense prescriptions.">
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4" /> {creating ? 'Close' : 'New Prescription'}
        </Button>
      </PageHeader>

      {/* Create form */}
      {creating && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
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
              <Label htmlFor="prescriber">Prescriber</Label>
              <Input id="prescriber" value={prescriber} onChange={(e) => setPrescriber(e.target.value)} placeholder="Dr. …" />
            </div>
          </div>

          {selectedPatient?.knownAllergies && (
            <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-3 py-2">
              <ShieldAlert size={15} /> Allergies: {selectedPatient.knownAllergies}
            </div>
          )}

          <div className="space-y-2">
            <Label>Drugs</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" placeholder="Drug name *" value={it.drugName} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, drugName: e.target.value } : x))} />
                <Input className="col-span-3" placeholder="Dosage" value={it.dosage} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x))} />
                <Input className="col-span-2" type="number" min={1} placeholder="Qty" value={it.quantity} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                <Input className="col-span-2" placeholder="Instructions" value={it.instructions} onChange={(e) => setItems((s) => s.map((x, i) => i === idx ? { ...x, instructions: e.target.value } : x))} />
                <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => setItems((s) => s.length > 1 ? s.filter((_, i) => i !== idx) : s)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems((s) => [...s, emptyItem()])}>
              <Plus className="h-3.5 w-3.5" /> Add drug
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Issue Prescription
          </Button>
        </div>
      )}

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No prescriptions yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {list.map((rx) => (
              <div key={rx.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">Rx #{rx.id} · {rx.patient.name}</p>
                      <Badge variant={STATUS_VARIANT[rx.status] ?? 'secondary'} className="capitalize">{rx.status}</Badge>
                      {rx.items.some((i) => i.product?.isControlled) && (
                        <Badge variant="destructive"><ShieldAlert className="h-3 w-3 mr-1" />Controlled</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(rx.createdAt).toLocaleString()}{rx.prescriberName ? ` · ${rx.prescriberName}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rx.items.map((it) => (
                        <span key={it.id} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                          {it.drugName}{it.dosage ? ` ${it.dosage}` : ''} ×{it.quantity}
                        </span>
                      ))}
                    </div>
                    {rx.patient.knownAllergies && (
                      <p className="text-[11px] text-rose-600 mt-1.5">⚠ Allergies: {rx.patient.knownAllergies}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="text-primary" disabled={aiBusy === rx.id} onClick={() => checkRx(rx.id)} title="AI drug interaction check">
                      {aiBusy === rx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                    {rx.status === 'issued' && (
                      <Button size="sm" variant="outline" disabled={busy === rx.id} onClick={() => act(rx.id, 'verify')}>Verify</Button>
                    )}
                    {rx.status === 'verified' && (
                      <Button size="sm" disabled={busy === rx.id} onClick={() => act(rx.id, 'dispense')}>Dispense</Button>
                    )}
                    {rx.status !== 'dispensed' && rx.status !== 'voided' && (
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === rx.id} onClick={() => act(rx.id, 'void')}>Void</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
