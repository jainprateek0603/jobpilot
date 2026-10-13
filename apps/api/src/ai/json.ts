import { AppError } from '../lib/errors.js'

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced?.[1] ?? trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end < start) throw new AppError(502, 'AI_OUTPUT', 'The model did not return JSON')
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown
  } catch {
    throw new AppError(502, 'AI_OUTPUT', 'The model did not return JSON')
  }
}

export function roundScore(value: unknown, min: number, max: number): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  if (!Number.isFinite(number)) return undefined
  return Math.min(max, Math.max(min, Math.round(number)))
}

export function prepareTailorPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const score = roundScore(record.matchScore, 0, 100)
  if (score !== undefined) record.matchScore = score
  return record
}

export function prepareFeedbackPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const score = roundScore(record.score, 1, 10)
  if (score !== undefined) record.score = score
  return record
}
