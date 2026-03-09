/**
 * ig_no_scroll_reels.spec.js
 *
 * Verifies that the ig_no_scroll_reels JS filter locks the reels scroll container.
 *
 * The test checks:
 *   1. The script finds and locks a scroll container (sets _mlReelContainer)
 *   2. After injection, attempting to scroll the container does not change its scrollTop
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_no_scroll_reels.js');

test.describe('ig_no_scroll_reels filter', () => {
  test('reels scroll container is found and locked after JS injection', async ({ page }) => {
    // Navigate to the reels page where the snap/transform container appears
    await page.goto('/reels/', { waitUntil: 'networkidle' });

    // Wait for a video to appear (confirms reels content loaded)
    await page.waitForSelector('video', { timeout: 30_000 });

    // Inject the filter
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(js);

    // Give the setInterval (500ms) time to find and lock the container
    await page.waitForTimeout(2_000);

    // Check that the script found a container to lock
    const locked = await page.evaluate(() => window._mlReelContainer !== null && window._mlReelContainer !== undefined);
    expect(locked).toBe(true);

    // Try to scroll the container and verify the position does not change
    const scrollResult = await page.evaluate(() => {
      const container = window._mlReelContainer;
      if (!container) return { error: 'no container' };

      const before = container.scrollTop;
      container.scrollTop = before + 500;
      const after = container.scrollTop;
      return { before, after, changed: after !== before };
    });

    expect(scrollResult.error).toBeUndefined();
    expect(scrollResult.changed).toBe(false);
  });
});
