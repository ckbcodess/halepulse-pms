// ─────────────────────────────────────────────────────────────────────────────
// Offline store (IndexedDB via Dexie)
//
// Phase 2: a local mirror of the branch catalogue (products + customers +
// tenant) so the POS can search and build a cart with no network.
// Phase 3: an outbox of sales rung up while offline, replayed against the
// server (idempotently, by clientToken) once connectivity returns.
//
// All data here is per-browser and per-device. It is a cache + a durable
// queue — never the source of truth. The server stays authoritative; offline
// sales are PROVISIONAL until they sync (see sync.ts).
// ─────────────────────────────────────────────────────────────────────────────

import Dexie, { type Table } from 'dexie';

export interface CachedProduct {
  id:                number;
  name:              string;
  price:             number;
  stockQty:          number;   // last-synced stock; decremented optimistically on offline sale
  category:          string;
  expiryDate:        string | null; // ISO string
  brand:             string | null;
  lowStockThreshold: number;
}

export interface CachedCustomer {
  id:            number;
  name:          string;
  phone:         string | null;
  loyaltyPoints: number;
}

export interface MetaRow {
  key:   string;      // 'tenant' | 'syncedAt'
  value: unknown;
}

export type QueuedSaleStatus = 'pending' | 'failed' | 'synced';

/** A sale captured offline, stored verbatim so it can be replayed into
 *  processSale() unchanged. clientToken is the idempotency key — replaying is
 *  safe because the server returns the existing sale for a known token. */
export interface QueuedSale {
  clientToken:  string;              // PK + idempotency key (crypto.randomUUID)
  createdAt:    string;              // ISO — when rung up on the device
  status:       QueuedSaleStatus;
  error?:       string | null;       // set when the server rejects the replay
  serverSaleId?: number | null;      // real sale id after a successful sync
  receiptNo?:   string | null;       // real receipt number after sync

  // ── exact processSale() arguments ──
  items:       { id: number; quantity: number }[];
  customerId?: number | null;
  discount:    number;
  paymentType: string;
  miscItems:   { name: string; price: number; quantity: number }[];
  payments:    { method: string; amount: number }[];

  // ── for rendering the provisional receipt without the server ──
  display: {
    items:        { id: number; name: string; price: number; quantity: number; isMisc?: boolean }[];
    total:        number;
    customerName: string | null;
  };
}

class HalePulseDB extends Dexie {
  products!:  Table<CachedProduct, number>;
  customers!: Table<CachedCustomer, number>;
  meta!:      Table<MetaRow, string>;
  outbox!:    Table<QueuedSale, string>;

  constructor() {
    super('halepulse-offline');
    this.version(1).stores({
      products:  'id, name, category',
      customers: 'id, phone',
      meta:      'key',
      outbox:    'clientToken, status, createdAt',
    });
  }
}

// Lazily created, browser-only. Client components are also rendered on the
// server for SSR, where indexedDB does not exist — so we never construct Dexie
// there. Callers must handle a null db (treat as "offline storage unavailable").
let _db: HalePulseDB | null = null;

export function getDB(): HalePulseDB | null {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  if (!_db) _db = new HalePulseDB();
  return _db;
}
