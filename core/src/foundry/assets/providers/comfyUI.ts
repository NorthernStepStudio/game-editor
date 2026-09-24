import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { FoundryLicenseRecord } from "../../provenance/types.js";
import type {
  FoundryAssetKind,
  FoundryAssetOperation,
  FoundryAssetProvider,
  FoundryAssetProviderContext,
  FoundryAssetProviderDescriptor,
  FoundryAssetProviderResult,
  FoundryAssetRequest,
  FoundryGeneratedAsset,
} from "../types.js";
import type {
  SpriteFusionFetch,
  SpriteFusionHttpResponse,
} from "./spriteFusion.js";

export const COMFYUI_DEFAULT_BASE_URL = "http://127.0.0.1:8188";

export type ComfyUIWorkflow = Readonly<Record<string, unknown>>;
export type ComfyUIWorkflowFactory = (
  request: FoundryAssetRequest,
) => ComfyUIWorkflow | Promise<ComfyUIWorkflow>;

export interface ComfyUIProviderOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: SpriteFusionFetch;
  readonly workflows: Readonly<
    Partial<Record<FoundryAssetOperation, ComfyUIWorkflowFactory>>
  >;
  readonly kinds: readonly FoundryAssetKind[];
  readonly outputLicense?: FoundryLicenseRecord;
  readonly modelLicense?: FoundryLicenseRecord;
  readonly commercialUseAllowed?: boolean;
  readonly supportsSeed?: boolean;
  readonly supportsReferences?: boolean;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
}

interface ComfyUIImageRef {
  readonly nodeId: string;
  readonly filename: string;
  readonly subfolder: string;
  readonly type: string;
}

export class ComfyUIAssetProvider implements FoundryAssetProvider {
  readonly descriptor: FoundryAssetProviderDescriptor;
  private readonly baseUrl: string;
  private readonly fetchImpl: SpriteFusionFetch;
  private readonly workflows: ComfyUIProviderOptions["workflows"];
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: ComfyUIProviderOptions) {
    if (!options || Object.keys(options.workflows ?? {}).length === 0) {
      throw new Error("ComfyUI provider requires at least one workflow factory.");
    }
    if (!options.kinds?.length) {
      throw new Error("ComfyUI provider requires at least one asset kind.");
    }

    this.baseUrl = (options.baseUrl ?? COMFYUI_DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    assertLoopbackComfyUrl(this.baseUrl);
    this.fetchImpl = options.fetchImpl ?? defaultComfyFetch;
    this.workflows = options.workflows;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
    this.timeoutMs = options.timeoutMs ?? 300_000;

    const operations = Object.keys(options.workflows) as FoundryAssetOperation[];
    this.descriptor = {
      id: "comfyui-local",
      name: "ComfyUI Local",
      operations,
      kinds: [...options.kinds],
      local: true,
      requiresNetwork: false,
      externalCost: false,
      supportsSeed: options.supportsSeed ?? false,
      supportsReferences: options.supportsReferences ?? false,
      outputLicense:
        options.outputLicense ??
        ({
          name: "Workflow/model output license not declared",
          classification: "unknown",
          reusePolicy: "review-required",
          notes:
            "ComfyUI is an execution backend; output rights depend on the models, LoRAs, assets, and workflow used.",
        } satisfies FoundryLicenseRecord),
      ...(options.modelLicense ? { modelLicense: options.modelLicense } : {}),
      commercialUseAllowed: options.commercialUseAllowed ?? false,
    };
  }

  async execute(
    request: FoundryAssetRequest,
    context?: FoundryAssetProviderContext,
  ): Promise<FoundryAssetProviderResult> {
    if (!context?.outputRoot) {
      throw new Error(
        "ComfyUI requires outputRoot so generated outputs are copied into the project.",
      );
    }
    const factory = this.workflows[request.operation];
    if (!factory) {
      throw new Error(
        `No ComfyUI workflow is configured for operation ${request.operation}.`,
      );
    }

    const workflow = await factory(request);
    if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
      throw new Error("ComfyUI workflow factory returned an invalid workflow.");
    }

    const queued = await this.fetchJson(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });
    const promptId = stringValue(queued.prompt_id);
    if (!promptId) {
      throw new Error("ComfyUI /prompt did not return a prompt_id.");
    }

    const history = await this.waitForHistory(promptId);
    const images = extractComfyUIImages(history, promptId);
    if (images.length === 0) {
      throw new Error("ComfyUI workflow completed without image outputs.");
    }

    await mkdir(context.outputRoot, { recursive: true });
    const outputs: FoundryGeneratedAsset[] = [];
    for (let outputIndex = 0; outputIndex < images.length; outputIndex += 1) {
      const image = images[outputIndex];
      const viewUrl = comfyViewUrl(this.baseUrl, image);
      const response = await this.fetchImpl(viewUrl);
      if (!response.ok) {
        throw new Error(
          `ComfyUI output download failed with HTTP ${response.status}.`,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const extension = safeImageExtension(image.filename);
      const localPath = join(
        context.outputRoot,
        `${safeFilePart(request.assetId)}-${String(outputIndex + 1).padStart(2, "0")}.${extension}`,
      );
      await writeFile(localPath, bytes);

      outputs.push({
        providerId: this.descriptor.id,
        requestId: request.requestId,
        outputIndex,
        providerAssetId: `${image.nodeId}:${image.filename}`,
        providerRequestId: promptId,
        localPath,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        sourceUrl: viewUrl,
        metadata: {
          nodeId: image.nodeId,
          filename: image.filename,
          subfolder: image.subfolder,
          type: image.type,
        },
      });
    }

    return {
      outputs,
      providerRequestId: promptId,
      metadata: {
        workflowHash: createHash("sha256")
          .update(JSON.stringify(workflow))
          .digest("hex"),
      },
    };
  }

  private async waitForHistory(
    promptId: string,
  ): Promise<Readonly<Record<string, unknown>>> {
    const started = Date.now();
    while (Date.now() - started <= this.timeoutMs) {
      const history = await this.fetchJson(
        `${this.baseUrl}/history/${encodeURIComponent(promptId)}`,
      );
      if (asRecord(history[promptId])) return history;
      if (this.pollIntervalMs > 0) {
        await delay(this.pollIntervalMs);
      }
    }
    throw new Error(
      `ComfyUI workflow ${promptId} did not complete within ${this.timeoutMs}ms.`,
    );
  }

  private async fetchJson(
    url: string,
    init?: {
      readonly method?: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly body?: string;
    },
  ): Promise<Readonly<Record<string, unknown>>> {
    const response = await this.fetchImpl(url, init);
    if (!response.ok) {
      throw new Error(
        `ComfyUI request failed with HTTP ${response.status}: ${await response.text()}`,
      );
    }
    const parsed = JSON.parse(await response.text()) as unknown;
    const record = asRecord(parsed);
    if (!record) throw new Error("ComfyUI returned invalid JSON.");
    return record;
  }
}

