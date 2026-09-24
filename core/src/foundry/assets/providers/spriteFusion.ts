import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { FoundryAssetCatalog } from "../catalog.js";
import type {
  FoundryAssetProvider,
  FoundryAssetProviderContext,
  FoundryAssetProviderDescriptor,
  FoundryAssetProviderResult,
  FoundryAssetRequest,
  FoundryGeneratedAsset,
} from "../types.js";

export const SPRITE_FUSION_CREDIT_CURRENCY = "SPRITE_FUSION_CREDITS";
export const SPRITE_FUSION_REQUEST_CREDITS = 15;
export const SPRITE_FUSION_API_BASE_URL =
  "https://www.spritefusion.com/api/v1";

export type SpriteFusionInput =
  | { readonly asset_id: string }
  | { readonly data_url: string }
  | { readonly upload_id: string };

export interface SpriteFusionFetchInit {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | Uint8Array;
}

export interface SpriteFusionHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type SpriteFusionFetch = (
  url: string,
  init?: SpriteFusionFetchInit,
) => Promise<SpriteFusionHttpResponse>;

export interface SpriteFusionProviderOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: SpriteFusionFetch;
  readonly catalog?: FoundryAssetCatalog;
  readonly resolveReference?: (
    assetId: string,
  ) => SpriteFusionInput | Promise<SpriteFusionInput>;
}

export interface SpriteFusionSseEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

export const SPRITE_FUSION_PROVIDER_DESCRIPTOR: FoundryAssetProviderDescriptor = {
  id: "sprite-fusion",
  name: "Sprite Fusion",
  operations: [
    "generate",
    "edit",
    "style_reference",
    "direction_set",
    "animate",
  ],
  kinds: ["pixel_sprite", "sprite_sheet", "ui_icon", "tile"],
  local: false,
  requiresNetwork: true,
  externalCost: true,
  supportsSeed: false,
  supportsReferences: true,
  outputLicense: {
    name: "Sprite Fusion Terms - Outputs",
    classification: "proprietary",
    reusePolicy: "direct",
    sourceUrl: "https://www.spritefusion.com/terms",
    notes:
      "Sprite Fusion does not claim ownership over generated outputs and permits personal or commercial project use subject to its Terms.",
  },
  commercialUseAllowed: true,
};

export class SpriteFusionAssetProvider implements FoundryAssetProvider {
  readonly descriptor = SPRITE_FUSION_PROVIDER_DESCRIPTOR;
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: SpriteFusionFetch;
  private readonly catalog?: FoundryAssetCatalog;
  private readonly customResolveReference?: (
    assetId: string,
  ) => SpriteFusionInput | Promise<SpriteFusionInput>;

  constructor(options: SpriteFusionProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? SPRITE_FUSION_API_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.fetchImpl = options.fetchImpl ?? defaultSpriteFusionFetch;
    this.catalog = options.catalog;
    this.customResolveReference = options.resolveReference;
  }

  async execute(
    request: FoundryAssetRequest,
    context?: FoundryAssetProviderContext,
  ): Promise<FoundryAssetProviderResult> {
    const apiKey = (this.apiKey ?? process.env.SPRITE_FUSION_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error(
        "Sprite Fusion requires SPRITE_FUSION_API_KEY or an explicit apiKey.",
      );
    }
    if (!context?.outputRoot) {
      throw new Error(
        "Sprite Fusion requires outputRoot so generated assets are persisted locally.",
      );
    }
    enforceSpriteFusionBudget(context);
    if (request.seed !== undefined) {
      throw new Error("Sprite Fusion does not expose seeded generation.");
    }

    const payload = await buildSpriteFusionRequestPayload(
      request,
      this.customResolveReference ??
        ((assetId) => this.resolveReferenceAsset(assetId, apiKey)),
    );
    const response = await this.fetchImpl(`${this.baseUrl}/generate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Sprite Fusion request failed with HTTP ${response.status}: ${body}`,
      );
    }

    const events = parseSpriteFusionSse(await response.text());
    const started = singleEvent(events, "started");
    const completed = singleEvent(events, "completed");
    const outputEvents = events.filter((event) => event.type === "output");

    if (!completed) {
      throw new Error("Sprite Fusion stream ended before a completed event.");
    }
    if (String(completed.status ?? "") !== "succeeded") {
      const error = completed.error;
      throw new Error(
        `Sprite Fusion generation failed: ${safeJson(error ?? completed)}`,
      );
    }

