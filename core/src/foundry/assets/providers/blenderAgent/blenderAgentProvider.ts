/**
 * Blender Agent: describe an asset in words, get it built in Blender.
 *
 * A script author (Claude Code or a local Ollama model) writes Blender Python
 * for the description. Matterhorn guards the script, runs it in a background
 * Blender with the Matterhorn harness, and feeds failures back to the author
 * for a bounded number of repair attempts. The harness, not the model, writes
 * every output file: .blend source, GLB, turnaround renders and sprites.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findBlenderExecutable } from "../../../../studio/adapters/blender/blenderProcess.js";
import type {
  FoundryAssetKind,
  FoundryAssetProvider,
  FoundryAssetProviderContext,
  FoundryAssetProviderDescriptor,
  FoundryAssetProviderResult,
  FoundryAssetRequest,
} from "../../types.js";
import { BLENDER_AGENT_HARNESS } from "./harness.js";
import type { ScriptAuthor } from "./scriptAuthors.js";
import {
  BLENDER_AGENT_ALLOWED_MODULES,
  extractPythonScript,
  guardBlenderAgentScript,
} from "./scriptGuard.js";

export const BLENDER_AGENT_KINDS: readonly FoundryAssetKind[] = ["mesh_3d", "sprite_sheet", "pixel_sprite"];

export interface BlenderAgentProviderOptions {
  readonly author: ScriptAuthor;
  readonly blenderExecutable?: string;
  readonly maxAttempts?: number;
  readonly blenderTimeoutMs?: number;
  /** Returns the generator script of an existing asset, used when iterating on it. */
  readonly resolveParentScript?: (assetId: string) => string | undefined;
}

interface HarnessReport {
  readonly ok: boolean;
  readonly stage: string;
  readonly error?: string;
  readonly files: { blend?: string; glb?: string; sheet?: string; sprite?: string; frames?: string[] };
  readonly renders: Record<string, string>;
  readonly stats?: Record<string, unknown>;
  readonly engine?: string;
  readonly blenderVersion?: string;
}

export const BLENDER_AGENT_SYSTEM_PROMPT = `You write Blender 5 Python scripts that build game assets. Matterhorn runs your script inside a prepared empty scene, then exports, saves and renders it itself.

Rules:
- Reply with exactly one \`\`\`python code block containing the complete script. No prose outside it.
- Only import: ${BLENDER_AGENT_ALLOWED_MODULES.join(", ")}.
- Build geometry with bmesh, bpy.data meshes, bpy.ops.mesh.primitive_* and bpy.ops.object operators, and modifiers (apply them when useful).
- Never touch files, paths, rendering, cameras, lights, the world, preferences, handlers, text blocks or add-ons. Never use eval/exec/open/getattr/setattr or introspection such as __class__, __dict__ or __globals__. Plain top-level code is preferred over an if __name__ guard.
- Real-world scale in meters, Z up, the asset centered on the origin and resting on Z=0, front facing -Y.
- Game-ready: clean low-to-mid poly topology, sensible proportions, recognizable silhouette, no stray or floating parts unless the design calls for them.
- Give every part a Principled BSDF material with a fitting base color (and roughness/metallic), using material node_tree where needed. Name objects and materials meaningfully.
- Keep parts as separate, meaningfully named objects and parent them all to one root Empty named after the asset (obj.parent = root). Never call bpy.ops.object.join(); Matterhorn exports all parts together.
- Parts must physically touch or overlap: floating, disconnected pieces are rejected. Compute positions from the dimensions of the parts they attach to.

Blender 4/5 pitfalls to avoid:
- Select explicitly before operators: deselect all, obj.select_set(True), bpy.context.view_layer.objects.active = obj.
- Prefer bmesh or object-mode operators over edit-mode bpy.ops calls that need a specific context.
- Principled BSDF inputs are named "Base Color", "Metallic", "Roughness", "Emission Color", "Emission Strength", "Alpha".
- Apply modifiers with bpy.ops.object.modifier_apply(modifier=mod.name) while the object is active, or leave them for the exporter.`;

export class BlenderAgentAssetProvider implements FoundryAssetProvider {
  readonly descriptor: FoundryAssetProviderDescriptor;
  private readonly maxAttempts: number;
  private readonly blenderTimeoutMs: number;

