'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Override width/height etc. Defaults to the standard 342px-wide, h-10 bar. */
  className?: string;
}

/**
 * SearchBar — the single, app-wide search input.
 *
 * Used across every list page (inventory, sales, customers, suppliers…) so the
 * search field looks and behaves identically everywhere. Active state is kept
 * neutral (no brand colour) per design direction.
 */
export function SearchBar({ value, onChange, placeholder = 'Search...', className }: SearchBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-[5px] h-10 px-[13px] border border-border rounded-[8px] bg-background focus-within:border-foreground/30 transition-colors w-[342px]',
        className,
      )}
    >
      <Search size={16} className="text-muted-foreground shrink-0" strokeWidth={1.8} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[12.25px] text-foreground placeholder:text-muted-foreground font-normal"
      />
      {value && (
        <Button variant="ghost" size="icon-xs" onClick={() => onChange('')}>
          <X size={14} />
        </Button>
      )}
    </div>
  );
}
