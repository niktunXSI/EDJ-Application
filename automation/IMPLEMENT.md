You implement one GitHub issue in this repository end to end: plan, build, test, review, open a pull request, merge it, and republish the live app. Follow `AGENTS.md` for the codebase rules; this prompt adds the workflow around it.

## 1. Pick the issue

- This run was started because the `agent: implement` label was added to an issue. Use that issue.
- If the trigger does not say which issue, run `gh issue list --label "agent: implement" --state open` and take the oldest one that has no open pull request (`gh pr list --state open --search "<issue number> in:body"`).
- If there is no such issue, stop and say so.
- Read the whole issue with `gh issue view <number>`. Its acceptance criteria are the definition of done.

## 2. Plan

- Read the code the issue touches and write a short plan: data and migrations, services and API, UI, tests, and anything the issue leaves ambiguous.
- If a question would change the design, pick the most conservative reading, note it under "Open questions" in the pull request, and continue. Do not stop to ask.
- Create a branch from `main`.

## 3. Build, delegating independent parts

- Split the plan into parts that do not edit the same files, for example "service, API route and tests" and "UI". Hand each part to a subagent on this machine with the plan, the files it owns, and the acceptance criteria it covers.
- Integrate their work yourself and make sure the pieces fit: types, API shape, and naming.
- Keep these steps in this agent rather than a subagent: committing, pushing, the pull request, merging, and publishing.

## 4. Test

- `npm run check` and `env -u DATABASE_URL npm run build` must pass.
- Start the dev server in tmux with `env -u DATABASE_URL npm run dev` and open it at `http://localhost:4318`.
- Use a computer-use subagent to walk through every acceptance criterion in the browser with the demo household, including empty, error and mobile-width states. Save before and after screenshots under `/opt/cursor/artifacts/`.
- Fix what fails and repeat until everything passes.

## 5. Review

- Run a Bugbot review and a security review of the branch changes (the `bugbot` and `security-review` subagents).
- Fix every finding that is real, then repeat step 4. In the pull request, list any finding you decided not to fix, with the reason.

## 6. Pull request

- Commit, push, and open the pull request with `.github/pull_request_template.md`. Put `Closes #<issue>` in the body, map each acceptance criterion to how it is met, and embed the screenshots.
- Wait for CI (`.github/workflows/ci.yml`) and Bugbot on the pull request. Fix failures and unresolved Bugbot findings, then push again.

## 7. Merge

- When CI is green and no Bugbot findings are unresolved, squash-merge: `gh pr merge <number> --squash --delete-branch`.
- If GitHub refuses (permissions or branch protection), stop and report the exact error, and ask a person to merge. When you are told it is merged, continue with step 8.

## 8. Release

- `git checkout main && git pull`, then confirm `npm run check` and `env -u DATABASE_URL npm run build` still pass on `main`.
- Start the dev server, then republish with Cursor's publish-app tool from this agent: `project_dir` ".", `preview_url` "http://127.0.0.1:4318". The app is already published, so this updates it in place, and the production build applies new migrations.
- Report whether the update went live or is waiting for someone to click Publish in this chat.

## Finish

Summarize in a few sentences: the issue, the pull request link, what changed, the test and review results, the merge, and the release status.
