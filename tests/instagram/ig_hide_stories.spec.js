/**
 * ig_hide_stories.spec.js
 *
 * Verifies the ig_hide_stories JS filter: it hides OTHER people's stories
 * ("Story by <user>") from the feed tray via an injected CSS rule (so they stay
 * hidden across Instagram's re-renders while scrolling), while keeping the
 * user's own "Your story" button so they can still post a story.
 *
 * Uses synthetic DOM (the saved session is often stale). Detection + the
 * scroll-robust CSS approach were verified against the live mobile IG DOM.
 *
 * Tests:
 * 1. Script evaluates without runtime errors (self-contained; no baseline).
 * 2. On the feed: others' stories hidden, "Your story" + feed kept.
 * 3. A story inserted AFTER activation is hidden immediately (re-render/scroll).
 * 4. Off the feed (/explore/): the hide rule is removed.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_hide_stories.js');

async function inject(page) {
  await page.evaluate(`(function(){\n${fs.readFileSync(JS_FILE, 'utf-8')}\n})()`);
}

async function buildSyntheticFeed(page, pathname) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    document.body.style.margin = '0';
    document.body.innerHTML = '';
    const main = document.createElement('main');
    const tray = document.createElement('div');

    const own = document.createElement('div');
    own.id = 'ml-test-own';
    own.setAttribute('role', 'button');
    own.textContent = 'Your story'; // no story aria-label
    tray.appendChild(own);

    ['alice', 'bob', 'carol'].forEach((u, i) => {
      const b = document.createElement('div');
      b.id = 'ml-test-other-' + i;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', 'Story by ' + u + ', not seen');
      tray.appendChild(b);
    });

    const article = document.createElement('article');
    article.id = 'ml-test-post';
    article.textContent = 'a feed post';

    main.appendChild(tray);
    main.appendChild(article);
    document.body.appendChild(main);
  }, pathname);
}

const dispOf = (page, id) =>
  page.evaluate((i) => {
    const el = document.getElementById(i);
    return el ? window.getComputedStyle(el).display : 'MISSING';
  }, id);

test.describe('ig_hide_stories filter', () => {

  test('script evaluates without runtime errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await buildSyntheticFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);
    expect(errors).toHaveLength(0);
  });

  test("hides others' stories but keeps the user's own 'Your story' + feed", async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await buildSyntheticFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);

    expect(await dispOf(page, 'ml-test-other-0')).toBe('none');
    expect(await dispOf(page, 'ml-test-other-2')).toBe('none');
    expect(await dispOf(page, 'ml-test-own')).not.toBe('none');
    expect(await dispOf(page, 'ml-test-post')).not.toBe('none');
  });

  test('hides a story inserted AFTER activation immediately (re-render/scroll)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await buildSyntheticFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);

    // Simulate Instagram re-rendering / lazy-loading a new story on scroll.
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.id = 'ml-test-late';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Story by dave, not seen');
      document.querySelector('main div').appendChild(el);
    });
    // No interval wait — the CSS rule must hide it on the very next frame.
    await page.waitForTimeout(50);

    expect(await dispOf(page, 'ml-test-late')).toBe('none');
  });

  test('removes the hide rule when navigating away from the feed', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await buildSyntheticFeed(page, '/');
    await inject(page);
    await page.waitForTimeout(1_500);
    expect(await dispOf(page, 'ml-test-other-0')).toBe('none');

    await page.evaluate(() => {
      history.pushState({}, '', '/explore/');
      const n = document.createElement('div'); document.body.appendChild(n); n.remove();
    });
    await page.waitForTimeout(2_500);

    expect(await page.evaluate(() => !!document.getElementById('ml-ig-stories-hide'))).toBe(false);
    expect(await dispOf(page, 'ml-test-other-0')).not.toBe('none');
  });

});
