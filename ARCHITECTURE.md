# JobPilot architecture

JobPilot is a job-search command center. A person tracks applications on a board, keeps resumes, tailors them to a posting, drafts cover letters, practices interview answers, and reviews how the search is moving.

## Folder structure

```
jobpilot/
  apps/
    api/                      Express API
      prisma/
        schema.prisma         SQLite (local, test, CI)
        schema.postgres.prisma
      prompts/v1/             Versioned AI prompts
      src/
        index.ts              Process entry: env, listen, cron
        app.ts                Express app factory
        config.ts
        routes/               HTTP adapters
        services/             Use cases and authorization
        middleware/
        ai/                   Provider interface and adapters
        jobs/                 Reminder scheduler
        lib/                  Prisma, tokens, errors, SSRF, mail
        seed/                 Demo data
      tests/
    web/                      Vite + React
      src/
        pages/
        components/
        lib/                  API client, auth, theme, board math
      e2e/                    Playwright specs live at repo /e2e
  packages/
    shared/                   Schemas and pure domain functions
  e2e/
  .github/workflows/ci.yml
  docker-compose.yml
  Dockerfile
```

Dependency direction: `web` and `api` may import `@jobpilot/shared`. Shared imports neither app. The web app talks only to HTTP. Prisma is an API detail.

## Runtime

| Mode | Web | API | Database |
| --- | --- | --- | --- |
| Local dev | Vite `:5173`, proxies `/api` | `tsx` `:4000` | SQLite file |
| Test | Vitest + jsdom, Playwright against Vite | Supertest, or listen for e2e | SQLite file per suite |
| Docker | Built assets served by Express | Node `:4000` | PostgreSQL 16 |

`GET /api/health` checks that the process and the database respond.

## Data model

All primary keys are cuid strings. Timestamps are UTC.

**User** — email (unique), password hash, name, headline, location, phone, LinkedIn, website, timezone, theme (`light` \| `dark` \| `system`), `emailReminders`.

**RefreshToken** — hashed `jti`, expiry, `revokedAt`, `replacedBy`, user agent, IP. Cascade delete with the user.

**Application** — user, company, role, status (`WISHLIST` \| `APPLIED` \| `INTERVIEW` \| `OFFER` \| `REJECTED`), `position`, optional salary min/max, currency, job URL, location, source, notes, job description, `appliedAt`, `deadlineAt`, `interviewAt`. Index on `(userId, status, position)`.

**Contact** — belongs to an application. Name, role, email, phone, notes.

**TimelineEvent** — application, type (`created`, `status_change`, `note`, `contact`, `reminder`, `tailor`, `cover_letter`, `interview`), title, body, `occurredAt`. Status changes store the new status in `body`.

**Resume** — user, title, plain-text content, original file name, mime type, stored basename, `isDefault`.

**TailoredResume** — user, resume, optional application, job description, content, match score 0–100, missing keywords (JSON text), provider name, prompt version.

**CoverLetter** — user, optional application, tone, content, job description, provider, prompt version.

**InterviewPrep** — user, optional application, role, company, provider, prompt version. **InterviewQuestion** children (question, category, tips, order). **PracticeAnswer** children (answer, feedback, score, provider).

**Reminder** — user, optional application, title, body, `dueAt`, type (`follow_up` \| `interview` \| `deadline` \| `custom`), status (`pending` \| `sent` \| `dismissed` \| `completed`), email subject and body, `sentAt`.

**EmailOutbox** — user, optional reminder, to, subject, body, delivery status (`sent` \| `stored` \| `skipped_opt_out` \| `failed`), error text.

Uploads live on disk under `UPLOAD_DIR`. The database stores the basename only.

## Auth

1. `POST /api/auth/register` and `POST /api/auth/login` verify the password, set the refresh cookie, and return an access token plus the public user.
2. Other routes require `Authorization: Bearer`.
3. `POST /api/auth/refresh` rotates the cookie.
4. `POST /api/auth/logout` revokes the presented refresh token.
5. `POST /api/auth/change-password` requires the current password and revokes refresh tokens.

Login failures use one message for unknown email and wrong password. Auth routes are rate limited, separately from a global API limit. Limits are skipped only when `RATE_LIMIT_DISABLED=true` (tests).

## API

JSON envelope: `{ "data": ... }` or `{ "error": { "code", "message", "fields?" } }`.

