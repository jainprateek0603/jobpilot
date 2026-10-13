import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { EmptyState, Spinner } from '../components/ui'

type Report = {
  applicationsPerWeek: { weekStart: string; count: number }[]
  totals: { applications: number; submitted: number; responses: number; interviews: number; offers: number }
  responseRate: number
  interviewRate: number
  funnel: { stage: string; count: number }[]
}

export function DashboardPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Report>('/api/analytics')
      .then(setReport)
      .catch(() => setError('The dashboard could not be loaded.'))
  }, [])

  if (error) return <p role="alert">{error}</p>
  if (!report) return <Spinner label="Loading the dashboard" />
  if (report.totals.applications === 0) {
    return <EmptyState title="Add an application on the board to see how the search is moving." />
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl">This search</h1>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Response rate" value={percent(report.responseRate)} />
        <Stat label="Interview rate" value={percent(report.interviewRate)} />
        <Stat label="Offers" value={String(report.totals.offers)} />
      </dl>
      <section>
        <h2 className="mb-3 text-xl">Applications per week</h2>
        <div className="h-64 border border-line bg-white p-2 dark:border-[#2C3B34] dark:bg-panel">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.applicationsPerWeek}>
              <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip />
              <Bar dataKey="count" fill="#145C38" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>Applications per week</caption>
          <tbody>
            {report.applicationsPerWeek.map((week) => (
              <tr key={week.weekStart}>
                <th scope="row">{week.weekStart}</th>
                <td>{week.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-3 text-xl">Funnel</h2>
        <ol className="space-y-2">
          {report.funnel.map((stage) => (
            <li key={stage.stage} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
              <span>{stage.stage}</span>
              <span className="h-3 bg-moss dark:bg-[#24362C]">
                <span className="block h-3 bg-pine" style={{ width: `${report.totals.applications ? (stage.count / report.totals.applications) * 100 : 0}%` }} />
              </span>
              <span>{stage.count}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line p-4 dark:border-[#2C3B34]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-3xl">{value}</dd>
    </div>
  )
}

function percent(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`
}
