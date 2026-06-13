'use server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { resolveBranchId } from '@/lib/auth/branchContext';
import { deductStockFifo } from '@/lib/inventory/fifo';
import { roundMoney, sumMoney } from '@/lib/money';
import {
  updateProductSchema, addStockSchema,
  createCustomerSchema,
} from '@/lib/validation/schemas';

// ── Timezone-safe expiry check ────────────────────────────────────────────────
// Compares against start-of-today (UTC midnight) so a product expiring "today"
// is NOT flagged as expired mid-day, regardless of server timezone.
function isExpired(expiryDate: Date): boolean {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return expiryDate < startOfToday;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(search?: string) {
  const { tenantId } = await getTenantContext();

  return prisma.product.findMany({
    where: {
      tenantId,
      ...(search
        ? { name: { contains: search.toUpperCase() } }
        : { saleItems: { some: {} } }),
    },
    take:    search ? 50 : 20,
    orderBy: [{ saleItems: { _count: 'desc' } }, { name: 'asc' }],
  });
}

export async function updateProduct(id: number, data: { price: number; stockQty: number }) {
  const { tenantId, userId } = await getTenantContext();
  const parsed = updateProductSchema.parse({ id, ...data });

  const current = await prisma.product.findFirst({
    where: { id: parsed.id, tenantId },
    select: { price: true, stockQty: true, name: true },
  });

  const updated = await prisma.product.update({
    where: { id: parsed.id, tenantId },
    data: { price: parsed.price, stockQty: parsed.stockQty },
  });

  if (current) {
    await prisma.inventoryAuditLog.create({
      data: {
        actionType: current.price !== parsed.price ? 'PRICE_UPDATED' : 'PRODUCT_UPDATED',
        productId: parsed.id,
        performedBy: parseInt(userId, 10),
        oldValue: { price: current.price, stockQty: current.stockQty },
        newValue: { price: parsed.price, stockQty: parsed.stockQty },
        notes: `Quick edit on ${current.name}`,
        tenantId,
      },
    }).catch(() => {});
  }

  return updated;
}

export async function addStock(id: number, quantity: number) {
  const { tenantId, userId } = await getTenantContext();
  const parsed = addStockSchema.parse({ id, quantity });

  const current = await prisma.product.findFirst({
    where: { id: parsed.id, tenantId },
    select: { stockQty: true, name: true },
  });

  const updated = await prisma.product.update({
    where: { id: parsed.id, tenantId },
    data:  { stockQty: { increment: parsed.quantity } },
  });

  if (current) {
    await prisma.inventoryAuditLog.create({
      data: {
        actionType: 'STOCK_ADJUSTED',
        productId: parsed.id,
        performedBy: parseInt(userId, 10),
        oldValue: { stockQty: current.stockQty },
        newValue: { stockQty: current.stockQty + parsed.quantity },
        notes: `Quick stock add: +${parsed.quantity} on ${current.name}`,
        tenantId,
      },
    }).catch(() => {});
  }

  return updated;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(search?: string) {
  const { tenantId } = await getTenantContext();

  return prisma.customer.findMany({
    where: {
      tenantId,
      ...(search ? {
        OR: [
          { name:  { contains: search } },
          { phone: { contains: search } },
        ],
      } : {}),
    },
    take:    10,
    orderBy: { name: 'asc' },
  });
}

export interface PatientDetails {
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  knownAllergies?: string;
  chronicConditions?: string;
}

export async function createCustomer(name: string, phone: string, details?: PatientDetails) {
  const { tenantId, userId } = await getTenantContext();
  const { name: trimmedName, phone: trimmedPhone } = createCustomerSchema.parse({ name, phone });

  // Check for duplicate phone within tenant
  const existing = await prisma.customer.findFirst({
    where: { phone: trimmedPhone, tenantId },
  });
  if (existing) throw new Error('A customer with this phone number already exists');

  const customer = await prisma.customer.create({
    data: {
      name: trimmedName,
      phone: trimmedPhone,
      tenantId,
      dateOfBirth:       details?.dateOfBirth ? new Date(details.dateOfBirth) : null,
      gender:            details?.gender || null,
      address:           details?.address || null,
      knownAllergies:    details?.knownAllergies || null,
      chronicConditions: details?.chronicConditions || null,
    },
  });

  await prisma.inventoryAuditLog.create({
    data: {
      actionType: 'CUSTOMER_CREATED',
      performedBy: parseInt(userId, 10),
      newValue: { name: trimmedName, phone: trimmedPhone, customerId: customer.id },
      tenantId,
    },
  }).catch(() => {});

  return customer;
}

// Update a patient's clinical details (allergies, conditions, etc.).
export async function updateCustomer(id: number, details: PatientDetails & { name?: string; phone?: string }) {
  const { tenantId, userId } = await getTenantContext();

  const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error('Patient not found');

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(details.name !== undefined ? { name: details.name } : {}),
      ...(details.phone !== undefined ? { phone: details.phone || null } : {}),
      dateOfBirth:       details.dateOfBirth ? new Date(details.dateOfBirth) : (details.dateOfBirth === '' ? null : undefined),
      gender:            details.gender ?? undefined,
      address:           details.address ?? undefined,
      knownAllergies:    details.knownAllergies ?? undefined,
      chronicConditions: details.chronicConditions ?? undefined,
    },
  });

  await prisma.inventoryAuditLog.create({
    data: {
      actionType: 'CUSTOMER_UPDATED',
      performedBy: parseInt(userId, 10),
      newValue: { customerId: id },
      tenantId,
    },
  }).catch(() => {});

  return customer;
}

