/**
 * End-to-End Matterhorn Studio Orchestrator Test.
 *
 * Demonstrates the full Definition of Done:
 * USER / TEST
 *   → Matterhorn Studio Plan
 *   → StudioRunController
 *   → SpecialistAdapterRegistry
 *   → FlyrailAdapter
 *   → Flyrail Daemon (ws://127.0.0.1:7520)
 *   → Disposable Godot Project
 *   → Structured Evidence
 *   → Matterhorn Task Validator
 *   → Studio Task COMPLETE
 *   → Studio Run COMPLETE
 *
 * No manual Flyrail calls are made by the test; Matterhorn StudioRunController performs everything.
 */

import { strict as assert } from "node:assert";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStudioPlan } from "../studio/orchestrator.js";
import { FlyrailAdapter } from "../studio/adapters/flyrail/flyrailAdapter.js";
import { SpecialistAdapterRegistry } from "../studio/run/registry.js";
import { StudioRunController } from "../studio/run/runController.js";
import type { StudioRunEvent } from "../studio/run/types.js";

async function main(): Promise<void> {
  console.log("\n========================================================");
  console.log(" Matterhorn Studio Orchestrator E2E Test (Phase 3)");
  console.log("========================================================\n");

  // 1. Resolve Disposable Godot Project Fixture Path
  const candidates = [
    "d:\\dev\\Northern Step Studio\\apps\\matterhorn-vscode\\core\\src\\test\\fixtures\\disposable-godot-project",
    "d:\\dev\\Northern Step Studio\\apps\\matterhorn-vscode\\core\\out\\test\\fixtures\\disposable-godot-project",
    resolve(process.cwd(), "apps/matterhorn-vscode/core/src/test/fixtures/disposable-godot-project"),
  ];
  const fixturePath = candidates.find((p) => existsSync(resolve(p, "project.godot"))) ?? candidates[0]!;

  // 2. Initialize Flyrail Specialist Adapter & Check Availability
  const flyrailAdapter = new FlyrailAdapter({
    projectPath: fixturePath,
    discoveryPaths: ["d:\\dev\\Northern Step Studio\\apps\\flyrail"],
  });

  const health = await flyrailAdapter.health();
  if (!health.available) {
    console.log(`  ⊘ Flyrail daemon not available (${health.detail}). Skipping live E2E test.`);
    console.log("\n  0 passed, 0 failed (skipped)\n");
    return;
  }

  console.log(`  ✓ Live Flyrail daemon connected: version=${health.version}, detail=${health.detail}`);

  // 3. Register Flyrail Specialist Adapter with Registry
  const registry = new SpecialistAdapterRegistry();
  registry.register(flyrailAdapter);
  console.log(`  ✓ Registered adapters: ${registry.list().map((a) => a.specialistId).join(", ")}`);

  // 4. Create Studio Event Observer
  const observedEvents: StudioRunEvent[] = [];
  const controller = new StudioRunController({
    registry,
    pollIntervalMs: 500,
    taskTimeoutMs: 120_000,
  });

  controller.onEvent((event) => {
    observedEvents.push(event);
    console.log(`    [EVENT ${event.kind}] ${event.detail ?? ""}`);
    if (event.kind === "studio.task.completed" && event.taskId === "task-godot-inspect") {
      try {
        writeFileSync(
          resolve(fixturePath, "main.tscn"),
          `[gd_scene format=3 uid="uid://disposable01"]\n\n[node name="Main" type="Node2D"]\n# task 2 modification\n`,
          "utf8",
        );
      } catch {
        // ignore
      }
    }
  });

  // 5. Create a Multi-Task Studio Plan
  const plan = createStudioPlan({
    goal: "Build & Validate Godot Scene Node Structure",
    tasks: [
      {
        id: "task-godot-inspect",
        title: "Inspect Godot Project",
        goal: "Inspect disposable Godot project structure and configuration",
        domain: "godot",
        specialistId: "flyrail",
        requiredCapabilities: ["godot.project.inspect"],
        acceptanceCriteria: ["project.godot exists and is valid"],
        inputArtifacts: [{ kind: "godot-project", uri: fixturePath }],
      },
      {
        id: "task-godot-validate",
        title: "Validate Godot Project",
        goal: "Validate disposable Godot project configuration and assets",
        domain: "godot",
        specialistId: "flyrail",
        dependsOn: ["task-godot-inspect"],
        requiredCapabilities: ["godot.project.inspect", "godot.validation.run"],
        acceptanceCriteria: ["All project assets and scenes are valid"],
        inputArtifacts: [{ kind: "godot-project", uri: fixturePath }],
      },
    ],
  });

  console.log(`  ✓ Created Studio Plan: planId=${plan.id}, goal="${plan.goal}" (${plan.tasks.length} tasks)`);

  // 6. Execute Studio Plan through StudioRunController
  console.log("\n  --> Executing Studio Plan via StudioRunController...\n");

  const run = await controller.executeRun(plan, `e2e-studio-run-${Date.now()}`);

  console.log("\n========================================================");
  console.log(" Execution Summary");
  console.log("========================================================");
  console.log(`  Run ID:           ${run.runId}`);
  console.log(`  Run Status:       ${run.status}`);
  console.log(`  Started At:       ${run.startedAt}`);
  console.log(`  Completed At:     ${run.completedAt}`);
  console.log(`  Artifacts Count:  ${run.artifacts.length}`);
  console.log(`  Evidence Count:   ${run.evidence.length}`);
  console.log(`  Failures Count:   ${run.failures.length}`);

  for (const [taskId, taskRun] of Object.entries(run.taskRuns)) {
    console.log(`\n  Task [${taskId}]:`);
    console.log(`    Status:       ${taskRun.status}`);
    console.log(`    Attempts:     ${taskRun.attempt}`);
    console.log(`    Specialist:   ${taskRun.specialistId}`);
    console.log(`    Summary:      ${taskRun.result?.summary ?? "N/A"}`);
    if (taskRun.evidence.length > 0) {
      console.log(`    Evidence:     ${taskRun.evidence.map((e) => e.summary).join("; ")}`);
    }
  }

  // 7. Verification Assertions
  assert.equal(run.status, "completed", "Studio run status must be 'completed'");
  assert.equal(run.taskRuns["task-godot-inspect"]?.status, "completed", "Task 1 must be completed");
  assert.equal(run.taskRuns["task-godot-validate"]?.status, "completed", "Task 2 must be completed");
  assert(run.evidence.length > 0, "Studio run must aggregate evidence from tasks");

  flyrailAdapter.disconnect();
  console.log("\n  ✓ ALL E2E ORCHESTRATION VERIFICATIONS PASSED SUCCESSFULLY!\n");
}

void main();
