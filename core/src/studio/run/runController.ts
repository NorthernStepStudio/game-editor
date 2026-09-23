/** Public Phase 3 API and standalone snapshots share one execution engine. */
import { StudioExecutionEngine, type StudioRunOptions } from '../runController.js';
import { terminalRun, type StudioRun } from '../runTypes.js';
import type { NssStudioPlan } from '../types.js';
import type { SpecialistAdapterRegistry } from './registry.js';
import { InMemoryStudioRunStore, type StudioRunStore } from './store.js';
import type { StudioRetryPolicy, StudioRetryPolicyOptions } from './retryPolicy.js';
import type { StudioTaskValidator } from './validator.js';
import type { NssStudioRun, StudioEventListener, StudioRunEvent } from './types.js';

export interface StudioRunControllerOptions extends StudioRunOptions {
  registry: SpecialistAdapterRegistry;
  store?: StudioRunStore;
  validator?: StudioTaskValidator;
  retryPolicy?: StudioRetryPolicyOptions | StudioRetryPolicy;
  listeners?: StudioEventListener[];
  initialRuns?: readonly StudioRun[];
}

export class StudioRunController {
  private readonly engine: StudioExecutionEngine;
  private readonly legacyStore: StudioRunStore;
  private readonly listeners = new Set<StudioEventListener>();
  private readonly previous = new Map<string, StudioRun>();
  private persistence = Promise.resolve();
  private persistenceError: unknown;
  readonly store;

  constructor(options: StudioRunControllerOptions) {
    this.engine = new StudioExecutionEngine(
      options.registry,
      {
        ...(options.taskTimeoutMs === undefined ? {} : { taskTimeoutMs: options.taskTimeoutMs }),
        ...(options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs }),
        ...(options.pollIntervalMs === undefined ? {} : { pollIntervalMs: options.pollIntervalMs }),
        maxReadRetries: options.maxReadRetries ?? Math.max(0, (options.retryPolicy?.maxTaskAttempts ?? 3) - 1),
        ...(options.maxRuns === undefined ? {} : { maxRuns: options.maxRuns }),
      },
      options.validator ? (task, result) => options.validator!.validate(task, result) : undefined,
      options.initialRuns ?? [],
    );
    this.store = this.engine.store;
    this.legacyStore = options.store ?? new InMemoryStudioRunStore();
    for (const run of this.store.list()) this.previous.set(run.id, run);
    for (const listener of options.listeners ?? []) this.listeners.add(listener);

    this.store.subscribe(({ run }) => {
      const previous = this.previous.get(run.id);
      this.previous.set(run.id, run);
      const snapshot = this.convert(run);
      this.persistence = this.persistence
        .then(() => this.legacyStore.updateRun(snapshot))
        .catch(error => { this.persistenceError = error; });

      if (!previous) this.emit({ kind: 'studio.run.started', runId: run.id });
      for (const task of run.tasks) {
        const before = previous?.tasks.find(candidate => candidate.id === task.id);
        if (before?.status === task.status) continue;
        const taskKind = task.status === 'completed'
          ? 'studio.task.completed'
          : task.status === 'failed'
            ? 'studio.task.failed'
            : task.status === 'blocked'
              ? 'studio.task.blocked'
              : task.status === 'running'
                ? 'studio.task.started'
                : 'studio.task.status';
        if (task.result && !before?.result) {
          for (const evidence of task.result.evidence ?? []) {
            this.emit({ kind: 'studio.evidence.received', runId: run.id, taskId: task.id, payload: evidence, detail: evidence.summary });
          }
        }
        this.emit({ kind: taskKind, runId: run.id, taskId: task.id, detail: task.detail });
      }

      if (previous?.status !== run.status) {
        this.emit({
          kind: run.status === 'completed'
            ? 'studio.run.completed'
            : run.status === 'cancelled'
              ? 'studio.run.cancelled'
              : ['failed', 'blocked'].includes(run.status)
                ? 'studio.run.failed'
                : 'studio.run.updated',
          runId: run.id,
          detail: run.detail,
        });
      }
    });
  }

  start(plan: NssStudioPlan): StudioRun { return this.engine.start(plan); }
  requestCancel(id: string): StudioRun { return this.engine.requestCancel(id); }
  onEvent(listener: StudioEventListener): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  async reconcileRecoveredRuns(): Promise<StudioRun[]> {
    const runs = await this.engine.reconcileRecoveredRuns();
    await this.persistence;
    if (this.persistenceError) throw new Error('Studio run snapshot persistence failed.');
    return runs;
  }

  private emit(event: Omit<StudioRunEvent, 'timestamp'>): void {
    for (const listener of this.listeners) {
      try { listener({ ...event, timestamp: new Date().toISOString() }); } catch { /* Observers do not control execution. */ }
    }
  }

  async executeRun(plan: NssStudioPlan, customRunId?: string): Promise<NssStudioRun> {
    const initial = this.engine.start(plan, customRunId);
    const final = await new Promise<StudioRun>(resolve => {
      const settled = (run: StudioRun) => terminalRun(run.status) || (run.status === 'cancel-requested' && run.tasks.some(task => task.status === 'failed'));
      const current = this.store.get(initial.id)!;
      if (settled(current)) {
        resolve(current);
        return;
      }
      const off = this.store.subscribe(({ run }) => {
        if (run.id === initial.id && settled(run)) {
          off();
          resolve(run);
        }
      });
    });
    await this.persistence;
    if (this.persistenceError) throw new Error('Studio run snapshot persistence failed.');
    return this.convert(final);
  }

  async cancelRun(id: string): Promise<NssStudioRun | undefined> {
    if (!this.store.get(id)) return undefined;
    return this.convert(this.requestCancel(id));
  }

  private convert(run: StudioRun): NssStudioRun {
    return {
      runId: run.id,
      planId: run.plan.id,
      plan: run.plan,
      status: run.status === 'queued' ? 'created' : run.status,
      startedAt: run.createdAt,
      updatedAt: run.updatedAt,
      completedAt: terminalRun(run.status) ? run.updatedAt : undefined,
      taskRuns: Object.fromEntries(run.tasks.map(task => [task.id, {
        taskId: task.id,
        specialistId: run.plan.tasks.find(candidate => candidate.id === task.id)!.specialistId,
        status: task.status,
        attempt: task.startedAt ? 1 : 0,
        maxAttempts: 1,
        startedAt: task.startedAt,
        completedAt: task.finishedAt,
        result: task.result,
        artifacts: [...task.result?.artifacts ?? []],
        evidence: [...task.result?.evidence ?? []],
        error: ['failed', 'blocked'].includes(task.status) ? task.detail : undefined,
      }])),
      artifacts: run.tasks.flatMap(task => task.result?.artifacts ?? []),
      evidence: run.tasks.flatMap(task => task.result?.evidence ?? []),
      failures: run.tasks.filter(task => ['failed', 'blocked'].includes(task.status)).map(task => task.detail ?? task.status),
      cancelRequested: ['cancel-requested', 'cancelled'].includes(run.status),
    };
  }
}
