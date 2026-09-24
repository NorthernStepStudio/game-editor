import type { NssStudioExecutionResult } from "./types.js";
import {
  findStudioCriterionResult,
  parseFoundryStudioCriterion,
  validateFoundryCriteriaInStudioResult,
} from "./foundryCriteriaBridge.js";

export interface EvidenceValidation {
  valid: boolean;
  failed: boolean;
  detail: string;
}

export function validateStudioEvidence(
  result: NssStudioExecutionResult,
  executionId: string,
  specialistId: string,
  criteria: readonly string[],
): EvidenceValidation {
  if (result.taskId !== executionId || result.specialistId !== specialistId) {
    return { valid: false, failed: true, detail: "Result identity mismatch." };
  }
  if (result.status !== "completed") {
    return {
      valid: false,
      failed: result.status === "failed",
      detail: result.summary,
    };
  }
  if (result.evidence?.some((e) => e.outcome === "failed")) {
    return {
      valid: false,
      failed: true,
      detail: "Returned evidence contains failed checks.",
    };
  }

  for (const criterion of criteria) {
    const parsedFoundry = parseFoundryStudioCriterion(criterion);
    const checks = parsedFoundry
      ? [findStudioCriterionResult(result, parsedFoundry)].filter(
          (item): item is NonNullable<typeof item> => item !== undefined,
        )
      : (result.criterionResults?.filter((c) => c.criterion === criterion) ?? []);

    if (checks.some((c) => c.outcome === "failed")) {
      return {
        valid: false,
        failed: true,
        detail: `Acceptance failed: ${criterion}`,
      };
    }
    if (
      checks.length !== 1 ||
      checks[0].outcome !== "passed" ||
      !checks[0].evidenceUri?.trim()
    ) {
      return {
        valid: false,
        failed: false,
        detail: `Missing verified evidence for: ${criterion}`,
      };
    }
    if (
      !result.evidence?.some(
        (e) => e.uri === checks[0].evidenceUri && e.outcome === "passed",
      )
    ) {
      return {
        valid: false,
        failed: false,
        detail: `Acceptance evidence is not present in result: ${criterion}`,
      };
    }
  }

  const foundry = validateFoundryCriteriaInStudioResult(
    criteria,
    result,
    executionId,
  );
  if (foundry.applicable && !foundry.passed) {
    return {
      valid: false,
      failed: foundry.failed,
      detail: foundry.detail,
    };
  }

  return {
    valid: true,
    failed: false,
    detail: foundry.applicable
      ? "Acceptance criteria and Foundry Criterion V2 evidence passed."
      : "Acceptance criteria supported by returned evidence.",
  };
}