// Fetch a single customer (tenant-scoped) for the edit form.
export async function getCustomerById(id: number) {
  const { tenantId } = await getTenantContext();
  const customer = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!customer) throw new Error('Customer not found');
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    loyaltyPoints: customer.loyaltyPoints,
    dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.toISOString().slice(0, 10) : '',
    gender: customer.gender ?? '',
    address: customer.address ?? '',
    knownAllergies: customer.knownAllergies ?? '',
    chronicConditions: customer.chronicConditions ?? '',
  };
}

// Bulk import customers from CSV rows. Skips duplicates (by phone within tenant).
export interface CustomerImportRow {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  knownAllergies?: string;
  chronicConditions?: string;
}

export async function bulkImportCustomers(rows: CustomerImportRow[], fileName?: string) {
  const { tenantId, role, userId } = await getTenantContext();

  if (role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    throw new Error('Only managers can import customers');
  }
  if (!rows.length) throw new Error('No customers to import');
  if (rows.length > 5000) throw new Error('Maximum 5,000 customers per import');

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const name = (row.name || '').trim();
      if (!name) { skipped++; continue; }
      const phone = (row.phone || '').trim() || null;

      // Skip duplicates by phone within tenant (phone is unique per tenant)
      if (phone) {
        const existing = await prisma.customer.findFirst({ where: { phone, tenantId } });
        if (existing) { skipped++; continue; }
      }

      let dob: Date | null = null;
      if (row.dateOfBirth) {
        const d = new Date(row.dateOfBirth);
        if (!isNaN(d.getTime())) dob = d;
      }

      await prisma.customer.create({
        data: {
          name,
          phone,
          tenantId,
          dateOfBirth: dob,
          gender: (row.gender || '').trim() || null,
          address: (row.address || '').trim() || null,
          knownAllergies: (row.knownAllergies || '').trim() || null,
          chronicConditions: (row.chronicConditions || '').trim() || null,
        },
      });
      created++;
    } catch (err: any) {
      errors.push(`Row "${row.name}": ${err.message}`);
    }
  }

  await prisma.inventoryAuditLog.create({
    data: {
      actionType: 'BULK_IMPORT',
      performedBy: parseInt(userId, 10),
      newValue: { entityType: 'customer', total: rows.length, created, skipped, errorCount: errors.length },
      notes: `Customer import: ${created} created, ${skipped} skipped, ${errors.length} errors`,
      tenantId,
    },
  }).catch(() => {});

  return { created, skipped, errors: errors.slice(0, 20), total: rows.length };
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export async function processSale(
  items:        { id: number; quantity: number }[],  // price removed — server fetches authoritative price
  customerId?:  number,
  clientToken?: string,                              // idempotency key (UUID generated by client)
  discount?:    number,                              // fixed discount amount
  paymentType?: string,                              // 'Cash' | 'MoMo' | 'Split'
  miscItems?:   { name: string; price: number; quantity: number }[],
  payments?:    { method: string; amount: number; reference?: string | null }[], // split tender
) {
  const ctx = await getTenantContext();
  const { tenantId, userId } = ctx;
  const branchId = await resolveBranchId(ctx);

  // Basic shape validation
  const hasRegularItems = items.length > 0;
  const hasMiscItems = miscItems && miscItems.length > 0;
  if (!hasRegularItems && !hasMiscItems) throw new Error('Cart is empty');

  if (hasRegularItems && items.some(i => i.quantity < 1 || !Number.isInteger(i.quantity))) {
    throw new Error('Invalid item quantities');
  }

  // Validate payment type
  const validPaymentTypes = ['Cash', 'MoMo', 'Split'];
  const resolvedPaymentType = validPaymentTypes.includes(paymentType ?? '') ? paymentType! : 'Cash';

  // Validate discount
  const resolvedDiscount = typeof discount === 'number' && discount > 0 ? discount : 0;

  // Validate misc items
  const resolvedMiscItems = hasMiscItems
    ? miscItems!.filter(m => m.name && m.price > 0 && m.quantity >= 1)
    : [];
  const miscTotal = sumMoney(resolvedMiscItems.map(m => m.price * m.quantity));

  const sellerId = parseInt(userId, 10);
  if (isNaN(sellerId)) throw new Error('Invalid user session — please log in again');

  // Role-credential tagging (who rang up the sale)
  const sessionForSale = await getServerSession(authOptions);
  const roleAccount = sessionForSale?.user.credentialCode ?? null;
  const assignedPerson = sessionForSale?.user.assignedPerson ?? null;

  // ── Idempotency check: if this clientToken already processed, return early ──
  if (clientToken) {
    const existing = await prisma.sale.findFirst({ where: { clientToken, tenantId } });
    if (existing) return existing;
  }

  return prisma.$transaction(async (tx) => {
    let serverTotal = 0;
    let productMap = new Map<number, any>();

    // ── Verify the customer (if supplied) belongs to this tenant ──────────
    // BOLA protection: prevents attaching a sale / awarding loyalty points to
    // another tenant's customer by passing a foreign customerId.
    if (customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true },
      });
      if (!customer) throw new Error('Customer not found');
    }

    if (hasRegularItems) {
      // ── Batch-fetch all products in ONE query (kills N+1) ─────────
      const products = await tx.product.findMany({
        where: { id: { in: items.map(i => i.id) }, tenantId },
      });
      productMap = new Map(products.map(p => [p.id, p]));

      // ── Validate all items before touching stock ──────────────────────────
      for (const item of items) {
        const product = productMap.get(item.id);
        if (!product) throw new Error(`Product not found (ID: ${item.id})`);

        if (product.expiryDate && isExpired(product.expiryDate)) {
          throw new Error(`Cannot sell expired product: ${product.name}`);
        }
        if (product.stockQty < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}: ${product.stockQty} available, ${item.quantity} requested`,
          );
        }
      }

      // ── Server-side pricing — never trust client-supplied price ────
      serverTotal = sumMoney(items.map(item => productMap.get(item.id)!.price * item.quantity));
    }

    // Cap discount at gross total
    const grossTotal = roundMoney(serverTotal + miscTotal);
    const cappedDiscount = roundMoney(Math.min(resolvedDiscount, grossTotal));
    const finalTotal = roundMoney(grossTotal - cappedDiscount);

    // ── Receipt number: ${branchBusinessId}-${YYYYMMDD}-${seq padded 6} ─────
    const branchRow = branchId
      ? await tx.branch.findUnique({ where: { id: branchId }, select: { businessId: true } })
      : null;
    const branchBusinessId = branchRow?.businessId ?? 'HQ';
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
    const todaysCount = await tx.sale.count({
      where: { tenantId, branchId: branchId ?? undefined, createdAt: { gte: dayStart, lte: dayEnd } },
    });
    const receiptNo = `${branchBusinessId}-${yyyymmdd}-${String(todaysCount + 1).padStart(6, '0')}`;

    // ── Create sale with authoritative server price ───────────────────────
    const sale = await tx.sale.create({
      data: {
        totalAmount: finalTotal,
        discount:    cappedDiscount,
        paymentType: resolvedPaymentType,
        status:      'Completed',
        sellerId,
        tenantId,
        branchId,
        roleAccount,
        assignedPerson,
        clientToken: clientToken ?? receiptNo,
        ...(customerId  ? { customerId }  : {}),
        ...(resolvedMiscItems.length > 0 ? { miscItems: JSON.stringify(resolvedMiscItems) } : {}),
        ...(hasRegularItems ? {
          items: {
            create: items.map(item => ({
              productId: item.id,
              quantity:  item.quantity,
              price:     productMap.get(item.id)!.price,
            })),
          },
        } : {}),
      },
      include: { items: true },
    });

    // ── Loyalty points ────────────────────────────────────────────────────
    if (customerId) {
      const points = Math.floor(finalTotal / 10);
      if (points > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data:  { loyaltyPoints: { increment: points } },
        });
      }
    }

    // ── Payment records (split tender, immutable) ─────────────────────────
    const METHOD_LABEL: Record<string, string> = { Cash: 'cash', MoMo: 'mobile_money', Card: 'card', Credit: 'credit' };
    const validMethods = new Set(['cash', 'mobile_money', 'card', 'credit']);
    let paymentRows = (payments ?? [])
      .filter(p => p.amount > 0 && validMethods.has(p.method))
      .map(p => ({
        saleId: sale.id, tenantId, branchId,
        paymentMethod: p.method,
        amount: roundMoney(p.amount),
        reference: p.reference ?? null,
      }));
    if (paymentRows.length === 0) {
      // No breakdown supplied — record a single payment from the chosen method.
      paymentRows = [{
        saleId: sale.id, tenantId, branchId,
        paymentMethod: METHOD_LABEL[resolvedPaymentType] ?? 'cash',
        amount: finalTotal,
        reference: null,
      }];
    }
    await tx.salePayment.createMany({ data: paymentRows });

    // ── Atomic stock decrement with race condition prevention ────────────
    // Product.stockQty remains the authoritative quantity (validated here);
    // batch stock_items are deducted FIFO in parallel to build the ledger.
    if (hasRegularItems) {
      for (const item of items) {
        const affected = await tx.product.updateMany({
          where: {
            id:       item.id,
            tenantId,
            stockQty: { gte: item.quantity },
          },
          data: { stockQty: { decrement: item.quantity } },
        });
        if (affected.count === 0) {
          throw new Error(
            `Stock conflict for ${productMap.get(item.id)?.name}: insufficient stock. Please refresh and retry.`,
          );
        }

        // FIFO batch deduction + immutable movement ledger (best-effort).
        const { firstStockItemId } = await deductStockFifo(tx, {
          tenantId,
          branchId,
          productId: item.id,
          quantity: item.quantity,
          performedById: sellerId,
          referenceId: sale.id,
        });
        if (firstStockItemId !== null) {
          const saleItem = sale.items.find(si => si.productId === item.id);
          if (saleItem) {
            await tx.saleItem.update({ where: { id: saleItem.id }, data: { stockItemId: firstStockItemId } });
          }
        }
      }
    }

    // ── Audit log for completed sale ──────────────────────────────────
    await tx.inventoryAuditLog.create({
      data: {
        actionType: 'SALE_COMPLETED',
        performedBy: sellerId,
        newValue: {
          saleId: sale.id,
          totalAmount: finalTotal,
          discount: cappedDiscount,
          paymentType: resolvedPaymentType,
          itemCount: items.length + resolvedMiscItems.length,
          customerId: customerId ?? null,
          items: items.map(i => ({
            productId: i.id,
            name: productMap.get(i.id)?.name,
            quantity: i.quantity,
            price: productMap.get(i.id)?.price,
          })),
          ...(resolvedMiscItems.length > 0 ? { miscItems: resolvedMiscItems } : {}),
        },
        tenantId,
      },
    });

    return sale;
  });
}

// ── Bulk Import ──────────────────────────────────────────────────────────────

export interface ImportRow {
  name: string;
  price: number;
  costPrice: number;
  stockQty: number;
  expiryDate: string;
  barcode: string;
  category: string;
}

export async function bulkImportProducts(rows: ImportRow[], fileName?: string) {
  const { tenantId, role, userId } = await getTenantContext();

  if (role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    throw new Error('Only managers can import products');
  }
  if (!rows.length) throw new Error('No products to import');
  if (rows.length > 5000) throw new Error('Maximum 5,000 products per import');

  // Track the import as an auditable job (blueprint §13.5).
  const job = await prisma.importJob.create({
    data: {
      tenantId,
      entityType: 'product',
      fileName: fileName ?? null,
      status: 'processing',
      totalRows: rows.length,
      performedBy: parseInt(userId, 10),
    },
  });

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process in batches of 50 to avoid overwhelming the DB
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);

    for (const row of batch) {
      try {
        const name = (row.name || '').trim().toUpperCase();
        if (!name) { skipped++; continue; }

        const price    = Math.max(0, Number(row.price) || 0);
        const costPrice = Number(row.costPrice) || null;
        const stockQty = Math.max(0, Math.floor(Number(row.stockQty) || 0));
        const category = (row.category || 'General').trim();
        const barcode  = (row.barcode || '').trim() || null;

        let expiryDate: Date | null = null;
        if (row.expiryDate) {
          const d = new Date(row.expiryDate);
          if (!isNaN(d.getTime())) expiryDate = d;
        }

        // Skip if exact same name already exists for this tenant
        const existing = await prisma.product.findFirst({
          where: { name, tenantId },
        });
        if (existing) { skipped++; continue; }

        await prisma.product.create({
          data: {
            name, price, costPrice, stockQty,
            expiryDate, category, tenantId,
            description: barcode ? `Barcode: ${barcode}` : null,
          },
        });
        created++;
      } catch (err: any) {
        errors.push(`Row "${row.name}": ${err.message}`);
      }
    }
  }

  // Finalise the import job.
  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      successCount: created,
      failureCount: skipped + errors.length,
      failureReport: errors.length ? JSON.stringify(errors.slice(0, 100)) : null,
      completedAt: new Date(),
    },
  }).catch(() => {});

  await prisma.inventoryAuditLog.create({
    data: {
      actionType: 'BULK_IMPORT',
      performedBy: parseInt(userId, 10),
      newValue: { jobId: job.id, totalRows: rows.length, created, skipped, errorCount: errors.length },
      notes: `Bulk import: ${created} created, ${skipped} skipped, ${errors.length} errors`,
      tenantId,
    },
  }).catch(() => {});

  return { created, skipped, errors: errors.slice(0, 20), total: rows.length, jobId: job.id };
}

// ── Tenant Info ───────────────────────────────────────────────────────────────

export async function getTenantInfo() {
  const { tenantId } = await getTenantContext();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, address: true, primaryPhone: true, primaryEmail: true },
  });

  return tenant ?? { name: 'Pharmacy', address: '', primaryPhone: '', primaryEmail: '' };
}
