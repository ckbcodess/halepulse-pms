import { redirect } from 'next/navigation';

// Quick Restock is now a tab on the unified Restock page.
// This permanent redirect keeps old bookmarks/links working.
export default function QuickRestockRedirect() {
  redirect('/inventory/restock');
}
