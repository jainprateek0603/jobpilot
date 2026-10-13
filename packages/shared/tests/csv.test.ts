import { describe, expect, it } from 'vitest'
import { applicationsToCsv, csvToApplications } from '../src/csv.js'

describe('csv', () => {
  it('round-trips applications and neutralizes formulas', () => {
    const csv = applicationsToCsv([
      {
        company: '=Northwind',
        role: 'Engineer',
        status: 'APPLIED',
        salaryMin: '100000',
        salaryMax: '140000',
        currency: 'USD',
        jobUrl: 'https://example.com/jobs/1',
        location: 'Remote',
        source: 'Lever',
        notes: 'She said "hello"',
        appliedAt: '2026-04-01T00:00:00.000Z',
        deadlineAt: '',
        interviewAt: '',
      },
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const parsed = csvToApplications(csv)
    expect(parsed.errors).toEqual([])
    expect(parsed.rows[0]).toMatchObject({
      company: "'=Northwind",
      role: 'Engineer',
      status: 'APPLIED',
      salaryMin: 100000,
      notes: 'She said "hello"',
    })
  })

  it('keeps valid rows when another row is bad', () => {
    const csv = 'company,role,status\nAcme,Designer,WISHLIST\n,Missing,NOPE\nLumen,Writer,APPLIED'
    const parsed = csvToApplications(csv)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.errors).toHaveLength(1)
    expect(parsed.errors[0]?.line).toBe(3)
  })

  it('rejects an empty file and a header without the required columns', () => {
    expect(csvToApplications('   ').errors[0]?.message).toMatch(/empty/i)
    expect(csvToApplications('name,title\nA,B').errors[0]?.message).toMatch(/company and role/i)
  })

  it('rejects inverted salaries and bad dates', () => {
    const csv = 'company,role,salaryMin,salaryMax,appliedAt\nAcme,PM,9,2,\nLumen,Writer,,,not-a-date'
    const parsed = csvToApplications(csv)
    expect(parsed.rows).toHaveLength(0)
    expect(parsed.errors).toHaveLength(2)
  })
})
