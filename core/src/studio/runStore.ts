import type { StudioRun, StudioSnapshotEvent } from './runTypes.js';
export class StudioSnapshotStore {
  private readonly runs = new Map<string, StudioRun>();
  private readonly listeners = new Set<(event: StudioSnapshotEvent) => void>();
  private sequence = 0;
  save(run: StudioRun): void {
    const snapshot = structuredClone(run);
    this.runs.set(run.id, snapshot);
    const event = { sequence: ++this.sequence, runId: run.id, at: run.updatedAt, run: snapshot };
    for (const listener of this.listeners) {
      try { listener(structuredClone(event)); } catch { /* A disconnected observer must not stop execution. */ }
    }
  }
  get(id: string): StudioRun | undefined { const r = this.runs.get(id); return r && structuredClone(r); }
  list(): StudioRun[] { return [...this.runs.values()].map(r => structuredClone(r)); }
  subscribe(listener: (event: StudioSnapshotEvent) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
