'use client';

import { ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  /** Shown on the trigger when no option matches the current value. */
  placeholder?: string;
  /** Trigger width — defaults to the standard 115px. */
  triggerClassName?: string;
  /** Popup width — defaults to 160px. */
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * FilterDropdown — the single, app-wide list-filter dropdown.
 *
 * Matches the inventory toolbar dropdowns (outline button + chevron, check on
 * the selected row) so every filter across the app looks the same.
 */
export function FilterDropdown({
  value, onChange, options, placeholder = 'Select',
  triggerClassName, contentClassName, align = 'start',
}: FilterDropdownProps) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className={cn('h-10 w-[115px] justify-between font-normal', triggerClassName)} />}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn('w-[160px]', contentClassName)} align={align}>
        <DropdownMenuGroup>
          {options.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
              <span className="flex-1">{o.label}</span>
              {value === o.value && <Check size={12} className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
