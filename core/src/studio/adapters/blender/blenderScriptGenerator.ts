/**
 * Crate fixture entry point — composed from bounded BlenderOperation primitives.
 * Kept for backward-compatible imports; adapter no longer hard-codes crate generation.
 */

import { buildCrateTaskSpec } from "./blenderFixtures.js";
import { compileBlenderTaskScript } from "./blenderScriptCompiler.js";

export interface BlenderCrateSpec {
  readonly assetName?: string;
  readonly crateSize?: number;
  readonly woodColor?: readonly [number, number, number, number];
  readonly metalColor?: readonly [number, number, number, number];
  readonly previewWidth?: number;
  readonly previewHeight?: number;
}

export function generateBlenderCrateScript(
  workDir: string,
  _spec: BlenderCrateSpec = {},
): { scriptPath: string; pythonCode: string } {
  const taskSpec = buildCrateTaskSpec(workDir);
  return compileBlenderTaskScript({
    spec: taskSpec,
    executionId: "fixture-crate",
    taskId: "fixture-crate",
    handoffId: "fixture-crate",
  });
}
