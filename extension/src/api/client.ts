import * as http from "node:http";
import * as https from "node:https";

import type { NssAskRequestPayload, NssAskResponse } from "../models/api.types.js";

export interface WorkspaceAiClientConfig {
  readonly serverUrl: string;
}

export async function postAskRequest(
  config: WorkspaceAiClientConfig,
  payload: NssAskRequestPayload,
): Promise<NssAskResponse> {
  const url = new URL("/ask", ensureTrailingSlash(config.serverUrl));
  const body = JSON.stringify(payload);
  const transport = url.protocol === "https:" ? https : http;

  const response = await new Promise<{ statusCode: number; body: string; contentType: string }>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (result) => {
        const chunks: Buffer[] = [];
        result.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        result.on("end", () => {
          resolve({
            statusCode: result.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            contentType: String(result.headers["content-type"] ?? ""),
          });
        });
      },
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Backend request failed (${response.statusCode}): ${response.body || "No response body."}`);
  }

  return normalizeAskResponse(response.body, response.contentType);
}

function normalizeAskResponse(body: string, contentType: string): NssAskResponse {
  const parsed = tryParseJson(body, contentType);
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const proposedText = firstString(record, [
      "proposedText",
      "fileContent",
      "updatedFileContent",
      "replacement",
      "newFileContent",
    ]);
    const proposedMemories = parseProposedMemories(record.proposedMemories);
    const responseText =
      firstString(record, ["response", "answer", "text", "message", "content", "body", "output", "result"]) ??
      firstString(record, ["preview", "summary"]) ??
      body;

    return {
      title: firstString(record, ["title"]),
      response: responseText,
      proposedText,
      preview: firstString(record, ["preview", "summary"]),
      proposedMemories,
    };
  }

  return { response: body };
}

function tryParseJson(body: string, contentType: string): unknown {
  if (!body.trim()) {
    return undefined;
  }

  if (!contentType.includes("json") && !body.trimStart().startsWith("{")) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function parseProposedMemories(value: unknown): NssAskResponse["proposedMemories"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  type ParsedProposedMemory = {
    readonly content: string;
    readonly tags: string[];
  };

  const memories = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const record = item as Record<string, unknown>;
      const content = firstString(record, ["content"]);
      const tags = Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
        : [];

      if (!content) {
        return undefined;
      }

      return {
        content,
        tags,
      };
    })
    .filter((memory): memory is ParsedProposedMemory => Boolean(memory));

  return memories.length > 0 ? memories : undefined;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