export function extractComfyUIImages(
  historyResponse: Readonly<Record<string, unknown>>,
  promptId: string,
): readonly ComfyUIImageRef[] {
  const entry = asRecord(historyResponse[promptId]);
  const outputs = asRecord(entry?.outputs);
  if (!outputs) return [];

  const images: ComfyUIImageRef[] = [];
  for (const nodeId of Object.keys(outputs).sort()) {
    const output = asRecord(outputs[nodeId]);
    const nodeImages = Array.isArray(output?.images) ? output.images : [];
    for (const candidate of nodeImages) {
      const image = asRecord(candidate);
      const filename = stringValue(image?.filename);
      if (!filename) continue;
      images.push({
        nodeId,
        filename,
        subfolder: stringValue(image?.subfolder) ?? "",
        type: stringValue(image?.type) ?? "output",
      });
    }
  }
  return images;
}

export function comfyViewUrl(
  baseUrl: string,
  image: {
    readonly filename: string;
    readonly subfolder: string;
    readonly type: string;
  },
): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/view`);
  url.searchParams.set("filename", image.filename);
  url.searchParams.set("subfolder", image.subfolder);
  url.searchParams.set("type", image.type);
  return url.toString();
}

function assertLoopbackComfyUrl(value: string): void {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]" && host !== "::1") {
    throw new Error(
      "ComfyUI Local provider only permits loopback base URLs.",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("ComfyUI base URL must use HTTP or HTTPS.");
  }
}

function safeImageExtension(filename: string): "png" | "jpg" | "webp" {
  const extension = extname(filename).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "jpg";
  if (extension === ".webp") return "webp";
  return "png";
}

function safeFilePart(value: string): string {
  const clean = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "asset";
}

function asRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const defaultComfyFetch: SpriteFusionFetch = async (url, init) => {
  const response = await fetch(url, {
    ...(init?.method ? { method: init.method } : {}),
    ...(init?.headers ? { headers: { ...init.headers } } : {}),
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });
  return response as SpriteFusionHttpResponse;
};
