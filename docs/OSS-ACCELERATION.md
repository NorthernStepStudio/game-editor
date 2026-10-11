# Matterhorn OSS acceleration plan

## Goal

Finish Matterhorn faster by reusing mature open-source infrastructure where it is better than unfinished custom infrastructure, while keeping the product unmistakably Matterhorn.

The default decision order is:

`reuse → integrate → customize → build only when needed`

This is not a plan to assemble unrelated frameworks into the UI. Matterhorn remains the product and control plane. Reused software is implementation machinery behind Matterhorn-owned capabilities.

## Product identity boundary

External engines must not define Matterhorn's navigation, agent names, workflow vocabulary, project data model or visual identity.

User-facing names remain Matterhorn concepts:

- Project memory
- Local browser
- Safe execution
- Run insights
- Agent validation

Upstream project names, source URLs and licenses are internal diagnostic/provenance data. They may appear in developer diagnostics and required third-party notices, but not as primary product branding.

Matterhorn continues to own Studio, Chat, Projects, Evidence, Settings, Agent Foundry, specialist routing, Flyrail/Godot, Forge/Blender, Sentinel policy, game-development contracts and final completion decisions.

## First integration: Local browser

Status: **foundation implemented on `integration/oss-acceleration-rebased-20261003`.**

Matterhorn now defines a provider-neutral `MatterhornBrowserAdapter` and `MatterhornRuntimeCapabilityRegistry`.

The first implementation talks to the local HTTP bridge exposed by Browser Harness JS, an MIT-licensed TypeScript CDP runtime. Matterhorn does not import its UI, naming or agent loop. The upstream runtime is used only as a local browser execution engine.

Pinned upstream commit:

`2d9a5ed37ed11f31b2622cd69c4b55f979cb905f`

Source:

`https://github.com/browser-use/browser-harness-js`

Why this is a good first reuse:

- direct Chrome DevTools Protocol access rather than another orchestration layer;
- persistent browser session;
- works as a small local sidecar;
- TypeScript implementation;
- MIT license;
- Matterhorn can keep planning, permissions, evidence and UI above it.

The adapter accepts only a loopback HTTP endpoint. It currently exposes bounded Matterhorn operations for connect, list tabs, choose tab, HTTP(S) navigation, title inspection and screenshots. Arbitrary upstream branding is not returned through the public runtime-status API.

Windows setup helper:

`tools/setup-matterhorn-local-browser.ps1`

The helper checks out the exact pinned commit and starts its local runtime with Bun. It does not track an unpinned `latest` branch at runtime.

## Runtime capability seam

`core/src/integrations/runtimeCapabilities.ts` is the stable Northern Step boundary for reusable engines.

The public registry deliberately separates:

1. **public capability status** — Matterhorn names and health only;
2. **internal diagnostics** — adapter id, implementation provenance and license.

Studio events can be forwarded through the same registry to an optional telemetry adapter. Observability failures never control or complete execution.

This boundary is where the remaining reusable engines should attach rather than spreading framework-specific objects across Studio.

## Next acceleration targets

### Project memory

Status: **Matterhorn contract, Graphiti HTTP adapter, server registration, explicit remember/search APIs, temporal-fact mapping, project scoping, and regression coverage implemented.**

Graphiti v0.30.2 is the first backend. Matterhorn owns the API and project IDs; Graphiti remains a replaceable temporal-knowledge engine behind `MatterhornProjectMemoryAdapter`. Automatic ingestion is deliberately off until a local/provider configuration is explicitly chosen, so memory cannot silently create model/API spend.

Required Matterhorn behavior:

- current truth can supersede old facts without deleting history;
- branch/PR/validation facts carry timestamps and provenance;
- retrieval is project-scoped;
- private project context remains local/self-hosted by default;
- memory failure does not invent state.

Local setup (`tools/setup-matterhorn-project-memory.ps1`, Python 3.12+):

