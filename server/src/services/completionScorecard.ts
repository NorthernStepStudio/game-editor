export type CompletionStage =
  | "missing"
  | "planned"
  | "implemented"
  | "local_verified"
  | "live_verified"
  | "production_ready";

export interface MatterhornCompletionRequirement {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly stage: CompletionStage;
  readonly evidence: string;
  readonly next: string;
}

export interface MatterhornCompletionPillar {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly target: string;
  readonly requirements: readonly MatterhornCompletionRequirement[];
}

const STAGE_FACTOR: Readonly<Record<CompletionStage, number>> = {
  missing: 0,
  planned: 0.10,
  implemented: 0.45,
  local_verified: 0.65,
  live_verified: 0.85,
  production_ready: 1,
};

export const MATTERHORN_100_PILLARS: readonly MatterhornCompletionPillar[] = [
  {
    id: "intent-planning",
    label: "Intent & planning",
    weight: 10,
    target: "A high-level request becomes an editable, persistent, specialist-owned plan with measurable acceptance.",
    requirements: [
      { id: "goal-planner", label: "High-level goal to deterministic plan", weight: 3, stage: "implemented", evidence: "Recovered multi-domain planner is active on the canonical autonomy branch.", next: "Run the canonical local planner suite after consolidation." },
      { id: "dependency-graph", label: "Multi-specialist dependency graph", weight: 3, stage: "implemented", evidence: "Foundry -> Forge -> Flyrail -> QA dependency planning is present.", next: "Live-prove a mixed-domain request on the canonical branch." },
      { id: "persistent-editable-plan", label: "Persistent editable plan document", weight: 2, stage: "planned", evidence: "Plan review exists, but plans are not yet a durable editable artifact.", next: "Persist plan revisions and resume execution from the accepted revision." },
      { id: "plan-disclosures", label: "Plan review + provider/cost disclosures", weight: 2, stage: "implemented", evidence: "Studio plan review displays specialist routing, dependencies, and provider policy disclosures.", next: "Local UI test and approval-state review." },
    ],
  },
  {
    id: "intelligence-memory",
    label: "Intelligence & project memory",
    weight: 10,
    target: "Matterhorn remembers the project, continues durable sessions, and can hand discussion into execution without losing context.",
    requirements: [
      { id: "model-runtime", label: "Provider-neutral agent runtime", weight: 2, stage: "implemented", evidence: "PR #11 Intelligence Layer recovered with provider/model routing and tool loop.", next: "Run recovered Intelligence Layer tests locally." },
      { id: "durable-sessions", label: "Durable agent sessions", weight: 2, stage: "implemented", evidence: "Disk-backed intelligence sessions and approval resume APIs are active.", next: "Verify restart/continue behavior on canonical branch." },
      { id: "chat-migration", label: "Chat uses durable Intelligence sessions", weight: 2, stage: "planned", evidence: "Standalone Chat still uses legacy /ask.", next: "Move Chat to session APIs with approval cards." },
      { id: "project-memory", label: "Auditable project memory/map", weight: 2, stage: "planned", evidence: "Run history exists, but accepted decisions/repair patterns are not yet a canonical project memory layer.", next: "Build local-first project map and memory from project/run evidence." },
      { id: "chat-to-studio", label: "Conversation -> reviewed Studio plan handoff", weight: 2, stage: "planned", evidence: "No direct durable session-to-plan transition yet.", next: "Add 'Turn this into a plan' using the same project/session context." },
    ],
  },
  {
    id: "godot-autonomy",
    label: "Godot autonomy / Flyrail",
    weight: 15,
    target: "Matterhorn can implement, run, observe, repair, and prove real Godot gameplay through Flyrail.",
    requirements: [
      { id: "flyrail-specialist", label: "Bounded Flyrail Godot specialist", weight: 3, stage: "live_verified", evidence: "Genuine autonomous pipeline run: Matterhorn plan -> Flyrail loop -> live Godot 4.7.2 headless execution verified with real task/plan IDs and commit cp_db95f483-1d86-4e5c-9253-c6d711459b6c.", next: "Full-scene pipeline integration." },
      { id: "godot-ai", label: "Godot AI editor backend", weight: 3, stage: "implemented", evidence: "Godot AI bridge/hybrid backend is integrated behind Flyrail.", next: "Install/configure upstream plugin on PC and run live editor gate." },
      { id: "codex-worker", label: "Autonomous implement/repair worker", weight: 3, stage: "implemented", evidence: "Bounded Codex Godot worker is wired into implement/repair passes.", next: "Live-prove a real Yun change with Godot AI available." },
      { id: "playtest-repair", label: "Run/playtest/evidence/repair loop", weight: 3, stage: "local_verified", evidence: "Flyrail deterministic playtest, same-seed repair and evidence paths have prior validation.", next: "Re-run the canonical end-to-end gate." },
      { id: "proof-recording", label: "Final proof recording + watch-back", weight: 3, stage: "planned", evidence: "Replay/movie evidence exists in parts, but Godogen-style mandatory final proof review is not enforced.", next: "Add short final proof capture and Sentinel review requirement." },
    ],
  },
  {
    id: "asset-production",
    label: "Asset production",
    weight: 15,
    target: "Canvas, Foundry, Forge, Motion and Audio can create production assets with provenance and engine proof.",
    requirements: [
      { id: "canvas-foundry", label: "Canvas / Foundry 2D generation", weight: 2.5, stage: "implemented", evidence: "Foundry catalog/providers/provenance are recovered and Canvas is bound to Foundry.", next: "Local test catalog/provider/UI on canonical branch." },
      { id: "forge", label: "Forge / Blender typed production", weight: 3, stage: "local_verified", evidence: "Typed Blender pipeline and previous Yun character/environment gates exist.", next: "Re-run focused Forge tests after consolidation." },
      { id: "character-consistency", label: "Character Studio consistency loop", weight: 2.5, stage: "implemented", evidence: "Phase 1 persistent Character Studio exists, but real generation/consistency gate is unfinished.", next: "Connect ComfyUI generation, canonical references and Sentinel consistency checks." },
      { id: "motion", label: "Motion animation specialist", weight: 2, stage: "planned", evidence: "Motion is defined but not production-integrated.", next: "Bind animation authoring/retargeting provider and evidence contract." },
      { id: "three-d-provider", label: "Optional reference/image -> 3D provider", weight: 2, stage: "planned", evidence: "Forge cleanup exists; TRELLIS/other candidate provider is not integrated.", next: "Evaluate local TRELLIS provider behind Forge, with license/GPU gate." },
      { id: "audio-provider", label: "Commercially compatible audio provider", weight: 3, stage: "planned", evidence: "Foundry audio types exist but no production provider is active.", next: "Evaluate Stable Audio-compatible provider under commercial-use policy." },
    ],
  },
  {
    id: "game-systems",
    label: "Gameplay systems & PvE",
    weight: 10,
    target: "Matterhorn can build common real-game systems instead of only isolated feature edits.",
    requirements: [
      { id: "generic-gameplay", label: "Generic gameplay/code changes", weight: 3, stage: "local_verified", evidence: "Flyrail can execute bounded generic Godot implementation and repair.", next: "Live-prove on the canonical branch with a Yun gameplay request." },
      { id: "limbo-ai", label: "Reusable PvE AI capability pack", weight: 2, stage: "planned", evidence: "LimboAI candidate is in the OSS master plan but not integrated.", next: "Add optional behavior-tree/HSM capability pack for compatible projects." },
      { id: "procedural", label: "Procedural/WFC generation pack", weight: 2, stage: "planned", evidence: "Candidate is planned only.", next: "Add seeded procedural-generation adapter and reachability validation." },
      { id: "dialogue", label: "Dialogue/narrative capability pack", weight: 1, stage: "planned", evidence: "Dialogic candidate is planned only.", next: "Add optional Dialogic project capability pack." },
      { id: "world-tools", label: "Terrain / VFX production packs", weight: 2, stage: "planned", evidence: "Terrain3D/shader packs are identified but not integrated.", next: "Add only when a project needs them, with provenance and compatibility checks." },
    ],
  },
  {
    id: "sentinel-proof",
    label: "Sentinel & proof",
    weight: 10,
    target: "No task completes without independent, criterion-specific proof from the real output.",
    requirements: [
      { id: "criteria", label: "Fail-closed criterion evidence", weight: 3, stage: "live_verified", evidence: "Genuine fail-closed criterion verification: impossible criterion produced blocked result in Flyrail and blocked Matterhorn run; valid criteria produced passed results.", next: "Visual and performance criterion evidence." },
      { id: "sentinel", label: "Independent Sentinel validator", weight: 2, stage: "live_verified", evidence: "Genuine independent Sentinel evaluation: verified 3 Flyrail criterion results in positive run and blocked execution on unsatisfied criterion in negative run.", next: "Cross-specialist multi-domain Sentinel evidence." },
      { id: "visual-baseline", label: "Executable visual target/baseline checks", weight: 2, stage: "planned", evidence: "Visual-target workflow skill exists, but enforcement is not yet executable Sentinel evidence.", next: "Wire fresh screenshots into baseline/similarity criteria." },
      { id: "gdunit", label: "Godot unit/scene test adapter", weight: 1.5, stage: "planned", evidence: "GdUnit4 adoption is planned.", next: "Add optional test adapter and convert results to criterion evidence." },
      { id: "perf-mobile-video", label: "Performance/mobile/video proof gates", weight: 1.5, stage: "planned", evidence: "Pieces exist, but one unified release-grade gate is missing.", next: "Add budgets, target-device/export checks and final proof recording." },
    ],
  },
  {
    id: "delivery",
    label: "Repo, build & release",
    weight: 10,
    target: "Matterhorn can safely package, export, validate, roll back, and prepare a release without ad-hoc manual repository work.",
    requirements: [
      { id: "engine-export", label: "Godot export capability", weight: 2, stage: "implemented", evidence: "Flyrail exposes export capability, but canonical release proof is incomplete.", next: "Run export gate on the canonical integration." },
      { id: "repo-build-agent", label: "Repo / Build specialist", weight: 3, stage: "planned", evidence: "Specialist is defined but not bound.", next: "Implement isolated worktree, dirty-tree checks, package/release evidence." },
      { id: "local-validation", label: "Local validation harness", weight: 2, stage: "implemented", evidence: "Focused/local scripts and tests exist across Matterhorn/Flyrail.", next: "Make the canonical gate one command and persist results into readiness evidence." },
      { id: "mobile", label: "Mobile/export target gates", weight: 2, stage: "planned", evidence: "Mobile support remains a product requirement but is not a release gate.", next: "Add mobile input/UI/performance/export validation." },
      { id: "release-control", label: "Human release approval + rollback", weight: 1, stage: "planned", evidence: "Release promotion is policy-only today.", next: "Create explicit release approval and rollback artifact." },
    ],
  },
  {
    id: "product-ux",
    label: "Product UX",
    weight: 8,
    target: "The user can understand what Matterhorn is doing, approve risky actions, inspect live output, and continue work without developer tooling.",
    requirements: [
      { id: "studio-lifecycle", label: "Standalone Studio lifecycle UI", weight: 2, stage: "implemented", evidence: "Ask/Plan/Build/Verify/Repair/Complete UI is present.", next: "Local browser test after consolidation." },
      { id: "asset-routing-ui", label: "Assets + routing/settings UI", weight: 1.5, stage: "implemented", evidence: "Foundry catalog and routing controls are connected.", next: "Local browser/UI validation." },
      { id: "live-output", label: "Useful live activity/output/preview", weight: 1.5, stage: "implemented", evidence: "Activity/output surfaces exist but are not yet complete Aura-like live project feedback.", next: "Stream specialist/tool/preview events into one coherent live view." },
      { id: "approval-ui", label: "Approval cards for risky tool/provider actions", weight: 1.5, stage: "planned", evidence: "Approval state exists in APIs; standalone UI does not expose it yet.", next: "Add approve/deny cards to durable Chat/Studio." },
      { id: "durable-chat-ui", label: "Persistent project-scoped Chat", weight: 1.5, stage: "planned", evidence: "Legacy Chat is one-shot.", next: "Migrate to Intelligence sessions." },
    ],
  },
  {
    id: "reliability",
    label: "Reliability & scale",
    weight: 7,
    target: "Long-running work survives restarts, stops safely, avoids conflicts, and can scale to parallel specialists.",
    requirements: [
      { id: "queue", label: "Safe work queue", weight: 1.5, stage: "implemented", evidence: "Overlapping Studio work queues instead of being rejected.", next: "Local concurrency/queue test." },
      { id: "restart", label: "Safe restart recovery", weight: 1.5, stage: "implemented", evidence: "Untouched queued work resumes; uncertain remote work remains fail-closed.", next: "Restart recovery test on canonical branch." },
      { id: "bounded-repair", label: "Bounded retry/repair loops", weight: 1.5, stage: "local_verified", evidence: "Flyrail has bounded repair and same-seed comparisons.", next: "Canonical live proof." },
      { id: "watchdog-stop", label: "Global watchdog + emergency stop", weight: 1, stage: "planned", evidence: "Per-tool/run timeouts exist, but Matterhorn-level stop-all is missing.", next: "Add global watchdog and stop-all control." },
      { id: "locks-parallel", label: "Resource locks + safe parallel lanes", weight: 1.5, stage: "planned", evidence: "Parallel mutation is deliberately deferred.", next: "Add ownership/lease/conflict controls before enabling parallel writers." },
    ],
  },
  {
    id: "safety-provenance",
    label: "Safety, cost & provenance",
    weight: 5,
    target: "Every external action, asset and release has bounded permissions, cost/license information and traceable provenance.",
    requirements: [
      { id: "local-transport", label: "Local/loopback tool transport safety", weight: 1, stage: "implemented", evidence: "Matterhorn is loopback-bound; Flyrail legacy bridge rejects non-loopback endpoints.", next: "Local security regression tests." },
      { id: "cost-policy", label: "Network/external-cost approval and budgets", weight: 1.5, stage: "implemented", evidence: "Foundry routing and per-request cost approval are active.", next: "Expose all pending approvals in product UI and cross-run usage ledger." },
      { id: "provenance", label: "Asset hashes/lineage/license metadata", weight: 1.5, stage: "implemented", evidence: "Foundry persists hashes, provider identity and lineage.", next: "Extend the same provenance contract through all 3D/audio providers and final release manifest." },
      { id: "source-harvester", label: "OSS/source/license adoption registry", weight: 1, stage: "planned", evidence: "Master plan exists; machine-readable source harvester does not.", next: "Add reviewed source registry so future research cannot be lost or adopted unsafely." },
    ],
  },
];

