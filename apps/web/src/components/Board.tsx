import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from '@jobpilot/shared'
import { Link } from 'react-router-dom'
import { moveCard } from '../lib/board'
import { formatWhen } from '../lib/dates'
import { STATUS_STRIPE, SelectInput } from './ui'

export type BoardApplication = {
  id: string
  company: string
  role: string
  status: ApplicationStatus
  position: number
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  interviewAt: string | null
  deadlineAt: string | null
}

export function Board({
  applications,
  timezone,
  onMove,
}: {
  applications: BoardApplication[]
  timezone: string
  onMove: (cards: BoardApplication[], columns: { status: ApplicationStatus; ids: string[] }[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    if (!event.over) return
    const result = moveCard(applications, String(event.active.id), String(event.over.id))
    if (result) onMove(result.cards as BoardApplication[], result.columns)
  }

  function moveTo(id: string, status: ApplicationStatus) {
    const result = moveCard(applications, id, status)
    if (result) onMove(result.cards as BoardApplication[], result.columns)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
        {APPLICATION_STATUSES.map((status) => {
          const cards = applications.filter((card) => card.status === status).sort((a, b) => a.position - b.position)
          return <Column key={status} status={status} cards={cards} timezone={timezone} onMove={moveTo} />
        })}
      </div>
    </DndContext>
  )
}

function Column({
  status,
  cards,
  timezone,
  onMove,
}: {
  status: ApplicationStatus
  cards: BoardApplication[]
  timezone: string
  onMove: (id: string, status: ApplicationStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={`min-w-[16rem] flex-1 snap-start border border-line bg-white/70 dark:border-[#2C3B34] dark:bg-panel ${isOver ? 'ring-2 ring-pine' : ''}`}
    >
      <div className={`h-1.5 ${STATUS_STRIPE[status]}`} />
      <header className="flex items-baseline justify-between px-3 py-2">
        <h2 className="text-sm font-medium">{STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted">{cards.length}</span>
      </header>
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-col gap-2 px-2 pb-3">
          {cards.length === 0 ? <p className="px-1 text-sm text-muted">Nothing in this column.</p> : null}
          {cards.map((card) => (
            <Card key={card.id} card={card} timezone={timezone} onMove={onMove} />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

function Card({
  card,
  timezone,
  onMove,
}: {
  card: BoardApplication
  timezone: string
  onMove: (id: string, status: ApplicationStatus) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card.id })
  const when = card.interviewAt ? `Interview ${formatWhen(card.interviewAt, timezone)}` : card.deadlineAt ? `Due ${formatWhen(card.deadlineAt, timezone)}` : ''
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`card-${card.id}`}
      className="border border-line bg-paper shadow-slip dark:border-[#2C3B34] dark:bg-night"
    >
      <div className={`h-1 ${STATUS_STRIPE[card.status]}`} />
      <div className="p-3">
        <button type="button" className="w-full cursor-grab text-left" {...attributes} {...listeners}>
          <p className="font-medium">{card.company}</p>
          <p className="text-sm text-muted dark:text-[#B7C9C0]">{card.role}</p>
        </button>
        {when ? <p className="mt-2 text-xs">{when}</p> : null}
        <p className="mt-1 text-xs">{money(card)}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Link className="text-sm underline" to={`/app/applications/${card.id}`}>
            Open
          </Link>
          <label className="text-xs">
            <span className="sr-only">Move {card.company}</span>
            <SelectInput
              aria-label={`Move ${card.company}`}
              value={card.status}
              onChange={(event) => onMove(card.id, event.target.value as ApplicationStatus)}
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </SelectInput>
          </label>
        </div>
      </div>
    </article>
  )
}

function money(card: BoardApplication) {
  if (card.salaryMin == null && card.salaryMax == null) return ''
  try {
    const format = new Intl.NumberFormat('en', { style: 'currency', currency: card.currency || 'USD', maximumFractionDigits: 0 })
    if (card.salaryMin != null && card.salaryMax != null) return `${format.format(card.salaryMin)} – ${format.format(card.salaryMax)}`
    if (card.salaryMin != null) return `From ${format.format(card.salaryMin)}`
    return `Up to ${format.format(card.salaryMax ?? 0)}`
  } catch {
    return ''
  }
}
