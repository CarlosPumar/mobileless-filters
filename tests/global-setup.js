/**
 * global-setup.js
 *
 * Runs once before all tests. Logs in to Instagram with the credentials
 * stored in INSTAGRAM_USERNAME / INSTAGRAM_PASSWORD env vars (GitHub Secrets),
 * and saves the session cookies to auth.json.
 *
 * This means cookies are always fresh — no expiry issues.
 */

const { chromium, devices } = require('@playwright/test');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'auth.json');

/**
 * Dismiss the Instagram cookie consent page if it's present.
 *
 * The cookie consent is NOT a <dialog> — it is a full-page section rendered
 * at the same URL as the login form. The buttons are standard <button> elements.
 * After clicking "Allow all cookies", Instagram re-renders the login form
 * in-place (same URL, no redirect).
 *
 * Returns true if the consent page was found and dismissed, false otherwise.
 */
async function dismissCookieConsent(page) {
  // Detect by presence of the "Allow all cookies" <button>
  const allowBtn = page.locator('button').filter({ hasText: /allow all cookies/i }).first();

  const isVisible = await allowBtn.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('[setup] No cookie consent page found — proceeding to login.');
    return false;
  }

  console.log('[setup] Cookie consent page detected — dismissing…');
  await allowBtn.click();

  // Wait for the button to disappear — signals the page re-rendered past the consent
  try {
    await allowBtn.waitFor({ state: 'hidden', timeout: 10_000 });
    console.log('[setup] Cookie consent dismissed.');
  } catch {
    // The button might have been replaced by a new render — just wait a bit and continue
    await page.waitForTimeout(2_000);
    const stillVisible = await allowBtn.isVisible().catch(() => false);
    if (stillVisible) {
      await page.screenshot({ path: path.join(__dirname, 'cookie-dialog-stuck.png') });
      throw new Error(
        '[setup] Cookie consent could not be dismissed.\n' +
        'Screenshot saved to tests/cookie-dialog-stuck.png.'
      );
    }
    console.log('[setup] Cookie consent dismissed (page re-rendered).');
  }

  return true;
}

module.exports = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Pixel 5'],
  });
  const page = await context.newPage();

  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD must be set.\n' +
      'Add them as GitHub Secrets (Settings → Secrets → Actions).'
    );
  }

  console.log(`[setup] Logging in as ${username}…`);

  await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'networkidle',
  });

  // -- Step 1: Dismiss cookie consent page (if present) --
  await dismissCookieConsent(page);
  await page.waitForTimeout(500);

  // Screenshot to confirm we're past the cookie dialog
  await page.screenshot({ path: path.join(__dirname, 'before-login.png') });

  // -- Step 2: Fill credentials --
  // Instagram's username field has type="email" which causes browser-level
  // validation to reject plain usernames. Change to "text" before filling.
  await page.waitForSelector('input[name="username"]', { timeout: 20_000 });
  await page.evaluate(() => {
    document.querySelector('input[name="username"]').type = 'text';
  });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Small pause so Instagram enables the submit button
  await page.waitForTimeout(500);

  // -- Step 3: Click the login button --
  // Instagram uses <div role="button"> (not <button>) — use locator().filter()
  let clicked = false;

  const loginTexts = ['Log in', 'Log In', 'Iniciar sesión', 'Entrar', 'Connexion'];
  for (const text of loginTexts) {
    try {
      await page.locator('div[role="button"]').filter({ hasText: text }).first().click({ timeout: 5_000 });
      clicked = true;
      console.log(`[setup] Clicked login button with text: "${text}"`);
      break;
    } catch {
      // Try next
    }
  }

  // Fallback: standard <button type="submit">
  if (!clicked) {
    try {
      await page.locator('button[type="submit"]').first().click({ timeout: 5_000 });
      clicked = true;
      console.log('[setup] Clicked button[type="submit"] fallback.');
    } catch {
      // Try next
    }
  }

  // Last resort: press Enter
  if (!clicked) {
    await page.locator('input[name="password"]').press('Enter');
    clicked = true;
    console.log('[setup] Submitted via Enter key.');
  }

  // -- Step 4: Wait for redirect away from login page --
  try {
    await page.waitForURL(
      (url) => !url.toString().includes('/accounts/login'),
      { timeout: 25_000 }
    );
  } catch {
    await page.screenshot({ path: path.join(__dirname, 'login-failed.png') });
    await browser.close();
    throw new Error(
      '[setup] Login failed — Instagram did not redirect away from the login page.\n' +
      'Possible causes: wrong credentials, 2FA enabled, or suspicious-activity block.\n' +
      'Screenshot saved to tests/login-failed.png (uploaded as CI artifact).'
    );
  }

  // -- Step 5: Dismiss post-login prompts ("Save info?", "Turn on notifications?") --
  for (let i = 0; i < 2; i++) {
    try {
      await page.locator('div[role="button"]').filter({ hasText: /not now/i }).first().click({ timeout: 5_000 });
      await page.waitForTimeout(500);
    } catch {
      // Not shown — fine
    }
  }

  // -- Step 6: Accept cookies on the feed so the cookie is stored in auth.json --
  // The cookie consent appears again on every page in a fresh session. Accepting it
  // here ensures the consent cookie is included in the saved storageState, so tests
  // don't get blocked by the consent page when they navigate to instagram.com.
  console.log('[setup] Navigating to feed to accept cookies for test sessions…');
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
  await dismissCookieConsent(page);
  await page.waitForTimeout(1_000);

  await context.storageState({ path: AUTH_FILE });
  console.log('[setup] Logged in. Session saved to auth.json');

  await browser.close();
};
