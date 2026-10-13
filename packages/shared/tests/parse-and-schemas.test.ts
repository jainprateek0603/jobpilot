import { describe, expect, it } from 'vitest'
import { parseJobLink } from '../src/parse-job-link.js'
import { applicationCreateSchema, passwordSchema, registerSchema } from '../src/schemas.js'

describe('parseJobLink', () => {
  it('reads company and role from known job boards', () => {
    expect(parseJobLink('https://boards.greenhouse.io/northwind/jobs/123').company).toBe('Northwind')
    expect(parseJobLink('https://jobs.lever.co/spotify/7f3ab2-senior-backend-engineer')).toMatchObject({
      company: 'Spotify',
      role: 'Senior Backend Engineer',
      source: 'lever',
    })
    expect(parseJobLink('https://jobs.ashbyhq.com/notion/a1b2c3d4-product-designer').role).toBe('Product Designer')
    expect(parseJobLink('https://jobs.ashbyhq.com/notion/11111111-2222-3333-4444-555555555555-staff-writer').role).toBe(
      'Staff Writer',
    )
    expect(parseJobLink('https://apply.workable.com/harbor/j/ABC').company).toBe('Harbor')
    expect(parseJobLink('https://www.linkedin.com/jobs/view/1?company=Kepler&role=Analyst')).toMatchObject({
      company: 'Kepler',
      role: 'Analyst',
      source: 'linkedin',
    })
    expect(parseJobLink('https://www.indeed.com/viewjob?jk=1').source).toBe('indeed')
    expect(parseJobLink('https://example.com/jobs/1?title=Editor')).toMatchObject({ role: 'Editor', source: 'example.com' })
  })

  it('reads a typed company and role and ignores blank input', () => {
    expect(parseJobLink('Northwind — Platform Engineer')).toMatchObject({
      company: 'Northwind',
      role: 'Platform Engineer',
      confidence: 'text',
    })
    expect(parseJobLink('Northwind - Platform Engineer').confidence).toBe('text')
    expect(parseJobLink('   ').confidence).toBe('none')
    expect(parseJobLink('just a sentence').confidence).toBe('none')
    expect(parseJobLink('https://jobs.lever.co/acme/abcdef').role).toBe('')
    expect(parseJobLink('not a url')).toEqual({ company: '', role: '', source: '', jobUrl: '', confidence: 'none' })
  })

  it('keeps a broken escape sequence instead of throwing', () => {
    expect(parseJobLink('https://jobs.lever.co/acme/%E0%A4%').source).toBe('lever')
  })
})

describe('schemas', () => {
  it('accepts a strong password and rejects a short one', () => {
    expect(passwordSchema.safeParse('Password123').success).toBe(true)
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('longpassword').success).toBe(false)
  })

  it('normalizes email and checks salary order', () => {
    const user = registerSchema.parse({ email: 'Ada@Example.com', password: 'Password123', name: 'Ada' })
    expect(user.email).toBe('ada@example.com')
    expect(
      applicationCreateSchema.safeParse({ company: 'A', role: 'B', salaryMin: 10, salaryMax: 2 }).success,
    ).toBe(false)
    expect(applicationCreateSchema.safeParse({ company: 'A', role: 'B', jobUrl: 'ftp://files' }).success).toBe(false)
  })
})
