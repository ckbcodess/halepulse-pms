import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import { canSwitchBranch, getReadBranchId, SELECTED_BRANCH_COOKIE } from '@/lib/auth/branchScope';
import prisma from '@/lib/prisma';

// ── GET /api/branches — branches visible to the current user + selection state ──
// `?all=1` returns every active branch in the tenant (names only) for pickers
// such as transfer destinations, regardless of switch capability.
export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();

    if (new URL(request.url).searchParams.get('all')) {
      const all = await prisma.branch.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, isHeadquarters: true },
      });
      return NextResponse.json({ branches: all, homeBranchId: ctx.branchId });
    }

    const switchable = canSwitchBranch(ctx);

    const branches = await prisma.branch.findMany({
      where: switchable
        ? { tenantId: ctx.tenantId, isActive: true }
        : { id: ctx.branchId ?? '__no_branch__', tenantId: ctx.tenantId },
      orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isHeadquarters: true },
    });

    const selectedBranchId = await getReadBranchId(ctx);

    return NextResponse.json({
      branches,
      canSwitch: switchable,
      selectedBranchId, // null = all branches (only meaningful when canSwitch)
      homeBranchId: ctx.branchId,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load branches' }, { status: 500 });
  }
}

// ── POST /api/branches — set the selected branch (tenant-wide actors only) ──────
export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    if (!canSwitchBranch(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { branchId } = (await request.json()) as { branchId: string | null };

    // null / empty → view all branches (clear the cookie).
    if (!branchId) {
      const res = NextResponse.json({ ok: true, selectedBranchId: null });
      res.cookies.delete(SELECTED_BRANCH_COOKIE);
      return res;
    }

    // Validate the branch belongs to this tenant before trusting it.
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId: ctx.tenantId, isActive: true },
      select: { id: true },
    });
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const res = NextResponse.json({ ok: true, selectedBranchId: branch.id });
    res.cookies.set(SELECTED_BRANCH_COOKIE, branch.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to set branch' }, { status: 500 });
  }
}
