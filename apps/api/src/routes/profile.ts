import { Router } from 'express'
import { profileSchema, settingsSchema } from '@jobpilot/shared'
import { asyncHandler } from '../lib/async.js'
import { currentUserId, requireAuth, withBody } from '../middleware/auth.js'
import { getUser, updateProfile, updateSettings } from '../services/auth-service.js'

export function profileRouter() {
  const router = Router()
  router.use(requireAuth)
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ data: await getUser(currentUserId(req)) })
    }),
  )
  router.patch(
    '/',
    withBody(profileSchema, async (req, res, body) => {
      res.json({ data: await updateProfile(currentUserId(req), body) })
    }),
  )
  return router
}

export function settingsRouter() {
  const router = Router()
  router.use(requireAuth)
  router.patch(
    '/',
    withBody(settingsSchema, async (req, res, body) => {
      res.json({ data: await updateSettings(currentUserId(req), body) })
    }),
  )
  return router
}
