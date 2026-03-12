/**
 * Impersonation token signing/verification using HMAC-SHA256.
 * Replaces the previous raw JSON cookie with a tamper-proof signed payload.
 *
 * Format: base64(JSON_payload + "." + HMAC_signature)
 */
import { createHmac, timingSafeEqual } from 'crypto';

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set');
  return secret;
}

export function signImpersonation(payload: { tenantId: string; role: string }): string {
  const data = JSON.stringify(payload);
  const sig  = createHmac('sha256', getSecret()).update(data).digest('hex');
  return Buffer.from(`${data}.${sig}`).toString('base64');
}

export function verifyImpersonation(cookie: string): { tenantId: string; role: string } | null {
  try {
    const decoded  = Buffer.from(cookie, 'base64').toString('utf8');
    const lastDot  = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;

    const data        = decoded.substring(0, lastDot);
    const receivedSig = decoded.substring(lastDot + 1);
    const expectedSig = createHmac('sha256', getSecret()).update(data).digest('hex');

    // Timing-safe comparison prevents timing attacks
    const received = Buffer.from(receivedSig, 'hex');
    const expected = Buffer.from(expectedSig, 'hex');
    if (received.length !== expected.length) return null;
    if (!timingSafeEqual(received, expected)) return null;

    const { tenantId, role } = JSON.parse(data);
    if (typeof tenantId !== 'string' || typeof role !== 'string') return null;
    return { tenantId, role };
  } catch {
    return null;
  }
}
