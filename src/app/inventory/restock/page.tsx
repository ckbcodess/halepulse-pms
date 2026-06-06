'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertTriangle,
  Search, ChevronDown, X, Package, Settings2, ChevronRight,
  Loader2, Download, Link2, Link2Off, Pencil, Check, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'review' | 'processing' | 'done';

type CSVRow = {
  name: string;
  quantity: number;
  costPrice: number;
  expiryDate: string;
  batchNumber: string;
};

type DBProduct = {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  stockQty: number;
  costPrice: number | null;
  markupPercent: number;
  price: number;
};

type CategoryMarkup = {
  id: number;
  name: string;
  markupPercent: number;
};

type MappedItem = {
  csvRow: CSVRow;
  matchedProduct: DBProduct | null;
  matchScore: number;
  markupPercent: number;
  costPrice: number;
  sellingPrice: number;
  quantityToAdd: number;
  included: boolean;
};

type RestockResult = {
  restocked: number;
  totalUnitsAdded: number;
  items: { name: string; oldQty: number; newQty: number; delta: number }[];
};

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    parts.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = parts[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function mapCSVRow(raw: Record<string, string>): CSVRow {
  return {
    name: raw['name'] || raw['item_name'] || raw['product'] || raw['drug'] || raw['item'] || raw['medicine'] || raw['description'] || '',
    quantity: parseInt(raw['quantity'] || raw['qty'] || raw['stock'] || raw['units'] || raw['count'] || '0') || 0,
    costPrice: parseFloat(raw['cost'] || raw['costprice'] || raw['cost_price'] || raw['prate'] || raw['unit_price'] || raw['price'] || '0') || 0,
    expiryDate: raw['expiry'] || raw['expirydate'] || raw['expiry_date'] || raw['exp'] || '',
    batchNumber: raw['batch'] || raw['batch_number'] || raw['lot'] || raw['batch_no'] || '',
  };
}

// ── Fuzzy Match ───────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fuzzyScore(csvName: string, dbName: string): number {
  const a = normalize(csvName);
  const b = normalize(dbName);
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;

  const aWords = a.split(' ').filter(Boolean);
  const bWords = b.split(' ').filter(Boolean);
  let matches = 0;
  for (const w of aWords) {
    if (bWords.some(bw => bw.includes(w) || w.includes(bw))) matches++;
  }
  const score = matches / Math.max(aWords.length, bWords.length);
  return score;
}