List endpoints include `meta` when they paginate (`page`, `pageSize`, `total`).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/refresh` | Rotate refresh token |
| POST | `/api/auth/logout` | Revoke refresh token |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/auth/me` | Current user summary |
| GET | `/api/profile` | Profile |
| PATCH | `/api/profile` | Update profile |
| PATCH | `/api/settings` | Theme, timezone, email reminders |
| GET | `/api/applications` | List (query, status, page) |
| POST | `/api/applications` | Create |
| GET | `/api/applications/export` | CSV download |
| POST | `/api/applications/import` | CSV import |
| POST | `/api/applications/parse-link` | Parse or fetch a job URL |
| POST | `/api/applications/reorder` | Move cards |
| GET | `/api/applications/:id` | Detail with contacts, events, reminders |
| PATCH | `/api/applications/:id` | Update |
| DELETE | `/api/applications/:id` | Delete |
| POST | `/api/applications/:id/contacts` | Add contact |
| PATCH | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Delete contact |
| POST | `/api/applications/:id/events` | Add a note |
| GET | `/api/resumes` | List resumes |
| POST | `/api/resumes` | Create from text |
| POST | `/api/resumes/upload` | PDF, txt, or md upload |
| GET | `/api/resumes/:id` | One resume |
| PATCH | `/api/resumes/:id` | Update, including default flag |
| DELETE | `/api/resumes/:id` | Delete resume and file |
| GET | `/api/resumes/:id/file` | Download original file |
| POST | `/api/ai/tailor` | Tailor a resume, persist result |
| GET | `/api/ai/tailored` | List tailored resumes |
| GET | `/api/ai/tailored/:id` | One tailored resume |
| POST | `/api/ai/cover-letter` | Generate a cover letter |
| GET | `/api/ai/cover-letters` | List cover letters |
| POST | `/api/ai/interview-prep` | Generate questions |
| GET | `/api/ai/interview-prep` | List sessions |
| GET | `/api/ai/interview-prep/:id` | Session with questions and answers |
| POST | `/api/ai/interview-prep/:id/answer` | Practice feedback |
| GET | `/api/reminders` | List reminders |
| POST | `/api/reminders` | Create |
| PATCH | `/api/reminders/:id` | Update |
| DELETE | `/api/reminders/:id` | Delete |
| POST | `/api/reminders/process` | Run due reminders for the signed-in user |
| GET | `/api/calendar` | Interviews, deadlines, reminders in a range |
| GET | `/api/analytics` | Weekly counts, rates, funnel |
| GET | `/api/health` | Liveness and database |

Validation is Zod from `@jobpilot/shared`. Unknown application statuses, inverted salary ranges, and oversized text are rejected before a write.

## AI flow

```
route → service (ownership checks) → render prompts/v1/*.md
      → AIProvider.complete → parse JSON with Zod → Prisma
```

Providers:

- `MockProvider` — deterministic local completion
- `OpenAIProvider` — `POST /v1/chat/completions`
- `AnthropicProvider` — `POST /v1/messages`

`createProvider()` reads `AI_PROVIDER`. A missing API key fails the AI request with 503, not process startup, so health checks still pass.

## Frontend

Routes:

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/login`, `/register` | Auth |
| `/app` | Analytics dashboard |
| `/app/board` | Kanban |
| `/app/applications/:id` | Detail, contacts, timeline |
| `/app/resumes` | Resume library |
| `/app/tailor` | Tailor a resume |
| `/app/cover-letters` | Cover letters |
| `/app/interviews` | Generate a prep session |
| `/app/interviews/:id` | Practice |
| `/app/calendar` | Month calendar |
| `/app/settings` | Profile, theme, password |

Signed-out visits to `/app/*` go to `/login`. The access token is kept in memory. On load, the app calls `/api/auth/refresh` and, on success, stores the new access token. A 401 on an API call refreshes once and retries.

The board uses `@dnd-kit` for pointer and keyboard dragging, and a "Move to" control that calls the same reorder helper. Charts (`recharts`) sit next to a data table of the same numbers.

Import and export live on the board. Pasting a job URL runs the shared parser immediately.

## Reminders

`src/jobs/scheduler.ts` registers a cron (`* * * * *`) from `index.ts`. Tests call `processDueReminders` directly and do not start cron. The scheduler is not started when `NODE_ENV=test`.

## Error handling

`AppError` carries HTTP status and a stable `code`. The error middleware maps Zod failures to 400, unique constraint conflicts to 409, upload limits to 400, and everything else to 500 with a fixed message. Stack traces stay in the server log.

## Security controls

Helmet, CORS allowlist, JSON body limit 2mb, upload limit 5mb and extension/mime checks, bcrypt, hashed refresh tokens, rotation and reuse detection, per-user queries, auth and AI rate limits, CSV formula neutralization, SSRF checks on posting fetch, production CSP that allows only same-origin scripts (theme init is an external file).

## Testing

- `packages/shared`: parser, CSV, analytics, schemas
- `apps/api`: Supertest against `createApp()`, SQLite, mock AI, stubbed fetch for hosted providers
- `apps/web`: Testing Library, mocked `fetch`
- `e2e`: Playwright, Chromium, mock AI, dedicated SQLite file

## Build and deploy

`npm run build` typechecks and builds the web app, then compiles the API. The Docker image generates the Prisma client from the Postgres schema, pushes the schema on start, and listens on 4000. See `README.md` for setup commands.
