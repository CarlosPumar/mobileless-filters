/**
 * ig_no_scroll_reels.spec.js
 *
 * Verifies the ig_no_scroll_reels JS filter:
 *
 * The filter now consolidates three behaviours:
 *   1. Hides the Reels navigation link (injected CSS).
 *   2. Hides reel post articles in the feed.
 *   3. Blocks scrolling in the full-screen Reels player using a VIEWPORT-FILL
 *      GUARD (>= 85% of viewport height) rather than URL matching — so the
 *      filter works wherever a full-screen player appears (standalone /reels/,
 *      DMs, profile reels) while never locking normal page scroll.
 *
 * Tests:
 * 1. Reels nav link is hidden after injection.
 * 2. Reel post articles are hidden in the feed after injection.
 * 3. LOCKS on /reels/ (full-screen player).
 * 4. Does NOT lock on main feed (/) — embedded videos are smaller than viewport.
 * 5. Unlocks cleanly when navigating /reels/ → / via SPA navigation.
 * 6. Unlocks when the container is still in the DOM but shrinks below 85% viewport
 *    (simulates closing a reel opened from a DM conversation).
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
 * - transform lock: <style id="ml-reel-lock"> present
 * - snap lock: overflow:hidden on a container >= 85% viewport height with videos
 */
async function isLocked(page) {
  return page.evaluate(() => {
    if (document.getElementById('ml-reel-lock')) return true;
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

test.describe('ig_no_scroll_reels filter', () => {

  // ─── 1. Reels nav link hidden ────────────────────────────────────────────

  test('reels nav link is hidden after injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const reelsLink = page.locator('a[href="/reels/"]').first();
    await expect(reelsLink).toBeVisible();

    await injectFilter(page);
    await page.waitForTimeout(500);

    await expect(reelsLink).toBeHidden();
  });

  // ─── 2. Reel posts hidden in feed ───────────────────────────────────────

  test('reel post articles are hidden in the feed after injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(2_000); // let setInterval run

    const reelArticles = page.locator('article:has(a[href*="/reel/"])');
    const count = await reelArticles.count();
    for (let i = 0; i < count; i++) {
      await expect(reelArticles.nth(i)).toBeHidden();
    }
  });

  // ─── 3. Reels page: scroll must be locked ───────────────────────────────

  test('locks full-screen reels player on /reels/', async ({ page }) => {
    await page.goto('/reels/', { waitUntil: 'networkidle' });
    await page.waitForSelector('video', { timeout: 30_000 });

    await injectFilter(page);
    await page.waitForTimeout(2_000);

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

  // ─── 4. Main feed: scroll must NOT be locked ────────────────────────────

  test('does NOT lock scroll on main feed (/)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await injectFilter(page);
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(3_000);

    expect(await isLocked(page)).toBe(false);
  });

  // ─── 5. Navigate reels → feed: must unlock cleanly ──────────────────────

  test('unlocks when navigating from /reels/ back to feed', async ({ page }) => {
    await page.goto('/reels/', { waitUntil: 'networkidle' });
    await page.waitForSelector('video', { timeout: 30_000 });
    await injectFilter(page);
    await page.waitForTimeout(2_000);

    expect(await isLocked(page)).toBe(true);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    expect(await isLocked(page)).toBe(false);
  });

  // ─── 6. Unlock when container shrinks (DM reel close scenario) ──────────

  test('unlocks when locked container shrinks below 85% viewport (DM reel close)', async ({ page }) => {
    await page.goto('/reels/', { waitUntil: 'networkidle' });
    await page.waitForSelector('video', { timeout: 30_000 });
    await injectFilter(page);
    await page.waitForTimeout(2_000);

    expect(await isLocked(page)).toBe(true);

    // Simulate closing a reel in DMs: the container stays in the DOM but
    // Instagram shrinks it below the 85% viewport threshold.
    // We shrink ALL full-screen containers that contain videos.
    await page.evaluate(() => {
      const minH = window.innerHeight * 0.85;
      for (const div of document.querySelectorAll('div')) {
        if (div.clientHeight >= minH && div.querySelectorAll('video').length > 0) {
          div.style.height = '100px';
          div.style.overflow = 'visible';
        }
      }
    });

    // Wait for multiple setInterval cycles (500ms each) to detect the change
    await page.waitForTimeout(2_000);

    // After unlock: the ml-reel-lock style tag and snap/transform locks
    // should be cleaned up by _mlUnlockReels()
    const state = await page.evaluate(() => ({
      styleLockPresent: !!document.getElementById('ml-reel-lock'),
      navHidePresent: !!document.getElementById('ml-reel-nav-hide'),
    }));
    // ml-reel-lock (the transform/snap lock style) should be removed
    expect(state.styleLockPresent).toBe(false);
    // ml-reel-nav-hide (the CSS that hides the Reels nav link) should persist
    expect(state.navHidePresent).toBe(true);
  });
});
