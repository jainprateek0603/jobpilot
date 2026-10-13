import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { AppError } from '../src/lib/errors.js'
import { extractListing } from '../src/lib/html-job.js'
import { assertPublicHttpUrl, fetchPublicHtml, isPrivateAddress } from '../src/lib/ssrf.js'
import { parseModelJson, prepareFeedbackPayload, prepareTailorPayload } from '../src/ai/json.js'
import { between, significantWords } from '../src/ai/keywords.js'
import { loadPrompt, promptNames, renderPrompt } from '../src/ai/prompts.js'
import { createAnthropicProvider } from '../src/ai/anthropic.js'
import { MockProvider } from '../src/ai/mock.js'
import { createProvider } from '../src/ai/index.js'
import { createOpenAIProvider } from '../src/ai/openai.js'
import { errorHandler } from '../src/middleware/error.js'
import { resetSchedulerForTests, startScheduler } from '../src/jobs/scheduler.js'
import type { Config } from '../src/config.js'
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ZodError, z } from 'zod'
import { Prisma } from '@prisma/client'

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'file:./unused.db',
  JWT_ACCESS_SECRET: 'test-access-secret-32-characters-min',
  JWT_REFRESH_SECRET: 'test-refresh-secret-32-characters-min',
  AI_PROVIDER: 'mock',
  BCRYPT_ROUNDS: '4',
  RATE_LIMIT_DISABLED: 'true',
} as NodeJS.ProcessEnv

