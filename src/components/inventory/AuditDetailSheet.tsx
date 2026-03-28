'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AuditActionBadge } from './AuditActionBadge';
import { AuditDiffView } from './AuditDiffView';
import { cn } from '@/lib/utils';
import {
  User, Calendar, Package, Truck, RotateCcw, CheckCircle2, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

export interface AuditEntry {
  id: number;
  actionType: string;
  productId: number | null;
  supplierId: number | null;
  performedBy: number;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  notes: string | null;
  performedAt: string;
  revertedAt: string | null;
  revertedBy: number | null;
  revertNote: string | null;
  product: { id: number; name: string } | null;
  supplier: { id: number; name: string } | null;
  performer: { id: number; username: string };
}

interface AuditDetailSheetProps {
  entry: AuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReverted: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ icon: Icon, label, value, className }: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={cn('flex items-start gap-2.5 text-[13px]', className)}>
      <Icon className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground">{value}</span>
      </div>
    </div>
  );
}

export function AuditDetailSheet({ entry, open, onOpenChange, onReverted }: AuditDetailSheetProps) {
  const { data: session } = useSession();
  const [reverting, setReverting] = useState(false);

  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPER_ADMIN';
  const isReverted = !!entry?.revertedAt;
  const canRevert = isManager && !isReverted && !!entry?.oldValue;

  // Creation events have no oldValue to revert to
  const isCreation = entry?.actionType?.endsWith('_CREATED');

  async function handleRevert() {
    if (!entry) return;
    setReverting(true);
    try {
      const res = await fetch('/api/inventory/audit-log/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogId: entry.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to revert');
        return;
      }

      toast.success('Change reverted successfully');
      onReverted();
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setReverting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col bg-background/95 backdrop-blur-xl backdrop-saturate-150 border-l border-border/50"
      >
        {entry && (
          <>
            {/* Header */}
            <SheetHeader className="pr-8">
              <div className="flex items-center gap-2.5">
                <AuditActionBadge actionType={entry.actionType} />
                {isReverted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-400 px-2 py-0.5 text-[11px] font-medium">
                    <RotateCcw className="size-3" />
                    Reverted
                  </span>
                )}
              </div>
              <SheetTitle className="text-[15px] font-semibold mt-1">
                Audit Entry #{entry.id}
              </SheetTitle>
              <SheetDescription className="text-[13px] text-muted-foreground">
                {entry.actionType === 'SALE_COMPLETED'
                  ? `Sale transaction #${(entry.newValue as any)?.saleId ?? ''}`
                  : entry.actionType === 'CUSTOMER_CREATED'
                    ? `New customer: ${(entry.newValue as any)?.name ?? ''}`
                    : entry.actionType === 'BULK_IMPORT'
                      ? `Bulk import operation`
                      : entry.actionType === 'SETTINGS_UPDATED'
                        ? 'Tenant settings change'
                        : entry.actionType === 'PASSWORD_CHANGED'
                          ? 'User password change'
                          : entry.actionType === 'CATEGORY_MARKUP_UPDATED'
                            ? 'Category markup adjustment'
                            : entry.product?.name
                              ? `Change to ${entry.product.name}`
                              : entry.supplier?.name
                                ? `Change to supplier: ${entry.supplier.name}`
                                : 'System audit entry'}
              </SheetDescription>
            </SheetHeader>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 space-y-5 custom-scrollbar">
              {/* Meta info */}
              <div className="space-y-2">
                <InfoRow icon={User} label="Performed by" value={entry.performer.username} />
                <InfoRow icon={Calendar} label="Date" value={formatDateTime(entry.performedAt)} />
                {entry.product && (
                  <InfoRow icon={Package} label="Product" value={entry.product.name} />
                )}
                {entry.supplier && (
                  <InfoRow icon={Truck} label="Supplier" value={entry.supplier.name} />
                )}
                {entry.notes && (
                  <InfoRow icon={Clock} label="Notes" value={entry.notes} />
                )}
              </div>

              {/* Separator */}
              <div className="border-t border-border/40" />

              {/* Diff view */}
              <div>
                <h4 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
                  Changes
                </h4>
                <AuditDiffView
                  oldValue={entry.oldValue}
                  newValue={entry.newValue}
                />
              </div>

              {/* Revert info if already reverted */}
              {isReverted && (
                <>
                  <div className="border-t border-border/40" />
                  <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-orange-700 dark:text-orange-400">
                      <CheckCircle2 className="size-3.5" />
                      Reverted
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {formatDateTime(entry.revertedAt!)}
                      {entry.revertNote && ` — ${entry.revertNote}`}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer — sticky at bottom */}
            {canRevert && !isCreation && (
              <SheetFooter className="border-t border-border/40 bg-background/80 backdrop-blur-sm">
                <ConfirmDialog
                  title="Revert this change?"
                  description={`This will restore ${entry.product?.name ?? 'the entity'} to its previous state. This action creates a new audit entry.`}
                  confirmLabel="Revert"
                  variant="destructive"
                  onConfirm={handleRevert}
                >
                  {(openConfirm) => (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openConfirm}
                      disabled={reverting}
                      className="w-full text-[13px]"
                    >
                      <RotateCcw className="size-3.5 mr-1.5" />
                      {reverting ? 'Reverting...' : 'Revert this change'}
                    </Button>
                  )}
                </ConfirmDialog>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
