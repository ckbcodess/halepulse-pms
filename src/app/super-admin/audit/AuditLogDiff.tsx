'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}

export default function AuditLogDiff({ oldValue, newValue }: Props) {
  const [open, setOpen] = useState(false);

  if (!oldValue && !newValue) return null;

  // Build diff: show keys that changed
  const allKeys = new Set([
    ...Object.keys(oldValue ?? {}),
    ...Object.keys(newValue ?? {}),
  ]);

  const changes: { key: string; old: unknown; new: unknown; changed: boolean }[] = [];
  for (const key of allKeys) {
    const o = oldValue?.[key];
    const n = newValue?.[key];
    const changed = JSON.stringify(o) !== JSON.stringify(n);
    changes.push({ key, old: o, new: n, changed });
  }
  const changedOnly = changes.filter(c => c.changed);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {changedOnly.length} change{changedOnly.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-1 max-w-xs">
          {changedOnly.map(c => (
            <div key={c.key} className="text-[10px] font-mono">
              <span className="font-bold text-foreground">{c.key}:</span>
              {' '}
              {oldValue && c.old !== undefined && (
                <span className="text-rose-500 line-through mr-1">{JSON.stringify(c.old)}</span>
              )}
              {newValue && c.new !== undefined && (
                <span className="text-emerald-600">{JSON.stringify(c.new)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
