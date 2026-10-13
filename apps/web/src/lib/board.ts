import { APPLICATION_STATUSES, type ApplicationStatus } from '@jobpilot/shared'

export type BoardCard = {
  id: string
  status: ApplicationStatus
  position: number
}

export function moveCard<T extends BoardCard>(cards: T[], activeId: string, overId: string) {
  const active = cards.find((card) => card.id === activeId)
  if (!active || active.id === overId) return null
  const overIsColumn = (APPLICATION_STATUSES as readonly string[]).includes(overId)
  const overCard = cards.find((card) => card.id === overId)
  const destination = overIsColumn ? (overId as ApplicationStatus) : overCard?.status
  if (!destination) return null

  const groups = new Map<ApplicationStatus, T[]>()
  for (const status of APPLICATION_STATUSES) {
    groups.set(
      status,
      cards.filter((card) => card.status === status && card.id !== activeId).sort((a, b) => a.position - b.position),
    )
  }
  const destinationCards = groups.get(destination) ?? []
  let index = destinationCards.length
  if (overCard) {
    const found = destinationCards.findIndex((card) => card.id === overCard.id)
    if (found >= 0) index = found
  }
  destinationCards.splice(index, 0, { ...active, status: destination })
  groups.set(destination, destinationCards)

  const next: T[] = []
  const columns: { status: ApplicationStatus; ids: string[] }[] = []
  for (const status of APPLICATION_STATUSES) {
    const column = (groups.get(status) ?? []).map((card, position) => ({ ...card, position }))
    next.push(...column)
    if (status === active.status || status === destination) {
      columns.push({ status, ids: column.map((card) => card.id) })
    }
  }
  return { cards: next, columns }
}
