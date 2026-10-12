import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findBlenderExecutable } from "../../../../studio/adapters/blender/blenderProcess.js";
import type {
  FoundryAssetProvider,
  FoundryAssetProviderContext,
  FoundryAssetProviderDescriptor,
  FoundryAssetProviderResult,
  FoundryAssetRequest,
} from "../../types.js";
import { runBlender } from "../blenderAgent/blenderAgentProvider.js";
import { MINI_RIG_SCRIPT } from "./rigScript.js";

/**
 * Rigs a character with the game's mini skeleton (7 bones) and gives it every animation clip of the
 * reference character, in local Blender. Joints are found from the model's named parts; any of them can
 * be placed by hand instead (request.parameters.joints = { "arm-left": [x, z], ... } in metres).
 */

export const MINI_RIG_PROVIDER_ID = "mini-rigger";
export const MINI_RIG_JOINTS = ["head", "arm-left", "arm-right", "leg-left", "leg-right"] as const;
export type MiniRigJoint = (typeof MINI_RIG_JOINTS)[number];
export type MiniRigJoints = Partial<Record<MiniRigJoint, readonly [number, number]>>;

export interface MiniRigSetup {
  readonly joints: Record<MiniRigJoint, readonly [number, number]>;
  readonly frame: { readonly pixels: number; readonly orthoScale: number; readonly centerX: number; readonly centerZ: number };
  readonly frontImage: string;
  readonly height: number;
  readonly clips: readonly string[];
}

export interface MiniRigProviderOptions {
  /** The model (GLB/GLTF) of an asset to rig. */
  readonly resolveModelFile: (assetId: string) => string | undefined;
  /** A rigged, animated reference character whose skeleton and clips are copied. */
  readonly referenceSkeleton: string;
  readonly blenderExecutable?: string;
  readonly timeoutMs?: number;
}

export class MiniRigProvider implements FoundryAssetProvider {
  readonly descriptor: FoundryAssetProviderDescriptor = {
    id: MINI_RIG_PROVIDER_ID,
    name: "Mini character rigger (local Blender)",
    operations: ["rig"],
    kinds: ["mesh_3d"],
    local: true,
    requiresNetwork: false,
    externalCost: false,
    supportsSeed: false,
    supportsReferences: false,
    outputLicense: {
      name: "Owner-generated rig; animations from the reference character",
      classification: "permissive",
      reusePolicy: "review-required",
      notes: "Animation clips come from the reference character (Kenney mini characters are CC0).",
    },
    commercialUseAllowed: true,
  };

  constructor(private readonly options: MiniRigProviderOptions) {}

  /** Finds the joints and renders a front view so the owner can check or move them before rigging. */
  async setup(assetId: string, workDir: string, signal?: AbortSignal): Promise<MiniRigSetup> {
    const model = this.model(assetId);
    mkdirSync(workDir, { recursive: true });
    const report = await this.run({ mode: "detect", character: model, outDir: workDir, baseName: "setup" }, workDir, signal);
    const frame = report.frame as { image: string; pixels: number; orthoScale: number; centerX: number; centerZ: number };
    return {
      joints: report.joints as MiniRigSetup["joints"],
      frame: { pixels: frame.pixels, orthoScale: frame.orthoScale, centerX: frame.centerX, centerZ: frame.centerZ },
      frontImage: join(workDir, frame.image),
      height: report.height as number,
      clips: report.clips as string[],
    };
  }

