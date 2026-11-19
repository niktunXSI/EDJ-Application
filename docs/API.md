# API

JSON route handlers under `src/app/api`. Every route except `/api/health` requires a verified Cursor identity and returns `401 unauthenticated` without one. Responses are `Cache-Control: no-store`.

State-changing requests (`POST`, `PATCH`) must:

- come from the same origin (`Sec-Fetch-Site: same-origin`, or a matching `Origin`), otherwise `403 cross_origin`;
- send `x-portal-request: 1`, otherwise `403 csrf_failed`;
- send `Content-Type: application/json`, otherwise `415`.

The browser helper `apiFetch` (`src/lib/api-client.ts`) handles all three.

## Errors

```json
{ "error": { "code": "validation_failed", "message": "Some fields need attention.", "details": { "fields": [{ "path": "amount", "message": "Enter an amount greater than $0." }] } } }
```

| Status | Codes |
| --- | --- |
| 400 | `bad_request` (invalid JSON) |
| 401 | `unauthenticated` |
| 403 | `cross_origin`, `csrf_failed` |
| 404 | `not_found` |
| 409 | `not_cancellable`, `too_many_open_transfers`, `too_many_threads`, `thread_full` |
| 413 / 415 | `payload_too_large`, `unsupported_media_type` |
| 422 | `validation_failed` (with `details.fields`) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | `{ status, database }`; no sign-in required |
| GET | `/api/household` | Household, advisor, service team, clients |
| GET | `/api/overview` | Totals, accounts, allocation, goals, recent activity, upcoming transfers, unread counts |
| GET | `/api/history?range=1m\|3m\|ytd\|1y\|3y` | Household value history (default `1y`) |
| GET | `/api/accounts` | `{ accounts }` summaries with market value, day change, cost basis |
| GET | `/api/accounts/:id` | Account with holdings and allocation |
| GET | `/api/accounts/:id/history?range=` | Account value history |
| GET | `/api/activity` | Transactions. Query: `range` (`30d`, `90d` default, `ytd`, `12m`, `all`), `accountId`, `type`, `q`, `limit` (1–500, default 50), `offset`. Returns `{ items, total, inflows, outflows }` |
| GET | `/api/activity/export` | Same filters, CSV download |
| GET | `/api/transfers` | `{ upcoming, history, banks }` |
| POST | `/api/transfers` | Create a transfer: `{ kind: internal\|deposit\|withdrawal, fromAccountId?, toAccountId?, bankAccountId?, amount, frequency: once\|monthly, scheduledFor: yyyy-mm-dd, memo? }`. Returns 201 |
| POST | `/api/transfers/:id/cancel` | Cancel a scheduled transfer |
| GET | `/api/documents?category=&year=&accountId=` | `{ items, years }` |
| GET | `/api/documents/:id` | Document with rendered content; marks it viewed |
| GET | `/api/goals` | Goals with projections |
| PATCH | `/api/goals/:id` | `{ targetAmount?, targetDate?, monthlyContribution? }` |
| GET | `/api/messages` | Conversation summaries |
| POST | `/api/messages` | Start a conversation: `{ subject, body }` |
| GET | `/api/messages/:id` | Conversation with messages; marks branch messages read |
| POST | `/api/messages/:id` | Reply: `{ body }` |
| GET | `/api/profile` | `{ viewer, household, preferences, banks }` |
| PATCH | `/api/profile/preferences` | `{ paperlessStatements?, paperlessTaxDocuments?, paperlessConfirmations?, alerts?: { [key]: { email?, text? } } }` |
