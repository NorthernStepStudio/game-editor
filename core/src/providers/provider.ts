import type { ResponseOsRuntimeConfig, ResponseOsProvider } from "../core/types.js";
import { createGeminiProvider } from "./gemini.js";
import { createMockProvider } from "./mock.js";
import { createOffProvider } from "./off.js";

export function createResponseOsProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  switch (config.providerMode) {
    case "gemini":
      return createGeminiProvider(config);
    case "off":
      return createOffProvider();
    case "mock":
    default:
      return createMockProvider();
  }
}
