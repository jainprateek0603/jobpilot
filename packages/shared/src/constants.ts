export const APPLICATION_STATUSES = ['WISHLIST', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  WISHLIST: 'Wishlist',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
}

export const COVER_TONES = ['professional', 'confident', 'warm', 'concise'] as const

export type CoverTone = (typeof COVER_TONES)[number]

export const TONE_LABELS: Record<CoverTone, string> = {
  professional: 'Professional',
  confident: 'Confident',
  warm: 'Warm',
  concise: 'Concise',
}

export const REMINDER_TYPES = ['follow_up', 'interview', 'deadline', 'custom'] as const

export type ReminderType = (typeof REMINDER_TYPES)[number]

export const REMINDER_STATUSES = ['pending', 'sent', 'dismissed', 'completed'] as const

export type ReminderStatus = (typeof REMINDER_STATUSES)[number]

export const THEMES = ['light', 'dark', 'system'] as const

export type ThemeSetting = (typeof THEMES)[number]

export const CSV_COLUMNS = [
  'company',
  'role',
  'status',
  'salaryMin',
  'salaryMax',
  'currency',
  'jobUrl',
  'location',
  'source',
  'notes',
  'appliedAt',
  'deadlineAt',
  'interviewAt',
] as const

export type CsvColumn = (typeof CSV_COLUMNS)[number]

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value)
}
