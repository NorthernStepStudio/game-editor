import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { NssStudioArtifactRef, NssStudioEvidence, NssStudioExecutionResult, NssStudioHandoff } from "../../types.js";
import {
  SpecialistError,
  type SpecialistAdapter,
  type SpecialistCancelResult,
  type SpecialistCapabilitySet,
  type SpecialistHealthResult,
  type SpecialistTaskHandle,
  type SpecialistTaskStatus,
} from "../types.js";
import { executeBlenderPython, findBlenderExecutable, queryBlenderVersion } from "./blenderProcess.js";
import { generateBlenderCrateScript } from "./blenderScriptGenerator.js";

export interface BlenderAdapterOptions {
  readonly blenderBin?: string;
  readonly baseWorkDir?: string;
}

interface ActiveBlenderRun {
  readonly taskId: string;
  readonly workDir: string;
  status: "running" | "completed" | "failed";
  result?: NssStudioExecutionResult;
  error?: Error;
}

export class BlenderAdapter implements SpecialistAdapter {
  readonly specialistId = "blender-engine" as const;

  private readonly blenderBin?: string;
  private readonly baseWorkDir: string;
  private readonly activeRuns = new Map<string, ActiveBlenderRun>();

  constructor(options: BlenderAdapterOptions = {}) {
    this.blenderBin = options.blenderBin;
    this.baseWorkDir = options.baseWorkDir || resolve(process.cwd(), ".matterhorn", "blender-runs");
  }

