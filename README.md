# Online Access — client portal (demo)

A realistic client-facing wealth management portal for a fictional Edward Jones household, built as the target application for an end-to-end "client request → GitHub issue → Cursor agent → pull request → release" demo. **Every person, account and figure is synthetic.**

The signed-in household is the **Kaur Household**: Simran Kaur and Arjun Singh, advised by Grace Lindqvist (Bend Westside Branch), with five accounts worth about $760,000.

## What clients can do

| Area | Features |
| --- | --- |
| **Overview** | Total household value with day change and a 1M–3Y value chart, advisor card, items needing attention, accounts, asset allocation, goals, recent activity |
| **Accounts** | Joint advisory account, Traditional IRA, two Roth IRAs and a 529 plan. Per-account value history, holdings with gain/loss, allocation, activity and documents |
| **Activity** | Filter by date range, account and type, plus search; money in/out totals; pagination; CSV export |
| **Transfers** | Move money between accounts, deposit from or withdraw to linked banks, one-time or monthly, with review and confirmation. Scheduled transfers can be cancelled. Rules: no online IRA or 529 withdrawals, cash-available checks, a $250,000 online limit, dates up to one year ahead |
| **Documents** | Monthly statements, quarterly reports, Form 1099 and Form 5498, trade confirmations and letters, rendered from live data with a print view; new-document indicators |
| **Goals** | Retirement and education goals with projections; adjust savings, goal amount and date with a live preview |
| **Messages** | Secure messaging with the branch: unread badges, threads, replies, new conversations |
| **Profile** | Account owners, advisor and branch team, linked banks, paperless and alert preferences, help |

## Stack

- Next.js 16 (App Router, server components, route handlers), React 19, TypeScript
- Tailwind CSS 4 and shadcn/ui (Radix), lucide icons, sonner toasts
- PostgreSQL in production; [PGlite](https://pglite.dev) (embedded Postgres) locally and in tests
- zod validation, Vitest tests
- Hosted on Cursor app hosting behind Cursor sign-in (`cursor/identity.ts`, `cursor-app.json`)

## Run it locally

```bash
npm ci
npm run dev          # http://localhost:4318, signed in as a simulated viewer
```

No database setup is needed. With `DATABASE_URL` unset, data lives in `.data/pglite`, and the demo household is seeded on first start (set `SEED_ON_EMPTY=false` to start empty). Seeded dates are relative to today, so the portal always looks current.

| Command | Purpose |
| --- | --- |
| `npm run check` | Lint, typecheck and tests |
| `npm test` | Vitest (in-memory PGlite) |
| `npm run build` | Production build, then apply migrations when `DATABASE_URL` is set |
| `npm run db:reset` | Restore the demo household (local PGlite, or `DATABASE_URL`) |

## Project layout

```
migrations/                 SQL migrations (applied in order, tracked in schema_migrations)
scripts/                    migrate.mjs (build step), reset-demo.ts
src/app/(portal)/           Portal pages (server components)
src/app/api/                JSON API (see docs/API.md)
src/components/portal/      Portal UI (charts, tables, forms, dialogs)
src/components/ui/          shadcn/ui primitives
src/lib/server/services/    Business rules and data access, one module per area
src/lib/server/seed*.ts     Deterministic demo household
src/lib/                    Shared types, domain enums and labels, formatting, dates
tests/                      Vitest suites
automation/                 Client Product Insights → GitHub issues helper (do not edit)
```

## Security model

- The app is published as private. Cursor's sign-in gate authenticates every request, and `getIdentity` verifies the signed identity header. API routes return 401 without a verified viewer.
- State-changing API calls must be same-origin and carry `x-portal-request: 1`, which cross-site pages cannot send. Bodies must be JSON and at most 64 KB.
- All queries are parameterised and scoped to the viewer's household. Each viewer currently maps to the demo household (`src/lib/server/session.ts`).
- Caps on open transfers, conversations and messages bound resource use.

## Deployment

`cursor-app.json` asks Cursor hosting for a PostgreSQL database. `npm run build` applies migrations (`scripts/migrate.mjs`), and the first request seeds the demo household when the database is empty (unless `SEED_ON_EMPTY=false`). Releases are published from `main` with Cursor's publish-app tool.

## The enhancement loop

1. A client request is entered in **Client Product Insights**.
2. The Cursor automation in `automation/` turns it into a structured GitHub issue on this repository.
3. A Cursor agent implements the issue following `AGENTS.md`: branch, code, tests, `npm run check`, build, browser check, and a pull request with `Closes #N`.
4. CI runs, a human reviews and merges, and the agent republishes the app.
