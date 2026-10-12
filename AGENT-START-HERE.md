# Agent Start Here — Machine-Level Entry Instructions

**MANDATORY FOR ALL AI AGENTS WORKING ON THIS MACHINE**  
**Effective:** 2026-09-30 (Pass 5: Absolute Source Discovery Rule)  

---

## Absolute Source Discovery Rule

When assigned a task for any studio project, agents MUST follow this absolute rule:

1. **FOR A GAME:**
   - **`D:\dev\Northern Step Studio\games\<project>`**
   - Example: Yun (Street Yun) is exclusively located at `D:\dev\Northern Step Studio\games\Yun`

2. **FOR EVERYTHING ELSE:**
   - **`D:\dev\Northern Step Studio\apps\<project>`**
   - Example: Flyrail is exclusively located at `D:\dev\Northern Step Studio\apps\flyrail`
   - Example: Grimfall Agent is located at `D:\dev\Northern Step Studio\apps\grimfall-agent`

3. **THEN CONSULT:**
   - **`D:\dev\Northern Step Studio\WORKSPACES.md`** (The authoritative studio mapping file)

4. **ONLY USE TEMPORARY WORKTREES WHEN EXPLICITLY NAMED:**
   - **`D:\dev\Northern Step Studio.worktrees\<project>\<purpose>`**
   - Use this location ONLY when a task prompt explicitly specifies a temporary worktree.

### Absolute Policy Against Compatibility Aliases
- **DO NOT support compatibility aliases.**
- **DO NOT use junctions or symlinks to make old paths continue working.**
- **If an old path is referenced (e.g. `apps\Yun`): FIX THE REFERENCE immediately to point to the canonical single-home location.**

---

## Critical Roaming Ban

**NEVER search or execute from:**
- `tmp\`
- `archive\`
- `build-artifacts\`
- Old validation folders
- Other unrelated repositories

Agents must NEVER roam the entire `D:\dev` tree looking for projects when a canonical `games\<project>` or `apps\<project>` checkout exists.

---

## The Cardinal Rules

### 1. Always Start in Canonical `games\<project>` or `apps\<project>`
For game development, always begin in `D:\dev\Northern Step Studio\games\<project>`. For app/tool development, begin in `D:\dev\Northern Step Studio\apps\<project>`. Only use `.worktrees` when a task explicitly instructs work in a dedicated worktree.

### 2. Verify Repository Identity First
Before reading, modifying, or executing code, verify repository identity:
```powershell
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short
```

### 3. Cross-Check Against WORKSPACES.md
Compare your detected repository, path, and branch against `D:\dev\Northern Step Studio\WORKSPACES.md`.

### 4. Stop on Mismatch
If your current repository or branch does not match the canonical map in `WORKSPACES.md`:
**STOP IMMEDIATELY AND LOCATE THE CANONICAL CHECKOUT IN `games\` OR `apps\`.** Do not begin modifying the wrong repository.

### 5. Never Search Archive or Build-Artifacts for Source
- `build-artifacts\` contains compiled binaries, releases, evidence, and frozen test traces.
- `archive\` contains historical non-active compressed material.
Source code must never be read or edited from these directories.

### 6. Never Export from a Dirty Tree
Never export or package a release binary from a dirty working tree without explicitly documenting every uncommitted modification and receiving user confirmation.

### 7. Record Exact Commit SHA on Releases
Every final release package, ZIP archive, and `BUILD.txt` manifest must record the exact 40-character Git commit SHA from which it was compiled.

### 8. Protected Sensitive Material
private-keys\ is protected sensitive material and must never be searched unless a task explicitly requires authorized key management.
