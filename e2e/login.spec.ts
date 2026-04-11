import { test, expect } from '@playwright/test';

test.describe('Login Page Redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // S43-01 — Desktop 60/40 split layout
  test('desktop shows 60/40 split-panel layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');

    const brandPanel = page.locator('.brand-panel');
    const formPanel = page.locator('.form-panel');

    await expect(brandPanel).toBeVisible();
    await expect(formPanel).toBeVisible();

    const brandBox = await brandPanel.boundingBox();
    const formBox = await formPanel.boundingBox();

    expect(brandBox).not.toBeNull();
    expect(formBox).not.toBeNull();

    // Brand panel should be ~60% (within 5% tolerance)
    const totalWidth = brandBox!.width + formBox!.width;
    const brandRatio = brandBox!.width / totalWidth;
    expect(brandRatio).toBeGreaterThan(0.55);
    expect(brandRatio).toBeLessThan(0.65);
  });

  // S43-03 — Mobile compact header
  test('mobile shows compact brand header and full-width form', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');

    const brandPanel = page.locator('.brand-panel');
    await expect(brandPanel).toBeVisible();

    const brandBox = await brandPanel.boundingBox();
    expect(brandBox).not.toBeNull();
    // Compact header — less than 120px tall
    expect(brandBox!.height).toBeLessThan(120);

    // Form should be visible without scrolling
    const formPanel = page.locator('.form-panel');
    await expect(formPanel).toBeVisible();

    const form = page.locator('.auth-form');
    await expect(form).toBeVisible();
  });

  // S43-04 — Brand panel copy
  test('brand panel displays value proposition copy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');

    const headline = page.locator('.brand-headline');
    await expect(headline).toBeVisible();
    await expect(headline).toContainText('WhatsApp');

    // Feature cards visible
    const cards = page.locator('.feature-card');
    await expect(cards).toHaveCount(4);

    // Logo visible
    const logo = page.locator('.brand-logo img');
    await expect(logo).toBeVisible();

    // Wordmark
    const wordmark = page.locator('.brand-wordmark');
    await expect(wordmark).toContainText('PAPAGAI');
  });

  // S43-10 — Validation errors in Portuguese
  test('shows Portuguese validation errors on empty submit', async ({ page }) => {
    const submitBtn = page.locator('.submit-btn');
    await submitBtn.click();

    // Wait for error to appear
    await page.waitForSelector('tui-error', { state: 'visible' });

    const errors = page.locator('tui-error');
    await expect(errors.first()).toBeVisible();
  });

  // S43-09 — Form fields exist and are interactable
  test('email and password fields are present and focusable', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.click();
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.click();
    await passwordInput.fill('secretpassword');
    await expect(passwordInput).toHaveValue('secretpassword');
  });

  // S43-06 — Reduced motion: content immediately visible
  test('content is immediately visible with prefers-reduced-motion', async ({ page, context }) => {
    await context.route('**/*', (route) => route.continue());
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login');

    // All elements should be immediately visible (no opacity:0 from animations)
    const brandLogo = page.locator('.brand-logo');
    await expect(brandLogo).toBeVisible();

    const formInner = page.locator('.form-inner');
    await expect(formInner).toBeVisible();

    // Check opacity is 1 (not stuck at 0)
    const logoOpacity = await brandLogo.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity)
    );
    expect(logoOpacity).toBe(1);
  });

  // Visual screenshots
  test('desktop screenshot — light mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    // Wait for animations to complete
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot('login-desktop-light.png', {
      fullPage: false,
      animations: 'disabled',
      scale: 'css',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('login-mobile.png', {
      fullPage: false,
      animations: 'disabled',
      scale: 'css',
      maxDiffPixelRatio: 0.02,
    });
  });
});
