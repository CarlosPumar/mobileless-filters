const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-youtube' }],
  ],
  globalSetup: './global-setup.js',
  use: {
    ...devices['Pixel 5'],
    storageState: path.join(__dirname, 'auth.json'),
    baseURL: 'https://m.youtube.com',
    headless: true,
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
});
