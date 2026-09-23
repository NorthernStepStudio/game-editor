# Standalone workspace migration

## Delivered

| Extension capability | Standalone replacement |
| --- | --- |
| Read/explain active file | Projects source browser and Explain action |
| Ask about a file / plan a change | File prompt and Plan change action |
| Propose edit / propose fix | Propose edit and Diagnose error actions; concrete model output creates a pending review |
| Codebase search | Bounded literal text search with filename/line results |
| Review preview / original-content check | Before/after review and SHA-256 stale-version guard |
| Approve/apply/reject file edit | Explicit review actions; no automatic application |
| Recover original content | Persisted backup and guarded Restore original file |
| Review history | On-disk proposal journal, reloadable after restart |

No VS Code API is used by these replacements. All paths are relative to server-configured project roots. Existing source files only; no delete, file-creation or terminal execution routes are exposed by this milestone. Sensitive filename/content exclusions are conservative heuristics, not a full secret scanner.

Review records preserve original and proposed text. Applying/restoring first persists an intermediate journal state, writes through an exclusive temporary file in the same directory, then records completion. After restart, intermediate records are reconciled against current content hashes. Unknown content becomes conflict instead of being overwritten. Backups are ordinary local files, not encrypted storage. The history limit is 200 records; archive the configured local storage directory when needed.

## Remaining migrations

1. Multi-file proposals and transactional apply/rollback, new-file creation and selection-specific editing.
2. Configured validation tasks, task-result comparisons, diagnostic sessions, repair patterns and related-file discovery.
3. Project rules, durable workspace memory, knowledge-pack indexing and semantic search.
4. Presets, guided workflows, roadmap notes and cross-project summaries.
5. Retire the optional extension only after these capabilities have replacements and PC checks pass.

## Following platform milestones

- Persist Studio run/evidence history and reconcile interrupted runs with the daemon. Never resume or duplicate an uncertain mutation automatically.
- Add executable task-specific acceptance checks; generic engine validation cannot prove requested gameplay behavior.
- Pass the real Matterhorn → Flyrail → Godot gate, including visual PC checks.
- Begin Blender integration after that gate, following the agreed sequencing.
