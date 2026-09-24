import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createYunAutonomousScenePlan, YUN_FULL_SCENE_FLYRAIL_CRITERIA } from "../studio/yunAutonomousScenePlan.js";
import { BlenderAdapter, findBlenderExecutable } from "../studio/adapters/blender/index.js";
import { DEFAULT_GODOT_BIN } from "../studio/adapters/flyrail/flyrailAssetValidation.js";
import { FlyrailAdapter } from "../studio/adapters/flyrail/flyrailAdapter.js";
import { SpecialistAdapterRegistry } from "../studio/run/registry.js";
import { StudioExecutionEngine } from "../studio/runController.js";
import type { NssStudioExecutionResult, NssStudioPlan } from "../studio/types.js";
import type { StudioRun } from "../studio/runTypes.js";

const FLYRAIL_REPO_ROOT = process.env.FLYRAIL_REPO_ROOT ? resolve(process.env.FLYRAIL_REPO_ROOT) : "";
const YUN_SOURCE = FLYRAIL_REPO_ROOT ? join(FLYRAIL_REPO_ROOT, "games", "yun") : "";
const ARTIFACT_ROOT = resolve(process.cwd(), "artifacts", "yun-autonomous-scene");
const NOCHED_GOAL = "Create a Yun Noche street scene with warm lamps, clear competitive visibility, six players, and a readable route from YUN through the tubes to TURN and back.";
const MALECON_GOAL = "Create a Yun Malecón full scene with bright open-air styling and clear player visibility.";

type RunCapture = {
  run: StudioRun;
  plan: NssStudioPlan;
  archiveDir: string;
  startedAt: string;
  durationMs: number;
  blenderDurationMs: number;
  flyrailDurationMs: number;
  generatedGlbBytes: number;
  blenderTaskId: string;
  blenderExecutionId: string;
  generatedGlbPath: string;
  flyrailTaskId: string;
  flyrailEvidencePath: string;
  featureText: string;
  evidenceBundle: Record<string, any>;
};

async function requirePrerequisites(): Promise<string> {
  const blender = findBlenderExecutable();
  assert.ok(blender, "Blender binary required by test:yun-autonomous-scene-live");
  assert.ok(FLYRAIL_REPO_ROOT && existsSync(join(FLYRAIL_REPO_ROOT, ".git")), "Set FLYRAIL_REPO_ROOT to the Flyrail checkout");
  assert.ok(existsSync(join(YUN_SOURCE, "project.godot")) && existsSync(join(YUN_SOURCE, "scripts", "match.gd")) && existsSync(join(YUN_SOURCE, "scenes", "match.tscn")), "Flyrail production Yun project fixture is required");
  assert.ok(existsSync(DEFAULT_GODOT_BIN), `Godot binary required by test:yun-autonomous-scene-live: ${DEFAULT_GODOT_BIN}`);
  const daemonUrl = new URL(process.env.FLYRAIL_DAEMON_URL || "ws://127.0.0.1:7520");
  daemonUrl.protocol = daemonUrl.protocol === "wss:" ? "https:" : "http:";
  daemonUrl.pathname = "/health";
  daemonUrl.search = "";
  const healthResponse = await fetch(daemonUrl, { signal: AbortSignal.timeout(8_000) });
  assert.ok(healthResponse.ok, `Flyrail daemon health returned HTTP ${healthResponse.status}`);
  const health = await healthResponse.json() as { product?: string; runtime?: string; bridge?: string };
  assert.equal(health.product, "flyrail", "Flyrail daemon required by live gate");
  assert.equal(health.runtime, "live", "Live Godot runtime required by live gate");
  assert.equal(health.bridge, "live", "Live Flyrail bridge required by live gate");
  return blender;
}

function copyDisposableYunProject(destination: string): void {
  cpSync(YUN_SOURCE, destination, {
    recursive: true,
    filter: (source) => {
      const rel = relative(YUN_SOURCE, source).replace(/\\/g, "/");
      if (/(^|\/)(\.godot|\.flyrail|build|multiplayer-relay|tests|_dl|\.git)(\/|$)/i.test(rel)) return false;
      // Force the new scene to use only the current Studio run's generated GLB.
      if (/^assets\/matterhorn\/yun_street_block_[^/]+\.glb(?:\.import)?$/i.test(rel)) return false;
      return true;
    },
  });
  assert.ok(existsSync(join(destination, "project.godot")));
  assert.equal(existsSync(join(destination, "assets", "matterhorn", "yun_street_block_noche_v1.glb")), false, "disposable project starts without an archived Noche GLB");
}

