import type { FoundryPerformanceBudget } from "../specs/types.js";
import type { FoundryRuntimeNode, FoundryRuntimeSnapshot } from "../runtime/types.js";
import type { FoundryQaIncident } from "./types.js";

export interface FoundryRuntimeOracleOptions {
  readonly performanceBudget?: FoundryPerformanceBudget;
  readonly maxObjectCount?: number;
}

export function inspectFoundryRuntimeSnapshot(
  snapshot: FoundryRuntimeSnapshot,
  options: FoundryRuntimeOracleOptions = {},
): readonly FoundryQaIncident[] {
  const incidents: FoundryQaIncident[] = [];
  let sequence = 0;
  const push = (
    incident: Omit<FoundryQaIncident, "id" | "runtimeSessionId" | "capturedAt">,
  ) => {
    sequence += 1;
    incidents.push({
      id: `${snapshot.runtimeSessionId}-oracle-${sequence}`,
      runtimeSessionId: snapshot.runtimeSessionId,
      capturedAt: snapshot.capturedAt,
      ...incident,
    });
  };

  if (!snapshot.ready) {
    push({
      kind: "runtime_not_ready",
      severity: "error",
      summary: "Runtime probe is not ready.",
      actual: false,
      expected: true,
    });
  }

  if (!snapshot.scenePath) {
    push({
      kind: "scene_missing",
      severity: "error",
      summary: "Runtime did not report an active scene.",
      actual: snapshot.scenePath,
      expected: "active scene",
    });
  }

  for (const error of snapshot.errors) {
    push({
      kind: "runtime_error",
      severity: "error",
      summary: error.message,
      target: error.source ?? error.at,
      actual: error.message,
      expected: "no runtime error",
    });
  }

  const duplicates = duplicateNodePaths(snapshot.tree);
  for (const path of duplicates) {
    push({
      kind: "duplicate_node_path",
      severity: "error",
      summary: `Runtime tree contains duplicate node path ${path}.`,
      target: path,
      actual: "duplicate",
      expected: "unique node path",
    });
  }

  const budget = options.performanceBudget;
  if (budget?.targetFps !== undefined && snapshot.performance.fps < budget.targetFps) {
    push({
      kind: "low_fps",
      severity: "warning",
      summary: `FPS ${snapshot.performance.fps} is below target ${budget.targetFps}.`,
      target: "performance.fps",
      actual: snapshot.performance.fps,
      expected: budget.targetFps,
    });
  }
  if (
    budget?.maxFrameTimeMs !== undefined &&
    snapshot.performance.frameTimeMs > budget.maxFrameTimeMs
  ) {
    push({
      kind: "frame_time_budget",
      severity: "warning",
      summary: `Frame time ${snapshot.performance.frameTimeMs}ms exceeds budget ${budget.maxFrameTimeMs}ms.`,
      target: "performance.frameTimeMs",
      actual: snapshot.performance.frameTimeMs,
      expected: budget.maxFrameTimeMs,
    });
  }
  if (
    budget?.maxMemoryMb !== undefined &&
    snapshot.performance.memoryMb > budget.maxMemoryMb
  ) {
    push({
      kind: "memory_budget",
      severity: "warning",
      summary: `Memory ${snapshot.performance.memoryMb}MB exceeds budget ${budget.maxMemoryMb}MB.`,
      target: "performance.memoryMb",
      actual: snapshot.performance.memoryMb,
      expected: budget.maxMemoryMb,
    });
  }
  if (
    options.maxObjectCount !== undefined &&
    snapshot.performance.objectCount > options.maxObjectCount
  ) {
    push({
      kind: "object_budget",
      severity: "warning",
      summary: `Object count ${snapshot.performance.objectCount} exceeds budget ${options.maxObjectCount}.`,
      target: "performance.objectCount",
      actual: snapshot.performance.objectCount,
      expected: options.maxObjectCount,
    });
  }

  return incidents;
}

function duplicateNodePaths(root: FoundryRuntimeNode | null): readonly string[] {
  if (!root) return [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const stack: FoundryRuntimeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node.path)) duplicates.add(node.path);
    seen.add(node.path);
    stack.push(...node.children);
  }
  return [...duplicates].sort();
}
