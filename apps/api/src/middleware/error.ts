import { Prisma } from '@prisma/client'
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    })
    return
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION', message: 'Check the highlighted fields', fields: flatten(error) },
    })
    return
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Upload a file smaller than 5 MB' : 'That upload was rejected'
    res.status(400).json({ error: { code: 'VALIDATION', message } })
    return
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Request body must be JSON' } })
    return
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'An account with that email already exists' } })
    return
  }
  if (error instanceof Error && error.message === 'Upload a PDF, text, or Markdown file') {
    res.status(400).json({ error: { code: 'VALIDATION', message: error.message } })
    return
  }
  logger.error('unhandled error', { message: error instanceof Error ? error.message : 'unknown' })
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } })
}

function flatten(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    const list = fields[key] ?? []
    list.push(issue.message)
    fields[key] = list
  }
  return fields
}
