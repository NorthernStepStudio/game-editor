/**
 * Flyrail specialist adapter — implements the SpecialistAdapter
 * interface for Flyrail's Godot execution system.
 *
 * This is the ONLY entry point that Matterhorn uses to interact
 * with Flyrail.  All Flyrail-specific details are hidden behind
 * FlyrailClient and FlyrailMapper.
 */

import type { NssStudioExecutionResult, NssStudioHandoff } from "../../types.js";
import {
  ADAPTER_DEFAULTS,
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
  type FlyrailLoopReport,
  type FlyrailLoopStatus,
  type FlyrailSystemPing,
} from "./flyrailMapper.js";

// ── Options ─────────────────────────────────────────────────────────

export interface FlyrailAdapterOptions extends FlyrailClientOptions {
  /**
   * Absolute path to the Godot project that tasks should target.
   * Required for submitTask; optional for health/capabilities.
   */
  projectPath?: string;
}

// ── Adapter ─────────────────────────────────────────────────────────

export class FlyrailAdapter implements SpecialistAdapter {
  readonly specialistId = "flyrail" as const;

  private readonly client: FlyrailClient;
  private readonly projectPath: string | undefined;
  private cachedCapabilities: SpecialistCapabilitySet | null = null;

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
      const ping = (await this.client.call("system.ping")) as FlyrailSystemPing;

      const capabilities = mapFlyrailCapabilities(ping.protocolVersion, ping.phase);
      this.cachedCapabilities = capabilities;
      return capabilities;
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("SPECIALIST_UNAVAILABLE", `Cannot discover capabilities: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      await this.client.connect();
      const params = handoffToLoopRunParams(handoff, projectPath);
      const result = (await this.client.call("loop.run", params)) as { requestId?: string; ok?: boolean } | undefined;

      return {
        taskId: handoff.taskId,
        specialistId: "flyrail",
        accepted: true,
        detail: result?.requestId ? `loop request ${result.requestId}` : "task submitted",
      };
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("EXECUTION_FAILED", `Failed to submit task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Task status ─────────────────────────────────────────────────

  async getTaskStatus(taskId: string): Promise<SpecialistTaskStatus> {
    try {
      await this.client.connect();
      const result = (await this.client.call("loop.status", { requestId: taskId })) as FlyrailLoopStatus | undefined;

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
        phase: mapLoopStageToPhase(result.stage),
        detail: result.status,
      };
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw new SpecialistError("EXECUTION_FAILED", `Failed to get task status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Result ──────────────────────────────────────────────────────

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    try {
      await this.client.connect();
      const report = (await this.client.call("loop.last_report", { requestId: taskId })) as FlyrailLoopReport | null;

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
    // Flyrail's loop.run currently does not support mid-execution cancellation.
    // We report this honestly rather than faking it.
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
  }

  // ── Internals ─────────────────────────────────────────────────

  /**
   * Resolve the project path from adapter options or handoff input artifacts.
   */
  private resolveProjectPath(handoff: NssStudioHandoff): string | undefined {
    if (this.projectPath) return this.projectPath;

    // Check input artifacts for a godot-project reference.
    const projectArtifact = handoff.inputArtifacts.find(
      (a) => a.kind === "godot-project" || a.kind === "project-path",
    );
    return projectArtifact?.uri;
  }
}
