/**
 * ig_stories.spec.js
 *
 * Verifies that the ig_stories JS filter hides the stories tray on the home feed.
 *
 * The filter detects the tray by looking for a horizontally scrollable div near
 * the top of the page with ≥3 role=button children. If Instagram changes this
 * structure, this test will fail — which is exactly the signal we need.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_stories.js');

test.describe('ig_stories filter', () => {
  test('stories tray is visible on home feed before injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Detect the stories tray using evaluate (same logic as the filter script)
    const trayFound = await page.evaluate(() => {
      const divs = document.querySelectorAll('div');
      for (const div of divs) {
        const cs = window.getComputedStyle(div);
        if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
        const rect = div.getBoundingClientRect();
        if (rect.top > 200 || rect.top < -10) continue;
        if (rect.height < 80 || rect.height > 200) continue;
        const buttons = div.querySelectorAll('[role="button"]');
        if (buttons.length < 3) continue;
        return true;
      }
      return false;
    });

    expect(trayFound).toBe(true);
  });

  test('stories tray is hidden after JS injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Record bounding rects of the tray before injection
    const trayBefore = await page.evaluate(() => {
      const divs = document.querySelectorAll('div');
      for (const div of divs) {
        const cs = window.getComputedStyle(div);
        if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
        const rect = div.getBoundingClientRect();
        if (rect.top > 200 || rect.top < -10) continue;
        if (rect.height < 80 || rect.height > 200) continue;
        const buttons = div.querySelectorAll('[role="button"]');
        if (buttons.length < 3) continue;
        return { found: true, display: cs.display };
      }
      return { found: false };
    });

    expect(trayBefore.found).toBe(true);

    // Inject filter (wrap in IIFE so multi-statement JS works as an expression)
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(`(function(){\n${js}\n})()`);
    await page.waitForTimeout(2_500); // let setInterval run

    // Now the tray should be hidden
    const trayAfter = await page.evaluate(() => {
      const divs = document.querySelectorAll('div');
      for (const div of divs) {
        const cs = window.getComputedStyle(div);
        if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
        const rect = div.getBoundingClientRect();
        if (rect.top > 200 || rect.top < -10) continue;
        if (rect.height < 80 || rect.height > 200) continue;
        const buttons = div.querySelectorAll('[role="button"]');
        if (buttons.length < 3) continue;
        return { found: true, display: cs.display };
      }
      return { found: false };
    });

    // The element should either be gone or have display:none
    if (trayAfter.found) {
      expect(trayAfter.display).toBe('none');
    }
    // If not found at all — it was removed from DOM — that's fine too
  });
});
