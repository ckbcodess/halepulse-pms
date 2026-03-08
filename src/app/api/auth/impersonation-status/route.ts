import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ impersonating: false });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get('sa_impersonate')?.value;
  if (!raw) {
    return NextResponse.json({ impersonating: false });
  }

  try {
    const { tenantId, role } = JSON.parse(raw);
    return NextResponse.json({ impersonating: true, tenantId, role });
  } catch {
    return NextResponse.json({ impersonating: false });
  }
}
