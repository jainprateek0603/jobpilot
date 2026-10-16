import { z } from 'zod'
import {
  APPLICATION_STATUSES,
  COVER_TONES,
  REMINDER_STATUSES,
  REMINDER_TYPES,
  THEMES,
} from './constants.js'

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter an email')
  .email('Enter a valid email')
  .max(200)
  .transform((value) => value.toLowerCase())

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/[0-9]/, 'Include a number')

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Enter your name').max(80),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(72),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(72),
  newPassword: passwordSchema,
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'That reset link is invalid'),
  newPassword: passwordSchema,
})

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Enter an http(s) link')

export const optionalTimestamp = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value == null || value.trim() === '') return null
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date' })
      return z.NEVER
    }
    return date.toISOString()
  })

const salary = z.number().int().min(0).max(10_000_000).nullable().optional()

function checkSalaryRange(
  value: { salaryMin?: number | null; salaryMax?: number | null },
  ctx: z.RefinementCtx,
) {
  if (value.salaryMin != null && value.salaryMax != null && value.salaryMax < value.salaryMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['salaryMax'],
      message: 'Maximum salary must be at least the minimum',
    })
  }
}

const applicationFields = z.object({
  company: z.string().trim().min(1, 'Enter a company').max(120),
  role: z.string().trim().min(1, 'Enter a role').max(120),
  status: z.enum(APPLICATION_STATUSES).optional(),
  salaryMin: salary,
  salaryMax: salary,
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code')
    .transform((value) => value.toUpperCase())
    .optional(),
  jobUrl: optionalUrl.optional(),
  location: z.string().trim().max(160).optional(),
  source: z.string().trim().max(80).optional(),
  notes: z.string().max(20_000).optional(),
  jobDescription: z.string().max(50_000).optional(),
  appliedAt: optionalTimestamp,
  deadlineAt: optionalTimestamp,
  interviewAt: optionalTimestamp,
})

export const applicationWriteSchema = applicationFields.superRefine(checkSalaryRange)
export const applicationCreateSchema = applicationWriteSchema
export const applicationPatchSchema = applicationFields.partial().superRefine(checkSalaryRange)

export const reorderSchema = z.object({
  columns: z
    .array(
      z.object({
        status: z.enum(APPLICATION_STATUSES),
        ids: z.array(z.string().min(1)).max(500),
      }),
    )
    .min(1)
    .max(5),
})

export const listApplicationsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
})

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  role: z.string().trim().max(120).optional(),
  email: z.union([emailSchema, z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().max(4000).optional(),
})

export const noteSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(160).optional(),
  body: z.string().trim().min(1, 'Enter a note').max(8000),
})

export const parseLinkSchema = z.object({
  input: z.string().trim().min(1, 'Paste a link or a role').max(2000),
  fetchPage: z.boolean().optional(),
})

export const importCsvSchema = z.object({
  csv: z.string().min(1, 'Paste or upload a CSV').max(2_000_000),
})

export const resumeWriteSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(120),
  content: z.string().trim().min(1, 'Paste the resume text').max(100_000),
  isDefault: z.boolean().optional(),
})

export const resumePatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(100_000).optional(),
  isDefault: z.boolean().optional(),
})

export const tailorSchema = z.object({
  resumeId: z.string().min(1),
  applicationId: z.string().min(1).nullable().optional(),
  jobDescription: z.string().trim().min(20, 'Paste a job description').max(50_000),
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
})

export const coverLetterSchema = z.object({
  applicationId: z.string().min(1).nullable().optional(),
  resumeId: z.string().min(1).nullable().optional(),
  tone: z.enum(COVER_TONES),
  jobDescription: z.string().trim().min(20, 'Paste a job description').max(50_000),
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
})

export const interviewPrepSchema = z.object({
  applicationId: z.string().min(1).nullable().optional(),
  role: z.string().trim().min(1, 'Enter a role').max(120),
  company: z.string().trim().max(120).optional(),
  jobDescription: z.string().max(50_000).optional(),
})

export const practiceAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().min(1, 'Write an answer').max(8000),
})

const timestampSchema = z.string().trim().min(1, 'Choose a date and time').transform((value, ctx) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date' })
    return z.NEVER
  }
  return date.toISOString()
})

export const reminderWriteSchema = z.object({
  applicationId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1, 'Enter a title').max(160),
  body: z.string().max(8000).optional(),
  dueAt: timestampSchema,
  type: z.enum(REMINDER_TYPES),
})

export const reminderPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().max(8000).optional(),
  dueAt: timestampSchema.optional(),
  type: z.enum(REMINDER_TYPES).optional(),
  status: z.enum(REMINDER_STATUSES).optional(),
  applicationId: z.string().min(1).nullable().optional(),
})

export const calendarQuerySchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    const from = new Date(value.from)
    const to = new Date(value.to)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date range' })
      return
    }
    if (to < from) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The end date is before the start date' })
    }
    if (to.getTime() - from.getTime() > 370 * 24 * 60 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a range of a year or less' })
    }
  })

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  headline: z.string().trim().max(160),
  location: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
})

export const settingsSchema = z.object({
  theme: z.enum(THEMES),
  timezone: z.string().trim().min(1).max(80),
  emailReminders: z.boolean(),
})

export const tailorResultSchema = z.object({
  resume: z.string().min(1),
  matchScore: z.number().min(0).max(100),
  missingKeywords: z.array(z.string()).max(40),
})

export const coverLetterResultSchema = z.object({
  content: z.string().min(1),
})

export const interviewQuestionsResultSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        category: z.string().min(1).max(40),
        tips: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(12),
})

export const feedbackResultSchema = z.object({
  score: z.number().min(1).max(10),
  feedback: z.string().min(1),
})

export const followUpResultSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ApplicationWrite = z.infer<typeof applicationWriteSchema>
export type TailorInput = z.infer<typeof tailorSchema>
