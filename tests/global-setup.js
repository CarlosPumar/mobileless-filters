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

  // -- Step 1: Dismiss cookie consent dialog (shown in fresh sessions) --
  try {
    const cookieBtn = page.locator('div[role="button"]')
      .filter({ hasText: /allow all cookies/i })
      .first();
    await cookieBtn.click({ timeout: 8_000 });
    console.log('[setup] Cookie dialog dismissed.');
    await page.waitForTimeout(1_500);
  } catch {
    // Dialog not shown — fine
  }

  // Screenshot after dismissing cookie dialog
  await page.screenshot({ path: path.join(__dirname, 'before-login.png') });

  // -- Step 2: Fill credentials --
  // Instagram sets the username field as type="email" which causes browser validation
  // to reject plain usernames. Change it to "text" before filling to bypass this.
  await page.waitForSelector('input[name="username"]', { timeout: 20_000 });
  await page.evaluate(() => {
    document.querySelector('input[name="username"]').type = 'text';
  });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Small pause so Instagram enables the submit button
  await page.waitForTimeout(500);

  // -- Step 3: Click the login button --
  // Instagram uses <div role="button"> not <button> — use locator().filter() for hasText
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

  // -- Step 5: Dismiss post-login prompts --
  // "Save your login info?" prompt
  try {
    await page.locator('div[role="button"]').filter({ hasText: /not now/i }).first().click({ timeout: 5_000 });
  } catch {
    // Not shown — fine
  }

  // "Turn on notifications?" prompt
  try {
    await page.locator('div[role="button"]').filter({ hasText: /not now/i }).first().click({ timeout: 5_000 });
  } catch {
    // Not shown — fine
  }

  await context.storageState({ path: AUTH_FILE });
  console.log('[setup] Logged in. Session saved to auth.json');

  await browser.close();
};
