# NStep Code Motion Editor - Project Structure

## Directory Map

### apps/game-editor/src/
- **app/**: Application bootstrap and routing.
  - `boot.ts`: Main initialization sequence.
  - `router.ts`: Handles page switching (Editor vs Cutter).
- **state/**: Application state split into modules.
  - `appState.ts`: Global view settings and routing flags.
  - `projectState.ts`: The active `CharacterProject` data.
  - `selectionState.ts`: Currently selected part/animation/etc.
  - `playbackState.ts`: Time, playing status, and speed.
  - `dirtyState.ts`: Tracking unsaved changes.
- **motion-editor/**: Animation editor feature.
  - **panels/**: Individual UI cards/panels (Parts, Inspector, etc.).
  - **canvas/**: Rendering loop and specialized drawing logic.
  - **samples/**: Pre-built character rig templates.
- **sprite-cutter/**: Sprite sheet extraction tool.
  - `spriteCutterUi.ts`: Main cutter interface.
  - `spriteCutterLogic.ts`: Pixel extraction and editor integration.
- **persistence/**: LocalStorage and file saving.
  - `saveManager.ts`: CRUD for browser-saved projects.
  - `autosave.ts`: Background saving logic.
- **exporters/**: Application-level export actions.
- **shared/**: Generic utilities (DOM, File, Math).

### packages/nstep-motion-core/src/
- **schema/**: Data models and default object creators.
- **formulas/**: Animation formula presets and types.
- **runtime/**: Centralized logic for evaluating controllers and hierarchies.
- **exporters/**: Godot and Canvas2D runtime generation.

## Development Rules
1. **Unidirectional Flow**: Panels read from state and trigger `onUpdate`.
2. **No Circular Imports**: Shared utilities must not import app state.
3. **Keep Panels Focused**: Each panel in `motion-editor/panels` should handle its own section of the UI.
4. **Logic in Core**: Any logic that is reused in the runtime (like formula evaluation) belongs in `nstep-motion-core`.
