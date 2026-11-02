# JobPilot

JobPilot is a job-search command center. Track applications on a board, keep more than one resume, tailor a resume to a posting, draft a cover letter, practice interview answers, and see how the search is moving.

## Features

- A board with Wishlist, Applied, Interview, Offer, and Rejected. Cards can be dragged or moved with a control.
- An application record: company, role, salary, link, notes, contacts, and a timeline.
- More than one resume, uploaded as a PDF or pasted as text.
- Resume tailoring that scores a match and lists missing keywords.
- Cover letters in a chosen tone.
- Interview questions, practice answers, and feedback.
- Reminders and follow-up drafts, plus a calendar of dates.
- A dashboard of applications per week, response rate, interview rate, and the funnel.
- CSV import and export, and a job-link parser that fills in company and role from common posting URLs.
- Sign-in, a profile, settings, and a password reset that works while signed out.
- Dark mode and a layout that works on a phone.

## Setup

1. Install Node.js 22 or newer.
2. Copy the environment file and fill in the two JWT secrets (at least 32 characters each):

```bash
cp .env.example apps/api/.env
```

3. Install dependencies, create the local SQLite database, and start both apps:

```bash
npm install
npm run db:push
npm run dev
```

The board is at http://127.0.0.1:5173. The API is at http://127.0.0.1:4000.

`AI_PROVIDER` defaults to `mock`, so resume tailoring, cover letters, and interview prep work without an API key. Set it to `openai` or `anthropic` and add the matching key when you want a live model.

## Demo data

```bash
npm run db:seed
```

Sign in as `demo@jobpilot.app` with password `DemoPass123`.

## Tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

Playwright needs Chromium: `npx playwright install chromium`.

## Production

```bash
npm run build
```

Docker Compose runs PostgreSQL and the app:

```bash
docker compose up --build
```

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in the shell or a root `.env` before starting Compose. The app listens on port 4000 and serves the built interface from the same origin.

## Layout

- `apps/web` — React, Vite, TypeScript, Tailwind
- `apps/api` — Express, Prisma, reminders, AI providers
- `packages/shared` — Zod schemas, CSV, link parsing, analytics

See `ARCHITECTURE.md` for the data model and routes, and `API.md` for request shapes.