function createPlan(goal: string, projectPath: string): NssStudioPlan {
  return createYunAutonomousScenePlan({
    goal,
    godotProjectPath: projectPath,
    target: "disposable",
    playerCount: 6,
  });
}

function changePlayerCriterionToSeven(plan: NssStudioPlan): NssStudioPlan {
  const update = (criterion: string): string => {
    if (!criterion.startsWith("{")) return criterion;
    const parsed = JSON.parse(criterion) as Record<string, unknown>;
    if (parsed.id === "scene-player-count") parsed.expected = 7;
    return JSON.stringify(parsed);
  };
  return {
    ...plan,
    tasks: plan.tasks.map((task) => task.id === "assemble-validate-scene"
      ? { ...task, acceptanceCriteria: task.acceptanceCriteria.map(update) }
      : task),
    finalAcceptanceCriteria: plan.finalAcceptanceCriteria.map(update),
  };
}

async function executePlan(
  plan: NssStudioPlan,
  blender: string,
  blenderRoot: string,
  options: { removeGeneratedGlbAfterBlender?: boolean } = {},
): Promise<{ run: StudioRun; flyrail: FlyrailAdapter; engine: StudioExecutionEngine }> {
  const registry = new SpecialistAdapterRegistry();
  const blenderAdapter = new BlenderAdapter({ baseWorkDir: blenderRoot, blenderBin: blender });
  const flyrailAdapter = new FlyrailAdapter({ requestTimeoutMs: 600_000, connectTimeoutMs: 15_000 });
  registry.register(blenderAdapter);
  registry.register(flyrailAdapter);
  const additionalValidation = options.removeGeneratedGlbAfterBlender
    ? (task: Parameters<NonNullable<ConstructorParameters<typeof StudioExecutionEngine>[2]>>[0], result: NssStudioExecutionResult) => {
        if (task.specialistId === "blender-engine") {
          const glb = result.artifacts?.find((artifact) => artifact.kind === "glb")?.uri;
          if (glb && existsSync(glb)) rmSync(glb);
        }
        return { passed: true, failures: [] };
      }
    : undefined;
  const engine = new StudioExecutionEngine(registry, {
    taskTimeoutMs: 1_500_000,
    requestTimeoutMs: 600_000,
    pollIntervalMs: 500,
    maxReadRetries: 0,
    maxRuns: 5,
  }, additionalValidation);
  const runId = `yun-auto-${randomUUID()}`;
  engine.start(plan, runId);
  const deadline = Date.now() + 1_800_000;
  for (;;) {
    const run = engine.store.get(runId);
    assert.ok(run, `StudioExecutionEngine snapshot exists for ${runId}`);
    if (["completed", "failed", "blocked", "cancelled"].includes(run.status)) return { run, flyrail: flyrailAdapter, engine };
    if (Date.now() >= deadline) {
      engine.requestCancel(runId);
      throw new Error(`Studio run ${runId} did not reach a terminal state before the 30-minute limit; latest=${run.status}`);
    }
    await delay(500);
  }
}

