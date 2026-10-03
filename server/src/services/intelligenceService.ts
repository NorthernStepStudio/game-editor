import { resolve } from "node:path";
import {
  MatterhornAgentRuntime,
  MatterhornModelGateway,
  createAnthropicIntelligenceProvider,
  createGeminiIntelligenceProvider,
  createOllamaIntelligenceProvider,
  createOpenAIResponsesIntelligenceProvider,
  type MatterhornAgentApprovalDecision,
  type MatterhornAgentRunInput,
  type MatterhornAgentRunResult,
  type MatterhornModelDescriptor,
  type MatterhornModelProvider,
  type MatterhornModelRole,
} from "../../../core/out/index.js";
import type { NssWorkspaceAiServerConfig } from "../config/env.js";
import type { StudioProject } from "./studioService.js";
import {
  IntelligenceSessionStore,
  publicIntelligenceSession,
  type IntelligenceSessionRequestSnapshot,
  type PublicIntelligenceSession,
} from "./intelligenceSessionStore.js";
import { createIntelligenceWorkspaceTools } from "./intelligenceWorkspaceTools.js";

const MAX_PROMPT_LENGTH = 16_000;
const SUPPORTED_ROLES = new Set<MatterhornModelRole>([
  "reasoning",
  "coding",
  "fast",
]);

const INTELLIGENCE_SYSTEM = [
  "You are Matterhorn, the AI development agent for Northern Step Studio.",
  "Work only inside the selected project and only through the tools provided by Matterhorn.",
  "Use tools when repository facts are needed. Never invent file contents or claim a tool ran when it did not.",
  "You may stage a file edit as a review proposal only after reading the current file version. A staged proposal does not modify the source file and still requires explicit user approval in Matterhorn.",
  "Never claim that a staged proposal was applied.",
  "Keep the final answer concise and actionable.",
].join(" ");

export interface IntelligenceServiceOptions {
  readonly providers?: readonly MatterhornModelProvider[];
  readonly dataDirectory?: string;
}

export interface IntelligenceRunRequest {
  readonly projectId: string;
  readonly prompt: string;
  readonly role?: MatterhornModelRole;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly preferLocal?: boolean;
  readonly allowNetwork?: boolean;
  readonly allowExternalCost?: boolean;
  readonly allowFallback?: boolean;
}

interface NormalizedIntelligenceRunRequest
  extends IntelligenceSessionRequestSnapshot {}

export interface PublicIntelligenceModel {
  readonly providerId: string;
  readonly modelId: string;
  readonly label: string;
  readonly roles: readonly MatterhornModelRole[];
  readonly capabilities: readonly string[];
  readonly local: boolean;
  readonly requiresNetwork: boolean;
  readonly externalCost: boolean;
}

export interface PublicIntelligenceRun {
  readonly status: MatterhornAgentRunResult["status"];
  readonly text: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly turns: number;
  readonly toolCalls: number;
  readonly usage: MatterhornAgentRunResult["state"]["accumulatedUsage"];
  readonly error?: string;
}

export class IntelligenceService {
  private readonly gateway = new MatterhornModelGateway();
  private readonly runtime: MatterhornAgentRuntime;
  private readonly dataDirectory: string;
  private readonly sessions: IntelligenceSessionStore;

  constructor(
    private readonly projects: readonly StudioProject[],
    config: NssWorkspaceAiServerConfig,
    options: IntelligenceServiceOptions = {},
  ) {
    this.dataDirectory =
      options.dataDirectory ??
      process.env.MATTERHORN_DATA_DIR ??
      resolve(__dirname, "../../../.matterhorn");
    this.sessions = new IntelligenceSessionStore(this.dataDirectory);

    for (const provider of options.providers ?? providersFromConfig(config)) {
      this.gateway.register(provider);
    }
    this.runtime = new MatterhornAgentRuntime(this.gateway);
  }

  models(): readonly PublicIntelligenceModel[] {
    return this.gateway.listModels().map(publicModel);
  }

  listSessions(): readonly PublicIntelligenceSession[] {
    return this.sessions.list().map(publicIntelligenceSession);
  }

  getSession(id: string): PublicIntelligenceSession {
    return publicIntelligenceSession(this.sessions.get(id));
  }

  async run(raw: unknown): Promise<PublicIntelligenceRun> {
    const request = parseRequest(raw);
    this.assertProject(request.projectId);
    const result = await this.runtime.run(this.buildInput(request));
    return publicRun(result);
  }

