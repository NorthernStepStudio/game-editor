import { getStudioAgent } from "./registry.js";
import type { NssStudioAgentId } from "./types.js";

export interface NssStudioValidationAssignment {
  readonly builderAgentId: NssStudioAgentId;
  readonly validatorAgentId: "sentinel";
  readonly acceptanceCriteria: readonly string[];
}

export function createSentinelValidationAssignment(builderAgentId: NssStudioAgentId, acceptanceCriteria: readonly string[]): NssStudioValidationAssignment {
  const builder = getStudioAgent(builderAgentId);
  const validator = getStudioAgent("sentinel");
  if (builder.id === validator.id) throw new Error("Sentinel cannot be the builder and validator for the same work.");
  if (validator.kind !== "validator") throw new Error("Sentinel must remain registered as a validator.");
  const criteria = acceptanceCriteria.map(criterion => criterion.trim());
  if (!criteria.length || criteria.some(criterion => !criterion)) throw new Error("Independent validation requires non-empty acceptance criteria.");
  return { builderAgentId: builder.id, validatorAgentId: "sentinel", acceptanceCriteria: criteria };
}
