import { validateStudioEvidence, type EvidenceValidation } from "./evidenceValidator.js";
import { createSentinelValidationAssignment } from "./agents/sentinel.js";
import { resolveStudioAgentForExecutionSpecialist } from "./agents/registry.js";
import type { NssStudioExecutionResult, NssStudioSpecialistId } from "./types.js";
import type { NssStudioAgentId } from "./agents/types.js";

export interface SentinelValidationReport extends EvidenceValidation {
  readonly validatorAgentId: "sentinel";
  readonly builderAgentId: NssStudioAgentId;
  readonly acceptanceCriteria: readonly string[];
}

export function runSentinelValidation(
  result: NssStudioExecutionResult,
  executionId: string,
  specialistId: NssStudioSpecialistId,
  criteria: readonly string[],
): SentinelValidationReport {
  const builderAgentId = resolveStudioAgentForExecutionSpecialist(specialistId);
  const assignment = createSentinelValidationAssignment(builderAgentId, criteria);
  const validation = validateStudioEvidence(result, executionId, specialistId, assignment.acceptanceCriteria);
  return { ...validation, validatorAgentId: "sentinel", builderAgentId, acceptanceCriteria: assignment.acceptanceCriteria };
}
