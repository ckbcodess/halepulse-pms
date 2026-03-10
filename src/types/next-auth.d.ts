import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    role: string;               // Legacy enum string (SUPER_ADMIN, MANAGER, etc.) — kept for backward compat
    tenantId: string | null;
    branchId: string | null;
    // Phase 2: Dynamic role fields
    dynamicRoleId: string | null;
    dynamicRoleSlug: string | null;
    roleLevel: number;           // 0=SuperAdmin, 1=BusinessAdmin, 2=Manager, 3=Viewer
    mustChangePassword: boolean;
    businessId: string | null;   // Human-readable Business ID (e.g., "PH-00001")
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      tenantId: string | null;
      branchId: string | null;
      dynamicRoleId: string | null;
      dynamicRoleSlug: string | null;
      roleLevel: number;
      mustChangePassword: boolean;
      businessId: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: string;
    tenantId: string | null;
    branchId: string | null;
    dynamicRoleId: string | null;
    dynamicRoleSlug: string | null;
    roleLevel: number;
    mustChangePassword: boolean;
    businessId: string | null;
  }
}
