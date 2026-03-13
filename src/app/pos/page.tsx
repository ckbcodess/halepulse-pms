'use client'
import { useState, useEffect } from 'react';
import { getProducts, getCustomers, processSale, getTenantInfo, createCustomer } from '@/app/actions';
import { useCartStore } from '@/lib/store';
import { Search, ShoppingCart, Trash2, UserPlus, UserCheck, Printer, X, Plus, Minus, AlertTriangle } from "lucide-react";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<{ items: any[], total: number, customer: any, saleId: number, date: Date } | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; address: string | null; primaryPhone: string | null }>({ name: 'Pharmacy', address: null, primaryPhone: null });
  const [processing, setProcessing] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCartStore();

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
    addItem({ id: product.id, name: product.name, price: product.price, quantity: 1 });
  };

  const handleCompleteSale = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    try {
      const sale = await processSale(items.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })), total, selectedCustomer?.id);

      setReceiptData({
        items: [...items],
        total,
        customer: selectedCustomer,
        saleId: sale.id,
        date: new Date()
      });

      clearCart();
      setSelectedCustomer(null);
      setCustomerSearch('');
      toast.success('Sale completed successfully!');

      // Refresh products to get updated stock
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

  const now = new Date();

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-6rem)] print:hidden animate-in slide-in-from-bottom-2 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '50ms' }}>

        {/* Product Search & List */}
        <div className="flex-1 flex flex-col gap-6 min-h-0 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" size={18} strokeWidth={2} />
            <Input
              placeholder="Search products..."
              className="pl-12 pr-4 h-12 text-sm font-medium text-slate-900 dark:text-slate-200 bg-white dark:bg-[#0a0a0c] border-slate-200 dark:border-zinc-800/80 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-2 pb-2 custom-scrollbar">
            {products.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 mt-8 text-center animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700/50">
                  <Search size={28} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">No products found</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {search ? `We couldn't find any products matching "${search}".` : "Your inventory is currently empty. Add products to start selling."}
                </p>
              </div>
            ) : (
              products.map((product) => {
                const isExpired = product.expiryDate && new Date(product.expiryDate) < now;
                const daysToExpiry = product.expiryDate ? Math.ceil((new Date(product.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const isExpiringSoon = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 30;
                const isOutOfStock = product.stockQty <= 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    disabled={isExpired || isOutOfStock}
                    className={`group p-5 border rounded-xl text-left flex flex-col justify-between h-32 active:scale-[0.98] transition-colors relative ${
                      isExpired
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50 opacity-60 cursor-not-allowed'
                        : isOutOfStock
                          ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-zinc-800/50 opacity-50 cursor-not-allowed'
                          : 'bg-white dark:bg-[#0a0a0c] border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    {/* Expiry badges */}
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
                      <h4 className="font-extrabold text-[15px] text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight tracking-tight">{product.name}</h4>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-1">{product.category}</p>
                    </div>
                    <div className="flex justify-between items-end w-full">
                      <span className="text-indigo-700 dark:text-indigo-400 font-extrabold tracking-tight">₵{product.price.toFixed(2)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        isOutOfStock
                          ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                          : product.stockQty <= 5
                            ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stockQty}`}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Cart & Checkout */}
        <div className="w-full lg:w-[400px] bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '150ms' }}>

          <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#18181b]">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart size={16} strokeWidth={2.5} />
              Current Terminal
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded">
              {items.reduce((acc, i) => acc + i.quantity, 0)} ITEMS
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-[300px] custom-scrollbar">
            {/* Customer Selection */}
            <div className="relative">
              {selectedCustomer ? (
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 flex justify-between items-center group transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                      <UserCheck className="text-indigo-600 dark:text-indigo-400" size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">{selectedCustomer.name}</p>
                      <p className="text-[10px] text-indigo-500 dark:text-indigo-400/80 uppercase font-mono tracking-widest mt-0.5">{selectedCustomer.loyaltyPoints} PTS</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-indigo-400 hover:text-rose-500 p-1.5 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : showNewCustomer ? (
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Customer</p>
                  <Input
                    type="text"
                    placeholder="Customer name"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="text-sm bg-white dark:bg-[#0a0a0c] border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <Input
                    type="tel"
                    placeholder="Phone number"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="text-sm bg-white dark:bg-[#0a0a0c] border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateCustomer}
                      size="sm"
                      className="flex-1 bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowNewCustomer(false); setNewCustName(''); setNewCustPhone(''); }}
                      className="px-3 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative group">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:text-slate-500 dark:group-focus-within:text-white transition-colors" size={16} />
                    <Input
                      type="text"
                      placeholder="Search or add customer..."
                      className="pl-11 pr-4 h-12 text-sm font-medium bg-white dark:bg-[#0a0a0c] border-slate-200 dark:border-zinc-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-600"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  {customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl mt-2 overflow-hidden">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomers([]);
                            setCustomerSearch('');
                          }}
                          className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800/50 last:border-0 transition-colors flex justify-between items-center group"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{c.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{c.phone}</p>
                          </div>
                          <Plus size={14} className="text-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="mt-2 w-full text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold py-1.5 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={12} /> New Customer
                  </button>
                </>
              )}
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>

            {items.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                  <ShoppingCart size={24} strokeWidth={1.5} className="opacity-50" />
                </div>
                <p className="text-sm font-medium">Terminal awaits items</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 bg-white dark:bg-[#0a0a0c] p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-3">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-slate-200 line-clamp-2 leading-tight">{item.name}</h5>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">₵{item.price.toFixed(2)} each</p>
                      </div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 tracking-tight whitespace-nowrap">₵{(item.price * item.quantity).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-md transition-colors active:scale-95">
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-200 w-6 text-center select-none">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-md transition-colors active:scale-95">
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>

                      <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors p-2 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white dark:bg-[#18181b] border-t border-slate-100 dark:border-white/5 flex flex-col gap-5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Subtotal</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">₵{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-2xl font-black tracking-tight">
              <span className="text-slate-900 dark:text-white">TOTAL</span>
              <span className="text-indigo-600 dark:text-indigo-400">₵{total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCompleteSale}
              disabled={items.length === 0 || processing}
              className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-slate-900 font-bold tracking-wide py-4 rounded-xl transition-all active:scale-[0.98] flex justify-center items-center gap-2"
            >
              {processing ? 'Processing...' : 'Process Transaction'}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptData} onOpenChange={(open) => { if (!open) setReceiptData(null); }}>
        <DialogContent showCloseButton={false} className="p-0 gap-0 overflow-hidden rounded-md sm:max-w-sm print:shadow-none">
          {/* Modal Header - Hidden in print */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
            <DialogTitle className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-widest">
              <Printer size={16} /> Receipt
            </DialogTitle>
            <button onClick={() => setReceiptData(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
              <X size={20} />
              <span className="sr-only">Close</span>
            </button>
          </div>

          {/* Receipt Content */}
          {receiptData && (
            <div className="print-receipt p-8 overflow-y-auto w-full text-slate-900 text-sm bg-white font-mono max-h-[60vh]">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black font-sans tracking-tight mb-2">{tenantInfo.name?.toUpperCase() || 'PHARMACY'}</h2>
                {tenantInfo.address && <p className="text-xs text-slate-500 font-mono">{tenantInfo.address}</p>}
                {tenantInfo.primaryPhone && <p className="text-xs text-slate-500 font-mono">Tel: {tenantInfo.primaryPhone}</p>}
              </div>

              <div className="border-t border-b border-dotted border-slate-300 py-4 mb-6 space-y-2 text-xs">
                <div className="flex justify-between"><span>TXN_ID:</span> <span>#{receiptData.saleId.toString().padStart(6, '0')}</span></div>
                <div className="flex justify-between"><span>DATE:</span> <span>{receiptData.date.toLocaleString()}</span></div>
                {receiptData.customer && (
                  <div className="flex justify-between"><span>CUSTOMER:</span> <span>{receiptData.customer.name}</span></div>
                )}
              </div>

              <div className="space-y-4 mb-8">
                {receiptData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs">
                    <div className="pr-4">
                      <p className="font-bold text-slate-900 mb-1 leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.quantity} x ₵{item.price.toFixed(2)}</p>
                    </div>
                    <span className="font-bold whitespace-nowrap">₵{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-center font-bold text-lg font-sans">
                <span>TOTAL</span>
                <span>₵{receiptData.total.toFixed(2)}</span>
              </div>

              <div className="mt-12 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Thank you for your patronage</p>
              </div>
            </div>
          )}

          {/* Modal Footer - Hidden in print */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 print:hidden">
            <Button
              onClick={() => window.print()}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-md font-bold text-sm tracking-wide flex justify-center items-center gap-2"
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
        </DialogContent>
      </Dialog>
    </>
  );
}