    const expectedCount = numberValue(completed.output_count);
    if (expectedCount !== null && expectedCount !== outputEvents.length) {
      throw new Error(
        `Sprite Fusion output count mismatch: expected ${expectedCount}, received ${outputEvents.length}.`,
      );
    }
    if (outputEvents.length === 0) {
      throw new Error("Sprite Fusion completed without a usable output.");
    }

    const providerRequestId =
      stringValue(started?.request_id) ?? request.requestId;
    const reservedCredits =
      numberValue(asRecord(started?.credits)?.reserved) ??
      SPRITE_FUSION_REQUEST_CREDITS;

    await mkdir(context.outputRoot, { recursive: true });
    const outputs: FoundryGeneratedAsset[] = [];
    for (const outputEvent of outputEvents) {
      const outputIndex = numberValue(outputEvent.index);
      const asset = asRecord(outputEvent.asset);
      if (outputIndex === null || outputIndex < 0 || !Number.isInteger(outputIndex)) {
        throw new Error("Sprite Fusion output event has an invalid index.");
      }
      if (!asset) {
        throw new Error(
          `Sprite Fusion output ${outputIndex} did not include an asset.`,
        );
      }
      const providerAssetId = stringValue(asset.id);
      if (!providerAssetId) {
        throw new Error(
          `Sprite Fusion output ${outputIndex} did not include an asset id.`,
        );
      }

      const sourceUrl = selectSpriteFusionDownloadUrl(request, asset);
      assertHttpsUrl(sourceUrl);
      const downloaded = await this.fetchImpl(sourceUrl);
      if (!downloaded.ok) {
        throw new Error(
          `Sprite Fusion asset download failed with HTTP ${downloaded.status}.`,
        );
      }
      const bytes = Buffer.from(await downloaded.arrayBuffer());
      const extension = inferSpriteFusionExtension(request, asset, sourceUrl);
      const localPath = join(
        context.outputRoot,
        `${safeFilePart(request.assetId)}-${String(outputIndex + 1).padStart(2, "0")}.${extension}`,
      );
      await writeFile(localPath, bytes);

      outputs.push({
        providerId: this.descriptor.id,
        requestId: request.requestId,
        outputIndex,
        providerAssetId,
        providerRequestId,
        localPath,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        ...(numberValue(asset.width) !== null
          ? { width: numberValue(asset.width)! }
          : {}),
        ...(numberValue(asset.height) !== null
          ? { height: numberValue(asset.height)! }
          : {}),
        sourceUrl,
        metadata: {
          spriteFusionAsset: asset,
          ...(request.operation === "animate" && stringValue(asset.assetUrl)
            ? { previewUrl: stringValue(asset.assetUrl)! }
            : {}),
        },
      });
    }

    return {
      outputs,
      providerRequestId,
      cost: {
        currency: SPRITE_FUSION_CREDIT_CURRENCY,
        amount: reservedCredits,
      },
      metadata: {
        remainingCredits:
          numberValue(asRecord(completed.credits)?.remaining) ?? undefined,
      },
    };
  }

  private async resolveReferenceAsset(
    assetId: string,
    apiKey: string,
  ): Promise<SpriteFusionInput> {
    if (!this.catalog) return { asset_id: assetId };

    const reference = this.catalog.resolve(assetId);
    if (
      reference.generationProvider === this.descriptor.id &&
      reference.providerAssetId
    ) {
      return { asset_id: reference.providerAssetId };
    }
    if (reference.localPath) {
      return this.stageLocalInput(reference.localPath, apiKey);
    }
    throw new Error(
      `Asset ${assetId} cannot be supplied to Sprite Fusion because it has neither a native provider asset id nor a local file.`,
    );
  }

  private async stageLocalInput(
    localPath: string,
    apiKey: string,
  ): Promise<SpriteFusionInput> {
    const bytes = await readFile(localPath);
    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("Sprite Fusion staged input exceeds the 20 MiB limit.");
    }
    const contentType = spriteFusionInputContentType(localPath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const descriptorResponse = await this.fetchImpl(
      `${this.baseUrl}/uploads`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content_type: contentType,
          size_bytes: bytes.byteLength,
          sha256,
        }),
      },
    );
    if (!descriptorResponse.ok) {
      throw new Error(
        `Sprite Fusion upload descriptor request failed with HTTP ${descriptorResponse.status}.`,
      );
    }

    const descriptor = asRecord(
      JSON.parse(await descriptorResponse.text()) as unknown,
    );
    const uploadId = stringValue(descriptor?.upload_id);
    const uploadUrl = stringValue(descriptor?.upload_url);
    const rawHeaders = asRecord(descriptor?.headers);
    if (!uploadId || !uploadUrl || !rawHeaders) {
      throw new Error("Sprite Fusion upload descriptor is incomplete.");
    }
    assertHttpsUrl(uploadUrl);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
      if (typeof value === "string") headers[key] = value;
    }
    const uploaded = await this.fetchImpl(uploadUrl, {
      method: "PUT",
      headers,
      body: bytes,
    });
    if (!uploaded.ok) {
      throw new Error(
        `Sprite Fusion staged upload failed with HTTP ${uploaded.status}.`,
      );
    }
    return { upload_id: uploadId };
  }
}

