import type { NssStudioExecutionResult, NssStudioPlan, NssStudioTaskStatus } from './types.js';
export type StudioRunStatus = 'queued' | 'running' | 'validating' | 'completed' | 'failed' | 'blocked' | 'cancel-requested' | 'cancelled';
export interface StudioTaskRun {
  id: string;
  executionId: string;
  status: NssStudioTaskStatus;
  startedAt?: string;
  finishedAt?: string;
  detail?: string;
  result?: NssStudioExecutionResult;
}
export interface StudioRun {
  id: string;
  plan: NssStudioPlan;
  status: StudioRunStatus;
  createdAt: string;
  updatedAt: string;
  detail?: string;
  tasks: StudioTaskRun[];
}
export interface StudioSnapshotEvent { sequence: number; runId: string; at: string; run: StudioRun }
export const terminalRun = (status: StudioRunStatus): boolean => ['completed', 'failed', 'blocked', 'cancelled'].includes(status);
