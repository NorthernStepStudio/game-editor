import { randomUUID } from 'node:crypto';
import type { SpecialistAdapterRegistry } from './run/registry.js';
import { SpecialistError, type SpecialistAdapter } from './adapters/types.js';
import { validateStudioEvidence } from './evidenceValidator.js';
import { createStudioHandoff, validateStudioPlan } from './orchestrator.js';
import { StudioSnapshotStore } from './runStore.js';
import { terminalRun, type StudioRun, type StudioTaskRun } from './runTypes.js';
import type { NssStudioPlan, NssStudioTask, NssStudioExecutionResult } from './types.js';
export interface StudioRunOptions { taskTimeoutMs?: number; requestTimeoutMs?: number; pollIntervalMs?: number; maxReadRetries?: number; maxRuns?: number }
export class StudioExecutionEngine {
  readonly store = new StudioSnapshotStore();
  private readonly cancellations = new Set<string>();
  private readonly options: Required<StudioRunOptions>;
  constructor(private readonly registry: SpecialistAdapterRegistry, options: StudioRunOptions = {}, private readonly additionalValidation?: (task: NssStudioTask, result: NssStudioExecutionResult) => { passed: boolean; failures: readonly string[] }) {
    this.options = { taskTimeoutMs: 300000, requestTimeoutMs: 30000, pollIntervalMs: 1000, maxReadRetries: 2, maxRuns: 100, ...options };
    for (const [key, value] of Object.entries(this.options)) if (!Number.isFinite(value) || value < (key === 'maxReadRetries' ? 0 : 1)) throw new Error(`Invalid ${key}`);
  }
  start(plan: NssStudioPlan, customRunId?: string): StudioRun {
    const validation = validateStudioPlan(plan);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    if (this.store.list().some(r => !terminalRun(r.status))) throw new Error('A run is already active. Wait for it to settle before starting another.');
    if (this.store.list().length >= this.options.maxRuns) throw new Error('Run history limit reached; export evidence and restart the server.');
    if (customRunId && (!/^[a-zA-Z0-9_-]{1,100}$/.test(customRunId) || this.store.get(customRunId))) throw new Error("Invalid or duplicate run ID.");
    const id = customRunId ?? randomUUID(), now = new Date().toISOString();
    const run: StudioRun = { id, plan: structuredClone(plan), status: 'queued', createdAt: now, updatedAt: now,
      tasks: plan.tasks.map(t => ({ id: t.id, executionId: `${id}-${t.id}`, status: 'planned' })) };
    this.save(run);
    void this.execute(run).catch(() => { run.status = 'failed'; run.detail = 'Unexpected controller error.'; this.save(run); });
    return this.store.get(id)!;
  }
  requestCancel(id: string): StudioRun {
    const run = this.store.get(id);
    if (!run) throw new Error('Run not found.');
    if (terminalRun(run.status)) return run;
    this.cancellations.add(id);
    run.status = 'cancel-requested'; run.detail = 'Cancellation requested; remote termination is not yet confirmed.';
    this.save(run);
    return run;
  }
  private save(run: StudioRun): void { run.updatedAt = new Date().toISOString(); this.store.save(run); }
  private async bounded<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SpecialistError('TIMEOUT', 'Operation timed out; remote work may still be running.')), timeout);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }
  private async read<T>(operation: () => Promise<T>, deadline: number): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new SpecialistError('TIMEOUT', 'Task deadline exceeded; remote work may still be running.');
      try { return await this.bounded(operation, Math.min(remaining, this.options.requestTimeoutMs)); }
      catch (error) {
        if (!(error instanceof SpecialistError) || !error.recoverable || attempt >= this.options.maxReadRetries) throw error;
      }
    }
  }
  private async execute(run: StudioRun): Promise<void> {
    run.status = 'running'; this.save(run);
    while (run.tasks.some(t => t.status === 'planned')) {
      if (this.cancellations.has(run.id)) { this.finishCancellation(run); return; }
      const next = run.plan.tasks.find(t => run.tasks.find(r => r.id === t.id)!.status === 'planned' && t.dependsOn.every(d => run.tasks.find(r => r.id === d)!.status === 'completed'));
      if (!next) {
        for (const task of run.tasks.filter(t => t.status === 'planned')) { task.status = 'blocked'; task.detail = 'A dependency did not complete.'; }
        break;
      }
      const task = run.tasks.find(t => t.id === next.id)!;
      const adapter = this.registry.get(next.specialistId);
      if (!adapter) { task.status = 'blocked'; task.detail = 'No execution adapter is configured for this task.'; this.save(run); continue; }
      const deadline = Date.now() + this.options.taskTimeoutMs;
      let submitted = false, cancellationSent = false;
      try {
        task.status = 'ready'; this.save(run);
        const health = await this.read(() => adapter.health(), deadline);
        if (!health.available) { task.status = 'blocked'; task.detail = 'Execution service is unavailable. Check the daemon connection.'; this.save(run); continue; }
        const caps = await this.read(() => adapter.getCapabilities(), deadline);
        if (next.requiredCapabilities?.some(cap => !caps.capabilities.includes(cap))) { task.status = "blocked"; task.detail = "Execution service lacks required capabilities."; this.save(run); continue; }
        if (this.cancellations.has(run.id)) { this.finishCancellation(run); return; }
        const dependencyArtifacts = next.dependsOn.flatMap(d => run.tasks.find(t => t.id === d)?.result?.artifacts ?? []);
        const handoff = createStudioHandoff({ ...next, id: task.executionId, inputArtifacts: [...next.inputArtifacts ?? [], ...dependencyArtifacts] });
        task.status = 'running'; task.startedAt = new Date().toISOString(); this.save(run);
        // No mutation retries: a timeout does not prove rejection by the remote service.
        submitted = true;
        const handle = await this.bounded(() => adapter.submitTask(handoff), Math.max(1, Math.min(this.options.requestTimeoutMs, deadline - Date.now())));
        if (!handle.accepted || handle.taskId !== task.executionId || handle.specialistId !== next.specialistId) throw new Error('Execution service rejected or mismatched the handoff.');
        while (true) {
          if (this.cancellations.has(run.id) && !cancellationSent) {
            cancellationSent = true;
            const cancelled = await this.bounded(() => adapter.cancelTask(task.executionId), this.options.requestTimeoutMs);
            if (cancelled.cancelled && cancelled.taskId === task.executionId) { task.status = 'cancelled'; this.finishCancellation(run); return; }
            run.status = 'cancel-requested'; task.detail = 'Remote cancellation is unsupported or unconfirmed; waiting for the task to settle.'; this.save(run);
          }
          const status = await this.read(() => adapter.getTaskStatus(task.executionId), deadline);
          if (status.taskId !== task.executionId || status.specialistId !== next.specialistId) throw new Error('Status identity mismatch.');
          if (status.phase === 'cancelled') { task.status = 'cancelled'; this.finishCancellation(run); return; }
          if (status.phase === 'failed' || status.phase === 'completed') break;
          if (status.phase === 'validating') { task.status = 'validating'; this.save(run); }
          await new Promise(resolve => setTimeout(resolve, Math.min(this.options.pollIntervalMs, Math.max(1, deadline - Date.now()))));
        }
        task.result = await this.read(() => adapter.getResult(task.executionId), deadline);
        task.status = 'validating'; this.save(run);
        const validation = validateStudioEvidence(task.result, task.executionId, next.specialistId, next.acceptanceCriteria);
        if (validation.valid && next.outputArtifacts?.some(expected => !task.result?.artifacts?.some(actual => actual.kind === expected.kind && actual.uri))) { validation.valid = false; validation.failed = true; validation.detail = 'Required output artifacts are missing.'; }
        if (validation.valid && this.additionalValidation) { const extra = this.additionalValidation({ ...next, id: task.executionId }, task.result); if (!extra.passed) { validation.valid = false; validation.failed = true; validation.detail = extra.failures.join('; '); } }
        task.status = validation.valid ? 'completed' : validation.failed ? 'failed' : 'blocked'; task.detail = validation.detail;
      } catch (error) {
        task.status = 'failed';
        task.detail = error instanceof SpecialistError ? error.code : 'Execution failed; inspect the daemon logs.';
        if (submitted) {
          // Do not unlock the project after uncertain remote execution.
          let confirmed = false;
          try { const c = await this.bounded(() => adapter.cancelTask(task.executionId), this.options.requestTimeoutMs); confirmed = c.cancelled && c.taskId === task.executionId; } catch { /* Preserve uncertain state. */ }
          if (!confirmed) {
            run.status = 'cancel-requested'; run.detail = 'Remote execution could not be confirmed stopped. Check the daemon before restarting Matterhorn.';
            this.save(run); return;
          }
        }
      }
      task.finishedAt = new Date().toISOString(); this.save(run);
      if (this.cancellations.has(run.id)) { this.finishCancellation(run); return; }
    }
    run.status = run.tasks.some(t => t.status === 'failed') ? 'failed' : run.tasks.some(t => t.status !== 'completed') ? 'blocked' : 'validating';
    this.save(run);
    if (run.status === 'validating') {
      const covered = run.plan.finalAcceptanceCriteria.every(criterion => run.tasks.some(task => task.result && validateStudioEvidence(task.result, task.executionId, task.result.specialistId, [criterion]).valid));
      run.status = covered ? 'completed' : 'blocked';
      run.detail = covered ? 'All task and final acceptance checks passed.' : 'Final acceptance evidence is missing.';
      this.save(run);
    }
  }
  private finishCancellation(run: StudioRun): void {
    for (const task of run.tasks) if (['planned', 'ready'].includes(task.status)) task.status = 'cancelled';
    run.status = 'cancelled'; run.detail = 'Scheduling stopped; no unconfirmed active task remains.';
    this.cancellations.delete(run.id); this.save(run);
  }
}
