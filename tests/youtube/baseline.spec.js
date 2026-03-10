/**
 * baseline.spec.js (YouTube)
 *
 * Verifies that the YouTube baseline.js script (always-on, hides "Open App"
 * intent:// links) runs without errors and hides those links.
 *
 * Tests:
 * 1. Script evaluates without runtime errors.
 * 2. intent:// "Open App" links are hidden after baseline injection.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/youtube/baseline.js');

async function injectBaseline(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(js);
}

test.describe('YouTube baseline (hide Open App banners)', () => {

  // ─── 1. No runtime errors ────────────────────────────────────────────────

  test('script evaluates without runtime errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await injectBaseline(page);
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });

  // ─── 2. intent:// links hidden ───────────────────────────────────────────

  test('intent:// "Open App" links are hidden after baseline injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await injectBaseline(page);
    await page.waitForTimeout(2_500); // let setInterval run once

    // Each intent:// anchor's parent (ytm-button-renderer) should be hidden
    const intentLinks = page.locator('a[href^="intent://"]');
    const count = await intentLinks.count();
    for (let i = 0; i < count; i++) {
      const parent = intentLinks.nth(i).locator('..');
      await expect(parent).toBeHidden();
    }
  });

});
