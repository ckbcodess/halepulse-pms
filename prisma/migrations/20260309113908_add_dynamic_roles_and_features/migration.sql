-- CreateTable
CREATE TABLE "DynamicRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 3,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DynamicRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DynamicRolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dynamicRoleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "DynamicRolePermission_dynamicRoleId_fkey" FOREIGN KEY ("dynamicRoleId") REFERENCES "DynamicRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DynamicRolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DynamicMenuConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dynamicRoleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "menuItems" TEXT NOT NULL,
    CONSTRAINT "DynamicMenuConfig_dynamicRoleId_fkey" FOREIGN KEY ("dynamicRoleId") REFERENCES "DynamicRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DynamicMenuConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isGloballyOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TenantFeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "featureFlagId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TenantFeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TenantFeatureFlag_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "FeatureFlag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "username" TEXT,
    "tenantId" TEXT,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT,
    "legalName" TEXT,
    "address" TEXT,
    "licenceNumber" TEXT,
    "taxVatNumber" TEXT,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'basic',
    "primaryContact" TEXT,
    "primaryPhone" TEXT,
    "primaryEmail" TEXT
);
INSERT INTO "new_Tenant" ("createdAt", "id", "isActive", "logoUrl", "name", "primaryColor", "secondaryColor", "subdomain") SELECT "createdAt", "id", "isActive", "logoUrl", "name", "primaryColor", "secondaryColor", "subdomain" FROM "Tenant";
DROP TABLE "Tenant";
ALTER TABLE "new_Tenant" RENAME TO "Tenant";
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");
CREATE UNIQUE INDEX "Tenant_businessId_key" ON "Tenant"("businessId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "passwordHash" TEXT,
    "saasRole" TEXT,
    "tenantId" TEXT,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" DATETIME,
    "dynamicRoleId" TEXT,
    "businessUsername" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastPasswordChange" DATETIME,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_dynamicRoleId_fkey" FOREIGN KEY ("dynamicRoleId") REFERENCES "DynamicRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("branchId", "contact", "createdAt", "email", "id", "isActive", "lastActiveAt", "password", "passwordHash", "role", "saasRole", "tenantId", "username") SELECT "branchId", "contact", "createdAt", "email", "id", "isActive", "lastActiveAt", "password", "passwordHash", "role", "saasRole", "tenantId", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DynamicRole_tenantId_slug_key" ON "DynamicRole"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicRolePermission_dynamicRoleId_permissionKey_key" ON "DynamicRolePermission"("dynamicRoleId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicMenuConfig_dynamicRoleId_tenantId_key" ON "DynamicMenuConfig"("dynamicRoleId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureFlag_tenantId_featureFlagId_key" ON "TenantFeatureFlag"("tenantId", "featureFlagId");
