import {
  coverLetterResultSchema,
  coverLetterSchema,
  feedbackResultSchema,
  followUpResultSchema,
  interviewPrepSchema,
  interviewQuestionsResultSchema,
  practiceAnswerSchema,
  tailorResultSchema,
  tailorSchema,
} from '@jobpilot/shared'
import type { z } from 'zod'
import { ZodError } from 'zod'
import { createProvider } from '../ai/index.js'
import { parseModelJson, prepareFeedbackPayload, prepareTailorPayload } from '../ai/json.js'
import { loadPrompt, renderPrompt } from '../ai/prompts.js'
import type { Config } from '../config.js'
import { AppError, zodFields } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { ownedPrep, ownedQuestion, ownedResume, requireLinkedApplication } from './access.js'

const system = 'You return one JSON object and no other text.'

async function completeJson(config: Config, promptName: Parameters<typeof loadPrompt>[0], vars: Record<string, string>) {
  const prompt = loadPrompt(promptName)
  const provider = createProvider(config)
  const raw = await provider.complete({
    system,
    user: renderPrompt(prompt.text, vars),
    temperature: 0.3,
  })
  return { raw, provider: provider.name, version: prompt.version }
}

function parseWith<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(502, 'AI_OUTPUT', 'The model did not return the expected JSON', zodFields(error))
    }
    throw error
  }
}

export async function tailorResume(userId: string, input: z.infer<typeof tailorSchema>, config: Config) {
  const resume = await ownedResume(userId, input.resumeId)
  const application = await requireLinkedApplication(userId, input.applicationId)
  const company = input.company || application?.company || ''
  const role = input.role || application?.role || ''
  const { raw, provider, version } = await completeJson(config, 'tailor-resume', {
    resume: resume.content,
    jobDescription: input.jobDescription,
    company,
    role,
  })
  const parsed = parseWith(tailorResultSchema, prepareTailorPayload(parseModelJson(raw)))
  const saved = await prisma.tailoredResume.create({
    data: {
      userId,
      resumeId: resume.id,
      applicationId: application?.id,
      jobDescription: input.jobDescription,
      content: parsed.resume,
      matchScore: parsed.matchScore,
      missingKeywords: JSON.stringify(parsed.missingKeywords),
      provider,
      promptVersion: version,
    },
  })
  if (application) {
    await prisma.timelineEvent.create({
      data: {
        applicationId: application.id,
        type: 'tailor',
        title: 'Tailored a resume',
        body: `Match score ${parsed.matchScore}`,
      },
    })
  }
  return presentTailored(saved)
}

export async function listTailored(userId: string) {
  const rows = await prisma.tailoredResume.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  return rows.map(presentTailored)
}

export async function getTailored(userId: string, id: string) {
  const row = await prisma.tailoredResume.findFirst({ where: { id, userId } })
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Tailored resume not found')
  return presentTailored(row)
}

