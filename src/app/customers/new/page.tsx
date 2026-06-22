'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Check } from 'lucide-react';
import { createCustomer } from '@/app/actions';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

export default function NewCustomerPage() {
  const router = useRouter();
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [knownAllergies, setKnownAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCustomer(name, phone, { dateOfBirth, gender, address, knownAllergies, chronicConditions });
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
          <Check className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-lg font-semibold text-card-foreground">Customer Added!</p>
        <p className="text-sm text-muted-foreground">Redirecting to customers list...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/customers" className={buttonVariants({ variant: 'outline', size: 'icon' })}>
          <ArrowLeft className="size-4 text-muted-foreground" />
        </Link>
        <p className="text-sm text-muted-foreground">Register a new customer for loyalty tracking.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerName" className="text-xs font-semibold text-muted-foreground">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customerName"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer full name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 XX XXX XXXX"
            />
          </div>

          {/* Patient details (optional) */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3">Patient details (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dob" className="text-xs font-semibold text-muted-foreground">Date of Birth</Label>
                <DatePicker id="dob" value={dateOfBirth} onChange={setDateOfBirth} placeholder="Select date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gender" className="text-xs font-semibold text-muted-foreground">Gender</Label>
                <Select value={gender} onValueChange={(v) => v && setGender(v)}>
                  <SelectTrigger id="gender" className="w-full h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Home address" />
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              <Label htmlFor="allergies" className="text-xs font-semibold text-muted-foreground">Known Allergies</Label>
              <Input id="allergies" value={knownAllergies} onChange={(e) => setKnownAllergies(e.target.value)} placeholder="e.g. Penicillin" />
            </div>
            <div className="flex flex-col gap-1.5 mt-4">
              <Label htmlFor="conditions" className="text-xs font-semibold text-muted-foreground">Chronic Conditions</Label>
              <Input id="conditions" value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} placeholder="e.g. Hypertension, Diabetes" />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
          >
            <UserPlus />
            {submitting ? 'Adding...' : 'Add Customer'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