export async function buildSpriteFusionRequestPayload(
  request: FoundryAssetRequest,
  resolveReference: (
    assetId: string,
  ) => SpriteFusionInput | Promise<SpriteFusionInput> = (assetId) => ({
    asset_id: assetId,
  }),
): Promise<Readonly<Record<string, unknown>>> {
  const operation = mapSpriteFusionOperation(request.operation);
  const references = await Promise.all(
    (request.referenceAssets ?? []).map((assetId) =>
      resolveReference(assetId),
    ),
  );
  const size = spriteFusionSize(request, operation === "generate");

  switch (operation) {
    case "generate":
      requirePrompt(request, 10_000);
      if (references.length > 0) {
        throw new Error("Sprite Fusion generate does not accept input images.");
      }
      return {
        operation,
        prompt: request.prompt,
        size,
      };

    case "edit":
      requirePrompt(request, 10_000);
      requireReferenceCount(references, 1, 9, operation);
      return {
        operation,
        prompt: request.prompt,
        inputs: references,
        ...(size !== undefined ? { size } : {}),
      };

    case "style-reference":
      requirePrompt(request, 10_000);
      requireReferenceCount(references, 1, 20, operation);
      return {
        operation,
        prompt: request.prompt,
        inputs: references,
        ...(size !== undefined ? { size } : {}),
      };

    case "direction-set":
      if (request.prompt?.trim()) {
        throw new Error("Sprite Fusion direction-set does not accept a prompt.");
      }
      requireReferenceCount(references, 1, 1, operation);
      return {
        operation,
        inputs: references,
        ...(size !== undefined ? { size } : {}),
      };

    case "animate": {
      requirePrompt(request, 2_000);
      requireReferenceCount(references, 1, 1, operation);
      const outputFrames = request.animation?.frameCount ?? 8;
      const colors = request.animation?.colorCount ?? 24;
      if (
        !Number.isInteger(outputFrames) ||
        outputFrames < 2 ||
        outputFrames > 16 ||
        outputFrames % 2 !== 0
      ) {
        throw new Error(
          "Sprite Fusion animation frameCount must be an even integer from 2 through 16.",
        );
      }
      if (!Number.isInteger(colors) || colors < 2 || colors > 256) {
        throw new Error(
          "Sprite Fusion animation colorCount must be an integer from 2 through 256.",
        );
      }
      return {
        operation,
        prompt: request.prompt,
        inputs: references,
        output_frames: outputFrames,
        colors,
      };
    }
  }
}

export function parseSpriteFusionSse(text: string): readonly SpriteFusionSseEvent[] {
  const normalized = text.replaceAll("\r\n", "\n");
  const events: SpriteFusionSseEvent[] = [];
  for (const block of normalized.split(/\n\n+/)) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    const parsed = JSON.parse(data) as unknown;
    const record = asRecord(parsed);
    if (!record || typeof record.type !== "string") {
      throw new Error("Sprite Fusion SSE data event is not a valid object.");
    }
    events.push(record as SpriteFusionSseEvent);
  }
  return events;
}

function enforceSpriteFusionBudget(context: FoundryAssetProviderContext): void {
  const budget = context.maxCost;
  if (
    !budget ||
    budget.currency !== SPRITE_FUSION_CREDIT_CURRENCY ||
    budget.amount < SPRITE_FUSION_REQUEST_CREDITS
  ) {
    throw new Error(
      `Sprite Fusion requires a budget of at least ${SPRITE_FUSION_REQUEST_CREDITS} ${SPRITE_FUSION_CREDIT_CURRENCY} before generation.`,
    );
  }
}

