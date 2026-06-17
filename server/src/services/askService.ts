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
