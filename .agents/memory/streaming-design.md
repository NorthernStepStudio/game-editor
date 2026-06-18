---
name: Streaming design
description: How token streaming flows from provider to web UI
---

## Rule
Providers optionally implement `generateStream?(input): AsyncGenerator<string>`. The runtime's `stream()` method delegates to it, or falls back to blocking `generate()` emitting the full response as one token.

## Server-side
`server/src/server.ts` checks `Accept: text/event-stream` on POST `/ask`. If set, calls `streamAskRequest()` from `askService.ts` which calls `runtime.stream()`. Tokens emitted as `data: {"token":"..."}\n\n`. Final event: `data: {"done":true}\n\n`. Errors: `data: {"error":"..."}\n\n`.

## Client-side (web UI)
`web/main.js` sends `Accept: text/event-stream` and consumes the stream with `ReadableStream` reader. Creates a live `msg--streaming` bubble, updates `textContent` on each token. CSS uses `::after` with blinking cursor while streaming. Removes `msg--streaming` class when done.

**Why:** Avoids EventSource (doesn't support POST); uses fetch + ReadableStream instead, which works for arbitrary request bodies.
