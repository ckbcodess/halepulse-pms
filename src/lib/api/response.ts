import { NextResponse } from 'next/server';

/**
 * Standard API envelope (blueprint §9.1): { success, data, error, meta }.
 *
 * Introduced here as the canonical shape; new routes use it and existing routes
 * migrate to it incrementally (their current ad-hoc shapes still work meanwhile).
 */
export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  has_more?: boolean;
}

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ success: true, data, error: null, ...(meta ? { meta } : {}) }, { status });
}

export function fail(code: string, message: string, status = 400, field?: string) {
  return NextResponse.json({ success: false, data: null, error: { code, message, ...(field ? { field } : {}) } }, { status });
}

/** Maps thrown auth/tenant errors to the right status + envelope. */
export function failFromError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (message === 'Unauthorized') return fail('unauthorized', message, 401);
  if (message === 'No tenant context' || message.startsWith('No tenant context')) return fail('no_tenant_context', message, 401);
  if (message === 'Forbidden') return fail('forbidden', message, 403);
  return fail('internal_error', 'Something went wrong', 500);
}

/** Builds pagination meta from page/limit/total. */
export function pageMeta(page: number, limit: number, total: number): ApiMeta {
  return { page, limit, total, has_more: page * limit < total };
}
