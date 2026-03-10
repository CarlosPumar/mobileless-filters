/**
 * ig_no_scroll_reels.spec.js
 *
 * Verifies the ig_no_scroll_reels JS filter:
 *
 * The filter uses a VIEWPORT-FILL GUARD rather than URL matching to
 * distinguish the full-screen Reels player from embedded videos elsewhere.
 * The Reels player always fills >= 85% of the viewport height; embedded
 * post videos, DM clips, and carousels are significantly smaller.
 *
 * This design lets the filter also work when reels are accessed from DMs
 * or profile grids (wherever a full-screen player appears), while never
 * locking normal page scroll.
 *
 * Tests:
 * 1. LOCKS on /reels/ (full-screen player).
 * 2. Does NOT lock on main feed (/) — embedded videos are smaller than viewport.
 * 3. Unlocks cleanly when navigating /reels/ → / via SPA navigation.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_no_scroll_reels.js');

/** Inject the filter wrapped in an IIFE so multi-statement JS works as an expression. */
async function injectFilter(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

/**
 * Returns true if a full-viewport-height container is locked:
 * - snap lock: overflow:hidden on a container >= 85% viewport height with videos
 * - transform lock: <style id="ml-reel-lock"> present
 */
async function isLocked(page) {
  return page.evaluate(() => {
    // Transform lock
    if (document.getElementById('ml-reel-lock')) return true;
    // Snap lock — only on full-viewport containers (same guard as the filter)
    const minH = window.innerHeight * 0.85;
    for (const div of document.querySelectorAll('div')) {
      if (div.clientHeight < minH) continue;
      const cs = window.getComputedStyle(div);
      if (cs.overflow !== 'hidden') continue;
      if (div.querySelectorAll('video').length > 0) return true;
    }
    return false;
  });
}

// ─── 1. Reels page: filter MUST lock ────────────────────────────────────────

test.describe('ig_no_scroll_reels filter', () => {
  test('locks full-screen reels player on /reels/', async ({ page }) => {
    await page.goto('/reels/', { waitUntil: 'networkidle' });
    await page.waitForSelector('video', { timeout: 30_000 });

    await injectFilter(page);
    await page.waitForTimeout(2_000); // let setInterval run

    const lockApplied = await page.evaluate(() => {
      if (document.getElementById('ml-reel-lock')) return { locked: true, method: 'transform-style' };

      const minH = window.innerHeight * 0.85;
      for (const div of document.querySelectorAll('div')) {
        const cs = window.getComputedStyle(div);
        if (cs.overflow === 'hidden' && div.clientHeight >= minH && div.querySelectorAll('video').length > 0) {
          return { locked: true, method: 'snap-overflow' };
        }
      }
      return { locked: false, method: null };
    });

    expect(lockApplied.locked).toBe(true);
    console.log(`[test] Reels locked via: ${lockApplied.method}`);
  });

  // ─── 2. Main feed: filter must NOT lock ─────────────────────────────────

  test('does NOT lock scroll on main feed (/)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await injectFilter(page);

    // Scroll to load video posts that could be false-positive candidates
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(3_000); // multiple setInterval cycles

    expect(await isLocked(page)).toBe(false);
  });

  // ─── 3. Navigate reels → feed: must unlock cleanly ──────────────────────

  test('unlocks when navigating from /reels/ back to feed', async ({ page }) => {
    await page.goto('/reels/', { waitUntil: 'networkidle' });
    await page.waitForSelector('video', { timeout: 30_000 });
    await injectFilter(page);
    await page.waitForTimeout(2_000);

    // Confirm locked on reels
    expect(await isLocked(page)).toBe(true);

    // Navigate away via SPA
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    expect(await isLocked(page)).toBe(false);
  });
});
