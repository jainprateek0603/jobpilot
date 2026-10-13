import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, api } from '../lib/api'
import { useToast } from '../lib/toast'
import { Button, EmptyState, Field, Spinner, TextArea, TextInput } from '../components/ui'

type Resume = { id: string; title: string; content: string; isDefault: boolean; fileName: string }

export function ResumesPage() {
  const { notify } = useToast()
  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  async function load() {
    setResumes(await api<Resume[]>('/api/resumes'))
  }

  useEffect(() => {
    load().catch(() => notify('Resumes could not be loaded.', 'error'))
  }, [notify])

  async function create(event: FormEvent) {
    event.preventDefault()
    try {
      await api('/api/resumes', { method: 'POST', body: JSON.stringify({ title, content }) })
      setTitle('')
      setContent('')
      notify('Resume saved.')
      await load()
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not save the resume.', 'error')
    }
  }

  async function upload(file: File) {
    const body = new FormData()
    body.set('file', file)
    body.set('title', file.name.replace(/\.[^.]+$/, ''))
    await api('/api/resumes/upload', { method: 'POST', body })
    notify('Resume uploaded.')
    await load()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="mb-4 text-3xl">Resumes</h1>
        {resumes === null ? <Spinner label="Loading resumes" /> : null}
        {resumes?.length === 0 ? <EmptyState title="Add a resume to tailor it later." /> : null}
        <ul className="space-y-3">
          {resumes?.map((resume) => (
            <li key={resume.id} className="border border-line p-3 dark:border-[#2C3B34]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">
                  {resume.title}
                  {resume.isDefault ? ' · default' : ''}
                </h2>
                <Button
                  variant="quiet"
                  type="button"
                  onClick={() =>
                    void api(`/api/resumes/${resume.id}`, { method: 'DELETE' }).then(load).then(() => notify('Resume deleted.'))
                  }
                >
                  Delete
                </Button>
              </div>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap font-serif text-sm">{resume.content}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-4">
        <form className="space-y-3" onSubmit={create}>
          <h2 className="text-xl">Paste text</h2>
          <Field label="Title">
            <TextInput required value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Resume text">
            <TextArea required value={content} onChange={(event) => setContent(event.target.value)} />
          </Field>
          <Button type="submit">Save resume</Button>
        </form>
        <form>
          <h2 className="mb-2 text-xl">Upload a file</h2>
          <input
            aria-label="Resume file"
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file).catch((error: unknown) => notify(error instanceof ApiError ? error.message : 'Upload failed.', 'error'))
            }}
          />
          <p className="mt-2 text-sm text-muted">PDF, text, or Markdown. Up to 5 MB.</p>
        </form>
      </section>
    </div>
  )
}
