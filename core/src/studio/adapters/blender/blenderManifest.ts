/**
 * Machine-readable Blender execution manifests.
 * Execution identity prevents evidence from another run satisfying the current task.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BlenderOperation } from "./blenderOperations.js";
import type { BlenderTaskSpec } from "./blenderTaskSpec.js";
import { BLENDER_TASK_SCHEMA_VERSION } from "./blenderTaskSpec.js";
import type { ValidatedArtifact } from "./blenderArtifacts.js";

export const BLENDER_MANIFEST_SCHEMA_VERSION = "1.0.0";

export interface BlenderTaskManifest {
  readonly schemaVersion: typeof BLENDER_MANIFEST_SCHEMA_VERSION;
  readonly taskId: string;
  readonly executionId: string;
  readonly handoffId: string;
  readonly assetName: string;
  readonly workingDirectory: string;
  readonly requestedOperations: readonly BlenderOperation[];
  readonly expectedArtifacts: BlenderTaskSpec["expectedArtifacts"];
  readonly acceptanceCriteria: readonly string[];
  readonly createdAt: string;
  readonly timeoutMs: number;
}

export interface BlenderGeometryStats {
  readonly vertices: number;
  readonly edges: number;
  readonly polygons: number;
  readonly meshObjects: number;
}

export interface BlenderMaterialStats {
  readonly count: number;
  readonly names: readonly string[];
}

export interface BlenderResultManifest {
  readonly schemaVersion: typeof BLENDER_MANIFEST_SCHEMA_VERSION;
  readonly taskId: string;
  readonly executionId: string;
  readonly handoffId: string;
  readonly blenderVersion: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly requestedOperations: readonly BlenderOperation[];
  readonly completedOperations: readonly string[];
  readonly outputArtifacts: readonly ValidatedArtifact[];
  readonly render?: {
    readonly previews: readonly string[];
  };
  readonly geometry?: BlenderGeometryStats;
  readonly materials?: BlenderMaterialStats;
  readonly exportInfo?: {
    readonly glbPath?: string;
    readonly glbSizeBytes?: number;
    readonly skins?: boolean;
    readonly animations?: readonly string[];
  };
  readonly skeleton?: {
    readonly armatureName?: string;
    readonly boneNames?: readonly string[];
  };
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly status: "completed" | "failed" | "cancelled" | "timeout";
}

export function writeBlenderTaskManifest(
  workDir: string,
  manifest: BlenderTaskManifest,
): string {
  const path = join(workDir, "blender-task.json");
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf8");
  return path;
}

export function writeBlenderResultManifest(
  workDir: string,
  manifest: BlenderResultManifest,
): string {
  const path = join(workDir, "blender-result.json");
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf8");
  return path;
}

export function createTaskManifest(input: {
  taskId: string;
  executionId: string;
  handoffId: string;
  spec: BlenderTaskSpec;
  timeoutMs: number;
}): BlenderTaskManifest {
  return {
    schemaVersion: BLENDER_MANIFEST_SCHEMA_VERSION,
    taskId: input.taskId,
    executionId: input.executionId,
    handoffId: input.handoffId,
    assetName: input.spec.assetName,
    workingDirectory: input.spec.workingDirectory,
    requestedOperations: input.spec.operations,
    expectedArtifacts: input.spec.expectedArtifacts,
    acceptanceCriteria: input.spec.acceptanceCriteria,
    createdAt: new Date().toISOString(),
    timeoutMs: input.timeoutMs,
  };
}

export function assertResultMatchesExecution(
  result: BlenderResultManifest,
  expectedExecutionId: string,
  expectedTaskId: string,
): void {
  if (result.executionId !== expectedExecutionId) {
    throw new Error(
      `Blender result executionId mismatch: got ${result.executionId}, expected ${expectedExecutionId}`,
    );
  }
  if (result.taskId !== expectedTaskId) {
    throw new Error(
      `Blender result taskId mismatch: got ${result.taskId}, expected ${expectedTaskId}`,
    );
  }
  if (result.schemaVersion !== BLENDER_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported blender-result schema: ${result.schemaVersion}`);
  }
}

/** Re-export for callers that only import manifests. */
export { BLENDER_TASK_SCHEMA_VERSION };
