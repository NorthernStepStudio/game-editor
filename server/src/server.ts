import { createWorkspaceRoutes } from "./workspace/routes.js";
import { createStudioService } from "./services/studioService.js";
import { studioRoutes } from "./services/studioRoutes.js";
import { foundryRoutes } from "./services/foundryRoutes.js";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

import { describeProvider, getAvailableProviders, getServerConfig, type NssWorkspaceAiServerConfig } from "./config/env.js";
import { resolveDefaultPortStateFilePath, writePortStateFile } from "./config/portState.js";
import type { NssAskRequestPayload, NssHealthResponse } from "./models/contracts.js";
import { handleAskRequest, streamAskRequest } from "./services/askService.js";

const WEB_DIR = fs.existsSync(path.resolve(__dirname, "../../web"))
  ? path.resolve(__dirname, "../../web")
  : path.resolve(process.cwd(), "web");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function serveStaticFile(response: http.ServerResponse, filePath: string): boolean {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext];
  if (!mime) return false;

  try {
    const data = fs.readFileSync(filePath);
    response.statusCode = 200;
    response.setHeader("Content-Type", mime);
    response.end(data);
    return true;
  } catch {
    return false;
  }
}

export interface StartedNssServer {
  readonly server: http.Server;
  readonly port: number;
  close(): Promise<void>;
}

export async function startNssWorkspaceAiServer(
  overrides: Partial<NssWorkspaceAiServerConfig> = {},
  options: { readonly portStateFilePath?: string | false } = {},
): Promise<StartedNssServer> {
  const config = {
    ...getServerConfig(),
    ...overrides,
  };
  const host = process.env.SERVER_HOST ?? "127.0.0.1";
  const portStateFilePath =
    options.portStateFilePath === false ? undefined : options.portStateFilePath ?? resolveDefaultPortStateFilePath();
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("Matterhorn standalone must bind to loopback.");
  const studio = createStudioService();
  const workspaceRoutes = createWorkspaceRoutes(studio, config);
  const server = http.createServer(async (request, response) => {
    try {
      setCommonHeaders(response);
      const hostHeader = request.headers.host ?? "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::[0-9]+)?$/.test(hostHeader) || (request.headers.origin && request.headers.origin !== `http://${hostHeader}`) || request.headers['sec-fetch-site'] === 'cross-site') {
        await respondJson(response, 403, { error: "Only same-origin local requests are accepted." }); return;
      }
      if (request.method === 'POST' && !request.headers['content-type']?.startsWith('application/json')) {
        await respondJson(response, 415, { error: "Content-Type must be application/json." }); return;
      }
      if (await workspaceRoutes(request, response, () => readJsonBody(request))) return;
      if (await foundryRoutes(request, response, studio)) return;
      if (await studioRoutes(request, response, studio, () => readJsonBody(request))) return;

      if (request.method === "GET" && request.url === "/health") {
        await respondJson(response, 200, createHealthResponse(config));
        return;
      }

      if (request.method === "GET" && request.url === "/providers") {
        await respondJson(response, 200, getAvailableProviders(config));
        return;
      }

      if (request.method === "POST" && request.url === "/ask") {
        const acceptHeader = request.headers["accept"] ?? "";
        const wantsStream = acceptHeader.includes("text/event-stream");
        const rawBody = await readJsonBody(request);
        const providerOverride =
          typeof (rawBody as { _provider?: string })._provider === "string"
            ? (rawBody as { _provider: string })._provider
            : undefined;
        const modelOverride =
          typeof (rawBody as { _model?: string })._model === "string"
            ? (rawBody as { _model: string })._model
            : undefined;
        const payload = rawBody as NssAskRequestPayload;

        if (wantsStream) {
          await handleStreamRequest(config, payload, response, providerOverride, modelOverride);
        } else {
          const answer = await handleAskRequest(config, payload, providerOverride, modelOverride);
          await respondJson(response, 200, answer);
        }
        return;
      }

      if (request.method === "GET") {
        const urlPath = request.url?.split("?")[0] ?? "/";
        const filePath = path.resolve(WEB_DIR, urlPath === "/" ? "index.html" : `.${decodeURIComponent(urlPath)}`);
        if (!filePath.startsWith(WEB_DIR + path.sep)) { await respondJson(response, 403, { error: "Invalid static path." }); return; }
        if (serveStaticFile(response, filePath)) {
          return;
        }
      }

      await respondJson(response, 404, {
        error: "Not found.",
      });
    } catch (error) {
      await respondJson(response, 400, {
        error: error instanceof Error ? error.message : "Request failed.",
      });
    }
  });

  const port = await listenOnAvailablePort(server, config.port, host);

  if (portStateFilePath) {
    await writePortStateFile(portStateFilePath, port);
  }

  return {
    server,
    port,
    close: () => { studio.dispose(); studio.adapter.disconnect(); server.closeAllConnections(); return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }); },
  };
}

function createHealthResponse(config: NssWorkspaceAiServerConfig): NssHealthResponse {
  return {
    status: "ok",
    mode: config.mCore.providerMode,
    detail: describeProvider(config),
    checkedAt: new Date().toISOString(),
  };
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  await new Promise<void>((resolve, reject) => {
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 65536) { reject(new Error("Request exceeds 64 KiB.")); return; }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => resolve());
    request.on("error", reject);
  });

  const body = Buffer.concat(chunks).toString("utf8").trim();
  if (!body) {
    throw new Error("Request body is empty.");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function respondJson(response: http.ServerResponse, statusCode: number, payload: unknown): Promise<void> {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function handleStreamRequest(
  config: NssWorkspaceAiServerConfig,
  payload: NssAskRequestPayload,
  response: http.ServerResponse,
  providerOverride?: string,
  modelOverride?: string,
): Promise<void> {
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.statusCode = 200;
  response.flushHeaders?.();

  try {
    for await (const token of streamAskRequest(config, payload, providerOverride, modelOverride)) {
      response.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    response.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream failed.";
    response.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    response.end();
  }
}

function setCommonHeaders(response: http.ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

async function listenOnAvailablePort(server: http.Server, requestedPort: number, host: string): Promise<number> {
  try {
    return await listenOnPort(server, requestedPort, host);
  } catch (error) {
    if (isAddressInUseError(error) && requestedPort !== 0) {
      try {
        return await listenOnPort(server, 0, host);
      } catch (fallbackError) {
        throw createListenError(requestedPort, host, fallbackError, true);
      }
    }

    throw createListenError(requestedPort, host, error, false);
  }
}

async function listenOnPort(server: http.Server, port: number, host: string): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine Matterhorn server port.");
  }

  return address.port;
}

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EADDRINUSE";
}

function createListenError(port: number, host: string, error: unknown, fallbackAttempted: boolean): Error {
  if (isAddressInUseError(error)) {
    const detail = fallbackAttempted
      ? `Matterhorn could not start because ${host}:${port} is already in use and no free fallback port was available.`
      : `Matterhorn could not start because ${host}:${port} is already in use. Another server may already be running.`;

    return new Error(detail, { cause: error });
  }

  const message = error instanceof Error ? error.message : "Unknown listen failure.";
  const prefix = fallbackAttempted
    ? `Matterhorn could not start after falling back from ${host}:${port}`
    : `Matterhorn could not start on ${host}:${port}`;

  return new Error(`${prefix}: ${message}`, { cause: error instanceof Error ? error : undefined });
}

