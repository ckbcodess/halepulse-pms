'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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

interface BranchSwitcherProps {
  /** "header" (compact pill) or "sidebar" (full brand card). */
  variant?: 'header' | 'sidebar';
  /** Tenant display name + logo — only used by the sidebar variant. */
  tenantName?: string | null;
  tenantLogoUrl?: string | null;
  /** Collapsed sidebar — show only the avatar. */
  collapsed?: boolean;
}

const ALL_BRANCHES = 'All Branches';

export default function BranchSwitcher({
  variant = 'header',
  tenantName,
  tenantLogoUrl,
  collapsed = false,
}: BranchSwitcherProps) {
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

  const current = data
    ? data.selectedBranchId
      ? data.branches.find((b) => b.id === data.selectedBranchId)?.name ?? ALL_BRANCHES
      : data.canSwitch
        ? ALL_BRANCHES
        : data.branches[0]?.name ?? ''
    : '';

  // Shared list of branch options for the dropdown.
  const branchMenu = data && (
    <DropdownMenuContent align="start" sideOffset={variant === 'sidebar' ? 6 : 8} className="min-w-[220px]">
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
  );

  // ── Sidebar variant: brand + branch card ──────────────────────────────────
  if (variant === 'sidebar') {
    const initial = (tenantName || 'P').trim().charAt(0).toUpperCase() || 'P';

    const avatar = (
      <Avatar className="size-7 rounded-[12px] after:hidden shrink-0">
        {tenantLogoUrl ? <AvatarImage src={tenantLogoUrl} className="rounded-[12px]" /> : null}
        <AvatarFallback className="rounded-[12px] bg-[var(--primary)] [background-image:linear-gradient(in_oklch_to_bottom,var(--primary-gradient-from),var(--primary-gradient-to))] text-[var(--sidebar-primary-foreground)] text-[14px] font-medium">
          {initial}
        </AvatarFallback>
      </Avatar>
    );

    if (collapsed) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="flex w-full items-center justify-center rounded-lg p-1 transition-colors hover:bg-foreground/5" disabled={busy} />}
            aria-label="Switch branch"
          >
            {avatar}
          </DropdownMenuTrigger>
          {branchMenu}
        </DropdownMenu>
      );
    }

    const card = (
      <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-foreground/5 p-2 transition-colors group-hover/branch:bg-foreground/[0.08]">
        <div className="flex min-w-0 items-center gap-2">
          {avatar}
          <div className="flex min-w-0 flex-col items-start">
            <span className="max-w-[118px] truncate text-[14px] font-medium leading-[17.5px] tracking-[-0.35px] text-foreground">
              {tenantName || 'Pharmacy'}
            </span>
            <span className="max-w-[118px] truncate text-[12px] leading-[17px] text-foreground/40">
              {current || '—'}
            </span>
          </div>
        </div>
        {data?.canSwitch && <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />}
      </div>
    );

    // Single-branch users can't switch — render a static card.
    if (!data?.canSwitch) {
      return <div className="w-full">{card}</div>;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button className="group/branch w-full text-left outline-none" disabled={busy} />}
        >
          {card}
        </DropdownMenuTrigger>
        {branchMenu}
      </DropdownMenu>
    );
  }

  // ── Header variant (default) ──────────────────────────────────────────────
  if (!data || data.branches.length === 0) return null;

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
      {branchMenu}
    </DropdownMenu>
  );
}
