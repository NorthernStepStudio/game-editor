/**
 * Studio Run Controller — The Top-Level Matterhorn Studio Director.
 *
 * Orchestrates multi-task Studio Plans across specialist adapters cleanly and
 * deterministically. Manages task graph dependency resolution, capability verification,
 * non-blocking status polling, completion gate validation, bounded retries,
 * cancellation, event streaming, and state persistence.
 */

import { createStudioHandoff, validateStudioPlan } from "../orchestrator.js";
import type { NssStudioPlan, NssStudioTask } from "../types.js";
import { SpecialistError } from "../adapters/types.js";
import type { SpecialistAdapterRegistry } from "./registry.js";
import { StudioRetryPolicy, type StudioRetryPolicyOptions } from "./retryPolicy.js";
import { InMemoryStudioRunStore, type StudioRunStore } from "./store.js";
import type {
  NssStudioRun,
  StudioRunEvent,
  NssStudioTaskRun,
  StudioEventListener,
} from "./types.js";
import { StudioTaskValidator } from "./validator.js";

export interface StudioRunControllerOptions {
  /** Specialist adapter registry. Required. */
  registry: SpecialistAdapterRegistry;
  /** Storage backend for runs. Defaults to InMemoryStudioRunStore. */
  store?: StudioRunStore;
  /** Task validator for completion gate. Defaults to StudioTaskValidator. */
  validator?: StudioTaskValidator;
  /** Studio retry policy. Defaults to StudioRetryPolicy. */
  retryPolicy?: StudioRetryPolicyOptions | StudioRetryPolicy;
  /** Polling interval in ms for task status monitoring (default: 500ms). */
  pollIntervalMs?: number;
  /** Maximum runtime in ms per task before timing out (default: 60,000ms). */
  taskTimeoutMs?: number;
  /** Event listeners for Studio run events. */
  listeners?: StudioEventListener[];
}

export class StudioRunController {
  private readonly registry: SpecialistAdapterRegistry;
  private readonly store: StudioRunStore;
  private readonly validator: StudioTaskValidator;
  private readonly retryPolicy: StudioRetryPolicy;
  private readonly pollIntervalMs: number;
  private readonly taskTimeoutMs: number;
  private readonly listeners: StudioEventListener[] = [];

  constructor(options: StudioRunControllerOptions) {
    this.registry = options.registry;
    this.store = options.store ?? new InMemoryStudioRunStore();
    this.validator = options.validator ?? new StudioTaskValidator();
    this.retryPolicy =
      options.retryPolicy instanceof StudioRetryPolicy
        ? options.retryPolicy
        : new StudioRetryPolicy(options.retryPolicy);
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
    this.taskTimeoutMs = options.taskTimeoutMs ?? 60_000;

    if (options.listeners) {
      for (const listener of options.listeners) {
        this.onEvent(listener);
      }
    }
  }

