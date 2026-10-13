import {
  STATUS_LABELS,
  applicationsToCsv,
  csvToApplications,
  isApplicationStatus,
  parseJobLink,
  type ApplicationStatus,
} from '@jobpilot/shared'
import type { z } from 'zod'
import { applicationPatchSchema, contactSchema, noteSchema, reorderSchema } from '@jobpilot/shared'
import type { Application, Contact, Reminder, TimelineEvent } from '@prisma/client'
import { AppError } from '../lib/errors.js'
import { extractListing } from '../lib/html-job.js'
import { prisma } from '../lib/prisma.js'
import { fetchPublicHtml, type LookupFn } from '../lib/ssrf.js'
import { ownedApplication, ownedContact, requireLinkedApplication } from './access.js'

type ApplicationPatch = z.infer<typeof applicationPatchSchema>
type ReorderInput = z.infer<typeof reorderSchema>
type ContactInput = z.infer<typeof contactSchema>
type NoteInput = z.infer<typeof noteSchema>

const detailInclude = {
  contacts: { orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { occurredAt: 'desc' as const } },
  reminders: { orderBy: { dueAt: 'asc' as const } },
}

export function presentApplication(
  application: Application & { contacts?: Contact[]; events?: TimelineEvent[]; reminders?: Reminder[] },
  options: { includeDescription?: boolean } = {},
) {
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    status: application.status,
    position: application.position,
    salaryMin: application.salaryMin,
    salaryMax: application.salaryMax,
    currency: application.currency,
    jobUrl: application.jobUrl,
    location: application.location,
    source: application.source,
    notes: application.notes,
    ...(options.includeDescription ? { jobDescription: application.jobDescription } : { hasJobDescription: application.jobDescription.length > 0 }),
    appliedAt: application.appliedAt?.toISOString() ?? null,
    deadlineAt: application.deadlineAt?.toISOString() ?? null,
    interviewAt: application.interviewAt?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    contacts: application.contacts?.map(presentContact),
    events: application.events?.map(presentEvent),
    reminders: application.reminders?.map(presentReminder),
  }
}

function presentContact(contact: Contact) {
  return {
    id: contact.id,
    name: contact.name,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    notes: contact.notes,
    createdAt: contact.createdAt.toISOString(),
  }
}

function presentEvent(event: TimelineEvent) {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    body: event.body,
    occurredAt: event.occurredAt.toISOString(),
  }
}

function presentReminder(reminder: Reminder) {
  return {
    id: reminder.id,
    title: reminder.title,
    body: reminder.body,
    dueAt: reminder.dueAt.toISOString(),
    type: reminder.type,
    status: reminder.status,
    emailSubject: reminder.emailSubject,
    emailBody: reminder.emailBody,
    sentAt: reminder.sentAt?.toISOString() ?? null,
    applicationId: reminder.applicationId,
  }
}

async function nextPosition(userId: string, status: string) {
  const aggregate = await prisma.application.aggregate({
    where: { userId, status },
    _max: { position: true },
  })
  return (aggregate._max.position ?? -1) + 1
}

function asDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

export async function createApplication(
  userId: string,
  input: {
    company: string
    role: string
    status?: ApplicationStatus
    salaryMin?: number | null
    salaryMax?: number | null
    currency?: string
    jobUrl?: string
    location?: string
    source?: string
    notes?: string
    jobDescription?: string
    appliedAt?: string | null
    deadlineAt?: string | null
    interviewAt?: string | null
  },
) {
  const status = input.status ?? 'WISHLIST'
  const position = await nextPosition(userId, status)
  const created = await prisma.application.create({
    data: {
      userId,
      company: input.company,
      role: input.role,
      status,
      position,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      currency: input.currency ?? 'USD',
      jobUrl: input.jobUrl ?? '',
      location: input.location ?? '',
      source: input.source ?? '',
      notes: input.notes ?? '',
      jobDescription: input.jobDescription ?? '',
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : status === 'WISHLIST' ? null : new Date(),
      deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
      interviewAt: input.interviewAt ? new Date(input.interviewAt) : null,
      events: {
        create: [
          { type: 'created', title: 'Added to the board', body: status },
          ...(status === 'WISHLIST'
            ? []
            : [{ type: 'status_change', title: `Moved to ${STATUS_LABELS[status]}`, body: status }]),
        ],
      },
    },
  })
  return created
}

