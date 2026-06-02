import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/getTenantContext';
import prisma from '@/lib/prisma';

// ── GET /api/import/jobs — recent import jobs for the tenant (blueprint §13.5) ─
export async function GET() {
  try {
    const ctx = await getTenantContext();
    const jobs = await prisma.importJob.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        entityType: j.entityType,
        fileName: j.fileName,
        status: j.status,
        totalRows: j.totalRows,
        successCount: j.successCount,
        failureCount: j.failureCount,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'No tenant context') {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load import jobs' }, { status: 500 });
  }
}
