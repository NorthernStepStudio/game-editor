---
name: Conversation history
description: How multi-turn history flows from web UI through to providers
---

## Rule
`NssAskRequestPayload.history?: readonly NssChatMessage[]` carries prior turns. Web UI maintains `conversationHistory[]` in memory (last 20 turns sent per request). Providers map it to their native format.

## Provider mapping
- Gemini: `history` → `contents[]` with `role: "user" | "model"` (assistant maps to "model")
- OpenAI / LM Studio: `history` → `messages[]` after the system prompt, before the current user turn
- Anthropic: `history` → `messages[]` (no system message in messages array; system is a top-level field)
- Ollama: same as OpenAI pattern

**Why:** Each provider needs the history in a different shape; the mapping is in the provider file itself, not in the runtime or types.
