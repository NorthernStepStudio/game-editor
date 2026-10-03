import { mkdir, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { inspectProjectGitSafety } from "./gitSafety.js";

export interface MatterhornWorkspaceHolder {
  readonly agentId: string;
  readonly runId: string;
  readonly taskId: string;
}

export interface MatterhornIsolatedWorkspace {
  readonly id: string;
  readonly repositoryRoot: string;
  readonly sourceProjectPath: string;
  readonly workspaceRoot: string;
  readonly projectPath: string;
  readonly branch: string;
  readonly baseCommit: string;
  readonly holder: MatterhornWorkspaceHolder;
  readonly createdAt: string;
}

export interface MatterhornWorkspaceReview {
  readonly workspace: MatterhornIsolatedWorkspace;
  readonly headCommit: string;
  readonly commitsAhead: number;
  readonly dirty: boolean;
  readonly changes: readonly string[];
  readonly readyForReview: boolean;
}

export interface MatterhornWorkspaceManagerOptions {
  readonly rootDirectory: string;
  readonly gitPath?: string;
  readonly commandTimeoutMs?: number;
}

interface GitResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function validIdentity(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(value);
}

function validateHolder(holder: MatterhornWorkspaceHolder): void {
  if (!validIdentity(holder.agentId) || !validIdentity(holder.runId) || !validIdentity(holder.taskId)) {
    throw new Error("Invalid Matterhorn workspace holder identity.");
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "work";
}

function confined(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return Boolean(rel) && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function parsePorcelain(raw: string): string[] {
  return raw.split("\0").filter(Boolean).slice(0, 100).map(entry => {
    const value = entry.length > 3 && entry[2] === " " ? entry.slice(3) : entry;
    return value.replace(/[\r\n\0]/g, " ").slice(0, 1_000);
  });
}

export class MatterhornWorkspaceManager {
  private readonly rootDirectory: string;
  private readonly gitPath: string;
  private readonly commandTimeoutMs: number;

  constructor(options: MatterhornWorkspaceManagerOptions) {
    if (!isAbsolute(options.rootDirectory)) throw new Error("Matterhorn workspace root must be absolute.");
    this.rootDirectory = resolve(options.rootDirectory);
    this.gitPath = options.gitPath?.trim() || "git";
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000;
    if (!this.gitPath || /[\0\r\n]/.test(this.gitPath)) throw new Error("Invalid Git executable.");
    if (!Number.isFinite(this.commandTimeoutMs) || this.commandTimeoutMs < 1_000 || this.commandTimeoutMs > 300_000) {
      throw new Error("Invalid Matterhorn workspace command timeout.");
    }
  }

  async create(projectPath: string, holder: MatterhornWorkspaceHolder): Promise<MatterhornIsolatedWorkspace> {
    validateHolder(holder);
    if (!isAbsolute(projectPath)) throw new Error("Matterhorn workspace project path must be absolute.");

    const safety = await inspectProjectGitSafety(projectPath);
    if (!safety.gitAvailable) throw new Error("Git is required for isolated Matterhorn workspaces.");
    if (!safety.repository || !safety.root || !safety.head) throw new Error("Project must be inside a Git repository.");
    if (safety.dirty) throw new Error("Create an isolated workspace only from a clean Git project.");

    const repositoryRoot = resolve(safety.root);
    const sourceProjectPath = resolve(projectPath);
    const projectRelative = relative(repositoryRoot, sourceProjectPath);
    if (projectRelative === ".." || projectRelative.startsWith(`..${sep}`) || isAbsolute(projectRelative)) {
      throw new Error("Configured project path is outside its Git repository.");
    }

    const id = [slug(holder.runId), slug(holder.agentId), slug(holder.taskId)].join("-");
    const branch = `matterhorn/${slug(holder.runId)}-${slug(holder.agentId)}-${slug(holder.taskId)}`;
    const repoKey = `${slug(basename(repositoryRoot))}-${safety.head.slice(0, 8)}`;
    const workspaceRoot = resolve(this.rootDirectory, repoKey, id);
    if (!confined(this.rootDirectory, workspaceRoot)) throw new Error("Matterhorn workspace path escaped its root.");

    await mkdir(resolve(this.rootDirectory, repoKey), { recursive: true });
    const branchCheck = await this.git(repositoryRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], true);
    if (branchCheck.code === 0) throw new Error(`Matterhorn workspace branch already exists: ${branch}`);
    if (branchCheck.code !== 1) throw new Error("Could not verify Matterhorn workspace branch availability.");

    const add = await this.git(repositoryRoot, ["worktree", "add", "-b", branch, workspaceRoot, safety.head]);
    if (add.code !== 0) {
      throw new Error(`Could not create isolated Matterhorn workspace: ${add.stderr.trim().slice(0, 1_000)}`);
    }

    const rootReal = await realpath(workspaceRoot);
    if (!confined(this.rootDirectory, rootReal)) throw new Error("Created Matterhorn workspace escaped its configured root.");
    const isolatedProjectPath = projectRelative ? resolve(rootReal, projectRelative) : rootReal;
    try {
      await stat(isolatedProjectPath);
    } catch {
      throw new Error("Configured project path is missing inside the new isolated workspace.");
    }

    return {
      id,
      repositoryRoot,
      sourceProjectPath,
      workspaceRoot: rootReal,
      projectPath: isolatedProjectPath,
      branch,
      baseCommit: safety.head,
      holder: { ...holder },
      createdAt: new Date().toISOString(),
    };
  }

  async review(workspace: MatterhornIsolatedWorkspace): Promise<MatterhornWorkspaceReview> {
    this.validateWorkspace(workspace);
    const [head, count, status] = await Promise.all([
      this.git(workspace.workspaceRoot, ["rev-parse", "HEAD"]),
      this.git(workspace.workspaceRoot, ["rev-list", "--count", `${workspace.baseCommit}..HEAD`]),
      this.git(workspace.workspaceRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    ]);
    if (head.code !== 0 || count.code !== 0 || status.code !== 0) throw new Error("Could not inspect isolated Matterhorn workspace.");
    const changes = parsePorcelain(status.stdout);
    const commitsAhead = Number.parseInt(count.stdout.trim(), 10);
    if (!Number.isInteger(commitsAhead) || commitsAhead < 0) throw new Error("Matterhorn workspace commit count is invalid.");
    return {
      workspace: structuredClone(workspace),
      headCommit: head.stdout.trim(),
      commitsAhead,
      dirty: Boolean(status.stdout),
      changes,
      readyForReview: !status.stdout && commitsAhead > 0,
    };
  }

  async remove(workspace: MatterhornIsolatedWorkspace): Promise<{ readonly removed: true; readonly branchKept: string }> {
    const review = await this.review(workspace);
    if (review.dirty) throw new Error("Matterhorn will not remove a dirty isolated workspace.");
    const result = await this.git(workspace.repositoryRoot, ["worktree", "remove", workspace.workspaceRoot]);
    if (result.code !== 0) {
      throw new Error(`Could not remove Matterhorn workspace: ${result.stderr.trim().slice(0, 1_000)}`);
    }
    return { removed: true, branchKept: workspace.branch };
  }

  private validateWorkspace(workspace: MatterhornIsolatedWorkspace): void {
    validateHolder(workspace.holder);
    if (!isAbsolute(workspace.repositoryRoot) || !isAbsolute(workspace.workspaceRoot) || !isAbsolute(workspace.projectPath)) {
      throw new Error("Invalid Matterhorn workspace paths.");
    }
    if (!confined(this.rootDirectory, resolve(workspace.workspaceRoot))) throw new Error("Matterhorn workspace is outside its configured root.");
    if (!/^matterhorn\/[a-z0-9._-]+$/.test(workspace.branch)) throw new Error("Invalid Matterhorn workspace branch.");
    if (!/^[0-9a-f]{40}$/i.test(workspace.baseCommit)) throw new Error("Invalid Matterhorn workspace base commit.");
  }

  private git(cwd: string, args: readonly string[], allowNonZero = false): Promise<GitResult> {
    return new Promise((resolveResult, reject) => {
      const child = spawn(this.gitPath, ["-C", cwd, ...args], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (result: GitResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!allowNonZero && result.code !== 0) {
          reject(new Error(`Git command failed: ${result.stderr.trim().slice(0, 1_000) || "unknown error"}`));
        } else {
          resolveResult(result);
        }
      };
      const timer = setTimeout(() => {
        child.kill();
        finish({ code: null, stdout, stderr: stderr || "Git command timed out." });
      }, this.commandTimeoutMs);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", chunk => { if (stdout.length < 256_000) stdout += chunk; });
      child.stderr.on("data", chunk => { if (stderr.length < 64_000) stderr += chunk; });
      child.on("error", error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", code => finish({ code, stdout, stderr }));
    });
  }
}
