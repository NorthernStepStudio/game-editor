/**
 * Low-level client for the Flyrail daemon.
 *
 * Uses:
 * - HTTP GET `/health` for availability checks (no auth required).
 * - WebSocket JSON-RPC 2.0 for all operational calls (token auth).
 *
 * The client auto-discovers the daemon from:
 *   1. Explicit constructor options.
 *   2. FLYRAIL_DAEMON_URL / FLYRAIL_DAEMON_TOKEN env vars.
 *   3. .flyrail-daemon.json on disk.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SpecialistError } from "../types.js";
import { fromJsonRpcError, fromTransportError } from "./flyrailErrors.js";

// ── Types ───────────────────────────────────────────────────────────

export interface FlyrailClientOptions {
  /** WebSocket URL, e.g. ws://127.0.0.1:7520?token=abc */
  daemonUrl?: string;
  /** HTTP base URL for health checks, e.g. http://127.0.0.1:7520 */
  httpBaseUrl?: string;
  /** Auth token. */
  token?: string;
  /** Connection timeout (ms). */
  connectTimeoutMs?: number;
  /** Per-request timeout (ms). */
  requestTimeoutMs?: number;
  /** Paths to search for .flyrail-daemon.json */
  discoveryPaths?: readonly string[];
}

export interface FlyrailHealthResponse {
  ok: boolean;
  product: string;
  protocolVersion: string;
  phase: number;
  bridge: string;
  runtime: string;
  panel: boolean;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface DaemonConfig {
  host: string;
  port: number;
  token: string;
  url: string;
}

// ── Discovery ───────────────────────────────────────────────────────

function discoverDaemon(
  searchPaths: readonly string[],
): DaemonConfig | null {
  for (const base of searchPaths) {
    const configPath = join(base, ".flyrail-daemon.json");
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, "utf8");
        return JSON.parse(raw) as DaemonConfig;
      } catch {
        // Ignore parse failures, keep searching.
      }
    }
  }
  return null;
}

// ── Client ──────────────────────────────────────────────────────────

export class FlyrailClient {
  private readonly httpBaseUrl: string;
  private readonly wsUrl: string;
  private readonly token: string;
  private readonly connectTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<string | number, PendingRequest>();
  private connected = false;

  constructor(options: FlyrailClientOptions = {}) {
    const defaultPaths = [
      process.env.FLYRAIL_REPO_ROOT ?? "",
      join(process.cwd(), ".."),
      "d:\\dev\\Northern Step Studio\\apps\\flyrail",
    ].filter(Boolean);

    const envUrl = process.env.FLYRAIL_DAEMON_URL;
    const envToken = process.env.FLYRAIL_DAEMON_TOKEN;
    const discovered = discoverDaemon(options.discoveryPaths ?? defaultPaths);

    const wsUrl = options.daemonUrl ?? envUrl ?? discovered?.url ?? "ws://127.0.0.1:7520";
    this.token = options.token ?? envToken ?? discovered?.token ?? "";

    // Ensure the token is in the URL query string
    const parsed = new URL(wsUrl);
    if (!["ws:", "wss:"].includes(parsed.protocol)) throw new Error("Invalid daemon URL protocol");
    if (this.token) {
      parsed.searchParams.set("token", this.token);
    }
    this.wsUrl = parsed.toString();

    const host = parsed.hostname;
    const port = parsed.port || "7520";
    this.httpBaseUrl = options.httpBaseUrl ?? `${parsed.protocol === "wss:" ? "https" : "http"}://${host}:${port}`;

    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 120_000;
  }

  // ── Health (HTTP) ───────────────────────────────────────────────

  async health(): Promise<FlyrailHealthResponse> {
    const url = `${this.httpBaseUrl}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.connectTimeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new SpecialistError("SPECIALIST_UNAVAILABLE", `Health check returned ${res.status}`);
      }
      return (await res.json()) as FlyrailHealthResponse;
    } catch (error) {
      if (error instanceof SpecialistError) throw error;
      throw fromTransportError(error);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── WebSocket connection ──────────────────────────────────────

  private connecting: Promise<void> | null = null;
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.wsUrl);
      const timer = setTimeout(() => { socket.close(); reject(new SpecialistError("TIMEOUT", "Connection timeout")); }, this.connectTimeoutMs);
      socket.onopen = () => { clearTimeout(timer); this.connected = true; resolve(); };
      socket.onmessage = event => this.handleMessage(String(event.data));
      socket.onerror = () => { clearTimeout(timer); this.connected = false; reject(new SpecialistError("TRANSPORT_ERROR", "Daemon connection failed")); this.rejectAllPending("Connection error"); };
      socket.onclose = () => { clearTimeout(timer); this.connected = false; reject(new SpecialistError("TRANSPORT_ERROR", "Connection closed")); this.rejectAllPending("Connection closed"); };
      this.socket = socket;
    });
    try { await this.connecting; } finally { this.connecting = null; }
  }

  // ── JSON-RPC call ─────────────────────────────────────────────

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.connected || !this.socket) {
      await this.connect();
    }

    const id = this.nextId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new SpecialistError("TIMEOUT", `Request ${method} timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try { this.socket!.send(payload); } catch { clearTimeout(timer); this.pending.delete(id); reject(new SpecialistError("TRANSPORT_ERROR", "Send failed")); }
    });
  }

  // ── Disconnect ────────────────────────────────────────────────

  disconnect(): void {
    this.rejectAllPending("Disconnected by client");
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Internals ─────────────────────────────────────────────────

  private handleMessage(text: string): void {
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(text) as JsonRpcResponse;
    } catch {
      return; // Ignore unparseable frames (like daemon.hello notifications).
    }

    // Notifications (no id) are ignored for now.
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || msg.id === undefined || msg.id === null) return;

    const entry = this.pending.get(msg.id);
    if (!entry) return;

    this.pending.delete(msg.id);
    clearTimeout(entry.timer);

    if (msg.error) {
      entry.reject(fromJsonRpcError(msg.error.code, msg.error.message, msg.error.data));
    } else {
      entry.resolve(msg.result);
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new SpecialistError("TRANSPORT_ERROR", reason));
    }
    this.pending.clear();
  }

}
