import {
  MatterhornAgentRuntime,
  MatterhornModelGateway,
  createAnthropicIntelligenceProvider,
  createGeminiIntelligenceProvider,
  createOllamaIntelligenceProvider,
  createOpenAIResponsesIntelligenceProvider,
  type MatterhornAgentRunResult,
  type MatterhornModelDescriptor,
  type MatterhornModelProvider,
  type MatterhornModelRole,
} from "../../../core/out/index.js";
import type { NssWorkspaceAiServerConfig } from "../config/env.js";
import type { StudioProject } from "./studioService.js";
import { createIntelligenceWorkspaceTools } from "./intelligenceWorkspaceTools.js";

const MAX_PROMPT_LENGTH = 16_000;
const SUPPORTED_ROLES = new Set<MatterhornModelRole>([
  "reasoning",
  "coding",
  "fast",
]);

export interface IntelligenceServiceOptions {
  readonly providers?: readonly MatterhornModelProvider[];
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

  constructor(
    private readonly projects: readonly StudioProject[],
    config: NssWorkspaceAiServerConfig,
    options: IntelligenceServiceOptions = {},
  ) {
    for (const provider of options.providers ?? providersFromConfig(config)) {
      this.gateway.register(provider);
    }
    this.runtime = new MatterhornAgentRuntime(this.gateway);
  }

  models(): readonly PublicIntelligenceModel[] {
    return this.gateway.listModels().map(publicModel);
  }

  async run(raw: unknown): Promise<PublicIntelligenceRun> {
    const request = parseRequest(raw);
    const project = this.projects.find(
      (candidate) => candidate.id === request.projectId,
    );
    if (!project) {
      throw new Error("Unknown Studio project.");
    }

    const result = await this.runtime.run({
      route: {
        role: request.role ?? "coding",
        requiredCapabilities: ["text", "tools"],
        ...(request.providerId
          ? { preferredProviderId: request.providerId }
          : {}),
        ...(request.modelId ? { preferredModelId: request.modelId } : {}),
      },
      routingPolicy: {
        preferLocal: request.preferLocal ?? true,
        allowNetwork: request.allowNetwork ?? false,
        allowExternalCost: request.allowExternalCost ?? false,
        allowFallback: request.allowFallback ?? false,
      },
      system: [
        "You are Matterhorn, the AI development agent for Northern Step Studio.",
        "Work only inside the selected project and only through the tools provided by Matterhorn.",
        "Use tools when repository facts are needed. Never invent file contents or claim a tool ran when it did not.",
        "This intelligence endpoint is read-only. Inspect and explain; do not claim that files were modified.",
        "Keep the final answer concise and actionable.",
      ].join(" "),
      messages: [{ role: "user", content: request.prompt }],
      toolExecutor: createIntelligenceWorkspaceTools(
        this.projects,
        request.projectId,
      ),
      limits: {
        maxTurns: 10,
        maxToolCalls: 18,
        maxRepeatedToolCalls: 3,
      },
      temperature: 0.2,
      maxOutputTokens: 4_096,
    });

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
        baseUrl: mc.lmstudioBaseUrl ?? "http://127.0.0.1:1234/v1/",
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

function parseRequest(raw: unknown): IntelligenceRunRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Intelligence request must be an object.");
  }
  const body = raw as Record<string, unknown>;
  const projectId = requiredString(body.projectId, "projectId", 80);
  const prompt = requiredString(body.prompt, "prompt", MAX_PROMPT_LENGTH);
  const role =
    body.role === undefined
      ? "coding"
      : requiredString(body.role, "role", 30);
  if (!SUPPORTED_ROLES.has(role as MatterhornModelRole)) {
    throw new Error("Unsupported intelligence role.");
  }

  return {
    projectId,
    prompt,
    role: role as MatterhornModelRole,
    ...(optionalString(body.providerId, "providerId", 80)
      ? {
          providerId: optionalString(
            body.providerId,
            "providerId",
            80,
          ),
        }
      : {}),
    ...(optionalString(body.modelId, "modelId", 160)
      ? { modelId: optionalString(body.modelId, "modelId", 160) }
      : {}),
    preferLocal: optionalBoolean(body.preferLocal, "preferLocal") ?? true,
    allowNetwork:
      optionalBoolean(body.allowNetwork, "allowNetwork") ?? false,
    allowExternalCost:
      optionalBoolean(body.allowExternalCost, "allowExternalCost") ??
      false,
    allowFallback:
      optionalBoolean(body.allowFallback, "allowFallback") ?? false,
  };
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
