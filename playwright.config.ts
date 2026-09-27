import { defineConfig } from "@playwright/test";

// 仅测试服务器可覆盖端口；项目 dev 约定仍为 3536。
const testPort = process.env.E2E_PORT || "3536";
const testURL = `http://localhost:${testPort}/WorkLedger`;

/**
 * E2E 冒烟测试配置。
 * 首次运行前需安装浏览器：npx playwright install chromium
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: testURL,
    headless: true,
    locale: "zh-CN",
  },
  webServer: {
    command: process.env.E2E_PORT ? `npx next dev --webpack -p ${testPort}` : "npm run dev",
    url: testURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
