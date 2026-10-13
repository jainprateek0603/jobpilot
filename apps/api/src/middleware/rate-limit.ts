import rateLimit from 'express-rate-limit'
import type { Config } from '../config.js'

function limitMessage() {
  return { error: { code: 'RATE_LIMIT', message: 'Too many requests. Try again shortly.' } }
}

export function globalLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage(),
  })
}

export function authLimiter(config: Config) {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage(),
  })
}

export function aiLimiter(config: Config) {
  return rateLimit({
    windowMs: 60 * 60_000,
    limit: config.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage(),
  })
}
