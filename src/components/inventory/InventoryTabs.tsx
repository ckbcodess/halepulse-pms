'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Products', href: '/inventory' },
  { label: 'Suppliers', href: '/inventory/suppliers' },
];

export default function InventoryTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-border -mb-4">
      {TABS.map(({ label, href }) => {
        const isActive =
          href === '/inventory'
            ? pathname === '/inventory'
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`
              relative px-3 pb-2.5 pt-0.5 text-[13px] font-medium transition-colors
              ${isActive
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground after:rounded-t-full'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
