# API

All JSON responses use `{ "data": ... }` or `{ "error": { "code", "message", "fields?" } }`.

Send the access token as `Authorization: Bearer`. The refresh token is an HttpOnly cookie named `jobpilot_refresh`, path `/api/auth`.

## Auth

`POST /api/auth/register` `{ email, password, name }` → `201` `{ accessToken, user }`

`POST /api/auth/login` `{ email, password }`

`POST /api/auth/refresh` uses the cookie and returns `{ accessToken }`

`POST /api/auth/logout`

`GET /api/auth/me`

`POST /api/auth/change-password` `{ currentPassword, newPassword }`

Passwords need 10 to 72 characters, a letter, and a number.

## Profile

`GET /api/profile`

`PATCH /api/profile` `{ name, headline, location, phone, linkedinUrl, websiteUrl }`

`PATCH /api/settings` `{ theme, timezone, emailReminders }`

`theme` is `light`, `dark`, or `system`. `timezone` is an IANA name.

## Applications

`GET /api/applications?q=&status=&page=&pageSize=`

`POST /api/applications` with company, role, and optional status, salary, currency, link, location, source, notes, job description, and dates.

`GET /api/applications/:id` includes contacts, timeline events, and reminders.

`PATCH /api/applications/:id`

`DELETE /api/applications/:id`

`POST /api/applications/reorder` `{ columns: [{ status, ids }] }`

`POST /api/applications/parse-link` `{ input, fetchPage? }`

Page fetches are off unless `fetchPage` is true. Private and local addresses are rejected.

`GET /api/applications/export` returns CSV.

`POST /api/applications/import` accepts `{ csv }` or a `text/csv` body.

`POST /api/applications/:id/contacts`

`PATCH /api/contacts/:id`

`DELETE /api/contacts/:id`

`POST /api/applications/:id/events` `{ body, title? }` adds a timeline note.

Statuses: `WISHLIST`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`.

## Resumes

`GET /api/resumes`

`POST /api/resumes` `{ title, content, isDefault? }`

`POST /api/resumes/upload` multipart field `file` (PDF, txt, or md, up to 5 MB) and optional `title`.

`GET /api/resumes/:id`

`GET /api/resumes/:id/file`

`PATCH /api/resumes/:id`

`DELETE /api/resumes/:id`

## AI

`POST /api/ai/tailor` `{ resumeId, jobDescription, applicationId?, company?, role? }`

Returns the saved draft, `matchScore`, and `missingKeywords`.

`GET /api/ai/tailored` and `GET /api/ai/tailored/:id`

`POST /api/ai/cover-letter` `{ tone, jobDescription, resumeId?, applicationId?, company?, role? }`

Tones: `professional`, `confident`, `warm`, `concise`.

`GET /api/ai/cover-letters`

`POST /api/ai/interview-prep` `{ role, company?, jobDescription?, applicationId? }`

`GET /api/ai/interview-prep` and `GET /api/ai/interview-prep/:id`

`POST /api/ai/interview-prep/:id/answers` `{ questionId, answer }` returns `score` and `feedback`.

## Reminders, calendar, analytics

`GET /api/reminders`

`POST /api/reminders` `{ title, dueAt, type, body?, applicationId? }`

Types: `follow_up`, `interview`, `deadline`, `custom`.

`PATCH /api/reminders/:id`

`DELETE /api/reminders/:id`

`POST /api/reminders/run` processes the signed-in user's due reminders.

`GET /api/calendar?from=&to=` returns interviews, deadlines, and reminders in that range.

`GET /api/analytics` returns weekly counts, response rate, interview rate, offer rate, and a funnel.

Rates are fractions from 0 to 1. Weeks start on Monday UTC.

## Health

`GET /api/health` → `{ ok: true }`
