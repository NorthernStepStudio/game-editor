import { spawn, spawnSync, type ChildProcess, type SpawnSyncOptions } from "node:child_process";
import { createWriteStream, existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { SpecialistError } from "../types.js";

export interface BlenderDiscoveryResult {
  readonly executablePath: string;
  readonly version: string;
}

export function findBlenderExecutable(): string | null {
  const envBin = process.env.MATTERHORN_BLENDER_BIN || process.env.BLENDER_BIN;
  if (envBin && existsSync(envBin)) {
    return envBin;
  }

  if (process.platform === "win32") {
    const defaultPaths = [
      "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender\\blender.exe",
    ];
    for (const path of defaultPaths) {
      if (existsSync(path)) return path;
    }

    const whereRes = spawnSync("where.exe", ["blender"], { encoding: "utf8" });
    if (whereRes.status === 0 && whereRes.stdout) {
      const first = String(whereRes.stdout).split(/\r?\n/).find((line) => line.trim().length > 0);
      if (first && existsSync(first.trim())) return first.trim();
    }
  } else if (process.platform === "darwin") {
    const macPaths = [
      "/Applications/Blender.app/Contents/MacOS/Blender",
      join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"),
    ];
    for (const path of macPaths) {
      if (existsSync(path)) return path;
    }
  } else {
    const whichRes = spawnSync("which", ["blender"], { encoding: "utf8" });
    if (whichRes.status === 0 && whichRes.stdout) {
      const first = String(whichRes.stdout).trim();
      if (first && existsSync(first)) return first;
    }
  }

  return null;
}

export function queryBlenderVersion(blenderBin?: string): BlenderDiscoveryResult {
  const bin = blenderBin || findBlenderExecutable();
  if (!bin || !existsSync(bin)) {
    throw new SpecialistError(
      "SPECIALIST_UNAVAILABLE",
      "Blender executable is not installed or could not be found.",
    );
  }

  const res = spawnSync(bin, ["--version"], { encoding: "utf8", windowsHide: true });
  if (res.status !== 0 || !res.stdout) {
    throw new SpecialistError(
      "EXECUTION_FAILED",
      `Failed to query Blender version: ${res.stderr ? String(res.stderr) : "nonzero exit"}`,
    );
  }

  const stdoutText = String(res.stdout);
  const match = stdoutText.match(/Blender\s+([0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9_\-\s]*)/i);
  const version = match ? match[1].trim() : "Unknown";

  return {
    executablePath: bin,
    version,
  };
}

export interface BlenderExecutionOptions {
  readonly blenderBin?: string;
  readonly scriptPath: string;
  readonly workingDir: string;
  readonly timeoutMs?: number;
  readonly args?: readonly string[];
  readonly stdoutLogPath?: string;
  readonly stderrLogPath?: string;
}

export interface BlenderExecutionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut?: boolean;
  readonly pid?: number;
}

function resolveConfinedScript(workingDir: string, scriptPath: string): { binWorkDir: string; binScript: string } {
  const realWorkingDir = realpathSync(resolve(workingDir));
  const realScriptPath = realpathSync(resolve(scriptPath));
  if (!realScriptPath.startsWith(realWorkingDir)) {
    throw new SpecialistError(
      "PERMISSION_DENIED",
      `Script path ${realScriptPath} escapes working directory ${realWorkingDir}`,
    );
  }
  return { binWorkDir: realWorkingDir, binScript: realScriptPath };
}

