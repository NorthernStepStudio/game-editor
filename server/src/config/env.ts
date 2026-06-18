import * as fs from "node:fs";
import * as path from "node:path";
import type { SynoxProviderMode, SynoxRuntimeConfig } from "../mCore.js";

export interface NssWorkspaceAiServerConfig {
  readonly port: number;
  readonly mCore: SynoxRuntimeConfig;
}

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): NssWorkspaceAiServerConfig {
  discoverAndLoadEnvironmentVariables(env);

  const geminiApiKey = firstDefined(
    trimOptional(env.M_CORE_GEMINI_API_KEY),
    trimOptional(env.SYNOX_GEMINI_API_KEY),
    trimOptional(env.RESPONSE_OS_GEMINI_API_KEY),
    trimOptional(env.GEMINI_API_KEY),
    trimOptional(env.NSS_WORKSPACE_AI_API_KEY),
  );
  const geminiModel = firstDefined(
    trimOptional(env.M_CORE_GEMINI_MODEL),
    trimOptional(env.SYNOX_GEMINI_MODEL),
    trimOptional(env.RESPONSE_OS_GEMINI_MODEL),
    trimOptional(env.GEMINI_MODEL),
    trimOptional(env.NSS_WORKSPACE_AI_MODEL),
    "gemini-2.5-flash",
  );
  const openaiApiKey = firstDefined(
    trimOptional(env.OPENAI_API_KEY),
    trimOptional(env.M_CORE_OPENAI_API_KEY),
  );
  const anthropicApiKey = firstDefined(
    trimOptional(env.ANTHROPIC_API_KEY),
    trimOptional(env.M_CORE_ANTHROPIC_API_KEY),
  );
  const requestedMode = firstDefined(
    trimOptional(env.M_CORE_PROVIDER_MODE),
    trimOptional(env.SYNOX_PROVIDER_MODE),
    trimOptional(env.RESPONSE_OS_PROVIDER_MODE),
    trimOptional(env.NSS_WORKSPACE_AI_PROVIDER_MODE),
  );

  return {
    port: parseNumber(env.PORT, 3001),
    mCore: {
      providerMode: resolveProviderMode(requestedMode, geminiApiKey, openaiApiKey, anthropicApiKey),
      geminiApiKey,
      geminiModel,
      geminiBaseUrl: firstDefined(
        trimOptional(env.M_CORE_GEMINI_BASE_URL),
        trimOptional(env.SYNOX_GEMINI_BASE_URL),
        trimOptional(env.RESPONSE_OS_GEMINI_BASE_URL),
        "https://generativelanguage.googleapis.com/v1",
      ),
      openaiApiKey,
      openaiModel: firstDefined(trimOptional(env.OPENAI_MODEL), trimOptional(env.M_CORE_OPENAI_MODEL), "gpt-4o"),
      openaiBaseUrl: firstDefined(trimOptional(env.OPENAI_BASE_URL), trimOptional(env.M_CORE_OPENAI_BASE_URL)),
      anthropicApiKey,
      anthropicModel: firstDefined(
        trimOptional(env.ANTHROPIC_MODEL),
        trimOptional(env.M_CORE_ANTHROPIC_MODEL),
        "claude-3-5-sonnet-20241022",
      ),
      ollamaBaseUrl: firstDefined(trimOptional(env.OLLAMA_BASE_URL), trimOptional(env.M_CORE_OLLAMA_BASE_URL)),
      ollamaModel: firstDefined(trimOptional(env.OLLAMA_MODEL), trimOptional(env.M_CORE_OLLAMA_MODEL)),
      lmstudioBaseUrl: firstDefined(
        trimOptional(env.LMSTUDIO_BASE_URL),
        trimOptional(env.M_CORE_LMSTUDIO_BASE_URL),
      ),
      lmstudioModel: firstDefined(trimOptional(env.LMSTUDIO_MODEL), trimOptional(env.M_CORE_LMSTUDIO_MODEL)),
      requestTimeoutMs: parseNumber(
        firstDefined(
          env.M_CORE_REQUEST_TIMEOUT_MS,
          env.SYNOX_REQUEST_TIMEOUT_MS,
          env.RESPONSE_OS_REQUEST_TIMEOUT_MS,
          env.NSS_WORKSPACE_AI_REQUEST_TIMEOUT_MS,
        ),
        30_000,
      ),
    },
  };
}

