import './env.js'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { resetDatabase } from './helpers.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

execSync('npx prisma db push --skip-generate --accept-data-loss', {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})
