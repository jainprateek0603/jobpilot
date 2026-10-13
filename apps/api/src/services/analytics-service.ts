import { buildAnalytics, isApplicationStatus } from '@jobpilot/shared'
import { prisma } from '../lib/prisma.js'

export async function analyticsForUser(userId: string, now = new Date()) {
  const applications = await prisma.application.findMany({
    where: { userId },
    select: { id: true, status: true, createdAt: true, appliedAt: true },
  })
  const events = await prisma.timelineEvent.findMany({
    where: { type: 'status_change', application: { userId } },
    select: { applicationId: true, body: true },
  })
  return buildAnalytics(
    applications.map((application) => ({
      id: application.id,
      status: application.status,
      createdAt: application.createdAt.toISOString(),
      appliedAt: application.appliedAt?.toISOString() ?? null,
    })),
    events
      .filter((event) => isApplicationStatus(event.body))
      .map((event) => ({ applicationId: event.applicationId, status: event.body })),
    now,
  )
}

export async function calendarForUser(userId: string, from: Date, to: Date) {
  const [applications, reminders] = await Promise.all([
    prisma.application.findMany({
      where: {
        userId,
        OR: [
          { interviewAt: { gte: from, lte: to } },
          { deadlineAt: { gte: from, lte: to } },
        ],
      },
      select: { id: true, company: true, role: true, interviewAt: true, deadlineAt: true, status: true },
    }),
    prisma.reminder.findMany({
      where: { userId, dueAt: { gte: from, lte: to } },
      select: { id: true, title: true, dueAt: true, type: true, status: true, applicationId: true },
    }),
  ])
  return {
    interviews: applications
      .filter((item) => item.interviewAt && item.interviewAt >= from && item.interviewAt <= to)
      .map((item) => ({
        id: item.id,
        company: item.company,
        role: item.role,
        status: item.status,
        at: item.interviewAt?.toISOString() ?? '',
      })),
    deadlines: applications
      .filter((item) => item.deadlineAt && item.deadlineAt >= from && item.deadlineAt <= to)
      .map((item) => ({
        id: item.id,
        company: item.company,
        role: item.role,
        status: item.status,
        at: item.deadlineAt?.toISOString() ?? '',
      })),
    reminders: reminders.map((item) => ({
      id: item.id,
      title: item.title,
      dueAt: item.dueAt.toISOString(),
      type: item.type,
      status: item.status,
      applicationId: item.applicationId,
    })),
  }
}
