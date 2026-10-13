import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { AuthProvider } from '../lib/auth'
import { ThemeProvider } from '../lib/theme'
import { ToastProvider } from '../lib/toast'

const user = {
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  headline: 'Engineer',
  location: 'Bengaluru',
  phone: '',
  linkedinUrl: '',
  websiteUrl: '',
  timezone: 'UTC',
  theme: 'system' as const,
  emailReminders: true,
}

const application = {
  id: 'app-1',
  company: 'Northwind',
  role: 'Platform Engineer',
  status: 'WISHLIST',
  position: 0,
  salaryMin: 100000,
  salaryMax: 140000,
  currency: 'USD',
  jobUrl: '',
  location: 'Remote',
  source: '',
  notes: '',
  jobDescription: 'TypeScript and Kubernetes',
  interviewAt: null,
  deadlineAt: '2026-12-01T00:00:00.000Z',
  appliedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  contacts: [],
  events: [{ id: 'e1', type: 'created', title: 'Added to the board', body: 'WISHLIST', occurredAt: '2026-10-01T00:00:00.000Z' }],
  reminders: [],
}

const resume = {
  id: 'resume-1',
  title: 'Base resume',
  content: 'TypeScript and React',
  fileName: '',
  mimeType: '',
  hasFile: false,
  isDefault: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function route(url: string, method: string) {
  if (url.includes('/api/auth/me') || url.includes('/api/auth/refresh')) {
    return new Response(JSON.stringify({ error: { message: 'Sign in to continue', code: 'UNAUTHORIZED' } }), { status: 401 })
  }
  if (url.includes('/api/auth/register') || url.includes('/api/auth/login')) return json({ accessToken: 'token', user })
  if (url.includes('/api/auth/logout') || url.includes('/api/auth/change-password')) return json({ ok: true })
  if (url.includes('/api/analytics')) {
    return json({
      applicationsPerWeek: [{ weekStart: '2026-10-06', count: 1 }],
      totals: { applications: 1, submitted: 1, responses: 1, interviews: 1, offers: 0 },
      responseRate: 1,
      interviewRate: 1,
      funnel: [{ stage: 'Saved', count: 1 }],
    })
  }
  if (url.includes('/api/calendar')) {
    return json({
      interviews: [{ id: 'i1', company: 'Harbor', role: 'Designer', at: new Date().toISOString() }],
      deadlines: [{ id: 'd1', company: 'Northwind', role: 'Engineer', at: new Date().toISOString() }],
      reminders: [{ id: 'r1', title: 'Follow up', dueAt: new Date().toISOString(), status: 'pending' }],
    })
  }
  if (url.includes('/api/applications/export')) return json('company,role\nNorthwind,Engineer')
  if (url.includes('/api/applications/import')) return json({ imported: 1, errors: [] })
  if (url.includes('/api/applications/parse-link')) return json({ company: 'Spotify', role: 'Engineer', source: 'lever', warning: '' })
  if (url.includes('/api/applications/reorder')) return json({ ok: true })
  if (url.includes('/api/applications/app-1/contacts')) return json({ id: 'c1', name: 'Mina', role: '', email: '', phone: '', notes: '' }, 201)
  if (url.includes('/api/applications/app-1/events')) {
    return json({ id: 'n1', type: 'note', title: 'Note', body: 'Hello', occurredAt: '2026-10-02T00:00:00.000Z' }, 201)
  }
  if (url.includes('/api/applications/app-1')) return json(application)
  if (url.includes('/api/applications') && method === 'POST') return json(application, 201)
  if (url.includes('/api/applications')) return json([application])
  if (url.includes('/api/resumes/upload')) return json(resume, 201)
  if (url.includes('/api/resumes') && method === 'POST') return json(resume, 201)
  if (url.includes('/api/resumes') && method === 'DELETE') return json({ ok: true })
  if (url.includes('/api/resumes')) return json([resume])
  if (url.includes('/api/ai/tailor')) {
    return json({ id: 't1', content: 'Tailored resume', matchScore: 80, missingKeywords: ['kubernetes'] }, 201)
  }
  if (url.includes('/api/ai/cover-letter')) return json({ id: 'letter-1', tone: 'warm', content: 'Hello Harbor' }, 201)
  if (url.includes('/answers')) return json({ score: 8, feedback: 'The answer is specific.' }, 201)
  if (url.includes('/api/ai/interview-prep') && method === 'POST') {
    return json({ id: 'prep-1', questions: [{ id: 'q1', question: 'Why this role?', tips: 'Be specific.' }] }, 201)
  }
  if (url.includes('/api/profile') || url.includes('/api/settings')) return json(user)
  return json({ ok: true })
}

function renderApp(path = '/') {
  window.history.pushState({}, '', path)
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>,
  )
}

