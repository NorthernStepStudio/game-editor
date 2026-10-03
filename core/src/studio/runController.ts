import { randomUUID } from 'node:crypto';
import type { SpecialistAdapterRegistry } from './run/registry.js';
import { SpecialistError } from './adapters/types.js';
import { runSentinelValidation } from './sentinelValidator.js';
import { createStudioHandoff, validateStudioPlan } from './orchestrator.js';
import { StudioSnapshotStore } from './runStore.js';
import { terminalRun, type StudioRun, type StudioTaskRun } from './runTypes.js';
import type { NssStudioPlan, NssStudioTask, NssStudioExecutionResult } from './types.js';

export interface StudioRunOptions {
  taskTimeoutMs?: number;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  maxReadRetries?: number;
  maxRuns?: number;
}

export class StudioExecutionEngine {
  readonly store: StudioSnapshotStore;
  private readonly cancellations = new Set<string>();
  private readonly options: Required<StudioRunOptions>;

  constructor(
    private readonly registry: SpecialistAdapterRegistry,
    options: StudioRunOptions = {},
    private readonly additionalValidation?: (task: NssStudioTask, result: NssStudioExecutionResult) => { passed: boolean; failures: readonly string[] },
    initialRuns: readonly StudioRun[] = [],
  ) {
    this.options = { taskTimeoutMs: 300000, requestTimeoutMs: 30000, pollIntervalMs: 1000, maxReadRetries: 2, maxRuns: 100, ...options };
    for (const [key, value] of Object.entries(this.options)) {
      if (!Number.isFinite(value) || value < (key === 'maxReadRetries' ? 0 : 1)) throw new Error(`Invalid ${key}`);
    }
    this.store = new StudioSnapshotStore(initialRuns);
  }

  start(plan: NssStudioPlan, customRunId?: string): StudioRun {
    const validation = validateStudioPlan(plan);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    if (this.store.list().some(run => !terminalRun(run.status))) throw new Error('A run is already active. Wait for it to settle before starting another.');
    this.store.pruneTerminal(Math.max(0, this.options.maxRuns - 1));
    if (this.store.list().length >= this.options.maxRuns) throw new Error('Run history limit reached; archive older history before starting another run.');
    if (customRunId && (!/^[a-zA-Z0-9_-]{1,100}$/.test(customRunId) || this.store.get(customRunId))) throw new Error('Invalid or duplicate run ID.');

    const id = customRunId ?? randomUUID();
    const now = new Date().toISOString();
    const run: StudioRun = {
      id,
      plan: structuredClone(plan),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      tasks: plan.tasks.map(task => ({ id: task.id, executionId: `${id}-${task.id}`, status: 'planned' })),
    };
    this.save(run);
    void this.execute(run).catch(() => {
      run.status = 'failed';
      run.detail = 'Unexpected controller error.';
      this.save(run);
    });
    return this.store.get(id)!;
  }

  requestCancel(id: string): StudioRun {
    const run = this.store.get(id);
    if (!run) throw new Error('Run not found.');
    if (terminalRun(run.status)) return run;
    this.cancellations.add(id);
    run.status = 'cancel-requested';
    run.detail = 'Cancellation requested; remote termination is not yet confirmed.';
    this.save(run);
    return run;
  }

