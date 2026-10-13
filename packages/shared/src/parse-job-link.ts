import { isApplicationStatus } from './constants.js'
import type { ApplicationStatus } from './constants.js'

export type ParsedJobLink = {
  company: string
  role: string
  source: string
  jobUrl: string
  confidence: 'url' | 'text' | 'none'
}

const EMPTY: ParsedJobLink = {
  company: '',
  role: '',
  source: '',
  jobUrl: '',
  confidence: 'none',
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function humanizeSlug(slug: string): string {
  const decoded = safeDecode(slug)
  const withoutIds = decoded
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-?/gi, ' ')
    .replace(/^[0-9a-f]{4,}[-_]/i, '')
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!withoutIds || /^[0-9a-f]+$/i.test(withoutIds) || /^\d+$/.test(withoutIds)) return ''
  return titleCase(withoutIds)
}

function toUrl(input: string): URL | null {
  const candidate = /^https?:\/\//i.test(input) ? input : input.startsWith('www.') ? `https://${input}` : ''
  if (!candidate) return null
  try {
    return new URL(candidate)
  } catch {
    return null
  }
}

function param(url: URL, names: string[]): string {
  for (const name of names) {
    const value = url.searchParams.get(name)?.trim()
    if (value) return value
  }
  return ''
}

function parseUrl(url: URL): ParsedJobLink {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const parts = url.pathname.split('/').filter(Boolean).map((part) => safeDecode(part))
  let company = ''
  let role = ''
  let source = host

  if (host.endsWith('greenhouse.io') && parts.length >= 1) {
    company = humanizeSlug(parts[0] ?? '')
    source = 'greenhouse'
    const jobsIndex = parts.findIndex((part) => part.toLowerCase() === 'jobs')
    if (jobsIndex >= 0 && parts[jobsIndex + 1]) role = humanizeSlug(parts[jobsIndex + 1] ?? '')
  } else if (host === 'jobs.lever.co' && parts[0]) {
    company = humanizeSlug(parts[0])
    role = humanizeSlug(parts[1] ?? '')
    source = 'lever'
  } else if (host === 'jobs.ashbyhq.com' && parts[0]) {
    company = humanizeSlug(parts[0])
    role = humanizeSlug(parts[1] ?? '')
    source = 'ashby'
  } else if (host === 'apply.workable.com' && parts[0]) {
    company = humanizeSlug(parts[0])
    source = 'workable'
    const jobIndex = parts.findIndex((part) => part.toLowerCase() === 'j')
    role = humanizeSlug(parts[(jobIndex >= 0 ? jobIndex + 1 : 1)] ?? '')
  } else if (host.endsWith('smartrecruiters.com') && parts[0]) {
    company = humanizeSlug(parts[0])
    role = humanizeSlug(parts[1] ?? '')
    source = 'smartrecruiters'
  } else if (host.endsWith('linkedin.com')) {
    source = 'linkedin'
    const view = parts.findIndex((part) => part.toLowerCase() === 'view')
    const slug = parts[view + 1] ?? ''
    const linked = slug.match(/(.+)-at-(.+)-\d+$/i)
    if (linked) {
      role = humanizeSlug(linked[1] ?? '')
      company = humanizeSlug(linked[2] ?? '')
    } else {
      role = humanizeSlug(slug.replace(/-\d+$/, ''))
    }
  } else if (host.includes('indeed.')) {
    source = 'indeed'
  }

  const queryCompany = param(url, ['company', 'organization', 'org'])
  const queryRole = param(url, ['role', 'title', 'job'])
  if (queryCompany) company = queryCompany
  if (queryRole) role = queryRole

  return {
    company,
    role,
    source,
    jobUrl: url.toString(),
    confidence: 'url',
  }
}

function parseText(input: string): ParsedJobLink {
  const at = input.match(/^(.+?)\s+at\s+(.+)$/i)
  if (at?.[1] && at[2]) {
    return { company: at[2].trim(), role: at[1].trim(), source: '', jobUrl: '', confidence: 'text' }
  }
  const pipe = input.split('|').map((part) => part.trim())
  if (pipe.length === 2 && pipe[0] && pipe[1]) {
    return { company: pipe[1], role: pipe[0], source: '', jobUrl: '', confidence: 'text' }
  }
  const dash = input.split(/\s+[—–-]\s+/)
  if (dash.length === 2 && dash[0] && dash[1]) {
    return { company: dash[0].trim(), role: dash[1].trim(), source: '', jobUrl: '', confidence: 'text' }
  }
  return { ...EMPTY }
}

export function parseJobLink(input: string): ParsedJobLink {
  const trimmed = input.trim()
  if (!trimmed) return { ...EMPTY }
  const url = toUrl(trimmed)
  if (url) return parseUrl(url)
  return parseText(trimmed)
}

export function statusFromLabel(value: string): ApplicationStatus | null {
  const normalized = value.trim().toUpperCase()
  return isApplicationStatus(normalized) ? normalized : null
}
