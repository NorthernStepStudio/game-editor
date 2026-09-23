/**
 * Specialist adapter types — transport-neutral contract between
 * the Matterhorn orchestrator and any execution specialist.
 *
 * This file is intentionally specialist-agnostic.  Flyrail, Blender,
 * and every future specialist adapter implement the same interface.
 */

import type {
  NssStudioExecutionResult,
  NssStudioHandoff,
  NssStudioSpecialistId,
} from "../types.js";

// ── Health ──────────────────────────────────────────────────────────

export interface SpecialistHealthResult {
  readonly available: boolean;
  readonly specialistId: NssStudioSpecialistId;
  readonly version?: string;
  readonly protocolVersion?: string;
  readonly capabilities?: readonly string[];
  readonly detail?: string;
}

// ── Capabilities ────────────────────────────────────────────────────

export interface SpecialistCapabilitySet {
  readonly specialistId: NssStudioSpecialistId;
  readonly protocolVersion: string;
  readonly capabilities: readonly string[];
}

// ── Task handles ────────────────────────────────────────────────────

export interface SpecialistTaskHandle {
  readonly taskId: string;
  readonly specialistId: NssStudioSpecialistId;
  readonly accepted: boolean;
  readonly detail?: string;
}

export type SpecialistTaskPhase =
  | "accepted"
  | "running"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

export interface SpecialistTaskStatus {
  readonly taskId: string;
  readonly specialistId: NssStudioSpecialistId;
  readonly phase: SpecialistTaskPhase;
  readonly detail?: string;
  readonly progress?: number;
}

export interface SpecialistCancelResult {
  readonly taskId: string;
  readonly cancelled: boolean;
  readonly detail?: string;
}

// ── Errors ──────────────────────────────────────────────────────────

export type SpecialistErrorCode =
  | "SPECIALIST_UNAVAILABLE"
  | "PROTOCOL_MISMATCH"
  | "INVALID_TASK"
  | "GODOT_UNAVAILABLE"
  | "PROJECT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "EXECUTION_FAILED"
  | "TEST_FAILED"
  | "VALIDATION_FAILED"
  | "TIMEOUT"
  | "CANCELLED"
  | "RETRY_EXHAUSTED"
  | "UNSUPPORTED_CAPABILITY"
  | "TRANSPORT_ERROR";

export class SpecialistError extends Error {
  readonly code: SpecialistErrorCode;
  readonly recoverable: boolean;
  readonly details?: unknown;

  constructor(
    code: SpecialistErrorCode,
    message: string,
    options?: { recoverable?: boolean; details?: unknown },
  ) {
    super(message);
    this.name = "SpecialistError";
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
    this.details = options?.details;
  }
}

// ── Adapter interface ───────────────────────────────────────────────

/**
 * Transport-neutral contract that every specialist adapter must
 * implement.  Matterhorn only ever interacts through this interface.
 */
export interface SpecialistAdapter {
  readonly specialistId: NssStudioSpecialistId;

  /** Check whether the specialist is installed / running / reachable. */
  health(): Promise<SpecialistHealthResult>;

  /** Discover what the specialist can actually do right now. */
  getCapabilities(): Promise<SpecialistCapabilitySet>;

  /** Submit a Matterhorn task handoff for execution. */
  submitTask(handoff: NssStudioHandoff): Promise<SpecialistTaskHandle>;

  /** Poll the current status of a running task. */
  getTaskStatus(taskId: string): Promise<SpecialistTaskStatus>;

  /** Fetch the final result (or partial result) of a task. */
  getResult(taskId: string): Promise<NssStudioExecutionResult>;

  /** Request cancellation of a running task. */
  cancelTask(taskId: string): Promise<SpecialistCancelResult>;
}

// ── Safety constants ────────────────────────────────────────────────

export const ADAPTER_DEFAULTS = {
  /** Maximum time (ms) to wait for a specialist to respond to any single RPC call. */
  requestTimeoutMs: 30_000,
  /** Maximum time (ms) to wait for a full task to complete end-to-end. */
  taskTimeoutMs: 300_000,
  /** Maximum time (ms) to wait for the initial connection. */
  connectTimeoutMs: 10_000,
  /** Maximum autonomous repair cycles the adapter will allow. */
  maxRepairCycles: 4,
} as const;
