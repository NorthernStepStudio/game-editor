/**
 * Persistence Boundary for Studio Runs.
 *
 * Defines the storage contract and provides an in-memory implementation
 * so durability concerns (JSON, SQLite, etc.) can be swapped cleanly.
 */

import type { NssStudioPlan } from "../types.js";
import type { NssStudioRun, NssStudioTaskRun } from "./types.js";

export interface StudioRunStore {
  createRun(plan: NssStudioPlan, runId?: string): Promise<NssStudioRun>;
  getRun(runId: string): Promise<NssStudioRun | undefined>;
  updateRun(run: NssStudioRun): Promise<void>;
  listRuns(): Promise<NssStudioRun[]>;
}

export class InMemoryStudioRunStore implements StudioRunStore {
  private readonly runs = new Map<string, NssStudioRun>();

  async createRun(plan: NssStudioPlan, customRunId?: string): Promise<NssStudioRun> {
    const now = new Date().toISOString();
    const runId = customRunId ?? `studio-run-${Date.now()}`;

    const taskRuns: Record<string, NssStudioTaskRun> = {};
    for (const task of plan.tasks) {
      taskRuns[task.id] = {
        taskId: task.id,
        specialistId: task.specialistId,
        status: "planned",
        attempt: 0,
        maxAttempts: 2,
        artifacts: [],
        evidence: [],
      };
    }

    const run: NssStudioRun = {
      runId,
      planId: plan.id,
      plan,
      status: "created",
      startedAt: now,
      updatedAt: now,
      taskRuns,
      artifacts: [],
      evidence: [],
      failures: [],
    };

    this.runs.set(runId, run);
    return run;
  }

  async getRun(runId: string): Promise<NssStudioRun | undefined> {
    const run = this.runs.get(runId);
    return run ? JSON.parse(JSON.stringify(run)) as NssStudioRun : undefined;
  }

  async updateRun(run: NssStudioRun): Promise<void> {
    run.updatedAt = new Date().toISOString();
    this.runs.set(run.runId, JSON.parse(JSON.stringify(run)) as NssStudioRun);
  }

  async listRuns(): Promise<NssStudioRun[]> {
    return Array.from(this.runs.values()).map(
      (r) => JSON.parse(JSON.stringify(r)) as NssStudioRun,
    );
  }

  clear(): void {
    this.runs.clear();
  }
}
