import { parseJobLink, type ApplicationStatus } from '@jobpilot/shared'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { Board, type BoardApplication } from '../components/Board'
import { Button, EmptyState, Field, Modal, SelectInput, Spinner, TextArea, TextInput } from '../components/ui'

type ListResponse = BoardApplication[]

export function BoardPage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const [applications, setApplications] = useState<BoardApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  async function load(search = query) {
    const params = new URLSearchParams({ pageSize: '500' })
    if (search.trim()) params.set('q', search.trim())
    const rows = await api<ListResponse>(`/api/applications?${params.toString()}`)
    setApplications(rows)
  }

  useEffect(() => {
    load()
      .catch(() => notify('The board could not be loaded.', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function onMove(cards: BoardApplication[], columns: { status: ApplicationStatus; ids: string[] }[]) {
    const previous = applications
    setApplications(cards)
    try {
      await api('/api/applications/reorder', { method: 'POST', body: JSON.stringify({ columns }) })
    } catch (error) {
      setApplications(previous)
      notify(error instanceof ApiError ? error.message : 'The card could not be moved.', 'error')
    }
  }

  async function exportCsv() {
    const csv = await api<string>('/api/applications/export')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'jobpilot-applications.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importCsv(file: File) {
    const csv = await file.text()
    const result = await api<{ imported: number; errors: { line: number; message: string }[] }>('/api/applications/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    })
    notify(`Imported ${result.imported} application${result.imported === 1 ? '' : 's'}.`)
    if (result.errors.length) notify(`${result.errors.length} row${result.errors.length === 1 ? '' : 's'} were skipped.`, 'error')
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Board</h1>
          <p className="text-sm text-muted">Drag a card, or use Move to change its column.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setOpen(true)}>
            Add application
          </Button>
          <Button variant="quiet" type="button" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
          <label className="inline-flex cursor-pointer items-center px-3 py-2 text-sm ring-1 ring-line">
            Import CSV
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importCsv(file).catch(() => notify('That CSV could not be imported.', 'error'))
                event.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      <form
        className="max-w-sm"
        onSubmit={(event) => {
          event.preventDefault()
          void load().catch(() => notify('Search failed.', 'error'))
        }}
      >
        <Field label="Search">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company, role, or note" />
        </Field>
      </form>
      {loading ? <Spinner label="Loading the board" /> : null}
      {!loading && applications.length === 0 ? (
        <EmptyState title="Add an application to start the board." action={<Button onClick={() => setOpen(true)}>Add application</Button>} />
      ) : null}
      {!loading && applications.length > 0 ? (
        <Board applications={applications} timezone={user?.timezone ?? 'UTC'} onMove={(cards, columns) => void onMove(cards, columns)} />
      ) : null}
      <AddApplicationDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={async () => {
          setOpen(false)
          notify('Application added.')
          await load()
        }}
      />
    </div>
  )
}

function AddApplicationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const { notify } = useToast()
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [link, setLink] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ApplicationStatus>('WISHLIST')
  const [pending, setPending] = useState(false)

  function applyLink(fetchPage: boolean) {
    const parsed = parseJobLink(link)
    if (!company && parsed.company) setCompany(parsed.company)
    if (!role && parsed.role) setRole(parsed.role)
    if (!fetchPage) return
    void api<{ company: string; role: string; warning: string }>('/api/applications/parse-link', {
      method: 'POST',
      body: JSON.stringify({ input: link, fetchPage: true }),
    }).then((result) => {
      if (!company && result.company) setCompany(result.company)
      if (!role && result.role) setRole(result.role)
      if (result.warning) notify(result.warning, 'error')
    })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ company, role, status, jobUrl: link.startsWith('http') ? link : '', notes }),
      })
      setCompany('')
      setRole('')
      setLink('')
      setNotes('')
      await onCreated()
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not add that application.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title="Add application" open={open} onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Field label="Link or company — role">
          <TextInput
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onBlur={() => applyLink(false)}
            placeholder="https://jobs.lever.co/acme/role"
          />
        </Field>
        <Button variant="quiet" type="button" onClick={() => applyLink(true)}>
          Read link
        </Button>
        <Field label="Company">
          <TextInput required value={company} onChange={(event) => setCompany(event.target.value)} />
        </Field>
        <Field label="Role">
          <TextInput required value={role} onChange={(event) => setRole(event.target.value)} />
        </Field>
        <Field label="Column">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)}>
            <option value="WISHLIST">Wishlist</option>
            <option value="APPLIED">Applied</option>
            <option value="INTERVIEW">Interview</option>
            <option value="OFFER">Offer</option>
            <option value="REJECTED">Rejected</option>
          </SelectInput>
        </Field>
        <Field label="Notes">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save application'}
        </Button>
      </form>
    </Modal>
  )
}
