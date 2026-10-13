import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { AppError, zodFields } from '../lib/errors.js'
import { readAccessToken } from '../lib/tokens.js'
import type { Config } from '../config.js'
import { allowedOrigins } from '../config.js'

declare global {
  // Express augments Request through a namespace. The rule prefers import syntax, which cannot merge this interface.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function currentUserId(req: Request): string {
  if (!req.userId) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue')
  return req.userId
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const config = req.app.locals.config as Config
  const header = req.header('authorization')
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue'))
    return
  }
  try {
    const claims = readAccessToken(header.slice('Bearer '.length).trim(), config)
    req.userId = claims.sub
    next()
  } catch (error) {
    next(error)
  }
}

export function requireAllowedOrigin(req: Request, _res: Response, next: NextFunction) {
  const config = req.app.locals.config as Config
  const origin = req.header('origin')
  if (!origin) {
    next()
    return
  }
  if (!allowedOrigins(config).includes(origin)) {
    next(new AppError(403, 'FORBIDDEN', 'Origin is not allowed'))
    return
  }
  next()
}

export function withBody<T>(schema: ZodType<T>, handler: (req: Request, res: Response, body: T) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      next(new AppError(400, 'VALIDATION', 'Check the highlighted fields', zodFields(parsed.error)))
      return
    }
    handler(req, res, parsed.data).catch(next)
  }
}

export function withQuery<T>(schema: ZodType<T>, handler: (req: Request, res: Response, query: T) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      next(new AppError(400, 'VALIDATION', 'Check the highlighted fields', zodFields(parsed.error)))
      return
    }
    handler(req, res, parsed.data).catch(next)
  }
}