export interface MatterhornCompletionScorecard {
  readonly metric: "Matterhorn 100";
  readonly target: 100;
  readonly capabilityCoverage: number;
  readonly productionReadiness: number;
  readonly status: "red" | "amber" | "green";
  readonly branch: string;
  readonly updatedAt: string;
  readonly pillars: readonly (MatterhornCompletionPillar & {
    readonly capabilityCoverage: number;
    readonly productionReadiness: number;
  })[];
  readonly criticalNext: readonly string[];
  readonly definitionOf100: readonly string[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildMatterhornCompletionScorecard(): MatterhornCompletionScorecard {
  const totalWeight = MATTERHORN_100_PILLARS.reduce((sum, pillar) => sum + pillar.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.0001) throw new Error(`Matterhorn 100 pillar weights must total 100; got ${totalWeight}.`);

  const pillars = MATTERHORN_100_PILLARS.map(pillar => {
    const requirementWeight = pillar.requirements.reduce((sum, requirement) => sum + requirement.weight, 0);
    if (Math.abs(requirementWeight - pillar.weight) > 0.0001) {
      throw new Error(`Matterhorn 100 requirement weights for ${pillar.id} must total ${pillar.weight}; got ${requirementWeight}.`);
    }
    const capabilityCoverage = pillar.requirements.reduce(
      (sum, requirement) => sum + (["implemented", "local_verified", "live_verified", "production_ready"].includes(requirement.stage) ? requirement.weight : 0),
      0,
    );
    const productionReadiness = pillar.requirements.reduce(
      (sum, requirement) => sum + requirement.weight * STAGE_FACTOR[requirement.stage],
      0,
    );
    return {
      ...pillar,
      capabilityCoverage: round1((capabilityCoverage / pillar.weight) * 100),
      productionReadiness: round1((productionReadiness / pillar.weight) * 100),
    };
  });

  const implementedWeight = MATTERHORN_100_PILLARS.flatMap(pillar => pillar.requirements).reduce(
    (sum, requirement) => sum + (["implemented", "local_verified", "live_verified", "production_ready"].includes(requirement.stage) ? requirement.weight : 0),
    0,
  );
  const readiness = MATTERHORN_100_PILLARS.flatMap(pillar => pillar.requirements).reduce(
    (sum, requirement) => sum + requirement.weight * STAGE_FACTOR[requirement.stage],
    0,
  );
  const productionReadiness = round1(readiness);

  return {
    metric: "Matterhorn 100",
    target: 100,
    capabilityCoverage: round1(implementedWeight),
    productionReadiness,
    status: productionReadiness >= 90 ? "green" : productionReadiness >= 60 ? "amber" : "red",
    branch: "integration/studio-autonomy-20261003",
    updatedAt: "2026-10-03",
    pillars,
    criticalNext: [
      "Run the canonical local Matterhorn + Flyrail gate after the PR #10/#11/Godot-AI consolidation.",
      "Live-prove one real Yun feature from Matterhorn plan through Flyrail/Godot to Sentinel acceptance.",
      "Move Chat to durable Intelligence sessions and expose approvals in the standalone UI.",
      "Make visual-target proof executable and add final proof recording/watch-back.",
      "Finish missing production specialists/capability packs: Motion, audio, PvE, Repo/Build and mobile/release gates.",
    ],
    definitionOf100: [
      "A high-level game request becomes a persistent editable plan with measurable acceptance.",
      "Matterhorn selects and coordinates the correct specialists without unsafe duplicate authority.",
      "Code, 2D, 3D, animation and audio assets can be created with provenance, cost and license evidence.",
      "The actual game runs; unit/scenario/playtest/visual/performance/mobile gates produce real evidence.",
      "Failures are diagnosed and repaired within bounded budgets and are re-tested against the same requirement.",
      "Sentinel independently verifies every required criterion; missing proof blocks completion.",
      "Project context and durable sessions survive restarts without blindly replaying uncertain mutations.",
      "Repo/Build can package/export/release with rollback and explicit human release approval.",
      "Parallel work is conflict-safe before multiple mutating specialists are enabled.",
      "A production release can be completed without requiring VS Code/Cursor as the user-facing control plane.",
    ],
  };
}
