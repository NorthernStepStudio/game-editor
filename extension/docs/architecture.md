# NStep Workspace AI App Architecture

This folder is the active app home for the VS Code extension.

Current implementation shape:

- `src/extension.ts` owns activation and controller orchestration
- `src/commands/*` owns typed command entry points and registration
- `src/services/*` owns most runtime logic
- `src/helpers/*` owns low-level utilities
- `src/state/*` owns selectors and domain-specific state helpers
- `src/storage/*` owns storage keys, limits, migration, and pruning
- `src/sidebar/*` owns the webview sidebar
- `src/api/*` owns backend request building and transport

Follow-up cleanup that is still reasonable:

- keep pushing logic down into services instead of growing `extension.ts`
- keep narrowing duplicated prompt flows into shared helpers where it makes the UX clearer
