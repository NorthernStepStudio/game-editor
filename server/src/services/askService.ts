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
): NssWorkspaceAiServerConfig {
  if (!providerOverride || !VALID_PROVIDER_MODES.has(providerOverride)) {
    return config;
  }
  return {
    ...config,
    mCore: { ...config.mCore, providerMode: providerOverride as ResponseOsProviderMode },
  };
}

export async function handleAskRequest(
  config: NssWorkspaceAiServerConfig,
  request: NssAskRequestPayload,
  providerOverride?: string,
): Promise<NssAskResponse> {
  const effectiveConfig = applyProviderOverride(config, providerOverride);
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
): AsyncGenerator<string> {
  const effectiveConfig = applyProviderOverride(config, providerOverride);
  const runtime = createMCoreRuntime({
    ...effectiveConfig.mCore,
    logger: createConsoleLogger("m-core"),
  });
  yield* runtime.stream(request);
}
