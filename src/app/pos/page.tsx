'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getProducts, getCustomers, processSale, getTenantInfo, createCustomer,
} from '@/app/actions';
import { useCartStore } from '@/lib/store';
import type { CartItem } from '@/lib/store';
import {
  Search, X, Plus, Minus, Trash2, UserCheck,
  Printer, AlertTriangle, CheckCircle2, Check, Percent, Tag,
  PauseCircle, PlayCircle, CornerDownLeft, ChevronRight, ArrowRight,
  Wallet, CreditCard, Package, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetHeader } from '@/components/ui/sheet';

// ─── Types ────────────────────────────────────────────────────────────────────

type POSPhase = 'entry' | 'payment' | 'complete';
type PaymentMethod = 'Cash' | 'MoMo' | 'Split';

interface Product {
  id: number;
  name: string;
  price: number;
  stockQty: number;
  category: string;
  expiryDate: string | Date | null;
  brand: string | null;
  lowStockThreshold: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  loyaltyPoints: number;
  reminderNote?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MatchText({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-foreground font-bold">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

function getExpiry(date: string | Date | null): { status: 'ok' | 'soon' | 'expired'; days?: number } {
  if (!date) return { status: 'ok' };
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return { status: 'expired' };
  if (days <= 30) return { status: 'soon', days };
  return { status: 'ok' };
}

function stockBadge(p: Product) {
  if (p.stockQty <= 0) return { label: 'Out', cls: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' };
  if (p.stockQty < p.lowStockThreshold) return { label: `Low · ${p.stockQty}`, cls: 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' };
  return { label: String(p.stockQty), cls: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' };
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-[6.05px] py-[2.55px] rounded-[4px] text-[10px] font-mono font-medium bg-muted border border-border text-muted-foreground leading-[10px]">
      {children}
    </kbd>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function POSPage() {
  const {
    items, addItem, removeItem, updateQuantity, clearCart, total,
    discount, setDiscount, heldCarts, holdCart, resumeCart, deleteHeldCart,
    addMiscItem, resetCheckout,
  } = useCartStore();

  const [phase, setPhase] = useState<POSPhase>('entry');

  // Search row
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [hlIdx, setHlIdx] = useState(0);
  const [showDrop, setShowDrop] = useState(false);

  // Row sub-phase
  const [rowPhase, setRowPhase] = useState<'search' | 'qty'>('search');
  const [selProduct, setSelProduct] = useState<Product | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  // Misc mode
  const [miscMode, setMiscMode] = useState(false);
  const [miscName, setMiscName] = useState('');
  const [miscPrice, setMiscPrice] = useState('');

  // Customer
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [custDropOpen, setCustDropOpen] = useState(false);
  const [showNewCust, setShowNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Payment
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [momoAmount, setMomoAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  // Discount
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');

  // Held & receipt
  const [showHeld, setShowHeld] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    items: CartItem[]; total: number; customer: Customer | null;
    saleId: number; date: Date; discount: number; paymentMethod: string;
  } | null>(null);

  // Tenant
  const [tenant, setTenant] = useState({ name: 'Pharmacy', address: null as string | null, primaryPhone: null as string | null });

  // Inline qty edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');

  // Refs
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const miscNameRef = useRef<HTMLInputElement>(null);
  const miscPriceRef = useRef<HTMLInputElement>(null);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const discountAmt = !discount ? 0
    : discount.type === 'percent' ? Math.min(total, total * discount.value / 100)
    : Math.min(total, discount.value);
  const grandTotal = Math.max(0, total - discountAmt);
  const cashRcvd = parseFloat(cashTendered) || 0;
  const momoRcvd = parseFloat(momoAmount) || 0;
  const tendered = payMethod === 'Split' ? cashRcvd + momoRcvd
    : payMethod === 'MoMo' ? grandTotal : cashRcvd;
  const change = tendered - grandTotal;
  const canCharge = items.length > 0 && grandTotal > 0;
  const canComplete = canCharge && tendered >= grandTotal;
  const totalQty = items.reduce((a, i) => a + i.quantity, 0);

  const qtyPreview = selProduct ? (parseInt(qtyInput) || 1) * selProduct.price : 0;

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { getTenantInfo().then(setTenant).catch(() => {}); }, []);

  useEffect(() => {
    if (!query.trim() || miscMode) { setResults([]); setShowDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const data = await getProducts(query.trim());
        setResults(data);
        setHlIdx(0);
        setShowDrop(true);
      } catch { setResults([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [query, miscMode]);

  useEffect(() => {
    if (custQuery.length < 2) { setCustResults([]); setCustDropOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const data = await getCustomers(custQuery);
        setCustResults(data);
        setCustDropOpen(true);
      } catch { setCustResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [custQuery]);

  useEffect(() => {
    if (phase !== 'entry' || miscMode) return;
    if (rowPhase === 'qty') setTimeout(() => qtyRef.current?.focus(), 0);
    else setTimeout(() => searchRef.current?.focus(), 0);
  }, [phase, rowPhase, miscMode]);

  useEffect(() => {
    if (phase === 'payment') setTimeout(() => cashRef.current?.focus(), 80);
  }, [phase, payMethod]);

  useEffect(() => {
    if (miscMode) setTimeout(() => miscNameRef.current?.focus(), 50);
  }, [miscMode]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const selectProduct = (p: Product) => {
    if (getExpiry(p.expiryDate).status === 'expired') {
      toast.error(`${p.name} is expired — cannot sell`);
      return;
    }
    setSelProduct(p);
    setRowPhase('qty');
    setShowDrop(false);
    setQuery('');
  };

  const commitItem = useCallback(() => {
    if (!selProduct) return;
    const qty = Math.max(1, parseInt(qtyInput) || 1);
    const existing = items.find(i => i.id === selProduct.id);
    const already = existing?.quantity ?? 0;
    if (selProduct.stockQty > 0 && already + qty > selProduct.stockQty) {
      toast.error(`Only ${selProduct.stockQty} available (${already} in cart)`);
      return;
    }
    if (selProduct.stockQty <= 0) toast.warning(`${selProduct.name} — no stock recorded`);
    addItem({ id: selProduct.id, name: selProduct.name, price: selProduct.price, quantity: qty });
    setSelProduct(null);
    setQtyInput('');
    setRowPhase('search');
    setQuery('');
  }, [selProduct, qtyInput, items, addItem]);

  const commitMisc = () => {
    if (!miscName.trim()) { toast.error('Description required'); return; }
    const price = parseFloat(miscPrice);
    if (isNaN(price) || price <= 0) { toast.error('Enter a valid price'); return; }
    addMiscItem(miscName.trim(), price);
    toast.success(`${miscName.trim()} added`);
    setMiscMode(false);
    setMiscName('');
    setMiscPrice('');
  };

  const commitInlineEdit = (itemId: number) => {
    const qty = parseInt(editQty);
    if (!isNaN(qty) && qty > 0) {
      const item = items.find(i => i.id === itemId);
      if (item) updateQuantity(itemId, qty - item.quantity);
    } else if (editQty === '0' || editQty === '') {
      removeItem(itemId);
    }
    setEditingId(null);
    setEditQty('');
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (showDrop && results.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHlIdx(i => Math.min(i + 1, results.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHlIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); selectProduct(results[hlIdx] ?? results[0]); return; }
    }
    if (e.key === 'Escape') { setQuery(''); setShowDrop(false); }
  };

  const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === '/') { setMiscMode(true); return; }
    setQuery(v);
    if (!v.trim()) setShowDrop(false);
  };

  const onQtyKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitItem(); return; }
    if (e.key === 'Backspace' && !qtyInput) { e.preventDefault(); setRowPhase('search'); setSelProduct(null); return; }
    if (e.key === 'Escape') { setRowPhase('search'); setSelProduct(null); setQtyInput(''); }
  };

  const goToPayment = () => {
    if (!canCharge) return;
    setPhase('payment');
    setCashTendered('');
    setMomoAmount('');
  };

  const handleCompleteSale = async () => {
    if (!canComplete || processing) return;
    setProcessing(true);
    try {
      const regular = items.filter(i => !i.isMisc);
      const misc = items.filter(i => i.isMisc);
      const payments: { method: string; amount: number }[] = [];
      if (payMethod === 'Split') {
        const momoPart = Math.min(momoRcvd, grandTotal);
        const cashPart = Math.round((grandTotal - momoPart) * 100) / 100;
        if (momoPart > 0) payments.push({ method: 'mobile_money', amount: momoPart });
        if (cashPart > 0) payments.push({ method: 'cash', amount: cashPart });
      } else if (payMethod === 'MoMo') {
        payments.push({ method: 'mobile_money', amount: grandTotal });
      } else {
        payments.push({ method: 'cash', amount: grandTotal });
      }
      const sale = await processSale(
        regular.map(i => ({ id: i.id, quantity: i.quantity })),
        customer?.id, undefined, discountAmt, payMethod,
        misc.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
        payments,
      );
      setReceiptData({ items: [...items], total: grandTotal, customer, saleId: sale.id, date: new Date(), discount: discountAmt, paymentMethod: payMethod });
      clearCart(); resetCheckout();
      setCustomer(null); setCustQuery('');
      setDiscount(null);
      setCashTendered(''); setMomoAmount(''); setPayMethod('Cash');
      setPhase('complete');
      toast.success('Sale completed!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to process sale');
    } finally { setProcessing(false); }
  };

  const handleNewSale = () => {
    setPhase('entry'); setReceiptData(null);
    setRowPhase('search'); setQuery(''); setSelProduct(null); setQtyInput('');
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const applyDiscount = () => {
    const val = parseFloat(discountInput);
    if (isNaN(val) || val <= 0) { toast.error('Enter a valid discount'); return; }
    if (discountMode === 'percent') {
      if (val > 100) { toast.error('Cannot exceed 100%'); return; }
      setDiscount({ type: 'percent', value: val });
      toast.success(`${val}% discount applied`);
    } else {
      if (val > total) { toast.error('Discount exceeds subtotal'); return; }
      setDiscount({ type: 'fixed', value: val });
      toast.success(`₵${val.toFixed(2)} off applied`);
    }
    setDiscountInput(''); setShowDiscount(false);
  };

  const handleCreateCustomer = async () => {
    if (!newCustName.trim() || !newCustPhone.trim()) { toast.error('Name and phone required'); return; }
    try {
      const cust = await createCustomer(newCustName, newCustPhone);
      setCustomer(cust as Customer);
      setShowNewCust(false); setNewCustName(''); setNewCustPhone('');
      toast.success(`Customer "${cust.name}" added`);
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const handleResume = (id: string) => {
    if (items.length > 0) { toast.error('Clear current cart before resuming'); return; }
    const held = resumeCart(id);
    if (held) { setShowHeld(false); toast.success('Cart resumed'); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex gap-6 h-[calc(100dvh-155px)] overflow-hidden print:hidden">

        {/* ═══ LEFT — NEW SALE ════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl shadow-sm min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between px-[17.5px] border-b border-border h-[64px] shrink-0">
            <h2 className="text-[16px] font-medium leading-[30px] text-foreground">New Sale</h2>
            <div className="flex items-center gap-[5.25px]">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px] text-muted-foreground gap-1.5"
                disabled={items.length === 0}
                onClick={() => {
                  if (items.length === 0) return;
                  holdCart(customer?.name ?? null, customer?.id ?? null);
                  setCustomer(null); setCustQuery('');
                  toast.info('Cart held');
                }}
              >
                <PauseCircle size={14} /> Hold Order
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px] text-muted-foreground gap-1.5"
                onClick={() => setShowHeld(true)}
              >
                <PlayCircle size={14} /> View Held Orders
                {heldCarts.length > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] ml-0.5">{heldCarts.length}</Badge>
                )}
              </Button>
              <Button
                size="sm"
                className="h-7 text-[12px] gap-1.5 bg-[#ffecec] text-red-600 hover:bg-red-100 border-0 shadow-none"
                disabled={items.length === 0}
                onClick={() => {
                  clearCart(); resetCheckout(); setDiscount(null);
                  setSelProduct(null); setQtyInput(''); setRowPhase('search'); setQuery('');
                }}
              >
                <X size={14} /> Clear Order
              </Button>
            </div>
          </div>

          {/* ─── INPUT ZONE ─────────────────────────────────────────────────── */}
          <div className="shrink-0 px-4 pt-[24.8px] pb-6 border-b border-border/60">

            {miscMode ? (
              /* ── Misc mode ── */
              <div className="relative">
                {/* spacer keeps the input zone the same height as the search row → no layout shift */}
                <div aria-hidden className="h-[44px]" />

                {/* floating group over the input row */}
                <div className="absolute inset-x-0 -top-2 z-30 flex flex-col gap-2 origin-top animate-misc-flap">
                  {/* tinted flap: header + input bar only */}
                  <div
                    className="flex flex-col gap-2 rounded-xl border border-primary/20 p-2.5 shadow-lg"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--primary) 7%, var(--card))' }}
                  >
                  {/* Header strip */}
                  <div className="flex items-center gap-2 px-0.5">
                    <button
                      onClick={() => { setMiscMode(false); setMiscName(''); setMiscPrice(''); }}
                      className="text-primary hover:opacity-70 transition-opacity"
                      aria-label="Close misc item"
                    >
                      <X size={15} strokeWidth={2.25} />
                    </button>
                    <span className="text-[13px] font-semibold text-primary">Unlisted Item</span>
                  </div>

                  {/* Unified input bar */}
                  <div className="flex items-center gap-2 h-[44px] pl-3 pr-2 border border-border rounded-xl bg-background focus-within:border-primary transition-colors">
                    <Tag size={15} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
                    <input
                      ref={miscNameRef}
                      value={miscName}
                      onChange={e => setMiscName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && miscName.trim()) miscPriceRef.current?.focus();
                        if (e.key === 'Escape') { setMiscMode(false); setMiscName(''); setMiscPrice(''); }
                      }}
                      placeholder="Description (e.g. Shopping bag)"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] text-foreground placeholder:text-muted-foreground/60"
                    />
                    <div className="h-5 w-px bg-border shrink-0" />
                    <div className="relative w-[88px] shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px] pointer-events-none">₵</span>
                      <input
                        ref={miscPriceRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={miscPrice}
                        onChange={e => setMiscPrice(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitMisc(); if (e.key === 'Escape') { setMiscMode(false); setMiscName(''); setMiscPrice(''); } }}
                        placeholder="0.00"
                        className="w-full pl-[18px] pr-1 bg-transparent outline-none text-[13px] text-foreground tabular-nums placeholder:text-muted-foreground/60"
                      />
                    </div>
                    <button
                      onClick={commitMisc}
                      aria-label="Add misc item"
                      className="w-9 h-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <CornerDownLeft size={15} />
                    </button>
                  </div>
                  </div>

                  {/* Hints — outside the tinted surface */}
                  <div className="flex items-center gap-3 px-0.5">
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>↵</Kbd> next field / add
                    </span>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>Esc</Kbd> cancel
                    </span>
                  </div>
                </div>
              </div>
            ) : rowPhase === 'qty' ? (
              /* ── Qty phase ── */
              <div className="flex items-center gap-2 h-[44px] pl-3 pr-2 border border-primary rounded-xl bg-background ring-1 ring-primary/20 transition-all">
                <CheckCircle2 size={15} className="text-primary shrink-0" />
                <span className="flex-1 min-w-0 truncate text-[13.5px] font-medium text-foreground">{selProduct?.name}</span>
                <span className="text-[12px] text-muted-foreground shrink-0 tabular-nums">₵{selProduct?.price.toFixed(2)}</span>

                {/* Quantity stepper */}
                <div className="flex items-center gap-0.5 bg-muted rounded-lg border border-border p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQtyInput(String(Math.max(1, (parseInt(qtyInput) || 1) - 1)))}
                    aria-label="Decrease quantity"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  >
                    <Minus size={13} strokeWidth={2.5} />
                  </button>
                  <input
                    ref={qtyRef}
                    type="number"
                    min="1"
                    step="1"
                    value={qtyInput}
                    onChange={e => setQtyInput(e.target.value)}
                    onKeyDown={onQtyKey}
                    placeholder="1"
                    aria-label="Quantity"
                    className="w-9 text-center bg-transparent outline-none text-[14px] font-semibold text-foreground tabular-nums placeholder:text-muted-foreground/40 placeholder:font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQtyInput(String((parseInt(qtyInput) || 1) + 1))}
                    aria-label="Increase quantity"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                </div>

                {qtyPreview > 0 && (
                  <span className="text-[12px] font-semibold text-muted-foreground tabular-nums shrink-0">
                    = ₵{qtyPreview.toFixed(2)}
                  </span>
                )}
                <button
                  onClick={commitItem}
                  aria-label="Add item"
                  className="w-9 h-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <CornerDownLeft size={15} />
                </button>
                <button
                  onClick={() => { setRowPhase('search'); setSelProduct(null); setQtyInput(''); }}
                  aria-label="Change drug"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              /* ── Search phase ── */
              <div ref={dropRef} className="relative">
                <div className={cn(
                  'flex items-center gap-2 h-[44px] pl-3 pr-2 border rounded-xl bg-background transition-all',
                  showDrop && (results.length > 0 || query.trim())
                    ? 'border-foreground/30 ring-1 ring-foreground/15 rounded-b-none'
                    : 'border-border focus-within:border-foreground/30 focus-within:ring-1 focus-within:ring-foreground/15'
                )}>
                  <Search size={15} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={onQueryChange}
                    onKeyDown={onSearchKey}
                    onFocus={() => query.trim() && results.length && setShowDrop(true)}
                    placeholder="Search medication… (/ for misc)"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] text-foreground placeholder:text-muted-foreground/60"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {query && (
                    <button onClick={() => { setQuery(''); setShowDrop(false); }} className="text-muted-foreground hover:text-foreground shrink-0">
                      <X size={13} />
                    </button>
                  )}
                  <div className="h-5 w-px bg-border shrink-0" />
                  {/* Qty ghost — activates once a drug is selected */}
                  <div className="w-7 flex items-center justify-center shrink-0">
                    <span className="text-[13px] text-muted-foreground/30 select-none tabular-nums">1</span>
                  </div>
                  {/* Add — disabled until product selected */}
                  <button
                    disabled
                    aria-label="Add item"
                    className="w-9 h-9 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center cursor-not-allowed"
                  >
                    <CornerDownLeft size={15} />
                  </button>
                </div>

                {/* Dropdown */}
                {showDrop && results.length > 0 && (
                  <div className="absolute left-0 right-0 top-[44px] z-50 border border-border border-t-0 rounded-b-xl bg-background shadow-lg overflow-hidden">
                    {results.slice(0, 8).map((p, i) => {
                      const exp = getExpiry(p.expiryDate);
                      const stock = stockBadge(p);
                      const isExpired = exp.status === 'expired';
                      return (
                        <button
                          key={p.id}
                          onClick={() => selectProduct(p)}
                          disabled={isExpired}
                          className={cn(
                            'w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors border-b border-border/50 last:border-0',
                            i === hlIdx ? 'bg-muted' : 'hover:bg-muted/50',
                            isExpired && 'opacity-40 cursor-not-allowed'
                          )}
                        >
                          <div className={cn('w-0.5 h-5 rounded-full shrink-0', i === hlIdx ? 'bg-primary' : 'bg-transparent')} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-muted-foreground leading-tight truncate">
                              <MatchText text={p.name} query={query} />
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {p.category}{p.brand ? ` · ${p.brand}` : ''}
                            </p>
                          </div>
                          <span className="text-[13px] font-semibold text-foreground tabular-nums shrink-0">
                            ₵{p.price.toFixed(2)}
                          </span>
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0', stock.cls)}>
                            {stock.label}
                          </span>
                          {exp.status === 'soon' && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md shrink-0">
                              <Clock size={9} className="inline mr-0.5" />{exp.days}d
                            </span>
                          )}
                          {exp.status === 'expired' && (
                            <span className="text-[10px] font-semibold text-rose-600 shrink-0 flex items-center gap-0.5">
                              <AlertTriangle size={10} /> EXPIRED
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {results.length > 8 && (
                      <p className="px-4 py-2 text-[11px] text-muted-foreground text-center border-t border-border">
                        +{results.length - 8} more — refine your search
                      </p>
                    )}
                  </div>
                )}

                {/* No results */}
                {showDrop && query.trim() && results.length === 0 && (
                  <div className="absolute left-0 right-0 top-[44px] z-50 border border-border border-t-0 rounded-b-xl bg-background shadow-lg px-4 py-3 flex items-center gap-2">
                    <Search size={13} className="text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground">No results for &ldquo;{query}&rdquo; — </span>
                    <button
                      onClick={() => { setMiscMode(true); setMiscName(query); setQuery(''); setShowDrop(false); }}
                      className="text-[12px] text-primary font-medium hover:underline"
                    >
                      add as misc?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Keyboard hints */}
            {!miscMode && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {rowPhase === 'search' && (
                  <>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>↑ ↓</Kbd> Navigate
                    </span>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>↵</Kbd> Select
                    </span>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>/</Kbd> Misc item
                    </span>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>Esc</Kbd> Clear
                    </span>
                  </>
                )}
                {rowPhase === 'qty' && (
                  <>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>↵</Kbd> add (Default = 1)
                    </span>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>Backspace</Kbd> change drug
                    </span>
                    <span className="flex items-center gap-[3.5px] text-[10.5px] text-muted-foreground/50">
                      <Kbd>Esc</Kbd> cancel row
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ─── CART ITEMS (scrollable) ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6">
            {items.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 opacity-40">
                <Package size={32} className="text-muted-foreground mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-foreground">Start typing above</p>
                <p className="text-xs text-muted-foreground mt-1">Search for medications to add them</p>
              </div>
            )}

            {items.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-[10.5px] px-[11.3px] py-[9.55px] rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-all"
                  >
                    {/* Row index */}
                    <span className="text-[11px] font-mono text-muted-foreground/50 w-[14px] shrink-0 tabular-nums select-none">
                      {idx + 1}
                    </span>

                    {/* Name + unit price */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">₵{item.price.toFixed(2)} each</p>
                    </div>

                    {/* Qty stepper */}
                    {editingId === item.id ? (
                      <input
                        type="number" min="1" value={editQty}
                        onChange={e => setEditQty(e.target.value)}
                        onBlur={() => commitInlineEdit(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditingId(null); setEditQty(''); } }}
                        autoFocus
                        className="w-14 text-center text-[13px] font-semibold border border-primary rounded-md px-1 py-0.5 bg-background outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-[1.75px] bg-muted/60 rounded-md border border-border p-[2.55px]">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-[21px] h-[21px] flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        >
                          <Minus size={12} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => { setEditingId(item.id); setEditQty(String(item.quantity)); }}
                          className="w-[28px] text-center text-[13px] font-semibold text-foreground tabular-nums hover:text-primary transition-colors"
                        >
                          {item.quantity}
                        </button>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-[21px] h-[21px] flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        >
                          <Plus size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}

                    {/* Line total */}
                    <span className="text-[13px] font-semibold text-foreground tabular-nums w-16 text-right shrink-0">
                      ₵{(item.price * item.quantity).toFixed(2)}
                    </span>

                    {/* Remove (hover reveal) */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT — ORDER SUMMARY / PAYMENT / COMPLETE ══════════════════════ */}
        <div className="w-[420px] shrink-0 flex flex-col bg-card border border-border rounded-2xl shadow-sm">

          {/* ── ENTRY phase ─────────────────────────────────────────────────── */}
          {phase === 'entry' && (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between px-[17.5px] h-[64px] bg-muted/20 border-b border-border shrink-0">
                <span className="text-[16px] font-medium leading-[30px] text-foreground">Order Summary</span>
                {totalQty > 0 && (
                  <span className="text-[14px] font-medium text-muted-foreground">{totalQty} item{totalQty !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Customer row */}
              <div className="px-4 py-4 border-b border-border shrink-0">
                {customer ? (
                  <div className="flex items-center gap-2.5 p-2.5 bg-muted/30 rounded-xl border border-border">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserCheck size={13} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-foreground truncate">{customer.name}</p>
                      {customer.phone && <p className="text-[10px] text-muted-foreground">{customer.phone}</p>}
                    </div>
                    <button onClick={() => { setCustomer(null); setCustQuery(''); }} className="text-muted-foreground hover:text-destructive shrink-0 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ) : showNewCust ? (
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus value={newCustName} onChange={e => setNewCustName(e.target.value)}
                      placeholder="Full name"
                      className="h-8 px-3 text-[12.5px] border border-border rounded-lg bg-background outline-none focus:border-foreground/30 transition-colors"
                    />
                    <input
                      value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateCustomer(); if (e.key === 'Escape') { setShowNewCust(false); setNewCustName(''); setNewCustPhone(''); } }}
                      placeholder="Phone number"
                      className="h-8 px-3 text-[12.5px] border border-border rounded-lg bg-background outline-none focus:border-foreground/30 transition-colors"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={handleCreateCustomer} className="flex-1 h-8 text-[12px]">Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowNewCust(false); setNewCustName(''); setNewCustPhone(''); }} className="h-8 px-2 text-[12px]">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <div className="flex items-center gap-[8.75px] h-[39px] px-[13.05px] border border-border rounded-xl bg-background focus-within:border-foreground/30 transition-colors">
                        <Search size={13} className="text-muted-foreground shrink-0" />
                        <input
                          value={custQuery}
                          onChange={e => setCustQuery(e.target.value)}
                          onFocus={() => custResults.length > 0 && setCustDropOpen(true)}
                          onBlur={() => setTimeout(() => setCustDropOpen(false), 150)}
                          placeholder="Search or add customer (optional)"
                          className="flex-1 bg-transparent outline-none text-[12.5px] text-foreground placeholder:text-muted-foreground/60"
                        />
                        {custQuery && (
                          <button onClick={() => { setCustQuery(''); setCustResults([]); }} className="text-muted-foreground hover:text-foreground">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {custDropOpen && custResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 border border-border rounded-xl bg-background shadow-lg overflow-hidden">
                          {custResults.slice(0, 5).map(c => (
                            <button
                              key={c.id}
                              onMouseDown={() => { setCustomer(c); setCustQuery(''); setCustResults([]); setCustDropOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted border-b border-border/50 last:border-0 transition-colors"
                            >
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-muted-foreground">{c.name[0]}</span>
                              </div>
                              <div>
                                <p className="text-[12px] font-semibold text-foreground">{c.name}</p>
                                {c.phone && <p className="text-[10px] text-muted-foreground">{c.phone}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowNewCust(true)}
                      className="shrink-0 flex items-center gap-[7px] px-3 h-[40px] border border-border rounded-xl text-[12.5px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap"
                    >
                      <Plus size={12} /> New customer
                    </button>
                  </div>
                )}

                {customer?.reminderNote && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 mt-3">
                    <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">{customer.reminderNote}</p>
                  </div>
                )}
              </div>

              {/* Items summary (scrollable) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
                {items.length === 0 ? (
                  <div className="h-full flex items-center justify-center opacity-30">
                    <p className="text-xs text-muted-foreground">No items yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {items.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-8 min-w-0">
                          <span className="text-[14px] font-semibold text-foreground tabular-nums shrink-0">×{item.quantity}</span>
                          <span className="text-[14px] font-medium text-muted-foreground truncate">{item.name}</span>
                        </div>
                        <span className="text-[14px] font-semibold text-foreground tabular-nums shrink-0">
                          ₵{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals + actions footer */}
              <div className="border-t border-border shrink-0">

                {/* Discount input (shown conditionally) */}
                {showDiscount && (
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex items-center gap-1 bg-muted/50 rounded-md border border-border p-0.5">
                        <button
                          onClick={() => setDiscountMode('amount')}
                          className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors', discountMode === 'amount' ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground')}
                        >
                          ₵ Amount
                        </button>
                        <button
                          onClick={() => setDiscountMode('percent')}
                          className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors', discountMode === 'percent' ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground')}
                        >
                          % Percent
                        </button>
                      </div>
                      <button onClick={() => { setShowDiscount(false); setDiscountInput(''); }} className="ml-auto text-muted-foreground hover:text-foreground">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        autoFocus type="number" min="0" step="0.01" value={discountInput}
                        onChange={e => setDiscountInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') applyDiscount(); if (e.key === 'Escape') { setShowDiscount(false); setDiscountInput(''); } }}
                        placeholder={discountMode === 'percent' ? '10' : '5.00'}
                        className="flex-1 h-9 px-3 text-[13px] font-semibold border border-border rounded-lg bg-background outline-none focus:border-foreground/30 transition-colors"
                      />
                      <Button size="sm" onClick={applyDiscount} className="h-9 shrink-0">Apply</Button>
                      {discountAmt > 0 && (
                        <Button size="sm" variant="destructive" onClick={() => { setDiscount(null); setShowDiscount(false); setDiscountInput(''); toast.info('Discount removed'); }} className="h-9 shrink-0">
                          Remove
                        </Button>
                      )}
                    </div>
                    {discountMode === 'percent' && discountInput && !isNaN(parseFloat(discountInput)) && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        = ₵{((total * (parseFloat(discountInput) || 0)) / 100).toFixed(2)} off
                      </p>
                    )}
                  </div>
                )}

                {/* Apply Discount trigger */}
                <div className="px-4 pt-4 pb-1">
                  <button
                    onClick={() => {
                      if (!items.length) return;
                      if (!showDiscount) {
                        if (discount) {
                          setDiscountMode(discount.type === 'percent' ? 'percent' : 'amount');
                          setDiscountInput(String(discount.value));
                        } else {
                          setDiscountInput('');
                        }
                      }
                      setShowDiscount(s => !s);
                    }}
                    disabled={items.length === 0}
                    className={cn(
                      'w-full h-[42px] flex items-center justify-center gap-2 rounded-xl border text-[15px] font-medium transition-colors',
                      discountAmt > 0
                        ? 'border-primary/40 text-primary'
                        : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                    style={discountAmt > 0 ? { backgroundColor: 'color-mix(in oklch, var(--primary) 8%, transparent)' } : undefined}
                  >
                    <Percent size={15} />
                    {discountAmt > 0 ? `Discount applied (-₵${discountAmt.toFixed(2)})` : 'Apply Discount'}
                  </button>
                </div>

                {/* Totals */}
                <div className="px-4 py-4 flex flex-col gap-2.5">
                  {discountAmt > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[14px] font-medium text-muted-foreground">Subtotal</span>
                        <span className="text-[16px] font-semibold text-foreground tabular-nums">₵{total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[14px] font-medium text-muted-foreground flex items-center gap-1">
                          <Percent size={11} /> Discount
                        </span>
                        <span className="text-[16px] font-semibold text-primary tabular-nums">-₵{discountAmt.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-end pt-1">
                    <span className="text-[24px] font-medium text-foreground">Total</span>
                    <span className="text-[28px] font-bold text-foreground tabular-nums">₵{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Complete Sale → advances to payment */}
                <div className="px-4 pb-5 pt-1">
                  <Button
                    onClick={goToPayment}
                    disabled={!canCharge}
                    className="w-full h-[42px] text-[14px] font-bold rounded-xl tracking-[0.35px] gap-2"
                  >
                    Complete Sale <CheckCircle2 size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── PAYMENT phase ─────────────────────────────────────────────────── */}
          {phase === 'payment' && (
            <div className="flex flex-col h-full">
              {/* Breadcrumb header */}
              <div className="px-[17.5px] h-[64px] bg-muted/20 border-b border-border flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPhase('entry')}
                  className="text-[16px] font-medium leading-[30px] text-foreground/50 hover:text-foreground transition-colors"
                >
                  Order Summary
                </button>
                <ChevronRight size={20} className="text-muted-foreground shrink-0" />
                <span className="text-[16px] font-medium leading-[30px] text-foreground">Payment</span>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 flex flex-col gap-9">
                {/* Method cards */}
                <div className="flex flex-col gap-3">
                  <p className="text-[14px] font-medium text-foreground">Choose payment method</p>
                  <div className="flex gap-2 h-[90px]">
                    {(['Cash', 'MoMo', 'Split'] as PaymentMethod[]).map(m => {
                      const active = payMethod === m;
                      return (
                        <button
                          key={m}
                          onClick={() => { setPayMethod(m); setCashTendered(''); setMomoAmount(''); }}
                          className={cn(
                            'flex-1 flex items-center justify-center rounded-xl border-2 text-[16px] transition-all',
                            active
                              ? 'border-primary text-primary font-bold'
                              : 'border-border bg-background text-foreground font-medium hover:border-foreground/30'
                          )}
                          style={active ? { backgroundColor: 'color-mix(in oklch, var(--primary) 8%, transparent)' } : undefined}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-method input */}
                {payMethod === 'Cash' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-medium text-foreground">Cash received</p>
                    <input
                      ref={cashRef}
                      type="number" min="0" step="0.01" value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && canComplete) handleCompleteSale(); }}
                      placeholder="₵0.00"
                      className="w-full h-[49px] text-center text-[21px] font-medium border border-border rounded-xl bg-muted/30 outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/15 transition-all tabular-nums placeholder:text-muted-foreground/40"
                    />
                    <div className="flex gap-2">
                      {[5, 10, 20, 50, 100, 200].map(bill => (
                        <button
                          key={bill}
                          onClick={() => setCashTendered(bill.toString())}
                          className={cn(
                            'flex-1 h-[29px] rounded-lg border text-[11px] font-bold transition-all',
                            cashTendered === String(bill)
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-muted/50 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                          )}
                        >
                          ₵{bill}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {payMethod === 'MoMo' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-medium text-foreground">Mobile Money</p>
                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                      <div className="flex justify-between items-center">
                        <span className="text-[12.5px] text-muted-foreground">Amount to charge</span>
                        <span className="text-[21px] font-medium text-foreground tabular-nums">₵{grandTotal.toFixed(2)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-2">Confirm MoMo payment received, then complete sale.</p>
                    </div>
                  </div>
                )}

                {payMethod === 'Split' && (
                  <div className="flex gap-3">
                    <div className="flex-1 flex flex-col gap-2">
                      <p className="text-[14px] font-medium text-foreground flex items-center gap-1.5">
                        <Wallet size={13} className="text-muted-foreground" /> Cash portion
                      </p>
                      <input
                        ref={cashRef}
                        type="number" min="0" step="0.01" value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        placeholder="₵0.00"
                        className="w-full h-[49px] text-center text-[21px] font-medium border border-border rounded-xl bg-muted/30 outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/15 transition-all tabular-nums placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <p className="text-[14px] font-medium text-foreground flex items-center gap-1.5">
                        <CreditCard size={13} className="text-muted-foreground" /> MoMo portion
                      </p>
                      <input
                        type="number" min="0" step="0.01" value={momoAmount}
                        onChange={e => setMomoAmount(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && canComplete) handleCompleteSale(); }}
                        placeholder={cashRcvd > 0 ? `₵${Math.max(0, grandTotal - cashRcvd).toFixed(2)}` : '₵0.00'}
                        className="w-full h-[49px] text-center text-[21px] font-medium border border-border rounded-xl bg-muted/30 outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/15 transition-all tabular-nums placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Breakdown + complete */}
              <div className="shrink-0 border-t border-border/60 pt-6 pb-6 flex flex-col gap-6">
                <div className="px-4 border-b border-border pb-6 flex flex-col gap-3">
                  {payMethod !== 'MoMo' && (
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] font-medium text-muted-foreground">{payMethod === 'Cash' ? 'Cash received' : 'Received'}</span>
                      <span className="text-[16px] font-semibold text-foreground tabular-nums">₵{tendered.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] font-medium text-muted-foreground">Total</span>
                    <span className="text-[16px] font-semibold text-foreground tabular-nums">₵{grandTotal.toFixed(2)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] font-medium text-muted-foreground">Discount</span>
                      <span className="text-[16px] font-semibold text-primary tabular-nums">-₵{discountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-foreground mt-3 pt-6 flex items-end justify-between">
                    <span className="text-[24px] font-medium text-foreground">{payMethod === 'MoMo' ? 'Total' : 'Balance'}</span>
                    <span className={cn('text-[28px] font-bold tabular-nums', payMethod === 'MoMo' ? 'text-foreground' : change >= 0 ? 'text-foreground' : 'text-rose-600')}>
                      {payMethod === 'MoMo'
                        ? `₵${grandTotal.toFixed(2)}`
                        : change >= 0 ? `₵${change.toFixed(2)}` : `-₵${Math.abs(change).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <div className="px-4">
                  <Button
                    onClick={handleCompleteSale}
                    disabled={!canComplete || processing}
                    className="w-full h-[42px] text-[14px] font-bold rounded-xl gap-2 tracking-[0.35px]"
                  >
                    {processing ? 'Processing…' : <>Complete Sale <CheckCircle2 size={16} /></>}
                  </Button>
                  {!canComplete && payMethod !== 'MoMo' && tendered > 0 && (
                    <p className="text-[11px] text-rose-600 text-center mt-2">
                      Short by ₵{(grandTotal - tendered).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── COMPLETE phase ─────────────────────────────────────────────────── */}
          {phase === 'complete' && receiptData && (
            <div className="flex flex-col h-full">
              {/* Scrollable, centered content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center gap-2 px-4 py-6">
                {/* Success badge + message */}
                <div className="flex flex-col items-center gap-8 px-3.5 py-6">
                  <div className="w-[46px] h-[46px] rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={23} className="text-white" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[23px] font-medium text-foreground">Purchase Complete!</p>
                    <p className="text-[13px] font-semibold text-foreground/40 pt-0.5">
                      TXN #{receiptData.saleId.toString().padStart(6, '0')}
                    </p>
                  </div>
                </div>

                {/* Receipt */}
                <div className="w-[304px] px-3.5 py-4 flex flex-col">
                  {/* Pharmacy */}
                  <div className="flex flex-col gap-1 items-center">
                    <p className="text-[12.25px] font-bold text-foreground text-center">{tenant.name.toUpperCase()}</p>
                    {tenant.address && <p className="text-[11px] text-muted-foreground text-center">{tenant.address}</p>}
                    {tenant.primaryPhone && <p className="text-[11px] text-muted-foreground text-center">Tel: {tenant.primaryPhone}</p>}
                  </div>

                  {/* Meta */}
                  <div className="border-t border-dashed border-border mt-3.5 pt-3 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">Date</span>
                      <span className="text-[11px] font-medium text-foreground">{receiptData.date.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">Payment</span>
                      <span className="text-[11px] font-medium text-foreground">{receiptData.paymentMethod}</span>
                    </div>
                    {receiptData.customer && (
                      <div className="flex justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">Customer</span>
                        <span className="text-[11px] font-medium text-foreground">{receiptData.customer.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="border-t border-dashed border-border mt-3 pt-3 flex flex-col gap-2.5">
                    {receiptData.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-foreground">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.quantity} × ₵{item.price.toFixed(2)}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-foreground tabular-nums shrink-0">
                          ₵{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {receiptData.discount > 0 && (
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[11px] font-medium text-muted-foreground">Discount</p>
                        <span className="text-[11px] font-semibold text-foreground tabular-nums shrink-0">-₵{receiptData.discount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="border-t border-foreground mt-7 pt-4 flex items-center justify-between">
                    <span className="text-[12.25px] font-bold text-foreground">TOTAL</span>
                    <span className="text-[12.25px] font-black text-foreground tabular-nums">₵{receiptData.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="shrink-0 border-t border-border px-4 pt-6 pb-6 flex flex-col gap-4">
                <Button onClick={() => window.print()} variant="outline" className="w-full h-[39px] gap-2 rounded-[8.75px] text-[12.25px]">
                  <Printer size={14} /> Print Receipt
                </Button>
                <Button onClick={handleNewSale} className="w-full h-[42px] font-bold rounded-xl gap-2 tracking-[0.35px]">
                  New Sale <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ HELD CARTS SHEET ═════════════════════════════════════════════════ */}
      <Sheet open={showHeld} onOpenChange={setShowHeld}>
        <SheetContent className="p-0 gap-0 sm:max-w-sm">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
            <SheetTitle className="text-[15px] font-semibold flex items-center gap-2">
              <PauseCircle size={16} /> Held Carts
              <Badge variant="secondary" className="ml-1">{heldCarts.length}</Badge>
            </SheetTitle>
          </SheetHeader>
          <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
            {heldCarts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <PauseCircle size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No held carts</p>
              </div>
            ) : heldCarts.map(held => (
              <div key={held.id} className="p-3.5 border border-border rounded-xl bg-muted/20">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{held.items.length} item{held.items.length !== 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{held.timestamp}</p>
                    {held.customerName && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <UserCheck size={10} />{held.customerName}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-bold text-foreground tabular-nums">₵{held.total.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-[12px] gap-1" onClick={() => handleResume(held.id)}>
                    <PlayCircle size={12} /> Resume
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => { deleteHeldCart(held.id); toast.info('Removed'); }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <style>{`
        @keyframes miscFlapIn {
          from { opacity: 0; transform: translateY(-6px) scaleY(0.96); }
          to   { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        .animate-misc-flap { animation: miscFlapIn 0.16s cubic-bezier(0.16, 1, 0.3, 1); }
        @media (prefers-reduced-motion: reduce) {
          .animate-misc-flap { animation: none; }
        }
        @media print {
          body > * { display: none !important; }
          .print-receipt { display: block !important; }
        }
      `}</style>
    </>
  );
}
