import { SpecialistError } from '../adapters/types.js';
export interface StudioRetryPolicyOptions { maxTaskAttempts?: number }
/** Applies to retryable reads only. Submitted mutations must not be replayed. */
export class StudioRetryPolicy {
  readonly maxTaskAttempts: number;
  constructor(options: StudioRetryPolicyOptions = {}) { this.maxTaskAttempts = options.maxTaskAttempts ?? 2; }
  shouldRetry(attempt: number, error: unknown): boolean {
    return attempt < this.maxTaskAttempts && error instanceof SpecialistError && error.recoverable && ['SPECIALIST_UNAVAILABLE','TRANSPORT_ERROR'].includes(error.code);
  }
}
