import { spawn } from 'node:child_process';
import type { StudioProject } from '../services/studioService.js';
import { projectRoot } from './paths.js';

const MAX_OUTPUT_BYTES = 256 * 1024;

interface ValidationTask {
  id: string;
  name: string;
  projectId: string;
  command: string;
  args: string[];
  timeoutMs: number;
}

export interface ValidationResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'timed-out';
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  detail?: string;
}

export function configuredValidationTasks(projects: StudioProject[], env: NodeJS.ProcessEnv = process.env): ValidationTask[] {
  const raw: unknown = JSON.parse(env.MATTERHORN_VALIDATIONS ?? '[]');
  if (!Array.isArray(raw) || raw.length > 50) throw new Error('MATTERHORN_VALIDATIONS must be an array with at most 50 tasks.');
  const keys = new Set<string>();
  return raw.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid validation task.');
    const task = item as Record<string, unknown>;
    if (
      typeof task.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(task.id) ||
      typeof task.name !== 'string' || !task.name.trim() || task.name.length > 120 ||
      typeof task.projectId !== 'string' || !projects.some(project => project.id === task.projectId) ||
      typeof task.command !== 'string' || !task.command.trim() || task.command.length > 500 ||
      (task.args !== undefined && (!Array.isArray(task.args) || task.args.length > 32 || task.args.some(arg => typeof arg !== 'string' || arg.length > 1000)))
    ) throw new Error('Invalid validation task.');
    const timeoutMs = task.timeoutMs === undefined ? 120000 : Number(task.timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error('Validation timeout must be 1–300 seconds.');
    const key = `${task.projectId}:${task.id}`;
    if (keys.has(key)) throw new Error('Duplicate validation task ID for a project.');
    keys.add(key);
    return {
      id: task.id,
      name: task.name.trim(),
      projectId: task.projectId,
      command: task.command,
      args: (task.args as string[] | undefined) ?? [],
      timeoutMs,
    };
  });
}

export class WorkspaceValidations {
  constructor(
    private readonly projects: StudioProject[],
    private readonly tasks: readonly ValidationTask[],
    private readonly assertIdle: () => void = () => {},
  ) {}

  list(projectId: string) {
    projectRoot(this.projects, projectId);
    return this.tasks
      .filter(task => task.projectId === projectId)
      .map(({ id, name, projectId: taskProjectId, timeoutMs }) => ({ id, name, projectId: taskProjectId, timeoutMs }));
  }

  run(projectId: string, id: string): Promise<ValidationResult> {
    this.assertIdle();
    const root = projectRoot(this.projects, projectId);
    const task = this.tasks.find(candidate => candidate.projectId === projectId && candidate.id === id);
    if (!task) throw new Error('Unknown configured validation task.');

    return new Promise(resolve => {
      const started = Date.now();
      const child = spawn(task.command, task.args, {
        cwd: root,
        shell: false,
        windowsHide: true,
        env: { ...process.env, MATTERHORN_VALIDATION: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let bytes = 0;
      let timedOut = false;
      let outputExceeded = false;
      let settled = false;

      const append = (target: 'stdout' | 'stderr', chunk: Buffer | string) => {
        const text = chunk.toString();
        bytes += Buffer.byteLength(text);
        if (bytes > MAX_OUTPUT_BYTES) {
          outputExceeded = true;
          child.kill();
          return;
        }
        if (target === 'stdout') stdout += text;
        else stderr += text;
      };
      child.stdout.on('data', chunk => append('stdout', chunk));
      child.stderr.on('data', chunk => append('stderr', chunk));

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, task.timeoutMs);

      const finish = (exitCode: number | null, detail?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          id: task.id,
          name: task.name,
          status: timedOut ? 'timed-out' : exitCode === 0 && !outputExceeded ? 'passed' : 'failed',
          exitCode,
          durationMs: Date.now() - started,
          stdout,
          stderr,
          detail: outputExceeded ? 'Validation output exceeded 256 KiB and the process was stopped.' : detail,
        });
      };

      child.once('error', error => finish(null, error.message));
      child.once('close', code => finish(code));
    });
  }
}
