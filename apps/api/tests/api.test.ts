import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { extractResumeText } from '../src/lib/resume-text.js'
import { app, auth, register } from './helpers.js'

describe('auth and profile', () => {
  it('registers, refreshes, rejects reuse, and updates the profile', async () => {
    const bad = await request(app).post('/api/auth/register').send({ email: 'nope', password: 'short', name: '' })
    expect(bad.status).toBe(400)

    const email = `ada-${Date.now()}@example.com`
    const password = 'Password123'
    const created = await request(app).post('/api/auth/register').send({ email, password, name: 'Ada Lovelace' })
    expect(created.status).toBe(201)
    expect(created.body.data.accessToken).toBeTruthy()
    const cookie = created.headers['set-cookie']
    expect(cookie?.[0]).toContain('jobpilot_refresh')

    const duplicate = await request(app).post('/api/auth/register').send({ email, password, name: 'Ada' })
    expect(duplicate.status).toBe(409)

    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'Password999' })
    expect(wrong.status).toBe(401)
    const missing = await request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'Password123' })
    expect(missing.status).toBe(401)

    const me = await request(app).get('/api/auth/me').set(auth(created.body.data.accessToken))
    expect(me.body.data.email).toBe(email)

    const forbidden = await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', cookie)
    expect(forbidden.status).toBe(403)

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refreshed.status).toBe(200)
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(reuse.status).toBe(401)
    const family = await request(app).post('/api/auth/refresh').set('Cookie', refreshed.headers['set-cookie'])
    expect(family.status).toBe(401)

    const loggedIn = await request(app).post('/api/auth/login').send({ email, password })
    const changed = await request(app)
      .post('/api/auth/change-password')
      .set(auth(loggedIn.body.data.accessToken))
      .send({ currentPassword: 'nope-pass1', newPassword: 'Password4567' })
    expect(changed.status).toBe(400)
    const next = await request(app)
      .post('/api/auth/change-password')
      .set(auth(loggedIn.body.data.accessToken))
      .set('Cookie', loggedIn.headers['set-cookie'])
      .send({ currentPassword: password, newPassword: 'Password4567' })
    expect(next.status).toBe(200)
    const oldRefresh = await request(app).post('/api/auth/refresh').set('Cookie', loggedIn.headers['set-cookie'])
    expect(oldRefresh.status).toBe(401)

    const again = await request(app).post('/api/auth/login').send({ email, password: 'Password4567' })
    const token = again.body.data.accessToken as string
    const profile = await request(app).patch('/api/profile').set(auth(token)).send({
      name: 'Ada L',
      headline: 'Engineer',
      location: 'London',
      phone: '555',
      linkedinUrl: 'https://linkedin.example/ada',
      websiteUrl: '',
    })
    expect(profile.body.data.headline).toBe('Engineer')
    const settings = await request(app).patch('/api/settings').set(auth(token)).send({
      theme: 'dark',
      timezone: 'Asia/Kolkata',
      emailReminders: false,
    })
    expect(settings.body.data.theme).toBe('dark')
    const badZone = await request(app).patch('/api/settings').set(auth(token)).send({
      theme: 'light',
      timezone: 'Not/AZone',
      emailReminders: true,
    })
    expect(badZone.status).toBe(400)
    const loggedOut = await request(app).post('/api/auth/logout').set('Cookie', again.headers['set-cookie'])
    expect(loggedOut.body.data.ok).toBe(true)
    expect((await request(app).get('/api/health')).body.data.ok).toBe(true)
    expect((await request(app).get('/api/missing')).status).toBe(404)
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
  })
})

