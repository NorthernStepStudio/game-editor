import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
import { TRELLIS_BLENDER_SCRIPT } from "./trellisScript.js";

/**
 * Image-to-3D on this PC, free: one picture of a character (front view, T- or A-pose) becomes a textured,
 * game-sized 3D model. Steps: crop and cut out the background (Blender), build the model with TRELLIS.2
 * (trellis.cpp on the GPU), then fit it to the game height and a polygon budget (Blender).
 * request.parameters: crop [x0, y0, x1, y1] (fractions of the picture, top-left origin), quality "standard" | "high",
 * height (metres, default 0.72, the mini characters' height) and maxFaces (default 40000).
 * On a character sheet, views { right, back, left } (boxes like crop) mark the other views: those sides of the model
 * are then painted from them instead of guessed (the front is never painted over), and a side view fixes the model's
 * guessed depth: invented parts removed, stretched backs and long shoes brought back to the sheet's profile.
 * With parentAsset (a model made earlier) and those views, the existing model is repainted without rebuilding it.
 */

export const TRELLIS_PROVIDER_ID = "trellis-local";
/** The steps trellis-cli reports as "[k/6]" (1–3) and "[k/7]" (4–7), in plain words. */
const TRELLIS_STEPS: Readonly<Record<number, string>> = {
  1: "Reading the picture",
  2: "Studying the picture",
  3: "Planning the overall shape",
  4: "Shaping the details",
  5: "Building the surface",
  6: "Painting the colours",
  7: "Saving the model",
};

export const TRELLIS_PROVIDER_DESCRIPTOR: FoundryAssetProviderDescriptor = {
  id: TRELLIS_PROVIDER_ID,
  name: "TRELLIS (picture to 3D, on this PC)",
  operations: ["image_to_3d"],
  kinds: ["mesh_3d"],
  local: true,
  requiresNetwork: false,
  externalCost: false,
  supportsSeed: true,
  supportsReferences: true,
  outputLicense: {
    name: "Owner-generated 3D model",
    classification: "permissive",
    reusePolicy: "review-required",
    notes: "Made on this PC from the owner's own picture with TRELLIS.2 (MIT) and the DINOv3 image encoder (Meta's DINOv3 license); review those terms before shipping.",
  },
  commercialUseAllowed: true,
  priority: 20,
};

export interface TrellisToolPaths {
  readonly cli: string;
  readonly models: string;
}

/** trellis.cpp as Matterhorn installs it: <dir>/bin/trellis-cli(.exe) and <dir>/models/*.gguf. */
export function findTrellisTool(dir: string): TrellisToolPaths | undefined {
  const cli = ["trellis-cli.exe", "trellis-cli"].map((name) => join(dir, "bin", name)).find((file) => existsSync(file));
  const models = join(dir, "models");
  const needed = ["dinov3.gguf", "ss_flow.gguf", "ss_dec.gguf", "shape_dec.gguf", "tex_dec.gguf", "shape_flow_512.gguf", "tex_flow_512.gguf"];
  if (!cli || !needed.every((file) => existsSync(join(models, file)))) return undefined;
  return { cli, models };
}

export interface TrellisProviderOptions {
  readonly tool: TrellisToolPaths;
  /** The picture file of an asset to build from. */
  readonly resolveImagePath: (assetId: string) => string | undefined;
  /** The model (GLB) of an asset made earlier, to repaint from its sheet. */
  readonly resolveModelFile?: (assetId: string) => string | undefined;
  readonly blenderExecutable?: string;
  /** For the whole TRELLIS run (default 90 minutes; a standard build takes about 20 on a mid-range GPU). */
  readonly timeoutMs?: number;
  /** For tests: runs trellis-cli. Resolves with its exit code and the end of its output. */
  readonly runTrellis?: (args: readonly string[], onLine: (line: string) => void, signal?: AbortSignal) => Promise<{ code: number | null; output: string }>;
}

export type TrellisBox = readonly [number, number, number, number];
export const TRELLIS_SHEET_VIEWS = ["front", "right", "back", "left"] as const;
export type TrellisSheetView = (typeof TRELLIS_SHEET_VIEWS)[number];

