/**
 * Studio Run & Orchestration Runtime Types.
 *
 * Defines execution state, task run tracking, event stream types,
 * and completion gate validation shapes for the Studio Director.
 */

import type {
  NssStudioArtifactRef,
  NssStudioEvidence,
  NssStudioExecutionResult,
  NssStudioPlan,
  NssStudioSpecialistId,
  NssStudioTaskStatus,
} from "../types.js";
import type { SpecialistTaskHandle } from "../adapters/types.js";

export type NssStudioRunState =
  | "created"
  | "validating"
  | "running"
  | "blocked"
  | "failed"
  | "completed"
  | "cancelled";

export type NssStudioTaskRunState = NssStudioTaskStatus;

export interface NssStudioTaskRun {
  readonly taskId: string;
  readonly specialistId: NssStudioSpecialistId;
  status: NssStudioTaskRunState;
  attempt: number;
  maxAttempts: number;
  startedAt?: string;
  completedAt?: string;
  handle?: SpecialistTaskHandle;
  result?: NssStudioExecutionResult;
  artifacts: NssStudioArtifactRef[];
  evidence: NssStudioEvidence[];
  error?: string;
}

export interface NssStudioRun {
  readonly runId: string;
  readonly planId: string;
  readonly plan: NssStudioPlan;
  status: NssStudioRunState;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  taskRuns: Record<string, NssStudioTaskRun>;
  artifacts: NssStudioArtifactRef[];
  evidence: NssStudioEvidence[];
  failures: string[];
  cancelRequested?: boolean;
}

export interface TaskValidationResult {
  readonly passed: boolean;
  readonly criteria: readonly string[];
  readonly evidenceConsidered: readonly NssStudioEvidence[];
  readonly failures: readonly string[];
  readonly warnings: readonly string[];
}

// ── Studio Event Stream ─────────────────────────────────────────────

export type StudioRunEventKind =
  | "studio.run.started"
  | "studio.run.updated"
  | "studio.run.completed"
  | "studio.run.failed"
  | "studio.run.cancelled"
  | "studio.task.ready"
  | "studio.task.started"
  | "studio.task.status"
  | "studio.task.completed"
  | "studio.task.failed"
  | "studio.task.blocked"
  | "studio.evidence.received";

export interface StudioRunEvent {
  readonly kind: StudioRunEventKind;
  readonly runId: string;
  readonly timestamp: string;
  readonly taskId?: string;
  readonly specialistId?: NssStudioSpecialistId;
  readonly detail?: string;
  readonly payload?: unknown;
}

export type StudioEventListener = (event: StudioRunEvent) => void;
