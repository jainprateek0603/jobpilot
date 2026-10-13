import type { Resume } from '@prisma/client'
import type { z } from 'zod'
import { resumePatchSchema, resumeWriteSchema } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { extractResumeText, removeStoredFile, storeUpload } from '../lib/resume-text.js'
import { ownedResume } from './access.js'

type ResumeWrite = z.infer<typeof resumeWriteSchema>
type ResumePatch = z.infer<typeof resumePatchSchema>

export function presentResume(resume: Resume) {
  return {
    id: resume.id,
    title: resume.title,
    content: resume.content,
    fileName: resume.fileName,
    mimeType: resume.mimeType,
    hasFile: Boolean(resume.filePath),
    isDefault: resume.isDefault,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  }
}

async function clearDefault(userId: string, exceptId?: string) {
  await prisma.resume.updateMany({
    where: { userId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isDefault: false },
  })
}

export async function listResumes(userId: string) {
  const resumes = await prisma.resume.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } })
  return resumes.map(presentResume)
}

export async function createResume(userId: string, input: ResumeWrite) {
  const count = await prisma.resume.count({ where: { userId } })
  const isDefault = input.isDefault ?? count === 0
  if (isDefault) await clearDefault(userId)
  const resume = await prisma.resume.create({
    data: { userId, title: input.title, content: input.content, isDefault },
  })
  return presentResume(resume)
}

export async function createResumeFromUpload(
  userId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer },
  title: string,
  isDefault: boolean | undefined,
  config: Config,
) {
  const content = await extractResumeText(file.originalname, file.buffer)
  const count = await prisma.resume.count({ where: { userId } })
  const makeDefault = isDefault ?? count === 0
  if (makeDefault) await clearDefault(userId)
  const created = await prisma.resume.create({
    data: {
      userId,
      title: title.trim() || file.originalname,
      content,
      fileName: file.originalname,
      mimeType: file.mimetype,
      isDefault: makeDefault,
    },
  })
  try {
    const filePath = await storeUpload(config.UPLOAD_DIR, created.id, file.originalname, file.buffer)
    const resume = await prisma.resume.update({ where: { id: created.id }, data: { filePath } })
    return presentResume(resume)
  } catch (error) {
    await prisma.resume.delete({ where: { id: created.id } }).catch(() => undefined)
    throw error
  }
}

export async function getResume(userId: string, id: string) {
  return presentResume(await ownedResume(userId, id))
}

export async function resumeFile(userId: string, id: string, config: Config) {
  const resume = await ownedResume(userId, id)
  if (!resume.filePath) throw new AppError(404, 'NOT_FOUND', 'File not found')
  const { assertInsideDirectory } = await import('../lib/resume-text.js')
  return { path: assertInsideDirectory(config.UPLOAD_DIR, resume.filePath), fileName: resume.fileName || 'resume' }
}

export async function updateResume(userId: string, id: string, input: ResumePatch) {
  if (Object.keys(input).length === 0) throw new AppError(400, 'VALIDATION', 'Provide a field to update')
  const existing = await ownedResume(userId, id)
  if (input.isDefault) await clearDefault(userId, existing.id)
  const resume = await prisma.resume.update({
    where: { id: existing.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  })
  return presentResume(resume)
}

export async function deleteResume(userId: string, id: string) {
  const existing = await ownedResume(userId, id)
  await removeStoredFile(existing.filePath)
  await prisma.resume.delete({ where: { id: existing.id } })
  if (existing.isDefault) {
    const next = await prisma.resume.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } })
    if (next) await prisma.resume.update({ where: { id: next.id }, data: { isDefault: true } })
  }
}
