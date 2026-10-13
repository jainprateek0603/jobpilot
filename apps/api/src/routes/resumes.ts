import { Router } from 'express'
import multer from 'multer'
import { resumePatchSchema, resumeWriteSchema } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/async.js'
import { currentUserId, requireAuth, withBody } from '../middleware/auth.js'
import {
  createResume,
  createResumeFromUpload,
  deleteResume,
  getResume,
  listResumes,
  resumeFile,
  updateResume,
} from '../services/resume-service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (/\.(pdf|txt|md)$/i.test(file.originalname)) callback(null, true)
    else callback(new Error('Upload a PDF, text, or Markdown file'))
  },
})

export function resumeRouter(config: Config) {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json({ data: await listResumes(currentUserId(req)) })
    }),
  )

  router.post(
    '/',
    withBody(resumeWriteSchema, async (req, res, body) => {
      res.status(201).json({ data: await createResume(currentUserId(req), body) })
    }),
  )

  router.post(
    '/upload',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) throw new AppError(400, 'VALIDATION', 'Choose a file')
      const title = typeof req.body?.title === 'string' ? req.body.title : req.file.originalname
      const isDefault = req.body?.isDefault === 'true' || req.body?.isDefault === true
      const resume = await createResumeFromUpload(currentUserId(req), req.file, title, isDefault, config)
      res.status(201).json({ data: resume })
    }),
  )

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json({ data: await getResume(currentUserId(req), String(req.params.id)) })
    }),
  )

  router.get(
    '/:id/file',
    asyncHandler(async (req, res) => {
      const file = await resumeFile(currentUserId(req), String(req.params.id), config)
      res.download(file.path, file.fileName)
    }),
  )

  router.patch(
    '/:id',
    withBody(resumePatchSchema, async (req, res, body) => {
      res.json({ data: await updateResume(currentUserId(req), String(req.params.id), body) })
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await deleteResume(currentUserId(req), String(req.params.id))
      res.json({ data: { ok: true } })
    }),
  )

  return router
}
