import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { terminalRun, type StudioRun } from '../../../core/out/index.js';

const RUN_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const RUN_STATUSES = new Set(['queued', 'running', 'validating', 'completed', 'failed', 'blocked', 'cancel-requested', 'cancelled']);
const TASK_STATUSES = new Set(['planned', 'ready', 'accepted', 'running', 'blocked', 'validating', 'completed', 'failed', 'cancelled', 'unknown']);

function atomicWrite(path: string, text: string): void {
  const temp = `${path}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temp, 'wx', 0o600);
    writeFileSync(fd, text, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temp); } catch { /* Rename consumed the temporary file. */ }
  }
}

function validateRun(raw: unknown): StudioRun {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Studio history record must be an object.');
  const run = raw as Record<string, unknown>;
  if (typeof run.id !== 'string' || !RUN_ID.test(run.id)) throw new Error('Studio history contains an invalid run ID.');
  if (typeof run.status !== 'string' || !RUN_STATUSES.has(run.status)) throw new Error(`Studio history run ${run.id} has an invalid status.`);
  if (typeof run.createdAt !== 'string' || typeof run.updatedAt !== 'string') throw new Error(`Studio history run ${run.id} is missing timestamps.`);
  if (!run.plan || typeof run.plan !== 'object' || Array.isArray(run.plan)) throw new Error(`Studio history run ${run.id} is missing its plan.`);
  const plan = run.plan as Record<string, unknown>;
  if (typeof plan.id !== 'string' || !Array.isArray(plan.tasks) || !Array.isArray(plan.finalAcceptanceCriteria)) throw new Error(`Studio history run ${run.id} has an invalid plan.`);
  if (!Array.isArray(run.tasks) || run.tasks.length !== plan.tasks.length) throw new Error(`Studio history run ${run.id} has an invalid task snapshot.`);
  for (const task of run.tasks as Array<Record<string, unknown>>) {
    if (!task || typeof task !== 'object' || typeof task.id !== 'string' || typeof task.executionId !== 'string' || typeof task.status !== 'string' || !TASK_STATUSES.has(task.status)) {
      throw new Error(`Studio history run ${run.id} contains an invalid task.`);
    }
  }
  return structuredClone(raw as StudioRun);
}

export class StudioHistory {
  private readonly directory: string;
  private readonly archiveDirectory: string;

  constructor(dataDirectory: string, private readonly maxRecords = 100) {
    if (!Number.isInteger(maxRecords) || maxRecords < 10 || maxRecords > 1000) throw new Error('Invalid Studio history retention limit.');
    this.directory = resolve(dataDirectory, 'studio-runs');
    this.archiveDirectory = resolve(dataDirectory, 'studio-runs-archive');
  }

  load(): StudioRun[] {
    if (!existsSync(this.directory)) return [];
    const info = lstatSync(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Studio history storage must be a real directory.');
    const names = readdirSync(this.directory).filter(name => /^[a-zA-Z0-9_-]{1,100}\.json$/.test(name));
    if (names.length > 1000) throw new Error('Studio history contains too many active records; archive the data directory before continuing.');
    const runs = names.map(name => this.readFile(join(this.directory, name)));
    return runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  persist(run: StudioRun): void {
    if (!RUN_ID.test(run.id)) throw new Error('Cannot persist an invalid Studio run ID.');
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (lstatSync(this.directory).isSymbolicLink()) throw new Error('Studio history storage cannot be a symbolic link.');
    atomicWrite(join(this.directory, `${run.id}.json`), JSON.stringify(run));
    this.archiveOverflow();
  }

  private readFile(path: string): StudioRun {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 5_000_000) throw new Error('Invalid Studio history record.');
    return validateRun(JSON.parse(readFileSync(path, 'utf8')));
  }

  private archiveOverflow(): void {
    const runs = this.load();
    if (runs.length <= this.maxRecords) return;
    mkdirSync(this.archiveDirectory, { recursive: true, mode: 0o700 });
    if (lstatSync(this.archiveDirectory).isSymbolicLink()) throw new Error('Studio history archive cannot be a symbolic link.');
    let overflow = runs.length - this.maxRecords;
    for (const run of runs) {
      if (overflow <= 0) break;
      if (!terminalRun(run.status)) continue;
      renameSync(join(this.directory, `${run.id}.json`), join(this.archiveDirectory, `${run.id}.json`));
      overflow--;
    }
    if (overflow > 0) throw new Error('Studio history retention is full of non-terminal runs; recovery must complete before more history can be stored.');
  }
}
