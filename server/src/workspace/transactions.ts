import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import type { StudioProject } from '../services/studioService.js';
import { checkText, digest, readWorkspaceFile } from './files.js';
import { projectRoot, workspacePath } from './paths.js';

type TransactionStatus = 'pending' | 'applying' | 'applied' | 'rolling-back' | 'rolled-back' | 'rejected' | 'conflict';

export interface WorkspaceTransactionFile {
  path: string;
  before: string;
  after: string;
  beforeVersion: string;
  afterVersion: string;
}

export interface WorkspaceTransaction {
  id: string;
  projectId: string;
  root: string;
  files: WorkspaceTransactionFile[];
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  detail?: string;
}

function atomicWrite(path: string, text: string, mode: number): void {
  const temporary = join(dirname(path), `.matterhorn-${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(temporary, 'wx', mode);
    writeFileSync(fd, text, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temporary); } catch { /* Rename consumed the temporary file. */ }
  }
}

export class WorkspaceTransactions {
  private readonly directory: string;

  constructor(
    private readonly projects: StudioProject[],
    dataDirectory: string,
    private readonly assertIdle: () => void = () => {},
  ) {
    this.directory = resolve(dataDirectory, 'workspace-transactions');
  }

  stage(
    projectId: string,
    changes: readonly { path: string; version: string; content: string }[],
  ): WorkspaceTransaction {
    if (!Array.isArray(changes) || changes.length < 2 || changes.length > 20) {
      throw new Error('A multi-file change set must contain 2–20 files.');
    }
    const root = projectRoot(this.projects, projectId);
    const seen = new Set<string>();
    const files = changes.map(change => {
      if (!change || typeof change.path !== 'string' || typeof change.version !== 'string' || typeof change.content !== 'string') {
        throw new Error('Invalid change-set file.');
      }
      if (seen.has(change.path)) throw new Error('A change set cannot contain the same file twice.');
      seen.add(change.path);
      checkText(change.content);
      const current = readWorkspaceFile(root, change.path);
      if (current.version !== change.version) throw new Error(`${change.path} changed. Reopen it before reviewing the change set.`);
      if (current.content === change.content) throw new Error(`${change.path} has no proposed change.`);
      return {
        path: change.path,
        before: current.content,
        after: change.content,
        beforeVersion: current.version,
        afterVersion: digest(change.content),
      };
    });
    if (this.ids().length >= 100) throw new Error('Multi-file transaction history limit reached. Archive the local transaction directory before adding more.');
    const now = new Date().toISOString();
    const transaction: WorkspaceTransaction = {
      id: randomUUID(),
      projectId,
      root,
      files,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.persist(transaction);
    return transaction;
  }

  get(id: string): WorkspaceTransaction {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid transaction ID.');
    const path = join(this.directory, `${id}.json`);
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2_000_000) throw new Error('Invalid transaction record.');
    const transaction = JSON.parse(readFileSync(path, 'utf8')) as WorkspaceTransaction;
    this.validateRecord(transaction, id);
    if (projectRoot(this.projects, transaction.projectId) !== transaction.root) {
      throw new Error('Project location changed; this transaction cannot be applied.');
    }
    if (transaction.status === 'applying' || transaction.status === 'rolling-back') this.reconcile(transaction);
    return transaction;
  }

  list(projectId: string): { transactions: WorkspaceTransaction[]; unavailable: number } {
    projectRoot(this.projects, projectId);
    const transactions: WorkspaceTransaction[] = [];
    let unavailable = 0;
    for (const id of this.ids()) {
      try {
        const transaction = this.get(id);
        if (transaction.projectId === projectId) transactions.push(transaction);
      } catch {
        unavailable++;
      }
    }
    transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { transactions, unavailable };
  }

  act(id: string, action: 'apply' | 'reject' | 'rollback'): WorkspaceTransaction {
    const transaction = this.get(id);
    if (action === 'reject') {
      if (transaction.status !== 'pending') throw new Error('Only a pending change set can be rejected.');
      transaction.status = 'rejected';
      transaction.detail = 'Change set rejected. No files were changed.';
      this.persist(transaction);
      return transaction;
    }

    this.assertIdle();
    if (action === 'apply') return this.apply(transaction);
    return this.rollback(transaction);
  }

  private apply(transaction: WorkspaceTransaction): WorkspaceTransaction {
    if (transaction.status !== 'pending') throw new Error('This change set is not pending.');
    for (const file of transaction.files) {
      if (readWorkspaceFile(transaction.root, file.path).version !== file.beforeVersion) {
        throw new Error(`${file.path} changed since review. No files were written.`);
      }
    }

    transaction.status = 'applying';
    transaction.detail = 'Applying reviewed multi-file change set.';
    this.persist(transaction);
    try {
      for (const file of transaction.files) this.writeVersion(transaction.root, file.path, file.after);
      transaction.status = 'applied';
      transaction.detail = 'All reviewed files were applied.';
      this.persist(transaction);
      return transaction;
    } catch (error) {
      try {
        this.rollbackKnown(transaction);
        transaction.status = 'rolled-back';
        transaction.detail = 'Apply failed; files already written by this transaction were restored.';
        this.persist(transaction);
      } catch {
        transaction.status = 'conflict';
        transaction.detail = 'Apply was interrupted and automatic rollback could not be proven safe. Inspect every file before retrying.';
        this.persist(transaction);
      }
      throw error;
    }
  }

  private rollback(transaction: WorkspaceTransaction): WorkspaceTransaction {
    if (!['applied', 'conflict'].includes(transaction.status)) throw new Error('This change set is not in a state that can be rolled back.');
    const versions = transaction.files.map(file => readWorkspaceFile(transaction.root, file.path).version);
    if (versions.some((version, index) => ![transaction.files[index].beforeVersion, transaction.files[index].afterVersion].includes(version))) {
      throw new Error('At least one file changed outside this transaction. Nothing was overwritten.');
    }
    transaction.status = 'rolling-back';
    transaction.detail = 'Restoring original files.';
    this.persist(transaction);
    try {
      this.rollbackKnown(transaction);
      transaction.status = 'rolled-back';
      transaction.detail = 'Original files restored.';
      this.persist(transaction);
      return transaction;
    } catch (error) {
      transaction.status = 'conflict';
      transaction.detail = 'Rollback was interrupted. Inspect the affected files before continuing.';
      this.persist(transaction);
      throw error;
    }
  }

  private rollbackKnown(transaction: WorkspaceTransaction): void {
    for (const file of [...transaction.files].reverse()) {
      const current = readWorkspaceFile(transaction.root, file.path);
      if (current.version === file.beforeVersion) continue;
      if (current.version !== file.afterVersion) throw new Error(`${file.path} has an unknown version; rollback stopped.`);
      this.writeVersion(transaction.root, file.path, file.before);
    }
  }

  private reconcile(transaction: WorkspaceTransaction): void {
    const versions = transaction.files.map(file => readWorkspaceFile(transaction.root, file.path).version);
    const allBefore = versions.every((version, index) => version === transaction.files[index].beforeVersion);
    const allAfter = versions.every((version, index) => version === transaction.files[index].afterVersion);
    if (transaction.status === 'applying') {
      transaction.status = allAfter ? 'applied' : allBefore ? 'pending' : 'conflict';
      transaction.detail = allAfter
        ? 'Recovered a completed multi-file apply after restart.'
        : allBefore
          ? 'Recovered before any file was changed.'
          : 'Restart detected a partial or externally modified apply. No automatic write was attempted.';
    } else {
      transaction.status = allBefore ? 'rolled-back' : 'conflict';
      transaction.detail = allBefore
        ? 'Recovered a completed rollback after restart.'
        : 'Restart detected an incomplete or externally modified rollback. No automatic write was attempted.';
    }
    this.persist(transaction);
  }

  private writeVersion(root: string, relativePath: string, content: string): void {
    checkText(content);
    const target = workspacePath(root, relativePath);
    const mode = lstatSync(target).mode & 0o777;
    atomicWrite(target, content, mode);
  }

  private validateRecord(transaction: WorkspaceTransaction, id: string): void {
    if (!transaction || transaction.id !== id || typeof transaction.projectId !== 'string' || typeof transaction.root !== 'string' || !Array.isArray(transaction.files)) {
      throw new Error('Transaction record integrity check failed.');
    }
    if (transaction.files.length < 2 || transaction.files.length > 20) throw new Error('Transaction record has an invalid file count.');
    const seen = new Set<string>();
    for (const file of transaction.files) {
      if (!file || typeof file.path !== 'string' || seen.has(file.path) || typeof file.before !== 'string' || typeof file.after !== 'string') {
        throw new Error('Transaction record integrity check failed.');
      }
      seen.add(file.path);
      if (digest(file.before) !== file.beforeVersion || digest(file.after) !== file.afterVersion) throw new Error('Transaction record content hash mismatch.');
    }
  }

  private persist(transaction: WorkspaceTransaction): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (lstatSync(this.directory).isSymbolicLink()) throw new Error('Transaction storage cannot be a symbolic link.');
    transaction.updatedAt = new Date().toISOString();
    const target = join(this.directory, `${transaction.id}.json`);
    atomicWrite(target, JSON.stringify(transaction), 0o600);
  }

  private ids(): string[] {
    try {
      return readdirSync(this.directory)
        .filter(name => /^[a-f0-9-]{36}\.json$/.test(name))
        .map(name => name.slice(0, -5));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}

export function publicTransaction({ root: _root, ...transaction }: WorkspaceTransaction) {
  return transaction;
}
