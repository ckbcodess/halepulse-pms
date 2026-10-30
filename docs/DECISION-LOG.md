# HalePulse PMS — Decision Log

A running record of the decisions we make building HalePulse: what we chose,
why, and the trade-offs we accepted. Newest entries at the top. This is the
"why" behind the code — commits say *what* changed; this says *why*.

> Keep appending. Every meaningful decision (architecture, library choice,
> a trade-off we knowingly accepted, something we deferred) gets a dated entry.

---

## 2026-10-30 — Offline POS (branch `feature/offline-pos`)

**Goal:** let a pharmacy keep selling when the internet drops — the app opens,
searches, and completes sales offline, then syncs when the connection returns.
No sale may ever be lost or blocked by a bad network.

### Phased approach

| Phase | What | Status |
|-------|------|--------|
| 1 | PWA shell — app loads offline | ✅ done |
| 2 | Catalogue mirror — search products offline | ✅ done |
| 3 | Sale outbox — complete sales offline, queued | ✅ done |
| 4 | Sync on reconnect — replay queued sales | ✅ done |
| 5 | Offline login — start a shift with no internet | ⏳ deferred |

### Decisions & rationale

- **PWA via Serwist (`@serwist/next`), not next-pwa.** Serwist is the maintained
  successor and works with Next 16. Consequence: the build runs on **webpack**
  (`next build --webpack`) because Serwist's service-worker compilation isn't
  Turbopack-compatible yet. The service worker is **disabled in `next dev`** —
  offline must be tested against a production build.

- **Catalogue cached in IndexedDB via Dexie.** The POS search hits the server on
  every keystroke, so offline it needs a local copy to search. A new
  `getCatalogueSnapshot()` server action returns the **full** tenant-scoped
  catalogue (products + customers + tenant), unlike `getProducts()` which only
  returns the top-N. ~3,000 products fits comfortably in IndexedDB.

- **Read-through data access.** `loadProducts/loadCustomers/loadTenant` try the
  server first when online (and refresh the cache), and fall back to the local
  mirror when offline or when the call fails. The POS UI is unchanged.

- **Offline sales use an outbox keyed by `clientToken`.** A sale rung up offline
  is stored verbatim and replayed into the existing `processSale()` on reconnect.
  `processSale` is already idempotent by `clientToken`, so replaying is safe —
  a flaky connection can't double-charge. We now send a `clientToken` on **every**
  sale (online too), making all checkouts idempotent.

- **Optimistic local stock decrement, server stays authoritative.** Offline we
  decrement cached stock so a cashier can't oversell the cached catalogue during
  the outage. On sync the server re-validates stock/pricing, so a queued sale
  **can** be rejected (e.g. the item sold out on another till). Rejected sales are
  surfaced as **`failed`** in the POS header — never silently dropped.

- **Connectivity by probing the server, not `navigator.onLine`.** `navigator.onLine`
  is unreliable — it stays `true` when wifi is switched off, which made the status
  indicator stay green and the first offline sale error out. We added `/api/ping`
  (204, no-store) and actively probe it (on mount, tab focus, online/offline
  events, and every 15s). A global **Online/Offline** pill sits in the top bar;
  the POS header carries richer **Syncing / N to sync / N failed** badges. As a
  second safety net, checkout treats any connectivity-type failure (including the
  `TypeError` a dead fetch throws) as offline and queues the sale.

### Trade-offs we knowingly accepted

- **Stock shown offline can be stale** between syncs (last-synced value, minus
  optimistic decrements). Acceptable; the server reconciles on sync.
- **A fresh login still needs internet** (Phase 5). A cashier must log in while
  online at the start of a shift; an outage mid-shift is fine because the session
  (JWT cookie) is validated locally.
- **Offline must be tested on a production build**, in **real Chrome** — the
  service worker is off in dev, and sandboxed inside Claude's in-app browser pane.

### How to test

- **Local:** production build on port 3100 (`NODE_ENV=production npm run build`
  then `npx next start -p 3100`), open in Chrome, log in online, turn wifi off,
  sell, turn wifi on, watch it sync.
- **Vercel:** offline activates on the deployed HTTPS site after the **first
  online visit** (that's when the service worker installs).

### Open items / next

- **Phase 5 — offline login** (cache a short-lived shift session) is the one
  remaining gap.
- The **AI features** branch (`feature/ai-features`) is still unmerged, so whichever
  of offline / AI merges to `main` first, the other will need a rebase.
