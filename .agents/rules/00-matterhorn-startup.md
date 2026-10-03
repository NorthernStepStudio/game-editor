---
trigger: always_on
description: "Mandatory Matterhorn startup, CI-budget, branch, architecture, and reuse rules for every Antigravity agent session."
---

# Mandatory Matterhorn startup

Before changing files, pushing commits, opening a PR, rerunning CI, or recommending next steps:

1. Read @AGENTS.md.
2. Read @.agents/STARTUP.md.
3. Run `npm run agent:start`.
4. Obey the CI budget output before making repository writes.

Critical rule: iterative autonomous work belongs on `integration/**`, not `feat/**`, because pushes to `feat/**` trigger both Ubuntu and Windows GitHub Actions. Inspect a failed run before triggering another one.

Use `docs/OSS-ACCELERATION.md` and prefer reuse → integrate → customize → build only when needed.
