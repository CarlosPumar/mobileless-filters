const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 5'],
    headless: true,
  },
});
