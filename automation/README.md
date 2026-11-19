# Client requests → GitHub issues automation

The Cursor automation that runs on this repository uses `cpi-github.mjs` to turn queued Client Product Insights requests into structured GitHub issues. `PROMPT.md` is the automation's prompt.

A second automation implements an issue when someone with write access comments `/implement` on it (or adds the `agent: implement` label, where the trigger supports issue labels): it plans, builds, tests, reviews, merges the pull request, and republishes the app. `IMPLEMENT.md` is its prompt.

Copied from [niktunXSI/EDJDemo](https://github.com/niktunXSI/EDJDemo) (`automation/`); full setup is in that repository's `docs/AUTOMATION.md`.

Run `node automation/cpi-github.mjs doctor` to check every connection without changing anything. Moving to another Cursor account: see `docs/MIGRATION.md` in EDJDemo.

The helper is dependency-free (Node 18+) and reads these environment variables:

| Variable | Purpose |
| --- | --- |
| `CPI_BASE_URL` | Client Product Insights address |
| `CPI_API_KEY` | Agent API key |
| `CURSOR_APP_TOKEN` | Cursor API key that can open the app |
| `GITHUB_TOKEN` | Token with Issues read/write on this repository |
| `GITHUB_REPO` | `niktunXSI/EDJ-Application` |
| `ALLOW_PUBLIC_ISSUES` | `true` while this repository is public and the app holds synthetic demo data |
