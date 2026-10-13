import { Link } from 'react-router-dom'
import { STATUS_LABELS } from '@jobpilot/shared'

const sample = [
  ['Wishlist', 'Northwind', 'Product manager'],
  ['Applied', 'Lumen Freight', 'Platform engineer'],
  ['Interview', 'Harbor Studio', 'Product designer'],
]

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <p className="text-lg font-semibold">JobPilot</p>
        <div className="flex gap-3 text-sm">
          <Link className="px-2 py-1" to="/login">
            Sign in
          </Link>
          <Link className="bg-pine px-3 py-2 text-white" to="/register">
            Create account
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <h1 className="max-w-[16ch] text-5xl leading-tight sm:text-6xl">The board for a job search.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted dark:text-[#B7C9C0]">
            Keep each application, the resume you sent, and the interview on the same slip. See which weeks actually moved.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="bg-pine px-4 py-2 text-white" to="/register">
              Create account
            </Link>
            <Link className="px-4 py-2 ring-1 ring-line" to="/login">
              Sign in
            </Link>
          </div>
        </div>
        <div className="border border-line bg-white p-3 dark:border-[#2C3B34] dark:bg-panel" aria-hidden="true">
          <div className="grid gap-2 sm:grid-cols-3">
            {sample.map(([column, company, role]) => (
              <div key={column} className="border border-line dark:border-[#2C3B34]">
                <div className="h-1.5 bg-pine" />
                <p className="px-2 py-2 text-sm">{column}</p>
                <div className="m-2 border border-line bg-paper p-2 dark:border-[#2C3B34] dark:bg-night">
                  <p className="font-medium">{company}</p>
                  <p className="text-sm text-muted">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <section className="max-w-xl space-y-3 text-base lg:col-span-2">
          <p>Track a role from the first save to an offer.</p>
          <p>Tailor a resume against the posting and see the words you still lack.</p>
          <p>Practice the questions that role tends to ask, then keep the follow-up on the calendar.</p>
          <p className="text-sm text-muted">Columns: {Object.values(STATUS_LABELS).join(', ')}.</p>
        </section>
      </main>
    </div>
  )
}
