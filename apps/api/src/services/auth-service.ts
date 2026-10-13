import type { Request } from 'express'
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { AppError } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { hashToken, readRefreshToken, signAccessToken, signRefreshToken } from '../lib/tokens.js'

export type SessionMeta = { userAgent: string; ip: string }

export function sessionMeta(req: Request): SessionMeta {
  return { userAgent: req.get('user-agent') ?? '', ip: req.ip ?? '' }
}

export function publicUser(user: {
  id: string
  email: string
  name: string
  headline: string
  location: string
  phone: string
  linkedinUrl: string
  websiteUrl: string
  timezone: string
  theme: string
  emailReminders: boolean
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    headline: user.headline,
    location: user.location,
    phone: user.phone,
    linkedinUrl: user.linkedinUrl,
    websiteUrl: user.websiteUrl,
    timezone: user.timezone,
    theme: user.theme,
    emailReminders: user.emailReminders,
    createdAt: user.createdAt.toISOString(),
  }
}

async function issueSession(userId: string, config: Config, meta: SessionMeta) {
  const refresh = signRefreshToken(userId, config)
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refresh.token),
      expiresAt: refresh.expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  })
  return { accessToken: signAccessToken(userId, config), refreshToken: refresh.token }
}

export async function registerUser(input: RegisterInput, config: Config, meta: SessionMeta) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw new AppError(409, 'CONFLICT', 'An account with that email already exists')
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password, config.BCRYPT_ROUNDS),
    },
  })
  const session = await issueSession(user.id, config, meta)
  return { ...session, user: publicUser(user) }
}

export async function loginUser(input: LoginInput, config: Config, meta: SessionMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) {
    await hashPassword(input.password, config.BCRYPT_ROUNDS)
    throw new AppError(401, 'UNAUTHORIZED', 'Email or password is incorrect')
  }
  const matches = await verifyPassword(input.password, user.passwordHash)
  if (!matches) throw new AppError(401, 'UNAUTHORIZED', 'Email or password is incorrect')
  const session = await issueSession(user.id, config, meta)
  return { ...session, user: publicUser(user) }
}

export async function refreshSession(token: string | undefined, config: Config, meta: SessionMeta) {
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  const claims = readRefreshToken(token, config)
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.userId !== claims.sub) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  }
  if (record.expiresAt.getTime() <= Date.now()) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  const next = signRefreshToken(record.userId, config)
  const created = await prisma.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: hashToken(next.token),
      expiresAt: next.expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  })
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedBy: created.id },
  })
  return { accessToken: signAccessToken(record.userId, config), refreshToken: next.token }
}

export async function logoutSession(token: string | undefined) {
  if (!token) return
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function changePassword(userId: string, input: ChangePasswordInput, config: Config) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  const matches = await verifyPassword(input.currentPassword, user.passwordHash)
  if (!matches) throw new AppError(400, 'VALIDATION', 'Current password is incorrect', { currentPassword: ['Current password is incorrect'] })
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword, config.BCRYPT_ROUNDS) },
  })
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  return publicUser(user)
}

export function assertTimezone(value: string) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    throw new AppError(400, 'VALIDATION', 'Choose a valid timezone', { timezone: ['Choose a valid timezone'] })
  }
}

export async function updateProfile(
  userId: string,
  input: { name: string; headline: string; location: string; phone: string; linkedinUrl: string; websiteUrl: string },
) {
  const user = await prisma.user.update({ where: { id: userId }, data: input })
  return publicUser(user)
}

export async function updateSettings(
  userId: string,
  input: { theme: string; timezone: string; emailReminders: boolean },
) {
  assertTimezone(input.timezone)
  const user = await prisma.user.update({ where: { id: userId }, data: input })
  return publicUser(user)
}
