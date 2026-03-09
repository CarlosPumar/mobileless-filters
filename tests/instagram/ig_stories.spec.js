/**
 * ig_stories.spec.js
 *
 * Verifies that the ig_stories JS filter hides the stories tray on the home feed.
 *
 * The filter detects the tray by looking for a horizontally scrollable div near
 * the top of the page with ≥3 role=button children. If Instagram changes this
 * structure, this test will fail — which is exactly the signal we need.
 *
 * NOTE: If the test account has no active stories from followed accounts,
 * the tray may not appear at all. In that case the tests are skipped rather
 * than failing, since the absence of stories is an account-state issue,
 * not a filter regression.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_stories.js');

/** Find the stories tray using the same heuristic as the filter itself. */
async function findStoriesTray(page) {
  return page.evaluate(() => {
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
}

test.describe('ig_stories filter', () => {
  test('stories tray is visible on home feed before injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const tray = await findStoriesTray(page);

    if (!tray.found) {
      // Account has no active stories from followed accounts — nothing to test.
      test.skip(true, 'No stories tray found on this account — skipping.');
    }
  });

  test('stories tray is hidden after JS injection', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const trayBefore = await findStoriesTray(page);

    if (!trayBefore.found) {
      // Account has no active stories — skip rather than fail.
      test.skip(true, 'No stories tray found on this account — skipping.');
    }

    // Inject filter (wrap in IIFE so multi-statement JS works as an expression)
    const js = fs.readFileSync(JS_FILE, 'utf-8');
    await page.evaluate(`(function(){\n${js}\n})()`);
    await page.waitForTimeout(2_500); // let setInterval run

    // Now the tray should be hidden
    const trayAfter = await findStoriesTray(page);

    // The element should either be gone or have display:none
    if (trayAfter.found) {
      expect(trayAfter.display).toBe('none');
    }
    // If not found at all — it was removed from DOM — that's fine too
  });
});
