import { redirect } from 'next/navigation';

// The standalone Stock Value page has been consolidated into the Reports hub as the
// "Stock Valuation" report tab. This permanent redirect keeps old bookmarks/links working.
export default function StockValuePage() {
  redirect('/reports?tab=valuation');
}
