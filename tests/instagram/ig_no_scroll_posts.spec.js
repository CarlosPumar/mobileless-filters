/**
 * ig_no_scroll_posts.spec.js
 *
 * Verifies the ig_no_scroll_posts JS filter.
 *
 * Implementation strategy for Explore (same approach as ig_hide_for_you):
 *   - CSS: `main > div { visibility: hidden !important }` — hides the entire
 *     grid container (thumbnails, loaders, skeleton states, tabs), not just
 *     individual links. This is more robust because it catches anything that
 *     could leak through (e.g. loading spinners that appear before <a> tags
 *     are rendered).
 *   - The search bar lives in <nav> (not <div>), so it is NOT hidden.
 *   - CSS: `html, body { overflow: hidden !important }` — prevents scroll so
 *     the infinite-scroll sentinel never enters the viewport.
 *   - Fixed overlay (#ml-explore-overlay, pointer-events:none) shows the
 *     blocked message. Taps pass through to the search bar header
 *     (position:fixed z-index:1) and bottom nav (position:fixed z-index:2).
 *
 * Tests:
 * 1. Main feed: nothing hidden, no scroll lock.
 * 2. Explore: main>div grid container hidden (visibility:hidden).
 * 3. Explore: scroll locked (overflow:hidden on html/body).
 * 4. Explore: "Blocked by MobileLess" overlay visible.
 * 5. Explore: overlay has pointer-events:none.
 * 6. Explore: search bar input is NOT hidden (lives in <nav>, not <div>).
 * 7. Explore: filter deactivates when user types in the search bar.
 * 8. Deactivates (style + overlay removed) when navigating /explore/ → /.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_no_scroll_posts.js');

async function injectFilter(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

test.describe('ig_no_scroll_posts filter', () => {

  // ─── 1. Main feed: nothing changed ──────────────────────────────────────

  test('does NOT hide or lock anything on main feed (/)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('article', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(2_000);

    expect(await page.evaluate(() => !!document.getElementById('ml-explore-style'))).toBe(false);
    expect(await page.evaluate(() => !!document.getElementById('ml-explore-overlay'))).toBe(false);

    // Articles on main feed should still be visible
    await expect(page.locator('article').first()).toBeVisible();
  });

  // ─── 2. Explore: main>div grid container hidden ──────────────────────────

  test('hides main>div grid container (visibility:hidden) on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const gridHidden = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return false;
      for (const child of main.children) {
        if (child.tagName === 'DIV') {
          return window.getComputedStyle(child).visibility === 'hidden';
        }
      }
      return false;
    });
    expect(gridHidden).toBe(true);
  });

  // ─── 3. Explore: scroll locked ──────────────────────────────────────────

  test('locks scroll (overflow:hidden on html/body) on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const locked = await page.evaluate(() => {
      const html = window.getComputedStyle(document.documentElement).overflow;
      const body = window.getComputedStyle(document.body).overflow;
      return html.includes('hidden') || body.includes('hidden');
    });
    expect(locked).toBe(true);
  });

  // ─── 4. Explore: blocked overlay visible ────────────────────────────────

  test('shows "Blocked by MobileLess" overlay on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const overlayOk = await page.evaluate(() => {
      const el = document.getElementById('ml-explore-overlay');
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return cs.position === 'fixed' && cs.display !== 'none' && el.textContent.includes('MobileLess');
    });
    expect(overlayOk).toBe(true);
  });

  // ─── 5. Explore: overlay pointer-events:none ────────────────────────────

  test('overlay has pointer-events:none so search bar stays accessible on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const pointerEvents = await page.evaluate(() => {
      const el = document.getElementById('ml-explore-overlay');
      return el ? window.getComputedStyle(el).pointerEvents : null;
    });
    expect(pointerEvents).toBe('none');
  });

  // ─── 6. Explore: search bar not hidden ──────────────────────────────────

  test('search bar (inside <nav>) is NOT hidden on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="search"], input[placeholder*="Search"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    // The search input lives in main > nav, not main > div, so it must not
    // inherit the visibility:hidden applied to main > div.
    const searchHidden = await page.evaluate(() => {
      const main = document.querySelector('main');
      const nav = main?.querySelector('nav');
      const input = nav?.querySelector('input');
      return input ? window.getComputedStyle(input).visibility === 'hidden' : true;
    });
    expect(searchHidden).toBe(false);
  });

  // ─── 7. Explore: filter deactivates while user is searching ────────────

  test('deactivates when user types in the search bar on /explore/', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="search"], input[placeholder*="Search"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    // Confirm filter is active before typing
    expect(await page.evaluate(() => !!document.getElementById('ml-explore-style'))).toBe(true);

    // Simulate user typing in the search bar
    await page.evaluate(() => {
      const input = document.querySelector('input[type="search"],input[placeholder*="Search"]');
      if (input) {
        input.value = 'cats';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Wait for the next setInterval tick (600ms)
    await page.waitForTimeout(1_000);

    // Filter should now be deactivated
    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-explore-style'),
      overlayPresent: !!document.getElementById('ml-explore-overlay'),
    }));
    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
  });

  // ─── 8. Deactivates on /explore/ → / ────────────────────────────────────

  test('removes style and overlay when navigating /explore/ → /', async ({ page }) => {
    await page.goto('/explore/', { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    expect(await page.evaluate(() => !!document.getElementById('ml-explore-style'))).toBe(true);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-explore-style'),
      overlayPresent: !!document.getElementById('ml-explore-overlay'),
      scrollLocked:   window.getComputedStyle(document.body).overflow.includes('hidden'),
    }));

    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
    expect(state.scrollLocked).toBe(false);
  });
});
