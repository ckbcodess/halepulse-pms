import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email as string },
        });

        if (!user || !user.isActive || !user.passwordHash || !user.saasRole) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!isValid) return null;

        return {
          id:       String(user.id),
          email:    user.email!,
          role:     user.saasRole,
          tenantId: user.tenantId ?? null,
          branchId: user.branchId ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId   = user.id;
        token.email    = user.email;
        token.role     = (user as any).role;
        token.tenantId = (user as any).tenantId ?? null;
        token.branchId = (user as any).branchId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id       = token.userId as string;
      session.user.email    = token.email  as string;
      session.user.role     = token.role   as string;
      session.user.tenantId = token.tenantId as string | null;
      session.user.branchId = token.branchId as string | null;
      return session;
    },
  },
};
