'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { bulkImportProducts, type ImportRow } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';

type Step = 'upload' | 'preview' | 'importing' | 'done';

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
  total: number;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
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

function mapToImportRow(raw: Record<string, string>): ImportRow {
  return {
    name:       raw['name'] || raw['item_name'] || raw['product'] || raw['drug'] || '',
    price:      parseFloat(raw['price'] || raw['rate_a'] || raw['selling_price'] || '0') || 0,
    costPrice:  parseFloat(raw['costprice'] || raw['cost_price'] || raw['prate'] || raw['cost'] || '0') || 0,
    stockQty:   parseInt(raw['stockqty'] || raw['stock'] || raw['quantity'] || raw['qty'] || '0') || 0,
    expiryDate: raw['expirydate'] || raw['expiry'] || raw['expiry_date'] || '',
    barcode:    raw['barcode'] || raw['code'] || '',
    category:   raw['category'] || raw['group'] || 'General',
  };
}

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const raw = parseCSV(text);
      const mapped = raw.map(mapToImportRow).filter(r => r.name.trim().length > 0);
      if (mapped.length === 0) {
        toast.error('No valid products found in the CSV');
        return;
      }
      setRows(mapped);
      setStep('preview');
      toast.success(`Found ${mapped.length} products`);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const res = await bulkImportProducts(rows);
      setResult(res);
      setStep('done');
      if (res.created > 0) toast.success(`${res.created} products imported!`);
      if (res.skipped > 0) toast.info(`${res.skipped} duplicates skipped`);
      if (res.errors.length > 0) toast.warning(`${res.errors.length} errors`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
      setStep('preview');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.push('/inventory')}>
          <ArrowLeft size={18} />
        </Button>
        <p className="text-sm text-muted-foreground">Upload a CSV file to bulk-add products to your inventory</p>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Upload size={40} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">Click to upload CSV</p>
            <p className="text-sm text-muted-foreground">or drag and drop your file here</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </div>

          {/* Expected format */}
          <div className="bg-muted dark:bg-sidebar rounded-xl p-6 border border-border dark:border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileSpreadsheet size={16} /> Expected CSV Format
            </h3>
            <code className="text-xs text-muted-foreground block bg-background p-3 rounded-lg border border-border overflow-x-auto">
              name,price,costPrice,stockQty,expiryDate,barcode,category
            </code>
            <p className="text-xs text-muted-foreground mt-3">
              Only <strong>name</strong> is required. All other columns are optional. The importer also recognizes
              alternate column names like <code className="bg-muted px-1 rounded">ITEM_NAME</code>, <code className="bg-muted px-1 rounded">RATE_A</code>, <code className="bg-muted px-1 rounded">PRATE</code>, <code className="bg-muted px-1 rounded">STOCK</code>.
            </p>
            <a href="/import-template.csv" download className="inline-flex items-center gap-2 text-xs text-primary dark:text-primary/80 font-medium mt-3 hover:underline">
              <Download size={14} /> Download your pre-formatted import file (1,896 products)
            </a>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">{rows.length} products ready to import</p>
              </div>
            </div>
            <Button variant="link" size="sm" onClick={() => { setStep('upload'); setRows([]); }}>
              Change file
            </Button>
          </div>

          {/* Preview table */}
          <div className="border border-border dark:border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.stockQty}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 100 && (
              <div className="bg-muted dark:bg-sidebar px-4 py-2 text-xs text-muted-foreground text-center border-t border-border dark:border-border">
                Showing first 100 of {rows.length} products
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>
              Cancel
            </Button>
            <Button onClick={handleImport}>
              Import {rows.length} Products
            </Button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <p className="text-lg font-medium text-foreground">Importing {rows.length} products...</p>
          <p className="text-sm text-muted-foreground mt-2">This may take a minute for large files</p>
        </div>
      )}

      {/* Done Step */}
      {step === 'done' && result && (
        <div className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-6 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200 mb-1">Import Complete</h3>
            <div className="flex justify-center gap-8 mt-4 text-sm">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                <p className="text-emerald-700 dark:text-emerald-300">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                <p className="text-amber-700 dark:text-amber-300">Skipped (duplicates)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                <p className="text-red-700 dark:text-red-300">Errors</p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} /> Errors (first 20)
              </h4>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push('/inventory')}>
              Go to Inventory
            </Button>
            <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); setResult(null); }}>
              Import More
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
