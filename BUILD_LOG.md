# Build log

## Phase 1 — Plan

- Created `D:\Downloads\jobpilot` as its own git repository, beside the FreelanceHub workspace at `D:\Downloads\projects xx`.
- Wrote `ARCHITECTURE.md` and `DECISIONS.md`.
- Lint, type-check, and tests start with the toolchain in phase 2.

## Phase 2 — Backend

- Added the npm workspace, Prisma schema (SQLite plus a matching Postgres schema), and the Express API.
- Auth uses a short-lived JWT and a rotating refresh cookie. Every query is scoped by `userId`.
- Validation is Zod from `@jobpilot/shared`. Rate limits cover the API, auth, and AI routes.
- Fixed a foreign-key race in tests by running Vitest in a single fork, and stopped empty prompt labels from reading the next line.

## Phase 3 — AI services

- Added `openai`, `anthropic`, and `mock` providers behind one interface. `AI_PROVIDER` selects one.
- Prompts live in `apps/api/prompts/v1` and record version `v1`.
- The mock scores keyword overlap so tailoring, cover letters, interview questions, answer feedback, and follow-up drafts work offline.

## Phase 4 — Frontend

- Added the Vite React app: landing page, auth, board with drag-and-drop and a Move control, application detail, resumes, tailoring, cover letters, interview practice, calendar, analytics, and settings.
- Dark mode uses the `dark` class. The shell collapses to a menu on a narrow screen.

## Phase 5 — Testing

- Shared package: 94% lines, 85% branches, 92% functions.
- API: 94% lines, 77% branches, 94% functions. Integration tests cover auth, the board, resumes, AI, reminders, and authorization.
- Web: 94% lines, 81% functions, 76% branches. A Testing Library flow signs up and walks the board, detail, resumes, tailoring, letters, interviews, calendar, and settings.
- Playwright covers sign-up, adding an application, moving it, and generating a tailored resume.

## Phase 6 — Security, performance, and accessibility

- Helmet, CORS allow-list, origin check on cookie auth, hashed refresh tokens, and refresh-token reuse revocation.
- Job-link fetches reject credentials, localhost, and private addresses, including after redirects.
- CSV export neutralizes formula cells. Uploads are limited to 5 MB and PDF, text, or Markdown.
- Queries are indexed by user. JSON bodies are capped at 2 MB. The production server compresses responses and can serve the built client.
- The board has text labels as well as color, a keyboard move control, associated form labels, and a skip link.

## Phase 7 — DevOps and docs

- GitHub Actions runs lint, type-check, coverage, the production build, and Playwright.
- `Dockerfile` and `docker-compose.yml` run the API with PostgreSQL.
- `.env.example`, `npm run db:seed`, `README.md`, and `API.md`.

## Follow-up

- Signed-in pages load on demand. The first JavaScript file dropped from about 789 kB to 338 kB. Charts load with the dashboard, and drag-and-drop loads with the board.
- Due reminders are claimed before they are sent. A second server skips a reminder that is already being processed, and a claim older than 10 minutes is tried again.
- Password reset works while signed out. The link is a one-hour token stored as a hash, and using it signs out other sessions. Outside production, with no mail server, the API returns the link.
- The dashboard chart is CSS bars. The dashboard chunk dropped from about 377 kB to 2.5 kB.

## Phase 8 — Final review

- Lint, type-check, coverage, and the production web/API build passed.
- Shared coverage is 94% lines. API coverage is 94% lines and 77% branches. Web coverage is 94% lines, 81% functions, and 76% branches.
- Playwright passed: sign up, add an application, move it to Applied and Interview, and generate a tailored resume with the mock provider.
