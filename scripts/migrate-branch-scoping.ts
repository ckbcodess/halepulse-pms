/**
 * Phase 1B — Branch scoping backfill (Blueprint v1.1 §4.3).
 *
 * Idempotent. For every tenant:
 *   1. Ensures exactly one HQ branch (creates "Main Branch" if the tenant has none;
 *      promotes the sole/first existing branch to HQ otherwise).
 *   2. Backfills Sale.branchId and StockAdjustment.branchId (where null) to the HQ
 *      branch — existing records predate branch scoping, so HQ is the safe default.
 *   3. Assigns operational users (branch_manager / pharmacist / cashier, i.e.
 *      dynamic-role level >= 2) who have no branch to the HQ branch. Tenant admins
 *      (L1) and super admins (L0) stay branch-less (multi-branch / platform scope).
 *
 * Snapshots affected rows to scripts/backups/ before mutating.
 *
 * Run:  npx tsx scripts/migrate-branch-scoping.ts
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔁 Phase 1B — Branch scoping backfill\n');

  // ── Snapshot ────────────────────────────────────────────────────────────────
  const [salesBefore, adjBefore, branchesBefore, usersBefore] = await Promise.all([
    prisma.sale.findMany({ select: { id: true, tenantId: true, branchId: true } }),
    prisma.stockAdjustment.findMany({ select: { id: true, tenantId: true, branchId: true } }),
    prisma.branch.findMany(),
    prisma.user.findMany({
      select: { id: true, email: true, tenantId: true, branchId: true, dynamicRole: { select: { level: true } } },
    }),
  ]);
  const backupDir = join(process.cwd(), 'scripts', 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `branch-scoping-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ salesBefore, adjBefore, branchesBefore, usersBefore }, null, 2));
  console.log(`  📦 Backup written: ${backupPath}\n`);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

  for (const tenant of tenants) {
    // ── 1. Ensure an HQ branch ────────────────────────────────────────────────
    const branches = await prisma.branch.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } });
    let hq = branches.find((b) => b.isHeadquarters);

    if (!hq) {
      if (branches.length > 0) {
        hq = await prisma.branch.update({ where: { id: branches[0].id }, data: { isHeadquarters: true } });
        console.log(`  ✓ "${tenant.name}": promoted "${hq.name}" to HQ`);
      } else {
        hq = await prisma.branch.create({
          data: { tenantId: tenant.id, name: 'Main Branch', isHeadquarters: true, isActive: true },
        });
        console.log(`  ✓ "${tenant.name}": created HQ branch "${hq.name}"`);
      }
    } else {
      console.log(`  • "${tenant.name}": HQ is "${hq.name}"`);
    }

    // Guard against multiple HQ flags (keep the chosen one as the only HQ).
    await prisma.branch.updateMany({
      where: { tenantId: tenant.id, isHeadquarters: true, id: { not: hq.id } },
      data: { isHeadquarters: false },
    });

    // ── 2. Backfill sales + adjustments ───────────────────────────────────────
    const salesUpdated = await prisma.sale.updateMany({
      where: { tenantId: tenant.id, branchId: null },
      data: { branchId: hq.id },
    });
    const adjUpdated = await prisma.stockAdjustment.updateMany({
      where: { tenantId: tenant.id, branchId: null },
      data: { branchId: hq.id },
    });
    console.log(`     sales backfilled: ${salesUpdated.count}, adjustments backfilled: ${adjUpdated.count}`);

    // ── 3. Assign branch-less operational users to HQ ─────────────────────────
    const opUsers = usersBefore.filter(
      (u) => u.tenantId === tenant.id && !u.branchId && (u.dynamicRole?.level ?? 99) >= 2,
    );
    for (const u of opUsers) {
      await prisma.user.update({ where: { id: u.id }, data: { branchId: hq.id } });
      console.log(`     • assigned ${u.email} → ${hq.name}`);
    }
  }

  console.log('\n✅ Branch scoping backfill complete.\n');
}

main().catch((e) => { console.error('❌ Backfill failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
