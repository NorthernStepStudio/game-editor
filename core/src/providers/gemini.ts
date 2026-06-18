import type { NssAskResponse, NssChatMessage, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
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
  const model = config.geminiModel ?? "gemini-2.5-flash";
  const baseUrl = ensureTrailingSlash(config.geminiBaseUrl ?? "https://generativelanguage.googleapis.com/v1");

  function buildContents(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const userPayload = JSON.stringify(
      {
        request: input.request,
        agent: { id: input.agent.id, title: input.agent.title, summary: input.agent.summary },
      },
      null,
      2,
    );

    const historyContents = history.map((m: NssChatMessage) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    return [
      ...historyContents,
      { role: "user", parts: [{ text: userPayload }] },
    ];
  }

  return {
    id: "gemini",
    describe() {
      return `M-CORE Gemini mode using ${model}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      if (!config.geminiApiKey) {
        throw new Error("Gemini mode requires a Gemini API key.");
      }

      const response = await fetch(new URL(`models/${model}:generateContent`, baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.geminiApiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: input.agent.systemInstruction }] },
          contents: buildContents(input),
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
    async *generateStream(input: ResponseOsProviderRequest): AsyncGenerator<string> {
      if (!config.geminiApiKey) {
        throw new Error("Gemini mode requires a Gemini API key.");
      }

      const response = await fetch(new URL(`models/${model}:streamGenerateContent?alt=sse`, baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.geminiApiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: input.agent.systemInstruction }] },
          contents: buildContents(input),
          generationConfig: {
            temperature: input.budget.temperature,
            maxOutputTokens: input.budget.maxOutputTokens,
          },
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Gemini stream failed (${response.status}): ${await response.text()}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            const chunk = JSON.parse(data) as GeminiGenerateContentResponse;
            const token = extractText(chunk);
            if (token) yield token;
          } catch {}
        }
      }
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