  async reconcileRecoveredRuns(): Promise<StudioRun[]> {
    const recoveredIds = this.store.list().filter(run => !terminalRun(run.status)).map(run => run.id);
    for (const id of recoveredIds) {
      const run = this.store.get(id);
      if (!run) continue;
      run.status = 'cancel-requested';
      run.detail = 'Matterhorn restarted before this run settled. Recovery is read-only; no mutation will be resubmitted.';
      this.save(run);

      let uncertainRemoteWork = false;
      for (const task of run.tasks) {
        const planTask = run.plan.tasks.find(candidate => candidate.id === task.id);
        if (!planTask) {
          task.status = 'blocked';
          task.detail = 'Recovered task is missing from its saved plan.';
          task.finishedAt = new Date().toISOString();
          continue;
        }

        if (task.status === 'planned' || task.status === 'ready') {
          task.status = 'blocked';
          task.detail = 'Not resumed automatically after Matterhorn restart.';
          task.finishedAt = new Date().toISOString();
          continue;
        }

        if (!['accepted', 'running', 'validating', 'unknown'].includes(task.status)) continue;
        const adapter = this.registry.get(planTask.specialistId);
        if (!adapter) {
          uncertainRemoteWork = true;
          task.detail = 'Cannot reconcile this task because its execution adapter is unavailable.';
          continue;
        }

        const deadline = Date.now() + Math.max(this.options.requestTimeoutMs, 1) * (this.options.maxReadRetries + 1);
        try {
          const status = await this.read(() => adapter.getTaskStatus(task.executionId), deadline);
          if (status.taskId !== task.executionId || status.specialistId !== planTask.specialistId) throw new Error('Recovered status identity mismatch.');

          if (['accepted', 'running', 'validating', 'unknown'].includes(status.phase)) {
            uncertainRemoteWork = true;
            task.status = status.phase === 'accepted' ? 'accepted' : status.phase;
            task.detail = `Recovered remote phase is ${status.phase}; Matterhorn will not start overlapping work.`;
            continue;
          }

          if (status.phase === 'cancelled') {
            task.status = 'cancelled';
            task.detail = status.detail ?? 'Remote execution confirmed cancelled after restart.';
            task.finishedAt = new Date().toISOString();
            continue;
          }

          if (status.phase === 'failed') {
            task.status = 'failed';
            task.detail = status.detail ?? 'Remote execution failed before restart recovery completed.';
            task.finishedAt = new Date().toISOString();
            try { task.result = await this.read(() => adapter.getResult(task.executionId), deadline); } catch { /* Failure status is authoritative. */ }
            continue;
          }

          task.result = await this.read(() => adapter.getResult(task.executionId), deadline);
          this.validateTask(task, planTask);
          task.finishedAt = new Date().toISOString();
        } catch (error) {
          uncertainRemoteWork = true;
          task.detail = error instanceof SpecialistError ? error.code : 'Could not reconcile remote execution after restart.';
        }
      }

      this.finalizeRecovered(run, uncertainRemoteWork);
      this.save(run);
    }
    return recoveredIds.map(id => this.store.get(id)).filter((run): run is StudioRun => Boolean(run));
  }

  private save(run: StudioRun): void {
    run.updatedAt = new Date().toISOString();
    this.store.save(run);
  }

