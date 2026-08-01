/**
 * tt_hide_foryou.spec.js
 *
 * Verifies the TikTok "For You" blocker. TikTok's web feed has aggressive bot
 * detection, so rather than depend on the live site in CI we build a synthetic
 * feed shaped like TikTok's real markup (a `[class*="DivSwiperContainer"]`
 * swiper with `[data-e2e^="video-slide"]` items + a `<video>`, plus a bottom-nav
 * `[data-e2e="home-icon"]`). The selectors were verified against the live site.
 *
 * Tests:
 * 1. Script evaluates without runtime errors (self-contained; no baseline dep).
 * 2. On the For You feed (/): swiper hidden, video paused, overlay shown, nav kept.
 * 3. Off the feed (/@user): everything is restored.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/tiktok/tt_hide_foryou.js');

async function inject(page) {
  await page.evaluate(`(function(){\n${fs.readFileSync(JS_FILE, 'utf-8')}\n})()`);
}

async function buildFeed(page, pathname) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    document.body.style.margin = '0';
    document.body.innerHTML = '';

    // Feed swiper (the addictive surface).
    const swiper = document.createElement('div');
    swiper.id = 'ml-test-swiper';
    swiper.className = 'css-abc-hash--DivSwiperContainer';
    swiper.setAttribute('data-e2e', 'video-card');
    const slide = document.createElement('div');
    slide.setAttribute('data-e2e', 'video-slide-active');
    const video = document.createElement('video');
    video.id = 'ml-test-video';
    slide.appendChild(video);
    swiper.appendChild(slide);
    document.body.appendChild(swiper);

    // Bottom nav (must stay usable).
    const nav = document.createElement('div');
    nav.id = 'ml-test-nav';
    nav.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:48px;';
    const home = document.createElement('a');
    home.setAttribute('data-e2e', 'home-icon');
    home.textContent = 'Home';
    nav.appendChild(home);
    document.body.appendChild(nav);

    // Try to "play" the video so we can assert it gets paused.
    try { video.play && video.play().catch(() => {}); } catch (e) {}
  }, pathname);
}

test.describe('tt_hide_foryou filter', () => {

  test('script evaluates without runtime errors', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await buildFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);
    expect(errors).toHaveLength(0);
  });

  test('blocks the For You feed on / (hidden swiper + paused video + overlay, nav kept)', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await buildFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => {
      const swiper = document.getElementById('ml-test-swiper');
      const nav = document.getElementById('ml-test-nav');
      const overlay = document.getElementById('ml-tt-overlay');
      const video = document.getElementById('ml-test-video');
      return {
        swiperHidden: swiper ? window.getComputedStyle(swiper).visibility === 'hidden' : false,
        navVisible: nav ? window.getComputedStyle(nav).visibility !== 'hidden' : false,
        overlayShown: !!overlay && overlay.textContent.includes('MobileLess'),
        videoPaused: video ? video.paused : true,
        scrollLocked: window.getComputedStyle(document.documentElement).overflow.includes('hidden')
          || window.getComputedStyle(document.body).overflow.includes('hidden'),
      };
    });
    expect(state.swiperHidden).toBe(true);
    expect(state.navVisible).toBe(true);
    expect(state.overlayShown).toBe(true);
    expect(state.videoPaused).toBe(true);
    expect(state.scrollLocked).toBe(true);
  });

  test('restores everything off the feed (/@user)', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await buildFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);
    expect(await page.evaluate(() => !!document.getElementById('ml-tt-overlay'))).toBe(true);

    await page.evaluate(() => {
      history.pushState({}, '', '/@someuser');
      const n = document.createElement('div'); document.body.appendChild(n); n.remove();
    });
    await page.waitForTimeout(1_500);

    const state = await page.evaluate(() => {
      const swiper = document.getElementById('ml-test-swiper');
      return {
        overlayGone: !document.getElementById('ml-tt-overlay'),
        styleGone: !document.getElementById('ml-tt-style'),
        swiperVisible: swiper ? window.getComputedStyle(swiper).visibility !== 'hidden' : false,
      };
    });
    expect(state.overlayGone).toBe(true);
    expect(state.styleGone).toBe(true);
    expect(state.swiperVisible).toBe(true);
  });

});
