import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
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
}

export interface BlenderExecutionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export function executeBlenderPython(
  options: BlenderExecutionOptions,
): BlenderExecutionResult {
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

  // Workspace confinement check
  const realWorkingDir = realpathSync(resolve(options.workingDir));
  const realScriptPath = realpathSync(resolve(options.scriptPath));
  if (!realScriptPath.startsWith(realWorkingDir)) {
    throw new SpecialistError(
      "PERMISSION_DENIED",
      `Script path ${realScriptPath} escapes working directory ${realWorkingDir}`,
    );
  }

  const start = Date.now();
  const spawnOpts: SpawnSyncOptions = {
    cwd: realWorkingDir,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
    windowsHide: true,
  };

  const processArgs = [
    "--background",
    "--python",
    realScriptPath,
    ...(options.args ?? []),
  ];

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
  };
}
