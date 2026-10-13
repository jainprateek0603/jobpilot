import { Router } from 'express'
import { coverLetterSchema, interviewPrepSchema, practiceAnswerSchema, tailorSchema } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { asyncHandler } from '../lib/async.js'
import { aiLimiter } from '../middleware/rate-limit.js'
import { currentUserId, requireAuth, withBody } from '../middleware/auth.js'
import {
  createInterviewPrep,
  getInterviewPrep,
  getTailored,
  listCoverLetters,
  listInterviewPreps,
  listTailored,
  scoreAnswer,
  tailorResume,
  writeCoverLetter,
} from '../services/ai-service.js'

export function aiRouter(config: Config) {
  const router = Router()
  router.use(requireAuth)
  if (!config.rateLimitDisabled) router.use(aiLimiter(config))

  router.post(
    '/tailor',
    withBody(tailorSchema, async (req, res, body) => {
      res.status(201).json({ data: await tailorResume(currentUserId(req), body, config) })
    }),
  )
  router.get(
    '/tailored',
    asyncHandler(async (req, res) => {
      res.json({ data: await listTailored(currentUserId(req)) })
    }),
  )
  router.get(
    '/tailored/:id',
    asyncHandler(async (req, res) => {
      res.json({ data: await getTailored(currentUserId(req), String(req.params.id)) })
    }),
  )
  router.post(
    '/cover-letter',
    withBody(coverLetterSchema, async (req, res, body) => {
      res.status(201).json({ data: await writeCoverLetter(currentUserId(req), body, config) })
    }),
  )
  router.get(
    '/cover-letters',
    asyncHandler(async (req, res) => {
      res.json({ data: await listCoverLetters(currentUserId(req)) })
    }),
  )
  router.post(
    '/interview-prep',
    withBody(interviewPrepSchema, async (req, res, body) => {
      res.status(201).json({ data: await createInterviewPrep(currentUserId(req), body, config) })
    }),
  )
  router.get(
    '/interview-prep',
    asyncHandler(async (req, res) => {
      res.json({ data: await listInterviewPreps(currentUserId(req)) })
    }),
  )
  router.get(
    '/interview-prep/:id',
    asyncHandler(async (req, res) => {
      res.json({ data: await getInterviewPrep(currentUserId(req), String(req.params.id)) })
    }),
  )
  router.post(
    '/interview-prep/:id/answers',
    withBody(practiceAnswerSchema, async (req, res, body) => {
      res.status(201).json({ data: await scoreAnswer(currentUserId(req), String(req.params.id), body, config) })
    }),
  )
  return router
}
