import { strict as assert } from "node:assert";
/**
 * Full End-to-End Integration test for the Matterhorn ↔ Flyrail adapter.
 *
 * Connects to a LIVE Flyrail daemon (ws://127.0.0.1:7520), opens a DISPOSABLE
 * Godot project fixture, submits a task, polls status concurrently, and
 * verifies returned structured evidence and execution results.
 *
 * If no daemon is available, the test is skipped cleanly.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { FlyrailAdapter } from "../studio/adapters/flyrail/flyrailAdapter.js";
import type { NssStudioHandoff } from "../studio/types.js";

async function main(): Promise<void> {
  console.log("\nMatterhorn ↔ Flyrail E2E Integration Test\n");

  const candidates = [
    resolve(__dirname, "../../src/test/fixtures/disposable-godot-project"),
    resolve(process.cwd(), "core/src/test/fixtures/disposable-godot-project"),
  ];
  const fixturePath = candidates.find((p) => existsSync(resolve(p, "project.godot"))) ?? candidates[0]!;

  const adapter = new FlyrailAdapter({
    projectPath: fixturePath,

  });

  let passed = 0;
  let failed = 0;

  // ── 1. Health check ──────────────────────────────────────────────

  console.log("  1. Checking Flyrail daemon health...");
  const health = await adapter.health();

  if (!health.available) {
    console.log(`  ⊘ Flyrail daemon not available: ${health.detail ?? "no detail"}`);
    console.log("  ⊘ Skipping live E2E integration tests (daemon not running).");
    console.log("\n  Live gate NOT PASSED: prerequisites unavailable.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`  ✓ Health ok: version=${health.version} protocol=${health.protocolVersion}`);
  console.log(`    Detail: ${health.detail}`);
  passed++;

  // ── 2. Capability Negotiation ───────────────────────────────────

  try {
    console.log("  2. Discovering daemon capabilities (system.capabilities)...");
    const caps = await adapter.getCapabilities();
    console.log(`  ✓ Capabilities discovered (${caps.capabilities.length}): ${caps.capabilities.slice(0, 5).join(", ")}...`);
    console.log(`    Protocol: ${caps.protocolVersion}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ Capability discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }

  // ── 3. Session Opening (project.open) ───────────────────────────

  let sessionId = "";
  try {
    console.log(`  3. Opening disposable Godot project session (${fixturePath})...`);
    sessionId = await adapter.ensureSession(fixturePath);
    console.log(`  ✓ project.open succeeded: sessionId=${sessionId}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ project.open failed: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }

  // ── 4. Task Submission (loop.run non-blocking) ─────────────────

  const taskId = `e2e-task-${Date.now()}`;
  const handoff: NssStudioHandoff = {
    protocol: "nss.studio-handoff.v1",
    id: `handoff-${taskId}`,
    taskId,
    from: "matterhorn",
    to: "flyrail",
    goal: "Verify disposable scene node structure",
    acceptanceCriteria: [
      "Ensure main.tscn contains Node2D Main",
    ],
    inputArtifacts: [
      { kind: "godot-project", uri: fixturePath },
    ],
  };

  try {
    console.log(`  4. Submitting Matterhorn handoff taskId=${taskId} (loop.run)...`);
    const handle = await adapter.submitTask(handoff);
    console.log(`  ✓ submitTask returned handle immediately: taskId=${handle.taskId}, accepted=${handle.accepted}`);
    console.log(`    Detail: ${handle.detail}`);
    assert.equal(handle.accepted, true);
    passed++;

    // ── 5. Concurrent RPC Status Polling ─────────────────────────

    console.log("  5. Polling task status concurrently over same connection (loop.status)...");
    const status1 = await adapter.getTaskStatus(taskId);
    console.log(`  ✓ Concurrent loop.status returned: phase=${status1.phase}, detail=${status1.detail}`);
    passed++;

    // ── 6. Await Completion & Result Verification ─────────────────

    console.log("  6. Awaiting loop completion & retrieving result (loop.last_report)...");
    // Wait for the background loop execution to complete
    let finalStatus = await adapter.getTaskStatus(taskId);
    let attempts = 0;
    while ((finalStatus.phase === "running" || finalStatus.phase === "accepted" || finalStatus.phase === "validating") && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      finalStatus = await adapter.getTaskStatus(taskId);
      attempts++;
    }

    assert.equal(finalStatus.phase, "completed", "Execution did not complete successfully");
    console.log(`  ✓ Terminal status observed: phase=${finalStatus.phase}`);

    const result = await adapter.getResult(taskId);
    assert.equal(result.status, "completed");
    assert(result.evidence?.length, "Missing execution evidence");
    console.log(`  ✓ ExecutionResult received: status=${result.status}, summary="${result.summary}"`);
    if (result.artifacts && result.artifacts.length > 0) {
      console.log(`    Artifacts (${result.artifacts.length}): ${result.artifacts.map((a) => a.kind).join(", ")}`);
    }
    if (result.evidence && result.evidence.length > 0) {
      console.log(`    Evidence (${result.evidence.length}): ${result.evidence.map((e) => e.summary).join("; ")}`);
    }
    passed++;
  } catch (error) {
    console.error(`  ✗ E2E task execution failed: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  adapter.disconnect();

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();

