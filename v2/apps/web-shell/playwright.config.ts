import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './e2e',
 timeout: 30000,
 use: { baseURL: 'http://127.0.0.1:4186', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? 'msedge', headless: true },
 webServer: { command: 'npm run dev -- --port 4186 --strictPort', url: 'http://127.0.0.1:4186', reuseExistingServer: false, timeout: 30000 },
 reporter: [['list']],
});