  constructor(private readonly options: BlenderAgentProviderOptions) {
    const remote = options.author.id === "claude-code";
    this.maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 5);
    this.blenderTimeoutMs = options.blenderTimeoutMs ?? 10 * 60_000;
    this.descriptor = {
      id: remote ? "blender-agent-claude" : "blender-agent-local",
      name: remote ? "Blender Agent (Claude Code)" : `Blender Agent (local ${options.author.model ?? "model"})`,
      operations: ["generate", "edit", "direction_set"],
      kinds: BLENDER_AGENT_KINDS,
      local: !remote,
      requiresNetwork: remote,
      externalCost: false,
      supportsSeed: false,
      supportsReferences: false,
      outputLicense: {
        name: "Owner-generated with local Blender",
        classification: "permissive",
        reusePolicy: "direct",
        notes: "Geometry is produced by a script run on this PC; the script is kept with the asset.",
      },
      commercialUseAllowed: true,
      priority: remote ? 20 : 10,
    };
  }

  async execute(
    request: FoundryAssetRequest,
    context?: FoundryAssetProviderContext,
  ): Promise<FoundryAssetProviderResult> {
    if (!context?.outputRoot) throw new Error("Blender Agent requires an output folder.");
    if (!request.prompt?.trim()) throw new Error("Describe the asset you want Blender Agent to build.");
    const blender = this.options.blenderExecutable ?? findBlenderExecutable();
    if (!blender) throw new Error("Blender was not found. Install Blender 4.2+ or set MATTERHORN_BLENDER_BIN.");

    const progress = context.onProgress ?? (() => undefined);
    const baseName = request.assetId.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "asset";
    const jobDir = resolve(context.outputRoot, baseName);
    if (existsSync(jobDir)) throw new Error(`Output folder already exists for ${request.assetId}.`);
    mkdirSync(jobDir, { recursive: true });

    const mode = request.kind === "sprite_sheet" ? "sprite_sheet" : request.kind === "pixel_sprite" ? "pixel_sprite" : "model";
    const frameSize = request.dimensions?.width ?? (mode === "pixel_sprite" ? 64 : 128);
    const parentScript = request.parentAsset ? this.options.resolveParentScript?.(request.parentAsset) : undefined;
    if (request.parentAsset && !parentScript) {
      throw new Error(`No Blender Agent script is stored for ${request.parentAsset}; it cannot be iterated on.`);
    }

    const harnessPath = join(jobDir, "matterhorn_harness.py");
    const scriptPath = join(jobDir, `${baseName}_script.py`);
    const reportPath = join(jobDir, "report.json");
    const configPath = join(jobDir, "job.json");
    writeFileSync(harnessPath, BLENDER_AGENT_HARNESS, "utf8");
    writeFileSync(configPath, JSON.stringify({
      outputDir: jobDir.replace(/\\/g, "/"),
      scriptPath: scriptPath.replace(/\\/g, "/"),
      reportPath: reportPath.replace(/\\/g, "/"),
      baseName,
      mode,
      frameSize,
      directions: 8,
      allowedModules: BLENDER_AGENT_ALLOWED_MODULES,
      maxTriangles: 500000,
      // Floating parts are a defect unless the request is deliberately scattered.
      requireConnected: !/(float\w*|scatter\w*|debris|particles?|pieces|kit|set of|collection|separate)/i.test(request.prompt),
    }, null, 2), "utf8");

    let prompt = parentScript
      ? `Here is the current script for this asset:\n\n\`\`\`python\n${parentScript}\`\`\`\n\nRewrite the complete script with this change: ${request.prompt}`
      : `Build this asset: ${request.prompt}`;
    if (mode !== "model") {
      prompt += `\n\nIt will be rendered as ${mode === "sprite_sheet" ? "an 8-direction sprite sheet" : "a small pixel-art sprite"}, so favor a bold readable silhouette and strong color blocking.`;
    }

    const attempts: { attempt: number; outcome: string }[] = [];
    let report: HarnessReport | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      progress(`Attempt ${attempt}/${this.maxAttempts}: ${this.options.author.label} is writing the Blender script…`);
      const reply = await this.options.author.author({ system: BLENDER_AGENT_SYSTEM_PROMPT, prompt });
      const script = extractPythonScript(reply);
      writeFileSync(scriptPath, script, "utf8");

      const guard = guardBlenderAgentScript(script);
      if (!guard.ok) {
        attempts.push({ attempt, outcome: `guard: ${guard.problems.join("; ")}` });
        progress(`Attempt ${attempt}: script rejected by the safety guard; asking for a fix.`);
        prompt = repairPrompt(script, `The script was rejected before running:\n- ${guard.problems.join("\n- ")}`);
        continue;
      }

      progress(`Attempt ${attempt}: building in Blender and rendering previews…`);
      const run = await runBlender(blender, [
        "--background", "--factory-startup", "--disable-autoexec",
        "--python-exit-code", "1", "--python", harnessPath, "--", configPath,
      ], jobDir, this.blenderTimeoutMs);

      report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) as HarnessReport : undefined;
      if (report?.ok) {
        attempts.push({ attempt, outcome: "ok" });
        break;
      }
      const error = report?.error ?? (run.timedOut ? "Blender timed out." : tail(run.output, 3000));
      attempts.push({ attempt, outcome: `${report?.stage ?? "blender"}: ${firstLine(error)}` });
      progress(`Attempt ${attempt}: Blender reported a problem at the ${report?.stage ?? "run"} stage; asking for a fix.`);
      prompt = repairPrompt(script, `Blender failed at the "${report?.stage ?? "run"}" stage:\n${error}`);
      report = undefined;
    }

    writeFileSync(join(jobDir, "attempts.json"), JSON.stringify(attempts, null, 2), "utf8");
    if (!report?.ok) {
      throw new Error(`Blender Agent could not build "${request.assetId}" after ${attempts.length} attempt(s). Last: ${attempts.at(-1)?.outcome ?? "unknown"}`);
    }

    const main = mode === "sprite_sheet" ? report.files.sheet : mode === "pixel_sprite" ? report.files.sprite : report.files.glb;
    if (!main || !existsSync(main)) throw new Error("Blender finished but the main output file is missing.");
    const bytes = readFileSync(main);
    const companions = [
      report.files.blend,
      report.files.glb,
      scriptPath,
      reportPath,
      ...Object.values(report.renders),
      ...(report.files.frames ?? []),
    ].filter((file): file is string => Boolean(file) && file !== main).map((file) => resolve(file));
    const previewPath = mode === "model" ? report.renders.three_quarter : main;
    progress("Done. Registering the asset in Foundry…");

    return {
      outputs: [{
        providerId: this.descriptor.id,
        requestId: request.requestId,
        outputIndex: 0,
        localPath: resolve(main),
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        ...(mode !== "model" ? { width: frameSize * (mode === "sprite_sheet" ? 8 : 1), height: frameSize } : {}),
        ...(previewPath ? { previewPath: resolve(previewPath) } : {}),
        companionFiles: companions,
        metadata: {
          model: `${this.options.author.label}${this.options.author.model ? `:${this.options.author.model}` : ""}`,
          attempts: attempts.length,
          stats: report.stats,
          engine: report.engine,
          blenderVersion: report.blenderVersion,
        },
      }],
      metadata: { attempts },
    };
  }
}

