import { redirect } from 'next/navigation';

// CSV import is handled by the "Import CSV" action (modal) on the Stock page,
// so this standalone page is redundant and now redirects there.
export default function ImportRedirect() {
  redirect('/inventory');
}
