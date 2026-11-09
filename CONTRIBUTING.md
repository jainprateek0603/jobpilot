# Contributing to JobPilot

## Getting started

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `apps/api/.env` and set both JWT secrets (32+ characters each).
3. Run `npm install`, `npm run db:push`, then `npm run dev`.

The web app is at http://127.0.0.1:5173 and the API at http://127.0.0.1:4000. `npm run db:seed` loads demo data.

## Before you push

Run the same checks CI runs:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e
```

Coverage thresholds are enforced per workspace, so new code needs tests.

## Where things live

- `apps/web`: React interface
- `apps/api`: Express API, Prisma, AI providers, reminders
- `packages/shared`: schemas, CSV, link parsing, analytics shared by both apps
- `e2e`: Playwright specs

`ARCHITECTURE.md` covers the data model, `API.md` the request shapes, and `DECISIONS.md` why things are the way they are. A change that overrides a decision adds a new entry there.

## Commits

- One logical change per commit, with a short imperative subject ("Add pagination to applications").
- Keep tests and the code they cover in the same commit.
