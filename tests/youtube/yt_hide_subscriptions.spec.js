/**
 * yt_hide_subscriptions.spec.js
 *
 * Verifies the yt_hide_subscriptions JS filter (blocks the Subscriptions tab).
 *
 * The real Subscriptions feed (/feed/subscriptions) requires a signed-in
 * account, which the logged-out test harness doesn't have, and the
 * Subscriptions pivot item only renders when signed in. So path-dependent
 * behaviour is exercised with history.pushState + a synthetic pivot item
 * injected into the live page. The always-on checks (no runtime errors, real
 * DOM present) run against m.youtube.com directly.
 *
 * Tests:
 * 1. Script evaluates without runtime errors.
 * 2. Hides the Subscriptions pivot item (synthetic .pivot-subscriptions).
 * 3. /feed/subscriptions: overlay shown, ytm-browse hidden, scroll locked.
 * 4. Overlay z-index is below the topbar so the search bar stays usable.
 * 5. Does NOT activate on home /.
 * 6. Deactivates (style + overlay removed) when navigating away.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/youtube/yt_hide_subscriptions.js');

async function injectFilter(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

test.describe('yt_hide_subscriptions filter', () => {

  // ─── 1. No runtime errors ────────────────────────────────────────────────

  test('script evaluates without runtime errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    expect(errors).toHaveLength(0);
  });

  // ─── 2. Subscriptions pivot item hidden ──────────────────────────────────

  test('hides the Subscriptions pivot item (by class and by label)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-pivot-bar-renderer', { timeout: 20_000 });

    // The real Subscriptions tab only shows when signed in. Inject two synthetic
    // variants: one matched by its class token, one matched only by its
    // localized label (class renamed) — both must be hidden.
    await page.evaluate(() => {
      const bar = document.querySelector('ytm-pivot-bar-renderer');

      const byClass = document.createElement('ytm-pivot-bar-item-renderer');
      byClass.id = 'ml-test-subs-class';
      const tab = document.createElement('div');
      tab.className = 'pivot-bar-item-tab pivot-subscriptions';
      byClass.appendChild(tab);
      bar.appendChild(byClass);

      const byLabel = document.createElement('ytm-pivot-bar-item-renderer');
      byLabel.id = 'ml-test-subs-label';
      const title = document.createElement('div');
      title.className = 'pivot-bar-item-title pivot-xyz'; // class gives no hint
      title.textContent = 'Suscripciones';
      byLabel.appendChild(title);
      bar.appendChild(byLabel);

      // A control item that must NOT be hidden.
      const control = document.createElement('ytm-pivot-bar-item-renderer');
      control.id = 'ml-test-home';
      const ctitle = document.createElement('div');
      ctitle.className = 'pivot-bar-item-title pivot-w2w';
      ctitle.textContent = 'Inicio';
      control.appendChild(ctitle);
      bar.appendChild(control);
    });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => {
      const disp = (id) => {
        const el = document.getElementById(id);
        return el ? window.getComputedStyle(el).display : 'MISSING';
      };
      return { byClass: disp('ml-test-subs-class'), byLabel: disp('ml-test-subs-label'), control: disp('ml-test-home') };
    });
    expect(state.byClass).toBe('none');
    expect(state.byLabel).toBe('none');
    expect(state.control).not.toBe('none');
  });

  // ─── 3. /feed/subscriptions: feed blocked ────────────────────────────────

  test('blocks the feed on /feed/subscriptions (overlay + hidden browse + scroll lock)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-browse', { timeout: 20_000 });

    await page.evaluate(() => history.pushState({}, '', '/feed/subscriptions'));

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => {
      const overlay = document.getElementById('ml-yt-subs-overlay');
      const browse = document.querySelector('ytm-browse');
      return {
        overlayOk: !!overlay && overlay.textContent.includes('MobileLess') &&
                   window.getComputedStyle(overlay).position === 'fixed',
        browseHidden: browse ? window.getComputedStyle(browse).visibility === 'hidden' : false,
        htmlLocked: window.getComputedStyle(document.documentElement).overflow.includes('hidden'),
      };
    });
    expect(state.overlayOk).toBe(true);
    expect(state.browseHidden).toBe(true);
    expect(state.htmlLocked).toBe(true);
  });

  // ─── 4. Overlay below topbar (search stays usable) ───────────────────────

  test('overlay z-index is below topbar on /feed/subscriptions', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-mobile-topbar-renderer', { state: 'attached', timeout: 20_000 });

    await page.evaluate(() => history.pushState({}, '', '/feed/subscriptions'));

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const result = await page.evaluate(() => {
      const overlay = document.getElementById('ml-yt-subs-overlay');
      const topbar = document.querySelector('ytm-mobile-topbar-renderer');
      if (!overlay || !topbar) return { ok: false };
      const overlayZ = parseInt(window.getComputedStyle(overlay).zIndex) || 0;
      const topbarZ = parseInt(window.getComputedStyle(topbar).zIndex) || 0;
      return { ok: overlayZ < topbarZ, overlayZ, topbarZ };
    });
    expect(result.ok).toBe(true);
  });

  // ─── 5. Not active on home / ─────────────────────────────────────────────

  test('does NOT activate on home /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-browse', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-yt-subs-style'),
      overlayPresent: !!document.getElementById('ml-yt-subs-overlay'),
    }));
    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
  });

  // ─── 6. Deactivates when navigating away ─────────────────────────────────

  test('removes style and overlay when navigating /feed/subscriptions → /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('ytm-browse', { timeout: 20_000 });

    await page.evaluate(() => history.pushState({}, '', '/feed/subscriptions'));

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    expect(await page.evaluate(() => !!document.getElementById('ml-yt-subs-overlay'))).toBe(true);

    await page.evaluate(() => history.pushState({}, '', '/'));
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => ({
      stylePresent:   !!document.getElementById('ml-yt-subs-style'),
      overlayPresent: !!document.getElementById('ml-yt-subs-overlay'),
      browseVisible:  (() => {
        const b = document.querySelector('ytm-browse');
        return b ? window.getComputedStyle(b).visibility !== 'hidden' : true;
      })(),
    }));
    expect(state.stylePresent).toBe(false);
    expect(state.overlayPresent).toBe(false);
    expect(state.browseVisible).toBe(true);
  });

});