async function runPositive(
  label: "noche-v1" | "malecon-v1",
  goal: string,
  blender: string,
): Promise<RunCapture> {
  const tempProject = mkdtempSync(join(tmpdir(), `matterhorn-yun-scene-${label}-`));
  const projectPath = join(tempProject, "yun-disposable");
  const archiveDir = join(ARTIFACT_ROOT, label);
  mkdirSync(archiveDir, { recursive: true });
  copyDisposableYunProject(projectPath);
  const plan = createPlan(goal, projectPath);
  writeFileSync(join(archiveDir, "user-goal.txt"), `${goal}\n`, "utf8");
  writeFileSync(join(archiveDir, "generated-plan.json"), JSON.stringify(plan, null, 2), "utf8");
  const blenderRoot = join(archiveDir, "blender-work");
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let flyrail: FlyrailAdapter | undefined;
  try {
    const execution = await executePlan(plan, blender, blenderRoot);
    const { run } = execution;
    flyrail = execution.flyrail;
    const durationMs = Date.now() - startedMs;
    assert.equal(run.status, "completed", run.detail ?? JSON.stringify(run.tasks));
    assert.ok(run.tasks.every((task) => task.status === "completed"), JSON.stringify(run.tasks));
    const blenderTask = run.tasks.find((task) => task.id === "generate-environment");
    const flyrailTask = run.tasks.find((task) => task.id === "assemble-validate-scene");
    assert.ok(blenderTask?.result && flyrailTask?.result);
    assert.equal(blenderTask.result.status, "completed");
    assert.equal(flyrailTask.result.status, "completed");
    const glb = blenderTask.result.artifacts?.find((artifact) => artifact.kind === "glb");
    const blenderManifest = join(dirname(glb?.uri ?? ""), "blender-result.json");
    assert.ok(glb?.uri && existsSync(glb.uri), "Blender generated current-run GLB exists");
    assert.equal(basename(dirname(glb.uri)), blenderTask.executionId, "dependency path is inside this Studio Blender task execution output");
    assert.ok(existsSync(blenderManifest), "Blender result manifest exists");
    const blenderReport = JSON.parse(readFileSync(blenderManifest, "utf8")) as Record<string, unknown>;
    assert.equal(blenderReport.taskId, blenderTask.executionId);
    assert.equal(typeof blenderReport.executionId, "string");
    const criterionResults = flyrailTask.result.criterionResults ?? [];
    assert.equal(criterionResults.length, YUN_FULL_SCENE_FLYRAIL_CRITERIA.length);
    assert.ok(criterionResults.every((criterion) => criterion.outcome === "passed" && criterion.evidenceUri), JSON.stringify(criterionResults));
    const flyrailBundlePath = flyrailTask.result.artifacts?.find((artifact) => artifact.kind === "evidence-bundle")?.uri;
    assert.ok(flyrailBundlePath && existsSync(flyrailBundlePath), "Flyrail returned a persisted evidence bundle");
    const evidenceBundle = JSON.parse(readFileSync(flyrailBundlePath, "utf8")) as Record<string, any>;
    const featureText = evidenceBundle.featureText;
    assert.equal(typeof featureText, "string");
    assert.ok(featureText.includes(glb.uri), "Flyrail loop.run feature text contains this exact current-run GLB path");
    assert.equal(evidenceBundle.dependencyArtifact?.sourceGlbPath, glb.uri);
    assert.equal(evidenceBundle.dependencyArtifact?.exactArtifactIdentity, true);

    const evidenceDir = dirname(flyrailBundlePath);
    cpSync(evidenceDir, join(archiveDir, "flyrail-evidence"), { recursive: true });
    mkdirSync(join(archiveDir, "generated"), { recursive: true });
    cpSync(glb.uri, join(archiveDir, "generated", basename(glb.uri)), { recursive: true });
    const snapshot = { ...run, durationMs, startedAt, finishedAt: new Date().toISOString() };
    writeFileSync(join(archiveDir, "final-studio-snapshot.json"), JSON.stringify(snapshot, null, 2), "utf8");
    writeFileSync(join(archiveDir, "flyrail-feature-text.txt"), featureText, "utf8");
    const capture: RunCapture = {
      run,
      plan,
      archiveDir,
      startedAt,
      durationMs,
      blenderDurationMs: Date.parse(blenderTask.finishedAt ?? "") - Date.parse(blenderTask.startedAt ?? ""),
      flyrailDurationMs: Date.parse(flyrailTask.finishedAt ?? "") - Date.parse(flyrailTask.startedAt ?? ""),
      generatedGlbBytes: statSync(glb.uri).size,
      blenderTaskId: blenderTask.executionId,
      blenderExecutionId: String(blenderReport.executionId),
      generatedGlbPath: glb.uri,
      flyrailTaskId: flyrailTask.executionId,
      flyrailEvidencePath: flyrailBundlePath,
      featureText,
      evidenceBundle,
    };
    writeFileSync(join(archiveDir, "run-summary.json"), JSON.stringify(capture, (_key, value) => value instanceof Map ? Object.fromEntries(value) : value, 2), "utf8");
    return capture;
  } finally {
    flyrail?.disconnect();
    if (process.env.KEEP_YUN_AUTONOMOUS_PROJECTS !== "1") rmSync(tempProject, { recursive: true, force: true });
  }
}

