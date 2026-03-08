import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    branchId: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      tenantId: string | null;
      branchId: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: string;
    tenantId: string | null;
    branchId: string | null;
  }
}