describe('config', () => {
  it('rejects a short secret and enables secure cookies in production', () => {
    expect(() => loadConfig({ ...baseEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(/Invalid configuration/)
    const production = loadConfig({ ...baseEnv, NODE_ENV: 'production' })
    expect(production.cookieSecure).toBe(true)
    const forced = loadConfig({ ...baseEnv, COOKIE_SECURE: 'false', TRUST_PROXY: 'true' })
    expect(forced.cookieSecure).toBe(false)
    expect(forced.trustProxy).toBe(true)
  })
})

describe('ssrf', () => {
  it('blocks private and local addresses', async () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true)
    expect(isPrivateAddress('10.1.1.1')).toBe(true)
    expect(isPrivateAddress('192.168.1.9')).toBe(true)
    expect(isPrivateAddress('172.16.0.1')).toBe(true)
    expect(isPrivateAddress('169.254.1.1')).toBe(true)
    expect(isPrivateAddress('100.64.0.1')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateAddress('not-an-ip')).toBe(true)
    await expect(assertPublicHttpUrl('http://127.0.0.1/jobs')).rejects.toBeInstanceOf(AppError)
    await expect(assertPublicHttpUrl('http://localhost/jobs')).rejects.toBeInstanceOf(AppError)
    await expect(assertPublicHttpUrl('file:///etc/passwd')).rejects.toBeInstanceOf(AppError)
    await expect(assertPublicHttpUrl('http://user:pass@example.com')).rejects.toBeInstanceOf(AppError)
    await expect(assertPublicHttpUrl('not a url')).rejects.toBeInstanceOf(AppError)
    await expect(assertPublicHttpUrl('http://jobs.example', async () => [{ address: '10.0.0.8' }])).rejects.toBeInstanceOf(AppError)
    await expect(assertPublicHttpUrl('http://jobs.example', async () => {
      throw new Error('dns')
    })).rejects.toMatchObject({ code: 'LINK_UNREADABLE' })
    const ok = await assertPublicHttpUrl('http://jobs.example/role', async () => [{ address: '8.8.8.8' }])
    expect(ok.hostname).toBe('jobs.example')
  })

  it('follows a public redirect and stops a private one', async () => {
    const lookupFn = async () => [{ address: '8.8.8.8' }]
    const html = await fetchPublicHtml('http://jobs.example/start', {
      lookupFn,
      fetchFn: async () =>
        new Response('<html><title>Editor at Lumen</title></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    expect(html).toContain('Editor')
    await expect(
      fetchPublicHtml('http://jobs.example/go', {
        lookupFn,
        fetchFn: async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }),
      }),
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      fetchPublicHtml('http://jobs.example/missing', {
        lookupFn,
        fetchFn: async () => new Response('no', { status: 404 }),
      }),
    ).rejects.toMatchObject({ code: 'LINK_UNREADABLE' })
    await expect(
      fetchPublicHtml('http://jobs.example/big', {
        lookupFn,
        fetchFn: async () => new Response('x', { status: 200, headers: { 'content-length': '900000' } }),
      }),
    ).rejects.toMatchObject({ message: 'That page is too large to read' })
  })
})

describe('html listing', () => {
  it('reads JSON-LD, Open Graph, and a plain title', () => {
    expect(
      extractListing(
        '<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Editor","hiringOrganization":{"name":"Lumen &amp; Co"}}]}</script>',
      ),
    ).toEqual({ company: 'Lumen & Co', role: 'Editor' })
    expect(extractListing('<meta property="og:title" content="Writer at Harbor">')).toEqual({
      company: 'Harbor',
      role: 'Writer',
    })
    expect(extractListing('<title>Just a title</title>')).toEqual({ company: '', role: 'Just a title' })
    expect(extractListing('<script type="application/ld+json">{nope}</script><title></title>')).toEqual({
      company: '',
      role: '',
    })
  })
})

describe('ai helpers', () => {
  it('parses fenced JSON and scores keywords', () => {
    expect(parseModelJson('sure ```json\n{"ok":true}\n```')).toEqual({ ok: true })
    expect(() => parseModelJson('no json')).toThrow(AppError)
    expect(() => parseModelJson('{broken')).toThrow(AppError)
    expect(prepareTailorPayload({ matchScore: '72.4' })).toMatchObject({ matchScore: 72 })
    expect(prepareFeedbackPayload({ score: 11 })).toMatchObject({ score: 10 })
    expect(prepareTailorPayload(null)).toBeNull()
    expect(significantWords('TypeScript and the TypeScript team')).toContain('typescript')
    expect(between('A START inner END B', 'START', 'END')).toBe('inner')
    expect(between('nothing', 'START', 'END')).toBe('')
  })

  it('loads every prompt and the mock returns JSON for each task', async () => {
    for (const name of promptNames()) {
      const prompt = loadPrompt(name)
      expect(prompt.text).toContain(`jobpilot:${name}`)
      expect(renderPrompt('Hello {{name}}', { name: 'Ada' })).toBe('Hello Ada')
    }
    const provider = new MockProvider()
    const tailor = loadPrompt('tailor-resume')
    const tailored = JSON.parse(
      await provider.complete({
        system: '',
        user: renderPrompt(tailor.text, {
          resume: 'I build internal tools with TypeScript and React.',
          jobDescription: 'We need Kubernetes, GraphQL, and TypeScript.',
          company: 'Northwind',
          role: 'Engineer',
        }),
      }),
    )
    expect(tailored.matchScore).toBeGreaterThan(0)
    expect(tailored.missingKeywords).toContain('kubernetes')
    const letter = JSON.parse(
      await provider.complete({ system: '', user: renderPrompt(loadPrompt('cover-letter').text, { tone: 'warm', company: 'Harbor', role: 'Designer', resume: 'React systems', jobDescription: 'Design systems' }) }),
    )
    expect(letter.content).toContain('Harbor')
    const questions = JSON.parse(await provider.complete({ system: '', user: loadPrompt('interview-questions').text }))
    expect(questions.questions).toHaveLength(5)
    const feedback = JSON.parse(
      await provider.complete({
        system: '',
        user: 'jobpilot:answer-feedback\nQUESTION: Tell me about TypeScript\nANSWER_START\nI shipped a TypeScript tool with my team and we cut review time.\nANSWER_END',
      }),
    )
    expect(feedback.score).toBeGreaterThanOrEqual(1)
    const follow = JSON.parse(
      await provider.complete({
        system: '',
        user: 'jobpilot:follow-up-email\nCANDIDATE: Ada\nCOMPANY: Lumen\nROLE: Engineer\nNOTE: Sent a sample',
      }),
    )
    expect(follow.subject).toContain('Lumen')
    const matched = JSON.parse(
      await provider.complete({
        system: '',
        user: renderPrompt(loadPrompt('tailor-resume').text, {
          resume: 'kubernetes graphql typescript',
          jobDescription: 'kubernetes graphql typescript',
          company: '',
          role: '',
        }),
      }),
    ) as { matchScore: number; resume: string }
    expect(matched.matchScore).toBe(100)
    expect(matched.resume).toContain('already covered')
    const fallback = JSON.parse(
      await provider.complete({
        system: '',
        user: 'jobpilot:cover-letter\nTONE: playful\nCOMPANY: \nROLE: \nRESUME_START\n\nRESUME_END\nJOB_START\n\nJOB_END',
      }),
    ) as { content: string }
    expect(fallback.content.length).toBeGreaterThan(10)
    const plainFollow = JSON.parse(
      await provider.complete({ system: '', user: 'jobpilot:follow-up-email\nCANDIDATE: \nCOMPANY: \nROLE: \nNOTE: ' }),
    ) as { subject: string; body: string }
    expect(plainFollow.subject).toContain('the role')
    expect(plainFollow.body).toContain('anything else')
    await expect(provider.complete({ system: '', user: 'unknown' })).rejects.toBeInstanceOf(AppError)
  })

  it('calls OpenAI and Anthropic through an injected fetch', async () => {
    const config = {
      ...loadConfig(baseEnv),
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
      ANTHROPIC_API_KEY: 'ak-test',
    } as Config
    const fetchFn = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 })
    expect(await createOpenAIProvider(config, fetchFn).complete({ system: 's', user: 'u' })).toContain('ok')
    const anthropicFetch = async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }] }), { status: 200 })
    expect(await createAnthropicProvider({ ...config, AI_PROVIDER: 'anthropic' }, anthropicFetch).complete({ system: 's', user: 'u' })).toContain('ok')
    await expect(createOpenAIProvider({ ...config, OPENAI_API_KEY: '' }, fetchFn).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ status: 503 })
    const failing = async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 })
    await expect(createOpenAIProvider(config, failing).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ status: 502 })
    const empty = async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 })
    await expect(createOpenAIProvider(config, empty).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ status: 502 })
    await expect(createAnthropicProvider({ ...config, ANTHROPIC_API_KEY: '' }, anthropicFetch).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ status: 503 })
    const emptyAnthropic = async () => new Response(JSON.stringify({ content: [] }), { status: 200 })
    await expect(createAnthropicProvider(config, emptyAnthropic).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ status: 502 })
    const badAnthropic = async () => new Response(JSON.stringify({ error: { message: 'nope' } }), { status: 500 })
    await expect(createAnthropicProvider(config, badAnthropic).complete({ system: 's', user: 'u' })).rejects.toMatchObject({ status: 502 })
    expect(createProvider({ ...config, AI_PROVIDER: 'openai' }, fetchFn).name).toBe('openai')
    expect(createProvider({ ...config, AI_PROVIDER: 'anthropic' }, anthropicFetch).name).toBe('anthropic')
    expect(createProvider({ ...config, AI_PROVIDER: 'mock' }).name).toBe('mock')
  })
})

