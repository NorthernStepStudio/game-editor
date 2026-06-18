---
name: Provider architecture
description: How the 7 AI providers are structured and wired together in core
---

## Rule
All providers live in `core/src/providers/*.ts` and implement `ResponseOsProvider` from `core/src/core/types.ts`. Provider factory is `core/src/providers/provider.ts`. Server config is `server/src/config/env.ts`.

## Providers
- `mock` / `off` — built-in, no external calls
- `gemini` — Google Gemini, uses `generateContent` (blocking) and `streamGenerateContent?alt=sse` (streaming)
- `openai` — OpenAI, uses `/v1/chat/completions` with `stream: true/false`
- `anthropic` — Anthropic, uses `/v1/messages` with `stream: true/false`
- `ollama` — local Ollama at `OLLAMA_BASE_URL` (default `http://localhost:11434`), uses `/api/chat`
- `lmstudio` — local LM Studio at `LMSTUDIO_BASE_URL` (default `http://localhost:1234/v1`), OpenAI-compatible

## Env vars
| Provider | Key vars |
|----------|----------|
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| Ollama | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |
| LM Studio | `LMSTUDIO_BASE_URL`, `LMSTUDIO_MODEL` |

## Auto-detection order
Gemini key → OpenAI key → Anthropic key → Mock

**Why:** Each provider file is self-contained; adding a new provider only requires a new file + one switch case in `provider.ts` + env vars in `env.ts`.
