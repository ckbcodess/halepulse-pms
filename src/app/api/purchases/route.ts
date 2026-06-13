import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { branchWhere } from '@/lib/auth/branchScope';
import { logAction } from '@/lib/audit/logAction';

const CATEGORIES = ['Rent', 'Fuel', 'Internet', 'Electricity', 'Repairs', 'Transport', 'Miscellaneous', 'Other'];

// GET /api/purchases — list expenses for current branch/tenant
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const bf = await branchWhere(ctx);
    const sp = request.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');
    const category = sp.get('category');
    const search = sp.get('search');

    const where: any = { tenantId: ctx.tenantId, ...bf };
    if (category && category !== 'all') where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }
    if (search) where.description = { contains: search, mode: 'insensitive' };

    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
    return NextResponse.json({ expenses });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load expenses' }, { status: 500 });
  }
}

// POST /api/purchases — create an expense
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    if (ctx.role !== 'MANAGER' && ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'tenant_admin' && ctx.role !== 'branch_manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!ctx.branchId) return NextResponse.json({ error: 'No branch context' }, { status: 400 });

    const session = await getServerSession(authOptions);
    const body = await request.json();
    const amount = Number(body.amount);
    const category: string = body.category;

    if (!category || !CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        date: body.date ? new Date(body.date) : new Date(),
        category,
        amount,
        description: (body.description ?? '').trim() || null,
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        roleAccount: session?.user.credentialCode ?? null,
        assignedPerson: session?.user.assignedPerson ?? null,
      },
    });

    await logAction(ctx.userId, ctx.tenantId, 'EXPENSE_CREATED', { expenseId: expense.id, amount, category });
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message?.startsWith('No tenant')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
