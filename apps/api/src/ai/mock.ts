import { AppError } from '../lib/errors.js'
import { between, labeled, significantWords } from './keywords.js'
import type { AICompleteInput, AIProvider } from './types.js'

export class MockProvider implements AIProvider {
  readonly name = 'mock'

  async complete(input: AICompleteInput): Promise<string> {
    const source = `${input.system}\n${input.user}`
    if (source.includes('jobpilot:tailor-resume')) return JSON.stringify(tailor(source))
    if (source.includes('jobpilot:cover-letter')) return JSON.stringify(cover(source))
    if (source.includes('jobpilot:interview-questions')) return JSON.stringify(questions(source))
    if (source.includes('jobpilot:answer-feedback')) return JSON.stringify(feedback(source))
    if (source.includes('jobpilot:follow-up-email')) return JSON.stringify(followUp(source))
    throw new AppError(502, 'AI_OUTPUT', 'The model did not return JSON')
  }
}

function tailor(source: string) {
  const resume = between(source, 'RESUME_START', 'RESUME_END')
  const job = between(source, 'JOB_START', 'JOB_END')
  const resumeWords = new Set(significantWords(resume))
  const jobWords = significantWords(job).slice(0, 24)
  const missing = jobWords.filter((word) => !resumeWords.has(word)).slice(0, 12)
  const present = jobWords.filter((word) => resumeWords.has(word))
  const score = jobWords.length === 0 ? 0 : Math.round((present.length / jobWords.length) * 100)
  const company = labeled(source, 'COMPANY')
  const role = labeled(source, 'ROLE')
  const heading = [role, company].filter(Boolean).join(' at ')
  const text = [
    resume,
    '',
    heading ? `Tailored emphasis for ${heading}` : 'Tailored emphasis',
    present.length
      ? `This draft brings forward ${present.slice(0, 8).join(', ')}.`
      : 'This draft keeps the original experience in the same order.',
    missing.length
      ? `Terms from the posting that are still absent: ${missing.join(', ')}.`
      : 'The posting language is already covered.',
  ].join('\n')
  return { resume: text.trim(), matchScore: score, missingKeywords: missing }
}

function cover(source: string) {
  const tone = labeled(source, 'TONE') || 'professional'
  const company = labeled(source, 'COMPANY') || 'the team'
  const role = labeled(source, 'ROLE') || 'the open role'
  const resume = between(source, 'RESUME_START', 'RESUME_END')
  const focus = significantWords(resume).slice(0, 4).join(', ')
  const opening: Record<string, string> = {
    professional: `I am writing to apply for the ${role} role at ${company}.`,
    confident: `I can take on the ${role} role at ${company} and contribute in the first month.`,
    warm: `I would like to help ${company} as ${role}.`,
    concise: `${role} at ${company}.`,
  }
  const content = [
    opening[tone] ?? opening.professional,
    '',
    focus
      ? `My recent work centers on ${focus}. I would use that background on the problems in this posting.`
      : 'I would bring the experience in my resume to the problems in this posting.',
    '',
    'Thank you for reading.',
  ].join('\n')
  return { content }
}

function questions(source: string) {
  const role = labeled(source, 'ROLE') || 'this role'
  const company = labeled(source, 'COMPANY') || 'the team'
  const topics = significantWords(between(source, 'JOB_START', 'JOB_END')).slice(0, 3)
  const topic = topics[0] ?? 'the work'
  return {
    questions: [
      {
        category: 'role',
        question: `Why do you want the ${role} role at ${company}?`,
        tips: 'Connect one recent project to the posting.',
      },
      {
        category: 'behavioral',
        question: `Tell me about a time you handled a disagreement on a ${role} team.`,
        tips: 'Use a situation, the action you took, and the result.',
      },
      {
        category: 'technical',
        question: `How have you used ${topic} in production?`,
        tips: 'Name the constraint, your choice, and what changed.',
      },
      {
        category: 'behavioral',
        question: 'Describe a project that slipped and how you recovered.',
        tips: 'Be specific about the tradeoff you made.',
      },
      {
        category: 'role',
        question: `What would you do in your first 30 days as ${role}?`,
        tips: 'Show how you would learn the system before changing it.',
      },
    ],
  }
}

function feedback(source: string) {
  const answer = between(source, 'ANSWER_START', 'ANSWER_END')
  const question = labeled(source, 'QUESTION')
  const overlap = significantWords(question).filter((word) => answer.toLowerCase().includes(word)).length
  let score = 4
  if (answer.length > 80) score += 1
  if (answer.length > 240) score += 1
  if (overlap >= 1) score += 1
  if (overlap >= 3) score += 2
  if (/\b(I|we)\b/.test(answer)) score += 1
  if (answer.length < 40) score = Math.min(score, 3)
  score = Math.max(1, Math.min(10, score))
  const feedbackText =
    score >= 7
      ? 'The answer is specific and tracks the question. Add one measured result if you have it.'
      : 'Name a situation, the action you took, and the result. Use the language of the question.'
  return { score, feedback: feedbackText }
}

function followUp(source: string) {
  const candidate = labeled(source, 'CANDIDATE') || 'there'
  const company = labeled(source, 'COMPANY')
  const role = labeled(source, 'ROLE') || 'the role'
  const note = labeled(source, 'NOTE')
  const subject = `Following up on ${role}${company ? ` at ${company}` : ''}`
  const body = [
    'Hello,',
    '',
    `I wanted to follow up on my application for the ${role} role${company ? ` at ${company}` : ''}.`,
    note ? `A bit of context: ${note}` : 'I am glad to send anything else you need.',
    '',
    'Thank you,',
    candidate,
  ].join('\n')
  return { subject, body }
}
