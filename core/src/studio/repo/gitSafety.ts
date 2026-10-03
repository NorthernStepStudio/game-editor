import { isAbsolute, resolve } from "node:path";
import { spawn } from "node:child_process";

export interface MatterhornProjectGitSafety {
  readonly gitAvailable: boolean;
  readonly repository: boolean;
  readonly root?: string;
  readonly head?: string;
  readonly dirty: boolean;
  readonly changes: readonly string[];
  readonly detail?: string;
}

interface GitResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly notFound: boolean;
}

function runGit(projectPath: string, args: readonly string[], timeoutMs = 5_000): Promise<GitResult> {
  return new Promise(resolveResult => {
    const child = spawn("git", ["-C", projectPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (result: GitResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolveResult(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ code: null, stdout, stderr: stderr || "git command timed out", notFound: false });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { if (stdout.length < 128_000) stdout += chunk; });
    child.stderr.on("data", chunk => { if (stderr.length < 32_000) stderr += chunk; });
    child.on("error", error => {
      const notFound = (error as NodeJS.ErrnoException).code === "ENOENT";
      finish({ code: null, stdout, stderr: error.message, notFound });
    });
    child.on("close", code => finish({ code, stdout, stderr, notFound: false }));
  });
}

function parsePorcelain(raw: string): string[] {
  return raw.split("\0")
    .filter(Boolean)
    .slice(0, 100)
    .map(entry => {
      const value = entry.length > 3 && entry[2] === " " ? entry.slice(3) : entry;
      return value.replace(/[\r\n\0]/g, " ").slice(0, 1_000);
    });
}

export async function inspectProjectGitSafety(projectPath: string): Promise<MatterhornProjectGitSafety> {
  if (!isAbsolute(projectPath)) throw new Error("Project Git safety requires an absolute project path.");
  const rootPath = resolve(projectPath);

  const inside = await runGit(rootPath, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.notFound) {
    return {
      gitAvailable: false,
      repository: false,
      dirty: false,
      changes: [],
      detail: "Git is not installed or not available on PATH.",
    };
  }
  if (inside.code !== 0) {
    if (/not a git repository/i.test(inside.stderr)) {
      return {
        gitAvailable: true,
        repository: false,
        dirty: false,
        changes: [],
        detail: "Project is not inside a Git repository.",
      };
    }
    throw new Error(`Could not inspect project Git state: ${inside.stderr.trim().slice(0, 1_000) || "unknown git error"}`);
  }

  const [root, head, status] = await Promise.all([
    runGit(rootPath, ["rev-parse", "--show-toplevel"]),
    runGit(rootPath, ["rev-parse", "HEAD"]),
    runGit(rootPath, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."]),
  ]);
  if (root.code !== 0 || status.code !== 0) {
    throw new Error("Could not read the project Git working tree.");
  }

  const changes = parsePorcelain(status.stdout);
  return {
    gitAvailable: true,
    repository: true,
    root: root.stdout.trim() || undefined,
    head: head.code === 0 ? head.stdout.trim() || undefined : undefined,
    dirty: Boolean(status.stdout),
    changes,
    detail: changes.length
      ? `${changes.length} uncommitted project change(s) detected.`
      : "Project Git working tree is clean.",
  };
}

export async function requireProjectGitMutationSafety(
  projectPath: string,
  allowDirty = false,
): Promise<MatterhornProjectGitSafety> {
  const safety = await inspectProjectGitSafety(projectPath);
  if (safety.repository && safety.dirty && !allowDirty) {
    const sample = safety.changes.slice(0, 8).join(", ");
    throw new Error(
      `Matterhorn will not start autonomous mutation on a dirty Git project. ${sample ? `Current changes: ${sample}. ` : ""}` +
      "Commit/stash the existing work, or explicitly allow a dirty project in Advanced settings.",
    );
  }
  return safety;
}
