import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

interface GeminiGenerateContentResponse {
  readonly candidates?: ReadonlyArray<{
    readonly content?: {
      readonly parts?: ReadonlyArray<{
        readonly text?: string;
      }>;
    };
    readonly finishReason?: string;
  }>;
  readonly promptFeedback?: {
    readonly blockReason?: string;
  };
}

export function createGeminiProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  return {
    id: "gemini",
    describe() {
      return `M-CORE Gemini mode using ${config.geminiModel ?? "gemini-2.5-flash"}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      if (!config.geminiApiKey) {
        throw new Error("Gemini mode requires a Gemini API key.");
      }

      const model = config.geminiModel ?? "gemini-2.5-flash";
      const baseUrl = ensureTrailingSlash(config.geminiBaseUrl ?? "https://generativelanguage.googleapis.com/v1");
      const response = await fetch(new URL(`models/${model}:generateContent`, baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.geminiApiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: input.agent.systemInstruction,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: JSON.stringify(
                    {
                      request: input.request,
                      agent: {
                        id: input.agent.id,
                        title: input.agent.title,
                        summary: input.agent.summary,
                      },
                    },
                    null,
                    2,
                  ),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: input.budget.temperature,
            maxOutputTokens: input.budget.maxOutputTokens,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`);
      }

      const payload = (await response.json()) as GeminiGenerateContentResponse;
      const content = extractText(payload);
      if (!content) {
        const blockReason = payload.promptFeedback?.blockReason;
        throw new Error(
          blockReason
            ? `Gemini did not return content because the request was blocked: ${blockReason}.`
            : "Gemini did not return textual content.",
        );
      }

      return normalizeStructuredModelResponse(content, buildResponseTitle(input.request));
    },
  };
}

function extractText(payload: GeminiGenerateContentResponse): string | undefined {
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    return undefined;
  }

  const text = parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text || undefined;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
