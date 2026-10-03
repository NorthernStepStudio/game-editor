# Matterhorn repository instructions

Before proposing or changing implementation:

- Read `AGENTS.md` and `.agents/STARTUP.md`.
- Run `npm run agent:start`.
- Use `integration/**` for iterative autonomous work.
- Do not repeatedly push to `feat/**`; pushes there trigger Ubuntu + Windows GitHub Actions.
- Inspect a failed job/log before another intentional CI attempt.
- Prefer reuse → integrate → customize → build only when needed for generic infrastructure.
- Preserve Matterhorn-owned product identity and Agent → Skill → Adapter boundaries.
