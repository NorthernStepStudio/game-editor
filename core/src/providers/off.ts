import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest } from "../core/types.js";
import { buildResponseTitle } from "../tools/responseTools.js";

export function createOffProvider(): ResponseOsProvider {
  return {
    id: "off",
    describe() {
      return "M-CORE provider is off.";
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const title = buildResponseTitle(input.request);
      const response = [
        "M-CORE is currently off.",
        `Prompt: ${input.request.prompt}`,
        `Agent: ${input.agent.title}`,
        "",
        "Next steps:",
        "- Enable the mock provider for deterministic local NSS responses.",
        "- Enable the Gemini provider when you want model-backed output.",
      ].join("\n");

      return {
        title,
        response,
        preview: "M-CORE is currently off.",
      };
    },
  };
}
