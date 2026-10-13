import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from '@jobpilot/shared'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { fromLocalInput, toLocalInput } from '../lib/dates'
import { useToast } from '../lib/toast'
import { Button, Field, SelectInput, Spinner, TextArea, TextInput } from '../components/ui'

type Detail = {
  id: string
  company: string
  role: string
  status: ApplicationStatus
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  jobUrl: string
  location: string
  source: string
  notes: string
  jobDescription: string
  appliedAt: string | null
  deadlineAt: string | null
  interviewAt: string | null
  contacts: { id: string; name: string; role: string; email: string; phone: string }[]
  events: { id: string; title: string; body: string; occurredAt: string; type: string }[]
  reminders: { id: string; title: string; dueAt: string; status: string }[]
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const { notify } = useToast()
  const [application, setApplication] = useState<Detail | null>(null)
  const [error, setError] = useState('')

  async function reload() {
    setApplication(await api<Detail>(`/api/applications/${id}`))
  }

  useEffect(() => {
    reload().catch(() => setError('That application could not be found.'))
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!application) return <Spinner label="Loading the application" />

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const salaryMin = numberOrNull(form.get('salaryMin'))
    const salaryMax = numberOrNull(form.get('salaryMax'))
    try {
      await api(`/api/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          company: String(form.get('company') ?? ''),
          role: String(form.get('role') ?? ''),
          status: String(form.get('status') ?? ''),
          salaryMin,
          salaryMax,
          currency: String(form.get('currency') ?? 'USD'),
          jobUrl: String(form.get('jobUrl') ?? ''),
          location: String(form.get('location') ?? ''),
          source: String(form.get('source') ?? ''),
          notes: String(form.get('notes') ?? ''),
          jobDescription: String(form.get('jobDescription') ?? ''),
          deadlineAt: fromLocalInput(String(form.get('deadlineAt') ?? '')),
          interviewAt: fromLocalInput(String(form.get('interviewAt') ?? '')),
        }),
      })
      notify('Application saved.')
      await reload()
    } catch (caught) {
      notify(caught instanceof ApiError ? caught.message : 'Could not save.', 'error')
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <form className="space-y-3" onSubmit={save}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl">{application.company}</h1>
          <Link className="text-sm underline" to="/app/board">
            Back to board
          </Link>
        </div>
        <Field label="Company">
          <TextInput name="company" defaultValue={application.company} required />
        </Field>
        <Field label="Role">
          <TextInput name="role" defaultValue={application.role} required />
        </Field>
        <Field label="Column">
          <SelectInput name="status" defaultValue={application.status}>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minimum salary">
            <TextInput name="salaryMin" type="number" defaultValue={application.salaryMin ?? ''} />
          </Field>
          <Field label="Maximum salary">
            <TextInput name="salaryMax" type="number" defaultValue={application.salaryMax ?? ''} />
          </Field>
          <Field label="Currency">
            <TextInput name="currency" defaultValue={application.currency} maxLength={3} />
          </Field>
        </div>
        <Field label="Link">
          <TextInput name="jobUrl" defaultValue={application.jobUrl} />
        </Field>
        <Field label="Location">
          <TextInput name="location" defaultValue={application.location} />
        </Field>
        <Field label="Source">
          <TextInput name="source" defaultValue={application.source} />
        </Field>
        <Field label="Deadline">
          <TextInput name="deadlineAt" type="datetime-local" defaultValue={toLocalInput(application.deadlineAt)} />
        </Field>
        <Field label="Interview">
          <TextInput name="interviewAt" type="datetime-local" defaultValue={toLocalInput(application.interviewAt)} />
        </Field>
        <Field label="Notes">
          <TextArea name="notes" defaultValue={application.notes} />
        </Field>
        <Field label="Job description">
          <TextArea name="jobDescription" defaultValue={application.jobDescription} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save application</Button>
          <Link className="px-3 py-2 text-sm underline" to={`/app/tailor?applicationId=${application.id}`}>
            Tailor a resume
          </Link>
          <Link className="px-3 py-2 text-sm underline" to={`/app/interviews?applicationId=${application.id}`}>
            Prepare interview
          </Link>
        </div>
      </form>
      <aside className="space-y-6">
        <Contacts applicationId={application.id} contacts={application.contacts} onChange={reload} />
        <section>
          <h2 className="mb-2 text-xl">Timeline</h2>
          <NoteForm applicationId={application.id} onChange={reload} />
          <ol className="mt-3 space-y-3">
            {application.events.map((item) => (
              <li key={item.id} className="border-l-2 border-pine pl-3">
                <p className="font-medium">{item.title}</p>
                {item.body ? <p className="text-sm">{item.body}</p> : null}
                <p className="text-xs text-muted">{new Date(item.occurredAt).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  )
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return Number(text)
}

function Contacts({
  applicationId,
  contacts,
  onChange,
}: {
  applicationId: string
  contacts: Detail['contacts']
  onChange: () => Promise<void>
}) {
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  async function add(event: FormEvent) {
    event.preventDefault()
    try {
      await api(`/api/applications/${applicationId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      })
      setName('')
      setEmail('')
      notify('Contact added.')
      await onChange()
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not add the contact.', 'error')
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-xl">Contacts</h2>
      <ul className="mb-3 space-y-2 text-sm">
        {contacts.length === 0 ? <li>No contacts yet.</li> : null}
        {contacts.map((contact) => (
          <li key={contact.id}>
            {contact.name}
            {contact.email ? ` · ${contact.email}` : ''}
          </li>
        ))}
      </ul>
      <form className="space-y-2" onSubmit={add}>
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Button type="submit" variant="quiet">
          Add contact
        </Button>
      </form>
    </section>
  )
}

function NoteForm({ applicationId, onChange }: { applicationId: string; onChange: () => Promise<void> }) {
  const { notify } = useToast()
  const [body, setBody] = useState('')
  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await api(`/api/applications/${applicationId}/events`, { method: 'POST', body: JSON.stringify({ body }) })
    setBody('')
    notify('Note added.')
    await onChange()
  }
  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <Field label="Add a note">
        <TextArea value={body} onChange={(event) => setBody(event.target.value)} required />
      </Field>
      <Button type="submit" variant="quiet">
        Add note
      </Button>
    </form>
  )
}
