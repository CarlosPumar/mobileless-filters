/**
 * ig_no_scroll_reels.spec.js
 *
 * Verifies that the ig_no_scroll_reels JS filter locks the reels scroll container.
 *
 * The test verifies the observable DOM effects of the filter rather than internal
 * implementation variables (which are scoped inside the IIFE wrapper used for injection):
 *   - For transform-based containers: a <style id="ml-reel-lock"> is injected
 *   - For snap-based containers: the container gets overflow:hidden
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

    // Inject the filter (wrapped in IIFE)
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(`(function(){\n${js}\n})()`);

    // Give the setInterval (500ms) time to find and lock the container
    await page.waitForTimeout(2_000);

    // Verify the observable DOM effect of the lock:
    // The script injects a <style id="ml-reel-lock"> for transform containers,
    // or sets overflow:hidden on snap containers.
    const lockApplied = await page.evaluate(() => {
      // Check 1: transform-based lock — <style id="ml-reel-lock"> is present
      if (document.getElementById('ml-reel-lock')) return { locked: true, method: 'transform-style' };

      // Check 2: snap-based lock — find a snap container with overflow:hidden
      const divs = document.querySelectorAll('div');
      for (const div of divs) {
        const cs = window.getComputedStyle(div);
        if (cs.overflow === 'hidden' && div.scrollHeight > div.clientHeight + 50 && div.clientHeight > 300) {
          const videos = div.querySelectorAll('video');
          if (videos.length > 0) return { locked: true, method: 'snap-overflow' };
        }
      }

      return { locked: false, method: null };
    });

    expect(lockApplied.locked).toBe(true);
    console.log(`[test] Reels locked via: ${lockApplied.method}`);
  });
});
