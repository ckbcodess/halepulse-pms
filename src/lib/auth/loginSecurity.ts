/**
 * Login security utilities: lockout tracking, IP rate limiting,
 * attempt logging, and password validation.
 */
import prisma from '@/lib/prisma';

const MAX_ATTEMPTS       = 5;
const LOCKOUT_MINUTES    = 30;

// IP-based rate limiting constants
// Uses the existing LoginAttempt table — no Redis or extra infrastructure needed.
const MAX_IP_FAILURES   = 20;
const IP_WINDOW_MINUTES = 15;

// ── Account Lockout ──────────────────────────────────────────────────────────

export async function checkLockout(userId: number): Promise<{ locked: boolean; minutesRemaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true, lockedUntil: true },
  });
  if (!user) return { locked: false, minutesRemaining: 0 };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { locked: true, minutesRemaining: remaining };
  }

  // Lockout expired — reset if it was locked
  if (user.lockedUntil && user.lockedUntil <= new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  return { locked: false, minutesRemaining: 0 };
}

export async function recordFailedAttempt(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true },
  });
  if (!user) return;

  const newCount = user.failedLoginCount + 1;
  const updateData: any = { failedLoginCount: newCount };

  if (newCount >= MAX_ATTEMPTS) {
    updateData.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });
}

export async function resetFailedAttempts(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}

// ── IP-based Rate Limiting ────────────────────────────────────────────────────

/**
 * Checks whether an IP address has exceeded the failure threshold within the
 * rolling time window. Uses the LoginAttempt table — no extra infrastructure.
 */
export async function checkIpRateLimit(
  ipAddress: string,
): Promise<{ blocked: boolean; retryAfterMinutes: number }> {
  if (!ipAddress) return { blocked: false, retryAfterMinutes: 0 };

  const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000);

  const failureCount = await prisma.loginAttempt.count({
    where: { ipAddress, success: false, createdAt: { gte: since } },
  });

  if (failureCount >= MAX_IP_FAILURES) {
    return { blocked: true, retryAfterMinutes: IP_WINDOW_MINUTES };
  }
  return { blocked: false, retryAfterMinutes: 0 };
}

// ── Login Attempt Logging ────────────────────────────────────────────────────

export async function logLoginAttempt(data: {
  email?: string;
  username?: string;
  tenantId?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({ data });
  } catch (e) {
    console.error('Failed to log login attempt:', e);
  }
}

// ── Password Complexity Validation ───────────────────────────────────────────

export function validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Must contain at least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain at least one special character');

  return { valid: errors.length === 0, errors };
}
