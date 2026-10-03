import type { FoundryVerificationReport } from "../verification/types.js";
import { measureFoundryCriterionFromSnapshot } from "./runtimeEvidence.js";
import type {
  FoundryCriterionEvidenceV2,
  FoundryCriterionV2,
} from "./types.js";

export function measureFoundryCriterionFromVerificationReport(
  criterion: FoundryCriterionV2,
  report: FoundryVerificationReport,
  evidenceUri: string,
): FoundryCriterionEvidenceV2 {
  const base = {
    criterionId: criterion.id,
    executionId: report.executionId,
    evidenceUris: [evidenceUri],
    timestamp: report.completedAt,
  } as const;

  if (criterion.type === "replay_checksum") {
    return {
      ...base,
      outcome: "passed",
      actual: report.stateHash,
    };
  }

  if (report.finalSnapshot) {
    return measureFoundryCriterionFromSnapshot(
      criterion,
      report.finalSnapshot,
      report.executionId,
      evidenceUri,
    );
  }

  return { ...base, outcome: "unknown" };
}

export function measureFoundryCriteriaFromVerificationReport(
  criteria: readonly FoundryCriterionV2[],
  report: FoundryVerificationReport,
  evidenceUri: string,
): readonly FoundryCriterionEvidenceV2[] {
  return criteria.map((criterion) =>
    measureFoundryCriterionFromVerificationReport(
      criterion,
      report,
      evidenceUri,
    ),
  );
}
