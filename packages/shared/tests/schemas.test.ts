import { describe, expect, it } from 'vitest'
import { applicationWriteSchema, passwordSchema, registerSchema } from '../src/schemas.js'

describe('schemas', () => {
  it('accepts a strong password and rejects a short one', () => {
    expect(passwordSchema.safeParse('correcthorsebattery1').success).toBe(true)
    expect(passwordSchema.safeParse('short1').success).toBe(false)
    expect(passwordSchema.safeParse('longpassword').success).toBe(false)
  })

  it('lowercases email on register', () => {
    const parsed = registerSchema.parse({
      email: 'Ada@Example.com',
      password: 'correcthorsebattery1',
      name: 'Ada',
    })
    expect(parsed.email).toBe('ada@example.com')
  })

  it('rejects a salary range that is upside down', () => {
    const parsed = applicationWriteSchema.safeParse({
      company: 'Acme',
      role: 'PM',
      salaryMin: 100,
      salaryMax: 10,
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts a date-only deadline', () => {
    const parsed = applicationWriteSchema.parse({
      company: 'Acme',
      role: 'PM',
      deadlineAt: '2026-11-01',
      jobUrl: '',
    })
    expect(parsed.deadlineAt).toBe('2026-11-01T00:00:00.000Z')
  })
})
