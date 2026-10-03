import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import type {
  MatterhornAgentEvaluationAdapter,
  MatterhornAgentEvaluationRequest,
  MatterhornAgentEvaluationResult,
  MatterhornRuntimeHealth,
} from "./runtimeCapabilities.js";

export interface MatterhornLocalAgentEvaluationOptions {
  readonly runnerPath: string;
  readonly nodePath?: string;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
}

interface RunnerResult {
  readonly passed?: unknown;
  readonly score?: unknown;
  readonly reason?: unknown;
  readonly metric?: unknown;
}

function validRequest(input: MatterhornAgentEvaluationRequest): void {
  if (!input.goal.trim() || input.goal.length > 12_000) throw new Error("Agent-evaluation goal is empty or too large.");
  if (!input.outcome.trim() || input.outcome.length > 50_000) throw new Error("Agent-evaluation outcome is empty or too large.");
  if (input.criteria && (input.criteria.length > 30 || input.criteria.some(item => !item.trim() || item.length > 2_000))) {
    throw new Error("Invalid agent-evaluation criteria.");
  }
  if (input.threshold != null && (!Number.isFinite(input.threshold) || input.threshold < 0 || input.threshold > 1)) {
    throw new Error("Agent-evaluation threshold must be between 0 and 1.");
  }
}

export class MatterhornLocalAgentEvaluationAdapter implements MatterhornAgentEvaluationAdapter {
  readonly id = "matterhorn.agent-evaluation.local";
  readonly capability = "agent-evaluation" as const;
  readonly attribution = {
    sourceProject: "DeepEval",
    sourceUrl: "https://github.com/confident-ai/deepeval",
    license: "Apache-2.0",
  } as const;

  private readonly runnerPath: string;
  private readonly nodePath: string;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;

  constructor(options: MatterhornLocalAgentEvaluationOptions) {
    if (!options.runnerPath.trim()) throw new Error("Matterhorn agent-evaluation runner path is required.");
    this.runnerPath = options.runnerPath;
    this.nodePath = options.nodePath?.trim() || process.execPath;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1_000 || this.timeoutMs > 300_000) {
      throw new Error("Invalid Matterhorn agent-evaluation timeout.");
    }
    if (!Number.isInteger(this.maxOutputBytes) || this.maxOutputBytes < 1024 || this.maxOutputBytes > 8 * 1024 * 1024) {
      throw new Error("Invalid Matterhorn agent-evaluation output limit.");
    }
  }

  async health(): Promise<MatterhornRuntimeHealth> {
    try {
      await access(this.runnerPath);
      const raw = await this.run(["--health"]);
      const parsed = JSON.parse(raw) as { ok?: unknown; engine?: unknown; version?: unknown };
      return parsed.ok === true
        ? { state: "ready", diagnosticDetail: "Agent validation runtime is ready." }
        : { state: "degraded", diagnosticDetail: "Agent validation runtime did not report ready." };
    } catch (error) {
      return {
        state: "unavailable",
        diagnosticDetail: error instanceof Error ? error.message : "Agent validation runtime is unavailable.",
      };
    }
  }

  async evaluate(input: MatterhornAgentEvaluationRequest): Promise<MatterhornAgentEvaluationResult> {
    validRequest(input);
    const raw = await this.run([], JSON.stringify(input));
    let parsed: RunnerResult;
    try {
      parsed = JSON.parse(raw) as RunnerResult;
    } catch {
      throw new Error("Matterhorn Agent Validation returned invalid JSON.");
    }
    if (
      typeof parsed.passed !== "boolean" ||
      typeof parsed.score !== "number" ||
      !Number.isFinite(parsed.score) ||
      parsed.score < 0 ||
      parsed.score > 1 ||
      typeof parsed.metric !== "string" ||
      !parsed.metric.trim()
    ) {
      throw new Error("Matterhorn Agent Validation returned an invalid result.");
    }
    return {
      passed: parsed.passed,
      score: parsed.score,
      metric: parsed.metric,
      ...(typeof parsed.reason === "string" && parsed.reason.trim() ? { reason: parsed.reason } : {}),
    };
  }

  private run(args: readonly string[], stdin?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.nodePath, [this.runnerPath, ...args], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, DEEPEVAL_TELEMETRY_OPT_OUT: process.env.DEEPEVAL_TELEMETRY_OPT_OUT ?? "YES" },
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (error?: Error, value?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value ?? "");
      };

      const timer = setTimeout(() => {
        child.kill();
        finish(new Error("Matterhorn Agent Validation timed out."));
      }, this.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        stdout += chunk;
        if (Buffer.byteLength(stdout, "utf8") > this.maxOutputBytes) {
          child.kill();
          finish(new Error("Matterhorn Agent Validation output exceeded the configured limit."));
        }
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", chunk => {
        stderr += chunk;
        if (Buffer.byteLength(stderr, "utf8") > this.maxOutputBytes) {
          child.kill();
          finish(new Error("Matterhorn Agent Validation error output exceeded the configured limit."));
        }
      });
      child.on("error", error => finish(error));
      child.on("close", code => {
        if (code !== 0) {
          finish(new Error(`Matterhorn Agent Validation failed${stderr.trim() ? `: ${stderr.trim().slice(0, 1000)}` : "."}`));
          return;
        }
        finish(undefined, stdout.trim());
      });

      if (stdin !== undefined) child.stdin.end(stdin);
      else child.stdin.end();
    });
  }
}
