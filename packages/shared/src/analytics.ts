import { isApplicationStatus } from './constants.js'
import type { ApplicationStatus } from './constants.js'

export type AnalyticsApplication = {
  id: string
  status: string
  createdAt: string
  appliedAt: string | null
}

export type AnalyticsStatusEvent = {
  applicationId: string
  status: string
}

export type WeekBucket = { weekStart: string; count: number }

export type FunnelStage = { stage: string; count: number; rateFromStart: number }

export type AnalyticsReport = {
  applicationsPerWeek: WeekBucket[]
  totals: {
    applications: number
    submitted: number
    responses: number
    interviews: number
    offers: number
    rejected: number
    wishlist: number
  }
  responseRate: number
  interviewRate: number
  offerRate: number
  funnel: FunnelStage[]
}

const SUBMITTED = new Set<ApplicationStatus>(['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'])
const RESPONSE = new Set<ApplicationStatus>(['INTERVIEW', 'OFFER', 'REJECTED'])
const INTERVIEW = new Set<ApplicationStatus>(['INTERVIEW', 'OFFER'])

export function startOfUtcWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = start.getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  start.setUTCDate(start.getUTCDate() - offset)
  return start
}

export function recentWeekStarts(now: Date, weeks = 12): string[] {
  const current = startOfUtcWeek(now)
  const result: string[] = []
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const week = new Date(current)
    week.setUTCDate(current.getUTCDate() - index * 7)
    result.push(week.toISOString().slice(0, 10))
  }
  return result
}

function rate(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 10000) / 10000
}

function reachedStatuses(app: AnalyticsApplication, events: AnalyticsStatusEvent[]): Set<ApplicationStatus> {
  const reached = new Set<ApplicationStatus>()
  if (isApplicationStatus(app.status)) reached.add(app.status)
  for (const event of events) {
    if (event.applicationId === app.id && isApplicationStatus(event.status)) reached.add(event.status)
  }
  return reached
}

function isSubmitted(app: AnalyticsApplication, reached: Set<ApplicationStatus>): boolean {
  if (app.appliedAt) return true
  if (isApplicationStatus(app.status) && SUBMITTED.has(app.status)) return true
  for (const status of reached) {
    if (SUBMITTED.has(status)) return true
  }
  return false
}

export function buildAnalytics(
  applications: AnalyticsApplication[],
  events: AnalyticsStatusEvent[],
  now: Date = new Date(),
): AnalyticsReport {
  const weeks = recentWeekStarts(now)
  const counts = new Map(weeks.map((week) => [week, 0]))
  let submitted = 0
  let responses = 0
  let interviews = 0
  let offers = 0
  let rejected = 0
  let wishlist = 0

  for (const app of applications) {
    const created = new Date(app.createdAt)
    if (!Number.isNaN(created.getTime())) {
      const key = startOfUtcWeek(created).toISOString().slice(0, 10)
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const reached = reachedStatuses(app, events)
    if (app.status === 'WISHLIST') wishlist += 1
    if (app.status === 'REJECTED') rejected += 1
    if (!isSubmitted(app, reached)) continue
    submitted += 1
    if ([...reached].some((status) => RESPONSE.has(status))) responses += 1
    if ([...reached].some((status) => INTERVIEW.has(status))) interviews += 1
    if (reached.has('OFFER')) offers += 1
  }

  const total = applications.length
  const funnelSource = [
    ['Saved', total],
    ['Applied', submitted],
    ['Interview', interviews],
    ['Offer', offers],
  ] as const

  return {
    applicationsPerWeek: weeks.map((weekStart) => ({ weekStart, count: counts.get(weekStart) ?? 0 })),
    totals: {
      applications: total,
      submitted,
      responses,
      interviews,
      offers,
      rejected,
      wishlist,
    },
    responseRate: rate(responses, submitted),
    interviewRate: rate(interviews, submitted),
    offerRate: rate(offers, submitted),
    funnel: funnelSource.map(([stage, count]) => ({
      stage,
      count,
      rateFromStart: rate(count, total),
    })),
  }
}
