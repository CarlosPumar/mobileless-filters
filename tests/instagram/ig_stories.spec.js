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

    // The tray is a horizontally-scrollable container near the top
    const storyTray = page.locator('div').filter(async (el) => {
      const style = await el.evaluate((node) => {
        const cs = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const buttons = node.querySelectorAll('[role="button"]');
        return {
          overflowX: cs.overflowX,
          top: rect.top,
          height: rect.height,
          buttonCount: buttons.length,
        };
      });
      return (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        style.top >= 0 &&
        style.top <= 200 &&
        style.height >= 80 &&
        style.height <= 200 &&
        style.buttonCount >= 3
      );
    }).first();

    await expect(storyTray).toBeVisible({ timeout: 20_000 });
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

    // Inject filter
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(js);
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
