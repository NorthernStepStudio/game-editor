import { isAbsolute } from "node:path";
import { spawn } from "node:child_process";
import type {
  MatterhornRuntimeHealth,
  MatterhornSafeExecutionAdapter,
  MatterhornSafeExecutionRequest,
  MatterhornSafeExecutionResult,
} from "./runtimeCapabilities.js";

export interface MatterhornSafeExecutionProfile {
  readonly id: string;
  readonly image: string;
  readonly workspacePath?: string;
  readonly containerPath?: string;
  readonly workingDirectory?: string;
  readonly memory?: string;
  readonly cpus?: number;
  readonly pidsLimit?: number;
  readonly tmpfsSizeMb?: number;
}

export interface MatterhornOciSafeExecutionOptions {
  readonly enginePath?: string;
  readonly engineArgs?: readonly string[];
  readonly profiles: readonly MatterhornSafeExecutionProfile[];
  readonly defaultTimeoutMs?: number;
  readonly maxOutputBytes?: number;
}

function validProfileId(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value);
}

function validImage(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,255}$/.test(value) && !value.includes("..");
}

function validContainerPath(value: string): boolean {
  return /^\/[a-zA-Z0-9._/-]+$/.test(value) && !value.split("/").includes("..");
}

function validMemory(value: string): boolean {
  return /^[1-9][0-9]*(?:[kKmMgG])?$/.test(value);
}

function validateProfiles(profiles: readonly MatterhornSafeExecutionProfile[]): void {
  if (!profiles.length || profiles.length > 20) throw new Error("Matterhorn Safe Execution requires 1 to 20 profiles.");
  const ids = new Set<string>();
  for (const profile of profiles) {
    if (!validProfileId(profile.id) || ids.has(profile.id)) throw new Error("Invalid or duplicate Safe Execution profile id.");
    ids.add(profile.id);
    if (!validImage(profile.image)) throw new Error(`Invalid Safe Execution image for ${profile.id}.`);
    if (profile.workspacePath) {
      if (!isAbsolute(profile.workspacePath) || profile.workspacePath.includes(",")) {
        throw new Error(`Safe Execution workspace for ${profile.id} must be an absolute path without commas.`);
      }
      if (!profile.containerPath || !validContainerPath(profile.containerPath)) {
        throw new Error(`Safe Execution profile ${profile.id} requires a valid container path.`);
      }
    } else if (profile.containerPath) {
      throw new Error(`Safe Execution profile ${profile.id} cannot define a container path without a workspace path.`);
    }
    if (profile.workingDirectory && !validContainerPath(profile.workingDirectory)) {
      throw new Error(`Invalid Safe Execution working directory for ${profile.id}.`);
    }
    if (profile.memory && !validMemory(profile.memory)) throw new Error(`Invalid Safe Execution memory limit for ${profile.id}.`);
    if (profile.cpus != null && (!Number.isFinite(profile.cpus) || profile.cpus <= 0 || profile.cpus > 16)) {
      throw new Error(`Invalid Safe Execution CPU limit for ${profile.id}.`);
    }
    if (profile.pidsLimit != null && (!Number.isInteger(profile.pidsLimit) || profile.pidsLimit < 16 || profile.pidsLimit > 4096)) {
      throw new Error(`Invalid Safe Execution PID limit for ${profile.id}.`);
    }
    if (profile.tmpfsSizeMb != null && (!Number.isInteger(profile.tmpfsSizeMb) || profile.tmpfsSizeMb < 16 || profile.tmpfsSizeMb > 4096)) {
      throw new Error(`Invalid Safe Execution tmpfs limit for ${profile.id}.`);
    }
  }
}

function validateRequest(input: MatterhornSafeExecutionRequest): void {
  if (!validProfileId(input.profileId)) throw new Error("Invalid Safe Execution profile id.");
  if (!Array.isArray(input.argv) || !input.argv.length || input.argv.length > 100) {
    throw new Error("Safe Execution requires 1 to 100 command arguments.");
  }
  for (const arg of input.argv) {
    if (typeof arg !== "string" || arg.length > 8_000 || /[\0\r\n]/.test(arg)) {
      throw new Error("Invalid Safe Execution command argument.");
    }
  }
  if (input.env) {
    const entries = Object.entries(input.env);
    if (entries.length > 50) throw new Error("Safe Execution accepts at most 50 environment variables.");
    for (const [key, value] of entries) {
      if (!/^[A-Z_][A-Z0-9_]{0,127}$/i.test(key) || value.length > 8_000 || /[\0\r\n]/.test(value)) {
        throw new Error("Invalid Safe Execution environment variable.");
      }
    }
  }
}

