# Matterhorn Intelligence Layer — Research and Architecture

Date: 2026-09-25

## Why this exists

Matterhorn already has basic chat providers for OpenAI, Anthropic, Gemini, Ollama, LM Studio, mock, and off modes. Those adapters can answer and stream text, but they do not yet form an IDE-grade autonomous coding runtime.

The Intelligence Layer adds the missing separation between:

1. model/provider transport,
2. model routing,
3. agent/tool loop,
4. tool policy and approvals,
5. stateful sessions,
6. workspace/context retrieval,
7. deterministic verification.

Matterhorn remains the product and orchestrator. Models are replaceable reasoning engines.

## Research summary

### Model APIs

#### OpenAI

Current OpenAI guidance uses the Responses API for modern tool calling. Function tools are JSON-schema-defined, and the model can request functions that the host executes. Newer models can defer rarely used tools through tool search.

Matterhorn implication:
- prefer Responses API for the new OpenAI intelligence adapter;
- do not expose provider-native tool objects outside the adapter;
- normalize tool calls/results into Matterhorn contracts.

Reference:
- https://developers.openai.com/api/docs/guides/function-calling

#### Anthropic

Anthropic Messages supports application-managed tool loops. The host owns state and executes client tools; Claude can also use provider-hosted server tools, but Matterhorn should keep repository mutation and local execution host-owned.

Matterhorn implication:
- Messages adapter maps Anthropic tool_use/tool_result blocks into canonical calls/results;
- do not grant provider-hosted tools access to local repositories.

References:
- https://docs.anthropic.com/
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview

#### Google Gemini

Gemini function calling lets the model choose declared functions and arguments while the application executes the function.

Matterhorn implication:
- map Gemini functionCall/functionResponse parts into the same Matterhorn tool protocol.

Reference:
- https://ai.google.dev/gemini-api/docs/function-calling

#### Ollama

Ollama provides local chat/model execution and supports tool-capable models. It remains a local provider option, not a special-case agent architecture.

Reference:
- https://docs.ollama.com/

#### LM Studio

LM Studio supports OpenAI-compatible Responses, Chat Completions, embeddings, and local model management. Responses compatibility means the OpenAI-style adapter surface can be reused while still treating LM Studio as a distinct local provider for policy/routing.

References:
- https://lmstudio.ai/docs/developer/openai-compat
- https://lmstudio.ai/docs/developer/rest

### Open-source agent architectures

No third-party source code should be copied into Matterhorn by default. The projects below are architecture references.

#### Cline — Apache-2.0

Useful patterns:
- provider-specific behavior isolated in an LLM/provider layer;
- stateless agent iteration/tool loop separated from stateful core/session orchestration;
- explicit tool policies: enabled/disabled and auto-approve/approval-required;
- session persistence, context compaction, provider configuration, and host tools belong above the agent loop;
- generated media/artifacts use canonical host-owned representations.

References:
- https://github.com/cline/cline/blob/main/sdk/ARCHITECTURE.md
- https://github.com/cline/cline/blob/main/docs/sdk/tools.mdx

#### OpenHands — MIT

Useful patterns:
- UI renders conversations, files, terminals, settings, and activity;
- UI does not directly execute agent actions or host credentials;
- execution/sandbox responsibilities stay behind the server boundary.

Reference:
- https://github.com/OpenHands/OpenHands/blob/main/docs/architecture.md

#### Aider — Apache-2.0

Useful patterns:
- strong separation between architect/reasoning and editor-oriented work;
- repository-context selection should be intentional instead of sending an entire repository every turn;
- cheaper/secondary models can handle summaries or supporting tasks.

Reference:
- https://github.com/Aider-AI/aider

#### Goose — Apache-2.0

Useful patterns:
- model-agnostic local agent;
- multi-model configuration;
- extension/tool ecosystem and MCP interoperability;
- desktop/CLI/API can share one agent runtime.

Reference:
- https://block.github.io/goose/

#### Continue — Apache-2.0, read-only as of 2026

Useful historical patterns:
- custom agents across IDE/CLI;
- chat/edit/agent/autocomplete as separate interaction modes;
- useful as a reference, but do not add it as an active dependency.

