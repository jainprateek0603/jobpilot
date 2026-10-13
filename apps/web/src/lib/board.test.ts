import { describe, expect, it } from 'vitest'
import { moveCard } from './board'

const cards = [
  { id: 'a', status: 'WISHLIST' as const, position: 0, company: 'A' },
  { id: 'b', status: 'APPLIED' as const, position: 0, company: 'B' },
]

describe('moveCard', () => {
  it('moves a card onto another column', () => {
    const result = moveCard(cards, 'a', 'APPLIED')
    expect(result?.columns).toEqual([
      { status: 'WISHLIST', ids: [] },
      { status: 'APPLIED', ids: ['b', 'a'] },
    ])
    expect(result?.cards.find((card) => card.id === 'a')?.status).toBe('APPLIED')
  })

  it('inserts before the card it lands on', () => {
    const result = moveCard(cards, 'a', 'b')
    expect(result?.columns.find((column) => column.status === 'APPLIED')?.ids).toEqual(['a', 'b'])
  })

  it('ignores a drop on itself or an unknown id', () => {
    expect(moveCard(cards, 'a', 'a')).toBeNull()
    expect(moveCard(cards, 'missing', 'APPLIED')).toBeNull()
    expect(moveCard(cards, 'a', 'nope')).toBeNull()
  })
})
