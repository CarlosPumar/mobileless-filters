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

  // Take a screenshot so we can debug what Instagram is showing
  await page.screenshot({ path: path.join(__dirname, 'before-login.png') });

  // Wait for the username field to be visible (guards against slow loads)
  // Instagram uses type="email" for the username field
  await page.waitForSelector('input[name="username"]', { timeout: 20_000 });

  // Fill credentials
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Small pause so Instagram enables the submit button
  await page.waitForTimeout(500);

  // Instagram uses <div role="button"> instead of <button> for the login submit.
  // Try multiple selectors in order of specificity.
  const submitSelectors = [
    'div[role="button"]:has-text("Log in")',
    'div[role="button"]:has-text("Iniciar sesión")',
    'div[role="button"]:has-text("Log In")',
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Iniciar sesión")',
    'form button',
    'div[role="button"]',
  ];
  let clicked = false;
  for (const selector of submitSelectors) {
    try {
      await page.click(selector, { timeout: 5_000 });
      clicked = true;
      console.log(`[setup] Clicked submit button with selector: ${selector}`);
      break;
    } catch {
      // Try next selector
    }
  }
  if (!clicked) {
    await page.screenshot({ path: path.join(__dirname, 'login-failed.png') });
    await browser.close();
    throw new Error(
      '[setup] Could not find the submit button on the Instagram login page.\n' +
      'Instagram may have changed its login form. Check before-login.png and login-failed.png.'
    );
  }

  // Wait to leave the login page (redirect to feed or "save info" prompt)
  try {
    await page.waitForURL(
      (url) => !url.toString().includes('/accounts/login'),
      { timeout: 20_000 }
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

  // Dismiss "Save your login info?" prompt if it appears
  try {
    await page.click('button:has-text("Not now")', { timeout: 5_000 });
  } catch {
    // Not shown — fine
  }

  // Dismiss "Turn on notifications?" prompt if it appears
  try {
    await page.click('button:has-text("Not now")', { timeout: 5_000 });
  } catch {
    // Not shown — fine
  }

  await context.storageState({ path: AUTH_FILE });
  console.log(`[setup] Logged in. Session saved to auth.json`);

  await browser.close();
};
