import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
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
      <Link className="mt-4 inline-block text-sm underline" to="/forgot-password">
        Forgot password
      </Link>
    </AuthFrame>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = await api<{ message: string; resetUrl?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(result.message)
      setResetUrl(result.resetUrl ?? '')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start a reset')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame title="Reset password" alternate={{ href: '/login', label: 'Sign in' }}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Email" error={error}>
          <TextInput type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      {message ? <p className="mt-4 text-sm">{message}</p> : null}
      {resetUrl ? (
        <p className="mt-2 text-sm">
          Mail is not configured on this server.{' '}
          <a className="underline" href={resetUrl}>
            Choose a new password
          </a>
        </p>
      ) : null}
    </AuthFrame>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      })
      navigate('/login')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset the password')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFrame title="Choose a new password" alternate={{ href: '/login', label: 'Sign in' }}>
      {token ? (
        <form className="space-y-4" onSubmit={onSubmit}>
          <Field label="New password" error={error}>
            <TextInput type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      ) : (
        <p>That reset link is invalid or expired.</p>
      )}
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
