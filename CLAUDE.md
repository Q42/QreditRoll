# QreditRoll

An epic credit roll for websites: `qreditroll.js` opens `qreditroll.html` in a frame and rolls the credits from the site's `humans.txt`. A static site without a build; the demo is `index.html`, options are shown in `example/`.

## Live

- Every push to `master` (except only `.md`) goes to staging first: https://miniature-tribble-w99m4kk.pages.github.io/ (private Pages of `Q42/qreditroll-staging`; open it with a GitHub login that has access to that repo). After Chris approves the waiting run in GitHub (environment `github-pages`), exactly that build goes live on https://qreditroll.com. Workflow: `.github/workflows/pages.yml`.
- The version is the number of commits (`git rev-list --count HEAD`); the run's summary names it.
- Keep paths relative: the same build serves staging and live.

## Board

This project uses simple-agentic-agile-flow (skills `grill` and `build`). The board is the backlog: https://github.com/orgs/Q42/projects/52.

- Columns: Inbox → Specified → Ready to build → In progress → On staging → Done. Only Chris moves cards to Ready to build (the go) and to Done.
- Labels: bug (Bug), Finding, Grilled, Idea. A card is an issue in Q42/QreditRoll on project 52; its title, Status, label, Version and a Source line.
- Read and move cards: `gh project item-list 52 --owner Q42 --format json`; a new card is `gh issue create -R Q42/QreditRoll` plus `gh project item-add 52 --owner Q42 --url <issue>`; move it with `gh project item-edit --project-id PVT_kwDOAAkals4BsNcE --id <item> --field-id PVTSSF_lADOAAkals4BsNcEzhqcm7U --single-select-option-id <option>` (Inbox `6382f3c4`, Specified `b7007106`, Ready to build `4ab35e87`, In progress `8382cbb1`, On staging `fe4ac06d`, Done `8f64649a`); Version with `--field-id PVTF_lADOAAkals4BsNcEzhqcnO8 --text <version>`. Status is leading, not open/closed; run grill and build in a local session, cloud sessions can't reach GitHub Projects.
- Open issues in Q42/QreditRoll that are not on the board are a second inbox: grill takes them after the Inbox. On go the issue itself goes on the board as Specified. At each step (Specified, On staging with the version, Done) post one short comment on the issue in plain language, so whoever filed it can follow; at Done close the issue.
- Something Claude finds on its own (a bug outside the task, a review finding) becomes a full card with its source: straight to Specified when it holds no choice for Chris, otherwise to the Inbox with the open questions on top. A card Chris says no to is removed.
- Checks: no tests or CI in the repo, on purpose. The proof is a measurement with the Playwright scripts outside the repo, or a screenshot of the demo; no pre-push hook. Staging: a push to `master` puts it there (see Live). Committing and pushing to staging never needs asking; production is Chris's approval.
