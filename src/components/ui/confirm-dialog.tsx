'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void | Promise<void>;
  children: (open: () => void) => ReactNode;
}

/**
 * Headless confirm dialog — renders a trigger via render-prop and shows
 * a centered modal overlay when opened.
 *
 * Usage:
 *   <ConfirmDialog title="Archive?" onConfirm={handleArchive}>
 *     {(open) => <Button onClick={open}>Archive</Button>}
 *   </ConfirmDialog>
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => { if (!loading) setIsOpen(false); }, [loading]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {children(open)}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {/* Dialog */}
          <div className="relative bg-background border border-border rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-[13px] text-muted-foreground mt-1.5">{description}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={close} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button
                variant={variant === 'destructive' ? 'destructive' : 'default'}
                size="sm"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? 'Processing…' : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
