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
  const requestedMode = firstDefined(
    trimOptional(env.M_CORE_PROVIDER_MODE),
    trimOptional(env.SYNOX_PROVIDER_MODE),
    trimOptional(env.RESPONSE_OS_PROVIDER_MODE),
    trimOptional(env.NSS_WORKSPACE_AI_PROVIDER_MODE),
  );

  return {
    port: parseNumber(env.PORT, 3001),
    mCore: {
      providerMode: resolveProviderMode(requestedMode, geminiApiKey),
      geminiApiKey,
      geminiModel,
      geminiBaseUrl: firstDefined(
        trimOptional(env.M_CORE_GEMINI_BASE_URL),
        trimOptional(env.SYNOX_GEMINI_BASE_URL),
        trimOptional(env.RESPONSE_OS_GEMINI_BASE_URL),
        "https://generativelanguage.googleapis.com/v1",
      ),
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

function resolveProviderMode(
  requestedMode: string | undefined,
  geminiApiKey: string | undefined,
): SynoxProviderMode {
  if (requestedMode === "off") {
    return "off";
  }

  if (requestedMode === "mock") {
    return "mock";
  }

  if (requestedMode === "gemini") {
    return geminiApiKey ? "gemini" : "mock";
  }

  return geminiApiKey ? "gemini" : "mock";
}

function resolveProviderLabel(mode: SynoxProviderMode): string {
  switch (mode) {
    case "gemini":
      return "Gemini";
    case "off":
      return "Off";
    case "mock":
    default:
      return "Mock";
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
