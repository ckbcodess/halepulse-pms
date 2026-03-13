// Thin server-component shell — no data fetching here.
// All data fetching, caching, and filtering is handled client-side by
// InventoryView via React Query (/api/inventory GET).
import InventoryView from './InventoryView';

export default function InventoryPage() {
  return <InventoryView />;
}
