/**
 * ig_hide_for_you.spec.js
 *
 * Verifies the ig_hide_for_you JS filter.
 *
 * Implementation strategy (why it works without flickering):
 *   - Uses `visibility: hidden` (NOT display:none) so articles keep their DOM
 *     height. The page scroll height stays the same, so Instagram's
 *     IntersectionObserver sentinel for infinite scroll never enters the
 *     viewport and no new content is loaded.
 *   - Locks window scroll (overflow:hidden on html+body) so the user cannot
 *     scroll down to the sentinel manually.
 *   - A fixed overlay (#ml-for-you-overlay) with pointer-events:none shows
 *     the "Blocked by MobileLess" message while keeping the nav bar clickable.
 *
 * Tests:
 * 1. Articles are hidden (visibility:hidden) on main feed (/).
 * 2. Window scroll is locked (overflow:hidden) on main feed (/).
 * 3. No new articles are loaded after injection (infinite scroll stays idle).
 * 4. "Blocked by MobileLess" overlay is visible on main feed (/).
 * 5. Nav bar links remain clickable (overlay has pointer-events:none).
 * 6. Filter is inactive on /explore/ — no style tag, no overlay, no scroll lock.
 * 7. Style and overlay are restored after SPA navigation / → /explore/.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_hide_for_you.js');

async function injectFilter(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

test.describe('ig_hide_for_you filter', () => {

  // ─── 1. Articles hidden with visibility:hidden ───────────────────────────

  test('articles are hidden (visibility:hidden) on main feed (/)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await expect(page.locator('article').first()).toBeVisible();

    await injectFilter(page);
    await page.waitForTimeout(1_000);

    const anyVisible = await page.evaluate(() => {
      for (const a of document.querySelectorAll('article')) {
        if (window.getComputedStyle(a).visibility !== 'hidden') return true;
      }
      return false;
    });
    expect(anyVisible).toBe(false);
  });

  // ─── 2. Window scroll locked ─────────────────────────────────────────────

  test('window scroll is locked (overflow:hidden on body) on main feed (/)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_000);

    const scrollLocked = await page.evaluate(() => {
      const html = window.getComputedStyle(document.documentElement).overflow;
      const body = window.getComputedStyle(document.body).overflow;
      return html.includes('hidden') || body.includes('hidden');
    });
    expect(scrollLocked).toBe(true);
  });

  // ─── 3. No new articles loaded (infinite scroll stays idle) ──────────────

  test('does NOT trigger infinite scroll loading after injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    const countBefore = await page.evaluate(() => document.querySelectorAll('article').length);

    await injectFilter(page);
    // Wait multiple setInterval cycles
    await page.waitForTimeout(4_000);

    const countAfter = await page.evaluate(() => document.querySelectorAll('article').length);

    // Article count must not have grown — infinite scroll is idle
    expect(countAfter).toBe(countBefore);
  });

  // ─── 4. Blocked overlay visible ──────────────────────────────────────────

  test('shows "Blocked by MobileLess" overlay on main feed (/)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_000);

    const overlayOk = await page.evaluate(() => {
      const el = document.getElementById('ml-for-you-overlay');
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return (
        cs.position === 'fixed' &&
        cs.display !== 'none' &&
        el.textContent.includes('MobileLess')
      );
    });
    expect(overlayOk).toBe(true);
  });

  // ─── 5. Nav bar remains clickable (pointer-events:none on overlay) ────────

  test('overlay has pointer-events:none so nav bar stays clickable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_000);

    const pointerEvents = await page.evaluate(() => {
      const el = document.getElementById('ml-for-you-overlay');
      return el ? window.getComputedStyle(el).pointerEvents : null;
    });
    expect(pointerEvents).toBe('none');
  });

  // ─── 6. Filter inactive on /explore/ ─────────────────────────────────────

  test('does NOT activate on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-for-you-style'),
      overlayPresent: !!document.getElementById('ml-for-you-overlay'),
      scrollLocked:   window.getComputedStyle(document.body).overflow.includes('hidden'),
    }));

    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
    expect(state.scrollLocked).toBe(false);
  });

  // ─── 7. Deactivates after SPA navigation away from feed ──────────────────

  test('deactivates (removes style + overlay + scroll lock) when navigating / → /explore/', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_000);

    // Confirm active on feed
    expect(await page.evaluate(() => !!document.getElementById('ml-for-you-style'))).toBe(true);

    // SPA navigate away
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-for-you-style'),
      overlayPresent: !!document.getElementById('ml-for-you-overlay'),
      scrollLocked:   window.getComputedStyle(document.body).overflow.includes('hidden'),
    }));

    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
    expect(state.scrollLocked).toBe(false);
  });
});
