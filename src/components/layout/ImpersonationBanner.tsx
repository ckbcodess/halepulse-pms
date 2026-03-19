'use client';
import { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';

interface ImpersonationContext {
  tenantId: string;
  role: string;
}

export default function ImpersonationBanner() {
  const [ctx, setCtx] = useState<ImpersonationContext | null>(null);

  useEffect(() => {
    // Read the cookie client-side (it's httpOnly so we use an API)
    fetch('/api/auth/impersonation-status')
      .then(r => r.json())
      .then(data => { if (data.impersonating) setCtx(data); })
      .catch(() => {});
  }, []);

  if (!ctx) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-3 text-sm font-bold shadow-lg">
      <Eye size={16} />
      <span>Viewing as {ctx.role} — Impersonation Mode</span>
      <a
        href="/super-admin/stop-impersonate"
        className="ml-4 flex items-center gap-1 bg-primary-foreground text-primary px-3 py-1 rounded-md text-xs font-bold transition-colors hover:bg-primary-foreground/90"
      >
        <X size={12} /> Exit
      </a>
    </div>
  );
}
