import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth/authOptions';
import { validatePasswordComplexity } from '@/lib/auth/loginSecurity';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required.' },
        { status: 400 },
      );
    }

    // Validate complexity
    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      return NextResponse.json(
        { error: complexity.errors.join('. ') },
        { status: 400 },
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 },
      );
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash:       newHash,
        mustChangePassword: false,
        lastPasswordChange: new Date(),
        failedLoginCount:   0,
        lockedUntil:        null,
      },
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
