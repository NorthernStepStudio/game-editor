import * as http from "node:http";
import * as https from "node:https";

import type { NssServerHealth } from "../models/api.types.js";

export interface HealthResponse {
  readonly status: string;
}

export async function probeServerHealth(serverUrl: string): Promise<NssServerHealth> {
  const url = new URL("/health", ensureTrailingSlash(serverUrl));
  const transport = url.protocol === "https:" ? https : http;

  try {
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method: "GET",
        },
        (result) => {
          const chunks: Buffer[] = [];
          result.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          result.on("end", () => {
            resolve({
              statusCode: result.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8").trim(),
            });
          });
        },
      );

      request.setTimeout(3_000, () => {
        request.destroy(new Error("Health probe timed out."));
      });
      request.on("error", reject);
      request.end();
    });

    const detail =
      response.statusCode >= 200 && response.statusCode < 300
        ? response.body || "Backend health endpoint responded."
        : `Backend responded on /health with status ${response.statusCode}.`;

    return {
      status: "online",
      detail,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "offline",
      detail: error instanceof Error ? error.message : "Backend health probe failed.",
      checkedAt: new Date().toISOString(),
    };
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
