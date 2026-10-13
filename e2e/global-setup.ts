import { execSync } from 'node:child_process'

export default function setup() {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: 'apps/api',
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'file:./e2e.db',
    },
  })
}