async function runNegativeArtifact(blender: string): Promise<Record<string, unknown>> {
  const label = "negative-missing-glb";
  const tempProject = mkdtempSync(join(tmpdir(), `matterhorn-yun-scene-${label}-`));
  const projectPath = join(tempProject, "yun-disposable");
  const archiveDir = join(ARTIFACT_ROOT, label);
  mkdirSync(archiveDir, { recursive: true });
  copyDisposableYunProject(projectPath);
  const plan = createPlan(NOCHED_GOAL, projectPath);
  const startedAt = new Date().toISOString();
  let flyrail: FlyrailAdapter | undefined;
  try {
    const execution = await executePlan(plan, blender, join(archiveDir, "blender-work"), { removeGeneratedGlbAfterBlender: true });
    const { run } = execution;
    flyrail = execution.flyrail;
    const blenderTask = run.tasks.find((task) => task.id === "generate-environment");
    const downstream = run.tasks.find((task) => task.id === "assemble-validate-scene");
    assert.equal(blenderTask?.status, "completed", "fault injection occurs only after Blender output validation");
    assert.ok(blenderTask?.result?.artifacts?.some((artifact) => artifact.kind === "glb"));
    assert.ok(downstream && ["failed", "blocked"].includes(downstream.status), JSON.stringify(downstream));
    assert.ok(["failed", "blocked"].includes(run.status), `missing GLB run remains ${run.status}`);
    assert.notEqual(run.status, "completed");
    const bundlePath = downstream?.result?.artifacts?.find((artifact) => artifact.kind === "evidence-bundle")?.uri;
    if (bundlePath && existsSync(bundlePath)) cpSync(dirname(bundlePath), join(archiveDir, "flyrail-evidence"), { recursive: true });
    const bundle = bundlePath && existsSync(bundlePath) ? JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown> : null;
    if (typeof bundle?.featureText === "string") writeFileSync(join(archiveDir, "flyrail-feature-text.txt"), bundle.featureText, "utf8");
    const evidence = { startedAt, finishedAt: new Date().toISOString(), run, flyrailEvidencePath: bundlePath, criterionResults: downstream?.result?.criterionResults ?? [], injectedFault: "Removed the current Blender GLB after its task completed and before Flyrail submission.", pass: true };
    writeFileSync(join(archiveDir, "negative-result.json"), JSON.stringify(evidence, null, 2), "utf8");
    writeFileSync(join(archiveDir, "final-studio-snapshot.json"), JSON.stringify(run, null, 2), "utf8");
    return evidence;
  } finally {
    flyrail?.disconnect();
    if (process.env.KEEP_YUN_AUTONOMOUS_PROJECTS !== "1") rmSync(tempProject, { recursive: true, force: true });
  }
}

