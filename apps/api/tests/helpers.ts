import request from 'supertest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { prisma } from '../src/lib/prisma.js'

export const app = createApp(loadConfig())

export async function resetDatabase() {
  await prisma.practiceAnswer.deleteMany()
  await prisma.interviewQuestion.deleteMany()
  await prisma.interviewPrep.deleteMany()
  await prisma.coverLetter.deleteMany()
  await prisma.tailoredResume.deleteMany()
  await prisma.emailOutbox.deleteMany()
  await prisma.reminder.deleteMany()
  await prisma.timelineEvent.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.application.deleteMany()
  await prisma.resume.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.passwordReset.deleteMany()
  await prisma.user.deleteMany()
}

export async function register(name = 'Ada Lovelace') {
  const email = `ada-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`
  const password = 'Password123'
  const response = await request(app).post('/api/auth/register').send({ email, password, name })
  return {
    email,
    password,
    token: response.body.data.accessToken as string,
    user: response.body.data.user,
    status: response.status,
  }
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}
