import { resolveAgentForRequest } from "../agents/router.js";
import { createResponseOsProvider } from "../providers/provider.js";
import { resolveBudgetForIntent } from "./budget.js";
import { createNoopLogger } from "./logger.js";
import type { NssAskRequestPayload, NssAskResponse, ResponseOsRuntime, ResponseOsRuntimeConfig } from "./types.js";

export function createResponseOsRuntime(config: ResponseOsRuntimeConfig): ResponseOsRuntime {
  const logger = config.logger ?? createNoopLogger();
  const provider = createResponseOsProvider(config);

  return {
    providerMode: provider.id,
    describeProvider() {
      return provider.describe();
    },
    async run(request: NssAskRequestPayload): Promise<NssAskResponse> {
      validateAskRequest(request);
      const agent = resolveAgentForRequest(request);
      const budget = resolveBudgetForIntent(request.intent);

      logger.debug("M-CORE runtime handling request.", {
        intent: request.intent,
        provider: provider.id,
        agent: agent.id,
      });

      return provider.generate({
        request,
        agent,
        budget,
        logger,
      });
    },
  };
}

function validateAskRequest(request: NssAskRequestPayload): void {
  if (!request || typeof request !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    throw new Error("Request body must include a non-empty prompt.");
  }

  if (typeof request.intent !== "string" || request.intent.trim().length === 0) {
    throw new Error("Request body must include a non-empty intent.");
  }

  if (!request.workspace || typeof request.workspace.name !== "string" || request.workspace.name.trim().length === 0) {
    throw new Error("Request body must include workspace.name.");
  }
}

export const createMCoreRuntime = createResponseOsRuntime;

export async function runAgent(
  config: ResponseOsRuntimeConfig,
  request: NssAskRequestPayload,
): Promise<NssAskResponse> {
  return createResponseOsRuntime(config).run(request);
}

export type MCoreRuntime = ResponseOsRuntime;
export type MCoreRuntimeConfig = ResponseOsRuntimeConfig;
