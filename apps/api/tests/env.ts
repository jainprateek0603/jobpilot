import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const worker = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '0'
const database = path.join(root, 'prisma', `test-${worker}.db`).replaceAll('\\', '/')

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = `file:${database}`
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-characters-min'
process.env.AI_PROVIDER = 'mock'
process.env.RATE_LIMIT_DISABLED = 'true'
process.env.BCRYPT_ROUNDS = '4'
process.env.UPLOAD_DIR = path.join(root, 'uploads-test')
process.env.CORS_ORIGIN = 'http://localhost:5173'
process.env.WEB_DIST = ''
process.env.SMTP_HOST = ''