function findBestMatch(csvName: string, products: DBProduct[]): { product: DBProduct | null; score: number } {
  let best: DBProduct | null = null;
  let bestScore = 0;
  for (const p of products) {
    const score = fuzzyScore(csvName, p.name);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return { product: bestScore >= 0.4 ? best : null, score: bestScore };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchAllProducts(): Promise<DBProduct[]> {
  // Fetch all products (no pagination) for matching
  const res = await fetch('/api/inventory?limit=5000&page=1');
  if (!res.ok) throw new Error('Failed to load products');
  const data = await res.json();
  return data.items;
}

async function fetchCategories(): Promise<CategoryMarkup[]> {
  const res = await fetch('/api/inventory/categories');
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BatchRestockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [mappedItems, setMappedItems] = useState<MappedItem[]>([]);
  const [result, setResult] = useState<RestockResult | null>(null);
  const [showMarkupSettings, setShowMarkupSettings] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [roundPrices, setRoundPrices] = useState(false);
  const [updateAllStock, setUpdateAllStock] = useState(true);
  const [creatingProductIdx, setCreatingProductIdx] = useState<number | null>(null);
  const [showStickyMarkupDialog, setShowStickyMarkupDialog] = useState(false);
  const [changedMarkupItems, setChangedMarkupItems] = useState<{ productName: string; category: string; markupPercent: number }[]>([]);

  // Fetch products and categories
  const { data: allProducts = [], refetch: refetchProducts } = useQuery({ queryKey: ['all-products-restock'], queryFn: fetchAllProducts, staleTime: 60000 });
  const { data: categories = [], refetch: refetchCategories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 60000 });

  const categoryMarkupMap = useMemo(() => {
    const map: Record<string, number> = {};
    categories.forEach(c => { map[c.name] = c.markupPercent; });
    return map;
  }, [categories]);

  // ── File Upload ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { toast.error('Please upload a .csv file'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const raw = parseCSV(text);
      const mapped = raw.map(mapCSVRow).filter(r => r.name.trim().length > 0);
      if (mapped.length === 0) { toast.error('No valid items found in the CSV'); return; }
      setCsvRows(mapped);
      toast.success(`Found ${mapped.length} items in CSV`);

      // Auto-match
      if (allProducts.length > 0) {
        doMapping(mapped, allProducts);
      }
    };
    reader.readAsText(file);
  };

  // Re-run mapping when products load
  useEffect(() => {
    if (csvRows.length > 0 && allProducts.length > 0 && mappedItems.length === 0) {
      doMapping(csvRows, allProducts);
    }
  }, [allProducts]);

  const doMapping = (rows: CSVRow[], products: DBProduct[]) => {
    const items: MappedItem[] = rows.map((csvRow) => {
      const { product, score } = findBestMatch(csvRow.name, products);
      const markup = product ? (categoryMarkupMap[product.category] ?? product.markupPercent ?? 30) : 30;
      const cost = csvRow.costPrice || (product?.costPrice ?? 0);
      return {
        csvRow,
        matchedProduct: product,
        matchScore: score,
        markupPercent: markup,
        costPrice: cost,
        sellingPrice: Math.round(cost * (1 + markup / 100) * 100) / 100,
        quantityToAdd: csvRow.quantity,
        included: product !== null,
      };
    });
    setMappedItems(items);
    setStep('mapping');
  };

  // ── Mapping Controls ──
  const updateItem = (idx: number, changes: Partial<MappedItem>) => {
    setMappedItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      // Recalc selling price if cost or markup changed
      if ('costPrice' in changes || 'markupPercent' in changes) {
        const cost = changes.costPrice ?? next[idx].costPrice;
        const markup = changes.markupPercent ?? next[idx].markupPercent;
        let sp = Math.round(cost * (1 + markup / 100) * 100) / 100;
        if (roundPrices) sp = Math.round(sp * 2) / 2;
        next[idx].sellingPrice = sp;
      }
      return next;
    });
  };

  const rematchItem = (idx: number, productId: number) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const markup = categoryMarkupMap[product.category] ?? product.markupPercent ?? 30;
    const cost = mappedItems[idx].csvRow.costPrice || (product.costPrice ?? 0);
    updateItem(idx, {
      matchedProduct: product,
      matchScore: 1,
      markupPercent: markup,
      costPrice: cost,
      sellingPrice: Math.round(cost * (1 + markup / 100) * 100) / 100,
      included: true,
    });
  };

  // ── Filtered items ──
  const filteredItems = useMemo(() => {
    let items = mappedItems;
    if (activeTab === 'matched') items = items.filter(i => i.matchedProduct !== null);
    else if (activeTab === 'unmatched') items = items.filter(i => i.matchedProduct === null);
    if (searchFilter) {
      const s = searchFilter.toLowerCase();
      items = items.filter(i => i.csvRow.name.toLowerCase().includes(s) || i.matchedProduct?.name.toLowerCase().includes(s));
    }
    return items;
  }, [mappedItems, activeTab, searchFilter]);

  // Re-apply price rounding when toggle changes
  useEffect(() => {
    if (mappedItems.length === 0) return;
    setMappedItems(prev => prev.map(item => {
      let sp = Math.round(item.costPrice * (1 + item.markupPercent / 100) * 100) / 100;
      if (roundPrices) sp = Math.round(sp * 2) / 2;
      return { ...item, sellingPrice: sp };
    }));
  }, [roundPrices]);

  const matchedCount = mappedItems.filter(i => i.matchedProduct !== null).length;
  const unmatchedCount = mappedItems.filter(i => i.matchedProduct === null).length;
  const includedItems = mappedItems.filter(i => i.included && i.matchedProduct);

  // ── Create New Product from CSV row ──
  const handleCreateProduct = async (idx: number) => {
    const item = mappedItems[idx];
    setCreatingProductIdx(idx);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.csvRow.name,
          category: 'General',
          costPrice: item.csvRow.costPrice,
          stockQty: 0,
          unit: 'Piece',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create product');
      }
      const newProduct = await res.json();
      toast.success(`Created product "${item.csvRow.name}"`);
      // Refetch products and auto-match
      const { data: freshProducts } = await refetchProducts();
      if (freshProducts) {
        const match = freshProducts.find((p: DBProduct) => p.id === newProduct.id) || newProduct;
        const markup = categoryMarkupMap[match.category] ?? match.markupPercent ?? 30;
        const cost = item.csvRow.costPrice || (match.costPrice ?? 0);
        let sp = Math.round(cost * (1 + markup / 100) * 100) / 100;
        if (roundPrices) sp = Math.round(sp * 2) / 2;
        updateItem(idx, {
          matchedProduct: match,
          matchScore: 1,
          markupPercent: markup,
          costPrice: cost,
          sellingPrice: sp,
          included: true,
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingProductIdx(null);
    }
  };

  // ── Save sticky markup ──
  const handleSaveStickyMarkup = async () => {
    try {
      // Group by category, take the last changed markup per category
      const categoryUpdates: Record<string, number> = {};
      changedMarkupItems.forEach(item => { categoryUpdates[item.category] = item.markupPercent; });
      const patches = categories
        .filter(c => categoryUpdates[c.name] !== undefined)
        .map(c => ({ id: c.id, markupPercent: categoryUpdates[c.name] }));
      if (patches.length > 0) {
        const res = await fetch('/api/inventory/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patches),
        });
        if (!res.ok) throw new Error('Failed to update category markups');
        toast.success('Category default markups updated');
        refetchCategories();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setShowStickyMarkupDialog(false);
      setChangedMarkupItems([]);
    }
  };

  // ── Submit Restock ──
  const handleSubmit = async () => {
    if (includedItems.length === 0) { toast.error('No items selected for restock'); return; }

    // Validation: warn about zero cost prices
    const zeroCostItems = includedItems.filter(i => i.costPrice <= 0);
    if (zeroCostItems.length > 0) {
      toast.warning(`${zeroCostItems.length} item(s) have zero or negative cost price. Please review.`);
      return;
    }

    // Filter out items with zero quantity
    const validItems = includedItems.filter(i => i.quantityToAdd > 0);
    if (validItems.length === 0) { toast.error('All selected items have zero quantity'); return; }
    if (validItems.length < includedItems.length) {
      toast.warning(`${includedItems.length - validItems.length} item(s) with zero quantity were excluded`);
    }

    setStep('processing');
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validItems.map(i => ({
            productId: i.matchedProduct!.id,
            quantityReceived: i.quantityToAdd,
            ...(updateAllStock
              ? { costPrice: i.costPrice, markupPercent: i.markupPercent }
              : {}),
          })),
          updateAllStock,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Restock failed');
      }
      const data = await res.json();
      setResult(data);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success(`Restocked ${data.restocked} products!`);

      // Check for sticky markup changes
      const changed = validItems.filter(i => {
        if (!i.matchedProduct) return false;
        const defaultMarkup = categoryMarkupMap[i.matchedProduct.category] ?? i.matchedProduct.markupPercent;
        return i.markupPercent !== defaultMarkup;
      }).map(i => ({
        productName: i.matchedProduct!.name,
        category: i.matchedProduct!.category,
        markupPercent: i.markupPercent,
      }));
      if (changed.length > 0) {
        setChangedMarkupItems(changed);
        setShowStickyMarkupDialog(true);
      }
    } catch (err: any) {
      toast.error(err.message);
      setStep('mapping');
    }
  };

  // ── Category Markup Settings Sheet ──
  const MarkupSettingsSheet = () => {
    const [localMarkups, setLocalMarkups] = useState<CategoryMarkup[]>(categories);
    const [saving, setSaving] = useState(false);

    useEffect(() => { setLocalMarkups(categories); }, [categories]);

    const handleSaveMarkups = async () => {
      setSaving(true);
      try {
        const res = await fetch('/api/inventory/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localMarkups.map(c => ({ id: c.id, markupPercent: c.markupPercent }))),
        });
        if (!res.ok) throw new Error('Failed to save');
        toast.success('Category markups updated');
        refetchCategories();
        setShowMarkupSettings(false);

        // Re-apply markups to mapped items
        if (mappedItems.length > 0) {
          const newMap: Record<string, number> = {};
          localMarkups.forEach(c => { newMap[c.name] = c.markupPercent; });
          setMappedItems(prev => prev.map(item => {
            if (!item.matchedProduct) return item;
            const markup = newMap[item.matchedProduct.category] ?? item.markupPercent;
            return {
              ...item,
              markupPercent: markup,
              sellingPrice: Math.round(item.costPrice * (1 + markup / 100) * 100) / 100,
            };
          }));
        }
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <Sheet open={showMarkupSettings} onOpenChange={(o) => { if (!o) setShowMarkupSettings(false); }}>
        <SheetContent className="p-0 gap-0 sm:max-w-md overflow-y-auto">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
            <SheetTitle>Category Markup Settings</SheetTitle>
            <p className="text-xs text-muted-foreground mt-1">Set default markup % for each product category. These apply automatically during restock.</p>
          </SheetHeader>
          <div className="px-5 py-4 flex flex-col gap-2">
            {localMarkups.map((cat, i) => (
              <div key={cat.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    max="200"
                    step="1"
                    value={cat.markupPercent}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setLocalMarkups(prev => { const next = [...prev]; next[i] = { ...next[i], markupPercent: val }; return next; });
                    }}
                    className="w-20 h-8 text-center text-sm font-semibold"
                  />
                  <span className="text-xs text-muted-foreground font-medium">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border">
            <Button onClick={handleSaveMarkups} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Markup Settings'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  // ── Product Search Dropdown ──
  const ProductSearchDropdown = ({ onSelect, exclude }: { onSelect: (id: number) => void; exclude?: number }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
      if (!q) return allProducts.slice(0, 10);
      const s = q.toLowerCase();
      return allProducts.filter(p => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)).slice(0, 10);
    }, [q, allProducts]);

    return (
      <div className="relative">
        <Button type="button" variant="link" size="sm" onClick={() => setOpen(!open)} className="h-auto p-0 text-xs gap-0.5">
          <Search size={10} /> Reassign
        </Button>
        {open && (
          <div className="absolute right-0 top-6 z-50 w-72 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products..."
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(p => (
                <Button
                  key={p.id}
                  type="button"
                  variant="ghost"
                  onClick={() => { onSelect(p.id); setOpen(false); setQ(''); }}
                  className="w-full h-auto px-3 py-2 justify-between rounded-none"
                >
                  <div className="text-left">
                    <p className="text-xs font-medium text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.sku} · {p.category}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{p.stockQty}</Badge>
                </Button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground text-center">No products found</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/inventory')}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Batch Restock</h1>
            <p className="text-xs text-muted-foreground">Import a supplier invoice CSV to restock multiple products at once</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowMarkupSettings(true)}>
          <Settings2 size={14} className="mr-1.5" /> Markup Settings
        </Button>
      </div>

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
              const file = e.dataTransfer.files[0];
              if (file) {
                const input = fileRef.current!;
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }}
            className="border-2 border-dashed border-border rounded-2xl p-16 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Upload size={40} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-base font-semibold text-foreground mb-1">Upload Supplier Invoice CSV</p>
            <p className="text-sm text-muted-foreground mb-4">Drag & drop or click to browse</p>
            <p className="text-[10px] text-muted-foreground">
              CSV should have columns: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">quantity</code>, <code className="bg-muted px-1 rounded">cost</code> (optional: expiry, batch)
            </p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </div>

          <div className="bg-muted/50 rounded-xl p-5 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileSpreadsheet size={16} /> How it works
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Scan the supplier's delivery document and convert it to a CSV file</li>
              <li>Upload the CSV here — the system auto-matches items to your existing products</li>
              <li>Review matches, adjust quantities and pricing, then confirm</li>
              <li>All stock levels and prices are updated atomically in one go</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Step: Mapping / Review ── */}
      {(step === 'mapping' || step === 'review') && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Summary Bar */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-primary" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground"><strong className="text-foreground">{mappedItems.length}</strong> items</span>
                <span className="text-emerald-600"><strong>{matchedCount}</strong> matched</span>
                {unmatchedCount > 0 && <span className="text-amber-600"><strong>{unmatchedCount}</strong> unmatched</span>}
                <span className="text-primary"><strong>{includedItems.length}</strong> to restock</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setCsvRows([]); setMappedItems([]); }}>
                Change file
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={includedItems.length === 0}>
                <Package size={14} className="mr-1.5" /> Confirm Restock ({includedItems.length})
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 h-9 px-3 border border-border rounded-lg bg-background focus-within:border-primary/40 transition-colors flex-1 max-w-xs">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter items..."
                className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground"
              />
              {searchFilter && (
                <Button variant="ghost" size="icon-xs" onClick={() => setSearchFilter('')}>
                  <X size={12} />
                </Button>
              )}
            </div>
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={roundPrices}
                onCheckedChange={(checked) => setRoundPrices(checked === true)}
              />
              Round to nearest ₵0.50
            </Label>
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {(['all', 'matched', 'unmatched'] as const).map(tab => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'all' ? `All (${mappedItems.length})` : tab === 'matched' ? `Matched (${matchedCount})` : `Unmatched (${unmatchedCount})`}
                </Button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredItems.every(i => i.included || !i.matchedProduct)}
                        onCheckedChange={(checked) => {
                          setMappedItems(prev => prev.map(item => {
                            if (!item.matchedProduct) return item;
                            return { ...item, included: checked === true };
                          }));
                        }}
                      />
                    </TableHead>
                    <TableHead>CSV Item</TableHead>
                    <TableHead>Matched Product</TableHead>
                    <TableHead className="text-center w-20">Qty</TableHead>
                    <TableHead className="text-right w-24">Cost (GHS)</TableHead>
                    <TableHead className="text-center w-20">Markup</TableHead>
                    <TableHead className="text-right w-28">Selling (GHS)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, _filteredIdx) => {
                    const realIdx = mappedItems.indexOf(item);
                    const isMatch = item.matchedProduct !== null;
                    return (
                      <TableRow key={realIdx} className={`${!isMatch ? 'bg-amber-50/50 dark:bg-amber-950/10' : item.included ? '' : 'opacity-40'}`}>
                        <TableCell className="px-4 py-3">
                          <Checkbox
                            checked={item.included}
                            disabled={!isMatch}
                            onCheckedChange={() => updateItem(realIdx, { included: !item.included })}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <p className="text-xs font-medium text-foreground">{item.csvRow.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.csvRow.batchNumber && <span className="text-[10px] text-muted-foreground">Batch: {item.csvRow.batchNumber}</span>}
                            {item.csvRow.expiryDate && <span className="text-[10px] text-muted-foreground">Exp: {item.csvRow.expiryDate}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {isMatch ? (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Link2 size={10} className="text-emerald-500" />
                                  <p className="text-xs font-medium text-foreground">{item.matchedProduct!.name}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{item.matchedProduct!.sku}</span>
                                  <span className="text-[10px] text-muted-foreground">Stock: {item.matchedProduct!.stockQty}</span>
                                  {item.matchScore < 1 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{Math.round(item.matchScore * 100)}% match</Badge>
                                  )}
                                </div>
                              </div>
                              <ProductSearchDropdown onSelect={(id) => rematchItem(realIdx, id)} />
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Link2Off size={10} className="text-amber-500" />
                                <span className="text-xs text-amber-600 font-medium">No match found</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={() => handleCreateProduct(realIdx)}
                                  disabled={creatingProductIdx === realIdx}
                                  className="h-auto p-0 text-xs text-emerald-600 gap-0.5"
                                >
                                  {creatingProductIdx === realIdx ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Create New
                                </Button>
                                <ProductSearchDropdown onSelect={(id) => rematchItem(realIdx, id)} />
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min="0"
                            value={item.quantityToAdd}
                            onChange={(e) => updateItem(realIdx, { quantityToAdd: parseInt(e.target.value) || 0 })}
                            className="w-16 h-7 text-center text-xs mx-auto"
                            disabled={!isMatch}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.costPrice}
                            onChange={(e) => {
                              const cost = parseFloat(e.target.value) || 0;
                              updateItem(realIdx, { costPrice: cost });
                            }}
                            className="w-20 h-7 text-right text-xs ml-auto"
                            disabled={!isMatch}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={item.markupPercent}
                              onChange={(e) => {
                                const markup = parseFloat(e.target.value) || 0;
                                updateItem(realIdx, { markupPercent: markup });
                              }}
                              className="w-14 h-7 text-center text-xs"
                              disabled={!isMatch}
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold text-foreground">
                            {isMatch ? `₵ ${item.sellingPrice.toFixed(2)}` : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Footer totals */}
            {includedItems.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">
                  {includedItems.length} items selected for restock
                </span>
                <div className="flex items-center gap-6 text-xs">
                  <span className="text-muted-foreground">
                    Total units: <strong className="text-foreground">{includedItems.reduce((s, i) => s + i.quantityToAdd, 0).toLocaleString()}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Total cost: <strong className="text-foreground">₵ {includedItems.reduce((s, i) => s + i.costPrice * i.quantityToAdd, 0).toFixed(2)}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Total retail: <strong className="text-foreground">₵ {includedItems.reduce((s, i) => s + i.sellingPrice * i.quantityToAdd, 0).toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setCsvRows([]); setMappedItems([]); }}>
              ← Start over
            </Button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-0.5">
                <Button variant={updateAllStock ? 'secondary' : 'ghost'} size="xs" onClick={() => setUpdateAllStock(true)}>
                  Update All Stock
                </Button>
                <Button variant={!updateAllStock ? 'secondary' : 'ghost'} size="xs" onClick={() => setUpdateAllStock(false)}>
                  New Batch Only
                </Button>
              </div>
              <Button onClick={handleSubmit} disabled={includedItems.length === 0} size="lg">
                <Package size={16} className="mr-2" /> Confirm Restock — {includedItems.length} items, {includedItems.reduce((s, i) => s + i.quantityToAdd, 0)} units
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: Processing ── */}
      {step === 'processing' && (
        <div className="text-center py-24 animate-in fade-in duration-300">
          <Loader2 size={48} className="mx-auto text-primary animate-spin mb-6" />
          <p className="text-lg font-semibold text-foreground">Processing restock...</p>
          <p className="text-sm text-muted-foreground mt-2">Updating {includedItems.length} products atomically</p>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === 'done' && result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mb-2">Restock Complete</h2>
            <div className="flex justify-center gap-10 mt-6">
              <div>
                <p className="text-3xl font-bold text-emerald-600">{result.restocked}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Products Restocked</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-600">{result.totalUnitsAdded.toLocaleString()}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Total Units Added</p>
              </div>
            </div>
          </div>

          {/* Result breakdown */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-xs font-bold text-card-foreground">Restock Summary</h3>
            </div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {result.items.map((item, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.oldQty} → <strong className="text-foreground">{item.newQty}</strong>{' '}
                    <span className="text-emerald-600">(+{item.delta})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push('/inventory')}>
              Go to Inventory
            </Button>
            <Button variant="outline" onClick={() => { setStep('upload'); setCsvRows([]); setMappedItems([]); setResult(null); }}>
              Restock More
            </Button>
          </div>
        </div>
      )}

      {/* Markup Settings Sheet */}
      <MarkupSettingsSheet />

      {/* Sticky Markup Confirmation Dialog */}
      {showStickyMarkupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-sm font-bold text-foreground mb-3">Save Markup Changes as Defaults?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              You changed the markup for the following items. Would you like to save these as the new category defaults?
            </p>
            <div className="space-y-2 mb-5 max-h-40 overflow-y-auto">
              {changedMarkupItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="text-foreground font-medium">{item.productName}</span>
                  <span className="text-muted-foreground">
                    Save <strong className="text-foreground">{item.markupPercent}%</strong> as default for <strong className="text-foreground">{item.category}</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowStickyMarkupDialog(false); setChangedMarkupItems([]); }}>
                Skip
              </Button>
              <Button size="sm" onClick={handleSaveStickyMarkup}>
                Save as Defaults
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
