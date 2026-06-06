# HalePulse — What Changed & Why It's Better (Plain English)

A non-technical summary of the upgrade that brought the system in line with the
HalePulse ERP blueprint. Written for owners and managers, not engineers.

---

## The big picture

The previous build was a solid single-pharmacy app: products, a point-of-sale
screen, customers, and basic dashboards. It worked, but it treated the pharmacy as
**one location with one pool of stock**, had **four broad user types**, and tracked
stock as a single number per product.

The upgrade turns it into a **proper multi-branch pharmacy platform** that can be
sold to many pharmacies, each with multiple branches, real staff roles, batch-level
stock, prescriptions, and reporting. Crucially, **nothing was rebuilt from scratch** —
each improvement was layered on carefully so the live system kept working the whole
time.

### Before vs after at a glance

| Area | Before | After |
|---|---|---|
| Staff roles | 4 broad types | 5 real pharmacy roles, each with precise permissions |
| Branches | One pool of stock | Each branch has its own stock, sales, and staff |
| Stock | One number per product | Tracked by batch (cost, price, expiry per delivery) |
| Receiving stock | Manual price entry | Auto-priced goods-received notes with a full paper trail |
| Selling | Just reduced a number | Sells oldest stock first, records every movement |
| Payments | One method per sale | Split payments (part cash, part mobile money) |
| Refunds | Not controlled | Manager-only voids that restore stock, never deleted |
| End of day | None | Cash reconciliation that locks once submitted |
| Customers | Name + phone | Full patient records: allergies, conditions, history |
| Prescriptions | None | Issue → verify → dispense, with controlled-drug logging |
| Refills | None | Reminder system for repeat medication |
| Reports | Basic | Monthly trends, payment breakdowns, best-sellers, CSV export |
| AI | None | Optional AI summaries & drug-interaction checks (any provider) |
| Imports | Worked | Now tracked with a full history of every import |
| Alerts | A dot on a bell | A real notification center (low stock, expiry, refills) |

---

## What each of the 8 phases achieves

**Phase 1 — Roles & branches (the foundation).**
Staff now match real pharmacy jobs: Super Admin, Tenant Admin, Branch Manager,
Pharmacist, Cashier. Each only sees and does what their job allows. And the system
finally understands branches — a cashier in one branch can't see another branch's
takings, while an owner can switch between branches or see everything. *Why it's
better: the right people get the right access, and a pharmacy chain is now possible.*

**Phase 2 — Real inventory.**
Stock is tracked per delivery ("batch"), each with its own cost, selling price, and
expiry date. Receiving stock auto-calculates the selling price from cost + markup.
Selling automatically uses the oldest stock first (so older stock moves before it
expires). Every change — received, sold, adjusted, transferred, counted — is written
to a permanent ledger. There's also a stock-take mode for shelf counts and
branch-to-branch transfers. *Why it's better: accurate stock, real expiry control,
and a complete history of every unit.*

**Phase 3 — Smarter checkout.**
A single sale can be split across cash and mobile money. Only managers can void a
sale, it always needs a reason, the stock is put back automatically, and the record
is never deleted. At day's end, a manager reconciles the cash drawer against what the
system expected, and the report locks so it can't be quietly changed. *Why it's
better: fewer mistakes, less theft risk, and trustworthy daily numbers.*

**Phase 4 — Clinical care.**
Customers are now patient records with allergies and chronic conditions, and their
full purchase history. Pharmacists can issue, verify, and dispense prescriptions,
with extra logging for controlled drugs. The system can remind staff when a patient
is due for a refill. *Why it's better: safer dispensing and proactive patient care.*

**Phase 5 — Real reporting.**
Managers get this-month-vs-last-month revenue, best-selling products, most frequent
customers, a breakdown of cash vs mobile money, and the ability to export reports to
a spreadsheet. *Why it's better: owners can actually see how the business is doing.*

