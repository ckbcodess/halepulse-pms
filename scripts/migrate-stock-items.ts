/**
 * Phase 2A — Batch inventory backfill (Blueprint v1.1 §7.3).
 *
 * Establishes the batch ledger ALONGSIDE the existing Product.stockQty model
 * (which remains the working source of truth until later sub-phases cut over).
 * Non-breaking and idempotent.
 *
 * For each tenant:
 *   - Resolves the HQ branch and a performing user (tenant_admin, else any user).
 *   - For every active product with stockQty > 0 that has no stock_item yet,
 *     creates one opening StockItem at HQ (qty/cost/markup/selling/expiry copied
 *     from the product) plus an immutable StockMovement (type "import").
 *
 * Snapshots to scripts/backups/ before writing.
 *
 * Run:  npx tsx scripts/migrate-stock-items.ts
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔁 Phase 2A — Batch inventory backfill\n');

  const productsBefore = await prisma.product.findMany({
    select: { id: true, tenantId: true, stockQty: true, costPrice: true, markupPercent: true, price: true, expiryDate: true, isActive: true },
  });
  const existingStockItems = await prisma.stockItem.count();

  const backupDir = join(process.cwd(), 'scripts', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(backupDir, `stock-items-${stamp}.json`), JSON.stringify({ productsBefore, existingStockItems }, null, 2));
  console.log(`  📦 Backup written (${productsBefore.length} products, ${existingStockItems} existing stock_items)\n`);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  let created = 0, skipped = 0;

  for (const tenant of tenants) {
    const hq = await prisma.branch.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { isHeadquarters: 'desc' },
      select: { id: true, name: true },
    });
    if (!hq) { console.log(`  ⚠ "${tenant.name}": no branch — skipped`); continue; }

    // Performing user: prefer a tenant_admin, else any user in the tenant.
    const performer =
      (await prisma.user.findFirst({ where: { tenantId: tenant.id, dynamicRole: { slug: 'tenant_admin' } }, select: { id: true } })) ??
      (await prisma.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }));
    if (!performer) { console.log(`  ⚠ "${tenant.name}": no user to attribute movements — skipped`); continue; }

    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id, isActive: true, stockQty: { gt: 0 } },
      select: { id: true, stockQty: true, costPrice: true, markupPercent: true, price: true, expiryDate: true },
    });

    let tenantCreated = 0;
    for (const p of products) {
      const already = await prisma.stockItem.findFirst({ where: { productId: p.id }, select: { id: true } });
      if (already) { skipped++; continue; }

      await prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.create({
          data: {
            tenantId: tenant.id,
            branchId: hq.id,
            productId: p.id,
            quantity: p.stockQty,
            costPrice: p.costPrice ?? 0,
            markupPercent: p.markupPercent,
            sellingPrice: p.price,
            expiryDate: p.expiryDate,
            priceOverridden: false,
          },
        });
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            branchId: hq.id,
            stockItemId: item.id,
            movementType: 'import',
            quantityChange: p.stockQty,
            quantityBefore: 0,
            quantityAfter: p.stockQty,
            reason: 'Opening balance (Phase 2 migration)',
            performedBy: performer.id,
          },
        });
      });
      tenantCreated++; created++;
    }
    console.log(`  ✓ "${tenant.name}" @ ${hq.name}: ${tenantCreated} opening stock_items created`);
  }

  console.log(`\n✅ Backfill complete — ${created} stock_items created, ${skipped} skipped (already had batches).\n`);
}

main().catch((e) => { console.error('❌ Backfill failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
