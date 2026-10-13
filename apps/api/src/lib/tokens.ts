import { createHash, randomUUID } from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import type { Config } from '../config.js'
import { AppError } from './errors.js'

export type AccessClaims = { sub: string; type: 'access' }
export type RefreshClaims = { sub: string; type: 'refresh'; jti: string }

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function signAccessToken(userId: string, config: Config): string {
  const options: SignOptions = { expiresIn: config.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] }
  return jwt.sign({ sub: userId, type: 'access' }, config.JWT_ACCESS_SECRET, options)
}

export function signRefreshToken(userId: string, config: Config): { token: string; jti: string; expiresAt: Date } {
  const jti = randomUUID()
  const options: SignOptions = { expiresIn: `${config.REFRESH_TOKEN_TTL_DAYS}d` }
  const token = jwt.sign({ sub: userId, type: 'refresh', jti }, config.JWT_REFRESH_SECRET, options)
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  return { token, jti, expiresAt }
}

export function readAccessToken(token: string, config: Config): AccessClaims {
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET)
    if (typeof decoded === 'string' || decoded.type !== 'access' || typeof decoded.sub !== 'string') {
      throw new Error('bad token')
    }
    return { sub: decoded.sub, type: 'access' }
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  }
}

export function readRefreshToken(token: string, config: Config): RefreshClaims {
  try {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET)
    if (
      typeof decoded === 'string' ||
      decoded.type !== 'refresh' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.jti !== 'string'
    ) {
      throw new Error('bad token')
    }
    return { sub: decoded.sub, type: 'refresh', jti: decoded.jti }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  }
}
