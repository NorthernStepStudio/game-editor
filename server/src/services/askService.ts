import { type NssWorkspaceAiServerConfig } from "../config/env.js";
import {
  createConsoleLogger,
  createMCoreRuntime,
  type NssAskRequestPayload,
  type NssAskResponse,
  type ResponseOsProviderMode,
} from "../mCore.js";

const VALID_PROVIDER_MODES: ReadonlySet<string> = new Set([
  "mock", "off", "gemini", "openai", "anthropic", "ollama", "lmstudio",
]);

function applyProviderOverride(
  config: NssWorkspaceAiServerConfig,
  providerOverride?: string,
  modelOverride?: string,
): NssWorkspaceAiServerConfig {
  // A model override applies to the active provider even when no provider override is given.
  const provider = providerOverride && VALID_PROVIDER_MODES.has(providerOverride)
    ? providerOverride
    : modelOverride ? config.mCore.providerMode : undefined;
  if (!provider) {
    return config;
  }

  const modelConfig = modelOverride ? createModelOverride(provider, modelOverride) : {};
  return {
    ...config,
    mCore: {
      ...config.mCore,
      providerMode: provider as ResponseOsProviderMode,
      ...modelConfig,
    },
  };
}

function createModelOverride(providerOverride: string, modelOverride: string): Partial<NssWorkspaceAiServerConfig["mCore"]> {
  switch (providerOverride) {
    case "gemini":
      return { geminiModel: modelOverride };
    case "openai":
      return { openaiModel: modelOverride };
    case "anthropic":
      return { anthropicModel: modelOverride };
    case "ollama":
      return { ollamaModel: modelOverride };
    case "lmstudio":
      return { lmstudioModel: modelOverride };
    default:
      return {};
  }
}

export async function handleAskRequest(
  config: NssWorkspaceAiServerConfig,
  request: NssAskRequestPayload,
  providerOverride?: string,
  modelOverride?: string,
): Promise<NssAskResponse> {
  const effectiveConfig = applyProviderOverride(config, providerOverride, modelOverride);
  const runtime = createMCoreRuntime({
    ...effectiveConfig.mCore,
    logger: createConsoleLogger("m-core"),
  });
  return runtime.run(request);
}

/**
 * Stream tokens from the runtime one at a time.
 * Yields raw text strings as they arrive from the provider.
 */
export async function* streamAskRequest(
  config: NssWorkspaceAiServerConfig,
  request: NssAskRequestPayload,
  providerOverride?: string,
  modelOverride?: string,
): AsyncGenerator<string> {
  const effectiveConfig = applyProviderOverride(config, providerOverride, modelOverride);
  const runtime = createMCoreRuntime({
    ...effectiveConfig.mCore,
    logger: createConsoleLogger("m-core"),
  });
  yield* runtime.stream(request);
}
