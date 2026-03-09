const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: 1, // Retry once on flakiness (network, slow load)
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  globalSetup: './global-setup.js',
  use: {
    // Emulate Android mobile — matches how the app opens Instagram
    ...devices['Pixel 5'],
    storageState: path.join(__dirname, 'auth.json'),
    baseURL: 'https://www.instagram.com',
    headless: true,
    // Give pages more time to settle on slow CI runners
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
});
