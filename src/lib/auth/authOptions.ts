import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import {
  checkLockout,
  checkIpRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  logLoginAttempt,
} from './loginSecurity';

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  NEXTAUTH_SECRET is not set in .env. Using a fallback secret.');
} else if (process.env.NODE_ENV !== 'production') {
  console.log('✅ NEXTAUTH_SECRET is loaded.');
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'halepulse-fallback-secret-for-dev-only',

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

        // 2. Normalise the username — accept either the role slug (MGR) or the
        //    full credential code (HAL001-MGR). Strip the businessId prefix.
        const rawUsername = credentials.username.trim();
        const prefix = `${credentials.businessId}-`;
        const strippedUsername = rawUsername.toUpperCase().startsWith(prefix.toUpperCase())
          ? rawUsername.slice(prefix.length)
          : rawUsername;
        const fullCredentialCode = `${credentials.businessId}-${strippedUsername}`;

        // 3. Find user — match role credentials (by credentialCode / businessUsername)
        //    or fall back to legacy individual accounts.
        const user = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            isActive: true,
            OR: [
              { credentialCode: fullCredentialCode },
              { businessUsername: strippedUsername },
              { businessUsername: rawUsername },
              { email: rawUsername },           // Allow email as username fallback
              { username: rawUsername },         // Legacy username fallback
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

        // 6. Resolve active person assignment for role credentials
        let assignedPerson: string | null = null;
        if (user.isRoleCredential) {
          const assignment = await prisma.personAssignment.findFirst({
            where: { userId: user.id, isActive: true },
            orderBy: { assignedAt: 'desc' },
            select: { personName: true },
          });
          assignedPerson = assignment?.personName ?? null;
        }

        // Branch credentials use the app-role level so branch scoping locks them
        // to their home branch (level >= 2). MANAGER→2, PHARMACIST→3, MCA/AUDIT→4.
        const APP_LEVEL: Record<string, number> = {
          MANAGER: 2, PHARMACIST: 3, MCA: 4, AUDIT: 4, NES: 4,
        };
        const roleLevel = user.isRoleCredential
          ? (APP_LEVEL[user.role] ?? 4)
          : (user.dynamicRole?.level ?? 3);

        // 7. Return user object with role + credential info
        return {
          id:                 String(user.id),
          email:              user.email ?? user.username,
          role:               user.saasRole ?? (user.isRoleCredential ? user.role : user.dynamicRole?.slug) ?? 'viewer',
          tenantId:           user.tenantId,
          branchId:           user.branchId ?? null,
          dynamicRoleId:      user.dynamicRoleId ?? null,
          dynamicRoleSlug:    user.dynamicRole?.slug ?? null,
          roleLevel,
          mustChangePassword: user.mustChangePassword,
          businessId:         tenant.businessId ?? null,
          credentialCode:     user.credentialCode ?? null,
          assignedPerson,
          firstName:          user.firstName ?? null,
          lastName:           user.lastName ?? null,
          canCreateUsers:     user.canCreateUsers ?? false,
          primaryColor:       tenant.primaryColor ?? null,
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
          firstName:          user.firstName ?? null,
          lastName:           user.lastName ?? null,
          canCreateUsers:     user.canCreateUsers ?? false,
          primaryColor:       user.tenant?.primaryColor ?? null,
        };
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    // Provider 4: GOOGLE OAUTH — tenant staff single-click sign-in
    // Only enabled when GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are configured.
    // Uses the enterprise pattern: Google email must match a pre-provisioned
    // tenant user account. Self-registration is NOT allowed.
    // ═══════════════════════════════════════════════════════════════════════════
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId:     process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
  ],

  callbacks: {
    // ── Google OAuth gate — reject unprovisioned accounts ────────────────────
    // Self-registration is blocked: only pre-provisioned tenant users may sign in
    // with Google. Admins must create the account first via Super Admin panel.
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email) return false;
        const dbUser = await prisma.user.findFirst({
          where: { email: user.email, isActive: true, tenantId: { not: null } },
        });
        // Redirect back to login with a descriptive error param
        if (!dbUser) return '/login?error=NotProvisioned';
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // ── Google OAuth — populate custom JWT fields from DB ─────────────────
      // account is only present on the initial OAuth callback, so the DB lookup
      // runs once per sign-in, not on every request.
      if (account?.provider === 'google' && token.email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: token.email, isActive: true },
          include: { dynamicRole: true, tenant: true },
        });
        if (dbUser && dbUser.tenantId) {
          token.userId             = String(dbUser.id);
          token.role               = dbUser.saasRole ?? dbUser.dynamicRole?.slug ?? 'viewer';
          token.tenantId           = dbUser.tenantId;
          token.branchId           = dbUser.branchId ?? null;
          token.dynamicRoleId      = dbUser.dynamicRoleId ?? null;
          token.dynamicRoleSlug    = dbUser.dynamicRole?.slug ?? null;
          token.roleLevel          = dbUser.dynamicRole?.level ?? 3;
          token.mustChangePassword = dbUser.mustChangePassword;
          token.businessId         = dbUser.tenant?.businessId ?? null;
        }
        return token;
      }

      // ── Credentials providers — user object populated on sign-in ──────────
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
        token.credentialCode     = (user as any).credentialCode ?? null;
        token.assignedPerson     = (user as any).assignedPerson ?? null;
        token.firstName          = (user as any).firstName ?? null;
        token.lastName           = (user as any).lastName ?? null;
        token.canCreateUsers     = (user as any).canCreateUsers ?? false;
        token.primaryColor       = (user as any).primaryColor ?? null;
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
      session.user.credentialCode     = (token.credentialCode as string | null) ?? null;
      session.user.assignedPerson     = (token.assignedPerson as string | null) ?? null;
      session.user.firstName          = (token.firstName as string | null) ?? null;
      session.user.lastName           = (token.lastName as string | null) ?? null;
      session.user.canCreateUsers     = (token.canCreateUsers as boolean) ?? false;
      session.user.primaryColor       = (token.primaryColor as string | null) ?? null;
      return session;
    },
  },
};
