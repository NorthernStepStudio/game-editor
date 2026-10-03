import { createHash } from "node:crypto";
import type { StudioRunEvent } from "../studio/run/types.js";
import type { MatterhornRuntimeHealth, MatterhornTelemetryAdapter } from "./runtimeCapabilities.js";

export interface MatterhornOtlpRunInsightsOptions {
  readonly endpoint: string;
  readonly authorization?: string;
  readonly requestTimeoutMs?: number;
  readonly serviceVersion?: string;
  readonly langfuseRealtime?: boolean;
}

interface OtlpAttribute {
  readonly key: string;
  readonly value: { readonly stringValue?: string; readonly boolValue?: boolean; readonly intValue?: string };
}

function safeEndpoint(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Run Insights endpoint must use HTTP or HTTPS.");
  const host = url.hostname.toLowerCase();
  const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  if (url.protocol === "http:" && !loopback) {
    throw new Error("Run Insights requires HTTPS for non-loopback endpoints.");
  }
  return url;
}

function hexHash(value: string, length: number): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function nanoTime(iso: string, offsetNs = 0n): string {
  const ms = new Date(iso).valueOf();
  if (!Number.isFinite(ms)) throw new Error("Studio event timestamp is invalid.");
  return (BigInt(Math.trunc(ms)) * 1_000_000n + offsetNs).toString();
}

function stringAttr(key: string, value: string | undefined, max = 2_000): OtlpAttribute | undefined {
  if (!value) return undefined;
  return { key, value: { stringValue: value.slice(0, max) } };
}

function attributes(event: StudioRunEvent): OtlpAttribute[] {
  return [
    stringAttr("matterhorn.run.id", event.runId, 200),
    stringAttr("matterhorn.event.kind", event.kind, 200),
    stringAttr("matterhorn.task.id", event.taskId, 200),
    stringAttr("matterhorn.detail", event.detail, 2_000),
  ].filter((value): value is OtlpAttribute => Boolean(value));
}

/**
 * Matterhorn Run Insights exporter using the standard OTLP/HTTP JSON protocol.
 *
 * There is intentionally no Langfuse SDK dependency here. A user may point
 * this at self-hosted Langfuse, an OpenTelemetry collector, or another OTLP
 * backend without changing Matterhorn's event model or product identity.
 */
export class MatterhornOtlpRunInsightsAdapter implements MatterhornTelemetryAdapter {
  readonly id = "matterhorn.run-insights.otlp";
  readonly capability = "telemetry" as const;
  readonly attribution = {
    sourceProject: "OpenTelemetry OTLP",
    sourceUrl: "https://opentelemetry.io/docs/specs/otlp/",
    license: "Specification / protocol integration",
  } as const;

  private readonly endpoint: URL;
  private readonly authorization?: string;
  private readonly requestTimeoutMs: number;
  private readonly serviceVersion: string;
  private readonly langfuseRealtime: boolean;
  private eventSequence = 0;
  private lastFailure?: string;
  private lastSuccessAt?: string;

  constructor(options: MatterhornOtlpRunInsightsOptions) {
    this.endpoint = safeEndpoint(options.endpoint);
    this.authorization = options.authorization?.trim() || undefined;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.serviceVersion = options.serviceVersion?.trim() || "0.1.0";
    this.langfuseRealtime = options.langfuseRealtime ?? this.endpoint.pathname.includes("/api/public/otel/");
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs < 100 || this.requestTimeoutMs > 120_000) {
      throw new Error("Invalid Matterhorn Run Insights timeout.");
    }
    if (this.authorization && /[\r\n]/.test(this.authorization)) {
      throw new Error("Invalid Matterhorn Run Insights authorization header.");
    }
  }

  async health(): Promise<MatterhornRuntimeHealth> {
    if (this.lastFailure) {
      return { state: "degraded", diagnosticDetail: `Run Insights delivery most recently failed: ${this.lastFailure}` };
    }
    return {
      state: "ready",
      diagnosticDetail: this.lastSuccessAt
        ? `Run Insights delivered telemetry successfully at ${this.lastSuccessAt}.`
        : "Run Insights is configured; delivery will be verified on the next Studio event.",
    };
  }

  async recordStudioEvent(event: StudioRunEvent): Promise<void> {
    const sequence = ++this.eventSequence;
    const traceId = hexHash(`matterhorn-run:${event.runId}`, 32);
    const spanId = hexHash(
      `matterhorn-event:${event.runId}:${event.timestamp}:${event.kind}:${event.taskId ?? ""}:${sequence}`,
      16,
    );
    const start = nanoTime(event.timestamp, BigInt(sequence));
    const end = (BigInt(start) + 1_000_000n).toString();

    const body = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "matterhorn" } },
            { key: "service.namespace", value: { stringValue: "northern-step-studio" } },
            { key: "service.version", value: { stringValue: this.serviceVersion } },
          ],
        },
        scopeSpans: [{
          scope: {
            name: "northern-step.matterhorn.run-insights",
            version: this.serviceVersion,
          },
          spans: [{
            traceId,
            spanId,
            name: event.kind,
            kind: 1,
            startTimeUnixNano: start,
            endTimeUnixNano: end,
            attributes: attributes(event),
            status: {},
          }],
        }],
      }],
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.authorization) headers.authorization = this.authorization;
    if (this.langfuseRealtime) headers["x-langfuse-ingestion-version"] = "4";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.lastFailure = undefined;
      this.lastSuccessAt = new Date().toISOString();
    } catch (error) {
      this.lastFailure = error instanceof Error
        ? (error.name === "AbortError" ? "request timed out" : error.message.slice(0, 500))
        : "unknown delivery error";
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
