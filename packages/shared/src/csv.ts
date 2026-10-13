import { CSV_COLUMNS, isApplicationStatus } from './constants.js'
import type { ApplicationStatus, CsvColumn } from './constants.js'

export type CsvApplication = Record<CsvColumn, string>

export type CsvImportRow = {
  company: string
  role: string
  status: ApplicationStatus
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  jobUrl: string
  location: string
  source: string
  notes: string
  appliedAt: string | null
  deadlineAt: string | null
  interviewAt: string | null
}

export type CsvImportError = { line: number; message: string }

export type CsvImportResult = {
  rows: CsvImportRow[]
  errors: CsvImportError[]
}

function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function escapeCell(value: string): string {
  const safe = neutralize(value ?? '')
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

export function applicationsToCsv(rows: CsvApplication[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => escapeCell(row[column] ?? '')).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (char === '\r') continue
    cell += char
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ''))
}

function parseSalary(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const number = Number(trimmed.replace(/[$,]/g, ''))
  if (!Number.isInteger(number) || number < 0 || number > 10_000_000) {
    throw new Error('Salary must be a whole number')
  }
  return number
}

function parseDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error('Use an ISO date')
  return date.toISOString()
}

export function csvToApplications(text: string): CsvImportResult {
  const table = parseCsv(text)
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: 'The CSV is empty' }] }
  const header = table[0]?.map((cell) => cell.trim()) ?? []
  const index = new Map<string, number>()
  header.forEach((name, position) => index.set(name, position))
  if (!index.has('company') || !index.has('role')) {
    return { rows: [], errors: [{ line: 1, message: 'The header must include company and role' }] }
  }

  const rows: CsvImportRow[] = []
  const errors: CsvImportError[] = []
  for (let line = 1; line < table.length; line += 1) {
    const cells = table[line] ?? []
    const read = (column: CsvColumn) => {
      const position = index.get(column)
      return position == null ? '' : (cells[position] ?? '').trim()
    }
    try {
      const company = read('company')
      const role = read('role')
      if (!company || !role) throw new Error('Company and role are required')
      const statusText = (read('status') || 'WISHLIST').toUpperCase()
      if (!isApplicationStatus(statusText)) throw new Error('Status must be a board column')
      const salaryMin = parseSalary(read('salaryMin'))
      const salaryMax = parseSalary(read('salaryMax'))
      if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
        throw new Error('Maximum salary must be at least the minimum')
      }
      const currency = (read('currency') || 'USD').toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Use a 3-letter currency code')
      const jobUrl = read('jobUrl')
      if (jobUrl && !/^https?:\/\/\S+$/i.test(jobUrl)) throw new Error('Job link must start with http')
      rows.push({
        company,
        role,
        status: statusText,
        salaryMin,
        salaryMax,
        currency,
        jobUrl,
        location: read('location'),
        source: read('source'),
        notes: read('notes'),
        appliedAt: parseDate(read('appliedAt')),
        deadlineAt: parseDate(read('deadlineAt')),
        interviewAt: parseDate(read('interviewAt')),
      })
    } catch (error) {
      errors.push({ line: line + 1, message: error instanceof Error ? error.message : 'Could not read this row' })
    }
  }
  return { rows, errors }
}
