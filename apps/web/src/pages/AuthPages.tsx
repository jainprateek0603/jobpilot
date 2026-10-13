import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Field, TextInput } from '../components/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app/board'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await signIn(email, password)
      navigate(from)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sign in failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame title="Sign in" alternate={{ href: '/register', label: 'Create account' }}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Email">
          <TextInput type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password" error={error}>
          <TextInput type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await signUp(name, email, password)
      navigate('/app/board')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame title="Create account" alternate={{ href: '/login', label: 'Sign in' }}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Name">
          <TextInput required value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password" error={error}>
          <TextInput type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <p className="text-sm text-muted">Use at least 10 characters, with a letter and a number.</p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthFrame>
  )
}

function AuthFrame({
  title,
  alternate,
  children,
}: {
  title: string
  alternate: { href: string; label: string }
  children: ReactNode
}) {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link to="/" className="mb-6 text-sm">
        JobPilot
      </Link>
      <h1 className="mb-6 text-3xl">{title}</h1>
      {children}
      <Link className="mt-6 text-sm underline" to={alternate.href}>
        {alternate.label}
      </Link>
    </main>
  )
}
