# Matterhorn agent instructions

Mandatory startup for every Antigravity/Gemini agent session:

1. Read `AGENTS.md`.
2. Read `.agents/STARTUP.md`.
3. Run `npm run agent:start`.
4. Obey the CI-budget and branch result before repository writes.

Iterative autonomous work belongs on `integration/**`. Do not repeatedly push to `feat/**`; those pushes trigger the Ubuntu + Windows CI matrix.

The canonical instructions remain in `AGENTS.md` and `.agents/STARTUP.md`.
