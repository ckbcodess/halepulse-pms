'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getCustomerById, updateCustomer } from '@/app/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = parseInt(id, 10);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', dateOfBirth: '', gender: '',
    address: '', knownAllergies: '', chronicConditions: '',
  });

  useEffect(() => {
    getCustomerById(customerId)
      .then((c) => {
        setForm({
          name: c.name, phone: c.phone ?? '', dateOfBirth: c.dateOfBirth,
          gender: c.gender, address: c.address,
          knownAllergies: c.knownAllergies, chronicConditions: c.chronicConditions,
        });
        setLoading(false);
      })
      .catch((err) => {
        toast.error(err?.message || 'Failed to load customer');
        router.push('/customers');
      });
  }, [customerId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateCustomer(customerId, form);
      toast.success('Customer updated');
      router.push(`/customers/${customerId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update customer');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/customers/${customerId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Back to customer
      </Link>

      <Card className="p-6">
        <h1 className="text-lg font-bold text-foreground mb-1">Edit Customer</h1>
        <p className="text-sm text-muted-foreground mb-6">Update contact and clinical details.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input required value={form.name} onChange={set('name')} placeholder="Customer name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="+233 XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Input value={form.gender} onChange={set('gender')} placeholder="male / female / other" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={set('address')} placeholder="Residential address" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Known Allergies</Label>
              <Input value={form.knownAllergies} onChange={set('knownAllergies')} placeholder="e.g. Penicillin" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Chronic Conditions</Label>
              <Input value={form.chronicConditions} onChange={set('chronicConditions')} placeholder="e.g. Hypertension, Diabetes" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {submitting ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(`/customers/${customerId}`)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
