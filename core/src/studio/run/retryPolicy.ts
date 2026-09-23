/**
 * Bounded Studio Retry Policy.
 *
 * Controls cross-specialist task retries at the Studio Orchestration layer.
 * Separate from specialist-internal repair loops (e.g. Flyrail GDScript fix attempts).
 */

import { SpecialistError, type SpecialistErrorCode } from "../adapters/types.js";

export interface StudioRetryPolicyOptions {
  /** Maximum Studio-level task attempts (default: 2). */
  maxTaskAttempts?: number;
}

const NON_RETRYABLE_CODES: ReadonlySet<SpecialistErrorCode> = new Set([
  "PERMISSION_DENIED",
  "PROTOCOL_MISMATCH",
  "UNSUPPORTED_CAPABILITY",
  "INVALID_TASK",
  "GODOT_UNAVAILABLE",
]);

export class StudioRetryPolicy {
  readonly maxTaskAttempts: number;

  constructor(options: StudioRetryPolicyOptions = {}) {
    this.maxTaskAttempts = options.maxTaskAttempts ?? 2;
  }

  shouldRetry(attempt: number, error: unknown): boolean {
    if (attempt >= this.maxTaskAttempts) {
      return false;
    }

    if (error instanceof SpecialistError) {
      if (NON_RETRYABLE_CODES.has(error.code)) {
        return false;
      }
      return error.recoverable;
    }

    // Generic Error default: retry if under attempt limit
    return true;
  }
}
