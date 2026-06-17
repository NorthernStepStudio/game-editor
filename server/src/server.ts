import * as http from "node:http";

import { describeProvider, getServerConfig, type NssWorkspaceAiServerConfig } from "./config/env.js";
import { resolveDefaultPortStateFilePath, writePortStateFile } from "./config/portState.js";
import type { NssAskRequestPayload, NssHealthResponse } from "./models/contracts.js";
import { handleAskRequest } from "./services/askService.js";

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
  const host = "127.0.0.1";
  const portStateFilePath =
    options.portStateFilePath === false ? undefined : options.portStateFilePath ?? resolveDefaultPortStateFilePath();
  const server = http.createServer(async (request, response) => {
    try {
      setCommonHeaders(response);

      if (request.method === "GET" && request.url === "/health") {
        await respondJson(response, 200, createHealthResponse(config));
        return;
      }

      if (request.method === "POST" && request.url === "/ask") {
        const payload = (await readJsonBody(request)) as NssAskRequestPayload;
        const answer = await handleAskRequest(config, payload);
        await respondJson(response, 200, answer);
        return;
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
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
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

  await new Promise<void>((resolve, reject) => {
    request.on("data", (chunk) => {
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

function setCommonHeaders(response: http.ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
