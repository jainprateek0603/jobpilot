import { COVER_TONES, TONE_LABELS, type CoverTone } from '@jobpilot/shared'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useToast } from '../lib/toast'
import { Button, Field, SelectInput, Spinner, TextArea, TextInput } from '../components/ui'

type Resume = { id: string; title: string; isDefault: boolean }
type ApplicationOption = { id: string; company: string; role: string; jobDescription?: string }
type Tailored = { id: string; content: string; matchScore: number; missingKeywords: string[] }
type Letter = { id: string; content: string; tone: string }

export function TailorPage() {
  const { notify } = useToast()
  const [params] = useSearchParams()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumeId, setResumeId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [result, setResult] = useState<Tailored | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void api<Resume[]>('/api/resumes').then((rows) => {
      setResumes(rows)
      const preferred = rows.find((row) => row.isDefault) ?? rows[0]
      if (preferred) setResumeId(preferred.id)
    })
    const applicationId = params.get('applicationId')
    if (!applicationId) return
    void api<ApplicationOption & { jobDescription: string }>(`/api/applications/${applicationId}`).then((application) => {
      if (application.jobDescription) setJobDescription(application.jobDescription)
    })
  }, [params])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      const tailored = await api<Tailored>('/api/ai/tailor', {
        method: 'POST',
        body: JSON.stringify({
          resumeId,
          jobDescription,
          applicationId: params.get('applicationId') || undefined,
        }),
      })
      setResult(tailored)
      notify('Tailored resume saved.')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not tailor the resume.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="space-y-3" onSubmit={onSubmit}>
        <h1 className="text-3xl">Tailor a resume</h1>
        {resumes.length === 0 ? <p>Add a resume first.</p> : null}
        <Field label="Resume">
          <SelectInput value={resumeId} onChange={(event) => setResumeId(event.target.value)} required>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Job description">
          <TextArea required value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending || !resumeId}>
          {pending ? 'Tailoring…' : 'Generate tailored resume'}
        </Button>
      </form>
      {result ? (
        <article>
          <h2 className="text-xl">Match score {result.matchScore}%</h2>
          {result.missingKeywords.length ? (
            <p className="mt-2 text-sm">Missing keywords: {result.missingKeywords.join(', ')}</p>
          ) : (
            <p className="mt-2 text-sm">No missing keywords from the posting.</p>
          )}
          <pre className="mt-4 whitespace-pre-wrap font-serif text-sm">{result.content}</pre>
        </article>
      ) : null}
    </div>
  )
}

export function CoverLetterPage() {
  const { notify } = useToast()
  const [tone, setTone] = useState<CoverTone>('professional')
  const [jobDescription, setJobDescription] = useState('')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumeId, setResumeId] = useState('')
  const [letter, setLetter] = useState<Letter | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void api<Resume[]>('/api/resumes').then((rows) => {
      setResumes(rows)
      const preferred = rows.find((row) => row.isDefault) ?? rows[0]
      if (preferred) setResumeId(preferred.id)
    })
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      const created = await api<Letter>('/api/ai/cover-letter', {
        method: 'POST',
        body: JSON.stringify({ tone, jobDescription, resumeId: resumeId || undefined }),
      })
      setLetter(created)
      notify('Cover letter saved.')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not write the letter.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="space-y-3" onSubmit={onSubmit}>
        <h1 className="text-3xl">Cover letter</h1>
        <Field label="Tone">
          <SelectInput value={tone} onChange={(event) => setTone(event.target.value as CoverTone)}>
            {COVER_TONES.map((item) => (
              <option key={item} value={item}>
                {TONE_LABELS[item]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Resume">
          <SelectInput value={resumeId} onChange={(event) => setResumeId(event.target.value)}>
            <option value="">No resume</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Job description">
          <TextArea required value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Writing…' : 'Generate cover letter'}
        </Button>
      </form>
      {letter ? (
        <article>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">{TONE_LABELS[letter.tone as CoverTone] ?? letter.tone}</h2>
            <Button
              variant="quiet"
              type="button"
              onClick={() => void navigator.clipboard.writeText(letter.content).then(() => notify('Copied.'))}
            >
              Copy
            </Button>
          </div>
          <pre className="whitespace-pre-wrap font-serif text-sm">{letter.content}</pre>
        </article>
      ) : null}
    </div>
  )
}

export function InterviewPage() {
  const { notify } = useToast()
  const [params] = useSearchParams()
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [prep, setPrep] = useState<Prep | null>(null)
  const [questionId, setQuestionId] = useState('')
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const applicationId = params.get('applicationId')
    if (!applicationId) return
    void api<{ role: string; company: string; jobDescription: string }>(`/api/applications/${applicationId}`).then((application) => {
      setRole(application.role)
      setCompany(application.company)
      setJobDescription(application.jobDescription)
    })
  }, [params])

  async function generate(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const created = await api<Prep>('/api/ai/interview-prep', {
        method: 'POST',
        body: JSON.stringify({
          role,
          company,
          jobDescription,
          applicationId: params.get('applicationId') || undefined,
        }),
      })
      setPrep(created)
      setQuestionId(created.questions[0]?.id ?? '')
      notify('Questions saved.')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not prepare questions.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function practice(event: FormEvent) {
    event.preventDefault()
    if (!prep) return
    setPending(true)
    try {
      const result = await api<{ score: number; feedback: string }>(`/api/ai/interview-prep/${prep.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ questionId, answer }),
      })
      setFeedback(result)
      notify('Feedback saved.')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not score that answer.', 'error')
    } finally {
      setPending(false)
    }
  }

  const question = prep?.questions.find((item) => item.id === questionId)

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="space-y-3" onSubmit={generate}>
        <h1 className="text-3xl">Interview prep</h1>
        <Field label="Role">
          <TextInput required value={role} onChange={(event) => setRole(event.target.value)} />
        </Field>
        <Field label="Company">
          <TextInput value={company} onChange={(event) => setCompany(event.target.value)} />
        </Field>
        <Field label="Job description">
          <TextArea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
        </Field>
        <Button type="submit" disabled={loading}>
          {loading ? 'Preparing…' : 'Generate questions'}
        </Button>
      </form>
      {prep ? (
        <form className="space-y-3" onSubmit={practice}>
          <Field label="Question">
            <SelectInput value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
              {prep.questions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.question}
                </option>
              ))}
            </SelectInput>
          </Field>
          {question?.tips ? <p className="text-sm text-muted">{question.tips}</p> : null}
          <Field label="Your answer">
            <TextArea required value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Reviewing…' : 'Get feedback'}
          </Button>
          {feedback ? (
            <p>
              Score {feedback.score} / 10. {feedback.feedback}
            </p>
          ) : null}
        </form>
      ) : loading ? (
        <Spinner label="Writing questions" />
      ) : null}
    </div>
  )
}

type Prep = {
  id: string
  questions: { id: string; question: string; tips: string }[]
}
