/**
 * GRN auto-pricing (blueprint §6.2): selling_price = cost × (1 + markup/100),
 * optionally rounded to the nearest configured increment (e.g. 0.50, 1.00).
 */
export function computeSellingPrice(
  costPrice: number,
  markupPercent: number,
  roundToNearest?: number | null,
): number {
  let price = Math.round(costPrice * (1 + markupPercent / 100) * 100) / 100;
  if (roundToNearest && roundToNearest > 0) {
    price = Math.round(price / roundToNearest) * roundToNearest;
  }
  return price;
}