export function describeProvider(config: NssWorkspaceAiServerConfig): string {
  const provider = resolveProviderLabel(config.mCore.providerMode);
  return `Synox runtime connected. Synox provider: ${provider}`;
}

export interface ProviderInfo {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly model: string | null;
  readonly note: string;
}

export function getAvailableProviders(config: NssWorkspaceAiServerConfig): {
  readonly current: string;
  readonly providers: readonly ProviderInfo[];
} {
  const mc = config.mCore;
  return {
    current: mc.providerMode,
    providers: [
      {
        id: "mock",
        label: "Mock",
        available: true,
        model: null,
        note: "Built-in — no API key needed",
      },
      {
        id: "gemini",
        label: "Gemini",
        available: Boolean(mc.geminiApiKey),
        model: mc.geminiModel ?? "gemini-2.5-flash",
        note: mc.geminiApiKey ? "API key configured" : "Set GEMINI_API_KEY",
      },
      {
        id: "openai",
        label: "ChatGPT",
        available: Boolean(mc.openaiApiKey),
        model: mc.openaiModel ?? "gpt-4o",
        note: mc.openaiApiKey ? "API key configured" : "Set OPENAI_API_KEY",
      },
      {
        id: "anthropic",
        label: "Claude",
        available: Boolean(mc.anthropicApiKey),
        model: mc.anthropicModel ?? "claude-3-5-sonnet-20241022",
        note: mc.anthropicApiKey ? "API key configured" : "Set ANTHROPIC_API_KEY",
      },
      {
        id: "ollama",
        label: "Ollama",
        available: true,
        model: mc.ollamaModel ?? "qwen2.5-coder:14b",
        note: `${mc.ollamaBaseUrl ?? "localhost:11434"} · local`,
      },
      {
        id: "lmstudio",
        label: "LM Studio",
        available: true,
        model: mc.lmstudioModel ?? "local-model",
        note: `${mc.lmstudioBaseUrl ?? "localhost:1234"} · local`,
      },
    ],
  };
}

function resolveProviderMode(
  requestedMode: string | undefined,
  geminiApiKey: string | undefined,
  openaiApiKey: string | undefined,
  anthropicApiKey: string | undefined,
): SynoxProviderMode {
  if (requestedMode === "off") return "off";
  if (requestedMode === "mock") return "mock";

  if (requestedMode === "openai") return openaiApiKey ? "openai" : "mock";
  if (requestedMode === "anthropic") return anthropicApiKey ? "anthropic" : "mock";
  if (requestedMode === "ollama") return "ollama";
  if (requestedMode === "lmstudio") return "lmstudio";
  if (requestedMode === "gemini") return geminiApiKey ? "gemini" : "mock";

  // Auto-detect: prefer whichever key is set
  if (geminiApiKey) return "gemini";
  if (openaiApiKey) return "openai";
  if (anthropicApiKey) return "anthropic";
  return "mock";
}

function resolveProviderLabel(mode: SynoxProviderMode): string {
  switch (mode) {
    case "gemini":    return "Gemini";
    case "openai":    return "OpenAI";
    case "anthropic": return "Anthropic";
    case "ollama":    return "Ollama (local)";
    case "lmstudio":  return "LM Studio (local)";
    case "off":       return "Off";
    case "mock":
    default:          return "Mock";
  }
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function discoverAndLoadEnvironmentVariables(env: NodeJS.ProcessEnv): void {
  const searchableNames = [".env", ".dev.vars", ".nss.vars"];
  let currentDir = process.cwd();
  const rootDir = path.parse(currentDir).root;

  // Search up to 4 levels or root
  for (let i = 0; i < 4; i++) {
    for (const name of searchableNames) {
      const filePath = path.join(currentDir, name);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const lines = content.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
              continue;
            }

            const equalsIndex = trimmed.indexOf("=");
            if (equalsIndex > 0) {
              const key = trimmed.slice(0, equalsIndex).trim();
              const value = trimmed.slice(equalsIndex + 1).trim();
              
              const unquotedValue = (value.startsWith('"') && value.endsWith('"')) || 
                                   (value.startsWith("'") && value.endsWith("'"))
                                   ? value.slice(1, -1) : value;

              if (key && unquotedValue && !env[key]) {
                env[key] = unquotedValue;
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    if (currentDir === rootDir) {
      break;
    }
    currentDir = path.dirname(currentDir);
  }
}
