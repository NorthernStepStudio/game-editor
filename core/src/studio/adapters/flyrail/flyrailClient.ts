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

  private ws: import("node:http").IncomingMessage | null = null;
  private socket: { send(data: string): void; close(): void; readyState: number; onmessage: ((ev: { data: unknown }) => void) | null; onclose: (() => void) | null; onerror: ((ev: unknown) => void) | null } | null = null;
  private nextId = 1;
  private readonly pending = new Map<string | number, PendingRequest>();
  private connected = false;
  private helloReceived = false;

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
    if (!parsed.searchParams.has("token") && this.token) {
      parsed.searchParams.set("token", this.token);
    }
    this.wsUrl = parsed.toString();

    const host = parsed.hostname;
    const port = parsed.port || "7520";
    this.httpBaseUrl = options.httpBaseUrl ?? `http://${host}:${port}`;

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

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SpecialistError("SPECIALIST_UNAVAILABLE", "Connection timeout"));
      }, this.connectTimeoutMs);

      // Use dynamic import so the module works in environments without ws
      const http = require("node:http") as typeof import("node:http");
      const { URL: UrlCls } = require("node:url") as typeof import("node:url");
      const targetUrl = new UrlCls(this.wsUrl.replace(/^ws:/, "http:"));

      const req = http.get(
        {
          hostname: targetUrl.hostname,
          port: targetUrl.port,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Version": "13",
            "Sec-WebSocket-Key": Buffer.from(
              Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)),
            ).toString("base64"),
          },
        },
        () => {
          clearTimeout(timer);
          reject(new SpecialistError("TRANSPORT_ERROR", "Expected upgrade, got HTTP response"));
        },
      );

      req.on("upgrade", (_res, rawSocket, _head) => {
        clearTimeout(timer);
        this.connected = true;

        // Minimal WebSocket framing helpers — we only need text frames.
        const sock = this.createMinimalWs(rawSocket);
        this.socket = sock;

        sock.onmessage = (ev) => {
          this.handleMessage(String(ev.data));
        };
        sock.onclose = () => {
          this.connected = false;
          this.rejectAllPending("Connection closed");
        };
        sock.onerror = () => {
          this.connected = false;
          this.rejectAllPending("Connection error");
        };

        // Wait briefly for daemon.hello
        const helloTimer = setTimeout(() => {
          // Hello is optional — resolve anyway.
          resolve();
        }, 2_000);

        const origOnMessage = sock.onmessage;
        sock.onmessage = (ev) => {
          const text = String(ev.data);
          try {
            const parsed = JSON.parse(text);
            if (parsed?.method === "daemon.hello") {
              this.helloReceived = true;
              clearTimeout(helloTimer);
              sock.onmessage = origOnMessage;
              resolve();
              return;
            }
          } catch {
            // Not JSON, ignore.
          }
          origOnMessage?.(ev);
        };
      });

      req.on("error", (err) => {
        clearTimeout(timer);
        reject(fromTransportError(err));
      });

      req.end();
    });
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
      this.socket!.send(payload);
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
    if (msg.id === undefined || msg.id === null) return;

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

  /**
   * Create a minimal text-only WebSocket wrapper over a raw TCP socket.
   *
   * This avoids adding `ws` as a dependency.  We only need to send and
   * receive UTF-8 text frames — Flyrail's daemon protocol is pure JSON.
   */
  private createMinimalWs(rawSocket: import("node:net").Socket) {
    let onmessage: ((ev: { data: unknown }) => void) | null = null;
    let onclose: (() => void) | null = null;
    let onerror: ((ev: unknown) => void) | null = null;
    let buffer = Buffer.alloc(0);

    const parseFrames = () => {
      while (buffer.length >= 2) {
        const firstByte = buffer[0]!;
        const secondByte = buffer[1]!;
        const opcode = firstByte & 0x0f;
        const masked = (secondByte & 0x80) !== 0;
        let payloadLength = secondByte & 0x7f;
        let offset = 2;

        if (payloadLength === 126) {
          if (buffer.length < 4) return;
          payloadLength = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLength === 127) {
          if (buffer.length < 10) return;
          payloadLength = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        if (masked) offset += 4;
        if (buffer.length < offset + payloadLength) return;

        let payload = buffer.subarray(offset, offset + payloadLength);
        if (masked) {
          const mask = buffer.subarray(offset - 4, offset);
          payload = Buffer.from(payload);
          for (let i = 0; i < payload.length; i++) {
            payload[i] = payload[i]! ^ mask[i % 4]!;
          }
        }

        buffer = buffer.subarray(offset + payloadLength);

        if (opcode === 0x01) {
          // Text frame
          onmessage?.({ data: payload.toString("utf8") });
        } else if (opcode === 0x08) {
          // Close frame
          rawSocket.end();
          onclose?.();
          return;
        } else if (opcode === 0x09) {
          // Ping → send pong
          const pong = Buffer.alloc(2);
          pong[0] = 0x8a; // FIN + pong
          pong[1] = 0;
          rawSocket.write(pong);
        }
        // Ignore other opcodes (pong, continuation, binary).
      }
    };

    rawSocket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      parseFrames();
    });
    rawSocket.on("close", () => onclose?.());
    rawSocket.on("error", (err) => onerror?.(err));

    const sendFrame = (text: string) => {
      const data = Buffer.from(text, "utf8");
      const mask = Buffer.from([
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);

      let header: Buffer;
      if (data.length < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // FIN + text
        header[1] = 0x80 | data.length; // Masked
      } else if (data.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(data.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(data.length), 2);
      }

      const masked = Buffer.from(data);
      for (let i = 0; i < masked.length; i++) {
        masked[i] = masked[i]! ^ mask[i % 4]!;
      }

      rawSocket.write(Buffer.concat([header, mask, masked]));
    };

    const close = () => {
      const frame = Buffer.alloc(6);
      frame[0] = 0x88; // FIN + close
      frame[1] = 0x80; // Masked, 0-length payload
      // 4 bytes of mask (all zeros is fine for close)
      rawSocket.write(frame);
      rawSocket.end();
    };

    return {
      send: sendFrame,
      close,
      get readyState() {
        return rawSocket.destroyed ? 3 : 1;
      },
      get onmessage() {
        return onmessage;
      },
      set onmessage(fn) {
        onmessage = fn;
      },
      get onclose() {
        return onclose;
      },
      set onclose(fn) {
        onclose = fn;
      },
      get onerror() {
        return onerror;
      },
      set onerror(fn) {
        onerror = fn;
      },
    };
  }
}
