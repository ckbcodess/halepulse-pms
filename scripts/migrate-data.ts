import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const prisma = new PrismaClient();

async function main() {
  const sqlFilePath = path.join(__dirname, '..', '..', 'additionaal files i found', 'pos.sql');
  const fileStream = fs.createReadStream(sqlFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Starting migration...');

  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customer.deleteMany({});

  let currentTable = '';
  let productCount = 0;
  let userCount = 0;
  let customerCount = 0;

  const parseRow = (row: string) => {
    const regex = /'((?:[^'\\]|\\.)*)'|(-?\d+(\.\d+)?)|NULL/g;
    const matches = row.matchAll(regex);
    const vals: string[] = [];
    for (const match of matches) {
      if (match[1] !== undefined) {
        vals.push(match[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));
      } else if (match[2] !== undefined) {
        vals.push(match[2]);
      } else {
        vals.push('');
      }
    }
    return vals;
  };

  for await (const line of rl) {
    if (line.includes('INSERT INTO `usertb`')) {
      currentTable = 'usertb';
    } else if (line.includes('INSERT INTO `stockingtb`')) {
      currentTable = 'stockingtb';
    } else if (line.includes('INSERT INTO `cashsale`')) {
      currentTable = 'cashsale';
    }

    if (currentTable && (line.trim().startsWith('(') || line.includes('VALUES ('))) {
      const valuePart = line.includes('VALUES (') ? line.split('VALUES (')[1] : line.trim();
      const rows = valuePart.split(/\),\s*\(/);
      
      for (let row of rows) {
        row = row.replace(/^\(|\);?$|\)$/g, '');
        const vals = parseRow(row);

        if (currentTable === 'usertb' && vals.length >= 4) {
          try {
            await prisma.user.upsert({
              where: { username: vals[0] },
              update: {},
              create: { username: vals[0], role: vals[1], contact: vals[2], password: vals[3] },
            });
            userCount++;
          } catch (e) {}
        } else if (currentTable === 'stockingtb' && vals.length >= 10) {
          try {
            await prisma.product.create({
              data: {
                name: vals[1].toUpperCase(),
                category: vals[0],
                price: parseFloat(vals[3]) || 0,
                costPrice: parseFloat(vals[11]) || 0,
                stockQty: parseInt(vals[7]) || 0,
                expiryDate: (vals[10] === '0000-00-00' || !vals[10]) ? null : new Date(vals[10]),
                description: vals[12],
              }
            });
            productCount++;
          } catch (e) {}
        } else if (currentTable === 'cashsale' && vals.length >= 3) {
          // cashsale columns: [id, customer, mobile, ...]
          const customerName = vals[1];
          const mobile = vals[2];
          if (customerName && customerName !== 'Walking Customer' && customerName !== 'NULL') {
            try {
                // Use compound unique key (tenantId_phone) now that phone is per-tenant unique
                // Legacy migration data has no tenantId, so we upsert by id fallback via findFirst
                const existing = mobile ? await prisma.customer.findFirst({ where: { phone: mobile, tenantId: null } }) : null;
                if (existing) {
                    // Already exists — skip
                } else {
                    await prisma.customer.create({ data: { name: customerName, phone: mobile || null } });
                }
                customerCount++;
            } catch (e) {}
          }
        }
      }
    }
  }

  console.log(`Migration complete: ${userCount} users, ${productCount} products, ${customerCount} customers.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
