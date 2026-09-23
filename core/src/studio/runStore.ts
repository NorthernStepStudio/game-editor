import { terminalRun, type StudioRun, type StudioSnapshotEvent } from './runTypes.js';

export class StudioSnapshotStore {
  private readonly runs = new Map<string, StudioRun>();
  private readonly listeners = new Set<(event: StudioSnapshotEvent) => void>();
  private sequence = 0;

  constructor(initialRuns: readonly StudioRun[] = []) {
    for (const run of initialRuns) {
      if (this.runs.has(run.id)) throw new Error(`Duplicate recovered run ID: ${run.id}.`);
      this.runs.set(run.id, structuredClone(run));
    }
  }

  save(run: StudioRun): void {
    const snapshot = structuredClone(run);
    this.runs.set(run.id, snapshot);
    const event = { sequence: ++this.sequence, runId: run.id, at: run.updatedAt, run: snapshot };
    for (const listener of this.listeners) {
      try { listener(structuredClone(event)); } catch { /* A disconnected observer must not stop execution. */ }
    }
  }

  get(id: string): StudioRun | undefined {
    const run = this.runs.get(id);
    return run && structuredClone(run);
  }

  list(): StudioRun[] {
    return [...this.runs.values()].map(run => structuredClone(run));
  }

  pruneTerminal(maxTotal: number): readonly string[] {
    if (!Number.isInteger(maxTotal) || maxTotal < 0) throw new Error('Invalid Studio history limit.');
    const removed: string[] = [];
    while (this.runs.size > maxTotal) {
      const candidate = [...this.runs.values()]
        .filter(run => terminalRun(run.status))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!candidate) break;
      this.runs.delete(candidate.id);
      removed.push(candidate.id);
    }
    return removed;
  }

  subscribe(listener: (event: StudioSnapshotEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
