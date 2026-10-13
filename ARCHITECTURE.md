# JobPilot architecture

JobPilot is a job-search command center. A person tracks applications on a board, keeps resumes, tailors them to a posting, drafts cover letters, practices interview answers, and reviews how the search is moving.

## Layout

```
jobpilot/
  apps/api/                 Express API, Prisma, cron, prompts
    prisma/schema.prisma    SQLite datasource
    prisma/schema.postgres.prisma
    prompts/v1/             Versioned prompt files
    src/
      app.ts                HTTP app, no listening
      index.ts              Listen, cron, static SPA
      config.ts
      lib/                  prisma, errors, tokens, passwords, ssrf
      middleware/           auth, errors, rate limit, validation
      routes/
      services/
      ai/                   provider interface and implementations
      jobs/scheduler.ts
      scripts/seed.ts
    tests/
  apps/web/                 Vite React SPA
    src/pages/
    src/components/
    src/lib/
    e2e/                    Playwright specs live at the repo root
  packages/shared/          Schemas and pure domain functions
  e2e/                      Playwright
  .github/workflows/ci.yml
  docker-compose.yml
  Dockerfile
```

## Runtime

| Piece | Dev | Production |
| --- | --- | --- |
| Web | Vite on port 5173, proxies `/api` | Static files from `apps/web/dist` |
| API | `tsx` on port 4000 | `node apps/api/dist/index.js` |
| Database | SQLite file | PostgreSQL in Compose |
| AI | `AI_PROVIDER`, default `mock` | Same, usually `openai` or `anthropic` |
| Mail | Outbox when SMTP is unset | Nodemailer when SMTP is set |
| Reminders | In-process cron, every minute | Same |

## Data model

All primary keys are cuid strings. Every user-owned table has `userId` and an index that starts with it.

