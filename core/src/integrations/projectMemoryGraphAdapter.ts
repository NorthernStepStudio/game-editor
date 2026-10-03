import { randomUUID } from "node:crypto";
import type {
  MatterhornProjectMemoryAdapter,
  MatterhornProjectMemoryFact,
  MatterhornProjectMemorySearch,
  MatterhornProjectMemoryWrite,
  MatterhornRuntimeHealth,
} from "./runtimeCapabilities.js";

export interface MatterhornProjectMemoryOptions {
  readonly baseUrl?: string;
  readonly requestTimeoutMs?: number;
}

interface GraphitiFact {
  readonly uuid: string;
  readonly name: string;
  readonly fact: string;
  readonly valid_at?: string | null;
  readonly invalid_at?: string | null;
  readonly created_at: string;
  readonly expired_at?: string | null;
  readonly source_node_uuid?: string;
  readonly target_node_uuid?: string;
  readonly episodes?: string[];
}

function assertLocalHttpUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Matterhorn Project Memory must use HTTP or HTTPS.");
  }
  const host = url.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("Matterhorn Project Memory currently requires a loopback endpoint.");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function validProjectId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

function groupId(projectId: string): string {
  if (!validProjectId(projectId)) throw new Error("Invalid Matterhorn project id.");
  return `matterhorn-project-${projectId}`;
}

function normalizedIso(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.valueOf())) throw new Error("Invalid project-memory timestamp.");
  return date.toISOString();
}

function mapFact(input: GraphitiFact): MatterhornProjectMemoryFact {
  if (!input || typeof input.uuid !== "string" || typeof input.fact !== "string" || typeof input.created_at !== "string") {
    throw new Error("Matterhorn Project Memory returned an invalid fact.");
  }
  return {
    id: input.uuid,
    name: typeof input.name === "string" ? input.name : "",
    fact: input.fact,
    createdAt: input.created_at,
    ...(input.valid_at ? { validAt: input.valid_at } : {}),
    ...(input.invalid_at ? { invalidAt: input.invalid_at } : {}),
    ...(input.expired_at ? { expiredAt: input.expired_at } : {}),
    ...(input.source_node_uuid ? { sourceNodeId: input.source_node_uuid } : {}),
    ...(input.target_node_uuid ? { targetNodeId: input.target_node_uuid } : {}),
    ...(Array.isArray(input.episodes) ? { episodeIds: [...input.episodes] } : {}),
  };
}

/**
 * Matterhorn Project Memory backed by Graphiti's stable HTTP service.
 *
 * Matterhorn owns project IDs, API shapes, naming and lifecycle. Graphiti is
 * treated as a replaceable temporal-knowledge engine.
 */
export class MatterhornProjectMemoryGraphAdapter implements MatterhornProjectMemoryAdapter {
  readonly id = "matterhorn.project-memory.graph";
  readonly capability = "project-memory" as const;
  readonly attribution = {
    sourceProject: "Graphiti",
    sourceUrl: "https://github.com/getzep/graphiti",
    license: "Apache-2.0",
  } as const;

  private readonly baseUrl: URL;
  private readonly requestTimeoutMs: number;

  constructor(options: MatterhornProjectMemoryOptions = {}) {
    this.baseUrl = assertLocalHttpUrl(options.baseUrl ?? "http://127.0.0.1:8000/");
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs < 100 || this.requestTimeoutMs > 120_000) {
      throw new Error("Invalid Matterhorn Project Memory timeout.");
    }
  }

  async health(): Promise<MatterhornRuntimeHealth> {
    try {
      const response = await this.request("healthcheck", { method: "GET" });
      const body = JSON.parse(response) as { status?: string };
      return body.status === "healthy"
        ? { state: "ready", diagnosticDetail: "Project memory service is ready." }
        : { state: "degraded", diagnosticDetail: "Project memory service did not report healthy." };
    } catch (error) {
      return {
        state: "unavailable",
        diagnosticDetail: error instanceof Error ? error.message : "Project memory service is unavailable.",
      };
    }
  }

  async remember(input: MatterhornProjectMemoryWrite): Promise<void> {
    if (!validProjectId(input.projectId)) throw new Error("Invalid Matterhorn project id.");
    if (!input.content.trim() || input.content.length > 50_000) throw new Error("Project-memory content is empty or too large.");
    if (!input.source.trim() || input.source.length > 500) throw new Error("Invalid project-memory source.");

    const role = input.role ?? "system";
    await this.request("messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group_id: groupId(input.projectId),
        messages: [{
          uuid: input.id ?? randomUUID(),
          name: `Matterhorn project fact from ${input.source}`,
          role_type: role,
          role: "matterhorn",
          content: input.content,
          timestamp: normalizedIso(input.timestamp),
          source_description: input.source,
        }],
      }),
    }, 202);
  }

  async search(input: MatterhornProjectMemorySearch): Promise<readonly MatterhornProjectMemoryFact[]> {
    if (!validProjectId(input.projectId)) throw new Error("Invalid Matterhorn project id.");
    if (!input.query.trim() || input.query.length > 8_000) throw new Error("Project-memory query is empty or too large.");
    const maxFacts = input.maxFacts ?? 10;
    if (!Number.isInteger(maxFacts) || maxFacts < 1 || maxFacts > 50) throw new Error("Invalid project-memory result limit.");

    const raw = await this.request("search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        group_ids: [groupId(input.projectId)],
        query: input.query,
        max_facts: maxFacts,
      }),
    });
    const parsed = JSON.parse(raw) as { facts?: GraphitiFact[] };
    if (!Array.isArray(parsed.facts)) throw new Error("Matterhorn Project Memory returned an invalid search response.");
    return parsed.facts.map(mapFact);
  }

  async forgetProject(projectId: string): Promise<void> {
    const id = encodeURIComponent(groupId(projectId));
    await this.request(`group/${id}`, { method: "DELETE" });
  }

  private async request(path: string, init: RequestInit, expectedStatus = 200): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(new URL(path, this.baseUrl), { ...init, signal: controller.signal });
      const body = await response.text();
      if (response.status !== expectedStatus) {
        throw new Error(`Matterhorn Project Memory request failed with HTTP ${response.status}.`);
      }
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Matterhorn Project Memory request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
