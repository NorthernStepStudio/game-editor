# Gate 0 — canonical autonomy local validation

This gate validates the October 3 consolidation **without GitHub Actions**.

## Canonical refs

- Matterhorn: `integration/oss-acceleration-rebased-20261003` (based on `integration/studio-autonomy-20261003` at `389d8adbc2bb748df6311b07896673933a59cad3`)
- Flyrail: `integration/godot-ai-backend-20261003`

Do not substitute a different branch and do not promote Matterhorn 100 stages from historical CI on older branches.

## Matterhorn local gate

From the Matterhorn repository root:

```powershell
git status --short
git branch --show-current
npm install
npm run gate:autonomy-local
```

Expected branch: `integration/oss-acceleration-rebased-20261003`.

The gate compiles core + server and runs focused coverage for:
- Studio agent separation / Sentinel
- Studio run controller, queue and restart recovery
- Flyrail evidence contracts
- criterion validation
- recovered Foundry foundation, provenance and providers
- recovered Intelligence Layer and provider adapters
- Blender adapter contract
- recovered multi-domain planner
- Studio API
- routing settings
- Intelligence sessions/tools
- Matterhorn 100 scorecard
- persistent Studio history
- Matterhorn runtime capability boundary (browser, memory, telemetry, evaluation, safe execution)
- binary asset lease/hash protection
- dirty-tree mutation guard
- isolated specialist Git workspace behavior
- snapshot-bound human promotion approval
- mandatory agent startup/CI-budget contract
- standalone web tests

**PASS** requires exit code 0 for the complete command. A partial set of green tests is not a pass.

## Flyrail local gate

From the Flyrail repository root:

```powershell
git status --short
git branch --show-current
npm install
npm run gate:autonomy-local
```

Expected branch: `integration/godot-ai-backend-20261003`.

The gate compiles/tests:
- Godot client, including Godot AI + Hybrid bridge
- loopback-only legacy editor transport
- transport factory/backend selection
- autonomous loop
- daemon
- Codex worker integration surface
- reusable visual-target / Godot 3D production skills

**PASS** requires exit code 0 for the complete command.

## Fail-closed handling

If either command fails:

1. Do not open a pull request.
2. Do not trigger GitHub Actions merely to get a second opinion.
3. Capture the first compiler/test failure and its complete nearby output.
4. Fix the root cause on the same integration branch.
5. Re-run the entire affected repository gate.
6. Do not update Matterhorn 100 to a verified stage until the whole repository gate passes.

## After both local gates pass

Run the real live proof on the PC.

Required runtime:
- Godot 4.7.2
- Yun project
- Flyrail daemon
- Godot AI plugin/attach configuration when available
- Matterhorn standalone server

Canonical proof request:

> Add/verify a match time limit so an overlong match ends automatically. At timeout, the player/team with the most points wins; an exact tie has no winner. Also make difficulty stars clearly visible. Preserve existing gameplay and UI behavior.

The proof must travel through:

```text
Matterhorn plan
  -> Flyrail
  -> Codex + Godot AI where configured
  -> real Yun project
  -> validation/scenario/playtest
  -> Sentinel
  -> Matterhorn final acceptance
```

Required evidence:
- exact canonical commit SHAs
- generated Studio plan
- Flyrail run ID
- actual files/editor objects changed
- Godot validation result
- scenario result
- playtest result when the manifest supports it
- fresh screenshot proving star visibility
- timeout outcome showing higher score wins
- tie timeout outcome showing no winner
- Sentinel criterion results
- repair evidence if a first attempt fails

Only after this live proof passes should relevant Matterhorn 100 requirements move from `implemented/local_verified` to `live_verified`.

## No score inflation

Gate 0 can raise **production readiness** substantially without adding new features, because several recovered systems are currently scored only as implemented until this exact canonical branch is proven.

Do not change capability coverage merely because tests pass; capability coverage changes when capabilities are added/removed. Verification primarily changes production readiness.
