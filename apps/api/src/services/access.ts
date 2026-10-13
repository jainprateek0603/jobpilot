import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'

export async function ownedApplication(userId: string, id: string) {
  const application = await prisma.application.findFirst({ where: { id, userId } })
  if (!application) throw new AppError(404, 'NOT_FOUND', 'Application not found')
  return application
}

export async function ownedResume(userId: string, id: string) {
  const resume = await prisma.resume.findFirst({ where: { id, userId } })
  if (!resume) throw new AppError(404, 'NOT_FOUND', 'Resume not found')
  return resume
}

export async function ownedReminder(userId: string, id: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } })
  if (!reminder) throw new AppError(404, 'NOT_FOUND', 'Reminder not found')
  return reminder
}

export async function ownedContact(userId: string, id: string) {
  const contact = await prisma.contact.findFirst({ where: { id, application: { userId } } })
  if (!contact) throw new AppError(404, 'NOT_FOUND', 'Contact not found')
  return contact
}

export async function ownedPrep(userId: string, id: string) {
  const prep = await prisma.interviewPrep.findFirst({
    where: { id, userId },
    include: { questions: { orderBy: { order: 'asc' }, include: { answers: { orderBy: { createdAt: 'asc' } } } } },
  })
  if (!prep) throw new AppError(404, 'NOT_FOUND', 'Interview prep not found')
  return prep
}

export async function ownedQuestion(userId: string, id: string) {
  const question = await prisma.interviewQuestion.findFirst({
    where: { id, prep: { userId } },
    include: { prep: true },
  })
  if (!question) throw new AppError(404, 'NOT_FOUND', 'Question not found')
  return question
}

export async function requireLinkedApplication(userId: string, applicationId: string | null | undefined) {
  if (!applicationId) return null
  return ownedApplication(userId, applicationId)
}
