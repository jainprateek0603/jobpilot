import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from './errors.js'

const ALLOWED = new Set(['.pdf', '.txt', '.md'])

export function assertResumeFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase()
  if (!ALLOWED.has(extension)) {
    throw new AppError(400, 'VALIDATION', 'Upload a PDF, text, or Markdown file')
  }
  return extension
}

export async function extractResumeText(filename: string, buffer: Buffer): Promise<string> {
  const extension = assertResumeFilename(filename)
  if (extension === '.txt' || extension === '.md') {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim()
    if (!text) throw new AppError(400, 'VALIDATION', 'That file has no text')
    return text
  }
  if (!buffer.subarray(0, 5).toString('utf8').includes('%PDF')) {
    throw new AppError(400, 'VALIDATION', 'That file is not a PDF')
  }
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const result = await extractText(pdf, { mergePages: true })
  const text = (Array.isArray(result.text) ? result.text.join('\n') : String(result.text ?? '')).trim()
  if (!text) throw new AppError(400, 'VALIDATION', 'No text could be read from that PDF')
  return text
}

export async function storeUpload(directory: string, id: string, filename: string, buffer: Buffer): Promise<string> {
  await mkdir(directory, { recursive: true })
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const target = path.resolve(directory, `${id}-${safe}`)
  const root = path.resolve(directory)
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError(400, 'VALIDATION', 'That file name is not allowed')
  }
  await writeFile(target, buffer)
  return target
}

export function assertInsideDirectory(directory: string, filePath: string) {
  const root = path.resolve(directory)
  const target = path.resolve(filePath)
  const relative = path.relative(root, target)
  if (!filePath || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError(404, 'NOT_FOUND', 'File not found')
  }
  return target
}

export async function removeStoredFile(filePath: string) {
  if (!filePath) return
  await unlink(filePath).catch(() => undefined)
}
