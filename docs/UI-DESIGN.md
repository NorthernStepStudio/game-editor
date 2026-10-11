# Matterhorn UI contract

Status: canonical product UI for the current Matterhorn feature set.

The web product must organize capabilities that actually exist. Do not invent finished-looking product surfaces for planned capabilities.

## Primary navigation

Matterhorn has exactly seven primary pages:

1. **Home** — "Your studio" capability cards (Agent, Asset Generator, Game Engine; every status line read from a live endpoint), create a run, active work, attention items, recent runs.
2. **Create** — Character Studio workbench (`#create`, `#characters/<mode>` for model3d, art2d, refine, motion, game-preview). Replaces the former Assets → Motion Studio tab.
3. **Runs** — one guided production flow: Plan → Build → Validate → Repair → Verified → Promote.
4. **Projects** — configured projects, files, proposals/change sets, project validations, run handoff.
5. **Assets** — Foundry catalog, filters, generation entry point, provenance/lineage inspector.
6. **Validation** — Sentinel/run evidence summarized as passed, pending/attention, and failed.
7. **Settings** — AI providers, routing, runtime capabilities, specialists/readiness under Advanced.

Do not add an eighth primary page without a real, implemented backend workflow and an explicit product decision.

## Secondary surfaces

These are contextual, not primary navigation:

- **Chat** — assistant drawer.
- **Asset generation** — drawer opened from Assets.
- **Asset inspection** — drawer opened by selecting an asset.
- **Promotion approval** — part of a verified Run; not a separate Releases product.
- **Specialists** — Advanced Settings plus contextual labels inside Runs.
- **Matterhorn 100** — Advanced Settings; it is product/readiness information, not a creation dashboard.

## Planned capabilities must not masquerade as finished UI

Until implementation is production-usable:

- no top-level **Releases** page;
- no top-level **Characters** page (character work lives in Create);
- no top-level **Specialists** page;
- no top-level **Project Memory** knowledge center;
- no Motion or Repo/Build controls that imply those planned agents are active.

When these capabilities become real, update the backend status and this UI contract together.

## Visual system

Use the approved Matterhorn studio design:

- dark navy workspace;
- narrow persistent left navigation;
- restrained electric-blue active state;
- subtle borders rather than stacked glowing panels;
- one obvious primary action per surface;
- progressive disclosure instead of showing every control at once;
- compact status pills for running/passed/blocked/approval states;
- generous negative space;
- no decorative AI gradients, fake analytics, invented progress percentages, or fabricated previews;
- system plumbing lives in Settings, not Home.

Home should answer only: **What can I ask Matterhorn to do? What is running? What needs me?** The capability cards answer the first question; a card must show Unknown/Offline/Not configured rather than imply readiness.

Runs should answer only: **What stage is this run in? Who is working? What proof exists? Does promotion need me?**

Validation should answer only: **What passed, what needs attention, what failed, and what evidence supports it?**

## Product identity

Normal UI uses Matterhorn names:

- Project memory
- Local browser
- Safe execution
- Run insights
- Agent validation

Underlying Graphiti, Browser Harness, DeepEval, Langfuse/OTLP backends, container engines, and other adopted projects belong in diagnostics/provenance/license records, not normal user-facing navigation.

## Compatibility

Existing deep links may redirect:

- `#studio` / `#create` → Home
- `#pipeline` / `#output` → Runs
- `#evidence` → Validation
- `#specialists` → Settings / Advanced
- `#chat` → assistant drawer

The standalone UI regression test must preserve the seven-page navigation contract.