  private async bounded<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new SpecialistError('TIMEOUT', 'Operation timed out; remote work may still be running.')), timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async read<T>(operation: () => Promise<T>, deadline: number): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new SpecialistError('TIMEOUT', 'Task deadline exceeded; remote work may still be running.');
      try {
        return await this.bounded(operation, Math.min(remaining, this.options.requestTimeoutMs));
      } catch (error) {
        if (!(error instanceof SpecialistError) || !error.recoverable || attempt >= this.options.maxReadRetries) throw error;
      }
    }
  }

  private validateTask(task: StudioTaskRun, planTask: NssStudioTask): void {
    if (!task.result) {
      task.status = 'blocked';
      task.detail = 'Execution result is missing.';
      return;
    }
    const validation = runSentinelValidation(task.result, task.executionId, planTask.specialistId, planTask.acceptanceCriteria);
    if (validation.valid && planTask.outputArtifacts?.some(expected => !task.result?.artifacts?.some(actual => actual.kind === expected.kind && actual.uri))) {
      validation.valid = false;
      validation.failed = true;
      validation.detail = 'Required output artifacts are missing.';
    }
    if (validation.valid && this.additionalValidation) {
      const extra = this.additionalValidation({ ...planTask, id: task.executionId }, task.result);
      if (!extra.passed) {
        validation.valid = false;
        validation.failed = true;
        validation.detail = extra.failures.join('; ');
      }
    }
    task.status = validation.valid ? 'completed' : validation.failed ? 'failed' : 'blocked';
    task.detail = validation.detail;
  }

  private finalAcceptanceCovered(run: StudioRun): boolean {
    return run.plan.finalAcceptanceCriteria.every(criterion =>
      run.tasks.some(task => task.result && runSentinelValidation(task.result, task.executionId, task.result.specialistId, [criterion]).valid),
    );
  }

  private finalizeRecovered(run: StudioRun, uncertainRemoteWork: boolean): void {
    if (uncertainRemoteWork || run.tasks.some(task => ['accepted', 'running', 'validating', 'unknown'].includes(task.status))) {
      run.status = 'cancel-requested';
      run.detail = 'Restart recovery could not confirm that all remote work stopped. Check Flyrail before starting another run.';
      return;
    }
    if (run.tasks.some(task => task.status === 'failed')) {
      run.status = 'failed';
      run.detail = 'Recovered run contains a confirmed failed task.';
      return;
    }
    if (run.tasks.some(task => task.status === 'blocked')) {
      run.status = 'blocked';
      run.detail = 'Recovered run was not resumed automatically; inspect evidence before starting new work.';
      return;
    }
    if (run.tasks.every(task => task.status === 'cancelled')) {
      run.status = 'cancelled';
      run.detail = 'Recovered remote work is confirmed cancelled.';
      return;
    }
    if (run.tasks.every(task => task.status === 'completed')) {
      const covered = this.finalAcceptanceCovered(run);
      run.status = covered ? 'completed' : 'blocked';
      run.detail = covered ? 'Recovered execution and final evidence are confirmed complete.' : 'Recovered execution completed, but final acceptance evidence is missing.';
      return;
    }
    run.status = 'blocked';
    run.detail = 'Recovered run reached a safe terminal state but was not resumed automatically.';
  }

  private async execute(run: StudioRun): Promise<void> {
    run.status = 'running';
    this.save(run);

    while (run.tasks.some(task => task.status === 'planned')) {
      if (this.cancellations.has(run.id)) {
        this.finishCancellation(run);
        return;
      }

      const next = run.plan.tasks.find(task =>
        run.tasks.find(candidate => candidate.id === task.id)!.status === 'planned' &&
        task.dependsOn.every(dependency => run.tasks.find(candidate => candidate.id === dependency)!.status === 'completed'),
      );
      if (!next) {
        for (const task of run.tasks.filter(candidate => candidate.status === 'planned')) {
          task.status = 'blocked';
          task.detail = 'A dependency did not complete.';
        }
        break;
      }

      const task = run.tasks.find(candidate => candidate.id === next.id)!;
      const adapter = this.registry.get(next.specialistId);
      if (!adapter) {
        task.status = 'blocked';
        task.detail = 'No execution adapter is configured for this task.';
        this.save(run);
        continue;
      }

      const deadline = Date.now() + this.options.taskTimeoutMs;
      let submitted = false;
      let cancellationSent = false;
      try {
        task.status = 'ready';
        this.save(run);
        const health = await this.read(() => adapter.health(), deadline);
        if (!health.available) {
          task.status = 'blocked';
          task.detail = 'Execution service is unavailable. Check the daemon connection.';
          this.save(run);
          continue;
        }

        const capabilities = await this.read(() => adapter.getCapabilities(), deadline);
        if (next.requiredCapabilities?.some(capability => !capabilities.capabilities.includes(capability))) {
          task.status = 'blocked';
          task.detail = 'Execution service lacks required capabilities.';
          this.save(run);
          continue;
        }

        if (this.cancellations.has(run.id)) {
          this.finishCancellation(run);
          return;
        }

        const dependencyArtifacts = next.dependsOn.flatMap(dependency => run.tasks.find(candidate => candidate.id === dependency)?.result?.artifacts ?? []);
        const handoff = createStudioHandoff({ ...next, id: task.executionId, inputArtifacts: [...next.inputArtifacts ?? [], ...dependencyArtifacts] });
        task.status = 'running';
        task.startedAt = new Date().toISOString();
        this.save(run);

        submitted = true;
        const handle = await this.bounded(
          () => adapter.submitTask(handoff),
          Math.max(1, Math.min(this.options.requestTimeoutMs, deadline - Date.now())),
        );
        if (!handle.accepted || handle.taskId !== task.executionId || handle.specialistId !== next.specialistId) throw new Error('Execution service rejected or mismatched the handoff.');

        while (true) {
          if (this.cancellations.has(run.id) && !cancellationSent) {
            cancellationSent = true;
            const cancelled = await this.bounded(() => adapter.cancelTask(task.executionId), this.options.requestTimeoutMs);
            if (cancelled.cancelled && cancelled.taskId === task.executionId) {
              task.status = 'cancelled';
              this.finishCancellation(run);
              return;
            }
            run.status = 'cancel-requested';
            task.detail = 'Remote cancellation is unsupported or unconfirmed; waiting for the task to settle.';
            this.save(run);
          }

          const status = await this.read(() => adapter.getTaskStatus(task.executionId), deadline);
          if (status.taskId !== task.executionId || status.specialistId !== next.specialistId) throw new Error('Status identity mismatch.');
          if (status.phase === 'cancelled') {
            task.status = 'cancelled';
            this.finishCancellation(run);
            return;
          }
          if (status.phase === 'failed' || status.phase === 'completed') break;
          if (status.phase === 'validating') {
            task.status = 'validating';
            this.save(run);
          }
          await new Promise(resolve => setTimeout(resolve, Math.min(this.options.pollIntervalMs, Math.max(1, deadline - Date.now()))));
        }

        task.result = await this.read(() => adapter.getResult(task.executionId), deadline);
        task.status = 'validating';
        this.save(run);
        this.validateTask(task, next);
      } catch (error) {
        task.status = 'failed';
        task.detail = error instanceof SpecialistError ? error.code : 'Execution failed; inspect the daemon logs.';
        if (submitted) {
          let confirmed = false;
          try {
            const cancellation = await this.bounded(() => adapter.cancelTask(task.executionId), this.options.requestTimeoutMs);
            confirmed = cancellation.cancelled && cancellation.taskId === task.executionId;
          } catch { /* Preserve uncertain state. */ }
          if (!confirmed) {
            run.status = 'cancel-requested';
            run.detail = 'Remote execution could not be confirmed stopped. Check the daemon before restarting Matterhorn.';
            this.save(run);
            return;
          }
        }
      }

      task.finishedAt = new Date().toISOString();
      this.save(run);
      if (this.cancellations.has(run.id)) {
        this.finishCancellation(run);
        return;
      }
    }

    run.status = run.tasks.some(task => task.status === 'failed')
      ? 'failed'
      : run.tasks.some(task => task.status !== 'completed')
        ? 'blocked'
        : 'validating';
    this.save(run);

    if (run.status === 'validating') {
      const covered = this.finalAcceptanceCovered(run);
      run.status = covered ? 'completed' : 'blocked';
      run.detail = covered ? 'All task and final acceptance checks passed.' : 'Final acceptance evidence is missing.';
      this.save(run);
    }
  }

  private finishCancellation(run: StudioRun): void {
    for (const task of run.tasks) {
      if (['planned', 'ready'].includes(task.status)) task.status = 'cancelled';
    }
    run.status = 'cancelled';
    run.detail = 'Scheduling stopped; no unconfirmed active task remains.';
    this.cancellations.delete(run.id);
    this.save(run);
  }
}
