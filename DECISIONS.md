# Decisions

These choices are fixed for this repository unless a later entry supersedes them.

## 1. Repository location

FreelanceHub lives in `D:\Downloads\projects xx` (the Next.js app at that root, not a nested folder). JobPilot is a separate repository at `D:\Downloads\jobpilot`, the sibling directory. Nothing in FreelanceHub is read or modified for this work.

## 2. Monorepo and toolchain

npm workspaces, three packages:

- `apps/web` — React 19, Vite, TypeScript, Tailwind CSS
- `apps/api` — Node.js, Express, TypeScript
- `packages/shared` — Zod schemas, CSV, job-link parsing, analytics math

ESM everywhere. The API compiles with `tsc`. The web app bundles with Vite. Shared code is imported from TypeScript source via the package `exports` map so dev, test, and Vite do not need a separate shared build step. Node's type stripping (Node 22+) plus `tsx` loads those `.ts` files in the API.

## 3. Database

Local development, tests, and CI use SQLite through Prisma so the app runs without a database server. `apps/api/prisma/schema.prisma` is the SQLite schema.

Production Docker Compose uses PostgreSQL 16. `schema.postgres.prisma` is the same models with `provider = "postgresql"`. A test fails if the model bodies diverge. Prisma enums are avoided; status values are strings validated by Zod, which keeps the two schemas identical.

JSON columns are stored as strings (JSON text) for the same reason. The API parses them at the boundary.

## 4. Authentication

Access tokens are JWTs (`type: "access"`, 15 minutes) sent as `Authorization: Bearer`.

Refresh tokens are JWTs (`type: "refresh"`) whose `jti` is stored as a SHA-256 hash. They are set as an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/auth`, and they rotate on every refresh. Presenting a revoked refresh token revokes every refresh token for that user.

Passwords use bcrypt (cost 12 in production, lower only when `BCRYPT_ROUNDS` is set in tests). The client never receives the refresh token in JSON.

In development the Vite server proxies `/api` to the API, so the browser talks to one origin and the cookie is first-party.

## 5. Authorization

Every query that reads or writes user data includes `userId` from the verified access token. Missing rows return 404, including when the row exists for someone else, so ids are not an oracle.

## 6. AI

`AI_PROVIDER` selects `openai`, `anthropic`, or `mock` (the default). All three implement one interface: `complete({ system, user, temperature, maxTokens })`.

Prompts are Markdown files in `apps/api/prompts/v1/`. The loader records the version string `v1` on every saved generation.

The mock provider does not call a network. It parses the labeled sections of the same prompts and returns the JSON contract: a tailored resume with a keyword match score, a cover letter in the requested tone, interview questions, answer feedback, and follow-up drafts. Tests and local demo use the mock. OpenAI and Anthropic are thin HTTP adapters and are tested with a stubbed `fetch`.

If the selected provider returns text that is not the expected JSON, the request fails with 502 and nothing is saved.

## 7. Job link parsing

Pasting a link fills company and role in the browser through a pure function in `@jobpilot/shared` (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, LinkedIn slugs, and "Role at Company" text).

"Fetch posting" asks the API to download the page and read JSON-LD `JobPosting` or the title. The fetch refuses non-http(s) URLs, credentials in the URL, localhost, and private or link-local addresses (checked after DNS lookup), and it re-checks each redirect.

## 8. Follow-up mail

The in-process cron runs every minute. A due reminder is marked sent, and the draft is stored on the reminder.

Follow-up email is sent to the **account owner**, not to a recruiter. Auto-mailing a hiring contact would send unreviewed mail. The product drafts the note and delivers the reminder to the user when `emailReminders` is on and SMTP is configured. Without SMTP, the draft is still saved and an outbox row records `stored`. Opted-out users get an outbox row of `skipped_opt_out` and still see the reminder in the app.

## 9. Kanban ordering

Cards have a `position` inside a status column. Drag-and-drop and the keyboard "Move to" control both call `POST /api/applications/reorder` with the affected columns' ordered ids. Moving out of Wishlist stamps `appliedAt` if it was empty. A status change writes a timeline event whose `body` is the new status. Analytics uses those events so a later rejection still counts as an interview if the person reached that stage.

## 10. Analytics definitions

- **Submitted:** status is not Wishlist, or `appliedAt` is set, or a status event left Wishlist.
- **Response:** a submitted application that reached Interview, Offer, or Rejected.
- **Interview:** reached Interview or Offer (an offer counts as past the interview stage).
- **Response rate and interview rate** divide by submitted applications. Both are 0 when nothing has been submitted.
- **Applications per week** buckets `createdAt` into Monday-start UTC weeks, 12 weeks including the current one, with zeros for empty weeks.

## 11. CSV

Export is UTF-8 with a BOM. Cells that start with `=`, `+`, `-`, `@`, or a tab are prefixed so spreadsheet apps do not treat them as formulas. Import validates each row, skips bad rows, and reports line errors without failing the whole file.

## 12. Production hosting shape

The API serves the built SPA from `WEB_DIST` in production. Docker Compose runs Postgres and one app container. `docker compose` runs `prisma db push` for the Postgres schema before listen.

## 13. Tests

Vitest covers shared logic, API integration (Supertest + SQLite), and web UI (Testing Library). Playwright covers sign-up, adding an application, moving it on the board, and generating a tailored resume against the mock provider. Coverage thresholds are enforced on each workspace (85% lines, statements, and functions).

## 14. Visual design

The interface is a filing board, not a generic dashboard. Cool paper background `#F2F5F3`, ink `#17211E`, pine `#145C38` for actions. Cards are routing slips (square left corners, a short status stripe). Sora for UI, Literata for resume and letter text. The landing hero is a static preview of the board. Dark mode uses `#101614` and sage text. Motion is limited to the drag the user performs.

## 15. What is intentionally out of scope

Billing, team accounts, OAuth, sending mail directly to employers, and a background worker process separate from the API. Reminder delivery runs in the API process.

## 16. Password reset

A signed-out person can ask for a reset by email. The API always answers the same way, so the response does not reveal whether that email is registered. The link holds a random token; only its hash is stored, it lasts one hour, and using it or asking again retires older links. Resetting the password revokes refresh sessions. Outside production, when SMTP is not configured, the response includes the link so local development works. Production never returns the link.
