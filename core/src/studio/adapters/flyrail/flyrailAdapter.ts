/**
 * Flyrail specialist adapter — implements the SpecialistAdapter
 * interface for Flyrail's Godot execution system.
 *
 * This is the ONLY entry point that Matterhorn uses to interact
 * with Flyrail. All Flyrail-specific details are hidden behind
 * FlyrailClient and FlyrailMapper.
 */

import type { NssStudioExecutionResult, NssStudioHandoff } from "../../types.js";
import {
  SpecialistError,
  type SpecialistAdapter,
  type SpecialistCapabilitySet,
  type SpecialistCancelResult,
  type SpecialistHealthResult,
  type SpecialistTaskHandle,
  type SpecialistTaskStatus,
} from "../types.js";
import { FlyrailClient, type FlyrailClientOptions } from "./flyrailClient.js";
import {
  handoffToLoopRunParams,
  loopReportToExecutionResult,
  mapFlyrailCapabilities,
  mapLoopStageToPhase,
  type FlyrailCapabilitiesResponse,
  type FlyrailLoopReport,
  type FlyrailLoopStatus,
  type FlyrailSystemPing,
} from "./flyrailMapper.js";

// ── Options ─────────────────────────────────────────────────────────

export interface FlyrailAdapterOptions extends FlyrailClientOptions {
  /**
   * Absolute path to the Godot project that tasks should target.
   * Required for submitTask if handoff doesn't specify one; optional for health/capabilities.
   */
  projectPath?: string;
}

interface ActiveRun {
  taskId: string;
  sessionId: string;
  status: "running" | "completed" | "failed";
  result?: NssStudioExecutionResult;
  error?: Error;
  promise: Promise<void>;
}

// ── Adapter ─────────────────────────────────────────────────────────

export class FlyrailAdapter implements SpecialistAdapter {
  readonly specialistId = "flyrail" as const;

  private readonly client: FlyrailClient;
  private readonly projectPath: string | undefined;
  private cachedCapabilities: SpecialistCapabilitySet | null = null;
  private readonly sessions = new Map<string, string>(); // projectPath -> sessionId
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(options: FlyrailAdapterOptions = {}) {
    this.client = new FlyrailClient(options);
    this.projectPath = options.projectPath;
  }

  // ── Health ──────────────────────────────────────────────────────