function presentTailored(row: {
  id: string
  resumeId: string | null
  applicationId: string | null
  jobDescription: string
  content: string
  matchScore: number
  missingKeywords: string
  provider: string
  promptVersion: string
  createdAt: Date
}) {
  let missingKeywords: string[] = []
  try {
    const parsed = JSON.parse(row.missingKeywords) as unknown
    if (Array.isArray(parsed)) missingKeywords = parsed.filter((item) => typeof item === 'string')
  } catch {
    missingKeywords = []
  }
  return {
    id: row.id,
    resumeId: row.resumeId,
    applicationId: row.applicationId,
    jobDescription: row.jobDescription,
    content: row.content,
    matchScore: row.matchScore,
    missingKeywords,
    provider: row.provider,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function writeCoverLetter(userId: string, input: z.infer<typeof coverLetterSchema>, config: Config) {
  const application = await requireLinkedApplication(userId, input.applicationId)
  const resume = input.resumeId ? await ownedResume(userId, input.resumeId) : null
  const company = input.company || application?.company || ''
  const role = input.role || application?.role || ''
  const { raw, provider, version } = await completeJson(config, 'cover-letter', {
    tone: input.tone,
    company,
    role,
    resume: resume?.content ?? '',
    jobDescription: input.jobDescription,
  })
  const parsed = parseWith(coverLetterResultSchema, parseModelJson(raw))
  const saved = await prisma.coverLetter.create({
    data: {
      userId,
      applicationId: application?.id,
      resumeId: resume?.id,
      tone: input.tone,
      content: parsed.content,
      jobDescription: input.jobDescription,
      provider,
      promptVersion: version,
    },
  })
  if (application) {
    await prisma.timelineEvent.create({
      data: { applicationId: application.id, type: 'cover_letter', title: 'Drafted a cover letter', body: input.tone },
    })
  }
  return {
    id: saved.id,
    tone: saved.tone,
    content: saved.content,
    applicationId: saved.applicationId,
    resumeId: saved.resumeId,
    provider: saved.provider,
    promptVersion: saved.promptVersion,
    createdAt: saved.createdAt.toISOString(),
  }
}

export async function listCoverLetters(userId: string) {
  const rows = await prisma.coverLetter.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  return rows.map((row) => ({
    id: row.id,
    tone: row.tone,
    content: row.content,
    applicationId: row.applicationId,
    resumeId: row.resumeId,
    provider: row.provider,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function createInterviewPrep(userId: string, input: z.infer<typeof interviewPrepSchema>, config: Config) {
  const application = await requireLinkedApplication(userId, input.applicationId)
  const { raw, provider, version } = await completeJson(config, 'interview-questions', {
    role: input.role,
    company: input.company || application?.company || '',
    jobDescription: input.jobDescription || application?.jobDescription || '',
  })
  const parsed = parseWith(interviewQuestionsResultSchema, parseModelJson(raw))
  const prep = await prisma.interviewPrep.create({
    data: {
      userId,
      applicationId: application?.id,
      role: input.role,
      company: input.company || application?.company || '',
      jobDescription: input.jobDescription || '',
      provider,
      promptVersion: version,
      questions: {
        create: parsed.questions.map((question, index) => ({
          question: question.question,
          category: question.category,
          tips: question.tips ?? '',
          order: index,
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' }, include: { answers: true } } },
  })
  if (application) {
    await prisma.timelineEvent.create({
      data: { applicationId: application.id, type: 'interview_prep', title: 'Prepared interview questions', body: input.role },
    })
  }
  return presentPrep(prep)
}

export async function listInterviewPreps(userId: string) {
  const rows = await prisma.interviewPrep.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { questions: { orderBy: { order: 'asc' }, include: { answers: { orderBy: { createdAt: 'asc' } } } } },
  })
  return rows.map(presentPrep)
}

export async function getInterviewPrep(userId: string, id: string) {
  return presentPrep(await ownedPrep(userId, id))
}

export async function scoreAnswer(userId: string, prepId: string, input: z.infer<typeof practiceAnswerSchema>, config: Config) {
  const prep = await ownedPrep(userId, prepId)
  const question = prep.questions.find((item) => item.id === input.questionId) ?? (await ownedQuestion(userId, input.questionId))
  if (question.prepId !== prep.id) throw new AppError(404, 'NOT_FOUND', 'Question not found')
  const { raw, provider } = await completeJson(config, 'answer-feedback', {
    question: question.question,
    tips: question.tips,
    answer: input.answer,
  })
  const parsed = parseWith(feedbackResultSchema, prepareFeedbackPayload(parseModelJson(raw)))
  const saved = await prisma.practiceAnswer.create({
    data: {
      questionId: question.id,
      answer: input.answer,
      feedback: parsed.feedback,
      score: parsed.score,
      provider,
    },
  })
  return {
    id: saved.id,
    questionId: saved.questionId,
    answer: saved.answer,
    feedback: saved.feedback,
    score: saved.score,
    provider: saved.provider,
    createdAt: saved.createdAt.toISOString(),
  }
}

export async function draftFollowUp(config: Config, input: { candidate: string; company: string; role: string; note: string }) {
  const { raw } = await completeJson(config, 'follow-up-email', input)
  return parseWith(followUpResultSchema, parseModelJson(raw))
}

function presentPrep(prep: {
  id: string
  applicationId: string | null
  role: string
  company: string
  provider: string
  promptVersion: string
  createdAt: Date
  questions: {
    id: string
    question: string
    category: string
    tips: string
    order: number
    answers: { id: string; answer: string; feedback: string; score: number; createdAt: Date }[]
  }[]
}) {
  return {
    id: prep.id,
    applicationId: prep.applicationId,
    role: prep.role,
    company: prep.company,
    provider: prep.provider,
    promptVersion: prep.promptVersion,
    createdAt: prep.createdAt.toISOString(),
    questions: prep.questions.map((question) => ({
      id: question.id,
      question: question.question,
      category: question.category,
      tips: question.tips,
      order: question.order,
      answers: question.answers.map((answer) => ({
        id: answer.id,
        answer: answer.answer,
        feedback: answer.feedback,
        score: answer.score,
        createdAt: answer.createdAt.toISOString(),
      })),
    })),
  }
}
