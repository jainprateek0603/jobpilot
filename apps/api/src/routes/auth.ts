import { Router } from 'express'
import { changePasswordSchema, loginSchema, registerSchema } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from '../lib/cookies.js'
import { asyncHandler } from '../lib/async.js'
import { prisma } from '../lib/prisma.js'
import { authLimiter } from '../middleware/rate-limit.js'
import { currentUserId, requireAllowedOrigin, requireAuth, withBody } from '../middleware/auth.js'
import {
  changePassword,
  getUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  sessionMeta,
} from '../services/auth-service.js'

export function authRouter(config: Config) {
  const router = Router()
  if (!config.rateLimitDisabled) router.use(authLimiter(config))

  router.post(
    '/register',
    withBody(registerSchema, async (req, res, body) => {
      const result = await registerUser(body, config, sessionMeta(req))
      setRefreshCookie(res, result.refreshToken, config)
      res.status(201).json({ data: { accessToken: result.accessToken, user: result.user } })
    }),
  )

  router.post(
    '/login',
    withBody(loginSchema, async (req, res, body) => {
      const result = await loginUser(body, config, sessionMeta(req))
      setRefreshCookie(res, result.refreshToken, config)
      res.json({ data: { accessToken: result.accessToken, user: result.user } })
    }),
  )

  router.post(
    '/refresh',
    requireAllowedOrigin,
    asyncHandler(async (req, res) => {
      const result = await refreshSession(req.cookies?.[REFRESH_COOKIE] as string | undefined, config, sessionMeta(req))
      setRefreshCookie(res, result.refreshToken, config)
      res.json({ data: { accessToken: result.accessToken } })
    }),
  )

  router.post(
    '/logout',
    requireAllowedOrigin,
    asyncHandler(async (req, res) => {
      await logoutSession(req.cookies?.[REFRESH_COOKIE] as string | undefined)
      clearRefreshCookie(res, config)
      res.json({ data: { ok: true } })
    }),
  )

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ data: await getUser(currentUserId(req)) })
    }),
  )

  router.post(
    '/change-password',
    requireAuth,
    withBody(changePasswordSchema, async (req, res, body) => {
      await changePassword(currentUserId(req), body, config)
      clearRefreshCookie(res, config)
      res.json({ data: { ok: true } })
    }),
  )

  return router
}

export function healthRouter() {
  const router = Router()
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`
      res.json({ data: { ok: true } })
    }),
  )
  return router
}