  async startSession(raw: unknown): Promise<PublicIntelligenceSession> {
    const request = parseRequest(raw);
    this.assertProject(request.projectId);
    const result = await this.runtime.run(this.buildInput(request));
    return publicIntelligenceSession(
      this.sessions.create(request, result),
    );
  }

  async continueSession(
    id: string,
    raw: unknown,
  ): Promise<PublicIntelligenceSession> {
    const record = this.sessions.get(id);
    if (record.status === "approval_required") {
      throw new Error(
        "Resolve pending tool approvals before sending another message.",
      );
    }
    if (record.status !== "completed") {
      throw new Error(
        "Only a completed intelligence session can accept another message.",
      );
    }

    const prompt = parseContinuationPrompt(raw);
    const result = await this.runtime.resume(
      this.buildInput(record.request),
      record.state,
      [],
      [{ role: "user", content: prompt }],
    );
    return publicIntelligenceSession(
      this.sessions.update(id, result),
    );
  }

  async resolveApprovals(
    id: string,
    raw: unknown,
  ): Promise<PublicIntelligenceSession> {
    const record = this.sessions.get(id);
    if (record.status !== "approval_required") {
      throw new Error(
        "This intelligence session is not waiting for approval.",
      );
    }
    const decisions = parseApprovalDecisions(
      raw,
      record.state.pendingToolCalls.map((call) => call.id),
    );
    const result = await this.runtime.resume(
      this.buildInput(record.request),
      record.state,
      decisions,
    );
    return publicIntelligenceSession(
      this.sessions.update(id, result),
    );
  }

  private buildInput(
    request: IntelligenceSessionRequestSnapshot,
  ): MatterhornAgentRunInput {
    return {
      route: {
        role: request.role,
        requiredCapabilities: ["text", "tools"],
        ...(request.providerId
          ? { preferredProviderId: request.providerId }
          : {}),
        ...(request.modelId
          ? { preferredModelId: request.modelId }
          : {}),
      },
      routingPolicy: {
        preferLocal: request.preferLocal,
        allowNetwork: request.allowNetwork,
        allowExternalCost: request.allowExternalCost,
        allowFallback: request.allowFallback,
      },
      system: INTELLIGENCE_SYSTEM,
      messages: [{ role: "user", content: request.prompt }],
      toolExecutor: createIntelligenceWorkspaceTools(
        this.projects,
        request.projectId,
        { dataDirectory: this.dataDirectory },
      ),
      limits: {
        maxTurns: 10,
        maxToolCalls: 18,
        maxRepeatedToolCalls: 3,
      },
      temperature: 0.2,
      maxOutputTokens: 4_096,
    };
  }

  private assertProject(projectId: string): void {
    if (
      !this.projects.some(
        (candidate) => candidate.id === projectId,
      )
    ) {
      throw new Error("Unknown Studio project.");
    }
  }
}

export function createIntelligenceService(
  config: NssWorkspaceAiServerConfig,
  projects: readonly StudioProject[],
  options: IntelligenceServiceOptions = {},
): IntelligenceService {
  return new IntelligenceService(projects, config, options);
}

function providersFromConfig(
  config: NssWorkspaceAiServerConfig,
): readonly MatterhornModelProvider[] {
  const providers: MatterhornModelProvider[] = [];
  const roles: readonly MatterhornModelRole[] = [
    "reasoning",
    "coding",
    "fast",
  ];
  const mc = config.mCore;

  if (mc.openaiApiKey && mc.openaiModel) {
    providers.push(
      createOpenAIResponsesIntelligenceProvider({
        providerId: "openai",
        label: "OpenAI",
        modelId: mc.openaiModel,
        baseUrl: mc.openaiBaseUrl ?? "https://api.openai.com/v1/",
        apiKey: mc.openaiApiKey,
        local: false,
        requiresNetwork: true,
        externalCost: true,
        roles,
        requestTimeoutMs: mc.requestTimeoutMs,
      }),
    );
  }

  if (mc.anthropicApiKey && mc.anthropicModel) {
    providers.push(
      createAnthropicIntelligenceProvider({
        modelId: mc.anthropicModel,
        apiKey: mc.anthropicApiKey,
        roles,
        requestTimeoutMs: mc.requestTimeoutMs,
      }),
    );
  }

  if (mc.geminiApiKey && mc.geminiModel) {
    providers.push(
      createGeminiIntelligenceProvider({
        modelId: mc.geminiModel,
        apiKey: mc.geminiApiKey,
        baseUrl: mc.geminiBaseUrl,
        roles,
        requestTimeoutMs: mc.requestTimeoutMs,
      }),
    );
  }

  if (mc.ollamaModel) {
    providers.push(
      createOllamaIntelligenceProvider({
        modelId: mc.ollamaModel,
        baseUrl: mc.ollamaBaseUrl,
        roles,
        requestTimeoutMs: mc.requestTimeoutMs,
      }),
    );
  }

  if (mc.lmstudioModel) {
    providers.push(
      createOpenAIResponsesIntelligenceProvider({
        providerId: "lmstudio",
        label: "LM Studio",
        modelId: mc.lmstudioModel,
        baseUrl:
          mc.lmstudioBaseUrl ??
          "http://127.0.0.1:1234/v1/",
        local: true,
        requiresNetwork: false,
        externalCost: false,
        roles,
        requestTimeoutMs: mc.requestTimeoutMs,
      }),
    );
  }

  return providers;
}

