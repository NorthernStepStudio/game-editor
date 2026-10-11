# Northern Step Studio — Visible Creation Mode

Visible Creation Mode is the default workflow whenever an agent creates or substantially modifies a visual asset. It applies to characters, buildings, environments, props, animation, UI art, materials, textures, lighting and other work whose quality must be judged visually.

## Activation

- When the owner is present at the PC, use Visible Creation Mode unless the owner explicitly says `run it in the background` or `finish it without me`.
- A request for automation does not disable visible review. Automation must feed the visible authoring application.
- Diagnostics, inventory work and documentation are not visual-asset creation. They may run normally, but they may not be presented as visual approval.

## Required applications

Use the real application whenever practical:

- Blender for 3D creation and modification.
- Godot for Yun placement, scale and gameplay-camera review.
- The relevant image editor or render viewer for 2D work.
- Character Lab for procedural character work when that is the selected production tool.

Headless scripts may generate or modify assets, but their results must be loaded or refreshed in the visible application before the checkpoint is reported.

## Before editing the asset

1. Show the current asset or an empty/blockout scene in the visible authoring application.
2. Identify the real game asset used as the scale or compatibility reference.
3. Preserve the last known-good version. Never overwrite the only approved or reviewable copy.
4. State the checkpoint being prepared in plain language.

For an original character based on Yun's current gameplay scale, a Kenney character may be visible as a locked, non-exporting measurement reference. Do not duplicate, edit, retopologize over, or export its mesh when the goal is a fully studio-original character. Build the new mesh, rig, materials and animation data from zero.

## Checkpoint state machine

Each checkpoint ends in `AWAITING OWNER REVIEW`. Do not begin the next major checkpoint until the owner approves the current one or supplies corrections.

If the owner requests a correction:

1. Make that correction before adding later-stage work.
2. Show the corrected version in the same required views.
3. Return to `AWAITING OWNER REVIEW`.

Approval of one checkpoint does not approve later checkpoints or promote the asset for release.

### v01-blockout

Show overall height, width, depth, silhouette and major proportions.

- Yun environments: close creation view and Yun gameplay-camera view.
- Characters: front, side and three-quarter views; include the current gameplay scale reference.

Stop and wait for owner review.

### v02-structure

Show the major forms: architectural structure, doors, windows, stairs, balcony and roof; or body forms, limbs and primary features for a character.

Stop and wait for owner review.

### v03-details

Show secondary forms, trims, utilities, accessories, props and other readable detail.

Stop and wait for owner review.

### v04-materials

Show the material and color pass under useful neutral lighting and the intended game lighting when relevant.

Stop and wait for owner review.

### v05-final

Show the asset in the actual game with the actual gameplay camera, current scale reference, lighting and environment. For Yun, use a current shipping gameplay character, not an experimental replacement.

Stop and wait for final owner review. Do not mount, promote, replace defaults or remove fallbacks without the required authorization.

## Saved iterations

Preserve meaningful versions using these labels:

- `v01-blockout`
- `v02-structure`
- `v03-details`
- `v04-materials`
- `v05-final`

Each saved checkpoint must contain or identify:

- The editable source file.
- The visible preview/render or viewport capture.
- For game assets, the corresponding game-camera capture when required.
- A short note describing what changed and whether the owner approved it.

Corrections may add a short suffix such as `v02-structure-r2`. Do not silently replace an already reviewed checkpoint.

## Visual evidence is the gate

The following support a review but never replace it:

- JSON validation.
- Triangle, vertex or material counts.
- Logs and generated-file lists.
- Headless tests.
- Textual descriptions.

An asset cannot be called visually approved unless the owner was shown the required visible views and approved them. Technical pass, visual pass and release promotion are separate states.

## Reporting format

Lead with the visual result and current review state:

> Balcony and second-floor proportions are ready for review. The Blender close view and Yun gameplay-camera view are open. Work is paused at v02-structure.

Technical details may follow, but they remain secondary.

## Yun environment and character requirements

- Keep a useful close creation view and Yun gameplay-camera view available throughout environment work.
- Use the actual current Yun gameplay character for scale validation.
- For original characters, show front, side, three-quarter and gameplay views.
- Preserve current gameplay dimensions, collision clearances, camera behavior and fallbacks until the replacement is approved.
- Keep House 01, House 02 and every other approved candidate version recoverable while later assets are created.

