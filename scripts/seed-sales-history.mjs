// Generate ~12 months of realistic sales history for the demo tenant so the
// dashboard/reports look like a pharmacy that's been running for a year.
// Idempotent: tags rows with clientToken 'hist-*' and refuses to double-seed.
//
// Usage: node scripts/seed-sales-history.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmqdjlmx300266vboek63lw7n';
const BRANCH_ID = 'cmqdjlmy900286vbo395alywb';
const SELLERS = [2, 3, 4]; // manager, mca, nes
const PAY = [
  { type: 'Cash',  method: 'cash',          weight: 60 },
  { type: 'MoMo',  method: 'mobile_money',  weight: 30 },
  { type: 'Split', method: 'card',          weight: 10 },
];

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function weightedPay() {
  const total = PAY.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PAY) { if ((r -= p.weight) <= 0) return p; }
  return PAY[0];
}

async function main() {
  const existing = await prisma.sale.count({ where: { tenantId: TENANT_ID, clientToken: { startsWith: 'hist-' } } });
  if (existing > 0) {
    console.log(`Already seeded (${existing} hist- sales found). Aborting to avoid duplicates.`);
    console.log('To re-seed, delete the existing hist- sales first.');
    return;
  }

  const products = await prisma.product.findMany({
    where: { tenantId: TENANT_ID, isActive: true, price: { gt: 0 } },
    select: { id: true, price: true },
  });
  if (products.length === 0) { console.log('No products to sell.'); return; }
  console.log(`Using ${products.length} products.`);

  // A handful of repeat customers (the rest are walk-ins).
  const customerNames = ['Ama Mensah','Kwame Asante','Akua Boateng','Yaw Owusu','Esi Darko',
    'Kofi Adjei','Abena Sarpong','Kojo Annan','Adwoa Frimpong','Nana Acheampong'];
  const customers = [];
  for (let i = 0; i < customerNames.length; i++) {
    const phone = `02${randInt(40, 59)}${randInt(100000, 999999)}`;
    const c = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: TENANT_ID, phone } },
      update: {},
      create: { name: customerNames[i], phone, tenantId: TENANT_ID, loyaltyPoints: randInt(0, 250) },
    });
    customers.push(c.id);
  }

  // Build sale payloads across the past 365 days with a growth trend.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const payloads = [];
  for (let d = 365; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const progress = (365 - d) / 365;                 // 0 (oldest) → 1 (newest)
    const base = 3 + progress * 10;                    // grows 3 → 13 sales/day
    const weekend = [0, 6].includes(day.getDay()) ? 0.6 : 1;
    const count = Math.max(0, Math.round((base + rand(-2, 2)) * weekend));

    for (let s = 0; s < count; s++) {
      const when = new Date(day);
      when.setHours(randInt(8, 19), randInt(0, 59), randInt(0, 59), 0);

      const lineCount = randInt(1, 5);
      const chosen = new Set();
      const items = [];
      let subtotal = 0;
      for (let l = 0; l < lineCount; l++) {
        const p = pick(products);
        if (chosen.has(p.id)) continue;
        chosen.add(p.id);
        const qty = randInt(1, 3);
        items.push({ productId: p.id, quantity: qty, price: p.price });
        subtotal += p.price * qty;
      }
      if (items.length === 0) continue;

      const discount = Math.random() < 0.12 ? Math.round(subtotal * rand(0.05, 0.15) * 100) / 100 : 0;
      const total = Math.round((subtotal - discount) * 100) / 100;
      const pay = weightedPay();
      const customerId = Math.random() < 0.3 ? pick(customers) : null;

      payloads.push({ when, items, discount, total, pay, customerId });
    }
  }

  console.log(`Creating ${payloads.length} sales…`);
  let done = 0;
  const CHUNK = 25;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    await Promise.all(slice.map((s, j) =>
      prisma.sale.create({
        data: {
          totalAmount: s.total,
          discount: s.discount,
          paymentType: s.pay.type,
          status: 'Completed',
          sellerId: pick(SELLERS),
          customerId: s.customerId,
          tenantId: TENANT_ID,
          branchId: BRANCH_ID,
          createdAt: s.when,
          clientToken: `hist-${i + j}-${s.when.getTime()}`,
          items: { create: s.items },
          payments: {
            create: {
              tenantId: TENANT_ID,
              branchId: BRANCH_ID,
              paymentMethod: s.pay.method,
              amount: s.total,
              createdAt: s.when,
            },
          },
        },
      })
    ));
    done += slice.length;
    if (done % 250 < CHUNK) process.stdout.write(`\r  ${done}/${payloads.length}`);
  }
  console.log(`\nDone. Created ${payloads.length} sales over the last year.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
