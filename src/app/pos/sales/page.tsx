'use client';

import { useEffect, useState, useCallback } from 'react';
import { Ban, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

interface Sale {
  id: number;
  createdAt: string;
  customerName: string | null;
  itemCount: number;
  totalAmount: number;
  status: string;
  voidReason: string | null;
  payments: { paymentMethod: string; amount: number }[];
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', mobile_money: 'MoMo', card: 'Card', credit: 'Credit',
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [canVoid, setCanVoid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/sales');
      if (res.ok) {
        const d = await res.json();
        setSales(d.sales);
        setCanVoid(d.canVoid);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const voidSale = async (id: number) => {
    const reason = window.prompt('Reason for voiding this sale? (required)')?.trim();
    if (!reason) { if (reason !== undefined) toast.error('A reason is required'); return; }
    setVoiding(id);
    try {
      const res = await fetch(`/api/pos/sales/${id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success(`Sale #${id} voided — stock restored`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVoiding(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" description="Recent transactions for this branch." />

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Receipt size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No sales yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                {canVoid && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} className={s.status === 'voided' ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">#{s.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()} · {s.itemCount} items
                  </TableCell>
                  <TableCell className="text-xs">{s.customerName ?? 'Walk-in'}</TableCell>
                  <TableCell className="text-xs">
                    {s.payments.map((p, i) => (
                      <span key={i} className="mr-2">
                        {METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod} ₵{p.amount.toFixed(2)}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">₵{s.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    {s.status === 'voided' ? (
                      <Badge variant="destructive" title={s.voidReason ?? undefined}>Voided</Badge>
                    ) : (
                      <Badge variant="default">Completed</Badge>
                    )}
                  </TableCell>
                  {canVoid && (
                    <TableCell className="text-right">
                      {s.status !== 'voided' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={voiding === s.id}
                          onClick={() => voidSale(s.id)}
                        >
                          {voiding === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                          Void
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
