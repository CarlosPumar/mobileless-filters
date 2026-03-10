/**
 * yt_hide_home.spec.js
 *
 * Verifies the yt_hide_home JS filter.
 *
 * Tests:
 * 1. Home /: ytm-rich-grid-renderer hidden (visibility:hidden).
 * 2. Home /: scroll locked (overflow:hidden on html).
 * 3. Home /: "Blocked by MobileLess" overlay present.
 * 4. Home /: overlay z-index is below topbar (<=3) so search bar is accessible.
 * 5. Home /: ytm-mobile-topbar-renderer (search bar) is NOT hidden by our filter.
 * 6. Other page (/results?search_query=cats): filter NOT active.
 * 7. Deactivates (style + overlay removed) when navigating / → /results.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/youtube/yt_hide_home.js');

async function injectFilter(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

test.describe('yt_hide_home filter', () => {

  // ─── 1. Home: feed hidden ────────────────────────────────────────────────

  test('hides ytm-rich-grid-renderer (visibility:hidden) on home /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-rich-grid-renderer', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const hidden = await page.evaluate(() => {
      const el = document.querySelector('ytm-rich-grid-renderer');
      if (!el) return false;
      return window.getComputedStyle(el).visibility === 'hidden';
    });
    expect(hidden).toBe(true);
  });

  // ─── 2. Home: scroll locked ──────────────────────────────────────────────

  test('locks scroll (overflow:hidden on html) on home /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-rich-grid-renderer', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const htmlLocked = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).overflow.includes('hidden');
    });
    expect(htmlLocked).toBe(true);
  });

  // ─── 3. Home: overlay present ────────────────────────────────────────────

  test('shows "Blocked by MobileLess" overlay on home /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-rich-grid-renderer', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const overlayOk = await page.evaluate(() => {
      const el = document.getElementById('ml-yt-home-overlay');
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return cs.position === 'fixed' && cs.display !== 'none' && el.textContent.includes('MobileLess');
    });
    expect(overlayOk).toBe(true);
  });

  // ─── 4. Home: overlay z-index below topbar ───────────────────────────────

  test('overlay z-index is below topbar so search bar is visible on home /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-rich-grid-renderer', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const result = await page.evaluate(() => {
      const overlay = document.getElementById('ml-yt-home-overlay');
      const topbar = document.querySelector('ytm-mobile-topbar-renderer');
      if (!overlay || !topbar) return { ok: false };
      const overlayZ = parseInt(window.getComputedStyle(overlay).zIndex) || 0;
      const topbarZ = parseInt(window.getComputedStyle(topbar).zIndex) || 0;
      return { ok: overlayZ < topbarZ, overlayZ, topbarZ };
    });
    expect(result.ok).toBe(true);
  });

  // ─── 5. Home: topbar search NOT hidden ───────────────────────────────────

  test('ytm-mobile-topbar-renderer (search) is NOT hidden on home /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-mobile-topbar-renderer', { state: 'attached', timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const topbarHidden = await page.evaluate(() => {
      const el = document.querySelector('ytm-mobile-topbar-renderer');
      return el ? window.getComputedStyle(el).visibility === 'hidden' : true;
    });
    expect(topbarHidden).toBe(false);
  });

  // ─── 6. Other page: filter not active ────────────────────────────────────

  test('does NOT activate on search results page (/results)', async ({ page }) => {
    await page.goto('/results?search_query=cats', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-yt-home-style'),
      overlayPresent: !!document.getElementById('ml-yt-home-overlay'),
    }));
    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
  });

  // ─── 7. Deactivates on / → /results ─────────────────────────────────────

  test('removes style and overlay when navigating / → /results', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-rich-grid-renderer', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    expect(await page.evaluate(() => !!document.getElementById('ml-yt-home-style'))).toBe(true);

    await page.goto('/results?search_query=cats', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-yt-home-style'),
      overlayPresent: !!document.getElementById('ml-yt-home-overlay'),
    }));
    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
  });

});