describe('app flows', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => route(String(input), init?.method ?? 'GET')))
    URL.createObjectURL = () => 'blob:jobpilot'
    URL.revokeObjectURL = () => undefined
  })

  it('walks the public pages and the signed-in search', async () => {
    const person = userEvent.setup({ delay: null })
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /board for a job search/i })).toBeInTheDocument()
    await person.click(screen.getAllByRole('link', { name: 'Create account' })[0]!)
    await person.type(screen.getByLabelText('Name'), 'Ada Lovelace')
    await person.type(screen.getByLabelText('Email'), 'ada@example.com')
    await person.type(screen.getByLabelText('Password'), 'Password123')
    await person.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument()
    expect(await screen.findByText('Northwind')).toBeInTheDocument()
    await person.click(screen.getByRole('link', { name: 'Open' }))
    expect(await screen.findByRole('heading', { name: 'Northwind' })).toBeInTheDocument()
    await person.type(screen.getByLabelText('Name'), 'Mina Rao')
    await person.click(screen.getByRole('button', { name: 'Add contact' }))
    await person.type(screen.getByLabelText('Add a note'), 'Asked about the timeline')
    await person.click(screen.getByRole('button', { name: 'Add note' }))
    await person.click(screen.getByRole('button', { name: 'Save application' }))
    await person.click(screen.getByRole('link', { name: 'Board' }))
    await person.click(screen.getByRole('button', { name: 'Export CSV' }))

    await person.click(screen.getByRole('button', { name: 'Add application' }))
    await person.type(screen.getByLabelText('Link or company — role'), 'https://jobs.lever.co/spotify/senior-backend-engineer')
    await person.tab()
    await person.click(screen.getByRole('button', { name: 'Read link' }))
    await person.selectOptions(screen.getByLabelText('Column'), 'APPLIED')
    await person.type(screen.getByLabelText('Notes'), 'Referral')
    await person.clear(screen.getByLabelText('Company'))
    await person.type(screen.getByLabelText('Company'), 'Harbor')
    await person.clear(screen.getByLabelText('Role'))
    await person.type(screen.getByLabelText('Role'), 'Designer')
    await person.click(screen.getByRole('button', { name: 'Save application' }))
    await person.type(screen.getByLabelText('Search'), 'north')
    await person.selectOptions(screen.getByLabelText('Move Northwind'), 'INTERVIEW')

    await person.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('heading', { name: 'This search' })).toBeInTheDocument()

    await person.click(screen.getByRole('link', { name: 'Resumes' }))
    expect(await screen.findByText(/Base resume/)).toBeInTheDocument()
    await person.type(screen.getByLabelText('Title'), 'Second')
    await person.type(screen.getByLabelText('Resume text'), 'More TypeScript experience for platform work.')
    await person.click(screen.getByRole('button', { name: 'Save resume' }))
    await person.click(screen.getByRole('button', { name: 'Delete' }))

    await person.click(screen.getByRole('link', { name: 'Tailor' }))
    await person.type(screen.getByLabelText('Job description'), 'We need Kubernetes and TypeScript for the platform role.')
    await person.click(screen.getByRole('button', { name: 'Generate tailored resume' }))
    expect(await screen.findByText(/Match score/)).toBeInTheDocument()

    await person.click(screen.getByRole('link', { name: 'Letters' }))
    await person.type(screen.getByLabelText('Job description'), 'Design systems work for a product team building tools.')
    await person.click(screen.getByRole('button', { name: 'Generate cover letter' }))
    expect(await screen.findByText('Hello Harbor')).toBeInTheDocument()

    await person.click(screen.getByRole('link', { name: 'Interviews' }))
    await person.type(screen.getByLabelText('Role'), 'Engineer')
    await person.click(screen.getByRole('button', { name: 'Generate questions' }))
    await person.type(await screen.findByLabelText('Your answer'), 'I shipped a TypeScript service and cut review time by 20 percent with my team.')
    await person.click(screen.getByRole('button', { name: 'Get feedback' }))
    expect(await screen.findByText(/Score 8/)).toBeInTheDocument()

    await person.click(screen.getByRole('link', { name: 'Calendar' }))
    await person.click(await screen.findByRole('button', { name: 'Previous month' }))
    await person.click(screen.getByRole('button', { name: 'Next month' }))

    await person.click(screen.getByRole('link', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await person.clear(screen.getByLabelText('Headline'))
    await person.type(screen.getByLabelText('Headline'), 'Product engineer')
    await person.type(screen.getByLabelText('Location'), 'Bengaluru')
    await person.type(screen.getByLabelText('Phone'), '555')
    await person.selectOptions(screen.getByLabelText('Theme'), 'dark')
    await person.click(screen.getByLabelText('Email me when a reminder is due'))
    await person.click(screen.getByRole('button', { name: 'Save profile' }))
    await person.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await person.type(screen.getByLabelText('Email'), 'ada@example.com')
    await person.type(screen.getByLabelText('Password'), 'Password123')
    await person.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument()
  }, 20000)
})
