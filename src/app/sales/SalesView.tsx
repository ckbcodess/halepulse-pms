'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Printer, Loader2 } from 'lucide-react';
import { exportToCsv } from '@/lib/utils/exportCsv';

interface SaleRow {
  id: number;
  receiptNo: string | null;
  createdAt: string;
  customerName: string | null;
  paymentType: string;
  totalAmount: number;
  status: string;
  roleAccount: string | null;
  assignedPerson: string | null;
  itemCount: number;
  itemsSummary: string;
}

interface SaleDetail {
  id: number;
  receiptNo: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  branchName: string | null;
  paymentType: string;
  status: string;
  roleAccount: string | null;
  assignedPerson: string | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  items: { name: string; quantity: number; price: number; lineTotal: number }[];
  payments: { method: string; amount: number; reference: string | null }[];
}

const PAYMENT_TYPES = ['Cash', 'MoMo', 'Split'];
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SalesView() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '', paymentType: 'all', search: '' });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    if (filters.paymentType !== 'all') qs.set('paymentType', filters.paymentType);
    if (filters.search) qs.set('search', filters.search);
    const res = await fetch(`/api/sales?${qs}`);
    const data = await res.json();
    setSales(res.ok ? data.sales : []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const toggleRow = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/sales/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data);
      else toast.error(data.error || 'Failed to load transaction');
    } catch {
      toast.error('Failed to load transaction');
    } finally {
      setDetailLoading(false);
    }
  };

  const reprint = () => {
    if (!detail) return;
    const win = window.open('', '_blank', 'width=380,height=640');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups to print'); return; }
    const rows = detail.items.map(
      (it) => `<tr><td>${it.name}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">${money(it.price)}</td><td style="text-align:right">${money(it.lineTotal)}</td></tr>`
    ).join('');
    win.document.write(`
      <html><head><title>Receipt ${detail.receiptNo ?? detail.id}</title>
      <style>
        body{font-family:monospace;font-size:12px;padding:16px;color:#000}
        h2{text-align:center;margin:0 0 4px}
        .muted{color:#555;text-align:center;font-size:11px;margin:0}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        td,th{padding:2px 0}
        thead th{border-bottom:1px dashed #000;text-align:left}
        tfoot td{border-top:1px dashed #000;padding-top:4px}
        .right{text-align:right}
      </style></head><body>
        <h2>RECEIPT</h2>
        <p class="muted">${detail.branchName ?? ''}</p>
        <p class="muted">${new Date(detail.createdAt).toLocaleString()}</p>
        <p class="muted">Receipt: ${detail.receiptNo ?? detail.id}</p>
        ${detail.customerName ? `<p class="muted">Customer: ${detail.customerName}</p>` : ''}
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td colspan="3">Subtotal</td><td class="right">${money(detail.subtotal)}</td></tr>
            ${detail.discount ? `<tr><td colspan="3">Discount</td><td class="right">-${money(detail.discount)}</td></tr>` : ''}
            <tr><td colspan="3"><strong>TOTAL</strong></td><td class="right"><strong>${money(detail.totalAmount)}</strong></td></tr>
          </tfoot>
        </table>
        <p class="muted" style="margin-top:12px">Payment: ${detail.paymentType}</p>
        ${detail.assignedPerson ? `<p class="muted">Served by: ${detail.assignedPerson}</p>` : ''}
        <p class="muted" style="margin-top:12px">Thank you!</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  function exportCsv() {
    if (sales.length === 0) { toast.info('No sales to export'); return; }
    exportToCsv({
      filename: 'sales',
      headers: ['Receipt No', 'Date', 'Customer', 'Payment Method', 'Items', 'Amount', 'Role Account', 'Assigned Person', 'Status'],
      rows: sales.map((s) => [
        s.receiptNo ?? '', new Date(s.createdAt).toLocaleString(), s.customerName ?? '',
        s.paymentType, s.itemCount, s.totalAmount.toFixed(2), s.roleAccount ?? '', s.assignedPerson ?? '', s.status,
      ]),
    });
    toast.success(`Exported ${sales.length} sale(s) as CSV`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <button onClick={exportCsv} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">Export CSV</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <input type="date" className="rounded border px-2 py-1" value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <input type="date" className="rounded border px-2 py-1" value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <select className="rounded border px-2 py-1" value={filters.paymentType}
          onChange={(e) => setFilters({ ...filters, paymentType: e.target.value })}>
          <option value="all">All methods</option>
          {PAYMENT_TYPES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <input placeholder="Receipt no or customer" className="rounded border px-2 py-1" value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-muted text-left text-gray-600 dark:text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Receipt No</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Served By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">No sales</td></tr>
            ) : sales.map((s) => (
              <Fragment key={s.id}>
                <tr
                  className="border-t border-gray-100 dark:border-border hover:bg-muted/40 cursor-pointer"
                  onClick={() => toggleRow(s.id)}
                >
                  <td className="px-3 py-2 text-muted-foreground">
                    {expandedId === s.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.receiptNo ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={s.itemsSummary}>{s.itemsSummary}</td>
                  <td className="px-3 py-2">{s.customerName ?? '—'}</td>
                  <td className="px-3 py-2">{s.paymentType}</td>
                  <td className="px-3 py-2 text-center">{s.itemCount}</td>
                  <td className="px-3 py-2 text-right">{money(s.totalAmount)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s.assignedPerson ?? s.roleAccount ?? '—'}</td>
                </tr>
                {expandedId === s.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={9} className="px-6 py-4">
                      {detailLoading || !detail ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                          <Loader2 size={14} className="animate-spin" /> Loading transaction…
                        </div>
                      ) : (
                        <div className="max-w-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold">Transaction Details</p>
                              {detail.status === 'voided' && (
                                <span className="text-xs text-destructive font-bold">VOIDED</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); reprint(); }}
                              className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              <Printer size={13} /> Reprint Receipt
                            </button>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground border-b border-border">
                              <tr>
                                <th className="text-left py-1.5">Item</th>
                                <th className="text-center py-1.5">Qty</th>
                                <th className="text-right py-1.5">Price</th>
                                <th className="text-right py-1.5">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.items.map((it, i) => (
                                <tr key={i} className="border-b border-border/50">
                                  <td className="py-1.5">{it.name}</td>
                                  <td className="py-1.5 text-center">{it.quantity}</td>
                                  <td className="py-1.5 text-right">{money(it.price)}</td>
                                  <td className="py-1.5 text-right">{money(it.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Subtotal</td><td className="py-1 text-right">{money(detail.subtotal)}</td></tr>
                              {detail.discount > 0 && (
                                <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Discount</td><td className="py-1 text-right">-{money(detail.discount)}</td></tr>
                              )}
                              <tr><td colSpan={3} className="py-1 text-right font-bold">Total</td><td className="py-1 text-right font-bold">{money(detail.totalAmount)}</td></tr>
                            </tfoot>
                          </table>
                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            <span>Payment: <strong className="text-foreground">{detail.paymentType}</strong></span>
                            {detail.customerName && <span>Customer: <strong className="text-foreground">{detail.customerName}</strong></span>}
                            {detail.assignedPerson && <span>Served by: <strong className="text-foreground">{detail.assignedPerson}</strong></span>}
                            {detail.payments.map((p, i) => (
                              <span key={i}>{p.method}: <strong className="text-foreground">{money(p.amount)}</strong>{p.reference ? ` (${p.reference})` : ''}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
