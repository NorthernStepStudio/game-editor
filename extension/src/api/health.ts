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

    let mode: NssServerHealth["mode"];
    let detail = "Backend health endpoint responded.";

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body) {
        try {
          const parsed = JSON.parse(response.body);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.mode === "string") {
              mode = parsed.mode as NssServerHealth["mode"];
            }
            if (typeof parsed.detail === "string") {
              detail = parsed.detail;
            } else {
              detail = response.body;
            }
          } else {
            detail = response.body;
          }
        } catch {
          detail = response.body;
        }
      }
    } else {
      detail = `Backend responded on /health with status ${response.statusCode}.`;
    }

    return {
      status: "online",
      mode,
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
