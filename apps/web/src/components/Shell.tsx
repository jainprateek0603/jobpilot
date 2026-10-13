import { NavLink } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Button } from './ui'

const links = [
  ['/app', 'Dashboard'],
  ['/app/board', 'Board'],
  ['/app/resumes', 'Resumes'],
  ['/app/tailor', 'Tailor'],
  ['/app/cover-letters', 'Letters'],
  ['/app/interviews', 'Interviews'],
  ['/app/calendar', 'Calendar'],
  ['/app/settings', 'Settings'],
] as const

export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-line bg-paper/95 dark:border-[#2C3B34] dark:bg-night/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/app/board" className="text-lg font-semibold">
            JobPilot
          </NavLink>
          <button type="button" className="px-2 py-1 text-sm md:hidden" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            Menu
          </button>
          <nav className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-14 z-30 flex-col gap-1 border-b border-line bg-paper p-3 md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 dark:border-[#2C3B34] dark:bg-night`}>
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/app'}
                className={({ isActive }) => `px-2 py-1 text-sm ${isActive ? 'bg-moss text-ink dark:bg-[#24362C]' : ''}`}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{user?.name}</span>
            <Button variant="quiet" type="button" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
