# Northern Step Studio — Canonical Project Map

**Authoritative Reference for All Developers & Agents**  
**Updated:** 2026-09-30 16:30 EDT (Pass 5: Single-Home Policy & Matterhorn Audit)  

---

## 1. Studio Top-Level Directory Taxonomy

- **`D:\dev\Northern Step Studio\games\<project>`** — Canonical source for all games (e.g. Yun).
- **`D:\dev\Northern Step Studio\apps\<project>`** — Canonical source for applications, engines, and tools (e.g. Flyrail, Matterhorn).
- **`D:\dev\Northern Step Studio\build-artifacts\<project>`** — Release packages, build outputs, and frozen validation evidence.
- **`D:\dev\Northern Step Studio\archive\<project>`** — Historical, non-active compressed snapshots.
- **`D:\dev\Northern Step Studio.worktrees\<project>\<purpose>`** — Temporary Git feature worktrees only (when explicitly requested).

---

## 2. Canonical Repositories

### YUN (Street Yun)
- **Repository:** `NorthernStepStudio/Yun`
- **Canonical Game Location:** `D:\dev\Northern Step Studio\games\Yun`
- **Current Development Branch:** `feature/yun-character-intelligence-v4`
- **Current Beta Role:** Normal-only limited beta candidate (`Street Yun 0.1.0-beta.1-preview`)
- **Validated Commit HEAD:** `ac6f8da4f2a8b5f1b9dec63e1b83361156023254`
- **Repository Type:** Standalone Git repository (`.git` is an independent directory).
- **Status:** Single-home canonical game repository. Zero path aliases or junctions.

### FLYRAIL
- **Repository:** `NorthernStepStudio/flyrail`
- **Canonical App Location:** `D:\dev\Northern Step Studio\apps\flyrail`
- **Current Branch:** `feature/playtest-agent-v3-source-repair`
- **Validated Commit HEAD:** `ef91888828acd6a313e8fe3d8364b6ddf16ff18e` (`ef91888`)
- **Remote:** `https://github.com/NorthernStepStudio/flyrail.git`
- **Repository Type:** Standalone primary Git repository.
- **Status:** Single-home canonical repository (1 active location, 0 external worktrees).

### MATTERHORN
- **Repository:** `NorthernStepStudio/matterhorn`
- **Status:** **CONSOLIDATION PENDING**
- **Canonical Target:** `D:\dev\Northern Step Studio\apps\matterhorn` (Branch: `feat/standalone-studio-20260923`, HEAD `71331ed`)
- **Current Monorepo Host:** `D:\dev\Northern Step Studio` (Branch: `feat/studio-control-center-ui-20260924`, HEAD `0e5f91c`)
- **Note:** Pre-consolidation audit complete. Root contains 102 unique commits (Studio Control Center UI, Asset Foundry, website) and 0 external registered worktrees (historical stash worktree 9830089 archived to `build-artifacts\Matterhorn\historical\stash-worktree-9830089\` and removed). apps\matterhorn contains 12 unique commits. Full consolidation pending website decoupling (49 dirty items) and branch/history reconciliation.

### GRIMFALL AGENT
- **Repository:** `NorthernStepStudio/grimfall-agent`
- **Canonical App Location:** `D:\dev\Northern Step Studio\apps\grimfall-agent`
- **Branch:** `main` (HEAD `c6682ff`)
- **Active Feature Worktree:** `D:\dev\Northern Step Studio.worktrees\grimfall-agent\live-input-foundation` (Branch: `feature/live-telemetry-heading`, HEAD `76e2fd5`)
- **Role:** Grimfall gameplay client, live automation harness, and telemetry engine. Feature worktree contains 31 active unmerged heading telemetry commits.

---

## 3. Games Taxonomy & Status

| Role | Path | Type | Branch | HEAD SHA | Status |
|---|---|---|---|---|---|
| **CANONICAL GAME** | `D:\dev\Northern Step Studio\games\Yun` | Standalone Repo | `feature/yun-character-intelligence-v4` | `ac6f8da` | **CONFIRMED** (Street Yun Beta) |
| **MOBILE BUILD SCRATCH** | `D:\dev\Northern Step Studio\games\NooBS game` | Directory | N/A | N/A | **REVIEW** (Android build cache only, no root code) |
| **EXPERIMENT SCRATCH** | `D:\dev\Northern Step Studio\games\roguelike game` | Directory | N/A | N/A | **REVIEW** (Orphaned Python bytecode only) |

---

## 4. Canonical Artifact Root & Archive Structure

### Shared Artifact Root
```text
D:\dev\Northern Step Studio\build-artifacts\
```

### Standardized Structure

```text
build-artifacts\
    Flyrail\
        current\
        logs\
        evidence\
        historical\
            pr29\
            pr30\
            pr35\
            pr36\
            yun-launch-cleanup\
            final-regression\
            source-edit-executor\
            visual-qa\
            yun-save\
    Matterhorn\
        structure-audit\                  <-- root-repo-report.txt
        historical\
            pre-consolidation\            <-- root and apps bundles, metadata, logs
            stash-worktree-9830089\       <-- historical stash bundle, metadata, patches
    Yun\
        CURRENT-BETA.txt                  <-- Authoritative pointer to current validated beta package
        0.1.0-beta.1-preview\
            ac6f8da4f2a8b5f1b9dec63e1b83361156023254\
                package\                  <-- StreetYun ZIP, licenses, BUILD.txt, README-BETA.txt
                evidence\                 <-- 313 AI quality soak logs & run summaries from active beta
                logs\                     <-- Build and Godot execution logs
                screenshots\              <-- Visual QA captures & matrix captures
        historical\
            pre-rehome-yun-repository\    <-- Emergency recovery bundle (yun-all-refs.bundle) & metadata
            pr3-backend-current\
            pr3-validation\
            pr10-source-hardening\
            pr11-verbose-leak\
            beta-rc-3d60954\
            beta-rc-6e1f66c-export\
            beta-rc-6e1f66c-live\
            beta-rc-cba0640-live\
            beta-rc-30b3aab-release\
            launch-export\
            legacy-flyrail-embedded\
```

---

## 5. Worktree Naming Policy

### Future Worktree Directory Pattern
```text
D:\dev\Northern Step Studio.worktrees\<project>\<purpose>
```

### Worktree Rules:
1. Canonical repositories live in `D:\dev\Northern Step Studio\games\<project>` or `D:\dev\Northern Step Studio\apps\<project>`.
2. Compatibility aliases and junctions are strictly forbidden.
3. Temporary Git worktrees may only be created in `D:\dev\Northern Step Studio.worktrees\<project>\<purpose>` for specific, isolated feature branches when explicitly named.
4. Once feature development is complete and merged or validated, the worktree must be cleanly removed and pruned from the parent repository.
