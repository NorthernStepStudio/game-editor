import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { FoundryAssetCost } from "../../provenance/types.js";
import type {
  FoundryAssetProvider,
  FoundryAssetProviderContext,
  FoundryAssetProviderDescriptor,
  FoundryAssetProviderResult,
  FoundryAssetRequest,
} from "../types.js";
import type { SpriteFusionFetch, SpriteFusionHttpResponse } from "./spriteFusion.js";

/**
 * Meshy multi-image-to-3D: turns 1–4 views of the same character or object (front first)
 * into a textured GLB. It is a paid online service, so it is only used with explicit network
 * and cost approval and a credit budget, and the reported credits are checked against it.
 * The API key is sent only to the Meshy API host, never to the download links.
 */

export const MESHY_PROVIDER_ID = "meshy-image-to-3d";
export const MESHY_CREDIT_CURRENCY = "MESHY_CREDITS";
/** What one textured multi-image build is expected to cost; the real amount comes back with the task. */
export const MESHY_REQUEST_CREDITS = 30;
export const MESHY_DEFAULT_BASE_URL = "https://api.meshy.ai";

export const MESHY_PROVIDER_DESCRIPTOR: FoundryAssetProviderDescriptor = {
  id: MESHY_PROVIDER_ID,
  name: "Meshy (images to 3D)",
  operations: ["image_to_3d"],
  kinds: ["mesh_3d"],
  local: false,
  requiresNetwork: true,
  externalCost: true,
  supportsSeed: false,
  supportsReferences: true,
  outputLicense: {
    name: "Meshy generated output",
    classification: "proprietary",
    reusePolicy: "review-required",
    notes: "Ownership of generated models depends on the Meshy plan used; check your plan's terms before shipping.",
  },
  commercialUseAllowed: true,
  priority: 10,
};

export interface MeshyProviderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: SpriteFusionFetch;
  /** Local image file of a reference asset (the views to build from). */
  readonly resolveImagePath: (assetId: string) => string | undefined;
  readonly aiModel?: string;
  readonly targetPolycount?: number;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}

interface MeshyTask {
  readonly status?: string;
  readonly progress?: number;
  readonly model_urls?: Readonly<Record<string, string>>;
  readonly thumbnail_url?: string;
  readonly consumed_credits?: number;
  readonly task_error?: { readonly message?: string };
}

