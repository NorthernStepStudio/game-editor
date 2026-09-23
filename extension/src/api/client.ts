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
    const toolCalls = parseToolCallsFromRecord(record);
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
      toolCalls,
    };
  }

  return { response: body };
}

function parseToolCallsFromRecord(record: Record<string, unknown>): NssAskResponse["toolCalls"] | undefined {
  return (
    parseToolCalls(record.toolCalls) ??
    parseToolCalls(record.tool_calls) ??
    parseToolCalls(record.toolCall) ??
    parseToolCalls(record.tool_call) ??
    parseToolCalls(record.tools) ??
    parseToolCalls([record])
  );
}

function parseToolCalls(value: unknown): NssAskResponse["toolCalls"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const toolCalls: Array<NonNullable<NssAskResponse["toolCalls"]>[number]> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const nestedFunction = record.function && typeof record.function === "object"
      ? (record.function as Record<string, unknown>)
      : undefined;
    const name = record.name ?? record.tool ?? record.toolName ?? nestedFunction?.name;
    if (!isToolName(name)) {
      continue;
    }

    const args = parseToolArgs(record, nestedFunction);

    toolCalls.push(args ? { name, args } : { name });
  }

  return toolCalls.length > 0 ? toolCalls : undefined;
}

function parseToolArgs(
  record: Record<string, unknown>,
  nestedFunction: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const directArgs =
    record.args ??
    record.arguments ??
    record.input ??
    record.parameters ??
    nestedFunction?.arguments ??
    nestedFunction?.args;
  const parsedArgs = parseArgsValue(directArgs);
  if (parsedArgs) {
    return parsedArgs;
  }

  const fallbackArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (["name", "tool", "toolName", "function", "id", "type"].includes(key)) {
      continue;
    }
    fallbackArgs[key] = value;
  }

  return Object.keys(fallbackArgs).length > 0 ? fallbackArgs : undefined;
}

function parseArgsValue(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function isToolName(value: unknown): value is NonNullable<NssAskResponse["toolCalls"]>[number]["name"] {
  return (
    value === "list_files" ||
    value === "read_file" ||
    value === "write_file" ||
    value === "edit_file" ||
    value === "search_files" ||
    value === "run_terminal" ||
    value === "get_diagnostics"
  );
}

function tryParseJson(body: string, contentType: string): unknown {
  if (!body.trim()) {
    return undefined;
  }

  let trimmed = body.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```[a-zA-Z0-9-]*\s*/, "");
    trimmed = trimmed.replace(/\s*```$/, "");
    trimmed = trimmed.trim();
  }

  if (!contentType.includes("json") && !trimmed.startsWith("{")) {
    const extracted = extractJsonObject(trimmed);
    if (!extracted) {
      return undefined;
    }
    trimmed = extracted;
  } else if (!trimmed.startsWith("{")) {
    const extracted = extractJsonObject(trimmed);
    if (extracted) {
      trimmed = extracted;
    }
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function extractJsonObject(value: string): string | undefined {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return undefined;
  }

  const candidate = value.slice(firstBrace, lastBrace + 1).trim();
  return candidate.includes("tool") || candidate.includes("response") ? candidate : undefined;
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