- **User** — email, password hash, profile fields, theme (`light` \| `dark` \| `system`), email reminder flag.
- **RefreshToken** — hashed token, expiry, revocation, replacement id.
- **Application** — company, role, status (`WISHLIST`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`), position inside the column, salary range, currency, URL, location, source, notes, job description, applied / deadline / interview timestamps.
- **Contact** — name, role, email, phone, notes. Belongs to an application.
- **TimelineEvent** — type, title, body, time. Written when an application is created, moved, noted, or when AI artifacts are saved.
- **Resume** — title, plain text, optional stored file name and path, default flag.
- **TailoredResume** — source resume, optional application, job description, tailored text, match score, missing keywords JSON, provider, prompt version.
- **CoverLetter** — tone, content, optional application and resume, provider, prompt version.
- **InterviewPrep** — role, company, optional application, questions.
- **InterviewQuestion** — category, prompt, tips, order.
- **PracticeAnswer** — answer text, feedback, score.
- **Reminder** — due time, type (`follow_up`, `interview`, `deadline`, `custom`), status (`pending`, `sent`, `dismissed`, `completed`), drafted subject and body.
- **EmailOutbox** — recipient, subject, body, delivery status.

Status changes record a timeline row. Reaching Interview or Offer is inferred from current status or from those timeline rows so a later rejection still counts as an interview in analytics.

## Auth flow

1. `POST /api/auth/register` or `POST /api/auth/login` verifies credentials, returns an access token, and sets the refresh cookie.
2. The SPA keeps the access token in memory and sends it on API calls.
3. On 401, the SPA calls `POST /api/auth/refresh` (cookie). The API rotates the refresh token and returns a new access token.
4. `POST /api/auth/logout` revokes the current refresh token and clears the cookie.
5. `POST /api/auth/change-password` revokes every refresh token.

Secrets shorter than 32 characters are rejected at startup outside tests.

## HTTP API

JSON envelope: `{ "data": ... }` or `{ "error": { "code", "message", "fields?" } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Liveness |
| POST | `/api/auth/register` | no | Create account |
| POST | `/api/auth/login` | no | Sign in |
| POST | `/api/auth/refresh` | cookie | Rotate session |
| POST | `/api/auth/logout` | cookie | Revoke session |
| POST | `/api/auth/change-password` | yes | Change password |
| GET | `/api/auth/me` | yes | Id, email, name |
| GET | `/api/profile` | yes | Profile and settings |
| PATCH | `/api/profile` | yes | Update profile |
| PATCH | `/api/settings` | yes | Theme and email reminders |
| GET | `/api/applications` | yes | List, optional `q` and `status` |
| POST | `/api/applications` | yes | Create |
| GET | `/api/applications/:id` | yes | Detail with contacts, events, reminders |
| PATCH | `/api/applications/:id` | yes | Update fields |
| DELETE | `/api/applications/:id` | yes | Delete |
| POST | `/api/applications/reorder` | yes | Set column membership and order |
| POST | `/api/applications/parse-link` | yes | Prefill company and role |
| GET | `/api/applications/export` | yes | CSV download |
| POST | `/api/applications/import` | yes | CSV upload |
| POST | `/api/applications/:id/contacts` | yes | Add contact |
| PATCH | `/api/contacts/:id` | yes | Update contact |
| DELETE | `/api/contacts/:id` | yes | Delete contact |
| POST | `/api/applications/:id/events` | yes | Add a note to the timeline |
| GET | `/api/resumes` | yes | List |
| POST | `/api/resumes` | yes | Create from text |
| POST | `/api/resumes/upload` | yes | PDF, txt, or md upload |
| GET | `/api/resumes/:id` | yes | One resume |
| PATCH | `/api/resumes/:id` | yes | Update |
| DELETE | `/api/resumes/:id` | yes | Delete |
| POST | `/api/ai/tailor` | yes | Tailor a resume |
| GET | `/api/ai/tailored` | yes | List tailored resumes |
| GET | `/api/ai/tailored/:id` | yes | One tailored resume |
| POST | `/api/ai/cover-letter` | yes | Draft a cover letter |
| GET | `/api/ai/cover-letters` | yes | List |
| POST | `/api/ai/interview-prep` | yes | Generate questions |
| GET | `/api/ai/interview-prep` | yes | List sessions |
| GET | `/api/ai/interview-prep/:id` | yes | Session with answers |
| POST | `/api/ai/interview-prep/:prepId/answers` | yes | Score a practice answer |
| GET | `/api/reminders` | yes | List |
| POST | `/api/reminders` | yes | Create |
| PATCH | `/api/reminders/:id` | yes | Update |
| DELETE | `/api/reminders/:id` | yes | Delete |
| POST | `/api/reminders/run` | yes | Process this user's due reminders |
| GET | `/api/calendar` | yes | Interviews, deadlines, reminders in a range |
| GET | `/api/analytics` | yes | Weekly counts, rates, funnel |

Validation is Zod from `@jobpilot/shared`. Rate limits: 300 requests per minute per IP globally, 20 per 15 minutes on auth routes, 30 per hour on AI routes. `RATE_LIMIT_DISABLED=true` turns them off for tests.

Errors: validation 400, auth 401, conflict 409, missing 404, unexpected 500 with no stack in the body. A handler wraps async route errors.

## AI contract

Providers implement:

```ts
complete(input: { system: string; user: string; temperature?: number; maxTokens?: number }): Promise<string>
```

Tasks and files:

| Task | Prompt | JSON |
| --- | --- | --- |
| Tailor resume | `prompts/v1/tailor-resume.md` | `resume`, `matchScore`, `missingKeywords` |
| Cover letter | `prompts/v1/cover-letter.md` | `letter` |
| Interview questions | `prompts/v1/interview-questions.md` | `questions[]` |
| Answer feedback | `prompts/v1/answer-feedback.md` | `score`, `feedback` |
| Follow-up draft | `prompts/v1/follow-up-email.md` | `subject`, `body` |

## Analytics

Pure function in `@jobpilot/shared`:

- **Applications per week** — counts by `createdAt` for the last 12 weeks, Monday start.
- **Response rate** — applications that left Wishlist and later sit in Interview, Offer, or Rejected, or have a matching status-change event, divided by submitted applications.
- **Interview rate** — applications that reached Interview or Offer (current status or timeline), divided by submitted applications.
- **Funnel** — Wishlist, then submitted, then reached interview, then offer. Counts are cumulative reaches, not only the current column.

## Frontend routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/login`, `/register` | Auth |
| `/app` | Analytics dashboard |
| `/app/board` | Kanban |
| `/app/applications/:id` | Detail, contacts, timeline |
| `/app/resumes` | Resume library |
| `/app/tailor` | Tailor flow |
| `/app/cover-letters` | Cover letters |
| `/app/interviews` | Prep and practice |
| `/app/calendar` | Month calendar |
| `/app/settings` | Profile, theme, password |

The shell shows a loading state while the session is restored, toasts for success and failure, and empty states that name the next action.

## Jobs

`jobs/scheduler.ts` runs every minute outside `NODE_ENV=test`. It selects pending reminders with `dueAt <= now`, drafts a follow-up when needed, writes the outbox, and marks the reminder sent. `POST /api/reminders/run` uses the same function for the signed-in user so tests do not wait for the clock.

## Testing

- Vitest unit tests for shared functions and API services.
- Vitest + Supertest integration tests against SQLite, single-threaded so the file database does not lock.
- Playwright: sign up, add an application, move it across the board, generate a tailored resume with the mock provider.
- Coverage thresholds are 85% lines, statements, and functions on shared, api, and web.

## Deployment

`Dockerfile` builds the SPA and API, generates the Postgres client, and starts `index.js`. Compose runs Postgres 16 and the app. `.env.example` lists every variable. `npm run db:seed` loads a demo user.