  async execute(request: FoundryAssetRequest, context?: FoundryAssetProviderContext): Promise<FoundryAssetProviderResult> {
    if (!context?.outputRoot) throw new Error("The rigger needs an output folder.");
    if (!request.parentAsset) throw new Error("Choose the model to rig.");
    const model = this.model(request.parentAsset);
    const joints = parseJoints(request.parameters?.joints);
    const progress = context.onProgress ?? (() => undefined);

    const baseName = request.assetId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "rigged";
    let jobDir = resolve(context.outputRoot, baseName);
    for (let n = 2; existsSync(jobDir); n++) jobDir = resolve(context.outputRoot, `${baseName}_try${n}`);
    mkdirSync(jobDir, { recursive: true });

    progress(joints ? "Rigging with the joints you placed…" : "Finding the shoulders, hips and neck, then rigging…");
    const shown = new Set<string>();
    const watch = context.onLive ? setInterval(() => {
      for (const name of readdirSync(jobDir).filter((f) => /^anim_.+_\d+\.png$/.test(f)).sort().slice(0, -1)) {
        if (shown.has(name)) continue;
        shown.add(name);
        context.onLive?.({ image: join(jobDir, name) });
      }
    }, 500) : undefined;
    let report: Record<string, unknown>;
    try {
      report = await this.run({
        mode: "rig",
        character: model,
        outDir: jobDir,
        baseName,
        ...(joints ? { joints } : {}),
        clips: ["idle", "walk", "sprint", "jump"],
      }, jobDir, context.signal);
    } finally {
      if (watch) clearInterval(watch);
    }
    const glb = String(report.glb ?? "");
    if (!glb || !existsSync(glb)) throw new Error("Blender finished but the rigged model is missing.");
    progress(`Rigged: ${(report.clips as string[]).length} animations ready.`);

    const previews = Object.values((report.previews ?? {}) as Record<string, string[]>).flat().map((file) => resolve(file));
    const reportPath = join(jobDir, `${baseName}-rig-report.json`);
    const bytes = readFileSync(glb);
    const idle = previews.find((file) => /anim_idle_00\.png$/.test(file)) ?? previews[0];
    return {
      outputs: [{
        providerId: this.descriptor.id,
        requestId: request.requestId,
        outputIndex: 0,
        localPath: resolve(glb),
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        ...(idle ? { previewPath: idle } : {}),
        companionFiles: [String(report.blend ?? ""), reportPath, ...previews].filter((file) => file && existsSync(file)),
        metadata: { model: "Mini rigger", joints: report.joints, clips: report.clips, height: report.height },
      }],
      metadata: { joints: report.joints },
    };
  }

  private model(assetId: string): string {
    const model = this.options.resolveModelFile(assetId);
    if (!model) throw new Error(`${assetId} has no .glb model to rig.`);
    if (!existsSync(this.options.referenceSkeleton)) throw new Error("The reference skeleton file is missing.");
    return model;
  }

  private async run(config: Record<string, unknown>, workDir: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const blender = this.options.blenderExecutable ?? findBlenderExecutable();
    if (!blender) throw new Error("Blender was not found. Install Blender 4.2+ or set MATTERHORN_BLENDER_BIN.");
    const scriptPath = join(workDir, "matterhorn_rig.py");
    const configPath = join(workDir, `rig-${config.mode}.json`);
    writeFileSync(scriptPath, MINI_RIG_SCRIPT, "utf8");
    writeFileSync(configPath, JSON.stringify({ ...config, reference: this.options.referenceSkeleton }, null, 2), "utf8");
    const run = await runBlender(blender, [
      "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1",
      "--python", scriptPath, "--", configPath,
    ], workDir, this.options.timeoutMs ?? 10 * 60_000, signal);
    if (signal?.aborted) throw new Error("Cancelled.");
    const reportPath = join(String(config.outDir), `${config.baseName}-rig-report.json`);
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown> : undefined;
    if (!report?.ok) {
      const error = String(report?.error ?? (run.timedOut ? "Blender timed out." : run.output.slice(-1500)));
      throw new Error(`Rigging failed at the ${report?.stage ?? "blender"} step: ${error.trim().split(/\r?\n/).slice(-1)[0]}`);
    }
    return report;
  }
}

/** Hand-placed joints: only known joint names with two finite numbers (x, z in metres) are accepted. */
export function parseJoints(value: unknown): MiniRigJoints | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("joints must map joint names to [x, z].");
  const joints: Partial<Record<MiniRigJoint, readonly [number, number]>> = {};
  for (const [name, point] of Object.entries(value as Record<string, unknown>)) {
    if (!(MINI_RIG_JOINTS as readonly string[]).includes(name)) throw new Error(`Unknown joint: ${name}`);
    if (!Array.isArray(point) || point.length !== 2 || !point.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 50)) {
      throw new Error(`Joint ${name} must be [x, z] in metres.`);
    }
    joints[name as MiniRigJoint] = [point[0], point[1]];
  }
  return Object.keys(joints).length ? joints : undefined;
}
