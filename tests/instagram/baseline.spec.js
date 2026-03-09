/**
 * baseline.spec.js
 *
 * Verifies that the baseline.js script (always-on, hides "Open Instagram" banners)
 * runs without errors and hides intent:// links on the mobile web.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/baseline.js');

test.describe('baseline (hide Open-app banners)', () => {
  test('script evaluates without runtime errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const js = fs.readFileSync(JS_FILE, 'utf-8');

    // Capture any console errors during injection
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.evaluate(js);
    await page.waitForTimeout(500); // let the initial _mlHideAppBanners() call complete

    expect(errors).toHaveLength(0);
  });

  test('intent:// links are not visible after baseline injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(js);
    await page.waitForTimeout(500);

    // All intent:// anchor parents should be hidden
    const intentLinks = page.locator('a[href^="intent://"]');
    const count = await intentLinks.count();
    for (let i = 0; i < count; i++) {
      const parent = intentLinks.nth(i).locator('..');
      await expect(parent).toBeHidden();
    }
  });

  test('"Open Instagram" buttons are not visible after baseline injection', async ({ page }) => {
    // Go to a public profile page — more likely to show "Open in app" prompts
    await page.goto('/instagram/', { waitUntil: 'networkidle' });

    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(js);
    await page.waitForTimeout(2_500); // let setInterval run once

    // No button should contain "Open Instagram" text
    const openButtons = page.locator('button').filter({ hasText: /open instagram/i });
    const count = await openButtons.count();
    for (let i = 0; i < count; i++) {
      const parent = openButtons.nth(i).locator('..');
      await expect(parent).toBeHidden();
    }
  });
});
