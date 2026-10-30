'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Offline sync engine
//
//   loadProducts / loadCustomers / loadTenant  — read-through: server when
//     online (and refresh the cache), local mirror when offline or on failure.
//   syncCatalogue   — pull the whole branch catalogue into IndexedDB.
//   queueSale       — record a sale rung up offline + decrement local stock.
//   syncOutbox      — replay queued sales into processSale() (idempotent).
//
// The server is always authoritative. Offline sales are provisional: the
// server still validates stock/pricing on replay, so a queued sale CAN be
// rejected on sync (e.g. the item sold out elsewhere). Those are surfaced as
// 'failed' rather than silently dropped.
// ─────────────────────────────────────────────────────────────────────────────

import { getDB, type CachedProduct, type CachedCustomer, type QueuedSale } from './db';
import {
  getCatalogueSnapshot, getProducts, getCustomers, getTenantInfo, processSale,
} from '@/app/actions';

export interface TenantInfo {
  name:          string;
  address:       string | null;
  primaryPhone:  string | null;
  primaryEmail?: string | null;
}

const DEFAULT_TENANT: TenantInfo = { name: 'Pharmacy', address: null, primaryPhone: null };

function onlineNow(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** A thrown server action looks like a network failure (vs a business
 *  rejection the server deliberately returned). Used to decide retry vs fail. */
function looksLikeNetworkError(msg: string): boolean {
  return /failed to fetch|networkerror|load failed|fetch failed|err_internet|offline/i.test(msg);
}

function normalizeProduct(p: {
  id: number; name: string; price: number; stockQty: number; category: string;
  expiryDate: string | Date | null; brand: string | null; lowStockThreshold: number;
}): CachedProduct {
  return {
    id:                p.id,
    name:              p.name,
    price:             p.price,
    stockQty:          p.stockQty,
    category:          p.category,
    brand:             p.brand ?? null,
    lowStockThreshold: p.lowStockThreshold ?? 10,
    expiryDate:        p.expiryDate ? new Date(p.expiryDate).toISOString() : null,
  };
}

// ── Catalogue sync ───────────────────────────────────────────────────────────

/** Pull the full branch catalogue into IndexedDB. Returns false if offline
 *  storage is unavailable or the pull failed (caller keeps the old cache). */
export async function syncCatalogue(): Promise<boolean> {
  const db = getDB();
  if (!db || !onlineNow()) return false;
  try {
    const snap = await getCatalogueSnapshot();
    await db.transaction('rw', db.products, db.customers, db.meta, async () => {
      await db.products.clear();
      await db.products.bulkPut(snap.products.map(normalizeProduct));
      await db.customers.clear();
      await db.customers.bulkPut(snap.customers as CachedCustomer[]);
      await db.meta.put({ key: 'tenant',   value: snap.tenant });
      await db.meta.put({ key: 'syncedAt', value: snap.syncedAt });
    });
    // The snapshot's stock predates any sale still waiting in the outbox, so
    // re-apply those decrements to keep local stock consistent for the cashier.
    await reapplyPendingDecrements();
    return true;
  } catch {
    return false;
  }
}

export async function lastSyncedAt(): Promise<string | null> {
  const db = getDB();
  if (!db) return null;
  const row = await db.meta.get('syncedAt');
  return (row?.value as string) ?? null;
}

// ── Read-through loaders (used by the POS in place of the raw actions) ────────

export async function loadProducts(query: string): Promise<CachedProduct[]> {
  const q = query.trim();
  const db = getDB();

  if (onlineNow()) {
    try {
      const res = await getProducts(q);
      const mapped = res.map(normalizeProduct);
      // Opportunistically freshen the cache for what we just fetched.
      if (db && mapped.length) db.products.bulkPut(mapped).catch(() => {});
      return mapped;
    } catch {
      /* fall through to the local mirror */
    }
  }
  return searchProductsOffline(q);
}

export async function searchProductsOffline(query: string): Promise<CachedProduct[]> {
  const db = getDB();
  if (!db) return [];
  const q = query.trim().toLowerCase();
  if (!q) return db.products.orderBy('name').limit(20).toArray();
  const all = await db.products.toArray();
  return all
    .filter(p => p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q))
    .slice(0, 50);
}

