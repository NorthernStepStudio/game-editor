import { type NssWorkspaceAiServerConfig } from "../config/env.js";
import { createConsoleLogger, createMCoreRuntime, type NssAskRequestPayload, type NssAskResponse } from "../mCore.js";

export async function handleAskRequest(
  config: NssWorkspaceAiServerConfig,
  request: NssAskRequestPayload,
): Promise<NssAskResponse> {
  const runtime = createMCoreRuntime({
    ...config.mCore,
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
): AsyncGenerator<string> {
  const runtime = createMCoreRuntime({
    ...config.mCore,
    logger: createConsoleLogger("m-core"),
  });

  yield* runtime.stream(request);
}
