'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Package, CalendarClock, CalendarX } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Item { type: 'low_stock' | 'expiry' | 'refill'; title: string; detail: string; href: string }

const ICON = { low_stock: Package, expiry: CalendarX, refill: CalendarClock };

export default function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json;
        setItems(data.items ?? []);
        setCount(data.count ?? 0);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120000); // refresh every 2 min
    return () => clearInterval(t);
  }, [load]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}>
        <Bell size={16} strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-destructive rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80">
        <DropdownMenuLabel>Notifications {count > 0 && `(${count})`}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            {items.map((it, i) => {
              const Icon = ICON[it.type];
              return (
                <Link key={i} href={it.href} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted transition-colors">
                  <Icon size={15} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{it.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{it.detail}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
