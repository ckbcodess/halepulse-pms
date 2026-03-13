'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ArrowLeft, Save, Check } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
          <Check className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">Product Added!</h3>
        <p className="text-sm text-muted-foreground">Redirecting to inventory…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/inventory" className={buttonVariants({ variant: 'outline', size: 'icon' })}>
          <ArrowLeft className="size-4 text-muted-foreground" />
        </Link>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-card-foreground">Add Product</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Add a new product to your inventory</p>
        </div>
      </div>

      <Card className="py-0">
        <form onSubmit={handleSubmit}>

          {/* ── Basic Info ─────────────────────────────────────────────────── */}
          <div className="p-6 flex flex-col gap-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Package className="size-4" /> Basic Information
            </CardTitle>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productName" className="text-xs font-semibold text-muted-foreground">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="productName"
                required
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. PARACETAMOL 500MG"
              />
              <p className="text-[11px] text-muted-foreground">Will be saved in uppercase</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categorySelect" className="text-xs font-semibold text-muted-foreground">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={form.category} onValueChange={(v) => set('category', String(v))}>
                <SelectTrigger id="categorySelect" className="w-full h-9">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Optional notes about this product…"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          {/* ── Pricing & Stock ──────────────────────────────────────────────── */}
          <div className="p-6 flex flex-col gap-4 border-t border-border">
            <CardTitle className="text-sm font-semibold text-card-foreground">Pricing &amp; Stock</CardTitle>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price" className="text-xs font-semibold text-muted-foreground">
                  Selling Price (₵) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="costPrice" className="text-xs font-semibold text-muted-foreground">
                  Cost Price (₵)
                </Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.costPrice}
                  onChange={e => set('costPrice', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stockQty" className="text-xs font-semibold text-muted-foreground">
                  Opening Stock <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stockQty"
                  required
                  type="number"
                  min="0"
                  value={form.stockQty}
                  onChange={e => set('stockQty', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expiryDate" className="text-xs font-semibold text-muted-foreground">
                  Expiry Date
                </Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={e => set('expiryDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────────── */}
          <div className="p-6 flex items-center justify-between gap-3 border-t border-border bg-muted/50 rounded-b-xl">
            {error ? (
              <Alert variant="destructive" className="flex-1 py-2">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <span />
            )}
            <div className="flex gap-3 shrink-0">
              <Link href="/inventory" className={buttonVariants({ variant: 'outline' })}>
                Cancel
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                <Save />
                {isSubmitting ? 'Saving…' : 'Add Product'}
              </Button>
            </div>
          </div>

        </form>
      </Card>
    </div>
  );
}
