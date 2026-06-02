/**
 * Phase 3A — sale_payments backfill (Blueprint v1.1 §6.3, §7.4).
 *
 * Creates one SalePayment per existing sale from its legacy `paymentType`, so
 * payment-method reporting/EOD works for historical data. Idempotent — skips
 * sales that already have payment rows. `paymentType` stays for compatibility.
 *
 * Legacy "Split" sales have no stored breakdown, so the full amount is recorded
 * as cash with a "legacy-split" reference (best-effort for historical rows).
 *
 * Run:  npx tsx scripts/migrate-sale-payments.ts
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const METHOD: Record<string, string> = {
  cash: 'cash',
  momo: 'mobile_money',
  'mobile money': 'mobile_money',
  mobilemoney: 'mobile_money',
  card: 'card',
  credit: 'credit',
};

function mapMethod(paymentType: string | null): { method: string; reference: string | null } {
  const key = (paymentType ?? 'cash').toLowerCase().trim();
  if (key === 'split') return { method: 'cash', reference: 'legacy-split' };
  return { method: METHOD[key] ?? 'cash', reference: null };
}

async function main() {
  console.log('🔁 Phase 3A — sale_payments backfill\n');

  const sales = await prisma.sale.findMany({
    select: { id: true, tenantId: true, branchId: true, totalAmount: true, paymentType: true, createdAt: true },
  });

  const backupDir = join(process.cwd(), 'scripts', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(backupDir, `sale-payments-${stamp}.json`), JSON.stringify({ saleCount: sales.length }, null, 2));

  let created = 0, skipped = 0;
  for (const sale of sales) {
    if (!sale.tenantId) { skipped++; continue; }
    const existing = await prisma.salePayment.count({ where: { saleId: sale.id } });
    if (existing > 0) { skipped++; continue; }

    const { method, reference } = mapMethod(sale.paymentType);
    await prisma.salePayment.create({
      data: {
        saleId: sale.id,
        tenantId: sale.tenantId,
        branchId: sale.branchId,
        paymentMethod: method,
        amount: sale.totalAmount,
        reference,
        createdAt: sale.createdAt,
      },
    });
    created++;
  }

  console.log(`✅ Backfill complete — ${created} payments created, ${skipped} skipped.\n`);
}

main().catch((e) => { console.error('❌ Backfill failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
