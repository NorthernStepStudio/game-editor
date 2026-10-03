import type {
  MatterhornBrowserAdapter,
  MatterhornBrowserTab,
  MatterhornRuntimeHealth,
} from "./runtimeCapabilities.js";

export interface MatterhornLocalBrowserOptions {
  readonly baseUrl?: string;
  readonly requestTimeoutMs?: number;
  readonly maxResponseBytes?: number;
}

interface BrowserHarnessHealth {
  readonly ok?: boolean;
  readonly connected?: boolean;
}

function assertLoopbackBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:") throw new Error("Matterhorn local browser bridge must use HTTP on loopback.");
  const host = url.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("Matterhorn local browser bridge must bind to loopback.");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function validTargetId(value: string): boolean {
  return value.length > 0 && value.length <= 512 && !/[\r\n]/.test(value);
}

/**
 * Matterhorn-branded local browser adapter.
 *
 * The implementation speaks to a local CDP bridge over its tiny HTTP surface
 * (/health and /eval). Matterhorn owns the public capability contract and user
 * experience; upstream engine identity remains internal attribution only.
 */
export class MatterhornLocalBrowserAdapter implements MatterhornBrowserAdapter {
  readonly id = "matterhorn.local-browser";
  readonly capability = "browser-control" as const;
  readonly attribution = {
    sourceProject: "Browser Harness JS",
    sourceUrl: "https://github.com/browser-use/browser-harness-js",
    license: "MIT",
  } as const;

  private readonly baseUrl: URL;
  private readonly requestTimeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: MatterhornLocalBrowserOptions = {}) {
    this.baseUrl = assertLoopbackBaseUrl(options.baseUrl ?? "http://127.0.0.1:9876/");
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 16 * 1024 * 1024;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs < 100 || this.requestTimeoutMs > 120_000) {
      throw new Error("Invalid Matterhorn local browser request timeout.");
    }
    if (!Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1024 || this.maxResponseBytes > 64 * 1024 * 1024) {
      throw new Error("Invalid Matterhorn local browser response limit.");
    }
  }

  async health(): Promise<MatterhornRuntimeHealth> {
    try {
      const raw = await this.request("health", { method: "GET" });
      const parsed = JSON.parse(raw) as BrowserHarnessHealth;
      if (!parsed.ok) return { state: "degraded", diagnosticDetail: "Local browser bridge is responding but not healthy." };
      return {
        state: parsed.connected === false ? "degraded" : "ready",
        diagnosticDetail: parsed.connected === false
          ? "Local browser bridge is running but is not attached to a browser."
          : "Local browser bridge is ready.",
      };
    } catch (error) {
      return {
        state: "unavailable",
        diagnosticDetail: error instanceof Error ? error.message : "Local browser bridge is unavailable.",
      };
    }
  }

  async connect(): Promise<void> {
    await this.evaluate("await session.connect(); return true;");
  }

  async listTabs(): Promise<readonly MatterhornBrowserTab[]> {
    const raw = await this.evaluate("return await listPageTargets();");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Matterhorn local browser returned an invalid tab list.");
    }
    if (!Array.isArray(parsed)) throw new Error("Matterhorn local browser returned an invalid tab list.");
    return parsed.map((entry): MatterhornBrowserTab => {
      if (!entry || typeof entry !== "object") throw new Error("Matterhorn local browser returned an invalid tab entry.");
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.targetId !== "string" || !validTargetId(candidate.targetId)) {
        throw new Error("Matterhorn local browser returned an invalid tab id.");
      }
      return {
        targetId: candidate.targetId,
        ...(typeof candidate.title === "string" ? { title: candidate.title } : {}),
        ...(typeof candidate.url === "string" ? { url: candidate.url } : {}),
        ...(typeof candidate.type === "string" ? { type: candidate.type } : {}),
      };
    });
  }

  async useTab(targetId: string): Promise<void> {
    if (!validTargetId(targetId)) throw new Error("Invalid browser tab id.");
    await this.evaluate(`await session.use(${JSON.stringify(targetId)}); return true;`);
  }

  async navigate(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid browser navigation URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Matterhorn local browser only navigates to HTTP or HTTPS URLs.");
    }
    await this.evaluate(`await session.Page.enable(); await session.Page.navigate({url:${JSON.stringify(parsed.toString())}}); return true;`);
  }

  async getTitle(): Promise<string> {
    return this.evaluate(
      'return String((await session.Runtime.evaluate({expression:"document.title",returnByValue:true})).result.value ?? "");',
    );
  }

  async captureScreenshot(): Promise<string> {
    const value = await this.evaluate(
      'return (await session.Page.captureScreenshot({format:"png",fromSurface:true})).data;',
    );
    if (!/^[A-Za-z0-9+/=]*$/.test(value)) throw new Error("Matterhorn local browser returned an invalid screenshot payload.");
    return value;
  }

  private async evaluate(script: string): Promise<string> {
    if (!script.trim() || Buffer.byteLength(script, "utf8") > 64 * 1024) {
      throw new Error("Matterhorn local browser command is empty or too large.");
    }
    return this.request("eval", {
      method: "POST",
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: script,
    });
  }

  private async request(path: string, init: RequestInit): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(new URL(path, this.baseUrl), { ...init, signal: controller.signal });
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > this.maxResponseBytes) {
        throw new Error("Matterhorn local browser response exceeded the configured limit.");
      }
      if (!response.ok) {
        throw new Error(`Matterhorn local browser command failed with HTTP ${response.status}.`);
      }
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Matterhorn local browser request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