export async function loadCustomers(query: string): Promise<CachedCustomer[]> {
  const q = query.trim();
  const db = getDB();

  if (onlineNow()) {
    try {
      const res = (await getCustomers(q)) as CachedCustomer[];
      if (db && res.length) db.customers.bulkPut(res).catch(() => {});
      return res;
    } catch {
      /* fall through */
    }
  }
  if (!db) return [];
  const needle = q.toLowerCase();
  const all = await db.customers.toArray();
  return all
    .filter(c => c.name.toLowerCase().includes(needle) || (c.phone ?? '').toLowerCase().includes(needle))
    .slice(0, 10);
}

export async function loadTenant(): Promise<TenantInfo> {
  const db = getDB();
  if (onlineNow()) {
    try {
      const t = (await getTenantInfo()) as TenantInfo;
      if (db) db.meta.put({ key: 'tenant', value: t }).catch(() => {});
      return t;
    } catch {
      /* fall through */
    }
  }
  if (!db) return DEFAULT_TENANT;
  const row = await db.meta.get('tenant');
  return (row?.value as TenantInfo) ?? DEFAULT_TENANT;
}

// ── Outbox (offline sales) ─────────────────────────────────────────────────────

/** Record a sale rung up offline and optimistically decrement local stock so
 *  the cashier can't oversell what's in the cached catalogue during the outage. */
export async function queueSale(sale: QueuedSale): Promise<void> {
  const db = getDB();
  if (!db) throw new Error('Offline storage is unavailable on this device');
  await db.transaction('rw', db.outbox, db.products, async () => {
    await db.outbox.put(sale);
    for (const it of sale.items) {
      const p = await db.products.get(it.id);
      if (p) {
        p.stockQty = Math.max(0, p.stockQty - it.quantity);
        await db.products.put(p);
      }
    }
  });
}

async function reapplyPendingDecrements(): Promise<void> {
  const db = getDB();
  if (!db) return;
  const pending = await db.outbox.where('status').equals('pending').toArray();
  for (const s of pending) {
    for (const it of s.items) {
      const p = await db.products.get(it.id);
      if (p) {
        p.stockQty = Math.max(0, p.stockQty - it.quantity);
        await db.products.put(p);
      }
    }
  }
}

export async function pendingCount(): Promise<number> {
  const db = getDB();
  if (!db) return 0;
  return db.outbox.where('status').equals('pending').count();
}

export async function failedCount(): Promise<number> {
  const db = getDB();
  if (!db) return 0;
  return db.outbox.where('status').equals('failed').count();
}

/** Replay every pending sale into the server. Safe to call repeatedly:
 *  processSale is idempotent by clientToken. Network errors leave the sale
 *  pending (retry later); deliberate server rejections mark it 'failed'. */
export async function syncOutbox(): Promise<{ synced: number; failed: number }> {
  const db = getDB();
  if (!db || !onlineNow()) return { synced: 0, failed: 0 };

  const pending = await db.outbox.where('status').equals('pending').toArray();
  let synced = 0, failed = 0;

  for (const s of pending) {
    try {
      const result = await processSale(
        s.items,
        s.customerId ?? undefined,
        s.clientToken,
        s.discount,
        s.paymentType,
        s.miscItems,
        s.payments,
      ) as { id?: number; clientToken?: string } | null;

      s.status       = 'synced';
      s.serverSaleId = result?.id ?? null;
      s.receiptNo    = result?.clientToken ?? null;
      s.error        = null;
      await db.outbox.put(s);
      synced++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (looksLikeNetworkError(msg)) continue; // still offline — retry next time
      s.status = 'failed';
      s.error  = msg;
      await db.outbox.put(s);
      failed++;
    }
  }
  return { synced, failed };
}

/** Clear sales that have successfully synced (housekeeping). */
export async function clearSyncedSales(): Promise<void> {
  const db = getDB();
  if (!db) return;
  await db.outbox.where('status').equals('synced').delete();
}
