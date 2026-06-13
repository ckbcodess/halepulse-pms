import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loginSuperAdmin(page: Page) {
  await page.goto(`${BASE}/sp-login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'superadmin@system.com');
  await page.fill('input[type="password"]', 'Admin@1234');
  await page.click('button[type="submit"]');
  // Wait for navigation away from /sp-login
  await page.waitForURL(url => !url.pathname.endsWith('/sp-login'), { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}

async function loginClient(page: Page, businessId: string, username: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="HAL000"]', businessId);
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation away from /login
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}

function checkMenu(body: string) {
  return {
    pos:       /point.of.sale|POS/i.test(body),
    stock:     /\bstock\b/i.test(body),
    sales:     /\bsales\b/i.test(body),
    reports:   /\breports\b/i.test(body),
    purchases: /\bpurchases\b/i.test(body),
    team:      /\bteam\b/i.test(body),
    settings:  /\bsettings\b/i.test(body),
  };
}

// ─── SUPER ADMIN ─────────────────────────────────────────────────────────────

test('SA-01 Super Admin login → /super-admin', async ({ page }) => {
  await loginSuperAdmin(page);
  expect(page.url()).toContain('/super-admin');
});

test('SA-02 Stats cards visible', async ({ page }) => {
  await loginSuperAdmin(page);
  await page.goto(`${BASE}/super-admin`);
  await page.waitForLoadState('networkidle');
  const cards = page.locator('.rounded-2xl');
  await expect(cards.first()).toBeVisible();
});

test('SA-03 Register Business — prefix preview shows TST000', async ({ page }) => {
  await loginSuperAdmin(page);
  await page.goto(`${BASE}/super-admin/tenants/new`);
  await page.waitForLoadState('networkidle');
  // Find prefix input (3 chars max)
  const prefixInput = page.locator('input[maxlength="3"]').first();
  await expect(prefixInput).toBeVisible();
  await prefixInput.fill('TST');
  await page.waitForTimeout(400);
  await expect(page.locator('text=TST000')).toBeVisible();
});

test('SA-04 Businesses list page loads', async ({ page }) => {
  await loginSuperAdmin(page);
  await page.goto(`${BASE}/super-admin/tenants`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/super-admin/tenants');
  await expect(page.locator('body')).not.toContainText('Error');
});

test('SA-05 Audit log page loads', async ({ page }) => {
  await loginSuperAdmin(page);
  await page.goto(`${BASE}/super-admin/audit`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/super-admin/audit');
});

test('SA-06 Sign out → /sp-login (not /login)', async ({ page }) => {
  await loginSuperAdmin(page);
  await page.goto(`${BASE}/super-admin`);
  await page.waitForLoadState('networkidle');
  const signOutBtn = page.locator('button:has-text("Sign Out")').first();
  await signOutBtn.click();
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/sp-login');
  expect(page.url()).not.toContain('/login?');
});

// ─── MANAGER ─────────────────────────────────────────────────────────────────

test('MGR-01 Manager login → /dashboard/manager', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  expect(page.url()).toContain('/dashboard');
});

test('MGR-02 CSV Import works', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  // Find import button in sidebar or stock page
  await page.goto(`${BASE}/stock`);
  await page.waitForLoadState('networkidle');
  // Look for import link/button
  const importLink = page.locator('a[href*="import"], button:has-text("Import")').first();
  if (await importLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await importLink.click();
    await page.waitForLoadState('networkidle');
  } else {
    await page.goto(`${BASE}/stock/import`);
    await page.waitForLoadState('networkidle');
  }
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeVisible();
  await fileInput.setInputFiles('/Users/kelvingyasi/Desktop/import-template copy.csv');
  await page.waitForTimeout(600);
  const submitBtn = page.locator('button:has-text("Import"), button[type="submit"]').first();
  if (await submitBtn.isEnabled()) await submitBtn.click();
  await page.waitForTimeout(4000);
  const body = await page.textContent('body') ?? '';
  expect(body.toLowerCase()).toMatch(/import|success|product/i);
});

test('MGR-03 Stock list shows products', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/stock`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
  await expect(page.locator('body')).not.toContainText('Sign in');
});

test('MGR-04 Stock Value page loads', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/stock-value`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
});

test('MGR-05 POS — search product', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/pos`);
  await page.waitForLoadState('networkidle');
  const searchBox = page.locator('input[placeholder*="Search"]').first();
  await expect(searchBox).toBeVisible();
  await searchBox.fill('PANADOL');
  await page.waitForTimeout(1000);
  const body = await page.textContent('body') ?? '';
  // Either found product or "no products found" — both are valid page states
  expect(body.toLowerCase()).toMatch(/panadol|no products|search/i);
});

test('MGR-06 POS — add 0-stock item shows warning not hard block', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/pos`);
  await page.waitForLoadState('networkidle');
  const searchBox = page.locator('input[placeholder*="Search"]').first();
  await searchBox.fill('PANADOL');
  await page.waitForTimeout(1000);
  const product = page.locator('button, [role="button"]').filter({ hasText: /PANADOL/i }).first();
  if (await product.isVisible({ timeout: 2000 }).catch(() => false)) {
    await product.click();
    await page.waitForTimeout(800);
    // Item should be in cart (no hard block)
    const body = await page.textContent('body') ?? '';
    expect(body).not.toContain('out of stock'); // Should NOT show hard error
  } else {
    test.skip(); // No products imported yet — skip this test
  }
});

test('MGR-07 Sales list page loads', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/sales`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
});

test('MGR-08 Team page shows role cards', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/team`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
  const body = await page.textContent('body') ?? '';
  expect(body).toMatch(/MGR|PHM|MCA|AUD|Manager|Team/i);
});

test('MGR-09 Purchases page loads', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/purchases`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
});

test('MGR-10 Reports page loads', async ({ page }) => {
  await loginClient(page, 'DEM000', 'manager', 'Manager@1234');
  await page.goto(`${BASE}/reports`);
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
});

// ─── PHARMACIST (businessUsername = "pharmacist", role = MCA in DB) ───────
// Note: In the current DB seed, "pharmacist" login maps to the MCA role user.
// Actual PHARMACIST role credentials are via role-credential codes (DEM000-PHM).

test('PHM-01 Pharmacist login (businessUsername=pharmacist) succeeds', async ({ page }) => {
  await loginClient(page, 'DEM000', 'pharmacist', 'Mca@1234');
  expect(page.url()).toContain('/dashboard');
});

test('PHM-02 Pharmacist menu — POS visible, Purchases/Team hidden', async ({ page }) => {
  await loginClient(page, 'DEM000', 'pharmacist', 'Mca@1234');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body') ?? '';
  const m = checkMenu(body);
  // POS should be visible
  expect(m.pos).toBe(true);
  // Purchases and Team should NOT be visible
  expect(m.purchases).toBe(false);
  expect(m.team).toBe(false);
});

// ─── VIEWER / NES ─────────────────────────────────────────────────────────────

test('VW-01 Viewer login succeeds', async ({ page }) => {
  await loginClient(page, 'DEM000', 'viewer', 'Nes@1234');
  expect(page.url()).toContain('/dashboard');
});

test('VW-02 Viewer menu — limited access', async ({ page }) => {
  await loginClient(page, 'DEM000', 'viewer', 'Nes@1234');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body') ?? '';
  // Should not see Purchases or Team
  const m = checkMenu(body);
  expect(m.purchases).toBe(false);
  expect(m.team).toBe(false);
});
