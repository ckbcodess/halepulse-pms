// Thin server-component shell — matches the inventory/page.tsx pattern.
// All data fetching, filtering, and pagination handled client-side via React Query.
import AuditLogView from './AuditLogView';

export default function AuditLogPage() {
  return <AuditLogView />;
}
