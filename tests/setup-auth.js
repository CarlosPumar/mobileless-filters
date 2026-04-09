/**
 * setup-auth.js
 *
 * Opens a real (headed) browser so you can log in to Instagram manually.
 * Once logged in, it saves the session to auth.json so tests can reuse it
 * without needing to log in again.
 *
 * Run once:
 *   node setup-auth.js
 *
 * Then run tests normally:
 *   npx playwright test
 */

const { chromium, devices } = require('@playwright/test');
const path = require('path');
const readline = require('readline');

const AUTH_FILE = path.join(__dirname, 'auth.json');

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  console.log('\n📱 MobileLess Filter Tests — Instagram Auth Setup\n');
  console.log('A browser will open. Log in to Instagram manually.');
  console.log('When you are fully logged in and can see your feed, come back here.\n');

  await prompt('Press Enter to open the browser...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    ...devices['Pixel 5'],
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', {
    waitUntil: 'domcontentloaded',
  });

  console.log('\n👉 Log in to Instagram in the browser window.');
  console.log('   Accept any cookie banners, complete any 2FA, etc.');
  console.log('   Once you see your feed, come back here.\n');

  await prompt('Press Enter once you are logged in and can see your feed...');

  // Navigate to feed to ensure the session cookies are set
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await context.storageState({ path: AUTH_FILE });
  console.log(`\n✅ Session saved to ${AUTH_FILE}`);
  console.log('   You can now run: npx playwright test\n');

  await browser.close();
})();
