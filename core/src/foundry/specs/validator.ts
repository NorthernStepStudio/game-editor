import type { FoundryStudioSpec } from "./types.js";

export interface FoundrySpecValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export function validateFoundryStudioSpec(spec: FoundryStudioSpec): FoundrySpecValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (spec.protocol !== "nss.foundry.studio-spec.v1") {
    errors.push("Unsupported Foundry StudioSpec protocol.");
  }
  if (!spec.id.trim()) errors.push("StudioSpec id must be non-empty.");
  if (!spec.title.trim()) errors.push("StudioSpec title must be non-empty.");
  if (!spec.goal.trim()) errors.push("StudioSpec goal must be non-empty.");
  if (!spec.artBible.id.trim()) errors.push("ArtBible id must be non-empty.");
  if (!spec.artBible.style.trim()) errors.push("ArtBible style must be non-empty.");
  if (spec.scenes.length === 0) errors.push("StudioSpec must contain at least one scene.");

  validateResolution(spec.artBible.logicalResolution, "ArtBible", errors);
  if (spec.artBible.pixelScale !== undefined && spec.artBible.pixelScale <= 0) {
    errors.push("ArtBible pixelScale must be greater than zero.");
  }

  const palette = spec.artBible.palette ?? [];
  if (new Set(palette.map((entry) => entry.toLowerCase())).size !== palette.length) {
    errors.push("ArtBible palette cannot contain duplicate entries.");
  }

  const sceneIds = new Set<string>();
  for (const scene of spec.scenes) {
    if (!scene.id.trim()) {
      errors.push("Every scene must have a non-empty id.");
      continue;
    }
    if (sceneIds.has(scene.id)) errors.push(`Duplicate scene id: ${scene.id}.`);
    sceneIds.add(scene.id);

    if (!scene.title.trim()) errors.push(`Scene ${scene.id} must have a title.`);
    if (!scene.goal.trim()) errors.push(`Scene ${scene.id} must have a goal.`);
    if (scene.artBibleId && scene.artBibleId !== spec.artBible.id) {
      errors.push(`Scene ${scene.id} references unknown ArtBible ${scene.artBibleId}.`);
    }
    validateResolution(scene.logicalResolution, `Scene ${scene.id}`, errors);

    const actorIds = new Set((scene.actors ?? []).map((actor) => actor.id));
    for (const interaction of scene.interactions ?? []) {
      if (interaction.actorId && !actorIds.has(interaction.actorId)) {
        warnings.push(`Interaction ${interaction.id} references actor ${interaction.actorId} not declared in scene ${scene.id}.`);
      }
    }

    if ((scene.acceptanceCriteria ?? []).some((criterion) => !criterion.trim())) {
      errors.push(`Scene ${scene.id} acceptance criteria cannot contain blank entries.`);
    }
  }

  const budget = spec.performanceBudget;
  if (budget?.targetFps !== undefined && budget.targetFps <= 0) {
    errors.push("Performance targetFps must be greater than zero.");
  }
  if (budget?.maxFrameTimeMs !== undefined && budget.maxFrameTimeMs <= 0) {
    errors.push("Performance maxFrameTimeMs must be greater than zero.");
  }
  if ((spec.finalAcceptanceCriteria ?? []).some((criterion) => !criterion.trim())) {
    errors.push("Final acceptance criteria cannot contain blank entries.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateResolution(
  resolution: { readonly width: number; readonly height: number } | undefined,
  label: string,
  errors: string[],
): void {
  if (!resolution) return;
  if (!Number.isInteger(resolution.width) || !Number.isInteger(resolution.height)) {
    errors.push(`${label} resolution must use integer dimensions.`);
  }
  if (resolution.width <= 0 || resolution.height <= 0) {
    errors.push(`${label} resolution dimensions must be greater than zero.`);
  }
}