describe('error handler', () => {
  function capture() {
    const result: { status?: number; body?: unknown } = {}
    const res = {
      status(code: number) {
        result.status = code
        return this
      },
      json(body: unknown) {
        result.body = body
        return this
      },
    } as unknown as Response
    return { res, result }
  }

  it('maps known errors and hides unexpected ones', () => {
    const appError = capture()
    errorHandler(new AppError(404, 'NOT_FOUND', 'Missing', { id: ['Missing'] }), {} as Request, appError.res, (() => undefined) as NextFunction)
    expect(appError.result.status).toBe(404)
    const zod = capture()
    errorHandler(new ZodError(z.string().safeParse(1).error?.issues ?? []), {} as Request, zod.res, (() => undefined) as NextFunction)
    expect(zod.result.status).toBe(400)
    const upload = capture()
    errorHandler(new multer.MulterError('LIMIT_FILE_SIZE'), {} as Request, upload.res, (() => undefined) as NextFunction)
    expect(upload.result.body).toMatchObject({ error: { message: 'Upload a file smaller than 5 MB' } })
    const syntax = capture()
    const broken = new SyntaxError('bad') as SyntaxError & { body: true }
    broken.body = true
    errorHandler(broken, {} as Request, syntax.res, (() => undefined) as NextFunction)
    expect(syntax.result.status).toBe(400)
    const unique = capture()
    const prismaError = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' })
    errorHandler(prismaError, {} as Request, unique.res, (() => undefined) as NextFunction)
    expect(unique.result.status).toBe(409)
    const file = capture()
    errorHandler(new Error('Upload a PDF, text, or Markdown file'), {} as Request, file.res, (() => undefined) as NextFunction)
    expect(file.result.status).toBe(400)
    const unknown = capture()
    errorHandler(new Error('boom'), {} as Request, unknown.res, (() => undefined) as NextFunction)
    expect(unknown.result.body).toMatchObject({ error: { message: 'Something went wrong' } })
  })
})

describe('scheduler', () => {
  it('starts once and runs the tick callback', async () => {
    resetSchedulerForTests()
    let calls = 0
    startScheduler(((expression: string, task: string | (() => void)) => {
      expect(expression).toBe('* * * * *')
      if (typeof task === 'function') task()
      calls += 1
      return { start() {}, stop() {} } as never
    }) as never)
    startScheduler()
    expect(calls).toBe(1)
    resetSchedulerForTests()
  })
})

describe('schema parity', () => {
  it('keeps the postgres schema aligned with sqlite', () => {
    const root = path.resolve('prisma')
    const normalize = (file: string) =>
      readFileSync(path.join(root, file), 'utf8')
        .replaceAll('provider = "sqlite"', 'provider = "db"')
        .replaceAll('provider = "postgresql"', 'provider = "db"')
        .replaceAll('\r\n', '\n')
    expect(normalize('schema.postgres.prisma')).toBe(normalize('schema.prisma'))
  })
})
