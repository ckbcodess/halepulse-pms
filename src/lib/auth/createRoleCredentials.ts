import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';

export interface RoleCredentialResult {
  credentialCode: string;
  role: string;       // role slug (MGR, PHM, MCA, AUD)
  roleName: string;   // display name
  password: string;   // plaintext temp password (shown once)
}

const ROLE_DEFS: { slug: string; appRole: string; name: string }[] = [
  { slug: 'MGR', appRole: 'MANAGER',    name: 'Manager' },
  { slug: 'PHM', appRole: 'PHARMACIST', name: 'Pharmacist' },
  { slug: 'MCA', appRole: 'MCA',        name: 'MCA' },
  { slug: 'AUD', appRole: 'AUDIT',      name: 'Audit' },
];

/**
 * Auto-creates the 4 role-credential users for a branch.
 * Returns each credential code + plaintext password so the caller can surface them once.
 */
export async function createRoleCredentials(args: {
  tenantId: string;
  branchId: string;
  branchBusinessId: string;
  client?: PrismaClient;
}): Promise<RoleCredentialResult[]> {
  const db = args.client ?? prisma;
  const results: RoleCredentialResult[] = [];

  for (const def of ROLE_DEFS) {
    const credentialCode = `${args.branchBusinessId}-${def.slug}`;
    const tempPassword = `${def.slug}${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await db.user.create({
      data: {
        username:           credentialCode.toLowerCase(),
        password:           'NEXTAUTH_MANAGED',
        role:               def.appRole,
        email:              `${args.branchBusinessId.toLowerCase()}-${def.slug.toLowerCase()}@system.local`,
        passwordHash,
        saasRole:           null,
        tenantId:           args.tenantId,
        branchId:           args.branchId,
        businessUsername:   def.slug,
        credentialCode,
        isRoleCredential:   true,
        mustChangePassword: false,
        isActive:           true,
      },
    });

    results.push({ credentialCode, role: def.slug, roleName: def.name, password: tempPassword });
  }

  return results;
}
