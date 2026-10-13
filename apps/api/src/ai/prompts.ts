import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROMPT_VERSION = 'v1'

const NAMES = ['tailor-resume', 'cover-letter', 'interview-questions', 'answer-feedback', 'follow-up-email'] as const

export type PromptName = (typeof NAMES)[number]

export function promptsDirectory(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prompts')
}

export function loadPrompt(name: PromptName): { version: string; text: string } {
  const file = path.join(promptsDirectory(), PROMPT_VERSION, `${name}.md`)
  return { version: PROMPT_VERSION, text: readFileSync(file, 'utf8') }
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '')
}

export function promptNames(): PromptName[] {
  return [...NAMES]
}
