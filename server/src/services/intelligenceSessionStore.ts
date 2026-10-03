import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type {
  MatterhornAgentState,
  MatterhornAgentStatus,
  MatterhornModelRole,
} from "../../../core/out/index.js";

const SESSION_VERSION = 1;
const MAX_SESSION_BYTES = 4 * 1024 * 1024;
const MAX_SESSIONS = 200;

export interface IntelligenceSessionRequestSnapshot {
  readonly projectId: string;
  readonly prompt: string;
  readonly role: MatterhornModelRole;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly preferLocal: boolean;
  readonly allowNetwork: boolean;
  readonly allowExternalCost: boolean;
  readonly allowFallback: boolean;
}

export interface IntelligenceSessionRecord {
  readonly version: 1;
  readonly id: string;
  readonly request: IntelligenceSessionRequestSnapshot;
  status: MatterhornAgentStatus;
  text: string;
  state: MatterhornAgentState;
  error?: string;
  readonly createdAt: string;
  updatedAt: string;
}

export interface PublicIntelligenceSession {
  readonly id: string;
  readonly projectId: string;
  readonly status: MatterhornAgentStatus;
  readonly text: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly role: MatterhornModelRole;
  readonly turns: number;
  readonly toolCalls: number;
  readonly usage: MatterhornAgentState["accumulatedUsage"];
  readonly pendingApprovals: readonly {
    readonly callId: string;
    readonly name: string;
  }[];
  readonly error?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class IntelligenceSessionStore {
  private readonly directory: string;

  constructor(dataDirectory: string) {
    this.directory = resolve(
      dataDirectory,
      "intelligence-sessions",
    );
  }

  create(
    request: IntelligenceSessionRequestSnapshot,
    result: {
      readonly status: MatterhornAgentStatus;
      readonly text: string;
      readonly state: MatterhornAgentState;
      readonly error?: string;
    },
  ): IntelligenceSessionRecord {
    if (this.ids().length >= MAX_SESSIONS) {
      throw new Error(
        "Intelligence session limit reached. Archive old local sessions before creating more.",
      );
    }
    const now = new Date().toISOString();
    const record: IntelligenceSessionRecord = {
      version: SESSION_VERSION,
      id: randomUUID(),
      request: structuredClone(request),
      status: result.status,
      text: result.text,
      state: structuredClone(result.state),
      ...(result.error ? { error: result.error } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.persist(record);
    return structuredClone(record);
  }

  update(
    id: string,
    result: {
      readonly status: MatterhornAgentStatus;
      readonly text: string;
      readonly state: MatterhornAgentState;
      readonly error?: string;
    },
  ): IntelligenceSessionRecord {
    const record = this.get(id);
    record.status = result.status;
    record.text = result.text;
    record.state = structuredClone(result.state);
    if (result.error) record.error = result.error;
    else delete record.error;
    this.persist(record);
    return structuredClone(record);
  }

  get(id: string): IntelligenceSessionRecord {
    assertSessionId(id);
    const path = join(this.directory, `${id}.json`);
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.size > MAX_SESSION_BYTES
    ) {
      throw new Error("Invalid intelligence session record.");
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return validateRecord(parsed, id);
  }

  list(): readonly IntelligenceSessionRecord[] {
    const records: IntelligenceSessionRecord[] = [];
    for (const id of this.ids()) {
      try {
        records.push(this.get(id));
      } catch {
        // Corrupt/unavailable records are not exposed to callers.
      }
    }
    records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return records;
  }

  private ids(): string[] {
    try {
      return readdirSync(this.directory)
        .filter((name) => /^[a-f0-9-]{36}\.json$/.test(name))
        .map((name) => name.slice(0, -5));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private persist(record: IntelligenceSessionRecord): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (lstatSync(this.directory).isSymbolicLink()) {
      throw new Error(
        "Intelligence session storage cannot be a symbolic link.",
      );
    }
    record.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(record);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SESSION_BYTES) {
      throw new Error(
        "Intelligence session exceeded the 4 MiB local context limit. Start a new session or compact the context.",
      );
    }

    const path = join(this.directory, `${record.id}.json`);
    const temp = `${path}.${randomUUID()}.tmp`;
    let fd: number | undefined;
    try {
      fd = openSync(temp, "wx", 0o600);
      writeFileSync(fd, serialized, "utf8");
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      renameSync(temp, path);
    } finally {
      if (fd !== undefined) closeSync(fd);
      try {
        unlinkSync(temp);
      } catch {
        // Rename consumed the temp file.
      }
    }
  }
}

export function publicIntelligenceSession(
  record: IntelligenceSessionRecord,
): PublicIntelligenceSession {
  return {
    id: record.id,
    projectId: record.request.projectId,
    status: record.status,
    text: record.text,
    providerId: record.state.route.providerId,
    modelId: record.state.route.modelId,
    role: record.request.role,
    turns: record.state.turns,
    toolCalls: record.state.toolCalls,
    usage: record.state.accumulatedUsage,
    pendingApprovals: record.state.pendingToolCalls.map((call) => ({
      callId: call.id,
      name: call.name,
    })),
    ...(record.error ? { error: record.error } : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function validateRecord(
  value: unknown,
  id: string,
): IntelligenceSessionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Intelligence session record is invalid.");
  }
  const record = value as IntelligenceSessionRecord;
  if (
    record.version !== SESSION_VERSION ||
    record.id !== id ||
    !record.request ||
    typeof record.request.projectId !== "string" ||
    typeof record.request.prompt !== "string" ||
    !record.state ||
    !Array.isArray(record.state.messages) ||
    !Array.isArray(record.state.pendingToolCalls) ||
    typeof record.state.route?.providerId !== "string" ||
    typeof record.state.route?.modelId !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new Error("Intelligence session record integrity check failed.");
  }
  return structuredClone(record);
}

function assertSessionId(id: string): void {
  if (!/^[a-f0-9-]{36}$/.test(id)) {
    throw new Error("Invalid intelligence session ID.");
  }
}
