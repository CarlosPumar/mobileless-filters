/**
 * ig_reels.spec.js
 *
 * Verifies that the ig_reels filter:
 *   1. Hides the Reels navigation link (CSS)
 *   2. Hides reel posts in the feed (JS)
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CSS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_reels.css');
const JS_FILE  = path.resolve(__dirname, '../../filters/instagram/ig_reels.js');

test.describe('ig_reels filter', () => {
  test('reels nav link is visible before injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const reelsLink = page.locator('a[href="/reels/"]').first();
    await expect(reelsLink).toBeVisible();
  });

  test('reels nav link is hidden after CSS injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const css = fs.readFileSync(CSS_FILE, 'utf-8');
    await page.evaluate((cssText) => {
      const style = document.createElement('style');
      style.id = 'mobileless-filters';
      style.textContent = cssText;
      document.head.appendChild(style);
    }, css);

    const reelsLink = page.locator('a[href="/reels/"]').first();
    await expect(reelsLink).toBeHidden();
  });

  test('reel posts in feed are hidden after JS injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for feed to load
    await page.waitForSelector('article', { timeout: 20_000 });

    // Inject JS (wrap in IIFE so multi-statement JS works as an expression)
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(`(function(){\n${js}\n})()`);

    // Wait for setInterval to run
    await page.waitForTimeout(2_000);

    // No article wrapping a /reel/ link should be visible
    const reelArticles = page.locator('article:has(a[href*="/reel/"])');
    const count = await reelArticles.count();
    for (let i = 0; i < count; i++) {
      await expect(reelArticles.nth(i)).toBeHidden();
    }
  });
});
