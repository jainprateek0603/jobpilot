# Decisions

## Where the repo lives

FreelanceHub is the Next.js app at `D:\Downloads\projects xx`. There is no separate folder named FreelanceHub. JobPilot is a sibling repository at `D:\Downloads\jobpilot` so it does not share FreelanceHub's git history or files.

## Monorepo

npm workspaces, not pnpm or turborepo. Three packages:

- `apps/web` — React, Vite, TypeScript, Tailwind
- `apps/api` — Express, TypeScript, Prisma
- `packages/shared` — Zod schemas, CSV, link parsing, analytics math

Shared code is TypeScript source exported from the package. API and web resolve it through a workspace dependency plus a Vite/Vitest/tsconfig alias so tests do not need a separate compile step. The API production build bundles shared with `tsc` project references: shared emits `dist`, and the API compiles against that.

## Database

Local development, tests, and CI use SQLite (`apps/api/prisma/schema.prisma`). Docker Compose uses PostgreSQL (`apps/api/prisma/schema.postgres.prisma`). The two schemas differ only in the datasource provider. Models use strings instead of Prisma enums so the schemas stay aligned. A unit test fails if any other line diverges.

Prisma client is generated from whichever schema the current environment uses. Local `prisma generate` uses SQLite. The Docker image generates the Postgres client.

## Auth

Access tokens are JWTs (15 minutes) sent as `Authorization: Bearer`. Refresh tokens are JWTs with a `jti` claim. Only the SHA-256 hash of the refresh token is stored. Refresh tokens rotate on use. Presenting a revoked refresh token revokes every session for that user.

The refresh token is an HttpOnly, SameSite=Lax cookie scoped to `/api/auth`. It is not returned in JSON. In development the Vite server proxies `/api` to the API, so the browser stays on one origin.

Passwords are hashed with bcrypt. Production uses 12 rounds. Tests use 4 rounds via `BCRYPT_ROUNDS`.

Users only read and write rows whose `userId` is theirs. Missing rows return 404, including when the row exists for someone else.

## AI

`AI_PROVIDER` selects `openai`, `anthropic`, or `mock` (default). All three implement one interface: a system prompt plus a user prompt in, a string out. Prompts are Markdown files in `apps/api/prompts/v1`. The loader records the version `v1`. Model output must be JSON. The service strips fences and validates with Zod.

The mock provider does not call a network. It scores keyword overlap and returns the same JSON shape as the real providers, so tests and local demo work offline.

## Follow-up mail

The cron job does not email recruiters. It drafts a follow-up and emails that draft to the signed-in user when SMTP is configured and the user has email reminders on. Without SMTP, the draft is stored and an outbox row is recorded as skipped. The in-app reminder still flips to sent so the calendar and board stay accurate.

## Job link parsing

Pasting a URL runs a pure parser for Greenhouse, Lever, Ashby, and Workable slugs, plus `company` and `role` query parameters. If company or role is still empty, the API may fetch the page. Fetching rejects non-http(s) URLs, credentials in the URL, localhost, and private or link-local addresses, including after each redirect.

## Board interaction

Drag and drop uses dnd-kit. Every card also has a "Move to" control so the board works with a keyboard and in automation.

## Production process

One Node process serves `/api` and, when `WEB_DIST` is set, the built SPA. Docker uses that mode behind a Postgres service.

## Design

The interface is a filing board: cool paper, ink text, and a status stripe on each column. The landing hero is a sample board, not a row of statistics. Typefaces are Sora for UI and Literata for resume text. Dark mode is a `dark` class on the document element.