export async function listApplications(
  userId: string,
  query: { q?: string; status?: ApplicationStatus; page?: number; pageSize?: number },
) {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 100
  const rows = await prisma.application.findMany({
    where: { userId, ...(query.status ? { status: query.status } : {}) },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
  const needle = query.q?.trim().toLowerCase()
  const filtered = needle
    ? rows.filter((row) =>
        [row.company, row.role, row.location, row.notes, row.source].some((value) => value.toLowerCase().includes(needle)),
      )
    : rows
  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize).map((row) => presentApplication(row)),
    meta: { page, pageSize, total: filtered.length },
  }
}

export async function getApplication(userId: string, id: string) {
  const application = await prisma.application.findFirst({
    where: { id, userId },
    include: detailInclude,
  })
  if (!application) throw new AppError(404, 'NOT_FOUND', 'Application not found')
  return presentApplication(application, { includeDescription: true })
}

export async function updateApplication(userId: string, id: string, input: ApplicationPatch) {
  if (Object.keys(input).length === 0) throw new AppError(400, 'VALIDATION', 'Provide a field to update')
  const existing = await ownedApplication(userId, id)
  const status = input.status
  const data = {
    ...(input.company !== undefined ? { company: input.company } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.salaryMin !== undefined ? { salaryMin: input.salaryMin } : {}),
    ...(input.salaryMax !== undefined ? { salaryMax: input.salaryMax } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.jobUrl !== undefined ? { jobUrl: input.jobUrl } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.jobDescription !== undefined ? { jobDescription: input.jobDescription } : {}),
    ...(input.appliedAt !== undefined ? { appliedAt: asDate(input.appliedAt) } : {}),
    ...(input.deadlineAt !== undefined ? { deadlineAt: asDate(input.deadlineAt) } : {}),
    ...(input.interviewAt !== undefined ? { interviewAt: asDate(input.interviewAt) } : {}),
  }
  if (status && status !== existing.status) {
    Object.assign(data, {
      status,
      position: await nextPosition(userId, status),
      ...(status !== 'WISHLIST' && !existing.appliedAt && input.appliedAt === undefined ? { appliedAt: new Date() } : {}),
    })
  }
  const updated = await prisma.application.update({ where: { id: existing.id }, data })
  if (status && status !== existing.status && isApplicationStatus(status)) {
    await prisma.timelineEvent.create({
      data: {
        applicationId: existing.id,
        type: 'status_change',
        title: `Moved to ${STATUS_LABELS[status]}`,
        body: status,
      },
    })
  }
  return presentApplication(updated, { includeDescription: true })
}

export async function deleteApplication(userId: string, id: string) {
  const existing = await ownedApplication(userId, id)
  await prisma.application.delete({ where: { id: existing.id } })
}

export async function reorderApplications(userId: string, input: ReorderInput) {
  const ids = input.columns.flatMap((column) => column.ids)
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'VALIDATION', 'An application cannot appear twice')
  const existing = await prisma.application.findMany({ where: { userId, id: { in: ids } } })
  if (existing.length !== ids.length) throw new AppError(404, 'NOT_FOUND', 'Application not found')
  const byId = new Map(existing.map((item) => [item.id, item]))
  await prisma.$transaction(async (tx) => {
    for (const column of input.columns) {
      for (let index = 0; index < column.ids.length; index += 1) {
        const id = column.ids[index]
        const previous = id ? byId.get(id) : undefined
        if (!id || !previous) continue
        await tx.application.update({
          where: { id },
          data: {
            status: column.status,
            position: index,
            appliedAt: column.status !== 'WISHLIST' && !previous.appliedAt ? new Date() : previous.appliedAt,
          },
        })
        if (previous.status !== column.status) {
          await tx.timelineEvent.create({
            data: {
              applicationId: id,
              type: 'status_change',
              title: `Moved to ${STATUS_LABELS[column.status]}`,
              body: column.status,
            },
          })
        }
      }
    }
  })
}