export class MatterhornOciSafeExecutionAdapter implements MatterhornSafeExecutionAdapter {
  readonly id = "matterhorn.safe-execution.oci";
  readonly capability = "sandbox-execution" as const;
  readonly attribution = {
    sourceProject: "OCI container runtime",
    sourceUrl: "https://opencontainers.org/",
    license: "Protocol / runtime integration",
  } as const;

  private readonly enginePath: string;
  private readonly engineArgs: readonly string[];
  private readonly profiles: ReadonlyMap<string, MatterhornSafeExecutionProfile>;
  private readonly defaultTimeoutMs: number;
  private readonly maxOutputBytes: number;

  constructor(options: MatterhornOciSafeExecutionOptions) {
    validateProfiles(options.profiles);
    this.enginePath = options.enginePath?.trim() || "docker";
    if (!this.enginePath || /[\r\n\0]/.test(this.enginePath)) throw new Error("Invalid Safe Execution engine path.");
    this.engineArgs = [...options.engineArgs ?? []];
    if (this.engineArgs.length > 20 || this.engineArgs.some(arg => typeof arg !== "string" || arg.length > 8000 || /[\r\n\0]/.test(arg))) {
      throw new Error("Invalid Safe Execution engine arguments.");
    }
    this.profiles = new Map(options.profiles.map(profile => [profile.id, { ...profile }]));
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024;
    if (!Number.isFinite(this.defaultTimeoutMs) || this.defaultTimeoutMs < 1_000 || this.defaultTimeoutMs > 900_000) {
      throw new Error("Invalid Safe Execution default timeout.");
    }
    if (!Number.isInteger(this.maxOutputBytes) || this.maxOutputBytes < 1024 || this.maxOutputBytes > 32 * 1024 * 1024) {
      throw new Error("Invalid Safe Execution output limit.");
    }
  }

  async health(): Promise<MatterhornRuntimeHealth> {
    try {
      const result = await this.spawnBounded(["version", "--format", "{{.Server.Version}}"], 10_000);
      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return { state: "degraded", diagnosticDetail: "Safe Execution engine is installed but not ready." };
      }
      return { state: "ready", diagnosticDetail: "Safe Execution container engine is ready." };
    } catch (error) {
      return {
        state: "unavailable",
        diagnosticDetail: error instanceof Error ? error.message : "Safe Execution engine is unavailable.",
      };
    }
  }

  async execute(input: MatterhornSafeExecutionRequest): Promise<MatterhornSafeExecutionResult> {
    validateRequest(input);
    const profile = this.profiles.get(input.profileId);
    if (!profile) throw new Error("Safe Execution profile is not configured.");
    const timeoutMs = input.timeoutMs ?? this.defaultTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 900_000) {
      throw new Error("Invalid Safe Execution timeout.");
    }

    const args = [
      "run",
      "--rm",
      "--network", "none",
      "--read-only",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", String(profile.pidsLimit ?? 256),
      "--memory", profile.memory ?? "1g",
      "--cpus", String(profile.cpus ?? 1),
      "--tmpfs", `/tmp:rw,nosuid,nodev,noexec,size=${profile.tmpfsSizeMb ?? 256}m`,
    ];

    if (profile.workspacePath && profile.containerPath) {
      args.push("--mount", `type=bind,src=${profile.workspacePath},dst=${profile.containerPath},readonly`);
    }
    if (profile.workingDirectory) args.push("--workdir", profile.workingDirectory);
    for (const [key, value] of Object.entries(input.env ?? {})) {
      args.push("--env", `${key}=${value}`);
    }

    args.push(profile.image, ...input.argv);
    const startedAt = Date.now();
    const result = await this.spawnBounded(args, timeoutMs);
    return {
      ...result,
      durationMs: Date.now() - startedAt,
    };
  }

  private spawnBounded(
    args: readonly string[],
    timeoutMs: number,
  ): Promise<Omit<MatterhornSafeExecutionResult, "durationMs">> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.enginePath, [...this.engineArgs, ...args], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;

      const finish = (error?: Error, exitCode: number | null = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve({ exitCode, stdout, stderr, timedOut });
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        stdout += chunk;
        if (Buffer.byteLength(stdout, "utf8") > this.maxOutputBytes) {
          child.kill();
          finish(new Error("Safe Execution stdout exceeded the configured limit."));
        }
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", chunk => {
        stderr += chunk;
        if (Buffer.byteLength(stderr, "utf8") > this.maxOutputBytes) {
          child.kill();
          finish(new Error("Safe Execution stderr exceeded the configured limit."));
        }
      });
      child.on("error", error => finish(error));
      child.on("close", code => finish(undefined, code));
    });
  }
}
