import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  NssStudioArtifactRef,
  NssStudioEvidence,
  NssStudioExecutionResult,
  NssStudioHandoff,
} from "../../types.js";
import {
  SpecialistError,
  type SpecialistAdapter,
  type SpecialistCancelResult,
  type SpecialistCapabilitySet,
  type SpecialistHealthResult,
  type SpecialistTaskHandle,
  type SpecialistTaskStatus,
} from "../types.js";
import { validateExpectedArtifacts } from "./blenderArtifacts.js";
import { buildCrateTaskSpec, buildHumanoidPrototypeTaskSpec } from "./blenderFixtures.js";
import {
  assertResultMatchesExecution,
  createTaskManifest,
  writeBlenderResultManifest,
  writeBlenderTaskManifest,
  type BlenderResultManifest,
} from "./blenderManifest.js";
import { IMPLEMENTED_BLENDER_CAPABILITIES } from "./blenderOperations.js";
import {
  executeBlenderPythonAsync,
  findBlenderExecutable,
  queryBlenderVersion,
  type BlenderAsyncExecutionHandle,
} from "./blenderProcess.js";
import { compileBlenderTaskScript } from "./blenderScriptCompiler.js";
import { validateBlenderTaskSpec, type BlenderTaskSpec } from "./blenderTaskSpec.js";

export interface BlenderAdapterOptions {
  readonly blenderBin?: string;
  readonly baseWorkDir?: string;
}

interface ActiveBlenderRun {
  readonly taskId: string;
  readonly executionId: string;
  readonly handoffId: string;
  readonly workDir: string;
  status: "accepted" | "running" | "completed" | "failed" | "cancelled";
  result?: NssStudioExecutionResult;
  error?: Error;
  pid?: number;
  asyncHandle?: BlenderAsyncExecutionHandle;
  readonly startedAt: string;
}

