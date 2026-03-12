import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import {
  checkLockout,
  checkIpRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  logLoginAttempt,
} from './loginSecurity';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },

  providers: [
    // ═══════════════════════════════════════════════════════════════════════════
    // Provider 1: CLIENT PORTAL — 3-field login (Business ID + Username + Password)
    // ═══════════════════════════════════════════════════════════════════════════
    CredentialsProvider({
      id:   'client-credentials',
      name: 'Client Login',
      credentials: {
        businessId: { label: 'Business ID', type: 'text' },
        username:   { label: 'Username',    type: 'text' },
        password:   { label: 'Password',    type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.businessId || !credentials?.username || !credentials?.password) {
          return null;
        }

        // 0. IP-based rate limit — blocks botnet brute force across accounts
        const ipAddress = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
          || (req?.headers?.['x-real-ip'] as string)
          || 'unknown';
        const ipCheck = await checkIpRateLimit(ipAddress);
        if (ipCheck.blocked) {
          throw new Error(`Too many failed attempts from this location. Try again in ${ipCheck.retryAfterMinutes} minutes.`);
        }

        // 1. Find tenant by Business ID
        const tenant = await prisma.tenant.findFirst({
          where: {
            businessId: credentials.businessId,
            isActive: true,
          },
        });
        if (!tenant) return null;

        // 2. Find user by businessUsername + tenantId (or fallback to email)
        const user = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            isActive: true,
            OR: [
              { businessUsername: credentials.username },
              { email: credentials.username },           // Allow email as username fallback
              { username: credentials.username },         // Legacy username fallback
            ],
          },
          include: {
            dynamicRole: true,
          },
        });
        if (!user || !user.passwordHash) return null;

        // 3. Check account lockout
        const lockout = await checkLockout(user.id);
        if (lockout.locked) {
          await logLoginAttempt({
            username: credentials.username,
            tenantId: tenant.id,
            success:  false,
          });
          throw new Error(`Account locked. Try again in ${lockout.minutesRemaining} minutes.`);
        }

        // 4. Verify password
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          await recordFailedAttempt(user.id);
          await logLoginAttempt({
            username: credentials.username,
            tenantId: tenant.id,
            success:  false,
          });
          return null;
        }

        // 5. Success — reset failed attempts
        await resetFailedAttempts(user.id);
        await logLoginAttempt({
          username: credentials.username,
          tenantId: tenant.id,
          success:  true,
        });

        // 6. Return user object with dynamic role info
        return {
          id:                 String(user.id),
          email:              user.email ?? user.username,
          role:               user.saasRole ?? user.dynamicRole?.slug ?? 'viewer',
          tenantId:           user.tenantId,
          branchId:           user.branchId ?? null,
          dynamicRoleId:      user.dynamicRoleId ?? null,
          dynamicRoleSlug:    user.dynamicRole?.slug ?? null,
          roleLevel:          user.dynamicRole?.level ?? 3,
          mustChangePassword: user.mustChangePassword,
          businessId:         tenant.businessId ?? null,
        };
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    // Provider 2: SP PORTAL — Email-based login (Super Admin only)
    // ═══════════════════════════════════════════════════════════════════════════
    CredentialsProvider({
      id:   'sp-credentials',
      name: 'SP Login',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // IP-based rate limit on super admin portal — high-value target
        const ipAddress = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
          || (req?.headers?.['x-real-ip'] as string)
          || 'unknown';
        const ipCheck = await checkIpRateLimit(ipAddress);
        if (ipCheck.blocked) {
          throw new Error(`Too many failed attempts from this location. Try again in ${ipCheck.retryAfterMinutes} minutes.`);
        }

        const user = await prisma.user.findFirst({
          where: { email: credentials.email },
          include: { dynamicRole: true },
        });

        if (!user || !user.isActive || !user.passwordHash) return null;

        // SP login only allows Super Admin (level 0 or saasRole SUPER_ADMIN)
        const isSuperAdmin =
          user.saasRole === 'SUPER_ADMIN' ||
          user.dynamicRole?.level === 0;
        if (!isSuperAdmin) return null;

        // Check lockout
        const lockout = await checkLockout(user.id);
        if (lockout.locked) {
          await logLoginAttempt({
            email:   credentials.email,
            success: false,
          });
          throw new Error(`Account locked. Try again in ${lockout.minutesRemaining} minutes.`);
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          await recordFailedAttempt(user.id);
          await logLoginAttempt({
            email:   credentials.email,
            success: false,
          });
          return null;
        }

        // Success
        await resetFailedAttempts(user.id);
        await logLoginAttempt({
          email:   credentials.email,
          success: true,
        });

        return {
          id:                 String(user.id),
          email:              user.email!,
          role:               'SUPER_ADMIN',
          tenantId:           null,
          branchId:           null,
          dynamicRoleId:      user.dynamicRoleId ?? null,
          dynamicRoleSlug:    user.dynamicRole?.slug ?? 'super_admin',
          roleLevel:          0,
          mustChangePassword: user.mustChangePassword,
          businessId:         null,
        };
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    // Provider 3: LEGACY — Email + Password (backward compat, non-SP users)
    // ═══════════════════════════════════════════════════════════════════════════
    CredentialsProvider({
      id:   'credentials',
      name: 'Legacy Login',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email },
          include: {
            dynamicRole: true,
            tenant: true,
          },
        });

        if (!user || !user.isActive || !user.passwordHash || !user.saasRole) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id:                 String(user.id),
          email:              user.email!,
          role:               user.saasRole,
          tenantId:           user.tenantId ?? null,
          branchId:           user.branchId ?? null,
          dynamicRoleId:      user.dynamicRoleId ?? null,
          dynamicRoleSlug:    user.dynamicRole?.slug ?? null,
          roleLevel:          user.dynamicRole?.level ?? 3,
          mustChangePassword: user.mustChangePassword,
          businessId:         user.tenant?.businessId ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId             = user.id;
        token.email              = user.email;
        token.role               = (user as any).role;
        token.tenantId           = (user as any).tenantId ?? null;
        token.branchId           = (user as any).branchId ?? null;
        token.dynamicRoleId      = (user as any).dynamicRoleId ?? null;
        token.dynamicRoleSlug    = (user as any).dynamicRoleSlug ?? null;
        token.roleLevel          = (user as any).roleLevel ?? 3;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
        token.businessId         = (user as any).businessId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id                 = token.userId as string;
      session.user.email              = token.email as string;
      session.user.role               = token.role as string;
      session.user.tenantId           = token.tenantId as string | null;
      session.user.branchId           = token.branchId as string | null;
      session.user.dynamicRoleId      = token.dynamicRoleId as string | null;
      session.user.dynamicRoleSlug    = token.dynamicRoleSlug as string | null;
      session.user.roleLevel          = token.roleLevel as number;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      session.user.businessId         = token.businessId as string | null;
      return session;
    },
  },
};
