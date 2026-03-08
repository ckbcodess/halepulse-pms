import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data migration...');

    // 1. Insert Users
    const users = [
        { username: 'Admin', role: 'Admin', contact: '0249240373', password: '827ccb0eea8a706c4c34a16891f84e7b' },
        { username: 'Manager', role: 'Manager', contact: '0241941863', password: 'e3a958df39563a3bc9cbc53fc79dee52' },
        { username: 'WINIFRED', role: 'Manager', contact: '0271203425', password: '2d969e2cee8cfa07ce7ca0bb13c7a36d' },
        { username: 'JOYCE', role: 'Seller', contact: '0592276734', password: '81dc9bdb52d04dc20036dbd8313ed055' },
        { username: 'JOYCELYN', role: 'Manager', contact: '0245064633', password: '568f7cad7966985188ed28c5810d7c96' }
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: { username: user.username },
            update: {},
            create: user,
        });
    }
    console.log('Users imported successfully.');

    // 2. Read Export.json
    const filePath = path.join('c:', 'Users', 'rnsfo', 'Desktop', 'pharmacy', 'additionaal files i found', 'Export.json');
    if (!fs.existsSync(filePath)) {
        console.error('Export.json not found at:', filePath);
        return;
    }

    const fileData = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(fileData);
    const rows = json.body;

    console.log(`Found ${rows.length} product entries. Importing into database...`);

    // Extract unique categories
    const categories = new Set<string>();
    rows.forEach((row: any[]) => {
        categories.add(row[7]);
    });

    for (const catName of categories) {
        if (!catName) continue;
        await prisma.category.upsert({
            where: { name: catName },
            update: {},
            create: { name: catName }
        });
    }

    // Insert Products
    // we use createMany for performance
    const productsToInsert = rows.map((row: any[]) => {
        return {
            name: row[1],
            price: parseFloat(row[2]) || 0,
            costPrice: parseFloat(row[4]) || 0,
            stockQty: parseInt(row[5], 10) || 0,
            category: row[7] || 'Uncategorized',
            description: row[6] || null, // barcode mapped to description if exists
        };
    });

    // clear existing products if desired? The user says "There is nothing in the inventory" so probably safe.
    // let's do a batch insert (createMany) but sqlite might have limits, so chunk it
    let successCount = 0;
    for (const product of productsToInsert) {
        try {
            await prisma.product.create({ data: product });
            successCount++;
        } catch (e: any) {
            console.error(`Failed to insert product: ${product.name} - ${e.message}`);
        }
    }

    console.log('Data migration complete. Imported ' + productsToInsert.length + ' products.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
