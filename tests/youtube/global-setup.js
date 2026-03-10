/**
 * global-setup.js (YouTube)
 *
 * Runs once before all tests. Navigates to m.youtube.com (home and /shorts),
 * accepts the cookie/consent page if present, and saves the session cookies
 * to auth.json so individual tests don't get redirected to the consent page.
 *
 * No login required — YouTube home and Shorts are publicly accessible.
 */

const { chromium, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const AUTH_FILE = path.join(__dirname, 'auth.json');

/**
 * Accept YouTube cookie consent at consent.youtube.com if present.
 * Returns true if consent was handled.
 */
async function acceptConsentIfNeeded(page) {
  if (!page.url().includes('consent.youtube.com')) return false;
  console.log('[yt-setup] Consent page detected — accepting…');
  try {
    // Use Promise.all to capture the navigation triggered by form submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }),
      page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          b => /accept all/i.test(b.textContent) || /accept all/i.test(b.getAttribute('aria-label') || '')
        );
        if (btn) btn.click();
      }),
    ]);
    console.log('[yt-setup] Consent accepted.');
    return true;
  } catch (e) {
    console.error('[yt-setup] Could not dismiss consent:', e.message);
    await page.screenshot({ path: path.join(__dirname, 'consent-failed.png') });
    return false;
  }
}

module.exports = async () => {
  // Re-use existing auth file if less than 12 hours old.
  if (fs.existsSync(AUTH_FILE)) {
    const age = Date.now() - fs.statSync(AUTH_FILE).mtimeMs;
    if (age < 12 * 60 * 60 * 1000) {
      console.log('[yt-setup] Using cached auth.json (< 12h old).');
      return;
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Pixel 5'],
  });
  const page = await context.newPage();

  // ── Step 1: Home page ────────────────────────────────────────────────────
  console.log('[yt-setup] Navigating to m.youtube.com…');
  await page.goto('https://m.youtube.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await acceptConsentIfNeeded(page);

  // ── Step 2: Shorts page (may require its own consent cookie) ─────────────
  console.log('[yt-setup] Navigating to m.youtube.com/shorts…');
  try {
    await page.goto('https://m.youtube.com/shorts', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // Follow any JavaScript redirects to /shorts/VIDEO_ID
    if (!page.url().includes('/shorts/')) {
      await page.waitForURL(/\/shorts\//, { timeout: 10_000 }).catch(() => {});
    }
    await acceptConsentIfNeeded(page);
  } catch (e) {
    console.warn('[yt-setup] Shorts navigation failed (non-fatal):', e.message);
  }

  await context.storageState({ path: AUTH_FILE });
  console.log('[yt-setup] Cookies saved to auth.json');

  await browser.close();
};
