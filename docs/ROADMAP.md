# NStep Game Editor Professional Roadmap

This roadmap keeps new systems modular. Each feature should live in its own feature folder or focused schema/runtime module instead of being mixed directly into large UI/render files.

## Phase 1 — Stability foundation

Status: started.

- Add schema versioning.
- Add project validation reports.
- Add project format migration helpers.
- Add rest/bind pose data and actions.
- Add build/typecheck automation.
- Document feature ownership and file boundaries.

## Phase 2 — Rigging quality

- Visual bone creation tools.
- Mirror rig tools.
- Set/reset/apply rest pose UI.
- Safer parent/child movement modes.
- Cyclic-parent prevention everywhere.
- Better bone handles for length, orientation, and pivot placement.

## Phase 3 — Mesh and skinning

- Mesh generation from image bounds.
- Mesh edit mode refinements.
- Weight paint brush.
- Weight normalization.
- Bind pose driven mesh deformation parity between editor and exports.
- Skin validation and per-slot preview.

## Phase 4 — Animation workflow

- Stronger dope sheet selection and multi-keyframe editing.
- Curve editor polish.
- Timeline events panel.
- Animation state machine.
- Transitions and transition preview.
- Blend tree workflow for idle/walk/run/directional movement.

## Phase 5 — Import/export production pipeline

- Versioned `.motion.json` schema docs.
- Export bundle: JSON + assets + runtime.
- Godot scene/resource export.
- Unity package/prefab-style export.
- Partial Spine/DragonBones importers.
- Export preflight validation.

## Phase 6 — Testing and release readiness

- Add unit tests for schema validation/migration/rest pose.
- Add fixture projects for sample rigs.
- Add visual regression checklist.
- Add GitHub Actions for typecheck and build.
- Add release checklist.