async function runNegativeCriterion(blender: string): Promise<Record<string, unknown>> {
  const label = "negative-player-count";
  const tempProject = mkdtempSync(join(tmpdir(), `matterhorn-yun-scene-${label}-`));
  const projectPath = join(tempProject, "yun-disposable");
  const archiveDir = join(ARTIFACT_ROOT, label);
  mkdirSync(archiveDir, { recursive: true });
  copyDisposableYunProject(projectPath);
  const plan = changePlayerCriterionToSeven(createPlan(NOCHED_GOAL, projectPath));
  const startedAt = new Date().toISOString();
  writeFileSync(join(archiveDir, "generated-plan.json"), JSON.stringify(plan, null, 2), "utf8");
  let flyrail: FlyrailAdapter | undefined;
  try {
    const execution = await executePlan(plan, blender, join(archiveDir, "blender-work"));
    const { run } = execution;
    flyrail = execution.flyrail;
    const downstream = run.tasks.find((task) => task.id === "assemble-validate-scene");
    assert.ok(downstream?.result, "Flyrail returns criterion-specific evidence for the negative scene run");
    const playerCriterion = downstream.result.criterionResults?.find((criterion) => criterion.criterionId === "scene-player-count");
    assert.equal(playerCriterion?.outcome, "failed", JSON.stringify(playerCriterion));
    assert.equal(playerCriterion?.expected, 7);
    assert.equal(playerCriterion?.actual, 6);
    assert.ok(["failed", "blocked"].includes(run.status), `negative criterion run remains ${run.status}`);
    assert.notEqual(run.status, "completed");
    const bundlePath = downstream.result.artifacts?.find((artifact) => artifact.kind === "evidence-bundle")?.uri;
    assert.ok(bundlePath && existsSync(bundlePath), "negative criterion Flyrail evidence bundle is persisted");
    cpSync(dirname(bundlePath), join(archiveDir, "flyrail-evidence"), { recursive: true });
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as Record<string, unknown>;
    if (typeof bundle.featureText === "string") writeFileSync(join(archiveDir, "flyrail-feature-text.txt"), bundle.featureText, "utf8");
    const evidence = { startedAt, finishedAt: new Date().toISOString(), run, criterion: playerCriterion, flyrailEvidencePath: bundlePath, pass: true };
    writeFileSync(join(archiveDir, "negative-result.json"), JSON.stringify(evidence, null, 2), "utf8");
    writeFileSync(join(archiveDir, "final-studio-snapshot.json"), JSON.stringify(run, null, 2), "utf8");
    return evidence;
  } finally {
    flyrail?.disconnect();
    if (process.env.KEEP_YUN_AUTONOMOUS_PROJECTS !== "1") rmSync(tempProject, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const blender = await requirePrerequisites();
  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const startedAt = new Date().toISOString();
  const summaries: Record<string, unknown> = {
    matterhornHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim(),
    flyrailHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: FLYRAIL_REPO_ROOT, encoding: "utf8" }).trim(),
    blender,
    godotProjectFixture: YUN_SOURCE,
    runs: {},
  };
  const noche = await runPositive("noche-v1", NOCHED_GOAL, blender);
  (summaries.runs as Record<string, unknown>).noche = {
    goal: NOCHED_GOAL,
    runId: noche.run.id,
    status: noche.run.status,
    taskStatuses: noche.run.tasks.map((task) => ({ id: task.id, executionId: task.executionId, status: task.status })),
    blenderTaskId: noche.blenderTaskId,
    blenderExecutionId: noche.blenderExecutionId,
    blenderDurationMs: noche.blenderDurationMs,
    flyrailDurationMs: noche.flyrailDurationMs,
    fullStudioRunDurationMs: noche.durationMs,
    generatedGlbBytes: noche.generatedGlbBytes,
    generatedGlbPath: noche.generatedGlbPath,
    flyrailTaskId: noche.flyrailTaskId,
    flyrailEvidencePath: noche.flyrailEvidencePath,
    flyrailConsumedExactCurrentGlb: noche.featureText.includes(noche.generatedGlbPath),
    criteria: noche.run.tasks.find((task) => task.id === "assemble-validate-scene")?.result?.criterionResults,
    totalDurationMs: noche.durationMs,
    runtimeObservationMs: noche.evidenceBundle.runtime?.runtimeObservationMs,
    archiveDir: noche.archiveDir,
  };
  const malecon = await runPositive("malecon-v1", MALECON_GOAL, blender);
  (summaries.runs as Record<string, unknown>).malecon = {
    goal: MALECON_GOAL,
    runId: malecon.run.id,
    status: malecon.run.status,
    taskStatuses: malecon.run.tasks.map((task) => ({ id: task.id, executionId: task.executionId, status: task.status })),
    blenderTaskId: malecon.blenderTaskId,
    blenderExecutionId: malecon.blenderExecutionId,
    blenderDurationMs: malecon.blenderDurationMs,
    flyrailDurationMs: malecon.flyrailDurationMs,
    fullStudioRunDurationMs: malecon.durationMs,
    generatedGlbBytes: malecon.generatedGlbBytes,
    generatedGlbPath: malecon.generatedGlbPath,
    flyrailTaskId: malecon.flyrailTaskId,
    flyrailEvidencePath: malecon.flyrailEvidencePath,
    flyrailConsumedExactCurrentGlb: malecon.featureText.includes(malecon.generatedGlbPath),
    criteria: malecon.run.tasks.find((task) => task.id === "assemble-validate-scene")?.result?.criterionResults,
    totalDurationMs: malecon.durationMs,
    runtimeObservationMs: malecon.evidenceBundle.runtime?.runtimeObservationMs,
    archiveDir: malecon.archiveDir,
  };
  (summaries.runs as Record<string, unknown>).negativeArtifact = await runNegativeArtifact(blender);
  (summaries.runs as Record<string, unknown>).negativeCriterion = await runNegativeCriterion(blender);
  summaries.liveTestTotals = { total: 4, passed: 4, failed: 0, positiveFullSceneRuns: 2, negativeCases: 2 };
  summaries.ok = true;
  summaries.startedAt = startedAt;
  summaries.finishedAt = new Date().toISOString();
  writeFileSync(join(ARTIFACT_ROOT, "yun-autonomous-scene-live.json"), JSON.stringify(summaries, null, 2), "utf8");
  process.stdout.write(`YUN AUTONOMOUS FULL-SCENE LIVE PASS ${JSON.stringify(summaries)}\n`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

main().catch((error: unknown) => {
  process.stderr.write(`YUN AUTONOMOUS FULL-SCENE LIVE FAIL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
