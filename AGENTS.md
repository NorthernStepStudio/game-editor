# Northern Step Studio Agent Instructions

These rules apply to AI coding agents, automation agents, and assistants working in this repository.

## Owner-readable communication — mandatory

The studio owner is not expected to interpret Git internals, internal metric names, or engineering shorthand.

Write reports and status updates in plain, normal language first. Technical identifiers may be included after the explanation.

### Git commits and versions

Never present a commit hash by itself.

Use:

- **Current Yun version — before AI spacing repair** (Git commit: `2c72434`)
- **AI spacing repair version** (Git commit: `d8ed867`)

Do not write only:

- `HEAD 2c72434`
- `candidate d8ed867`
- `SHA abc1234`

Explain what the version represents first.

### Branch names

For new branches, prefer short names that explain the purpose:

- `fix/yun-ai-spacing`
- `feat/mobile-login`
- `chore/website-cleanup`
- `test/match-time-limit`

Avoid cryptic names and unnecessary date suffixes unless a date is genuinely useful.

Do not rename an existing active branch merely to make it prettier if doing so would disrupt upstream tracking, PRs, or other agents. Instead give it a friendly description in reports.

### Worktrees

Name new worktrees by project and purpose, for example:

- `Yun/AI-Fix`
- `Matterhorn/History-Merge`
- `Website/Redesign`

Avoid opaque validation or timestamp-only names.

### Tests and metrics

Translate internal metrics into normal language.

Example:

- **Fake-out plays succeeded: 0** (`FEINT_PULL conversions = 0`)
- **AI changed decisions too often: 374 switches** (`thrash switches = 374`)

Keep the internal metric in parentheses when it helps debugging, but never make it the only explanation.

### Reports

Lead with:

1. What changed.
2. What works.
3. What failed or still needs work.
4. What the owner needs to know or decide.

Put hashes, exact paths, internal test IDs, and other engineering details afterward under **Technical details** when useful.

Use terms such as:

- Current version
- Previous stable version
- Test version
- Candidate version
- Working branch
- Release branch

before exposing raw Git terminology.

## Controlled CI policy

GitHub Actions are allowed across all NorthernStepStudio repositories, but use them deliberately.

- Run local validation first when practical.
- Use CI at meaningful checkpoints.
- Do not push only to trigger CI.
- Avoid duplicate runs for the same change.
- Investigate a failure before rerunning unchanged jobs.
- Treat Actions minutes as a shared studio resource.

Documentation-only commits that do not need CI should use the repository's normal CI-skip convention when supported.

## Technical accuracy

Plain language does not mean hiding engineering detail. Preserve exact technical values when useful for reproducibility; just explain them in terms the owner can understand first.