  async health(): Promise<SpecialistHealthResult> {
    try {
      const discovery = queryBlenderVersion(this.blenderBin);
      return {
        available: true,
        specialistId: "blender-engine",
        version: discovery.version,
        protocolVersion: "0.1.0",
        capabilities: (await this.getCapabilities()).capabilities,
        detail: `path=${discovery.executablePath}`,
      };
    } catch (error) {
      return {
        available: false,
        specialistId: "blender-engine",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getCapabilities(): Promise<SpecialistCapabilitySet> {
    return {
      specialistId: "blender-engine",
      protocolVersion: "0.1.0",
      capabilities: [
        "blender.scene.inspect",
        "blender.mesh.create",
        "blender.mesh.modify",
        "blender.material.create",
        "blender.transform.set",
        "blender.render.preview",
        "blender.export.glb",
        "blender.create",
        "blender.art",
        "blender.qa",
      ],
    };
  }

  async submitTask(handoff: NssStudioHandoff): Promise<SpecialistTaskHandle> {
    if (handoff.to !== "blender-engine") {
      throw new SpecialistError(
        "INVALID_TASK",
        `BlenderAdapter accepts tasks for blender-engine, got: ${handoff.to}`,
      );
    }

    const taskId = handoff.taskId || handoff.id;
    const taskWorkDir = join(this.baseWorkDir, taskId);
    if (!existsSync(taskWorkDir)) {
      mkdirSync(taskWorkDir, { recursive: true });
    }

    const activeRun: ActiveBlenderRun = {
      taskId,
      workDir: taskWorkDir,
      status: "running",
    };
    this.activeRuns.set(taskId, activeRun);

    try {
      const { scriptPath, pythonCode } = generateBlenderCrateScript(taskWorkDir, {
        assetName: "crate",
      });
      writeFileSync(scriptPath, pythonCode, "utf8");

      const execRes = executeBlenderPython({
        blenderBin: this.blenderBin,
        scriptPath,
        workingDir: taskWorkDir,
      });

      if (execRes.exitCode !== 0) {
        activeRun.status = "failed";
        const failResult: NssStudioExecutionResult = {
          taskId,
          specialistId: "blender-engine",
          status: "failed",
          summary: `Blender process exited with code ${execRes.exitCode}`,
          evidence: [
            {
              kind: "log",
              summary: execRes.stderr || execRes.stdout,
              outcome: "failed",
            },
          ],
        };
        activeRun.result = failResult;
        return {
          taskId,
          specialistId: "blender-engine",
          accepted: false,
          detail: failResult.summary,
        };
      }

      const reportPath = join(taskWorkDir, "crate-report.json");
      if (!existsSync(reportPath)) {
        activeRun.status = "failed";
        throw new SpecialistError(
          "VALIDATION_FAILED",
          "Blender execution completed but crate-report.json was not produced.",
        );
      }

      const reportContent = readFileSync(reportPath, "utf8");
      const report = JSON.parse(reportContent);

      const blendPath = join(taskWorkDir, "crate.blend");
      const pngPath = join(taskWorkDir, "crate-preview.png");
      const glbPath = join(taskWorkDir, "crate.glb");

      if (!existsSync(glbPath) || !existsSync(pngPath) || !existsSync(blendPath)) {
        activeRun.status = "failed";
        throw new SpecialistError(
          "VALIDATION_FAILED",
          "Required Blender output artifacts (.blend, .png, .glb) are missing.",
        );
      }

      const artifacts: NssStudioArtifactRef[] = [
        { kind: "blend", uri: blendPath, label: "crate.blend", producedBy: "blender-engine" },
        { kind: "preview", uri: pngPath, label: "crate-preview.png", producedBy: "blender-engine" },
        { kind: "glb", uri: glbPath, label: "crate.glb", producedBy: "blender-engine" },
        { kind: "report", uri: reportPath, label: "crate-report.json", producedBy: "blender-engine" },
      ];

      const evidence: NssStudioEvidence[] = [
        {
          kind: "render",
          summary: `Preview rendered (${report.artifacts?.previewPngSizeBytes ?? 0} bytes)`,
          outcome: "passed",
          uri: pngPath,
        },
        {
          kind: "artifact",
          summary: `GLB asset exported (${report.artifacts?.glbSizeBytes ?? 0} bytes, ${report.totals?.polygons ?? 0} polygons)`,
          outcome: "passed",
          uri: glbPath,
        },
        {
          kind: "report",
          summary: `Scene inspection report (${report.meshObjectsCount} mesh objects)`,
          outcome: "passed",
          uri: reportPath,
        },
      ];

      const executionResult: NssStudioExecutionResult = {
        taskId,
        specialistId: "blender-engine",
        status: "completed",
        summary: `Blender successfully generated game-ready asset ${glbPath}`,
        artifacts,
        evidence,
      };

      activeRun.status = "completed";
      activeRun.result = executionResult;

      return {
        taskId,
        specialistId: "blender-engine",
        accepted: true,
        detail: "Blender task accepted and completed successfully",
      };
    } catch (error) {
      activeRun.status = "failed";
      activeRun.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  async getTaskStatus(taskId: string): Promise<SpecialistTaskStatus> {
    const run = this.activeRuns.get(taskId);
    if (!run) {
      return {
        taskId,
        specialistId: "blender-engine",
        phase: "unknown",
        detail: `No active run found for task: ${taskId}`,
      };
    }

    const phaseMap: Record<string, SpecialistTaskStatus["phase"]> = {
      running: "running",
      completed: "completed",
      failed: "failed",
    };

    return {
      taskId,
      specialistId: "blender-engine",
      phase: phaseMap[run.status] || "unknown",
      detail: run.error ? run.error.message : run.result?.summary,
    };
  }

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    const run = this.activeRuns.get(taskId);
    if (!run || !run.result) {
      throw new SpecialistError(
        "INVALID_TASK",
        `No execution result available for task: ${taskId}`,
      );
    }
    return run.result;
  }

  async cancelTask(taskId: string): Promise<SpecialistCancelResult> {
    const run = this.activeRuns.get(taskId);
    if (!run) {
      return { taskId, cancelled: false, detail: "Task not found" };
    }
    // Fail-closed conservative cancellation
    return {
      taskId,
      cancelled: false,
      detail: "Blender synchronous background tasks do not support mid-flight cancellation",
    };
  }
}