  async health(): Promise<SpecialistHealthResult> {
    try {
      const h = await this.client.health();
      return {
        available: h.ok === true && h.product === "flyrail",
        specialistId: "flyrail",
        version: `${h.protocolVersion}`,
        protocolVersion: h.protocolVersion,
        capabilities: this.cachedCapabilities?.capabilities,
        detail: `phase=${h.phase} bridge=${h.bridge} runtime=${h.runtime}`,
      };
    } catch (error) {
      return {
        available: false,
        specialistId: "flyrail",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ── Capabilities ────────────────────────────────────────────────

  async getCapabilities(): Promise<SpecialistCapabilitySet> {
    if (this.cachedCapabilities) return this.cachedCapabilities;

    try {
      await this.client.connect();
      let explicitCaps: string[] | undefined;
      let protocolVersion = "0.15.0";
      let phase = 15;

      try {
        const capsRes = (await this.client.call("system.capabilities")) as FlyrailCapabilitiesResponse;
        if (Array.isArray(capsRes?.capabilities)) {
          explicitCaps = capsRes.capabilities;
        }
        if (capsRes?.protocolVersion) protocolVersion = capsRes.protocolVersion;
        if (typeof capsRes?.phase === "number") phase = capsRes.phase;
      } catch {
        // Fallback if system.capabilities is not supported
      }

      if (!explicitCaps) {
        const ping = (await this.client.call("system.ping")) as FlyrailSystemPing;
        protocolVersion = ping.protocolVersion;
        phase = ping.phase;
      }

      const capabilities = mapFlyrailCapabilities(protocolVersion, phase, explicitCaps);
      this.cachedCapabilities = capabilities;
      return capabilities;
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("SPECIALIST_UNAVAILABLE", `Cannot discover capabilities: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Session Management ──────────────────────────────────────────

  async ensureSession(projectPath: string): Promise<string> {
    const existing = this.sessions.get(projectPath);
    if (existing) return existing;

    await this.client.connect();
    const res = (await this.client.call("project.open", { path: projectPath, installAddons: false })) as { sessionId?: string };
    if (!res?.sessionId) {
      throw new SpecialistError("PROJECT_UNAVAILABLE", `project.open failed to return sessionId for path: ${projectPath}`);
    }
    this.sessions.set(projectPath, res.sessionId);
    return res.sessionId;
  }

  // ── Submit task ─────────────────────────────────────────────────

  async submitTask(handoff: NssStudioHandoff): Promise<SpecialistTaskHandle> {
    if (handoff.protocol !== "nss.studio-handoff.v1") {
      throw new SpecialistError("PROTOCOL_MISMATCH", `Unsupported handoff protocol: ${handoff.protocol}`);
    }

    if (handoff.to !== "flyrail") {
      throw new SpecialistError("INVALID_TASK", `This adapter only accepts tasks for flyrail, got: ${handoff.to}`);
    }

    const projectPath = this.resolveProjectPath(handoff);
    if (!projectPath) {
      throw new SpecialistError("PROJECT_UNAVAILABLE", "No project path specified. Provide projectPath in adapter options or as an input artifact with kind 'godot-project'.");
    }

    try {
      const sessionId = await this.ensureSession(projectPath);
      const params = handoffToLoopRunParams(handoff, sessionId);

      const activeRun: ActiveRun = {
        taskId: handoff.taskId,
        sessionId,
        status: "running",
        promise: Promise.resolve(),
      };

      // Launch non-blocking background loop.run request over WebSocket
      activeRun.promise = (async () => {
        try {
          const res = (await this.client.call("loop.run", params)) as { runId?: string; report?: FlyrailLoopReport } | undefined;
          let report = res?.report;
          if (!report) {
            report = (await this.client.call("loop.last_report", { runId: handoff.taskId })) as FlyrailLoopReport;
          }
          activeRun.status = report.ok ? "completed" : "failed";
          activeRun.result = loopReportToExecutionResult(handoff.taskId, report);
        } catch (err) {
          activeRun.status = "failed";
          activeRun.error = err instanceof Error ? err : new Error(String(err));
          activeRun.result = {
            taskId: handoff.taskId,
            specialistId: "flyrail",
            status: "failed",
            summary: `Loop execution failed: ${activeRun.error.message}`,
          };
        }
      })();

      this.activeRuns.set(handoff.taskId, activeRun);

      return {
        taskId: handoff.taskId,
        specialistId: "flyrail",
        accepted: true,
        detail: `Session ${sessionId} running loop ${handoff.taskId}`,
      };
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("EXECUTION_FAILED", `Failed to submit task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Task status ─────────────────────────────────────────────────

  async getTaskStatus(taskId: string): Promise<SpecialistTaskStatus> {
    const active = this.activeRuns.get(taskId);
    if (active) {
      return {
        taskId,
        specialistId: "flyrail",
        phase: active.status === "completed" ? "completed" : active.status === "failed" ? "failed" : "running",
        detail: active.status,
      };
    }

    try {
      await this.client.connect();
      const result = (await this.client.call("loop.status", { runId: taskId })) as FlyrailLoopStatus | undefined;

      if (!result) {
        return {
          taskId,
          specialistId: "flyrail",
          phase: "unknown",
          detail: "No status available",
        };
      }

      return {
        taskId,
        specialistId: "flyrail",
        phase: result.status === "done" ? "completed" : result.status === "failed" ? "failed" : mapLoopStageToPhase(result.stage ?? result.status),
        detail: result.status,
      };
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("EXECUTION_FAILED", `Failed to get task status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Result ──────────────────────────────────────────────────────

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    const active = this.activeRuns.get(taskId);
    if (active?.result) {
      return active.result;
    }

    try {
      await this.client.connect();
      const report = (await this.client.call("loop.last_report", { runId: taskId })) as FlyrailLoopReport | null;

      if (!report) {
        return {
          taskId,
          specialistId: "flyrail",
          status: "blocked",
          summary: "No result available yet",
        };
      }

      return loopReportToExecutionResult(taskId, report);
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("EXECUTION_FAILED", `Failed to get result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Cancel ──────────────────────────────────────────────────────

  async cancelTask(taskId: string): Promise<SpecialistCancelResult> {
    return {
      taskId,
      cancelled: false,
      detail: "Cancellation is not yet supported for loop.run tasks. The task will complete or fail on its own.",
    };
  }

  // ── Disconnect ────────────────────────────────────────────────

  disconnect(): void {
    this.client.disconnect();
    this.cachedCapabilities = null;
    this.sessions.clear();
    this.activeRuns.clear();
  }

  // ── Internals ─────────────────────────────────────────────────

  private resolveProjectPath(handoff: NssStudioHandoff): string | undefined {
    if (this.projectPath) return this.projectPath;

    const projectArtifact = handoff.inputArtifacts.find(
      (a) => a.kind === "godot-project" || a.kind === "project-path",
    );
    return projectArtifact?.uri;
  }
}