  onEvent(listener: StudioEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: Omit<StudioRunEvent, "timestamp">): void {
    const fullEvent: StudioRunEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch {
        // Ignore listener exceptions
      }
    }
  }

  private readonly activeStudioRuns = new Map<string, NssStudioRun>();

  // ── Main Entry Point ─────────────────────────────────────────────

  async executeRun(plan: NssStudioPlan, customRunId?: string): Promise<NssStudioRun> {
    // 1. Validate plan
    const validation = validateStudioPlan(plan);
    if (!validation.valid) {
      throw new SpecialistError(
        "INVALID_TASK",
        `Studio plan validation failed: ${validation.errors.join(" ")}`,
      );
    }

    // 2. Initialize run in store
    const run = await this.store.createRun(plan, customRunId);
    run.status = "running";
    await this.store.updateRun(run);
    this.activeStudioRuns.set(run.runId, run);

    this.emit({
      kind: "studio.run.started",
      runId: run.runId,
      detail: `Started execution of plan ${plan.id} (${plan.goal})`,
    });

    try {
      // 3. Execution loop until all tasks reach terminal state
      while (run.status === "running") {
        if (run.cancelRequested) {
          run.status = "cancelled";
          run.completedAt = new Date().toISOString();
          await this.store.updateRun(run);
          this.emit({
            kind: "studio.run.cancelled",
            runId: run.runId,
            detail: "Run cancelled by user request",
          });
          return run;
        }

        const readyTasks = this.getReadyTasks(run);
        const activeTasks = this.getActiveTasks(run);

        if (readyTasks.length === 0 && activeTasks.length === 0) {
          if (run.cancelRequested) {
            run.status = "cancelled";
            run.completedAt = new Date().toISOString();
            await this.store.updateRun(run);
            this.emit({
              kind: "studio.run.cancelled",
              runId: run.runId,
              detail: "Run cancelled by user request",
            });
            return run;
          }

          const hasFailures =
            run.failures.length > 0 ||
            Object.values(run.taskRuns).some(
              (t) => t.status === "failed" || t.status === "blocked",
            );

          if (hasFailures) {
            run.status = "blocked";
            run.completedAt = new Date().toISOString();
            await this.store.updateRun(run);
            this.emit({
              kind: "studio.run.failed",
              runId: run.runId,
              detail: `Run failed or blocked with ${run.failures.length} failure(s)`,
            });
            return run;
          }

          run.status = "completed";
          run.completedAt = new Date().toISOString();
          await this.store.updateRun(run);
          this.emit({
            kind: "studio.run.completed",
            runId: run.runId,
            detail: `Run completed successfully (${Object.keys(run.taskRuns).length} tasks)`,
          });
          return run;
        }

        // Execute ready tasks sequentially or concurrently
        for (const task of readyTasks) {
          if (run.cancelRequested) break;
          await this.executeSingleTask(run, task);
        }

        // Brief sleep between scheduler iterations
        if (this.getActiveTasks(run).length > 0) {
          await new Promise((r) => setTimeout(r, this.pollIntervalMs));
        }
      }

      return run;
    } finally {
      this.activeStudioRuns.delete(run.runId);
    }
  }

  // ── Task Execution & Retry Logic ─────────────────────────────────

  private async executeSingleTask(run: NssStudioRun, task: NssStudioTask): Promise<void> {
    const taskRun = run.taskRuns[task.id]!;
    taskRun.attempt++;
    taskRun.startedAt = new Date().toISOString();
    taskRun.status = "running";
    await this.store.updateRun(run);

    this.emit({
      kind: "studio.task.started",
      runId: run.runId,
      taskId: task.id,
      specialistId: task.specialistId,
      detail: `Attempt ${taskRun.attempt}/${taskRun.maxAttempts} for task ${task.id}`,
    });

    try {
      // 1. Resolve Specialist Adapter
      const adapter = this.registry.get(task.specialistId);
      if (!adapter) {
        throw new SpecialistError(
          "SPECIALIST_UNAVAILABLE",
          `No specialist adapter registered for ID: ${task.specialistId}`,
        );
      }

      // 2. Health check
      const health = await adapter.health();
      if (!health.available) {
        throw new SpecialistError(
          "SPECIALIST_UNAVAILABLE",
          `Specialist ${task.specialistId} is unavailable: ${health.detail ?? "no detail"}`,
        );
      }

      // 3. Capability check
      if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
        const caps = await adapter.getCapabilities();
        const availableSet = new Set(caps.capabilities);
        const missing = task.requiredCapabilities.filter((c) => !availableSet.has(c));

        if (missing.length > 0) {
          throw new SpecialistError(
            "UNSUPPORTED_CAPABILITY",
            `Specialist ${task.specialistId} is missing required capabilities for task ${task.id}: ${missing.join(", ")}`,
            { details: { missingCapabilities: missing } },
          );
        }
      }

      // 4. Create handoff and submit task
      const handoff = createStudioHandoff(task);
      const handle = await adapter.submitTask(handoff);
      taskRun.handle = handle;

      this.emit({
        kind: "studio.task.status",
        runId: run.runId,
        taskId: task.id,
        specialistId: task.specialistId,
        detail: `Task submitted, handle=${handle.taskId}`,
      });

      // 5. Poll for task completion
      const startTime = Date.now();
      let status = await adapter.getTaskStatus(task.id);
      taskRun.status = status.phase;

      while (
        status.phase !== "completed" &&
        status.phase !== "failed" &&
        status.phase !== "cancelled"
      ) {
        if (run.cancelRequested) {
          await adapter.cancelTask(task.id);
          break;
        }

        if (Date.now() - startTime > this.taskTimeoutMs) {
          throw new SpecialistError(
            "TIMEOUT",
            `Task ${task.id} timed out after ${this.taskTimeoutMs}ms`,
          );
        }

        await new Promise((r) => setTimeout(r, this.pollIntervalMs));
        status = await adapter.getTaskStatus(task.id);
        taskRun.status = status.phase;

        this.emit({
          kind: "studio.task.status",
          runId: run.runId,
          taskId: task.id,
          specialistId: task.specialistId,
          detail: `Status: ${status.phase} (${status.detail})`,
        });
      }

      // 6. Retrieve result & validate through Evidence Completion Gate
      const result = await adapter.getResult(task.id);
      taskRun.result = result;
      if (result.artifacts) taskRun.artifacts.push(...result.artifacts);
      if (result.evidence) {
        taskRun.evidence.push(...result.evidence);
        for (const ev of result.evidence) {
          this.emit({
            kind: "studio.evidence.received",
            runId: run.runId,
            taskId: task.id,
            specialistId: task.specialistId,
            detail: ev.summary,
            payload: ev,
          });
        }
      }

      const validation = this.validator.validate(task, result);
      if (!validation.passed) {
        throw new SpecialistError(
          "EXECUTION_FAILED",
          `Task completion gate validation failed: ${validation.failures.join("; ")}`,
        );
      }

      // Task Passed Validation Gate
      taskRun.status = "completed";
      taskRun.completedAt = new Date().toISOString();
      if (result.artifacts) run.artifacts.push(...result.artifacts);
      if (result.evidence) run.evidence.push(...result.evidence);
      await this.store.updateRun(run);

      this.emit({
        kind: "studio.task.completed",
        runId: run.runId,
        taskId: task.id,
        specialistId: task.specialistId,
        detail: `Task ${task.id} completed and passed validation gate`,
      });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      taskRun.error = errMessage;

      // Evaluate Bounded Retry Policy
      if (this.retryPolicy.shouldRetry(taskRun.attempt, error)) {
        taskRun.status = "planned"; // Re-queue for next scheduler loop
        await this.store.updateRun(run);
        this.emit({
          kind: "studio.task.status",
          runId: run.runId,
          taskId: task.id,
          specialistId: task.specialistId,
          detail: `Task ${task.id} failed attempt ${taskRun.attempt}. Retrying... (${errMessage})`,
        });
      } else {
        taskRun.status = "failed";
        taskRun.completedAt = new Date().toISOString();
        run.failures.push(`Task ${task.id} failed: ${errMessage}`);
        await this.store.updateRun(run);

        this.emit({
          kind: "studio.task.failed",
          runId: run.runId,
          taskId: task.id,
          specialistId: task.specialistId,
          detail: errMessage,
        });

        // Mark all dependent tasks as blocked
        this.blockDependentTasks(run, task.id);
      }
    }
  }

  // ── Dependency Resolution Helpers ───────────────────────────────

  private getReadyTasks(run: NssStudioRun): NssStudioTask[] {
    const ready: NssStudioTask[] = [];
    for (const task of run.plan.tasks) {
      const taskRun = run.taskRuns[task.id]!;
      if (taskRun.status !== "planned") continue;

      const depsOk = task.dependsOn.every((depId) => {
        const depRun = run.taskRuns[depId];
        return depRun?.status === "completed";
      });

      if (depsOk) {
        ready.push(task);
      }
    }
    return ready;
  }

  private getActiveTasks(run: NssStudioRun): NssStudioTask[] {
    return run.plan.tasks.filter((task) => {
      const status = run.taskRuns[task.id]?.status;
      return status === "running" || status === "validating" || status === "ready";
    });
  }

  private getPendingTasks(run: NssStudioRun): NssStudioTask[] {
    return run.plan.tasks.filter((task) => {
      const status = run.taskRuns[task.id]?.status;
      return status === "planned";
    });
  }

  private blockDependentTasks(run: NssStudioRun, failedTaskId: string): void {
    for (const task of run.plan.tasks) {
      const taskRun = run.taskRuns[task.id]!;
      if (taskRun.status === "planned" && task.dependsOn.includes(failedTaskId)) {
        taskRun.status = "blocked";
        this.emit({
          kind: "studio.task.blocked",
          runId: run.runId,
          taskId: task.id,
          specialistId: task.specialistId,
          detail: `Task ${task.id} blocked by failed prerequisite task ${failedTaskId}`,
        });
        // Recursively block tasks depending on this task
        this.blockDependentTasks(run, task.id);
      }
    }
  }

  // ── Cancellation ────────────────────────────────────────────────

  async cancelRun(runId: string): Promise<NssStudioRun | undefined> {
    const activeRun = this.activeStudioRuns.get(runId);
    if (activeRun) {
      activeRun.cancelRequested = true;
    }
    const run = await this.store.getRun(runId);
    if (!run) return activeRun;
    run.cancelRequested = true;
    await this.store.updateRun(run);
    return activeRun ?? run;
  }
}
