import { Router } from 'express'
import { calendarQuerySchema, reminderPatchSchema, reminderWriteSchema } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { asyncHandler } from '../lib/async.js'
import { currentUserId, requireAuth, withBody, withQuery } from '../middleware/auth.js'
import { analyticsForUser, calendarForUser } from '../services/analytics-service.js'
import { createReminder, deleteReminder, listReminders, processDueReminders, updateReminder } from '../services/reminder-service.js'

export function reminderRouter(config: Config) {
  const router = Router()
  router.use(requireAuth)
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ data: await listReminders(currentUserId(req)) })
    }),
  )
  router.post(
    '/',
    withBody(reminderWriteSchema, async (req, res, body) => {
      res.status(201).json({ data: await createReminder(currentUserId(req), body) })
    }),
  )
  router.post(
    '/run',
    asyncHandler(async (req, res) => {
      const processed = await processDueReminders(config, { userId: currentUserId(req) })
      res.json({ data: { processed } })
    }),
  )
  router.patch(
    '/:id',
    withBody(reminderPatchSchema, async (req, res, body) => {
      res.json({ data: await updateReminder(currentUserId(req), String(req.params.id), body) })
    }),
  )
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await deleteReminder(currentUserId(req), String(req.params.id))
      res.json({ data: { ok: true } })
    }),
  )
  return router
}

export function analyticsRouter() {
  const router = Router()
  router.use(requireAuth)
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ data: await analyticsForUser(currentUserId(req)) })
    }),
  )
  return router
}

export function calendarRouter() {
  const router = Router()
  router.use(requireAuth)
  router.get(
    '/',
    withQuery(calendarQuerySchema, async (req, res, query) => {
      res.json({ data: await calendarForUser(currentUserId(req), new Date(query.from), new Date(query.to)) })
    }),
  )
  return router
}
