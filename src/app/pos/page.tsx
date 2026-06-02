'use client'
import { useState, useEffect } from 'react';
import { getProducts, getCustomers, processSale, getTenantInfo, createCustomer } from '@/app/actions';
import { useCartStore } from '@/lib/store';
import type { CartItem } from '@/lib/store';
import {
  Search, ShoppingCart, Trash2, UserPlus, UserCheck, Printer, X, Plus, Minus,
  AlertTriangle, PauseCircle, PlayCircle, Percent, Tag, Wallet, CreditCard, CheckCircle2
} from "lucide-react";
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle, SheetHeader, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ActiveDialog = 'checkout' | 'discount' | 'misc' | 'held' | null;
type PaymentMethod = 'Cash' | 'MoMo' | 'Split';

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<{
    items: CartItem[], total: number, customer: any, saleId: number, date: Date,
    discount: number, paymentMethod: string
  } | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; address: string | null; primaryPhone: string | null }>({ name: 'Pharmacy', address: null, primaryPhone: null });
  const [processing, setProcessing] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // New dialog & checkout state
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [miscName, setMiscName] = useState('');
  const [miscPrice, setMiscPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [momoAmount, setMomoAmount] = useState('');

  const {
    items, addItem, removeItem, updateQuantity, clearCart, total,
    discount, setDiscount, heldCarts, holdCart, resumeCart, deleteHeldCart,
    addMiscItem, resetCheckout
  } = useCartStore();

  const discountAmount = discount?.value ?? 0;
  const discountedTotal = Math.max(0, total - discountAmount);

  // Load tenant info once
  useEffect(() => {
    getTenantInfo().then(setTenantInfo).catch(() => {});
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getProducts(search);
        setProducts(data);
      } catch {
        // silently fail — search will try again
      }
    };
    const timer = setTimeout(fetch, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (customerSearch.length > 2) {
      const fetch = async () => {
        const data = await getCustomers(customerSearch);
        setCustomers(data);
      };
      fetch();
    } else {
      setCustomers([]);
    }
  }, [customerSearch]);

  const handleAddToCart = (product: any) => {
    const isExpired = product.expiryDate && new Date(product.expiryDate) < new Date();
    if (isExpired) {
      toast.error(`Cannot add expired product: ${product.name}`);
      return;
    }
    if (product.stockQty <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const existing = items.find(i => i.id === product.id);
    if (existing && existing.quantity >= product.stockQty) {
      toast.error(`Only ${product.stockQty} units of ${product.name} available`);
      return;
    }
    addItem({ id: product.id, name: product.name, price: product.price, quantity: 1 });
  };

  const handleIncrement = (itemId: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    if (item.isMisc) { updateQuantity(itemId, 1); return; }
    const product = products.find(p => p.id === itemId);
    if (product && item.quantity >= product.stockQty) {
      toast.error(`Only ${product.stockQty} units of ${product.name} available`);
      return;
    }
    updateQuantity(itemId, 1);
  };

  const handleHoldCart = () => {
    if (items.length === 0) return;
    holdCart(selectedCustomer?.name ?? null, selectedCustomer?.id ?? null);
    setSelectedCustomer(null);
    setCustomerSearch('');
    toast.info('Cart held successfully');
  };

  const handleResumeCart = (id: string) => {
    if (items.length > 0) {
      toast.error('Clear current cart before resuming a held cart');
      return;
    }
    const held = resumeCart(id);
    if (held) {
      if (held.customerId) {
        // Re-fetch customer data for the restored cart
        getCustomers(held.customerName ?? '').then(custs => {
          const match = custs.find((c: any) => c.id === held.customerId);
          if (match) setSelectedCustomer(match);
        }).catch(() => {});
      }
      setActiveDialog(null);
      toast.success('Cart resumed');
    }
  };

  const handleApplyDiscount = () => {
    const val = parseFloat(discountInput);
    if (isNaN(val) || val <= 0) {
      toast.error('Enter a valid discount amount');
      return;
    }
    if (val > total) {
      toast.error('Discount cannot exceed subtotal');
      return;
    }
    setDiscount({ type: 'fixed', value: val });
    toast.success(`₵${val.toFixed(2)} discount applied`);
    setDiscountInput('');
    setActiveDialog(null);
  };

  const handleAddMiscItem = () => {
    if (!miscName.trim() || !miscPrice.trim()) {
      toast.error('Name and price are required');
      return;
    }
    const price = parseFloat(miscPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    addMiscItem(miscName.trim(), price);
    toast.success(`${miscName.trim()} added to cart`);
    setMiscName('');
    setMiscPrice('');
    setActiveDialog(null);
  };

  const handleCompleteSale = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    try {
      const regularItems = items.filter(i => !i.isMisc);
      const miscCartItems = items.filter(i => i.isMisc);

      // Build the split-tender breakdown (amounts sum to the discounted total).
      const payments: { method: string; amount: number; reference?: string | null }[] = [];
      if (paymentMethod === 'Split') {
        const momoPart = Math.min(parseFloat(momoAmount) || 0, discountedTotal);
        const cashPart = Math.round((discountedTotal - momoPart) * 100) / 100;
        if (momoPart > 0) payments.push({ method: 'mobile_money', amount: momoPart });
        if (cashPart > 0) payments.push({ method: 'cash', amount: cashPart });
      } else if (paymentMethod === 'MoMo') {
        payments.push({ method: 'mobile_money', amount: discountedTotal });
      } else {
        payments.push({ method: 'cash', amount: discountedTotal });
      }

      const sale = await processSale(
        regularItems.map(i => ({ id: i.id, quantity: i.quantity })),
        selectedCustomer?.id,
        undefined,
        discountAmount,
        paymentMethod,
        miscCartItems.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
        payments,
      );

      setReceiptData({
        items: [...items],
        total: discountedTotal,
        customer: selectedCustomer,
        saleId: sale.id,
        date: new Date(),
        discount: discountAmount,
        paymentMethod,
      });

      clearCart();
      resetCheckout();
      setSelectedCustomer(null);
      setCustomerSearch('');
      setActiveDialog(null);
      setCashTendered('');
      setMomoAmount('');
      setPaymentMethod('Cash');
      toast.success('Sale completed successfully!');

      const refreshed = await getProducts(search);
      setProducts(refreshed);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to process sale. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      const customer = await createCustomer(newCustName, newCustPhone);
      setSelectedCustomer(customer);
      setShowNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      toast.success(`Customer "${customer.name}" added`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create customer');
    }
  };

  // Checkout calculations
  const cashReceived = parseFloat(cashTendered) || 0;
  const momoReceived = parseFloat(momoAmount) || 0;
  const totalTendered = paymentMethod === 'Split' ? (cashReceived + momoReceived) : paymentMethod === 'MoMo' ? discountedTotal : cashReceived;
  const changeDue = totalTendered - discountedTotal;
  const canCompleteSale = items.length > 0 && totalTendered >= discountedTotal && discountedTotal > 0;

  const now = new Date();

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-6rem)] print:hidden animate-in slide-in-from-bottom-2 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '50ms' }}>

        {/* Product Search & List */}
        <div className="flex-1 flex flex-col gap-6 min-h-0 bg-white dark:bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} strokeWidth={2} />
              <Input
                placeholder="Search products..."
                className="pl-12 pr-4 h-12 text-sm font-medium text-foreground bg-background dark:bg-[var(--surface)] border-border placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveDialog('misc')} className="h-12 px-4 gap-2 font-bold text-muted-foreground hover:text-foreground">
              <Tag size={14} /> Misc
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pb-2 custom-scrollbar">
            {products.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 mt-8 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-4 border border-border">
                  <Search size={28} className="text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">No products found</p>
                <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
                  {search ? `We couldn't find any products matching "${search}".` : "Search for a product to get started. Frequently sold items will appear here."}
                </p>
              </div>
            ) : (
              products.map((product) => {
                const isExpired = product.expiryDate && new Date(product.expiryDate) < now;
                const daysToExpiry = product.expiryDate ? Math.ceil((new Date(product.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const isExpiringSoon = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
                const isOutOfStock = product.stockQty <= 0;

                return (
                  <Button
                    key={product.id}
                    variant="outline"
                    onClick={() => handleAddToCart(product)}
                    disabled={isExpired || isOutOfStock}
                    className={cn(
                      'group h-32 p-5 rounded-xl flex flex-col items-stretch justify-between text-left whitespace-normal relative',
                      isExpired
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 opacity-60'
                        : isOutOfStock
                          ? 'bg-muted/30 border-border opacity-50'
                          : 'hover:border-primary/50 hover:bg-muted/30'
                    )}
                  >
                    {isExpired && (
                      <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={10} /> Expired
                      </span>
                    )}
                    {isExpiringSoon && !isExpired && (
                      <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold uppercase tracking-wider">
                        {daysToExpiry}d left
                      </span>
                    )}

                    <div>
                      <h4 className="font-extrabold text-[15px] text-foreground line-clamp-2 leading-tight tracking-tight">{product.name}</h4>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">{product.category}</p>
                    </div>
                    <div className="flex justify-between items-end w-full">
                      <span className="text-primary font-extrabold tracking-tight">₵{product.price.toFixed(2)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        isOutOfStock
                          ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                          : product.stockQty <= 5
                            ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            : 'bg-muted/80 text-muted-foreground border border-border'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stockQty}`}
                      </span>
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </div>

        {/* Cart & Checkout */}
        <div className="w-full lg:w-[400px] bg-white dark:bg-card border border-border text-foreground rounded-2xl flex flex-col overflow-hidden shadow-premium animate-in slide-in-from-right-4 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '150ms' }}>

          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-[15px] font-semibold flex items-center gap-2">
              <ShoppingCart size={16} strokeWidth={2.5} className="text-primary" />
              Current Terminal
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 bg-muted text-muted-foreground rounded">
              {items.reduce((acc, i) => acc + i.quantity, 0)} ITEMS
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-[300px] custom-scrollbar">
            {/* Customer Selection */}
            <div className="relative">
              {selectedCustomer ? (
                <div>
                  <div className="bg-[var(--active-bg)] p-4 rounded-xl border border-[var(--active-border)] flex justify-between items-center group transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center">
                        <UserCheck className="text-primary" size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{selectedCustomer.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mt-0.5">{selectedCustomer.loyaltyPoints} PTS</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => setSelectedCustomer(null)} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </Button>
                  </div>
                  {/* Customer Reminder Alert */}
                  {selectedCustomer?.reminderNote && (
                    <div className="mt-2 flex items-start gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span className="font-semibold">{selectedCustomer.reminderNote}</span>
                    </div>
                  )}
                </div>
              ) : showNewCustomer ? (
                <div className="flex flex-col gap-2 bg-muted/30 p-4 rounded-xl border border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New Customer</p>
                  <Input
                    type="text"
                    placeholder="Customer name"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="text-sm bg-background border-border"
                  />
                  <Input
                    type="tel"
                    placeholder="Phone number"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="text-sm bg-background border-border"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateCustomer}
                      size="sm"
                      className="flex-1 bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowNewCustomer(false); setNewCustName(''); setNewCustPhone(''); }}
                      className="px-3 text-xs font-bold text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative group">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                    <Input
                      type="text"
                      placeholder="Search or add customer..."
                      className="pl-11 pr-4 h-12 text-sm font-medium bg-background border-border focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  {customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-background border border-border rounded-xl shadow-2xl mt-2 overflow-hidden">
                      {customers.map((c) => (
                        <Button
                          key={c.id}
                          variant="ghost"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomers([]);
                            setCustomerSearch('');
                          }}
                          className="w-full h-auto p-3 justify-between rounded-none border-b border-border last:border-0 group"
                        >
                          <div className="text-left">
                            <p className="text-sm font-semibold text-foreground">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.phone}</p>
                          </div>
                          <Plus size={14} className="text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                        </Button>
                      ))}
                    </div>
                  )}
                  <Button variant="link" size="sm" onClick={() => setShowNewCustomer(true)} className="mt-2 w-full">
                    <Plus size={12} /> New Customer
                  </Button>
                </>
              )}
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

            {items.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center border border-border">
                  <ShoppingCart size={24} strokeWidth={1.5} className="opacity-50" />
                </div>
                <p className="text-sm font-medium">Terminal awaits items</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 bg-background dark:bg-[var(--surface)] p-4 rounded-xl border border-border group transition-all hover:border-primary/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-3">
                        <h5 className="text-sm font-bold text-foreground line-clamp-2 leading-tight">{item.name}</h5>
                        <p className="text-[11px] text-muted-foreground font-mono mt-1">₵{item.price.toFixed(2)} each</p>
                      </div>
                      <span className="font-bold text-primary tracking-tight whitespace-nowrap">₵{(item.price * item.quantity).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-1 bg-muted dark:bg-sidebar border border-border rounded-lg p-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus size={14} strokeWidth={2.5} />
                        </Button>
                        <span className="text-xs font-bold text-foreground dark:text-muted-foreground w-6 text-center select-none">{item.quantity}</span>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleIncrement(item.id)}>
                          <Plus size={14} strokeWidth={2.5} />
                        </Button>
                      </div>

                      <Button variant="ghost" size="icon-sm" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer with Actions & Totals */}
          <div className="p-6 bg-background dark:bg-card border-t border-border flex flex-col gap-4">
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={items.length === 0}
                onClick={handleHoldCart}
                className="flex-1 gap-1.5 font-bold text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50"
              >
                <PauseCircle size={14} /> Hold
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveDialog('held')}
                className="flex-1 gap-1.5 font-bold"
              >
                <PlayCircle size={14} /> Held
                {heldCarts.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px] px-1">{heldCarts.length}</Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveDialog('discount')}
                className={`flex-1 gap-1.5 font-bold ${discountAmount > 0 ? 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30' : ''}`}
              >
                <Percent size={14} /> {discountAmount > 0 ? `-₵${discountAmount.toFixed(2)}` : 'Disc'}
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-bold uppercase tracking-wider">Subtotal</span>
              <span className="font-semibold text-foreground">₵{total.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Discount</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">-₵{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-2xl font-black tracking-tight">
              <span className="text-foreground">TOTAL</span>
              <span className="text-primary">₵{discountedTotal.toFixed(2)}</span>
            </div>
            <Button
              onClick={() => setActiveDialog('checkout')}
              disabled={items.length === 0}
              size="lg"
              className="w-full h-auto py-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold tracking-wide"
            >
              CHARGE ₵{discountedTotal.toFixed(2)}
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════ CHECKOUT SHEET ═══════════════════════ */}
      <Sheet open={activeDialog === 'checkout'} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
        <SheetContent className="p-0 gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="font-bold flex items-center gap-2">
              <CheckCircle2 size={18} className="text-primary" /> Complete Payment
            </SheetTitle>
          </SheetHeader>

          <div className="px-5 py-4 space-y-5">
            {/* Payment Method Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(['Cash', 'MoMo', 'Split'] as PaymentMethod[]).map(method => (
                <Button
                  key={method}
                  variant={paymentMethod === method ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setPaymentMethod(method);
                    if (method === 'MoMo') { setCashTendered(discountedTotal.toString()); }
                    else { setCashTendered(''); }
                    setMomoAmount('');
                  }}
                  className="flex-1"
                >
                  {method}
                </Button>
              ))}
            </div>

            {/* Cash Input */}
            {paymentMethod === 'Cash' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cash Received</label>
                <Input
                  type="number"
                  className="h-14 text-2xl font-black text-center bg-muted/30"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && canCompleteSale) handleCompleteSale(); }}
                />
                <div className="grid grid-cols-6 gap-1.5">
                  {[5, 10, 20, 50, 100, 200].map(bill => (
                    <Button key={bill} variant="secondary" size="sm" className="font-bold" onClick={() => setCashTendered(bill.toString())}>
                      ₵{bill}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* MoMo Input */}
            {paymentMethod === 'MoMo' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">MoMo Reference / Phone</label>
                <Input type="text" className="h-12 bg-muted/30" placeholder="Enter MoMo details..." autoFocus />
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl flex justify-between items-center">
                  <span className="text-blue-800 dark:text-blue-300 font-semibold text-sm">Amount to Charge</span>
                  <span className="text-xl font-black text-blue-900 dark:text-blue-200">₵{discountedTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Split Input */}
            {paymentMethod === 'Split' && (
              <div className="space-y-3">
                <div className="flex gap-3 items-center p-4 bg-muted/30 rounded-xl border border-border">
                  <Wallet size={20} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Cash Portion</label>
                    <Input
                      type="number"
                      className="h-12 text-lg font-bold"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex gap-3 items-center p-4 bg-muted/30 rounded-xl border border-border">
                  <CreditCard size={20} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">MoMo Portion</label>
                    <Input
                      type="number"
                      className="h-12 text-lg font-bold"
                      value={momoAmount}
                      onChange={(e) => setMomoAmount(e.target.value)}
                      placeholder={cashReceived > 0 ? (discountedTotal - cashReceived).toFixed(2) : '0.00'}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-semibold">Total Due</span>
                <span className="font-bold text-foreground">₵{discountedTotal.toFixed(2)}</span>
              </div>
              {paymentMethod !== 'MoMo' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-semibold">Tendered</span>
                    <span className="font-bold text-foreground">₵{totalTendered.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Change Due</span>
                      <span className={`text-2xl font-black ${changeDue >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {changeDue >= 0 ? `₵${changeDue.toFixed(2)}` : `-₵${Math.abs(changeDue).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <SheetFooter className="">
            <Button
              disabled={!canCompleteSale || processing}
              onClick={handleCompleteSale}
              className="flex-1 h-12 font-bold text-base gap-2"
            >
              {processing ? 'Processing...' : <><CheckCircle2 size={18} /> Complete Sale</>}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════ DISCOUNT SHEET ═══════════════════════ */}
      <Sheet open={activeDialog === 'discount'} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
        <SheetContent className="p-0 gap-0 sm:max-w-sm">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="font-bold flex items-center gap-2">
              <Percent size={16} /> Apply Discount
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="text-sm text-muted-foreground flex justify-between">
              <span>Current Subtotal</span>
              <span className="font-bold text-foreground">₵{total.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Discount Amount (₵)</label>
              <Input
                type="number"
                className="h-14 text-2xl font-black text-center bg-muted/30"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0.00"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDiscount(); }}
              />
            </div>
          </div>
          <SheetFooter className="">
            {discountAmount > 0 && (
              <Button variant="destructive" onClick={() => { setDiscount(null); setActiveDialog(null); toast.info('Discount removed'); }} className="mr-auto">
                Remove
              </Button>
            )}
            <Button onClick={handleApplyDiscount} className="font-bold">Apply</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════ MISC ITEM SHEET ═══════════════════════ */}
      <Sheet open={activeDialog === 'misc'} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
        <SheetContent className="p-0 gap-0 sm:max-w-sm">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="font-bold flex items-center gap-2">
              <Tag size={16} /> Miscellaneous Sale
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Item Description</label>
              <Input
                className="h-12 bg-muted/30"
                value={miscName}
                onChange={(e) => setMiscName(e.target.value)}
                placeholder="e.g. Shopping Bag"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Price (₵)</label>
              <Input
                type="number"
                className="h-12 bg-muted/30"
                value={miscPrice}
                onChange={(e) => setMiscPrice(e.target.value)}
                placeholder="0.00"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMiscItem(); }}
              />
            </div>
          </div>
          <SheetFooter className="">
            <Button variant="ghost" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button onClick={handleAddMiscItem} className="font-bold">Add to Cart</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════ HELD CARTS SHEET ═══════════════════════ */}
      <Sheet open={activeDialog === 'held'} onOpenChange={(open) => { if (!open) setActiveDialog(null); }}>
        <SheetContent className="p-0 gap-0 sm:max-w-sm">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="font-bold flex items-center gap-2">
              <PauseCircle size={16} /> Held Carts ({heldCarts.length})
            </SheetTitle>
          </SheetHeader>
          <div className="px-5 py-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {heldCarts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PauseCircle size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No held carts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {heldCarts.map((held) => (
                  <div key={held.id} className="p-4 border border-border rounded-xl bg-muted/20 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-foreground">{held.items.length} item{held.items.length !== 1 ? 's' : ''}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{held.timestamp}</p>
                        {held.customerName && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <UserCheck size={10} /> {held.customerName}
                          </p>
                        )}
                      </div>
                      <span className="font-bold text-primary">₵{held.total.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 font-bold gap-1" onClick={() => handleResumeCart(held.id)}>
                        <PlayCircle size={14} /> Resume
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => { deleteHeldCart(held.id); toast.info('Held cart removed'); }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════ RECEIPT SHEET ═══════════════════════ */}
      <Sheet open={!!receiptData} onOpenChange={(open) => { if (!open) setReceiptData(null); }}>
        <SheetContent showCloseButton={false} className="p-0 gap-0 overflow-hidden sm:max-w-sm print:shadow-none">
          <div className="p-4 border-b border-border flex justify-between items-center bg-muted print:hidden">
            <SheetTitle className="font-bold text-foreground flex items-center gap-2 text-sm uppercase tracking-widest">
              <Printer size={16} /> Receipt
            </SheetTitle>
            <Button variant="ghost" size="icon-sm" onClick={() => setReceiptData(null)} className="text-muted-foreground hover:text-destructive">
              <X size={20} />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {receiptData && (
            <div className="print-receipt p-8 overflow-y-auto w-full text-foreground text-sm bg-white font-mono max-h-[60vh]">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black font-sans tracking-tight mb-2">{tenantInfo.name?.toUpperCase() || 'PHARMACY'}</h2>
                {tenantInfo.address && <p className="text-xs text-muted-foreground font-mono">{tenantInfo.address}</p>}
                {tenantInfo.primaryPhone && <p className="text-xs text-muted-foreground font-mono">Tel: {tenantInfo.primaryPhone}</p>}
              </div>

              <div className="border-t border-b border-dotted border-slate-300 py-4 mb-6 space-y-2 text-xs">
                <div className="flex justify-between"><span>TXN_ID:</span> <span>#{receiptData.saleId.toString().padStart(6, '0')}</span></div>
                <div className="flex justify-between"><span>DATE:</span> <span>{receiptData.date.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>PAYMENT:</span> <span>{receiptData.paymentMethod}</span></div>
                {receiptData.customer && (
                  <div className="flex justify-between"><span>CUSTOMER:</span> <span>{receiptData.customer.name}</span></div>
                )}
              </div>

              <div className="space-y-4 mb-8">
                {receiptData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs">
                    <div className="pr-4">
                      <p className="font-bold text-foreground mb-1 leading-tight">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.quantity} x ₵{item.price.toFixed(2)}</p>
                    </div>
                    <span className="font-bold whitespace-nowrap">₵{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {receiptData.discount > 0 && (
                <div className="border-t border-dotted border-slate-300 pt-3 mb-3 flex justify-between text-xs">
                  <span>DISCOUNT</span>
                  <span className="font-bold">-₵{receiptData.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-center font-bold text-lg font-sans">
                <span>TOTAL</span>
                <span>₵{receiptData.total.toFixed(2)}</span>
              </div>

              <div className="mt-12 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Thank you for your patronage</p>
              </div>
            </div>
          )}

          <div className="p-4 bg-muted border-t border-border flex gap-3 print:hidden">
            <Button
              onClick={() => window.print()}
              className="flex-1 bg-sidebar hover:bg-sidebar text-white py-3 rounded-md font-bold text-sm tracking-wide flex justify-center items-center gap-2"
            >
              <Printer size={16} /> PRINT
            </Button>
            <Button
              variant="outline"
              onClick={() => setReceiptData(null)}
              className="px-6 font-bold text-sm rounded-md"
            >
              DONE
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
