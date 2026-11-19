<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Online Access client portal — agent guide

A demo client portal for a fictional Edward Jones household (synthetic data only). Next.js App Router with server components, a JSON API under `src/app/api`, and PostgreSQL (embedded PGlite locally). Read `README.md` for the layout and `docs/API.md` for the API.

## Working on an issue

Enhancement issues arrive from the Client Product Insights automation (see `automation/README.md`). Take each one through the full lifecycle:

1. **Branch** from `main`.
2. **Understand** the issue's acceptance criteria and the code it touches. Business rules belong in `src/lib/server/services/*` (server only); UI in `src/app/(portal)` and `src/components/portal`; shared types in `src/lib/types.ts`; labels and enums in `src/lib/domain.ts`.
3. **Schema changes** go in a new numbered file in `migrations/` (never edit an applied migration). Update `src/lib/server/seed.ts` when the demo household should show the new feature.
4. **Implement** the change end to end: service, API route, UI, empty and error states.
5. **Test.** Add or update Vitest tests in `tests/` for every new rule, including edge cases named in the acceptance criteria.
6. **Verify:** `npm run check` (lint, typecheck, tests) and `npm run build` must pass. Start `npm run dev` (port 4318) and check the change in a browser.
7. **Open a pull request** using `.github/pull_request_template.md`. Put `Closes #<issue>` in the body, map each acceptance criterion to how it is met, and attach a screenshot of the UI change.
8. **CI** (`.github/workflows/ci.yml`) must be green before review.
9. **Release:** after the pull request is merged, republish the app from `main` with Cursor's publish-app tool (the app is already published, so this updates it in place). Migrations run automatically during the build.

## Conventions

- Every API route is wrapped in `route()` and calls `requireClient(request)` first. State-changing requests also need the same origin and the `x-portal-request: 1` header; the browser helper `apiFetch` in `src/lib/api-client.ts` sends it.
- Scope every query by `householdId`. Validate input with zod in the service, and raise field errors as `unprocessable("validation_failed", …, { fields: [{ path, message }] })` so forms can show them inline.
- Use parameterised SQL only.
- Money is stored as `numeric(14,2)` and formatted with `formatCurrency`. Calendar dates are `yyyy-mm-dd` strings; "today" is `todayIso()` (America/New_York).
- Match the existing visual language: `PageHeader`, `Panel`, `EmptyState`, `FieldRow` from `src/components/app/page-header.tsx`, shadcn/ui components from `src/components/ui`, and the forest, gold and cream palette in `globals.css`.
- Local development uses embedded PGlite whenever `DATABASE_URL` is unset; `npm run db:reset` restores the demo household.
- Never commit secrets or real client data.
- Do not edit `automation/` or `cursor/identity.ts` (the identity helper is generated).

## Cursor Cloud specific instructions

- Dependencies are installed by `.cursor/environment.json` (`npm ci`). No services need to be running before you start.
- Run the dev server in tmux with `env -u DATABASE_URL npm run dev` so it uses embedded PGlite, and open it at `http://localhost:4318`.
- If pages reload in a loop after `next.config.ts` changes, stop the dev server, delete `.next/dev`, and start it again.
- Publish from the top-level agent only. The Publish confirmation appears in the chat of the agent that called publish-app, and a subagent's chat does not show it.
