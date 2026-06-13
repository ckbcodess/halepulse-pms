import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { logAction } from '@/lib/audit/logAction';

interface RowError { row: number; field: string; message: string }

// Minimal CSV parser supporting quoted fields.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row); }
  return rows;
}

// Build a normalised key→index map from header row
function buildColMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    map[key] = i;
  });
  return map;
}

// Pull a cell value trying multiple possible key variants
function colVal(row: string[], map: Record<string, number>, ...keys: string[]): string {
  for (const k of keys) {
    const idx = map[k];
    if (idx !== undefined && row[idx] !== undefined) return (row[idx] ?? '').trim();
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const isManager = ctx.role === 'MANAGER' || ctx.role === 'SUPER_ADMIN' || ctx.role === 'tenant_admin' || ctx.role === 'branch_manager' || ctx.role === 'PHARMACIST' || ctx.role === 'pharmacist';
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Strip UTF-8 BOM if present
    let text = await file.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const rows = parseCsv(text);
    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 });
    }

    // Build flexible column map — supports:
    //   Template format: Product Name | Category | Cost Price | Selling Price | Quantity | Expiry Date (YYYY-MM-DD) | Reorder Level
    //   Legacy format:   name | price | costPrice | stockQty | expiryDate | barcode | category
    const colMap = buildColMap(rows[0]);
    const dataRows = rows.slice(1);
    const errors: RowError[] = [];
    let imported = 0, skipped = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNum = i + 2; // human-friendly (header = row 1)

      const name      = colVal(r, colMap, 'productname', 'name');
      const category  = colVal(r, colMap, 'category') || 'Uncategorized';
      const costRaw   = colVal(r, colMap, 'costprice');
      const sellRaw   = colVal(r, colMap, 'sellingprice', 'price');
      const qtyRaw    = colVal(r, colMap, 'quantity', 'stockqty', 'qty');
      const expiryRaw = colVal(r, colMap, 'expirydateyyyymmdd', 'expirydate', 'expiry');
      const reorderRaw = colVal(r, colMap, 'reorderlevel', 'reorder');

      if (!name) { errors.push({ row: rowNum, field: 'Product Name', message: 'Required' }); skipped++; continue; }

      const costPrice   = costRaw === '' ? 0 : Number(costRaw);
      const sellingPrice = Number(sellRaw);
      if (!Number.isFinite(costPrice) || costPrice < 0) { errors.push({ row: rowNum, field: 'Cost Price', message: 'Must be a number' }); skipped++; continue; }
      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) { errors.push({ row: rowNum, field: 'Selling Price', message: 'Must be a number' }); skipped++; continue; }

      const quantity = qtyRaw === '' ? 0 : Number(qtyRaw);
      if (!Number.isFinite(quantity) || quantity < 0) { errors.push({ row: rowNum, field: 'Quantity', message: 'Must be >= 0' }); skipped++; continue; }

      let expiryDate: Date | null = null;
      if (expiryRaw) {
        const d = new Date(expiryRaw);
        if (isNaN(d.getTime())) { errors.push({ row: rowNum, field: 'Expiry Date', message: 'Invalid date' }); skipped++; continue; }
        expiryDate = d;
      }

      const reorder = reorderRaw === '' ? 10 : Number(reorderRaw);
      const lowStockThreshold = Number.isFinite(reorder) && reorder >= 0 ? Math.floor(reorder) : 10;
      const markupPercent = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;

      const existing = await prisma.product.findFirst({ where: { name, tenantId: ctx.tenantId } });
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { category, costPrice, price: sellingPrice, markupPercent, stockQty: Math.floor(quantity), lowStockThreshold, expiryDate, isActive: true },
        });
      } else {
        await prisma.product.create({
          data: { name, category, costPrice, price: sellingPrice, markupPercent, stockQty: Math.floor(quantity), lowStockThreshold, expiryDate, tenantId: ctx.tenantId },
        });
      }
      imported++;
    }

    await logAction(ctx.userId, ctx.tenantId, 'PRODUCTS_IMPORTED', { imported, skipped, fileName: file.name });
    return NextResponse.json({ imported, skipped, errors });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error('Import error:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
