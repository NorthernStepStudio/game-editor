# Northern Step Studio — Machine Workspace Inventory

**Generated:** 2026-09-30 12:20 EDT  
**Updated:** 2026-09-30 16:45 EDT (Pass 6: Safe Final Tightening)  
**Scan Scope:** `D:\dev\Northern Step Studio` and `D:\dev\Northern Step Studio.worktrees`  
**Safety Guarantee:** Verified safe removals only. Zero source modifications. Active canonical trees and Yun beta candidate 100% verified.

---

## 1. Executive Summary

| Metric | Current Count | Initial Count | Cumulative Reduction |
|---|---|---|---|
| **Total Source / Checkout Locations** | **15** | 72 | **-57 locations (79% reduction)** |
| **Yun Active Source Locations** | **1** (`games\Yun`) | 26 | **-25 Yun locations (96% reduction)** |
| **Path Aliases / Junctions** | **0** | 1 (`apps\Yun`) | Removed cleanly |
| **Flyrail Active Locations** | **1** (`apps\flyrail`) | 26 | **-25 Flyrail locations (96% reduction)** |
| **Matterhorn External Worktrees** | **0** | 4 | **4 worktrees removed (100% external worktrees eliminated)** |
| **Grimfall Worktree Location** | `Northern Step Studio.worktrees` | Standardized | Migrated from root `worktrees\` |
| **Cumulative Reclaimed Space** | **14.223 GB (13,563.67 MB)** | 0 MB | **14,222,533,594 bytes freed** |
| **Canonical Games Root** | `D:\dev\Northern Step Studio\games` | Clean | `Yun` exclusively (CANONICAL GAME; NooBS scratch ABSENT) |
| **Canonical Applications Root** | `D:\dev\Northern Step Studio\apps` | Intact | Dedicated applications & engines directory |
| **Canonical Shared Artifact Root** | `D:\dev\Northern Step Studio\build-artifacts` | Intact | Structured package + evidence archive |

---

## 2. Games Post-Reorganization

| Role | Path | Type | Branch | HEAD SHA | Status | Note |
|---|---|---|---|---|---|---|
| **CANONICAL GAME** | `D:\dev\Northern Step Studio\games\Yun` | Standalone Repo | `feature/yun-character-intelligence-v4` | `ac6f8da` | **CONFIRMED** | Street Yun 0.1.0-beta.1-preview Candidate |
| **MOBILE BUILD SCRATCH** | `D:\dev\Northern Step Studio\games\NooBS game` | Directory | N/A | N/A | **KEY_STORAGE** | Android build cache + upload keystores |

---

## 3. Canonical Applications & Engines

| Project / Repo | Path | Type | Branch | HEAD SHA | Status |
|---|---|---|---|---|---|
| **flyrail** | `D:\dev\Northern Step Studio\apps\flyrail` | Main/Clone | `feature/playtest-agent-v3-source-repair` | `ef91888` | **ACTIVE CANONICAL (SINGLE-HOME)** |
| **grimfall-agent** | `D:\dev\Northern Step Studio\apps\grimfall-agent` | Main/Clone | `main` | `c6682ff` | **ACTIVE CANONICAL** |
| **matterhorn** | `D:\dev\Northern Step Studio` | Monorepo Root | `feat/studio-control-center-ui-20260924` | `0e5f91c` | **CONSOLIDATION PENDING** |
| **matterhorn** | `D:\dev\Northern Step Studio\apps\matterhorn` | Main/Clone | `feat/standalone-studio-20260923` | `71331ed` | **CONSOLIDATION PENDING** |
| **Morning-Hub** | `D:\dev\Northern Step Studio\apps\Morning-Hub-fresh` | Main/Clone | `agent/morning-hub-release-gates` | `a9245cb` | Dirty (38 items) |
| **NStep-Video-Factory** | `D:\dev\Northern Step Studio\apps\NStep-Video-Factory` | Main/Clone | `integration/all-branches` | `a3d78c8` | Dirty (8 items) |
| **NexusBuild** | `D:\dev\Northern Step Studio\apps\nexusbuild` | Main/Clone | `main` | `bc6e119` | Dirty (597 items) |
| **RVC-WebUI** | `D:\dev\Northern Step Studio\apps\NStep Audio Engine app\engines\rvc_webui` | Main/Clone | `main` | `7ef1986` | Dirty (4 items) |
| **Synox-Guard** | `D:\dev\Northern Step Studio\apps\Synox-Guard` | Main/Clone | `main` | `fae303d` | Dirty (31 items) |
| **TTS-piper-voice** | `D:\dev\Northern Step Studio\apps\PIPER TTS VOICE` | Main/Clone | `main` | `5a75677` | Dirty (394 items) |
| **game-editor** | `D:\dev\Northern Step Studio\apps\game-editor` | Main/Clone | `main` | `3ae845c` | Dirty (90 items) |
| **prismdesk-desktop** | `D:\dev\Northern Step Studio\apps\prismdesk-desktop` | Main/Clone | `main` | `4581c76` | Dirty (77 items) |
| **signatempu** | `D:\dev\Northern Step Studio\apps\SignaTempu` | Main/Clone | `main` | `3db071c` | Dirty (19 items) |
