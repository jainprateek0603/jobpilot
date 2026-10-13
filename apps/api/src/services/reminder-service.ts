import type { z } from 'zod'
import { reminderPatchSchema, reminderWriteSchema } from '@jobpilot/shared'
import type { Config } from '../config.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { ownedReminder, requireLinkedApplication } from './access.js'
import { draftFollowUp } from './ai-service.js'
import { sendUserEmail } from './mailer.js'

type ReminderWrite = z.infer<typeof reminderWriteSchema>
type ReminderPatch = z.infer<typeof reminderPatchSchema>

function present(reminder: {
  id: string
  applicationId: string | null
  title: string
  body: string
  dueAt: Date
  type: string
  status: string
  emailSubject: string
  emailBody: string
  sentAt: Date | null
  createdAt: Date
}) {
  return {
    id: reminder.id,
    applicationId: reminder.applicationId,
    title: reminder.title,
    body: reminder.body,
    dueAt: reminder.dueAt.toISOString(),
    type: reminder.type,
    status: reminder.status,
    emailSubject: reminder.emailSubject,
    emailBody: reminder.emailBody,
    sentAt: reminder.sentAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
  }
}

export async function listReminders(userId: string) {
  const rows = await prisma.reminder.findMany({ where: { userId }, orderBy: { dueAt: 'asc' } })
  return rows.map(present)
}

export async function createReminder(userId: string, input: ReminderWrite) {
  const application = await requireLinkedApplication(userId, input.applicationId)
  const reminder = await prisma.reminder.create({
    data: {
      userId,
      applicationId: application?.id,
      title: input.title,
      body: input.body ?? '',
      dueAt: new Date(input.dueAt),
      type: input.type,
    },
  })
  if (application) {
    await prisma.timelineEvent.create({
      data: { applicationId: application.id, type: 'reminder', title: 'Reminder added', body: input.title },
    })
  }
  return present(reminder)
}

export async function updateReminder(userId: string, id: string, input: ReminderPatch) {
  if (Object.keys(input).length === 0) throw new AppError(400, 'VALIDATION', 'Provide a field to update')
  if (input.status === 'sent') throw new AppError(400, 'VALIDATION', 'That status is set when the reminder is processed')
  const existing = await ownedReminder(userId, id)
  const application = input.applicationId === undefined ? undefined : await requireLinkedApplication(userId, input.applicationId)
  const reminder = await prisma.reminder.update({
    where: { id: existing.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.dueAt !== undefined ? { dueAt: new Date(input.dueAt) } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(application !== undefined ? { applicationId: application?.id ?? null } : {}),
    },
  })
  return present(reminder)
}

export async function deleteReminder(userId: string, id: string) {
  const existing = await ownedReminder(userId, id)
  await prisma.reminder.delete({ where: { id: existing.id } })
}

export async function processDueReminders(config: Config, options: { userId?: string; now?: Date } = {}) {
  const now = options.now ?? new Date()
  const due = await prisma.reminder.findMany({
    where: {
      status: 'pending',
      dueAt: { lte: now },
      ...(options.userId ? { userId: options.userId } : {}),
    },
    include: { user: true, application: true },
  })
  for (const reminder of due) {
    let subject = reminder.emailSubject
    let body = reminder.emailBody
    if (reminder.type === 'follow_up' && !body) {
      const draft = await draftFollowUp(config, {
        candidate: reminder.user.name,
        company: reminder.application?.company ?? '',
        role: reminder.application?.role ?? reminder.title,
        note: reminder.body,
      })
      subject = draft.subject
      body = draft.body
    }
    if (!subject) subject = `Reminder: ${reminder.title}`
    if (!body) body = reminder.body || reminder.title
    if (reminder.user.emailReminders) {
      await sendUserEmail(config, {
        userId: reminder.userId,
        reminderId: reminder.id,
        to: reminder.user.email,
        subject,
        body,
      })
    } else {
      await prisma.emailOutbox.create({
        data: {
          userId: reminder.userId,
          reminderId: reminder.id,
          toAddress: reminder.user.email,
          subject,
          body,
          status: 'skipped_preference',
        },
      })
    }
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'sent', emailSubject: subject, emailBody: body, sentAt: now },
    })
    if (reminder.applicationId) {
      await prisma.timelineEvent.create({
        data: { applicationId: reminder.applicationId, type: 'reminder', title: 'Reminder sent', body: subject },
      })
    }
  }
  return due.length
}
