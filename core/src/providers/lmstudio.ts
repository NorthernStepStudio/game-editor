import type { NssAskResponse, ResponseOsProvider, ResponseOsProviderRequest, ResponseOsRuntimeConfig } from "../core/types.js";
import { buildResponseTitle, normalizeStructuredModelResponse } from "../tools/responseTools.js";

/**
 * LM Studio exposes an OpenAI-compatible REST API at http://localhost:1234/v1.
 * Model name is whatever model is currently loaded in LM Studio (can be overridden).
 */
export function createLMStudioProvider(config: ResponseOsRuntimeConfig): ResponseOsProvider {
  const baseUrl = ensureTrailingSlash(config.lmstudioBaseUrl ?? "http://localhost:1234/v1/");
  const requestedModel = config.lmstudioModel?.trim();
  const fallbackModel = "local-model";
  let resolvedModel: string | undefined;

  function buildMessages(input: ResponseOsProviderRequest) {
    const history = input.request.history ?? [];
    const localInstruction = "You are Matterhorn, the local-first AI agent and workspace assistant for Northern Step Studio / NStep. Your name is Matterhorn. You are not NSS Master Core, M-CORE, NSS Workspace AI, or General NSS Studio Agent. Reply directly to the user in plain conversational text. Do not wrap your answer in JSON. Do not include keys like title, response, content, message, or answer. Do not use markdown code fences unless the user specifically asks for code.";
    
    let systemInstruction = input.agent.systemInstruction;
    systemInstruction = systemInstruction.replace(/Respond as JSON with keys[^.\n]*\.?/gi, "");
    systemInstruction = `${systemInstruction.trim()}\n\n${localInstruction}`;

    const systemMsg = { role: "system" as const, content: systemInstruction };
    const historyMsgs = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const userContent = JSON.stringify(
      {
        request: input.request,
        agent: { id: input.agent.id, title: input.agent.title, summary: input.agent.summary },
      },
      null,
      2,
    );
    return [systemMsg, ...historyMsgs, { role: "user" as const, content: userContent }];
  }

  interface OpenAICompatResponse {
    readonly choices?: ReadonlyArray<{
      readonly message?: { readonly content?: string };
      readonly delta?: { readonly content?: string };
      readonly finish_reason?: string;
    }>;
    readonly error?: { readonly message?: string };
  }

  interface OpenAICompatModelsResponse {
    readonly data?: ReadonlyArray<{
      readonly id?: string;
    }>;
  }

  async function resolveModel(): Promise<string> {
    if (resolvedModel) {
      return resolvedModel;
    }

    const availableModels = await listLMStudioModels();
    if (requestedModel && availableModels.includes(requestedModel)) {
      resolvedModel = requestedModel;
      return resolvedModel;
    }

    if (!requestedModel && availableModels.length > 0) {
      resolvedModel = availableModels[0];
      return resolvedModel;
    }

    if (requestedModel && availableModels.length > 0) {
      resolvedModel = availableModels[0];
      return resolvedModel;
    }

    resolvedModel = requestedModel ?? fallbackModel;
    return resolvedModel;
  }

  async function listLMStudioModels(): Promise<string[]> {
    try {
      const response = await fetch(new URL("models", baseUrl), {
        signal: AbortSignal.timeout(Math.min(config.requestTimeoutMs, 3_000)),
      });
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as OpenAICompatModelsResponse;
      return payload.data?.map((model) => model.id).filter((id): id is string => Boolean(id?.trim())) ?? [];
    } catch {
      return [];
    }
  }

  return {
    id: "lmstudio",
    describe() {
      return `M-CORE LM Studio (local) mode at ${baseUrl}.`;
    },
    async generate(input: ResponseOsProviderRequest): Promise<NssAskResponse> {
      const model = await resolveModel();
      const res = await fetch(new URL("chat/completions", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          temperature: input.budget.temperature,
          max_tokens: input.budget.maxOutputTokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LM Studio request failed (${res.status}): ${text}. Is LM Studio running at ${baseUrl}?`);
      }

      const payload = (await res.json()) as OpenAICompatResponse;
      if (payload.error?.message) throw new Error(`LM Studio error: ${payload.error.message}`);

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("LM Studio returned no content.");

      return normalizeStructuredModelResponse(content, buildResponseTitle(input.request));
    },
    async *generateStream(input: ResponseOsProviderRequest): AsyncGenerator<string> {
      const model = await resolveModel();
      const res = await fetch(new URL("chat/completions", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: buildMessages(input),
          temperature: input.budget.temperature,
          max_tokens: input.budget.maxOutputTokens,
          stream: true,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });

      if (!res.ok || !res.body) {
        throw new Error(`LM Studio stream failed (${res.status}). Is LM Studio running at ${baseUrl}?`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.replace(/^data:\s*/, "").trim();
          if (!trimmed || trimmed === "[DONE]") continue;
          try {
            const chunk = JSON.parse(trimmed) as OpenAICompatResponse;
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) yield token;
          } catch {}
        }
      }
    },
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
