/**
 * Money helpers.
 *
 * Currency must never accumulate floating-point drift (e.g. 0.1 + 0.2 = 0.30000000000000004).
 * Every monetary value is rounded to 2 decimal places at the moment it is
 * COMPUTED and STORED, so the database never holds a value like 59.9999999.
 *
 * `roundMoney` adds Number.EPSILON before rounding to avoid the classic
 * banker's-rounding-down error (e.g. 1.005 → 1.00 instead of 1.01).
 *
 * NOTE: this is the safe, incremental correctness fix. Storing money as integer
 * pesewas remains the longer-term hardening — to be done as a dedicated,
 * test-verified migration.
 */

/** Round a monetary amount to 2 decimal places, drift-free. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sum a list of monetary amounts without accumulating float drift. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0));
}

/** Multiply a unit price by a quantity, returning a clean monetary amount. */
export function multiplyMoney(unitPrice: number, quantity: number): number {
  return roundMoney(unitPrice * quantity);
}