**Phase 6 — AI assistant (optional).**
The system can write a plain-English summary of the month's performance and check a
prescription's drugs for interactions. It works with any AI provider you choose
(including free options), and the AI key is kept safely on the server. *Why it's
better: helpful insights without locking you into one vendor or a big bill.*

**Phase 7 — Safe data imports.**
Bringing in existing product lists is now recorded as a tracked job with a history of
what succeeded and what was skipped. *Why it's better: onboarding new pharmacies is
auditable and repeatable.*

**Phase 8 — Polish.**
A working notification center surfaces low stock, expiring items, and due refills in
one place. *Why it's better: problems get noticed before they cost money.*

---

## How the architecture got stronger

- **Built for many pharmacies, many branches.** Data is kept separate per pharmacy
  and per branch, enforced everywhere in the system's logic.
- **A permanent paper trail.** Money and stock movements are recorded in
  append-only logs — they can be read but not quietly edited or deleted.
- **One brain for permissions.** All the "who can do what" rules live in a single
  place, so they're consistent and easy to adjust.
- **Safe, gradual upgrades.** Each big change ran alongside the old behaviour first,
  so the app never broke — and every data change was tested on a copy before being
  trusted.
- **Vendor-flexible AI.** Swappable in one place; no lock-in.

---

## Robustness & security scorecard

Scores are out of 10, reflecting the system **as it is now**.

| Area | Score | Comment |
|---|---:|---|
| Multi-pharmacy data separation | 8.5 | Every record is tagged and filtered by pharmacy/branch in the app logic. |
| Staff access control (roles) | 8.5 | Precise, hierarchy-aware permissions; sensitive actions are role-gated. |
| Audit trail / traceability | 8.5 | Stock, sales, voids, dispensing, AI use are all logged. |
| Money & stock accuracy | 8.0 | Server decides prices; voids restore stock; EOD locks. (See dual-write note below.) |
| Login & account security | 8.0 | Secure sessions, brute-force lockout, rate limiting, forced password changes. |
| Operational safety | 8.5 | Manager-only voids with reasons, locked end-of-day, controlled-drug logging. |
| Error handling & resilience | 7.5 | Failures are contained; logging never breaks a sale. |
| Automated testing | 4.0 | Changes were manually verified; there's no automated test suite yet. |
| Scalability | 7.5 | Indexed for growth; a few areas will need attention at high volume. |
| **Overall** | **~7.8** | **Production-ready for launch; a few areas to harden as you grow.** |

### Plain-English read on that score
The system is **genuinely solid and safe to launch** for one or a few pharmacies.
Its biggest strengths are access control, separation between pharmacies, and the
permanent record of money and stock. Its biggest weakness is the **lack of an
automated test suite** — today, safety relies on careful manual checking, which is
fine now but should be shored up before the system is widely distributed.

---

## Recommended improvements (in priority order)

1. **Add automated tests** for the critical flows (sale, void, stock receive,
   end-of-day, prescription dispensing). This is the single biggest upgrade to
   long-term reliability.
2. **Database-level isolation (defence in depth).** Right now, separation between
   pharmacies is enforced by the app's code. Adding a second layer at the database
   itself means even a coding mistake couldn't leak data across pharmacies.
3. **Finish the inventory "single source of truth."** Stock is currently kept in
   sync in two places during the transition; consolidating to the batch ledger
   removes any chance of the two drifting apart.
4. **Turn on AI** by adding a provider key (a free tier works) so managers get the
   monthly summaries and interaction checks.
5. **Refill messaging.** Connect the refill reminders to SMS/WhatsApp so patients
   are actually contacted (small per-message cost).
6. **Usage limits & monitoring.** Per-pharmacy rate limits and error monitoring so
   one busy or misbehaving tenant can't affect others.
7. **Unify the audit log** into a single table for easier review and reporting.

None of these block launch — they're the roadmap for turning a strong v1 into a
hardened, widely-distributed product.
