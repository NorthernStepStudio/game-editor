import type { FoundryReplayBundle } from "./types.js";

export interface FoundryReplayValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateFoundryReplayBundle(
  bundle: FoundryReplayBundle,
): FoundryReplayValidation {
  const errors: string[] = [];

  if (bundle.protocol !== "nss.foundry.replay.v1") {
    errors.push("Unsupported replay protocol.");
  }
  if (!bundle.executionId.trim()) {
    errors.push("Replay executionId must be non-empty.");
  }
  if (bundle.seed !== undefined && !Number.isInteger(bundle.seed)) {
    errors.push("Replay seed must be an integer.");
  }

  let previousFrame = -1;
  for (const entry of bundle.timeline ?? []) {
    if (!Number.isInteger(entry.frame) || entry.frame < 0) {
      errors.push("Replay timeline frames must be non-negative integers.");
      break;
    }
    if (entry.frame < previousFrame) {
      errors.push("Replay timeline must be sorted by frame.");
      break;
    }
    previousFrame = entry.frame;
  }

  previousFrame = -1;
  for (const checkpoint of bundle.checkpoints ?? []) {
    if (!Number.isInteger(checkpoint.frame) || checkpoint.frame < 0) {
      errors.push("Replay checkpoint frames must be non-negative integers.");
      break;
    }
    if (checkpoint.frame < previousFrame) {
      errors.push("Replay checkpoints must be sorted by frame.");
      break;
    }
    previousFrame = checkpoint.frame;
  }

  const refs = Object.values(bundle.evidence).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (refs.length === 0) {
    errors.push("Replay bundle must reference persisted evidence.");
  }

  return { valid: errors.length === 0, errors };
}
