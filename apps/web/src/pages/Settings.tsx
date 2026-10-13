import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import { useAuth, type SessionUser } from '../lib/auth'
import { useTheme, type ThemeChoice } from '../lib/theme'
import { useToast } from '../lib/toast'
import { Button, Field, SelectInput, TextInput } from '../components/ui'

const zones = ['UTC', 'America/Los_Angeles', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney']

export function SettingsPage() {
  const { user, setUser, signOut } = useAuth()
  const { setTheme } = useTheme()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<SessionUser | null>(user)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    setProfile(user)
  }, [user])

  if (!profile) return null

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    try {
      const saved = await api<SessionUser>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name,
          headline: profile.headline,
          location: profile.location,
          phone: profile.phone,
          linkedinUrl: profile.linkedinUrl,
          websiteUrl: profile.websiteUrl,
        }),
      })
      const settings = await api<SessionUser>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          theme: profile.theme,
          timezone: profile.timezone,
          emailReminders: profile.emailReminders,
        }),
      })
      setUser(settings.id ? { ...saved, ...settings } : saved)
      setTheme(profile.theme)
      notify('Settings saved.')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not save settings.', 'error')
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      notify('Password changed. Sign in again.')
      await signOut()
      navigate('/login')
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not change the password.', 'error')
    }
  }

  function update<K extends keyof SessionUser>(key: K, value: SessionUser[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current))
  }

  return (
    <div className="grid max-w-3xl gap-10">
      <form className="space-y-3" onSubmit={saveProfile}>
        <h1 className="text-3xl">Settings</h1>
        <Field label="Name">
          <TextInput value={profile.name} onChange={(event) => update('name', event.target.value)} required />
        </Field>
        <Field label="Headline">
          <TextInput value={profile.headline} onChange={(event) => update('headline', event.target.value)} />
        </Field>
        <Field label="Location">
          <TextInput value={profile.location} onChange={(event) => update('location', event.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={profile.phone} onChange={(event) => update('phone', event.target.value)} />
        </Field>
        <Field label="LinkedIn">
          <TextInput value={profile.linkedinUrl} onChange={(event) => update('linkedinUrl', event.target.value)} />
        </Field>
        <Field label="Website">
          <TextInput value={profile.websiteUrl} onChange={(event) => update('websiteUrl', event.target.value)} />
        </Field>
        <Field label="Timezone">
          <SelectInput value={profile.timezone} onChange={(event) => update('timezone', event.target.value)}>
            {!zones.includes(profile.timezone) ? <option value={profile.timezone}>{profile.timezone}</option> : null}
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Theme">
          <SelectInput value={profile.theme} onChange={(event) => update('theme', event.target.value as ThemeChoice)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </SelectInput>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.emailReminders}
            onChange={(event) => update('emailReminders', event.target.checked)}
          />
          Email me when a reminder is due
        </label>
        <Button type="submit">Save profile</Button>
      </form>
      <form className="space-y-3" onSubmit={changePassword}>
        <h2 className="text-xl">Password</h2>
        <Field label="Current password">
          <TextInput type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </Field>
        <Field label="New password">
          <TextInput type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={10} />
        </Field>
        <Button type="submit" variant="quiet">
          Change password
        </Button>
      </form>
    </div>
  )
}
