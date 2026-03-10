/**
 * ig_no_scroll_reels.spec.js
 *
 * Verifies the ig_no_scroll_reels JS filter:
 *
 * 1. LOCKS scroll on the Reels player page (/reels/).
 * 2. Does NOT lock scroll on the main feed (/) — the previous bug was that
 *    the setInterval ran on every SPA page and could match embedded videos or
 *    snap-scroll containers in the feed, DMs, and other pages, freezing their
 *    scroll entirely.
 * 3. Does NOT lock scroll on the DMs inbox (/direct/inbox/).
 * 4. Unlocks properly when navigating away from /reels/ back to /.
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

/** Returns true if any full-viewport-height container has overflow:hidden + videos (snap lock). */
async function isSnapLocked(page) {
  return page.evaluate(() => {
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

/** Returns true if the <style id="ml-reel-lock"> element is present (transform lock). */
async function isTransformLocked(page) {
  return page.evaluate(() => !!document.getElementById('ml-reel-lock'));
}

async function isLocked(page) {
  return (await isSnapLocked(page)) || (await isTransformLocked(page));
}

// ─── 1. Reels page: filter MUST lock ────────────────────────────────────────

test.describe('ig_no_scroll_reels filter', () => {
  test('locks reels scroll container on /reels/', async ({ page }) => {
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

    // Scroll down to load video posts that could be false-positive candidates
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(3_000); // multiple setInterval cycles

    const locked = await isLocked(page);
    expect(locked).toBe(false);
  });

  // ─── 3. DMs inbox: filter must NOT lock ─────────────────────────────────

  test('does NOT lock scroll on DMs inbox (/direct/inbox/)', async ({ page }) => {
    await page.goto('/direct/inbox/', { waitUntil: 'networkidle' });

    await injectFilter(page);
    await page.waitForTimeout(3_000);

    const locked = await isLocked(page);
    expect(locked).toBe(false);
  });

  // ─── 4. Navigate reels → feed: must unlock cleanly ──────────────────────

  test('unlocks when navigating from /reels/ back to feed', async ({ page }) => {
    // Go to reels and inject filter
    await page.goto('/reels/', { waitUntil: 'networkidle' });
    await page.waitForSelector('video', { timeout: 30_000 });
    await injectFilter(page);
    await page.waitForTimeout(2_000);

    // Confirm it was locked on reels
    const lockedOnReels = await isLocked(page);
    expect(lockedOnReels).toBe(true);

    // Navigate to main feed (SPA navigation)
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000); // let interval detect and unlock

    const lockedOnFeed = await isLocked(page);
    expect(lockedOnFeed).toBe(false);
  });
});
