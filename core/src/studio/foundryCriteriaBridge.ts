import {
  evaluateFoundryCriteria,
  type FoundryCriteriaEvaluation,
  type FoundryCriterionEvidenceV2,
  type FoundryCriterionType,
  type FoundryCriterionV2,
} from "../foundry/criteria/index.js";
import type {
  NssStudioCriterionResult,
  NssStudioExecutionResult,
} from "./types.js";

const FOUNDRY_CRITERION_TYPES = new Set<FoundryCriterionType>([
  "property_equals",
  "property_range",
  "node_exists",
  "movement_position",
  "health_damage",
  "timed_scenario",
  "visual_baseline",
  "visual_similarity",
  "composition",
  "pixel_integrity",
  "palette_constraint",
  "animation_state",
  "animation_loop",
  "semantic_ui",
  "world_state",
  "collision",
  "navigation",
  "performance_budget",
  "memory_budget",
  "audio_event",
  "input_response",
  "replay_checksum",
  "asset_integrity",
  "generic",
]);

export interface ParsedFoundryStudioCriterion {
  readonly raw: string;
  readonly criterion: FoundryCriterionV2;
}

export interface FoundryStudioCriteriaValidation {
  readonly applicable: boolean;
  readonly passed: boolean;
  readonly failed: boolean;
  readonly detail: string;
  readonly evaluation?: FoundryCriteriaEvaluation;
}

export function parseFoundryStudioCriterion(
  raw: string,
): ParsedFoundryStudioCriterion | null {
  if (!raw.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.protocol !== "nss.foundry.criterion.v2") return null;
    if (
      typeof parsed.id !== "string" ||
      !parsed.id.trim() ||
      typeof parsed.description !== "string" ||
      !parsed.description.trim() ||
      typeof parsed.type !== "string" ||
      !FOUNDRY_CRITERION_TYPES.has(parsed.type as FoundryCriterionType)
    ) {
      return null;
    }

    return {
      raw,
      criterion: {
        protocol: "nss.foundry.criterion.v2",
        id: parsed.id,
        description: parsed.description,
        type: parsed.type as FoundryCriterionType,
        ...(typeof parsed.target === "string" ? { target: parsed.target } : {}),
        ...(parsed.expected !== undefined ? { expected: parsed.expected } : {}),
        ...(typeof parsed.tolerance === "number"
          ? { tolerance: parsed.tolerance }
          : {}),
        ...(typeof parsed.evidenceRequired === "boolean"
          ? { evidenceRequired: parsed.evidenceRequired }
          : {}),
        ...(Array.isArray(parsed.tags)
          ? { tags: parsed.tags.filter((tag): tag is string => typeof tag === "string") }
          : {}),
      },
    };
  } catch {
    return null;
  }
}

export function findStudioCriterionResult(
  result: NssStudioExecutionResult,
  parsed: ParsedFoundryStudioCriterion,
): NssStudioCriterionResult | undefined {
  return result.criterionResults?.find(
    (candidate) =>
      candidate.criterionId === parsed.criterion.id ||
      candidate.criterion === parsed.raw ||
      candidate.description === parsed.criterion.description,
  );
}

export function validateFoundryCriteriaInStudioResult(
  acceptanceCriteria: readonly string[],
  result: NssStudioExecutionResult,
  executionId: string,
): FoundryStudioCriteriaValidation {
  const parsed = acceptanceCriteria
    .map(parseFoundryStudioCriterion)
    .filter((item): item is ParsedFoundryStudioCriterion => item !== null);

  if (parsed.length === 0) {
    return {
      applicable: false,
      passed: true,
      failed: false,
      detail: "No Foundry Criterion V2 checks are present.",
    };
  }

  const evidence: FoundryCriterionEvidenceV2[] = [];
  for (const item of parsed) {
    const match = findStudioCriterionResult(result, item);
    if (!match) continue;
    evidence.push({
      criterionId: item.criterion.id,
      executionId: match.executionId ?? executionId,
      outcome: match.outcome,
      ...(match.actual !== undefined ? { actual: match.actual } : {}),
      ...(match.evidenceUri ? { evidenceUris: [match.evidenceUri] } : {}),
      timestamp: match.timestamp ?? "unknown",
    });
  }

  const evaluation = evaluateFoundryCriteria(
    parsed.map((item) => item.criterion),
    evidence,
    executionId,
  );
  const failed = evaluation.status === "failed";
  const blocked = evaluation.status === "blocked";
  const failures = evaluation.results
    .filter((item) => item.outcome !== "passed")
    .map((item) => `${item.criterion.id}: ${item.reason}`);

  return {
    applicable: true,
    passed: evaluation.status === "completed",
    failed,
    detail: failed
      ? `Foundry acceptance failed: ${failures.join("; ")}`
      : blocked
        ? `Foundry acceptance blocked: ${failures.join("; ")}`
        : "Foundry Criterion V2 evidence passed.",
    evaluation,
  };
}
