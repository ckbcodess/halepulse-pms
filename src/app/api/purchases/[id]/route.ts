import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { logAction } from '@/lib/audit/logAction';

const CATEGORIES = ['Rent', 'Fuel', 'Internet', 'Electricity', 'Repairs', 'Transport', 'Miscellaneous', 'Other'];

function isManager(role: string): boolean {
  return role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'tenant_admin' || role === 'branch_manager';
}

// PUT /api/purchases/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getTenantContext();
    if (!isManager(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.expense.findFirst({
      where: { id, tenantId: ctx.tenantId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) },
    });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      data.category = body.category;
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      data.amount = amount;
    }
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.description !== undefined) data.description = (body.description ?? '').trim() || null;

    const expense = await prisma.expense.update({ where: { id }, data });
    await logAction(ctx.userId, ctx.tenantId, 'EXPENSE_UPDATED', { expenseId: id });
    return NextResponse.json({ expense });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE /api/purchases/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getTenantContext();
    if (!isManager(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.expense.findFirst({
      where: { id, tenantId: ctx.tenantId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) },
    });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    await prisma.expense.delete({ where: { id } });
    await logAction(ctx.userId, ctx.tenantId, 'EXPENSE_DELETED', { expenseId: id });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
