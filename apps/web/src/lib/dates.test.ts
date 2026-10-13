import { describe, expect, it } from 'vitest'
import { dayKey, formatWhen, fromLocalInput, monthGrid, toLocalInput } from './dates'

describe('dates', () => {
  it('round-trips a local datetime and builds a Monday-first month', () => {
    const iso = '2026-10-13T09:30:00.000Z'
    const local = toLocalInput(iso)
    expect(fromLocalInput(local)).toBeTruthy()
    expect(toLocalInput('')).toBe('')
    expect(fromLocalInput('')).toBeNull()
    const days = monthGrid(2026, 9)
    expect(days).toHaveLength(42)
    expect(days[0]?.getDay()).toBe(1)
    expect(dayKey(new Date(2026, 9, 13))).toBe('2026-9-13')
    expect(formatWhen('')).toBe('')
    expect(formatWhen('2026-10-13T09:30:00.000Z', 'UTC')).toMatch(/Oct/)
    expect(formatWhen('not-a-date')).toBe('')
  })
})