function parseRequest(raw: unknown): NormalizedIntelligenceRunRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Intelligence request must be an object.");
  }
  const body = raw as Record<string, unknown>;
  const projectId = requiredString(
    body.projectId,
    "projectId",
    80,
  );
  const prompt = requiredString(
    body.prompt,
    "prompt",
    MAX_PROMPT_LENGTH,
  );
  const role =
    body.role === undefined
      ? "coding"
      : requiredString(body.role, "role", 30);
  if (!SUPPORTED_ROLES.has(role as MatterhornModelRole)) {
    throw new Error("Unsupported intelligence role.");
  }

  const providerId = optionalString(
    body.providerId,
    "providerId",
    80,
  );
  const modelId = optionalString(body.modelId, "modelId", 160);

  return {
    projectId,
    prompt,
    role: role as MatterhornModelRole,
    ...(providerId ? { providerId } : {}),
    ...(modelId ? { modelId } : {}),
    preferLocal:
      optionalBoolean(body.preferLocal, "preferLocal") ?? true,
    allowNetwork:
      optionalBoolean(body.allowNetwork, "allowNetwork") ?? false,
    allowExternalCost:
      optionalBoolean(
        body.allowExternalCost,
        "allowExternalCost",
      ) ?? false,
    allowFallback:
      optionalBoolean(body.allowFallback, "allowFallback") ??
      false,
  };
}

function parseContinuationPrompt(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Session message must be an object.");
  }
  return requiredString(
    (raw as Record<string, unknown>).prompt,
    "prompt",
    MAX_PROMPT_LENGTH,
  );
}

function parseApprovalDecisions(
  raw: unknown,
  pendingIds: readonly string[],
): readonly MatterhornAgentApprovalDecision[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Approval request must be an object.");
  }
  const value = (raw as Record<string, unknown>).decisions;
  if (
    !Array.isArray(value) ||
    value.length !== pendingIds.length ||
    value.length > 24
  ) {
    throw new Error(
      "Approval decisions must cover every pending tool call exactly once.",
    );
  }

  const pending = new Set(pendingIds);
  const seen = new Set<string>();
  const decisions: MatterhornAgentApprovalDecision[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid approval decision.");
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.callId !== "string" ||
      !pending.has(record.callId) ||
      seen.has(record.callId) ||
      typeof record.approved !== "boolean"
    ) {
      throw new Error("Invalid or duplicate approval decision.");
    }
    seen.add(record.callId);
    decisions.push({
      callId: record.callId,
      approved: record.approved,
    });
  }
  return decisions;
}

function requiredString(
  value: unknown,
  field: string,
  max: number,
): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max
  ) {
    throw new Error(
      `${field} must be a non-empty string up to ${max} characters.`,
    );
  }
  return value.trim();
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return requiredString(value, field, max);
}

function optionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be true or false.`);
  }
  return value;
}

function publicModel(
  model: MatterhornModelDescriptor,
): PublicIntelligenceModel {
  return {
    providerId: model.providerId,
    modelId: model.modelId,
    label: model.label,
    roles: model.roles,
    capabilities: model.capabilities,
    local: model.local,
    requiresNetwork: model.requiresNetwork,
    externalCost: model.externalCost,
  };
}

function publicRun(
  result: MatterhornAgentRunResult,
): PublicIntelligenceRun {
  return {
    status: result.status,
    text: result.text,
    providerId: result.state.route.providerId,
    modelId: result.state.route.modelId,
    turns: result.state.turns,
    toolCalls: result.state.toolCalls,
    usage: result.state.accumulatedUsage,
    ...(result.error ? { error: result.error } : {}),
  };
}