it('resets a password from a one-time link', async () => {
    const email = `reset-${Date.now()}@example.com`
    await request(app).post('/api/auth/register').send({ email, password: 'Password123', name: 'Ada' })
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' })
    expect(unknown.status).toBe(200)
    expect(unknown.body.data.resetUrl).toBeUndefined()
    const asked = await request(app).post('/api/auth/forgot-password').send({ email })
    expect(asked.body.data.message).toMatch(/reset the password/)
    const token = new URL(asked.body.data.resetUrl as string).searchParams.get('token')
    const reset = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Password4567' })
    expect(reset.status).toBe(200)
    expect((await request(app).post('/api/auth/login').send({ email, password: 'Password123' })).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email, password: 'Password4567' })).status).toBe(200)
    expect((await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Password89012' })).status).toBe(400)
  })

describe('applications', () => {
  it('tracks a role, moves it, and keeps other people out', async () => {
    const owner = await register()
    const other = await register('Grace')
    const created = await request(app).post('/api/applications').set(auth(owner.token)).send({
      company: 'Northwind',
      role: 'Platform Engineer',
      salaryMin: 100,
      salaryMax: 10,
    })
    expect(created.status).toBe(400)

    const saved = await request(app).post('/api/applications').set(auth(owner.token)).send({
      company: 'Northwind',
      role: 'Platform Engineer',
      salaryMin: 120000,
      salaryMax: 150000,
      jobUrl: 'https://jobs.example/1',
      jobDescription: 'TypeScript platform work with Kubernetes.',
      deadlineAt: '2026-12-01',
    })
    expect(saved.status).toBe(201)
    const id = saved.body.data.id as string
    expect(saved.body.data.status).toBe('WISHLIST')

    expect((await request(app).get(`/api/applications/${id}`).set(auth(other.token))).status).toBe(404)

    const listed = await request(app).get('/api/applications').query({ q: 'north' }).set(auth(owner.token))
    expect(listed.body.meta.total).toBe(1)

    const moved = await request(app).patch(`/api/applications/${id}`).set(auth(owner.token)).send({ status: 'APPLIED' })
    expect(moved.body.data.status).toBe('APPLIED')
    expect(moved.body.data.appliedAt).toBeTruthy()

    const second = await request(app)
      .post('/api/applications')
      .set(auth(owner.token))
      .send({ company: 'Harbor', role: 'Designer', status: 'WISHLIST' })
    await request(app).post('/api/applications/reorder').set(auth(owner.token)).send({
      columns: [
        { status: 'WISHLIST', ids: [] },
        { status: 'INTERVIEW', ids: [id, second.body.data.id] },
      ],
    })
    const detail = await request(app).get(`/api/applications/${id}`).set(auth(owner.token))
    expect(detail.body.data.status).toBe('INTERVIEW')
    expect(detail.body.data.events.some((event: { type: string }) => event.type === 'status_change')).toBe(true)

    const contact = await request(app).post(`/api/applications/${id}/contacts`).set(auth(owner.token)).send({
      name: 'Mina Rao',
      email: 'mina@harbor.example',
      role: 'Manager',
    })
    expect(contact.status).toBe(201)
    const edited = await request(app).patch(`/api/contacts/${contact.body.data.id}`).set(auth(owner.token)).send({ phone: '555' })
    expect(edited.body.data.phone).toBe('555')
    expect((await request(app).patch(`/api/contacts/${contact.body.data.id}`).set(auth(other.token)).send({ phone: '1' })).status).toBe(404)

    const note = await request(app).post(`/api/applications/${id}/events`).set(auth(owner.token)).send({ body: 'Asked about on-call' })
    expect(note.body.data.title).toBe('Note')

    const parsed = await request(app).post('/api/applications/parse-link').set(auth(owner.token)).send({
      input: 'https://jobs.lever.co/spotify/senior-backend-engineer',
    })
    expect(parsed.body.data).toMatchObject({ company: 'Spotify', role: 'Senior Backend Engineer' })
    const blocked = await request(app).post('/api/applications/parse-link').set(auth(owner.token)).send({
      input: 'http://127.0.0.1/private',
      fetchPage: true,
    })
    expect(blocked.body.data.warning).toBeTruthy()

    const imported = await request(app)
      .post('/api/applications/import')
      .set(auth(owner.token))
      .send({ csv: 'company,role,status\nLumen,Writer,APPLIED\n,Bad,NOPE' })
    expect(imported.body.data.imported).toBe(1)
    expect(imported.body.data.errors).toHaveLength(1)
    const csv = await request(app).get('/api/applications/export').set(auth(owner.token))
    expect(csv.text).toContain('Northwind')
    expect(csv.headers['content-type']).toContain('text/csv')

    const analytics = await request(app).get('/api/analytics').set(auth(owner.token))
    expect(analytics.body.data.totals.interviews).toBeGreaterThan(0)
    const calendar = await request(app).get('/api/calendar').set(auth(owner.token)).query({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-12-31T00:00:00.000Z',
    })
    expect(calendar.body.data.deadlines.length).toBeGreaterThan(0)

    await request(app).delete(`/api/contacts/${contact.body.data.id}`).set(auth(owner.token))
    expect((await request(app).delete(`/api/applications/${second.body.data.id}`).set(auth(owner.token))).body.data.ok).toBe(true)
    expect((await request(app).patch(`/api/applications/${id}`).set(auth(owner.token)).send({})).status).toBe(400)
    expect((await request(app).post('/api/applications/reorder').set(auth(owner.token)).send({
      columns: [{ status: 'APPLIED', ids: [id, id] }],
    })).status).toBe(400)
  })
})

