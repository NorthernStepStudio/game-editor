import type { ResponseOsRuntimeConfig, ResponseOsProvider } from "../core/types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";
import { createLMStudioProvider } from "./lmstudio.js";
import { createMockProvider } from "./mock.js";
import { createOffProvider } from "./off.js";
import { createOllamaProvider } from "./ollama.js";
import { createOpenAIProvider } from "./openai.js";

export function createResponseOsProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  switch (config.providerMode) {
    case "gemini":
      return createGeminiProvider(config);
    case "openai":
      return createOpenAIProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    case "ollama":
      return createOllamaProvider(config);
    case "lmstudio":
      return createLMStudioProvider(config);
    case "off":
      return createOffProvider();
    case "mock":
    default:
      return createMockProvider();
  }
}