function artifactKindToStudio(
  kind: "blend" | "glb" | "png" | "json" | "log",
): NssStudioArtifactRef["kind"] {
  switch (kind) {
    case "blend":
      return "blend";
    case "glb":
      return "glb";
    case "png":
      return "preview";
    case "json":
      return "report";
    case "log":
      return "log";
    default:
      return "report";
  }
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
        protocolVersion: "0.2.0",
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
      protocolVersion: "0.2.0",
      capabilities: [...IMPLEMENTED_BLENDER_CAPABILITIES],
    };
  }

  /**
   * Resolve a validated BlenderTaskSpec from handoff input artifacts or known fixtures.
   * Crate generation is a fixture built from primitives — not the adapter itself.
   */
  resolveTaskSpec(handoff: NssStudioHandoff, taskWorkDir: string): BlenderTaskSpec {
    const taskArtifact = handoff.inputArtifacts.find(
      (a) => a.kind === "json" || a.kind === "report" || a.label === "blender-task.json",
    );
    if (taskArtifact?.uri && existsSync(taskArtifact.uri)) {
      const parsed = JSON.parse(readFileSync(taskArtifact.uri, "utf8"));
      return validateBlenderTaskSpec({ ...parsed, workingDirectory: taskWorkDir });
    }

    const inline = handoff.inputArtifacts.find((a) => a.kind === "note" && a.label === "blender-task-inline");
    if (inline?.uri) {
      const parsed = JSON.parse(inline.uri);
      return validateBlenderTaskSpec({ ...parsed, workingDirectory: taskWorkDir });
    }

    const goal = handoff.goal.toLowerCase();
    if (goal.includes("humanoid") || goal.includes("mannequin") || goal.includes("character prototype")) {
      return validateBlenderTaskSpec(buildHumanoidPrototypeTaskSpec(taskWorkDir));
    }
    if (goal.includes("crate") || handoff.acceptanceCriteria.some((c) => c.toLowerCase().includes("crate"))) {
      return validateBlenderTaskSpec(buildCrateTaskSpec(taskWorkDir));
    }

    throw new SpecialistError(
      "INVALID_TASK",
      "Blender task requires a validated blender task specification input artifact (or a known fixture goal: crate / humanoid).",
    );
  }

  async submitTask(handoff: NssStudioHandoff): Promise<SpecialistTaskHandle> {
    if (handoff.to !== "blender-engine") {
      throw new SpecialistError(
        "INVALID_TASK",
        `BlenderAdapter accepts tasks for blender-engine, got: ${handoff.to}`,
      );
    }

    const taskId = handoff.taskId || handoff.id;
    const executionId = randomUUID();
    const taskWorkDir = join(this.baseWorkDir, taskId);
    if (!existsSync(taskWorkDir)) {
      mkdirSync(taskWorkDir, { recursive: true });
    }

    let spec: BlenderTaskSpec;
    try {
      spec = this.resolveTaskSpec(handoff, taskWorkDir);
    } catch (error) {
      throw error;
    }

    const timeoutMs = spec.timeoutMs ?? 300_000;
    const taskManifest = createTaskManifest({
      taskId,
      executionId,
      handoffId: handoff.id,
      spec,
      timeoutMs,
    });
    writeBlenderTaskManifest(taskWorkDir, taskManifest);

    const { scriptPath, pythonCode } = compileBlenderTaskScript({
      spec,
      executionId,
      taskId,
      handoffId: handoff.id,
    });
    writeFileSync(scriptPath, pythonCode, "utf8");

    const stdoutLogPath = join(taskWorkDir, "blender-stdout.log");
    const stderrLogPath = join(taskWorkDir, "blender-stderr.log");

    const activeRun: ActiveBlenderRun = {
      taskId,
      executionId,
      handoffId: handoff.id,
      workDir: taskWorkDir,
      status: "accepted",
      startedAt: new Date().toISOString(),
    };
    this.activeRuns.set(taskId, activeRun);

    let asyncHandle: BlenderAsyncExecutionHandle;
    try {
      asyncHandle = executeBlenderPythonAsync({
        blenderBin: this.blenderBin,
        scriptPath,
        workingDir: taskWorkDir,
        timeoutMs,
        stdoutLogPath,
        stderrLogPath,
      });
    } catch (error) {
      activeRun.status = "failed";
      activeRun.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }

    activeRun.asyncHandle = asyncHandle;
    activeRun.pid = asyncHandle.pid;
    activeRun.status = "running";

    void asyncHandle.promise
      .then((execRes) => this.finalizeRun(activeRun, spec, execRes))
      .catch((error: unknown) => {
        activeRun.status = "failed";
        activeRun.error = error instanceof Error ? error : new Error(String(error));
        activeRun.result = {
          taskId,
          specialistId: "blender-engine",
          status: "failed",
          summary: activeRun.error.message,
          evidence: [{ kind: "log", summary: activeRun.error.message, outcome: "failed" }],
        };
        writeBlenderResultManifest(taskWorkDir, this.failedResultManifest(activeRun, activeRun.error.message));
      });

    return {
      taskId,
      specialistId: "blender-engine",
      accepted: true,
      detail: `Blender task accepted (executionId=${executionId}, pid=${asyncHandle.pid ?? "pending"})`,
    };
  }

  private failedResultManifest(run: ActiveBlenderRun, message: string): BlenderResultManifest {
    return {
      schemaVersion: "1.0.0",
      taskId: run.taskId,
      executionId: run.executionId,
      handoffId: run.handoffId,
      blenderVersion: "unknown",
      startedAt: run.startedAt,
      endedAt: new Date().toISOString(),
      requestedOperations: [],
      completedOperations: [],
      outputArtifacts: [],
      warnings: [],
      errors: [message],
      status: "failed",
    };
  }

  private finalizeRun(
    activeRun: ActiveBlenderRun,
    spec: BlenderTaskSpec,
    execRes: { exitCode: number; stdout: string; stderr: string; timedOut?: boolean },
  ): void {
    const taskId = activeRun.taskId;
    const taskWorkDir = activeRun.workDir;

    if (execRes.timedOut) {
      activeRun.status = "failed";
      const summary = `Blender process timed out`;
      activeRun.result = {
        taskId,
        specialistId: "blender-engine",
        status: "failed",
        summary,
        evidence: [{ kind: "log", summary: execRes.stderr || execRes.stdout || summary, outcome: "failed" }],
      };
      writeBlenderResultManifest(taskWorkDir, {
        ...this.failedResultManifest(activeRun, summary),
        status: "timeout",
      });
      return;
    }

    if (execRes.exitCode !== 0) {
      activeRun.status = "failed";
      const summary = `Blender process exited with code ${execRes.exitCode}`;
      activeRun.result = {
        taskId,
        specialistId: "blender-engine",
        status: "failed",
        summary,
        evidence: [{ kind: "log", summary: execRes.stderr || execRes.stdout || summary, outcome: "failed" }],
      };
      writeBlenderResultManifest(taskWorkDir, this.failedResultManifest(activeRun, summary));
      return;
    }

    const reportPath = join(taskWorkDir, "blender-report.json");
    if (!existsSync(reportPath)) {
      activeRun.status = "failed";
      const summary = "Blender execution completed but blender-report.json was not produced.";
      activeRun.result = {
        taskId,
        specialistId: "blender-engine",
        status: "failed",
        summary,
      };
      writeBlenderResultManifest(taskWorkDir, this.failedResultManifest(activeRun, summary));
      return;
    }

    try {
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
        executionId?: string;
        taskId?: string;
        blenderVersion?: string;
        startedAt?: string;
        endedAt?: string;
        completedOperations?: string[];
        artifacts?: Record<string, string>;
        previews?: string[];
        geometry?: BlenderResultManifest["geometry"];
        materials?: BlenderResultManifest["materials"];
        exportInfo?: BlenderResultManifest["exportInfo"];
        skeleton?: BlenderResultManifest["skeleton"];
        warnings?: string[];
        errors?: string[];
        status?: string;
        success?: boolean;
      };

      if (report.executionId !== activeRun.executionId || report.taskId !== activeRun.taskId) {
        throw new SpecialistError(
          "VALIDATION_FAILED",
          `Report/task execution ID mismatch (report=${report.executionId}/${report.taskId}, expected=${activeRun.executionId}/${activeRun.taskId})`,
        );
      }

      const validated = validateExpectedArtifacts(taskWorkDir, spec.expectedArtifacts, report.artifacts);
      const resultManifest: BlenderResultManifest = {
        schemaVersion: "1.0.0",
        taskId: activeRun.taskId,
        executionId: activeRun.executionId,
        handoffId: activeRun.handoffId,
        blenderVersion: report.blenderVersion ?? "unknown",
        startedAt: report.startedAt ?? activeRun.startedAt,
        endedAt: report.endedAt ?? new Date().toISOString(),
        requestedOperations: [...spec.operations],
        completedOperations: report.completedOperations ?? [],
        outputArtifacts: validated,
        render: { previews: report.previews ?? [] },
        geometry: report.geometry,
        materials: report.materials,
        exportInfo: report.exportInfo,
        skeleton: report.skeleton,
        warnings: report.warnings ?? [],
        errors: report.errors ?? [],
        status: report.success === false || (report.errors && report.errors.length > 0) ? "failed" : "completed",
      };
      assertResultMatchesExecution(resultManifest, activeRun.executionId, activeRun.taskId);
      writeBlenderResultManifest(taskWorkDir, resultManifest);

      if (resultManifest.status !== "completed") {
        activeRun.status = "failed";
        activeRun.result = {
          taskId,
          specialistId: "blender-engine",
          status: "failed",
          summary: `Blender report status=${resultManifest.status}`,
          evidence: [{ kind: "report", summary: resultManifest.errors.join("; ") || "failed", outcome: "failed", uri: reportPath }],
        };
        return;
      }

      // Character fail-closed: if animations were requested via character export, require idle/walk/run.
      const needsCharacterAnims = spec.operations.some(
        (op) => op.op === "export.character_glb" || op.op === "animation.inspect",
      );
      if (needsCharacterAnims) {
        const anims = resultManifest.exportInfo?.animations ?? [];
        const lower = anims.map((a) => a.toLowerCase());
        const hasIdle = lower.some((a) => a.includes("idle"));
        const hasWalk = lower.some((a) => a.includes("walk"));
        const hasRun = lower.some((a) => a.includes("run") || a.includes("sprint"));
        if (!resultManifest.skeleton?.boneNames?.length) {
          throw new SpecialistError("VALIDATION_FAILED", "Skeleton missing from character Blender result");
        }
        if (!hasIdle || !hasWalk || !hasRun) {
          throw new SpecialistError(
            "VALIDATION_FAILED",
            `Required animation missing (idle=${hasIdle}, walk=${hasWalk}, run=${hasRun}); found=${anims.join(",")}`,
          );
        }
      }

      const artifacts: NssStudioArtifactRef[] = [
        ...validated.map((a) => ({
          kind: artifactKindToStudio(a.kind),
          uri: a.path,
          label: a.name,
          producedBy: "blender-engine" as const,
        })),
        {
          kind: "report",
          uri: join(taskWorkDir, "blender-result.json"),
          label: "blender-result.json",
          producedBy: "blender-engine",
        },
        {
          kind: "report",
          uri: join(taskWorkDir, "blender-task.json"),
          label: "blender-task.json",
          producedBy: "blender-engine",
        },
      ];

      const evidence: NssStudioEvidence[] = validated
        .filter((a) => a.kind === "png" || a.kind === "glb" || a.kind === "json")
        .map((a) => ({
          kind: a.kind === "png" ? ("render" as const) : a.kind === "glb" ? ("artifact" as const) : ("report" as const),
          summary: `${a.name} (${a.sizeBytes} bytes)`,
          outcome: "passed" as const,
          uri: a.path,
        }));

      activeRun.status = "completed";
      activeRun.result = {
        taskId,
        specialistId: "blender-engine",
        status: "completed",
        summary: `Blender completed asset ${spec.assetName} (executionId=${activeRun.executionId})`,
        artifacts,
        evidence,
      };
    } catch (error) {
      activeRun.status = "failed";
      activeRun.error = error instanceof Error ? error : new Error(String(error));
      activeRun.result = {
        taskId,
        specialistId: "blender-engine",
        status: "failed",
        summary: activeRun.error.message,
        evidence: [{ kind: "log", summary: activeRun.error.message, outcome: "failed" }],
      };
      writeBlenderResultManifest(taskWorkDir, this.failedResultManifest(activeRun, activeRun.error.message));
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

    const phaseMap: Record<ActiveBlenderRun["status"], SpecialistTaskStatus["phase"]> = {
      accepted: "accepted",
      running: "running",
      completed: "completed",
      failed: "failed",
      cancelled: "cancelled",
    };

    return {
      taskId,
      specialistId: "blender-engine",
      phase: phaseMap[run.status],
      detail: run.error
        ? run.error.message
        : run.result?.summary ?? `pid=${run.pid ?? "n/a"} executionId=${run.executionId}`,
    };
  }

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    const run = this.activeRuns.get(taskId);
    if (!run) {
      throw new SpecialistError("INVALID_TASK", `No execution result available for task: ${taskId}`);
    }
    if (!run.result) {
      if (run.asyncHandle) {
        await run.asyncHandle.promise.catch(() => undefined);
      }
    }
    if (!run.result) {
      throw new SpecialistError("INVALID_TASK", `No execution result available for task: ${taskId}`);
    }
    return run.result;
  }

  async cancelTask(taskId: string): Promise<SpecialistCancelResult> {
    const run = this.activeRuns.get(taskId);
    if (!run) {
      return { taskId, cancelled: false, detail: "Task not found" };
    }
    if (run.status === "completed" || run.status === "failed") {
      return { taskId, cancelled: false, detail: `Task already ${run.status}` };
    }
    if (!run.asyncHandle) {
      return {
        taskId,
        cancelled: false,
        detail: "No process handle available; cancellation remain fail-closed",
      };
    }
    const result = await run.asyncHandle.cancel();
    if (result.cancelled) {
      run.status = "cancelled";
      run.result = {
        taskId,
        specialistId: "blender-engine",
        status: "failed",
        summary: "Blender task cancellation requested; not treated as successful completion",
      };
    }
    return { taskId, cancelled: result.cancelled, detail: result.detail };
  }

  /** Test helper: wait until a task leaves running/accepted. */
  async waitForTerminal(taskId: string, timeoutMs = 300_000): Promise<SpecialistTaskStatus> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getTaskStatus(taskId);
      if (status.phase === "completed" || status.phase === "failed" || status.phase === "cancelled") {
        return status;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new SpecialistError("TIMEOUT", `Timed out waiting for Blender task ${taskId}`);
  }
}

export { findBlenderExecutable };
