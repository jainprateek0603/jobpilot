import { Router } from 'express'
import express from 'express'
import {
  applicationPatchSchema,
  applicationWriteSchema,
  contactSchema,
  importCsvSchema,
  listApplicationsQuerySchema,
  noteSchema,
  parseLinkSchema,
  reorderSchema,
} from '@jobpilot/shared'
import { AppError } from '../lib/errors.js'
import { asyncHandler } from '../lib/async.js'
import { currentUserId, requireAuth, withBody, withQuery } from '../middleware/auth.js'
import {
  addContact,
  addNote,
  createApplication,
  deleteApplication,
  deleteContact,
  enrichJobLink,
  exportApplications,
  getApplication,
  importApplications,
  listApplications,
  reorderApplications,
  updateApplication,
  updateContact,
} from '../services/application-service.js'

const contactPatchSchema = contactSchema.partial()

export function applicationRouter() {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    withQuery(listApplicationsQuerySchema, async (req, res, query) => {
      const result = await listApplications(currentUserId(req), query)
      res.json({ data: result.items, meta: result.meta })
    }),
  )

  router.post(
    '/',
    withBody(applicationWriteSchema, async (req, res, body) => {
      const created = await createApplication(currentUserId(req), body)
      const detailed = await getApplication(currentUserId(req), created.id)
      res.status(201).json({ data: detailed })
    }),
  )

  router.post(
    '/reorder',
    withBody(reorderSchema, async (req, res, body) => {
      await reorderApplications(currentUserId(req), body)
      res.json({ data: { ok: true } })
    }),
  )

  router.post(
    '/parse-link',
    withBody(parseLinkSchema, async (_req, res, body) => {
      res.json({ data: await enrichJobLink(body.input, body.fetchPage === true) })
    }),
  )

  router.get(
    '/export',
    asyncHandler(async (req, res) => {
      const csv = await exportApplications(currentUserId(req))
      res.setHeader('content-type', 'text/csv; charset=utf-8')
      res.setHeader('content-disposition', 'attachment; filename="jobpilot-applications.csv"')
      res.send(csv)
    }),
  )

  router.post('/import', csvParser, asyncHandler(async (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : readCsvField(req.body)
    const parsed = importCsvSchema.safeParse({ csv })
    if (!parsed.success) throw new AppError(400, 'VALIDATION', 'Choose a CSV file')
    const result = await importApplications(currentUserId(req), parsed.data.csv)
    res.status(201).json({ data: result })
  }))

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      res.json({ data: await getApplication(currentUserId(req), String(req.params.id)) })
    }),
  )

  router.patch(
    '/:id',
    withBody(applicationPatchSchema, async (req, res, body) => {
      res.json({ data: await updateApplication(currentUserId(req), String(req.params.id), body) })
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await deleteApplication(currentUserId(req), String(req.params.id))
      res.json({ data: { ok: true } })
    }),
  )

  router.post(
    '/:id/contacts',
    withBody(contactSchema, async (req, res, body) => {
      res.status(201).json({ data: await addContact(currentUserId(req), String(req.params.id), body) })
    }),
  )

  router.post(
    '/:id/events',
    withBody(noteSchema, async (req, res, body) => {
      res.status(201).json({ data: await addNote(currentUserId(req), String(req.params.id), body) })
    }),
  )

  return router
}

export function contactRouter() {
  const router = Router()
  router.use(requireAuth)
  router.patch(
    '/:id',
    withBody(contactPatchSchema, async (req, res, body) => {
      res.json({ data: await updateContact(currentUserId(req), String(req.params.id), body) })
    }),
  )
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await deleteContact(currentUserId(req), String(req.params.id))
      res.json({ data: { ok: true } })
    }),
  )
  return router
}

function csvParser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const type = req.headers['content-type'] ?? ''
  if (type.includes('text/csv') || type.includes('text/plain') || type.includes('application/csv')) {
    express.text({ type: ['text/csv', 'text/plain', 'application/csv'], limit: '2mb' })(req, res, next)
    return
  }
  next()
}

function readCsvField(body: unknown) {
  if (body && typeof body === 'object' && 'csv' in body && typeof body.csv === 'string') return body.csv
  return ''
}
