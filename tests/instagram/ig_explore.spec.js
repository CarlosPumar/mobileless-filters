/**
 * ig_explore.spec.js
 *
 * Verifies that the ig_explore CSS filter hides the Explore navigation link.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CSS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_explore.css');

test.describe('ig_explore filter', () => {
  test('explore nav link is visible before injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const exploreLink = page.locator('a[href="/explore/"]').first();
    await expect(exploreLink).toBeVisible();
  });

  test('explore nav link is hidden after CSS injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const css = fs.readFileSync(CSS_FILE, 'utf-8');
    await page.evaluate((cssText) => {
      const style = document.createElement('style');
      style.id = 'mobileless-filters';
      style.textContent = cssText;
      document.head.appendChild(style);
    }, css);

    const exploreLink = page.locator('a[href="/explore/"]').first();
    await expect(exploreLink).toBeHidden();
  });
});