export interface TrellisSettings {
  readonly crop?: TrellisBox;
  /** The sheet's other views; front is the crop. */
  readonly views?: Partial<Record<TrellisSheetView, TrellisBox>>;
  readonly quality: "standard" | "high";
  readonly height: number;
  readonly maxFaces: number;
}

export class TrellisImageTo3DProvider implements FoundryAssetProvider {
  readonly descriptor = TRELLIS_PROVIDER_DESCRIPTOR;

  constructor(private readonly options: TrellisProviderOptions) {}

  async execute(request: FoundryAssetRequest, context?: FoundryAssetProviderContext): Promise<FoundryAssetProviderResult> {
    if (!context?.outputRoot) throw new Error("TRELLIS needs an output folder.");
    const repaint = Boolean(request.parentAsset);
    const source = request.referenceAssets?.[0] ?? (repaint ? undefined : request.parentAsset);
    if (!source) throw new Error(repaint ? "Choose the character sheet to paint from." : "Choose the picture to build from.");
    const image = this.options.resolveImagePath(source);
    if (!image || !/\.(png|jpe?g|webp)$/i.test(image) || !existsSync(image)) throw new Error(`${source} is not a PNG, JPG or WEBP picture.`);
    const settings = parseTrellisSettings(request.parameters);
    const sides = TRELLIS_SHEET_VIEWS.filter((view) => view !== "front" && settings.views?.[view]);
    let parentModel: string | undefined;
    if (repaint) {
      parentModel = this.options.resolveModelFile?.(request.parentAsset!);
      if (!parentModel || !existsSync(parentModel)) throw new Error(`${request.parentAsset} has no .glb model to paint.`);
      if (!sides.length) throw new Error("Mark at least one of the back, right or left views on the sheet.");
    }
    const progress = context.onProgress ?? (() => undefined);
    const live = context.onLive ?? (() => undefined);
    const signal = context.signal;

    const baseName = request.assetId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "model";
    let jobDir = resolve(context.outputRoot, baseName);
    for (let n = 2; existsSync(jobDir); n++) jobDir = resolve(context.outputRoot, `${baseName}_try${n}`);
    mkdirSync(jobDir, { recursive: true });

    const companions: string[] = [];
    let model: string;
    let res = "";
    let cutoutNote: unknown;
    if (parentModel) {
      model = parentModel;
    } else {
      progress("Cutting the character out of the background…");
      const cutout = join(jobDir, `${baseName}-cutout.png`);
      const prepared = await this.blender({ mode: "prepare", image, output: cutout, ...(settings.crop ? { crop: settings.crop } : {}) }, jobDir, "prepare", signal);
      cutoutNote = prepared.cutout;
      live({ image: cutout });

      const raw = join(jobDir, `${baseName}-trellis.glb`);
      res = settings.quality === "high" ? "1024" : "512";
      progress(`Building the 3D model on your graphics card (${settings.quality === "high" ? "high detail, about 45 minutes" : "about 20 minutes"})…`);
      const args = ["--image", cutout, "--output", raw, "--models", this.options.tool.models, "--res", res, "--require-gpu",
        ...(request.seed !== undefined ? ["--seed", String(Number.parseInt(String(request.seed), 10) || 42)] : [])];
      const run = await (this.options.runTrellis ?? ((a, onLine, s) => runTrellisCli(this.options.tool.cli, a, onLine, this.options.timeoutMs ?? 90 * 60_000, s)))(args, (line) => {
        const step = trellisStep(line);
        if (step) progress(`Step ${step} of 7: ${TRELLIS_STEPS[step]}…`);
      }, signal);
      if (signal?.aborted) throw new Error("Cancelled.");
      for (const file of readdirSync(jobDir).filter((f) => f.endsWith(".ply"))) rmSync(join(jobDir, file), { force: true });
      if (run.code !== 0 || !existsSync(raw)) {
        const reason = run.output.trim().split(/\r?\n/).filter((line) => line && !line.startsWith("[trellis:dbg]")).slice(-1)[0] ?? "no output";
        throw new Error(`TRELLIS could not build the model: ${reason.slice(0, 300)}`);
      }
      companions.push(cutout, raw);
      model = raw;
    }

    let painted: Record<string, unknown> | undefined;
    if (sides.length) {
      if (!parentModel) {
        // fit first, so the paint step works on the game-sized model
        progress("Fitting the model to the game's size…");
        const fitted = join(jobDir, `${baseName}-unpainted.glb`);
        await this.blender({ mode: "finish", model, output: fitted, previewBase: join(jobDir, `${baseName}-unpainted`), height: settings.height, maxFaces: settings.maxFaces }, jobDir, "fit", signal);
        model = fitted;
        companions.push(fitted);
      }
      progress(`Painting the ${sides.join(", ")} from the sheet…`);
      const paintedFile = join(jobDir, `${baseName}-painted.glb`);
      painted = await this.blender({
        mode: "paint", model, sheet: image, output: paintedFile,
        // only the marked back and sides are painted: the front is the model's own and stays exactly as it is
        views: Object.fromEntries(sides.map((view) => [view, settings.views![view]])),
      }, jobDir, "paint", signal);
      model = paintedFile;
    }

    let carved: Record<string, unknown> | undefined;
    const side = settings.views?.right ?? settings.views?.left;
    if (side) {
      // the depth (front-to-back) was guessed from the front view: fix it with the sheet's side view
      progress("Checking the side against the sheet (removing guessed parts, fixing the depth)…");
      const carvedFile = join(jobDir, `${baseName}-carved.glb`);
      carved = await this.blender({ mode: "carve", model, sheet: image, side, output: carvedFile }, jobDir, "carve", signal);
      model = carvedFile;
    }

    progress(parentModel ? "Rendering the previews…" : "Fitting the model to the game's size…");
    const glb = join(jobDir, `${baseName}.glb`);
    const finished = await this.blender({ mode: "finish", model, output: glb, previewBase: join(jobDir, baseName), height: settings.height, maxFaces: settings.maxFaces }, jobDir, "finish", signal);
    const previews = ((finished.previews ?? []) as string[]).map((file) => resolve(file)).filter((file) => existsSync(file));
    if (previews[0]) live({ image: previews[0] });
    if (!existsSync(glb)) throw new Error("Blender finished but the game-ready model is missing.");
    const faces = finished.faces as [number, number] | undefined;
    progress(parentModel
      ? `Done: painted from the ${sides.join(", ")} of the sheet, ready to rig.`
      : `Done: a ${settings.height} m model with ${faces?.[1] ?? "?"} faces${sides.length ? `, painted from the ${sides.join(", ")} of the sheet` : ""}, ready to rig.`);

    const bytes = readFileSync(glb);
    return {
      outputs: [{
        providerId: this.descriptor.id,
        requestId: request.requestId,
        outputIndex: 0,
        localPath: resolve(glb),
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        ...(previews[0] ? { previewPath: previews[0] } : {}),
        companionFiles: [...companions, ...previews].filter((file) => existsSync(file)),
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        metadata: {
          model: parentModel ? "Painted from the sheet" : `TRELLIS.2 (${res})`,
          source,
          ...(cutoutNote ? { cutout: cutoutNote } : {}),
          ...(settings.crop ? { crop: settings.crop } : {}),
          ...(settings.views ? { views: settings.views } : {}),
          ...(painted ? { paintedFrom: painted.views } : {}),
          ...(carved ? { carved: carved.carve } : {}),
          faces: finished.faces,
          size: finished.size,
          height: settings.height,
        },
      }],
      metadata: { source, quality: settings.quality },
    };
  }

