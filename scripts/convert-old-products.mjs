// Convert the old XAMPP `stockingtb` dump into the product-import template CSV.
// Usage: node scripts/convert-old-products.mjs <path-to-POS.sql> <out.csv>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , sqlPath, outPath] = process.argv;
if (!sqlPath || !outPath) {
  console.error('Usage: node convert-old-products.mjs <POS.sql> <out.csv>');
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');

// Column order in the dump's INSERT statement:
// (category, name, uprice, fprice, qty_in_box, no_pieces, total_in_pieces,
//  qty_left_in_pieces, idate, id, edate, prate, grp, updated_at, barcode)
const COL = { category:0, name:1, uprice:2, qtyLeft:7, edate:10, prate:11, grp:12 };

// Parse one SQL tuple "(...)" into an array of JS values, honoring '' escapes.
function parseTuple(s) {
  const out = []; let cur = ''; let inStr = false; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      if (c === "'") {
        if (s[i + 1] === "'") { cur += "'"; i += 2; continue; }
        inStr = false; i++; continue;
      }
      if (c === '\\') { cur += s[i + 1]; i += 2; continue; }
      cur += c; i++; continue;
    }
    if (c === "'") { inStr = true; i++; continue; }
    if (c === ',') { out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c; i++;
  }
  out.push(cur.trim());
  return out.map((v) => (v === 'NULL' ? '' : v));
}

// Grab every "(...)" tuple that follows an INSERT INTO `stockingtb` ... VALUES block.
const tuples = [];
const insertRe = /INSERT INTO `stockingtb`[^;]*?VALUES\s*([\s\S]*?);/gi;
let m;
while ((m = insertRe.exec(sql)) !== null) {
  const body = m[1];
  // Split top-level tuples: find balanced (...) honoring quotes.
  let depth = 0, inStr = false, start = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (c === "'" && body[i - 1] !== '\\') {
        if (body[i + 1] === "'") { i++; continue; }
        inStr = false;
      }
      continue;
    }
    if (c === "'") { inStr = true; continue; }
    if (c === '(') { if (depth === 0) start = i + 1; depth++; }
    else if (c === ')') { depth--; if (depth === 0) tuples.push(body.slice(start, i)); }
  }
}

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = ['Product Name', 'Category', 'Cost Price', 'Selling Price', 'Quantity', 'Expiry Date (YYYY-MM-DD)', 'Reorder Level'];
const lines = [header.join(',')];
let kept = 0, skippedNoName = 0;

for (const t of tuples) {
  const f = parseTuple(t);
  const name = (f[COL.name] || '').replace(/\s+/g, ' ').trim();
  if (!name) { skippedNoName++; continue; }

  const grp = (f[COL.grp] || '').trim();
  const category = grp || 'Uncategorized';

  const prate = parseFloat(f[COL.prate]);
  const cost = Number.isFinite(prate) && prate > 0 ? prate.toFixed(2) : '';

  const uprice = parseFloat(f[COL.uprice]);
  const sell = Number.isFinite(uprice) ? uprice.toFixed(2) : '0';

  let qty = parseInt(f[COL.qtyLeft], 10);
  if (!Number.isFinite(qty) || qty < 0) qty = 0;

  const edate = (f[COL.edate] || '').trim();
  const expiry = (!edate || edate.startsWith('0000') || edate === '0') ? '' : edate;

  lines.push([name, category, cost, sell, qty, expiry, ''].map(csvEscape).join(','));
  kept++;
}

writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Parsed tuples: ${tuples.length}`);
console.log(`Products written: ${kept}`);
console.log(`Skipped (no name): ${skippedNoName}`);