describe('resumes, ai, and reminders', () => {
  it('tailors a resume, practices an answer, and sends a due reminder', async () => {
    const owner = await register()
    const resume = await request(app).post('/api/resumes').set(auth(owner.token)).send({
      title: 'Base',
      content: 'I build internal tools with TypeScript and React. I mentored two interns.',
    })
    expect(resume.body.data.isDefault).toBe(true)
    const uploaded = await request(app)
      .post('/api/resumes/upload')
      .set(auth(owner.token))
      .attach('file', Buffer.from('Plain text resume about Go services.'), 'notes.txt')
      .field('title', 'Notes')
    expect(uploaded.status).toBe(201)
    expect(uploaded.body.data.content).toContain('Go services')
    const file = await request(app).get(`/api/resumes/${uploaded.body.data.id}/file`).set(auth(owner.token))
    expect(file.text).toContain('Go services')

    const application = await request(app).post('/api/applications').set(auth(owner.token)).send({
      company: 'Northwind',
      role: 'Platform Engineer',
      jobDescription: 'Kubernetes and GraphQL with TypeScript.',
    })
    const tailored = await request(app).post('/api/ai/tailor').set(auth(owner.token)).send({
      resumeId: resume.body.data.id,
      applicationId: application.body.data.id,
      jobDescription: 'We need Kubernetes, GraphQL, and TypeScript for platform work.',
    })
    expect(tailored.status).toBe(201)
    expect(tailored.body.data.missingKeywords).toEqual(expect.arrayContaining(['kubernetes', 'graphql']))
    expect((await request(app).get('/api/ai/tailored').set(auth(owner.token))).body.data).toHaveLength(1)
    expect((await request(app).get(`/api/ai/tailored/${tailored.body.data.id}`).set(auth(owner.token))).status).toBe(200)

    const letter = await request(app).post('/api/ai/cover-letter').set(auth(owner.token)).send({
      tone: 'confident',
      resumeId: resume.body.data.id,
      applicationId: application.body.data.id,
      jobDescription: 'Platform engineer role focused on TypeScript services.',
    })
    expect(letter.body.data.content).toContain('Northwind')
    expect((await request(app).get('/api/ai/cover-letters').set(auth(owner.token))).body.data).toHaveLength(1)

    const prep = await request(app).post('/api/ai/interview-prep').set(auth(owner.token)).send({
      role: 'Platform Engineer',
      company: 'Northwind',
      applicationId: application.body.data.id,
      jobDescription: 'Kubernetes platform work.',
    })
    expect(prep.body.data.questions).toHaveLength(5)
    const answer = await request(app)
      .post(`/api/ai/interview-prep/${prep.body.data.id}/answers`)
      .set(auth(owner.token))
      .send({
        questionId: prep.body.data.questions[0].id,
        answer: 'I shipped a TypeScript platform and we cut review time for the team.',
      })
    expect(answer.status).toBe(201)
    expect(answer.body.data.score).toBeGreaterThanOrEqual(1)
    const fetched = await request(app).get(`/api/ai/interview-prep/${prep.body.data.id}`).set(auth(owner.token))
    expect(fetched.body.data.questions[0].answers).toHaveLength(1)

    const due = new Date(Date.now() - 60_000).toISOString()
    const reminder = await request(app).post('/api/reminders').set(auth(owner.token)).send({
      title: 'Follow up with Northwind',
      body: 'Ask if they need a work sample.',
      dueAt: due,
      type: 'follow_up',
      applicationId: application.body.data.id,
    })
    expect(reminder.status).toBe(201)
    const ran = await request(app).post('/api/reminders/run').set(auth(owner.token))
    expect(ran.body.data.processed).toBe(1)
    const reminders = await request(app).get('/api/reminders').set(auth(owner.token))
    expect(reminders.body.data[0].status).toBe('sent')
    expect(reminders.body.data[0].emailBody).toContain('Northwind')
    const custom = await request(app).post('/api/reminders').set(auth(owner.token)).send({
      title: 'Review notes',
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      type: 'custom',
    })
    const dismissed = await request(app).patch(`/api/reminders/${custom.body.data.id}`).set(auth(owner.token)).send({ status: 'dismissed' })
    expect(dismissed.body.data.status).toBe('dismissed')
    expect((await request(app).patch(`/api/reminders/${custom.body.data.id}`).set(auth(owner.token)).send({ status: 'sent' })).status).toBe(400)
    expect((await request(app).delete(`/api/reminders/${custom.body.data.id}`).set(auth(owner.token))).body.data.ok).toBe(true)

    await request(app).delete(`/api/resumes/${resume.body.data.id}`).set(auth(owner.token))
    const remaining = await request(app).get('/api/resumes').set(auth(owner.token))
    expect(remaining.body.data[0].isDefault).toBe(true)
    expect(await extractResumeText('plain.txt', Buffer.from('hello resume'))).toBe('hello resume')
    await expect(extractResumeText('bad.exe', Buffer.from('x'))).rejects.toThrow(/PDF, text, or Markdown/)
    await expect(extractResumeText('bad.pdf', Buffer.from('not a pdf'))).rejects.toThrow(/not a PDF/)
  })
})

describe('extra app modes', () => {
  it('serves the built client and rate limits sign-in', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jobpilot-web-'))
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>JobPilot</title>')
    const web = createApp(loadConfig({ ...process.env, WEB_DIST: dir, NODE_ENV: 'production' }))
    const page = await request(web).get('/anywhere')
    expect(page.text).toContain('JobPilot')
    expect(page.headers['content-security-policy']).toBeTruthy()
    expect((await request(web).get('/api/health')).body.data.ok).toBe(true)

    const limited = createApp(
      loadConfig({
        ...process.env,
        NODE_ENV: 'test',
        WEB_DIST: '',
        RATE_LIMIT_DISABLED: 'false',
        AUTH_RATE_LIMIT_MAX: '2',
      }),
    )
    const body = { email: 'limit@example.com', password: 'Password123', name: 'Limit' }
    expect((await request(limited).post('/api/auth/register').send(body)).status).toBe(201)
    expect((await request(limited).post('/api/auth/login').send(body)).status).toBe(200)
    expect((await request(limited).post('/api/auth/login').send({ email: body.email, password: 'wrong-pass1' })).status).toBe(429)
  })
})
