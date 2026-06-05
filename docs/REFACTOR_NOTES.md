# Refactor Notes - Project Organization

## Changes Summary
- Reorganized `apps/game-editor/src` from a flat structure into feature-based modules.
- Refactored `AppState` into multiple specialized state modules (`projectState`, `selectionState`, etc.) to prevent a single massive state object.
- Split the monolithic `renderer.ts` into a class-based `MotionCanvasRenderer` and specialized rendering modules for shapes and overlays.
- Organized UI components into `panels` for better maintainability.
- Consolidated formula evaluation logic into `nstep-motion-core/src/runtime/evaluateController.ts` to ensure consistency between the live editor, exported Godot code, and Canvas runtime.
- Fixed several TypeScript syntax errors in the Godot exporter and Sprite Cutter logic.

## Moved Files
| Old Path | New Path |
| --- | --- |
| `src/main.ts` | `src/main.ts` (Refactored to small entry point) |
| `src/state.ts` | `src/state/*.ts` |
| `src/ui.ts` | `src/motion-editor/motionEditorUi.ts` + `src/motion-editor/panels/*.ts` |
| `src/renderer.ts` | `src/motion-editor/canvas/*.ts` |
| `src/autosave.ts` | `src/persistence/*.ts` |
| `src/exporters.ts` | `src/exporters/exportActions.ts` |
| `src/samples/*.ts` | `src/motion-editor/samples/*.ts` |
| `src/cutter/*.ts` | `src/sprite-cutter/*.ts` |

## Verification Results
- **Build**: Success (`npm run build`).
- **Dev Server**: Running (`npm run dev`).
- **Persistence**: Verified `localStorage` projects still load correctly (compatible with old schemas via normalizers).
- **Functionality**:
  - Hero/Enemy samples load.
  - Animation switching works.
  - Pivot editing works.
  - Export (JSON, Godot, Demo) works.
  - Sprite Cutter placeholder integrated.

## Next Steps
- Implement full Sprite Sheet Cutter logic in the new `sprite-cutter/` directory.
- Add "Mirror" and "Duplicate" actions to the Inspector/Controller panels using the new structure.
