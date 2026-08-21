/**
 * yt_hide_shorts.spec.js
 *
 * Verifies the yt_hide_shorts JS filter.
 *
 * Tests:
 * 1. Shorts tab hidden on home (always).
 * 2. Shorts tab hidden on /results (always).
 * 3. Home /: Shorts shelf sections hidden (conditional — may not load).
 * 4. /shorts/*: no fullscreen overlay (user can watch the current Short).
 * 5. /shorts/*: carousel scroll locked (touch-action:none via CSS).
 * 6. /shorts/*: scroll lock removed when navigating away.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/youtube/yt_hide_shorts.js');

async function injectFilter(page) {
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

async function gotoShorts(page) {
  await page.goto('/shorts', { waitUntil: 'domcontentloaded', timeout: 30_000 });

  if (page.url().includes('consent.youtube.com')) {
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }),
        page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            b => /accept all/i.test(b.textContent) || /accept all/i.test(b.getAttribute('aria-label') || '')
          );
          if (btn) btn.click();
        }),
      ]);
    } catch (e) {
      if (!/ERR_ABORTED|frame was detached/i.test(e.message)) throw e;
    }
  }

  if (!page.url().includes('/shorts/')) {
    try {
      await page.waitForURL(/\/shorts\/.+/, { timeout: 15_000 });
    } catch (e) {
      if (!/ERR_ABORTED|frame was detached/i.test(e.message)) throw e;
      // Redirect chain may cause ERR_ABORTED; check if we landed correctly
      if (!page.url().includes('/shorts/')) throw e;
    }
  }
}

test.describe('yt_hide_shorts filter', () => {

  // ─── 1. Shorts tab hidden on home ────────────────────────────────────────

  test('hides Shorts tab on home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.pivot-shorts', { timeout: 20_000 });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const hidden = await page.evaluate(() => {
      const pivotShorts = document.querySelector('.pivot-shorts');
      if (!pivotShorts) return false;
      const item = pivotShorts.closest('ytm-pivot-bar-item-renderer');
      if (!item) return false;
      return window.getComputedStyle(item).display === 'none';
    });
    expect(hidden).toBe(true);
  });

  // ─── 2. Shorts tab hidden on /results ────────────────────────────────────

  test('hides Shorts tab on /results page (always-on)', async ({ page }) => {
    await page.goto('/results?search_query=cats', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const hidden = await page.evaluate(() => {
      const pivotShorts = document.querySelector('.pivot-shorts');
      if (!pivotShorts) return true;
      const item = pivotShorts.closest('ytm-pivot-bar-item-renderer');
      if (!item) return true;
      return window.getComputedStyle(item).display === 'none';
    });
    expect(hidden).toBe(true);
  });

  // ─── 3. Home: Shorts shelf hidden ────────────────────────────────────────

  test('hides Shorts shelf sections on home / (if shelf is present)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(2_000);

    const shortsLoaded = await page.evaluate(() => !!document.querySelector('ytm-shorts-lockup-view-model'));
    if (!shortsLoaded) return;

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const allShortsHidden = await page.evaluate(() => {
      const sections = document.querySelectorAll('ytm-rich-section-renderer');
      for (const section of sections) {
        if (section.querySelector('ytm-shorts-lockup-view-model')) {
          if (window.getComputedStyle(section).display !== 'none') return false;
        }
      }
      return true;
    });
    expect(allShortsHidden).toBe(true);
  });

  // ─── 3b. Subscriptions: reel shelf hidden ────────────────────────────────

  // The real Subscriptions feed needs a signed-in account. We simulate the
  // path with pushState and inject a synthetic Shorts reel shelf shaped like
  // YouTube's markup, then confirm the filter hides it while leaving a normal
  // video section alone.
  test('hides the Shorts reel shelf on /feed/subscriptions (synthetic)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      history.pushState({}, '', '/feed/subscriptions');

      const host = document.querySelector('ytm-browse') || document.body;

      // A Shorts-only section (should be hidden, shelf + wrapper).
      const shortsSection = document.createElement('ytm-item-section-renderer');
      shortsSection.id = 'ml-test-shorts-section';
      const shelf = document.createElement('ytm-reel-shelf-renderer');
      shelf.id = 'ml-test-reel-shelf';
      shortsSection.appendChild(shelf);
      host.appendChild(shortsSection);

      // A normal-video section (must stay visible).
      const videoSection = document.createElement('ytm-item-section-renderer');
      videoSection.id = 'ml-test-video-section';
      videoSection.appendChild(document.createElement('ytm-video-with-context-renderer'));
      host.appendChild(videoSection);
    });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => {
      const disp = (id) => {
        const el = document.getElementById(id);
        return el ? window.getComputedStyle(el).display : 'MISSING';
      };
      return {
        shelf: disp('ml-test-reel-shelf'),
        shortsSection: disp('ml-test-shorts-section'),
        videoSection: disp('ml-test-video-section'),
      };
    });
    expect(state.shelf).toBe('none');
    expect(state.shortsSection).toBe('none');
    expect(state.videoSection).not.toBe('none');
  });

  // ─── 3c. Subscriptions: content-signal fallback (/shorts/ link) ──────────

  // Guards against layout variants we can't inspect logged-out: a Shorts item
  // is identified by its /shorts/ link and its lockup element, even inside a
  // wrapper tag we don't explicitly target.
  test('hides Shorts by /shorts/ link + lockup on /feed/subscriptions (synthetic)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      history.pushState({}, '', '/feed/subscriptions');
      const host = document.querySelector('ytm-browse') || document.body;

      // Real structure from the live Subscriptions feed: a rich shelf whose
      // items are ytm-shorts-lockup-view-model-v2 > ytm-shorts-lockup-view-model
      // > a[href^="/shorts/"].
      const shortsSection = document.createElement('ytm-rich-shelf-renderer');
      shortsSection.id = 'ml-test-href-section';
      const lockup = document.createElement('ytm-shorts-lockup-view-model-v2');
      lockup.id = 'ml-test-lockup';
      const inner = document.createElement('ytm-shorts-lockup-view-model');
      const link = document.createElement('a');
      link.href = '/shorts/abc123';
      inner.appendChild(link);
      lockup.appendChild(inner);
      shortsSection.appendChild(lockup);
      host.appendChild(shortsSection);
    });

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => {
      const disp = (id) => {
        const el = document.getElementById(id);
        return el ? window.getComputedStyle(el).display : 'MISSING';
      };
      return { section: disp('ml-test-href-section'), lockup: disp('ml-test-lockup') };
    });
    // Either the section is hidden wholesale, or at minimum the lockup itself is.
    expect(state.section === 'none' || state.lockup === 'none').toBe(true);
  });

  // ─── 4. /shorts/*: NO fullscreen overlay (user can watch current Short) ──

  test('does NOT show fullscreen overlay on /shorts/ (allows watching)', async ({ page }) => {
    await gotoShorts(page);
    await page.waitForTimeout(1_000);

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const hasBlockingOverlay = await page.evaluate(() => {
      return !!document.getElementById('ml-yt-shorts-overlay');
    });
    expect(hasBlockingOverlay).toBe(false);
  });

  // ─── 5. /shorts/*: carousel scroll locked via CSS ────────────────────────

  test('locks Shorts carousel scroll on /shorts/ path', async ({ page }) => {
    await gotoShorts(page);
    await page.waitForTimeout(1_000);

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    const locked = await page.evaluate(() => {
      return !!document.getElementById('ml-yt-shorts-lock');
    });
    expect(locked).toBe(true);
  });

  // ─── 6. Scroll lock removed on navigation away ──────────────────────────

  test('removes scroll lock when navigating /shorts/ → /', async ({ page }) => {
    await gotoShorts(page);
    await page.waitForTimeout(1_000);

    await injectFilter(page);
    await page.waitForTimeout(1_500);

    expect(await page.evaluate(() => !!document.getElementById('ml-yt-shorts-lock'))).toBe(true);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    const state = await page.evaluate(() => ({
      lockPresent: !!document.getElementById('ml-yt-shorts-lock'),
    }));
    expect(state.lockPresent).toBe(false);
  });

});
