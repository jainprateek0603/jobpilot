import { describe, expect, it } from 'vitest'
import { buildAnalytics, recentWeekStarts, startOfUtcWeek } from '../src/analytics.js'

describe('analytics', () => {
  it('starts weeks on Monday UTC', () => {
    const wednesday = new Date('2026-10-14T15:00:00.000Z')
    expect(startOfUtcWeek(wednesday).toISOString().slice(0, 10)).toBe('2026-10-12')
    expect(recentWeekStarts(wednesday)).toHaveLength(12)
    expect(recentWeekStarts(wednesday)[11]).toBe('2026-10-12')
  })

  it('counts an empty search as zeros', () => {
    const report = buildAnalytics([], [], new Date('2026-10-14T00:00:00.000Z'))
    expect(report.totals.applications).toBe(0)
    expect(report.responseRate).toBe(0)
    expect(report.funnel[0]).toMatchObject({ stage: 'Saved', count: 0 })
    expect(report.applicationsPerWeek.every((week) => week.count === 0)).toBe(true)
  })

  it('does not treat wishlist as a response', () => {
    const report = buildAnalytics(
      [
        {
          id: '1',
          status: 'WISHLIST',
          createdAt: '2026-10-13T00:00:00.000Z',
          appliedAt: null,
        },
      ],
      [],
      new Date('2026-10-14T00:00:00.000Z'),
    )
    expect(report.totals.submitted).toBe(0)
    expect(report.totals.wishlist).toBe(1)
    expect(report.responseRate).toBe(0)
  })

  it('keeps interview credit after a later rejection', () => {
    const report = buildAnalytics(
      [
        { id: 'a', status: 'REJECTED', createdAt: '2026-10-13T00:00:00.000Z', appliedAt: '2026-10-01T00:00:00.000Z' },
        { id: 'b', status: 'APPLIED', createdAt: '2026-09-01T00:00:00.000Z', appliedAt: '2026-09-01T00:00:00.000Z' },
        { id: 'c', status: 'OFFER', createdAt: '2026-10-02T00:00:00.000Z', appliedAt: '2026-10-02T00:00:00.000Z' },
      ],
      [
        { applicationId: 'a', status: 'APPLIED' },
        { applicationId: 'a', status: 'INTERVIEW' },
        { applicationId: 'a', status: 'REJECTED' },
      ],
      new Date('2026-10-14T00:00:00.000Z'),
    )
    expect(report.totals.submitted).toBe(3)
    expect(report.totals.responses).toBe(2)
    expect(report.totals.interviews).toBe(2)
    expect(report.totals.offers).toBe(1)
    expect(report.totals.rejected).toBe(1)
    expect(report.responseRate).toBeCloseTo(2 / 3, 4)
    expect(report.applicationsPerWeek.find((week) => week.weekStart === '2026-10-12')?.count).toBe(1)
  })
})
