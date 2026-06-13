import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
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
    credentialCode?: string | null;
    assignedPerson?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    canCreateUsers?: boolean;
    primaryColor?: string | null;
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
      credentialCode?: string | null;
      assignedPerson?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      canCreateUsers?: boolean;
      primaryColor?: string | null;
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
    credentialCode?: string | null;
    assignedPerson?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    canCreateUsers?: boolean;
    primaryColor?: string | null;
  }
}
