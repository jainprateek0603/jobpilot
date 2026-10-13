import type { Response } from 'express'
import type { Config } from '../config.js'

export const REFRESH_COOKIE = 'jobpilot_refresh'

export function setRefreshCookie(res: Response, token: string, config: Config) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  })
}

export function clearRefreshCookie(res: Response, config: Config) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/api/auth',
  })
}
