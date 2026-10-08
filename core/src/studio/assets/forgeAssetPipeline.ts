export type NssForgeCleanupStage =
  | "source-mesh"
  | "guided-retopology"
  | "uv-unwrap-pack"
  | "bake-normal"
  | "bake-ao"
  | "bake-vertex-color"
  | "optimize-low-poly"
  | "export"
  | "engine-import"
  | "sentinel-validation";

export type NssForgeBakeMap = "normal" | "ambient-occlusion" | "vertex-color";

export interface NssForgeAssetCleanupPlan {
  readonly id: string;
  readonly sourceAssetUri: string;
  readonly targetName: string;
  readonly targetTriangleBudget: number;
  readonly textureResolution: number;
  readonly bakeMaps: readonly NssForgeBakeMap[];
  readonly exportFormat: "glb" | "gltf";
  readonly engineTarget: "godot";
}

export interface NssForgeStageEvidence {
  readonly stage: NssForgeCleanupStage;
  readonly outcome: "passed" | "failed" | "blocked";
  readonly artifactUris: readonly string[];
  readonly summary: string;
}

export interface NssForgeCleanupValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const FORGE_CLEANUP_STAGES: readonly NssForgeCleanupStage[] = [
  "source-mesh",
  "guided-retopology",
  "uv-unwrap-pack",
  "bake-normal",
  "bake-ao",
  "bake-vertex-color",
  "optimize-low-poly",
  "export",
  "engine-import",
  "sentinel-validation",
];

export function validateForgeAssetCleanupPlan(
  plan: NssForgeAssetCleanupPlan,
): NssForgeCleanupValidation {
  const errors: string[] = [];

  if (!plan.id.trim()) {
    errors.push("Forge cleanup plan id must be non-empty.");
  }
  if (!plan.sourceAssetUri.trim()) {
    errors.push("Forge cleanup plan requires a source asset URI.");
  }
  if (!plan.targetName.trim()) {
    errors.push("Forge cleanup plan target name must be non-empty.");
  }
  if (!Number.isInteger(plan.targetTriangleBudget) || plan.targetTriangleBudget <= 0) {
    errors.push("Forge target triangle budget must be a positive integer.");
  }
  if (!Number.isInteger(plan.textureResolution) || plan.textureResolution <= 0) {
    errors.push("Forge texture resolution must be a positive integer.");
  }
  if ((plan.textureResolution & (plan.textureResolution - 1)) !== 0) {
    errors.push("Forge texture resolution must be a power of two.");
  }
  if (plan.bakeMaps.length === 0) {
    errors.push("Forge cleanup plan requires at least one bake map.");
  }
  if (new Set(plan.bakeMaps).size !== plan.bakeMaps.length) {
    errors.push("Forge cleanup bake maps must be unique.");
  }

  return { valid: errors.length === 0, errors };
}

export function getForgeCleanupStages(
  plan: NssForgeAssetCleanupPlan,
): readonly NssForgeCleanupStage[] {
  const validation = validateForgeAssetCleanupPlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid Forge cleanup plan: ${validation.errors.join(" ")}`);
  }

  return FORGE_CLEANUP_STAGES;
}

export function validateForgeEvidenceSequence(
  evidence: readonly NssForgeStageEvidence[],
): NssForgeCleanupValidation {
  const errors: string[] = [];

  if (evidence.length === 0) {
    return {
      valid: false,
      errors: ["Forge cleanup evidence must contain at least one stage result."],
    };
  }

  for (let index = 0; index < evidence.length; index += 1) {
    const result = evidence[index];
    const expectedStage = FORGE_CLEANUP_STAGES[index];

    if (!expectedStage) {
      errors.push("Forge cleanup evidence contains more stages than the canonical pipeline.");
      break;
    }
    if (result.stage !== expectedStage) {
      errors.push(
        `Forge cleanup evidence stage ${index + 1} must be ${expectedStage}; received ${result.stage}.`,
      );
    }
    if (!result.summary.trim()) {
      errors.push(`Forge cleanup evidence for ${result.stage} requires a summary.`);
    }
    if (result.outcome === "passed" && result.artifactUris.some((uri) => !uri.trim())) {
      errors.push(`Forge cleanup evidence for ${result.stage} contains a blank artifact URI.`);
    }
    if (index > 0 && evidence[index - 1].outcome !== "passed") {
      errors.push(
        `Forge cleanup stage ${result.stage} cannot advance after ${evidence[index - 1].stage} did not pass.`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function forgeCleanupIsComplete(
  evidence: readonly NssForgeStageEvidence[],
): boolean {
  return (
    evidence.length === FORGE_CLEANUP_STAGES.length &&
    validateForgeEvidenceSequence(evidence).valid &&
    evidence.every((result) => result.outcome === "passed") &&
    evidence[evidence.length - 1]?.stage === "sentinel-validation"
  );
}
