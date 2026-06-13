'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];

export default function TenantsClientFilters({
  currentQ,
  currentStatus,
}: {
  currentQ: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(currentQ);
  const [status, setStatus] = useState(currentStatus);

  const apply = (newQ = q, newStatus = status) => {
    const params = new URLSearchParams();
    if (newQ) params.set('q', newQ);
    if (newStatus !== 'all') params.set('status', newStatus);
    router.push(`/super-admin/tenants?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && apply(q)}
          placeholder="Search by name or Business ID…"
          className="h-9 pl-8 text-sm"
        />
      </div>
      <select
        value={status}
        onChange={e => { setStatus(e.target.value); apply(q, e.target.value); }}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={() => apply(q)}
        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Search
      </button>
      {(q || status !== 'all') && (
        <button
          onClick={() => { setQ(''); setStatus('all'); router.push('/super-admin/tenants'); }}
          className="h-9 px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