Reference:
- https://github.com/continuedev/continue

## Matterhorn design

### Layer 1 — Canonical model contract

Provider-native payloads never leak outside adapters.

Canonical types:
- model messages,
- tool definitions,
- tool calls,
- tool results,
- usage,
- provider/model capabilities,
- normalized stop reasons.

### Layer 2 — Model Gateway

Responsibilities:
- provider registration;
- model/capability discovery;
- task-role routing;
- local/cloud eligibility;
- cost/network policy;
- explicit provider/model override validation;
- fallback only when policy allows it.

The gateway does not execute tools.

### Layer 3 — Agent Runtime

Responsibilities:
- iterative model -> tool -> model loop;
- maximum turns/tool calls;
- cancellation;
- event emission;
- approval stops;
- deterministic loop termination;
- tool-call deduplication;
- no hidden side effects.

The runtime is stateless with respect to durable sessions.

### Layer 4 — Tool Host

Tools are owned by Matterhorn, never by the browser or provider.

Initial safe tools:
- list_files;
- read_file;
- search_files.

Mutation path:
- models propose changes;
- Matterhorn stages them through existing Workspace Review/Transaction machinery;
- applying changes remains an explicit approval action.

Terminal access:
- do not expose arbitrary shell execution in the first intelligence milestone;
- only bounded configured validation tasks should become executable tools initially.

### Layer 5 — Session Service

Durable session responsibilities:
- conversation/event history;
- chosen provider/model;
- usage and estimated cost;
- tool approvals;
- checkpoints;
- resumability;
- context compaction summaries.

### Layer 6 — Context Engine

Use bounded repository context:
- active project;
- selected/active file;
- repository file map;
- relevant search results;
- project rules;
- recent diagnostics;
- Studio plan/run state;
- Foundry/Blender/Flyrail evidence.

Do not dump the entire repository into every request.

### Layer 7 — Verification

The model does not decide that work is complete.

Matterhorn verifies:
- staged/applied file changes;
- configured validation results;
- Studio criteria/evidence;
- Flyrail runtime proof;
- Blender/Foundry artifact identity;
- final QA gate.

## Model roles

The routing layer should support logical roles rather than hard-coded model names:

- reasoning: architecture, hard debugging, planning;
- coding: code edits/refactors;
- fast: summaries/classification/simple questions;
- vision: screenshots/renders/image understanding;
- local: privacy/offline fallback.

A provider/model can satisfy multiple roles.

## Safety defaults

- local-first may be preferred but is not mandatory;
- network use is policy-controlled;
- paid-provider eligibility is separate from per-request approval;
- provider API keys remain server-side;
- browser receives provider availability/model metadata, never credentials;
- read-only tools may be auto-approved;
- mutations stage reviews/transactions by default;
- destructive/arbitrary terminal tools are disabled initially;
- loops have strict turn/tool limits;
- provider failure cannot silently switch to a paid/network provider unless routing policy explicitly permits fallback.

## Implementation phases

### Phase A — foundation (this branch)

- canonical intelligence contracts;
- provider registry/gateway;
- role/capability routing;
- agent tool loop;
- approval-aware tool policy;
- deterministic fake provider/tool tests;
- compatibility bridge from existing chat runtime.

### Phase B — native tool calling

- OpenAI Responses tool adapter;
- Anthropic Messages tool adapter;
- Gemini function-calling adapter;
- Ollama tool adapter;
- LM Studio Responses-compatible adapter.

### Phase C — server-owned workspace tools

- list/read/search;
- staged single/multi-file proposals;
- configured validations;
- approval queue.

### Phase D — durable sessions

- event log;
- resume;
- usage/cost;
- compaction;
- checkpoints.

### Phase E — Studio UI

- model/provider settings;
- model role routing;
- live agent activity;
- pending approvals;
- tool results;
- usage/cost;
- session history.

### Phase F — planner integration

The multi-domain Studio planner can invoke the Intelligence Layer for structured interpretation and planning, while deterministic routing/evidence validation remains authoritative.