function repairPrompt(script: string, problem: string): string {
  // Point at the exact failing line; small local models fix far more reliably with it quoted.
  const lines = script.split(/\r?\n/);
  const failing = [...problem.matchAll(/File "asset_script\.py", line (\d+)/g)].at(-1);
  const index = failing ? Number(failing[1]) - 1 : -1;
  const pointer = index >= 0 && index < lines.length
    ? `\n\nThe failing line is ${index + 1}:\n    ${lines[index].trim()}`
    : "";
  return `Your previous script:\n\n\`\`\`python\n${script}\`\`\`\n\n${problem}${pointer}\n\nReturn the complete corrected script.`;
}

function runBlender(
  executable: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number | null; output: string; timedOut: boolean }> {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/i.test(key)) env[key] = value;
  }
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, shell: false });
    let output = "";
    let timedOut = false;
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 200_000) output = output.slice(-100_000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); resolvePromise({ code: null, output: error.message, timedOut }); });
    child.on("close", (code) => { clearTimeout(timer); resolvePromise({ code, output, timedOut }); });
  });
}

function tail(text: string, max: number): string {
  return text.length > max ? text.slice(-max) : text;
}

function firstLine(text: string): string {
  const lines = text.trim().split(/\r?\n/);
  return (lines.at(-1) ?? "").slice(0, 300);
}