- **Graph engine:** FalkorDB Lite ships no Windows build, so `-GraphEngine auto` installs `graphiti-core[kuzu]` on Windows and FalkorDB Lite elsewhere; the service reads `MATTERHORN_MEMORY_GRAPH_ENGINE`. Kuzu's Graphiti driver has no `health_check`, so `/healthcheck` falls back to a `RETURN 1` query.
- **Models:** local Ollama through its OpenAI-compatible endpoint, e.g. `-LlmBaseUrl http://127.0.0.1:11434/v1 -LlmModel gemma4:12b -EmbeddingModel nomic-embed-text -EmbeddingDim 768`. The first start downloads the BGE reranker.
- **Port:** pick a free one with `-Port` (this PC uses 8765 because another app holds 8000) and set `MATTERHORN_PROJECT_MEMORY_URL` plus the `MATTERHORN_MEMORY_*` model settings in the root `.env`; `npm run studio` then starts the service with the rest of the stack.

### Run insights

Status: **standard OTLP/HTTP JSON exporter implemented and connected to Studio events.**

`MatterhornOtlpRunInsightsAdapter` exports Matterhorn event shapes as OpenTelemetry spans only when `MATTERHORN_OTLP_TRACES_URL` is configured. Langfuse v4.50.0 can receive these through its native `/api/public/otel/v1/traces` endpoint, but Matterhorn has no Langfuse SDK dependency and can use another OTLP backend.

Required events include run/task lifecycle, model/provider, tools, retries, timing, token/cost data when available, evidence references and failure categories.

### Agent validation

Status: **Matterhorn advisory-evaluation contract and pinned DeepEval TypeScript 0.9.21 sidecar implemented.**

The evaluator is separately installed so the Matterhorn lockfile and deterministic CI do not inherit the evaluation framework. A Studio run can be evaluated through Matterhorn's run endpoint when the sidecar is explicitly configured. The score is advisory only.

Sentinel remains the Matterhorn validator. Third-party metric names should be normalized into Matterhorn criteria/evidence rather than becoming the product contract.

### Safe execution

Status: **local OCI adapter foundation implemented.**

E2B 2.52.0 was evaluated. Its Apache-2.0 design is useful, but its self-host path remains infrastructure/cloud-oriented, so it is not a required Matterhorn dependency. Matterhorn instead has an optional Docker/Podman-style OCI adapter with server-approved profiles, no network, read-only root, dropped capabilities, no-new-privileges, PID/memory/CPU ceilings, tmpfs, bounded output, and read-only source mounts. It registers only when `MATTERHORN_SANDBOX_PROFILES` is configured.

E2B may remain an optional future provider for teams that deliberately choose hosted sandboxes.

### Durable workflow primitives

Do not replace Matterhorn's control plane simply because LangGraph, Mastra, Agno or PydanticAI offer orchestration.

Before implementing a missing durability primitive, compare contained reuse for:

- checkpoints;
- suspend/resume;
- human approval;
- typed tool contracts;
- retries;
- durable state;
- resumable workflows.

Only adopt a framework runtime if it can sit behind Matterhorn's existing control plane without creating competing agent ownership.

## CI budget rule

The repository's current workflow runs on pushes to `master` and `feat/**`, plus pull requests. To avoid wasting CI minutes during integration work:

- do development on `integration/**` branches;
- do not open the PR until the batch has been statically reviewed and local checks are ready;
- do not push a chain of small commits to `feat/**`;
- intentionally trigger CI once for the review-ready batch;
- use the real Windows/Godot/Blender/Flyrail gates separately only when their prerequisites are available.

CI failures must be inspected before another intentional CI run. Do not repeatedly push speculative fixes into a CI-triggering branch.

## Acceptance for an adopted component

A reused component is accepted only when:

1. its license is compatible and required notices are preserved;
2. the exact version/commit is pinned where reproducibility matters;
3. it is hidden behind Matterhorn-owned contracts;
4. its failure mode is explicit and fail-safe;
5. it does not weaken Sentinel/evidence requirements;
6. it can be removed/replaced without changing Matterhorn's product vocabulary;
7. deterministic tests cover the Matterhorn boundary;
8. no upstream UI or branding leaks into the normal product experience.


## Gate 0 integration note

The current validation candidate is `integration/oss-acceleration-rebased-20261003`, based on the October 3 autonomy line at `389d8adbc2bb748df6311b07896673933a59cad3`.

No additional autonomy feature should be added until the Matterhorn and Flyrail local Gate 0 commands in `docs/GATE-0-AUTONOMY-VALIDATION.md` pass. The acceleration modules are part of that local gate. Remote CI is not a substitute.
