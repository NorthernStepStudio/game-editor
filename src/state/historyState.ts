import { ProjectState } from './projectState';

const MAX_HISTORY = 60;
let past: string[] = [];
let future: string[] = [];
let onRestoreCb: (() => void) | null = null;

export const HistoryState = {
  setRestoreCallback(cb: () => void) {
    onRestoreCb = cb;
  },

  push(): void {
    try {
      past.push(JSON.stringify(ProjectState.project));
      if (past.length > MAX_HISTORY) past.shift();
      future = [];
    } catch {}
  },

  undo(): void {
    if (!past.length) return;
    try {
      future.push(JSON.stringify(ProjectState.project));
      if (future.length > MAX_HISTORY) future.shift();
      ProjectState.project = JSON.parse(past.pop()!);
      onRestoreCb?.();
    } catch {}
  },

  redo(): void {
    if (!future.length) return;
    try {
      past.push(JSON.stringify(ProjectState.project));
      if (past.length > MAX_HISTORY) past.shift();
      ProjectState.project = JSON.parse(future.pop()!);
      onRestoreCb?.();
    } catch {}
  },

  clear(): void { past = []; future = []; },
  canUndo(): boolean { return past.length > 0; },
  canRedo(): boolean { return future.length > 0; },
};