export async function addContact(userId: string, applicationId: string, input: ContactInput) {
  const application = await ownedApplication(userId, applicationId)
  const contact = await prisma.contact.create({
    data: {
      applicationId: application.id,
      name: input.name,
      role: input.role ?? '',
      email: input.email ?? '',
      phone: input.phone ?? '',
      notes: input.notes ?? '',
    },
  })
  await prisma.timelineEvent.create({
    data: { applicationId: application.id, type: 'contact', title: 'Contact added', body: contact.name },
  })
  return presentContact(contact)
}

export async function updateContact(userId: string, id: string, input: Partial<ContactInput>) {
  if (Object.keys(input).length === 0) throw new AppError(400, 'VALIDATION', 'Provide a field to update')
  const existing = await ownedContact(userId, id)
  const contact = await prisma.contact.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  })
  return presentContact(contact)
}

export async function deleteContact(userId: string, id: string) {
  const existing = await ownedContact(userId, id)
  await prisma.contact.delete({ where: { id: existing.id } })
  await prisma.timelineEvent.create({
    data: { applicationId: existing.applicationId, type: 'contact', title: 'Contact removed', body: existing.name },
  })
}

export async function addNote(userId: string, applicationId: string, input: NoteInput) {
  const application = await ownedApplication(userId, applicationId)
  const event = await prisma.timelineEvent.create({
    data: {
      applicationId: application.id,
      type: 'note',
      title: input.title?.trim() || 'Note',
      body: input.body,
    },
  })
  return presentEvent(event)
}

export async function exportApplications(userId: string) {
  const rows = await prisma.application.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  return applicationsToCsv(
    rows.map((row) => ({
      company: row.company,
      role: row.role,
      status: row.status,
      salaryMin: row.salaryMin == null ? '' : String(row.salaryMin),
      salaryMax: row.salaryMax == null ? '' : String(row.salaryMax),
      currency: row.currency,
      jobUrl: row.jobUrl,
      location: row.location,
      source: row.source,
      notes: row.notes,
      appliedAt: row.appliedAt?.toISOString() ?? '',
      deadlineAt: row.deadlineAt?.toISOString() ?? '',
      interviewAt: row.interviewAt?.toISOString() ?? '',
    })),
  )
}

export async function importApplications(userId: string, csv: string) {
  const parsed = csvToApplications(csv)
  if (parsed.rows.length === 0) {
    throw new AppError(400, 'VALIDATION', parsed.errors[0]?.message ?? 'No applications to import', {
      form: parsed.errors.map((error) => `Line ${error.line}: ${error.message}`),
    })
  }
  const created = []
  for (const row of parsed.rows) {
    created.push(
      await createApplication(userId, {
        company: row.company,
        role: row.role,
        status: row.status,
        salaryMin: row.salaryMin,
        salaryMax: row.salaryMax,
        currency: row.currency,
        jobUrl: row.jobUrl,
        location: row.location,
        source: row.source,
        notes: row.notes,
        appliedAt: row.appliedAt,
        deadlineAt: row.deadlineAt,
        interviewAt: row.interviewAt,
      }),
    )
  }
  return {
    imported: created.length,
    errors: parsed.errors,
    applications: created.map((row) => presentApplication(row)),
  }
}

export async function enrichJobLink(
  input: string,
  fetchPage = false,
  deps: { fetchFn?: typeof fetch; lookupFn?: LookupFn } = {},
) {
  const parsed = parseJobLink(input)
  if (!fetchPage || parsed.confidence !== 'url' || (parsed.company && parsed.role)) {
    return { ...parsed, warning: '' }
  }
  try {
    const html = await fetchPublicHtml(parsed.jobUrl, deps)
    const found = extractListing(html)
    return {
      ...parsed,
      company: parsed.company || found.company,
      role: parsed.role || found.role,
      warning: '',
    }
  } catch (error) {
    const warning = error instanceof AppError ? error.message : 'That link could not be read'
    return { ...parsed, warning }
  }
}

export async function rememberApplicationLink(userId: string, applicationId: string | null | undefined) {
  return requireLinkedApplication(userId, applicationId)
}
