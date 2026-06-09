# Feature Boundaries

NStep Game Editor should keep feature code separated so future work does not turn into one giant mixed file.

## Core schema

Folder: `packages/nstep-motion-core/src/schema/`

Owns:

- TypeScript data contracts.
- Project normalization.
- Project validation.
- Project migrations.
- Rest/bind pose data helpers.

Should not own:

- DOM code.
- Canvas interaction code.
- Editor panel rendering.

## Runtime evaluation

Folder: `packages/nstep-motion-core/src/runtime/`

Owns:

- Animation evaluation.
- Controller interpolation.
- Future state machine playback.
- Runtime-safe math.

Should not own:

- Browser dialogs.
- Editor-only UI state.

## Exporters

Folders:

- `packages/nstep-motion-core/src/exporters/`
- `src/exporters/`

Owns:

- Data/code generation for runtimes.
- Image sequence/GIF/export bundle generation.
- Export preflight checks.

Should not own:

- Project editing behavior.
- Canvas selection/dragging behavior.

## Motion editor UI

Folder: `src/motion-editor/`

Owns:

- Canvas renderer and interaction modules.
- Timeline panels.
- Inspector panels.
- Asset and skin panels.
- Pose actions and editor-only utilities.

Should stay split by feature:

- Canvas interaction in `src/motion-editor/canvas/`.
- Timeline in `src/motion-editor/panels/`.
- Pose actions in `src/motion-editor/poseActions.ts`.
- Animation templates in `src/motion-editor/animationTemplates.ts`.

## Rigging

Folder: `src/rigging/`

Owns:

- Rigging workshop UI.
- Skeleton presets.
- Future visual bone creation.
- Future rest pose controls.

Should not own:

- Runtime animation playback.
- Export format generation.

## Sprite cutter

Folder: `src/sprite-cutter/`

Owns:

- Sprite sheet import/cutting.
- Extracted part generation.
- Cutter-specific canvas UI.

## Persistence

Folder: `src/persistence/`

Owns:

- Local save/load.
- Autosave.
- Import/export project actions.
- Future migration entrypoints when loading old projects.

## Rule for new features

Before adding a feature, create or choose a specific module for it. Do not place large new systems directly inside `MotionCanvasRenderer.ts`, `InspectorPanel.ts`, or `ControllerTimelinePanel.ts` unless the code is only small wiring.
