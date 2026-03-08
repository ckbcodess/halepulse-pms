'use client'
import { useState, useEffect } from 'react';
import { getProducts, getCustomers, processSale } from '@/app/actions';
import { useCartStore } from '@/lib/store';
import { Search, ShoppingCart, Trash2, UserPlus, UserCheck, Printer, X, Plus, Minus } from "lucide-react";

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<{ items: any[], total: number, customer: any, saleId: number, date: Date } | null>(null);
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCartStore();

  useEffect(() => {
    const fetch = async () => {
      const data = await getProducts(search);
      setProducts(data);
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

  const handleCompleteSale = async () => {
    if (items.length === 0) return;
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
    } catch (e) {
      alert('Error processing sale');
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-6rem)] print:hidden animate-in slide-in-from-bottom-2 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '50ms' }}>

        {/* Product Search & List */}
        <div className="flex-1 space-y-6 flex flex-col min-h-0 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl p-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" size={18} strokeWidth={2} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all text-sm font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
              products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addItem({ id: product.id, name: product.name, price: product.price, quantity: 1 })}
                  className="group bg-white dark:bg-[#0a0a0c] p-5 border border-slate-200 dark:border-zinc-800/80 rounded-xl hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors text-left flex flex-col justify-between h-32 active:scale-[0.98]"
                >
                  <div>
                    <h4 className="font-extrabold text-[15px] text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight tracking-tight">{product.name}</h4>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-1">{product.category}</p>
                  </div>
                  <div className="flex justify-between items-end w-full">
                    <span className="text-indigo-700 dark:text-indigo-400 font-extrabold tracking-tight">₵{product.price.toFixed(2)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${product.stockQty <= 5 ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'}`}>
                      Stock: {product.stockQty}
                    </span>
                  </div>
                </button>
              ))
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

          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[300px] custom-scrollbar">
            {/* Customer Selection */}
            <div className="relative">
              {selectedCustomer ? (
                <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 flex justify-between items-center group transition-colors hover:bg-indigo-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <UserCheck className="text-indigo-400" size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-50">{selectedCustomer.name}</p>
                      <p className="text-[10px] text-indigo-400/80 uppercase font-mono tracking-widest mt-0.5">{selectedCustomer.loyaltyPoints} PTS</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-indigo-400/50 hover:text-rose-400 bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative group">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:text-slate-500 dark:group-focus-within:text-white transition-colors" size={16} />
                    <input
                      type="text"
                      placeholder="Attach customer..."
                      className="w-full pl-11 pr-4 py-3 text-sm bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all font-medium"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </div>
                  {customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl mt-2 overflow-hidden">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomers([]);
                            setCustomerSearch('');
                          }}
                          className="w-full p-3 text-left hover:bg-slate-800/80 border-b border-slate-800/50 last:border-0 transition-colors flex justify-between items-center group"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{c.phone}</p>
                          </div>
                          <Plus size={14} className="text-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
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
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 bg-white dark:bg-[#0a0a0c] p-4 rounded-xl border border-slate-200 dark:border-zinc-800/80 group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-3">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-slate-200 line-clamp-2 leading-tight">{item.name}</h5>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">₵{item.price.toFixed(2)} each</p>
                      </div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-50 tracking-tight whitespace-nowrap">₵{(item.price * item.quantity).toFixed(2)}</span>
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

          <div className="p-6 bg-white dark:bg-[#18181b] border-t border-slate-100 dark:border-white/5 space-y-5">
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
              disabled={items.length === 0}
              className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-slate-900 font-bold tracking-wide py-4 rounded-xl transition-all active:scale-[0.98] flex justify-center items-center gap-2"
            >
              Process Transaction
            </button>
          </div>
        </div>
      </div >

      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:bg-white print:p-0 transition-all duration-300">
          <div className="bg-white rounded-md w-full max-w-sm overflow-hidden flex flex-col shadow-2xl print:shadow-none print:w-full print:max-w-none animate-in zoom-in-95 duration-200">
            {/* Modal Header - Hidden in print */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-widest"><Printer size={16} /> Receipt Protocol</h3>
              <button onClick={() => setReceiptData(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-8 flex-1 overflow-y-auto w-full text-slate-900 text-sm bg-white font-mono">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black font-sans tracking-tight mb-2">PHARM NEXT</h2>
                <p className="text-xs text-slate-500 font-mono">123 Health Street, City</p>
                <p className="text-xs text-slate-500 font-mono">Tel: +123 456 7890</p>
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
                <p className="text-[10px] uppercase tracking-widest text-slate-400">--- END OF RECEIPT ---</p>
              </div>
            </div>

            {/* Modal Footer - Hidden in print */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-md font-bold text-sm tracking-wide transition-colors flex justify-center items-center gap-2">
                <Printer size={16} /> PRINT
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="px-6 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-md transition-colors">
                DONE
              </button>
            </div>
          </div>
        </div>
      )
      }
    </>
  );
}
