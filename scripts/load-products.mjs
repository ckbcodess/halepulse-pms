// Load the converted product CSV into the local DB, scoped to a tenant.
// Mirrors the app's /api/import/products mapping (markup calc, defaults, upsert by name).
// Usage: node scripts/load-products.mjs <csv> <tenantId>
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const [, , csvPath, tenantId] = process.argv;
if (!csvPath || !tenantId) {
  console.error('Usage: node scripts/load-products.mjs <csv> <tenantId>');
  process.exit(1);
}
const prisma = new PrismaClient();

// Same quoted-CSV parser the importer uses.
function parseCsv(text) {
  const rows = []; let field = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
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

let text = readFileSync(csvPath, 'utf8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const rows = parseCsv(text);
const [header, ...dataRows] = rows;
const idx = (name) => header.findIndex((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === name);
const iName = idx('productname'), iCat = idx('category'), iCost = idx('costprice'),
      iSell = idx('sellingprice'), iQty = idx('quantity'), iExp = idx('expirydateyyyymmdd');

let imported = 0, updated = 0, skipped = 0;
for (const r of dataRows) {
  const name = (r[iName] || '').trim();
  if (!name) { skipped++; continue; }
  const category = (r[iCat] || '').trim() || 'Uncategorized';
  const costPrice = r[iCost] === '' ? 0 : Number(r[iCost]);
  const sellingPrice = Number(r[iSell]);
  if (!Number.isFinite(costPrice) || !Number.isFinite(sellingPrice)) { skipped++; continue; }
  let quantity = r[iQty] === '' ? 0 : Number(r[iQty]);
  if (!Number.isFinite(quantity) || quantity < 0) quantity = 0;
  let expiryDate = null;
  if (r[iExp]) { const d = new Date(r[iExp]); if (!isNaN(d.getTime())) expiryDate = d; }
  const markupPercent = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;

  const existing = await prisma.product.findFirst({ where: { name, tenantId } });
  if (existing) {
    await prisma.product.update({ where: { id: existing.id }, data: {
      category, costPrice, price: sellingPrice, markupPercent,
      stockQty: Math.floor(quantity), expiryDate, isActive: true } });
    updated++;
  } else {
    await prisma.product.create({ data: {
      name, category, costPrice, price: sellingPrice, markupPercent,
      stockQty: Math.floor(quantity), lowStockThreshold: 10, expiryDate, tenantId } });
    imported++;
  }
}
console.log(`Created: ${imported}  Updated: ${updated}  Skipped: ${skipped}`);
await prisma.$disconnect();