  private async blender(config: Record<string, unknown>, workDir: string, step: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const blender = this.options.blenderExecutable ?? findBlenderExecutable();
    if (!blender) throw new Error("Blender was not found. Install Blender 4.2+ or set MATTERHORN_BLENDER_BIN.");
    const scriptPath = join(workDir, "matterhorn_trellis.py");
    const configPath = join(workDir, `trellis-${step}.json`);
    const reportPath = join(workDir, `trellis-${step}-report.json`);
    writeFileSync(scriptPath, TRELLIS_BLENDER_SCRIPT, "utf8");
    writeFileSync(configPath, JSON.stringify({ ...config, report: reportPath }, null, 2), "utf8");
    const run = await runBlender(blender, [
      "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1",
      "--python", scriptPath, "--", configPath,
    ], workDir, 10 * 60_000, signal);
    if (signal?.aborted) throw new Error("Cancelled.");
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown> : undefined;
    if (!report?.ok) {
      const error = String(report?.error ?? (run.timedOut ? "Blender timed out." : run.output.slice(-1500)));
      const what = step === "prepare" ? "Preparing the picture" : step === "paint" ? "Painting from the sheet" : step === "carve" ? "Checking against the side view" : "Fitting the model";
      throw new Error(`${what} failed: ${error.trim().split(/\r?\n/).slice(-1)[0]}`);
    }
    return report;
  }
}

