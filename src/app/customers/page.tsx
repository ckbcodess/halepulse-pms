// Thin server-component shell — no data fetching here.
// All data fetching, caching, and search is handled client-side by
// CustomersView via React Query (/api/customers GET).
import CustomersView from './CustomersView';

export default function CustomersPage() {
  return <CustomersView />;
}
