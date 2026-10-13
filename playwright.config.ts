import { defineConfig, devices } from '@playwright/test'

const apiEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '4010',
  DATABASE_URL: 'file:./e2e.db',
  JWT_ACCESS_SECRET: 'e2e-access-secret-32-characters-long',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-32-characters-long',
  AI_PROVIDER: 'mock',
  RATE_LIMIT_DISABLED: 'true',
  BCRYPT_ROUNDS: '4',
  CORS_ORIGIN: 'http://127.0.0.1:5174',
  UPLOAD_DIR: './uploads-e2e',
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run start:e2e -w @jobpilot/api',
      url: 'http://127.0.0.1:4010/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: apiEnv,
    },
    {
      command: 'npm run dev -w @jobpilot/web -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      env: { ...process.env, VITE_API_PROXY: 'http://127.0.0.1:4010' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
