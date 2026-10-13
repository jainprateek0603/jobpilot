import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { dayKey, monthGrid } from '../lib/dates'
import { Button } from '../components/ui'

type CalendarData = {
  interviews: { id: string; company: string; role: string; at: string }[]
  deadlines: { id: string; company: string; role: string; at: string }[]
  reminders: { id: string; title: string; dueAt: string; status: string }[]
}

export function CalendarPage() {
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [data, setData] = useState<CalendarData>({ interviews: [], deadlines: [], reminders: [] })
  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  useEffect(() => {
    const from = new Date(cursor.year, cursor.month, 1)
    const to = new Date(cursor.year, cursor.month + 1, 0, 23, 59, 59)
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
    void api<CalendarData>(`/api/calendar?${params.toString()}`).then(setData)
  }, [cursor])

  const byDay = new Map<string, string[]>()
  for (const item of data.interviews) push(byDay, item.at, `Interview · ${item.company}`)
  for (const item of data.deadlines) push(byDay, item.at, `Deadline · ${item.company}`)
  for (const item of data.reminders) push(byDay, item.dueAt, item.title)
  const label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(cursor.year, cursor.month, 1))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl">{label}</h1>
        <div className="flex gap-2">
          <Button variant="quiet" type="button" onClick={() => setCursor((value) => shift(value, -1))}>
            Previous month
          </Button>
          <Button variant="quiet" type="button" onClick={() => setCursor((value) => shift(value, 1))}>
            Next month
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-line text-sm dark:bg-[#2C3B34]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="bg-paper px-2 py-1 text-muted dark:bg-night">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) ?? []
          const inMonth = day.getMonth() === cursor.month
          return (
            <div key={day.toISOString()} className={`min-h-24 bg-paper p-2 dark:bg-night ${inMonth ? '' : 'opacity-40'}`}>
              <p>{day.getDate()}</p>
              <ul>
                {items.map((item) => (
                  <li key={item} className="mt-1 text-xs">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function push(map: Map<string, string[]>, iso: string, label: string) {
  const key = dayKey(new Date(iso))
  const list = map.get(key) ?? []
  list.push(label)
  map.set(key, list)
}

function shift(value: { year: number; month: number }, delta: number) {
  const date = new Date(value.year, value.month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}