const IMAGE_MIME: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export class MeshyImageTo3DProvider implements FoundryAssetProvider {
  readonly descriptor = MESHY_PROVIDER_DESCRIPTOR;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: SpriteFusionFetch;
  private readonly resolveImagePath: MeshyProviderOptions["resolveImagePath"];
  private readonly aiModel: string;
  private readonly targetPolycount: number;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: MeshyProviderOptions) {
    if (!options.apiKey?.trim()) throw new Error("Meshy needs an API key.");
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? MESHY_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.resolveImagePath = options.resolveImagePath;
    this.aiModel = options.aiModel?.trim() || "latest";
    this.targetPolycount = options.targetPolycount ?? 30000;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.timeoutMs = options.timeoutMs ?? 20 * 60_000;
  }

  async execute(request: FoundryAssetRequest, context?: FoundryAssetProviderContext): Promise<FoundryAssetProviderResult> {
    if (!context?.outputRoot) throw new Error("Meshy needs an output folder.");
    checkBudget(context.maxCost);
    const references = request.referenceAssets ?? [];
    if (references.length < 1 || references.length > 4) {
      throw new Error("Meshy builds from 1 to 4 views of the same subject (front view first).");
    }
    const imageUrls: string[] = [];
    for (const assetId of references) {
      const path = this.resolveImagePath(assetId);
      const mime = path ? IMAGE_MIME[extname(path).toLowerCase()] : undefined;
      if (!path || !mime) throw new Error(`Reference ${assetId} is not a PNG, JPG or WEBP image.`);
      const bytes = await readFile(path);
      if (bytes.length > 20 * 1024 * 1024) throw new Error(`Reference ${assetId} is larger than Meshy's 20 MB limit.`);
      imageUrls.push(`data:${mime};base64,${bytes.toString("base64")}`);
    }

    const progress = context.onProgress ?? (() => undefined);
    progress(`Sending ${imageUrls.length} view${imageUrls.length > 1 ? "s" : ""} to Meshy…`);
    const created = await this.api("POST", "/openapi/v1/multi-image-to-3d", {
      image_urls: imageUrls,
      ai_model: this.aiModel,
      topology: "triangle",
      target_polycount: this.targetPolycount,
      should_remesh: true,
      should_texture: true,
      enable_pbr: false,
      pose_mode: /\bt-?pose\b/i.test(request.prompt ?? "") ? "t-pose" : "a-pose",
      ...(request.prompt ? { texture_prompt: request.prompt.slice(0, 600) } : {}),
    });
    const taskId = typeof created.result === "string" ? created.result : undefined;
    if (!taskId) throw new Error("Meshy did not return a task id.");
    progress(`Meshy task started (${taskId}).`);

    const task = await this.waitForTask(taskId, progress, context.signal);
    const glbUrl = task.model_urls?.glb;
    if (!glbUrl) throw new Error("Meshy finished without a GLB file.");

    await mkdir(context.outputRoot, { recursive: true });
    const base = join(context.outputRoot, safeFilePart(request.assetId));
    const glb = await this.download(glbUrl);
    if (glb.subarray(0, 4).toString("latin1") !== "glTF") throw new Error("Meshy's download is not a GLB file.");
    const localPath = `${base}.glb`;
    await writeFile(localPath, glb);
    progress("Downloaded the 3D model.");

    let previewPath: string | undefined;
    if (task.thumbnail_url) {
      try {
        const image = await this.download(task.thumbnail_url);
        previewPath = `${base}-preview${imageExtension(image)}`;
        await writeFile(previewPath, image);
        context.onLive?.({ image: previewPath });
      } catch {
        // The model is what was paid for; a missing thumbnail only means no picture yet.
      }
    }

    const cost: FoundryAssetCost = {
      currency: MESHY_CREDIT_CURRENCY,
      amount: typeof task.consumed_credits === "number" ? task.consumed_credits : MESHY_REQUEST_CREDITS,
    };
    return {
      outputs: [{
        providerId: this.descriptor.id,
        requestId: request.requestId,
        outputIndex: 0,
        providerRequestId: taskId,
        localPath,
        contentHash: createHash("sha256").update(glb).digest("hex"),
        cost,
        ...(previewPath ? { previewPath, companionFiles: [previewPath] } : {}),
        metadata: { aiModel: this.aiModel, views: references.length },
      }],
      providerRequestId: taskId,
      cost,
      metadata: { aiModel: this.aiModel, views: references },
    };
  }

  private async waitForTask(taskId: string, progress: (message: string) => void, signal?: AbortSignal): Promise<MeshyTask> {
    const started = Date.now();
    let lastShown = -1;
    while (Date.now() - started <= this.timeoutMs) {
      if (signal?.aborted) {
        throw new Error(`Stopped waiting. Meshy may still finish task ${taskId} on its side.`);
      }
      const task = (await this.api("GET", `/openapi/v1/multi-image-to-3d/${encodeURIComponent(taskId)}`)) as MeshyTask;
      if (task.status === "SUCCEEDED") return task;
      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error(`Meshy ${task.status === "FAILED" ? "failed" : "cancelled"} the build${task.task_error?.message ? `: ${task.task_error.message}` : "."} Failed builds are refunded by Meshy.`);
      }
      const pct = typeof task.progress === "number" ? task.progress : 0;
      if (pct !== lastShown) {
        progress(`Meshy is building the model… ${pct}%`);
        lastShown = pct;
      }
      await delay(this.pollIntervalMs, signal);
    }
    throw new Error(`Meshy did not finish within ${Math.round(this.timeoutMs / 60000)} minutes (task ${taskId}).`);
  }

  private async api(method: "GET" | "POST", path: string, body?: unknown): Promise<Readonly<Record<string, unknown>>> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    if (!response.ok) {
      const hint = response.status === 401 ? " Check MESHY_API_KEY in .env."
        : response.status === 402 ? " Your Meshy account is out of credits."
          : response.status === 429 ? " Meshy is rate limiting; try again shortly." : "";
      throw new Error(`Meshy answered HTTP ${response.status}.${hint} ${redact(text, this.apiKey).slice(0, 300)}`.trim());
    }
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Meshy returned invalid JSON.");
    return parsed as Readonly<Record<string, unknown>>;
  }

  /** Result files are signed links on Meshy's storage; the API key is never sent there. */
  private async download(url: string): Promise<Buffer> {
    if (!/^https:\/\//i.test(url)) throw new Error("Meshy returned a non-HTTPS download link.");
    const response = await this.fetchImpl(url);
    if (!response.ok) throw new Error(`Meshy download failed with HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }
}

function checkBudget(budget: FoundryAssetCost | undefined): void {
  if (!budget || budget.currency !== MESHY_CREDIT_CURRENCY || budget.amount < MESHY_REQUEST_CREDITS) {
    throw new Error(`Meshy needs an approved budget of at least ${MESHY_REQUEST_CREDITS} ${MESHY_CREDIT_CURRENCY} before it starts.`);
  }
}

function imageExtension(bytes: Buffer): string {
  if (bytes.subarray(0, 4).toString("hex") === "89504e47") return ".png";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF") return ".webp";
  return ".jpg";
}

function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join("[redacted]") : text;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

const defaultFetch: SpriteFusionFetch = async (url, init) => {
  const response = await fetch(url, {
    ...(init?.method ? { method: init.method } : {}),
    ...(init?.headers ? { headers: { ...init.headers } } : {}),
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });
  return response as SpriteFusionHttpResponse;
};
