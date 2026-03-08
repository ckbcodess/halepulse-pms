'use client';

import { useState } from 'react';
import { Search, Filter, AlertCircle, Edit3, PackagePlus, X, Save, Box, ArrowRight } from "lucide-react";
import { updateProduct, addStock } from '@/app/actions';
import { useRouter } from 'next/navigation';

export default function InventoryView({ products, query, filter }: { products: any[], query: string, filter: string }) {
    const router = useRouter();

    // Modals state
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [stockingProduct, setStockingProduct] = useState<any | null>(null);

    // Form states
    const [editPrice, setEditPrice] = useState('');
    const [editStock, setEditStock] = useState('');
    const [addStockQty, setAddStockQty] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openEdit = (p: any) => {
        setEditingProduct(p);
        setEditPrice(p.price.toString());
        setEditStock(p.stockQty.toString());
    };

    const openStockIn = (p: any) => {
        setStockingProduct(p);
        setAddStockQty('');
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await updateProduct(editingProduct.id, {
                price: parseFloat(editPrice),
                stockQty: parseInt(editStock, 10)
            });
            setEditingProduct(null);
            router.refresh();
        } catch (err) {
            alert("Failed to update product");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStockInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await addStock(stockingProduct.id, parseInt(addStockQty, 10));
            setStockingProduct(null);
            router.refresh();
        } catch (err) {
            alert("Failed to add stock");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-in slide-in-from-bottom-2 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '50ms' }}>
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Inventory Management</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Manage stock levels and pricing records across your pharmacy.</p>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 animate-in slide-in-from-bottom-3 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '150ms' }}>
                <form className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} strokeWidth={2} />
                    <input
                        name="q"
                        defaultValue={query}
                        placeholder="Search inventory..."
                        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium dark:text-slate-200 placeholder:text-slate-400"
                    />
                </form>
                <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-800 overflow-x-auto no-scrollbar">
                    <a href="/inventory?filter=all" className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>All Data</a>
                    <a href="/inventory?filter=low" className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${filter === 'low' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400'}`}>
                        <AlertCircle size={14} strokeWidth={2.5} /> Critical
                    </a>
                    <a href="/inventory?filter=expired" className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${filter === 'expired' ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400'}`}>Expired</a>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-[0_1px_2px_rgba(0,0,0,0.02)] animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out-expo fill-mode-both" style={{ animationDelay: '250ms' }}>
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[#fcfdfd] dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Item Reference</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-32">Volume</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-32">UnitPrice</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right w-48">Audit Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-24 text-center">
                                    <div className="flex flex-col items-center justify-center max-w-[280px] mx-auto">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700/50">
                                            <Search size={28} className="text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">No products found</p>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {query ? `We couldn't find anything matching "${query}". Try adjusting your search or filters.` : "There are currently no products in your inventory. Add your first product to get started."}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {products.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 tracking-tight">{p.name}</p>
                                    <div className="flex gap-2 items-center mt-1">
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">{p.category}</span>
                                        {p.expiryDate && (
                                            <span className={`text-[10px] font-medium flex items-center gap-1 ${new Date(p.expiryDate) < new Date() ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                                EXP: {new Date(p.expiryDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-middle">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${p.stockQty <= 5 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                        <span className={`text-sm font-semibold tracking-tight ${p.stockQty <= 5 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {p.stockQty.toString().padStart(3, '0')}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-middle">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">₵ {p.price.toFixed(2)}</span>
                                </td>
                                <td className="px-6 py-4 text-right align-middle">
                                    <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openStockIn(p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors shadow-sm">
                                            Stock
                                        </button>
                                        <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors">
                                            Edit
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Product Modal */}
            {editingProduct && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">Edit Product</h3>
                            <button disabled={isSubmitting} onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1.5 rounded-lg opacity-80 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="px-6 pt-5 pb-2">
                            <p className="font-bold text-lg text-slate-900 dark:text-white mb-1 leading-tight">{editingProduct.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">REF: {editingProduct.id.toString().padStart(6, '0')}</p>
                        </div>

                        <form onSubmit={handleEditSubmit} className="p-6 pt-2 space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Selling Price (₵)</label>
                                <input required type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium dark:text-slate-200" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Stock Quantity</label>
                                <input required type="number" value={editStock} onChange={e => setEditStock(e.target.value)} className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium dark:text-slate-200" />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none py-2.5 rounded-lg text-sm font-semibold flex justify-center items-center gap-2 transition-all">
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock In Modal */}
            {stockingProduct && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-500/10 border-b border-indigo-100/50 dark:border-indigo-500/20">
                            <h3 className="font-semibold text-sm text-indigo-900 dark:text-indigo-400 flex items-center gap-2"><PackagePlus size={16} className="text-indigo-600 dark:text-indigo-400" /> Stock In</h3>
                            <button disabled={isSubmitting} onClick={() => setStockingProduct(null)} className="text-indigo-800/50 dark:text-indigo-400/50 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors p-1.5 rounded-lg hover:bg-indigo-100/50 dark:hover:bg-indigo-500/20">
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="px-6 pt-5 pb-2">
                            <p className="font-bold text-lg text-slate-900 dark:text-white mb-1 leading-tight">{stockingProduct.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Current Stock: <span className="font-bold text-slate-900 dark:text-slate-200">{stockingProduct.stockQty.toString()}</span></p>
                        </div>

                        <form onSubmit={handleStockInSubmit} className="p-6 pt-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Quantity to Add</label>
                                <input required autoFocus type="number" min="1" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} placeholder="0" className="w-full px-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xl font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700 dark:text-white shadow-inner dark:shadow-black/20" />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all">
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2 opacity-50">Processing <ArrowRight size={16} /></span>
                                    ) : (
                                        <span className="flex items-center gap-2">Confirm Arrival <ArrowRight size={16} /></span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
