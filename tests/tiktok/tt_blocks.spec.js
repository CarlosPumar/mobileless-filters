/**
 * tt_blocks.spec.js
 *
 * Verifies the TikTok blockers: tt_hide_home (the For You feed on /) and
 * tt_hide_trending (the Discover grid on /discover). TikTok's live web has
 * aggressive bot detection, so we build synthetic DOM shaped like the real
 * markup (verified against the live site) and check each filter hides the
 * content, paints the page black, pauses video, shows the overlay, keeps the
 * nav, and restores on the wrong path.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FILES = path.resolve(__dirname, '../../filters/tiktok');
const inject = (page, file) =>
  page.evaluate(`(function(){\n${fs.readFileSync(path.join(FILES, file), 'utf-8')}\n})()`);

// Builds a synthetic TikTok page: `content` is the block target's markup, plus a
// bottom nav that must survive.
async function build(page, pathname, contentHTML) {
  await page.evaluate(({ p, html }) => {
    history.pushState({}, '', p);
    document.body.style.margin = '0';
    document.documentElement.style.background = '';
    document.body.style.background = '';
    document.body.innerHTML =
      html +
      '<div id="ml-test-nav" style="position:fixed;bottom:0;left:0;right:0;height:48px">' +
      '<a data-e2e="home-icon" href="/">Home</a><a data-e2e="discover-icon" href="/discover">Discover</a></div>';
    const v = document.querySelector('video');
    if (v) { try { v.play && v.play().catch(() => {}); } catch (e) {} }
  }, { p: pathname, html: contentHTML });
}

const HOME_HTML =
  '<div id="ml-test-content" class="css-x--DivSwiperContainer" data-e2e="video-card">' +
  '<div data-e2e="video-slide-active"><video id="ml-test-video"></video></div></div>';
const TREND_HTML =
  '<div id="ml-test-content" class="css-x--DivNewDiscoverContainer">' +
  '<div data-e2e="video-item"><video id="ml-test-video"></video></div></div>';

async function assertBlocked(page, { overlayId }) {
  return page.evaluate((oid) => {
    const content = document.getElementById('ml-test-content');
    const nav = document.getElementById('ml-test-nav');
    const overlay = document.getElementById(oid);
    const video = document.getElementById('ml-test-video');
    return {
      contentHidden: content ? window.getComputedStyle(content).visibility === 'hidden' : false,
      bodyBlack: window.getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)',
      navVisible: nav ? window.getComputedStyle(nav).visibility !== 'hidden' : false,
      overlayShown: !!overlay && overlay.textContent.includes('MobileLess'),
      videoPaused: video ? video.paused : true,
    };
  }, overlayId);
}

const CASES = [
  { name: 'home', file: 'tt_hide_home.js', path: '/', html: HOME_HTML, overlayId: 'ml-tt-home-overlay', styleId: 'ml-tt-home-style' },
  { name: 'trending', file: 'tt_hide_trending.js', path: '/discover', html: TREND_HTML, overlayId: 'ml-tt-trend-overlay', styleId: 'ml-tt-trend-style' },
];

for (const c of CASES) {
  test.describe(`tt_hide_${c.name}`, () => {
    test('no runtime errors', async ({ page }) => {
      await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await build(page, c.path, c.html);
      await inject(page, c.file);
      await page.waitForTimeout(1_500);
      expect(errors).toHaveLength(0);
    });

    test('blocks the content (hidden + black + paused + overlay, nav kept)', async ({ page }) => {
      await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
      await build(page, c.path, c.html);
      await inject(page, c.file);
      await page.waitForTimeout(1_500);
      const s = await assertBlocked(page, { overlayId: c.overlayId });
      expect(s.contentHidden).toBe(true);
      expect(s.bodyBlack).toBe(true);
      expect(s.navVisible).toBe(true);
      expect(s.overlayShown).toBe(true);
      expect(s.videoPaused).toBe(true);
    });

    test('restores on the wrong path', async ({ page }) => {
      await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
      await build(page, c.path, c.html);
      await inject(page, c.file);
      await page.waitForTimeout(1_500);
      expect(await page.evaluate((id) => !!document.getElementById(id), c.overlayId)).toBe(true);

      await page.evaluate(() => {
        history.pushState({}, '', '/@someuser');
        const n = document.createElement('div'); document.body.appendChild(n); n.remove();
      });
      await page.waitForTimeout(1_500);

      const gone = await page.evaluate((ids) => ({
        overlayGone: !document.getElementById(ids.o),
        styleGone: !document.getElementById(ids.s),
      }), { o: c.overlayId, s: c.styleId });
      expect(gone.overlayGone).toBe(true);
      expect(gone.styleGone).toBe(true);
    });
  });
}