/** Synchronous bootstrap helper retained for short probes. Prefer async for tasks. */
export function executeBlenderPython(options: BlenderExecutionOptions): BlenderExecutionResult {
  const bin = options.blenderBin || findBlenderExecutable();
  if (!bin || !existsSync(bin)) {
    throw new SpecialistError(
      "SPECIALIST_UNAVAILABLE",
      "Blender executable is not installed or path is invalid.",
    );
  }

  if (!existsSync(options.scriptPath)) {
    throw new SpecialistError(
      "INVALID_TASK",
      `Blender python script not found: ${options.scriptPath}`,
    );
  }

  const { binWorkDir, binScript } = resolveConfinedScript(options.workingDir, options.scriptPath);
  const start = Date.now();
  const spawnOpts: SpawnSyncOptions = {
    cwd: binWorkDir,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
    windowsHide: true,
  };

  const processArgs = ["--background", "--python", binScript, ...(options.args ?? [])];
  const res = spawnSync(bin, processArgs, spawnOpts);
  const durationMs = Date.now() - start;

  if (res.error) {
    if ((res.error as { code?: string }).code === "ETIMEDOUT") {
      throw new SpecialistError(
        "TIMEOUT",
        `Blender execution timed out after ${options.timeoutMs ?? 120_000}ms`,
      );
    }
    throw new SpecialistError(
      "EXECUTION_FAILED",
      `Blender process failed to launch: ${res.error.message}`,
    );
  }

  return {
    exitCode: res.status ?? 1,
    stdout: res.stdout ? String(res.stdout) : "",
    stderr: res.stderr ? String(res.stderr) : "",
    durationMs,
    pid: res.pid,
  };
}

export interface BlenderAsyncExecutionHandle {
  readonly pid: number | undefined;
  readonly promise: Promise<BlenderExecutionResult>;
  cancel(): Promise<{ cancelled: boolean; detail: string }>;
}

/**
 * Asynchronous Blender child process. Captures stdout/stderr to task-scoped logs.
 * Cancellation attempts SIGTERM then SIGKILL; still fail-closed if the OS cannot guarantee stop.
 */
export function executeBlenderPythonAsync(options: BlenderExecutionOptions): BlenderAsyncExecutionHandle {
  const bin = options.blenderBin || findBlenderExecutable();
  if (!bin || !existsSync(bin)) {
    throw new SpecialistError(
      "SPECIALIST_UNAVAILABLE",
      "Blender executable is not installed or path is invalid.",
    );
  }
  if (!existsSync(options.scriptPath)) {
    throw new SpecialistError("INVALID_TASK", `Blender python script not found: ${options.scriptPath}`);
  }

  const { binWorkDir, binScript } = resolveConfinedScript(options.workingDir, options.scriptPath);
  const timeoutMs = options.timeoutMs ?? 300_000;
  const processArgs = ["--background", "--python", binScript, ...(options.args ?? [])];
  const start = Date.now();

  const child: ChildProcess = spawn(bin, processArgs, {
    cwd: binWorkDir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let killed = false;
  let settled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const stdoutLog = options.stdoutLogPath ? createWriteStream(options.stdoutLogPath, { flags: "a" }) : null;
  const stderrLog = options.stderrLogPath ? createWriteStream(options.stderrLogPath, { flags: "a" }) : null;

  child.stdout?.on("data", (chunk: Buffer | string) => {
    const text = String(chunk);
    stdout += text;
    stdoutLog?.write(text);
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    const text = String(chunk);
    stderr += text;
    stderrLog?.write(text);
  });

  const promise = new Promise<BlenderExecutionResult>((resolvePromise, rejectPromise) => {
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      stdoutLog?.end();
      stderrLog?.end();
      resolvePromise({
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        timedOut,
        pid: child.pid,
      });
    };

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      stdoutLog?.end();
      stderrLog?.end();
      rejectPromise(
        new SpecialistError("EXECUTION_FAILED", `Blender process failed to launch: ${error.message}`),
      );
    });

    child.on("close", (code) => {
      finish(code ?? (timedOut || killed ? 1 : 0));
    });

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (!settled) {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
        }
      }, 2_000).unref?.();
    }, timeoutMs);
    timeoutHandle.unref?.();
  });

  return {
    pid: child.pid,
    promise,
    async cancel() {
      if (settled) {
        return { cancelled: false, detail: "Blender process already exited" };
      }
      killed = true;
      try {
        const ok = child.kill("SIGTERM");
        if (!ok) {
          return {
            cancelled: false,
            detail:
              "Cancellation signal could not be delivered; Blender cancellation remains fail-closed and unverified",
          };
        }
        setTimeout(() => {
          if (!settled) {
            try {
              child.kill("SIGKILL");
            } catch {
              // ignore
            }
          }
        }, 2_000).unref?.();
        return {
          cancelled: true,
          detail: "Cancellation signal sent (SIGTERM); completion still depends on process exit",
        };
      } catch (error) {
        return {
          cancelled: false,
          detail: `Cancellation failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}