function mapSpriteFusionOperation(
  operation: FoundryAssetRequest["operation"],
): "generate" | "edit" | "style-reference" | "direction-set" | "animate" {
  switch (operation) {
    case "generate":
    case "edit":
    case "animate":
      return operation;
    case "style_reference":
      return "style-reference";
    case "direction_set":
      return "direction-set";
    default:
      throw new Error(
        `Asset operation ${operation} is not supported by Sprite Fusion.`,
      );
  }
}

function spriteFusionSize(
  request: FoundryAssetRequest,
  required: boolean,
): 16 | 32 | 64 | undefined {
  if (!request.dimensions) {
    if (required) {
      throw new Error("Sprite Fusion generate requires asset dimensions.");
    }
    return undefined;
  }
  if (request.dimensions.width !== request.dimensions.height) {
    throw new Error("Sprite Fusion requires square pixel-art dimensions.");
  }
  const size = request.dimensions.width;
  if (size !== 16 && size !== 32 && size !== 64) {
    throw new Error("Sprite Fusion size must be 16, 32, or 64.");
  }
  return size;
}

function requirePrompt(request: FoundryAssetRequest, maxLength: number): void {
  const prompt = request.prompt?.trim() ?? "";
  if (!prompt) throw new Error("Sprite Fusion operation requires a prompt.");
  if (prompt.length > maxLength) {
    throw new Error(
      `Sprite Fusion prompt exceeds the ${maxLength}-character limit.`,
    );
  }
}

function requireReferenceCount(
  references: readonly SpriteFusionInput[],
  min: number,
  max: number,
  operation: string,
): void {
  if (references.length < min || references.length > max) {
    const expected = min === max ? `exactly ${min}` : `${min} through ${max}`;
    throw new Error(
      `Sprite Fusion ${operation} requires ${expected} input image(s).`,
    );
  }
}

function selectSpriteFusionDownloadUrl(
  request: FoundryAssetRequest,
  asset: Readonly<Record<string, unknown>>,
): string {
  if (request.operation === "animate") {
    const spritesheet = stringValue(asset.spritesheetUrl);
    if (spritesheet) return spritesheet;
  }
  const assetUrl = stringValue(asset.assetUrl);
  if (!assetUrl) {
    throw new Error("Sprite Fusion output did not include a downloadable URL.");
  }
  return assetUrl;
}

function inferSpriteFusionExtension(
  request: FoundryAssetRequest,
  asset: Readonly<Record<string, unknown>>,
  sourceUrl: string,
): "png" | "jpg" | "webp" {
  if (request.operation === "animate" && stringValue(asset.spritesheetUrl)) {
    return "png";
  }
  const contentType = stringValue(asset.contentType);
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/png") return "png";
  const extension = extname(new URL(sourceUrl).pathname).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "jpg";
  if (extension === ".webp") return "webp";
  return "png";
}

function assertHttpsUrl(value: string): void {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("Sprite Fusion output URL must use HTTPS.");
  }
}

function spriteFusionInputContentType(
  path: string,
): "image/png" | "image/jpeg" | "image/webp" {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  throw new Error(
    "Sprite Fusion staged inputs must be PNG, JPEG, or WebP files.",
  );
}

function safeFilePart(value: string): string {
  const clean = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "asset";
}

function singleEvent(
  events: readonly SpriteFusionSseEvent[],
  type: string,
): SpriteFusionSseEvent | undefined {
  const matches = events.filter((event) => event.type === type);
  if (matches.length > 1) {
    throw new Error(`Sprite Fusion stream contained multiple ${type} events.`);
  }
  return matches[0];
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

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "unknown error";
  }
}

const defaultSpriteFusionFetch: SpriteFusionFetch = async (url, init) => {
  const response = await fetch(url, {
    ...(init?.method ? { method: init.method } : {}),
    ...(init?.headers ? { headers: { ...init.headers } } : {}),
    ...(init?.body !== undefined
      ? {
          body:
            typeof init.body === "string"
              ? init.body
              : Buffer.from(init.body),
        }
      : {}),
  });
  return response;
};
