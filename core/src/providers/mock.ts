import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest } from "../core/types.js";
import { buildMockResponseBody, buildResponseTitle } from "../tools/responseTools.js";

export function createMockProvider(): ResponseOsProvider {
  return {
    id: "mock",
    describe() {
      return "M-CORE mock mode. Deterministic local responses, no external model required.";
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const title = buildResponseTitle(input.request);
      const response = buildMockResponseBody(input.request, input.agent);

      return {
        title,
        response,
        preview: response.split("\n").slice(0, 4).join("\n"),
      };
    },
  };
}
