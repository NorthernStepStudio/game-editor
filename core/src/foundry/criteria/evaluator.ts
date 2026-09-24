import type {
  FoundryCriterionEvidenceV2,
  FoundryCriterionV2,
} from "./types.js";

export interface FoundryCriterionEvaluation {
  readonly criterion: FoundryCriterionV2;
  readonly evidence?: FoundryCriterionEvidenceV2;
  readonly outcome: "passed" | "failed" | "blocked";
  readonly reason: string;
}

export interface FoundryCriteriaEvaluation {
  readonly executionId: string;
  readonly status: "completed" | "failed" | "blocked";
  readonly results: readonly FoundryCriterionEvaluation[];
}

const DETERMINISTIC_TYPES = new Set<FoundryCriterionV2["type"]>([
  "property_equals",
  "property_range",
  "node_exists",
  "movement_position",
  "health_damage",
  "timed_scenario",
  "visual_similarity",
  "performance_budget",
  "memory_budget",
  "world_state",
  "animation_state",
  "audio_event",
  "input_response",
  "replay_checksum",
  "asset_integrity",
]);

export function evaluateFoundryCriterion(
  criterion: FoundryCriterionV2,
  evidence: FoundryCriterionEvidenceV2 | undefined,
  executionId: string,
): FoundryCriterionEvaluation {
  if (!evidence) {
    return blocked(criterion, "Required criterion evidence is missing.");
  }
  if (evidence.criterionId !== criterion.id) {
    return blocked(criterion, "Criterion evidence identity does not match.", evidence);
  }
  if (evidence.executionId !== executionId) {
    return blocked(criterion, "Criterion evidence executionId does not match.", evidence);
  }
  if (evidence.outcome === "failed") {
    return {
      criterion,
      evidence,
      outcome: "failed",
      reason: "Provider reported criterion failure.",
    };
  }
  if (evidence.outcome === "blocked" || evidence.outcome === "unknown") {
    return blocked(criterion, "Provider did not produce a conclusive measurement.", evidence);
  }

  const evidenceRequired = criterion.evidenceRequired !== false;
  if (evidenceRequired && (evidence.evidenceUris?.length ?? 0) === 0) {
    return blocked(criterion, "Passing evidence must reference persisted evidence.", evidence);
  }

  if (!DETERMINISTIC_TYPES.has(criterion.type)) {
    return {
      criterion,
      evidence,
      outcome: "passed",
      reason: "Provider supplied persisted typed evidence for a non-scalar criterion.",
    };
  }

  if (criterion.expected === undefined) {
    return {
      criterion,
      evidence,
      outcome: "passed",
      reason: "Provider supplied persisted evidence and no expected scalar was declared.",
    };
  }
  if (evidence.actual === undefined) {
    return blocked(criterion, "Criterion requires an actual measured value.", evidence);
  }

  const matched = verifyMeasurement(criterion, evidence.actual);
  return {
    criterion,
    evidence,
    outcome: matched ? "passed" : "failed",
    reason: matched
      ? "Measured value satisfies the criterion."
      : "Measured value does not satisfy the criterion.",
  };
}

export function evaluateFoundryCriteria(
  criteria: readonly FoundryCriterionV2[],
  evidence: readonly FoundryCriterionEvidenceV2[],
  executionId: string,
): FoundryCriteriaEvaluation {
  const results: FoundryCriterionEvaluation[] = [];
  const duplicateCriterionIds = findDuplicates(criteria.map((criterion) => criterion.id));
  const duplicateEvidenceIds = findDuplicates(evidence.map((item) => item.criterionId));

  for (const criterion of criteria) {
    if (duplicateCriterionIds.has(criterion.id)) {
      results.push(blocked(criterion, "Duplicate criterion id in acceptance suite."));
      continue;
    }
    if (duplicateEvidenceIds.has(criterion.id)) {
      results.push(blocked(criterion, "Duplicate evidence returned for criterion."));
      continue;
    }

    const match = evidence.find((item) => item.criterionId === criterion.id);
    results.push(evaluateFoundryCriterion(criterion, match, executionId));
  }

  const status = results.some((result) => result.outcome === "failed")
    ? "failed"
    : results.some((result) => result.outcome === "blocked")
      ? "blocked"
      : "completed";

  return { executionId, status, results };
}

function verifyMeasurement(
  criterion: FoundryCriterionV2,
  actual: unknown,
): boolean {
  switch (criterion.type) {
    case "property_equals":
    case "health_damage":
    case "world_state":
    case "animation_state":
    case "audio_event":
    case "input_response":
    case "replay_checksum":
    case "asset_integrity":
      return equivalent(actual, criterion.expected, criterion.tolerance);

    case "node_exists":
      return Boolean(actual) === Boolean(criterion.expected);

    case "movement_position":
    case "visual_similarity": {
      const measured = numeric(actual);
      const expected = numeric(criterion.expected);
      return measured !== null && expected !== null && measured >= expected;
    }

    case "timed_scenario":
    case "performance_budget":
    case "memory_budget": {
      const measured = numeric(actual);
      const expected = numericBudget(criterion.expected);
      return measured !== null && expected !== null && measured <= expected;
    }

    case "property_range": {
      const measured = numeric(actual);
      const range = rangeBudget(criterion.expected);
      return (
        measured !== null &&
        range !== null &&
        measured >= range.min &&
        measured <= range.max
      );
    }

    default:
      return true;
  }
}

function equivalent(
  actual: unknown,
  expected: unknown,
  tolerance = 0,
): boolean {
  const a = numeric(actual);
  const e = numeric(expected);
  if (a !== null && e !== null) return Math.abs(a - e) <= tolerance;
  if (typeof actual === "string" || typeof expected === "string") {
    return String(actual) === String(expected);
  }
  return stableJson(actual) === stableJson(expected);
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function numericBudget(value: unknown): number | null {
  const direct = numeric(value);
  if (direct !== null) return direct;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["max", "maximum", "budget", "value"]) {
      const candidate = numeric(record[key]);
      if (candidate !== null) return candidate;
    }
  }
  return null;
}

function rangeBudget(
  value: unknown,
): { readonly min: number; readonly max: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const min = numeric(value[0]);
    const max = numeric(value[1]);
    return min !== null && max !== null ? { min, max } : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const min = numeric(record.min);
    const max = numeric(record.max);
    return min !== null && max !== null ? { min, max } : null;
  }
  return null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function findDuplicates(values: readonly string[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function blocked(
  criterion: FoundryCriterionV2,
  reason: string,
  evidence?: FoundryCriterionEvidenceV2,
): FoundryCriterionEvaluation {
  return {
    criterion,
    ...(evidence ? { evidence } : {}),
    outcome: "blocked",
    reason,
  };
}