/** The step number of a trellis-cli progress line ("[2/6] DINOv3 conditioning" -> 2), or undefined. */
export function trellisStep(line: string): number | undefined {
  const match = /^\[(\d)\/[67]\]/.exec(line.trim());
  const step = match ? Number(match[1]) : 0;
  return step >= 1 && step <= 7 ? step : undefined;
}

/** A box on the picture: [left, top, right, bottom] as fractions between 0 and 1. */
function parseBox(value: unknown, what: string): TrellisBox {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) {
    throw new Error(`${what === "The crop" ? "crop" : what} must be [left, top, right, bottom] as fractions between 0 and 1.`);
  }
  if (value[2] - value[0] < 0.02 || value[3] - value[1] < 0.02) throw new Error(`${what} is too small.`);
  return [value[0], value[1], value[2], value[3]];
}

/** Reads the owner's settings; anything unusable falls back to the defaults or is refused with a clear reason. */
export function parseTrellisSettings(parameters: Readonly<Record<string, unknown>> | undefined): TrellisSettings {
  const p = parameters ?? {};
  const crop = p.crop !== undefined && p.crop !== null ? parseBox(p.crop, "The crop") : undefined;
  let views: Partial<Record<TrellisSheetView, TrellisBox>> | undefined;
  if (p.views !== undefined && p.views !== null) {
    if (typeof p.views !== "object" || Array.isArray(p.views)) throw new Error("views must map front, right, back or left to a box.");
    views = {};
    for (const [name, box] of Object.entries(p.views as Record<string, unknown>)) {
      if (!(TRELLIS_SHEET_VIEWS as readonly string[]).includes(name)) throw new Error(`Unknown view: ${name}`);
      views[name as TrellisSheetView] = parseBox(box, `The ${name} view`);
    }
    if (!Object.keys(views).length) views = undefined;
  }
  const quality = p.quality === "high" ? "high" : "standard";
  const height = typeof p.height === "number" && p.height >= 0.05 && p.height <= 50 ? p.height : 0.72;
  const maxFaces = typeof p.maxFaces === "number" && p.maxFaces >= 2000 && p.maxFaces <= 300_000 ? Math.round(p.maxFaces) : 40_000;
  return { ...(crop ? { crop } : {}), ...(views ? { views } : {}), quality, height, maxFaces };
}

/** Runs trellis-cli, passing each output line on (for progress) and keeping the end of the output. */
function runTrellisCli(cli: string, args: readonly string[], onLine: (line: string) => void, timeoutMs: number, signal?: AbortSignal): Promise<{ code: number | null; output: string }> {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/i.test(key)) env[key] = value;
  }
  return new Promise((resolvePromise) => {
    const child = spawn(cli, args, { env, windowsHide: true, shell: false });
    let output = "";
    let pending = "";
    const collect = (chunk: Buffer) => {
      const text = chunk.toString();
      output = (output + text).slice(-20_000);
      pending += text;
      const lines = pending.split(/\r?\n|\r/);
      pending = lines.pop() ?? "";
      for (const line of lines) onLine(line);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const abort = () => child.kill();
    signal?.addEventListener("abort", abort, { once: true });
    const done = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    child.on("error", (error) => { done(); resolvePromise({ code: null, output: error.message }); });
    child.on("close", (code) => { done(); if (pending) onLine(pending); resolvePromise({ code, output }); });
  });
}
