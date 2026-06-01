'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Branch {
  id: string;
  name: string;
  isHeadquarters: boolean;
}

interface BranchData {
  branches: Branch[];
  canSwitch: boolean;
  selectedBranchId: string | null;
  homeBranchId: string | null;
}

const ALL_BRANCHES = 'All Branches';

export default function BranchSwitcher() {
  const router = useRouter();
  const [data, setData] = useState<BranchData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setData(await res.json());
    } catch {
      /* non-fatal — switcher just won't render */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const select = useCallback(
    async (branchId: string | null) => {
      setBusy(true);
      try {
        await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchId }),
        });
        await load();
        router.refresh(); // re-run server components with the new branch scope
      } finally {
        setBusy(false);
      }
    },
    [load, router],
  );

  if (!data || data.branches.length === 0) return null;

  const current = data.selectedBranchId
    ? data.branches.find((b) => b.id === data.selectedBranchId)?.name ?? ALL_BRANCHES
    : data.canSwitch
      ? ALL_BRANCHES
      : data.branches[0]?.name ?? '';

  // Operational users (cannot switch, single branch) — static label.
  if (!data.canSwitch) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground">
        <Building2 size={14} className="flex-shrink-0" />
        <span className="text-[12px] font-medium truncate max-w-[140px]">{current}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-auto gap-1.5 px-2.5 py-1.5" disabled={busy} />}
      >
        <Building2 size={14} className="flex-shrink-0 text-muted-foreground" />
        <span className="text-[12px] font-medium truncate max-w-[140px]">{current}</span>
        <ChevronDown size={13} className="text-muted-foreground flex-shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="min-w-[200px]">
        <DropdownMenuLabel>Viewing branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer justify-between" onClick={() => select(null)}>
          {ALL_BRANCHES}
          {!data.selectedBranchId && <Check size={14} />}
        </DropdownMenuItem>
        {data.branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            className="cursor-pointer justify-between"
            onClick={() => select(b.id)}
          >
            <span className="truncate">
              {b.name}
              {b.isHeadquarters && <span className="ml-1.5 text-[10px] text-muted-foreground">HQ</span>}
            </span>
            {data.selectedBranchId === b.id && <Check size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
