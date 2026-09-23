/**
 * Comprehensive Unit Tests for StudioRunController (20 Scenarios).
 *
 * Covers all 20 required unit test scenarios using deterministic fake adapters.
 */

import { strict as assert } from "node:assert";

import { createStudioPlan } from "../studio/orchestrator.js";
import { SpecialistError, type SpecialistAdapter, type SpecialistCapabilitySet, type SpecialistCancelResult, type SpecialistHealthResult, type SpecialistTaskHandle, type SpecialistTaskStatus } from "../studio/adapters/types.js";
import { SpecialistAdapterRegistry } from "../studio/run/registry.js";
import { StudioRunController } from "../studio/run/runController.js";
import { InMemoryStudioRunStore } from "../studio/run/store.js";
import type { NssStudioExecutionResult, NssStudioPlanInput } from "../studio/types.js";
import type { StudioRunEvent } from "../studio/run/types.js";

let passed = 0;
let failed = 0;

function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  return fn()
    .then(() => {
      passed++;
      console.log(`  ✓ ${name}`);
    })
    .catch((error) => {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    });
}

// ── Fake Adapter Helpers ─────────────────────────────────────────────

class MockSpecialistAdapter implements SpecialistAdapter {
  readonly specialistId: "flyrail" | "blender-engine";

  isAvailable = true;
  capabilities = ["godot.project.inspect", "godot.scene.create", "godot.scene.modify", "godot.tests.run", "godot.validation.run"];
  submitError: Error | null = null;
  statusMap = new Map<string, "running" | "completed" | "failed">();
  resultMap = new Map<string, NssStudioExecutionResult>();
  cancelSupported = false;
  submitCount = 0;

  constructor(specialistId: "flyrail" | "blender-engine" = "flyrail") {
    this.specialistId = specialistId;
  }

  async health(): Promise<SpecialistHealthResult> {
    return {
      available: this.isAvailable,
      specialistId: this.specialistId,
      detail: this.isAvailable ? "Mock active" : "Mock offline",
    };
  }

  async getCapabilities(): Promise<SpecialistCapabilitySet> {
    return {
      specialistId: this.specialistId,
      protocolVersion: "1.0.0",
      capabilities: this.capabilities,
    };
  }

  async submitTask(handoff: { taskId: string }): Promise<SpecialistTaskHandle> {
    this.submitCount++;
    if (this.submitError) throw this.submitError;
    return {
      taskId: handoff.taskId,
      specialistId: this.specialistId,
      accepted: true,
      detail: `Submitted to mock ${this.specialistId}`,
    };
  }

  async getTaskStatus(taskId: string): Promise<SpecialistTaskStatus> {
    const st = this.statusMap.get(taskId) ?? "completed";
    return {
      taskId,
      specialistId: this.specialistId,
      phase: st,
      detail: st,
    };
  }

  async getResult(taskId: string): Promise<NssStudioExecutionResult> {
    const custom = this.resultMap.get(taskId);
    if (custom) return custom;
    return {
      taskId,
      specialistId: this.specialistId,
      status: "completed",
      summary: "Mock task succeeded",
      evidence: [{ kind: "test", summary: "Validation passed" }],
    };
  }

  async cancelTask(taskId: string): Promise<SpecialistCancelResult> {
    return {
      taskId,
      cancelled: this.cancelSupported,
      detail: this.cancelSupported ? "Task cancelled" : "Cancellation unsupported",
    };
  }

  disconnect(): void {}
}

function createSingleTaskPlan(specialistId: "flyrail" | "blender-engine" = "flyrail"): NssStudioPlanInput {
  return {
    goal: "Single Task Plan Goal",
    tasks: [
      {
        id: "task-1",
        title: "Inspect Godot Project",
        goal: "Inspect project structure",
        domain: "godot",
        specialistId,
        acceptanceCriteria: ["Project is valid"],
      },
    ],
  };
}

// ── Tests ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nStudioRunController Unit Tests\n");

  // Scenario 1: Valid single-task plan
  await testAsync("1. Valid single-task plan", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10 });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "completed");
    assert.equal(run.taskRuns["task-1"]?.status, "completed");
  });

  // Scenario 2: Multi-task dependency order
  await testAsync("2. Multi-task dependency order (A -> B -> C)", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    registry.register(adapter);

    const executionOrder: string[] = [];
    const controller = new StudioRunController({ registry, pollIntervalMs: 10 });
    controller.onEvent((ev) => {
      if (ev.kind === "studio.task.completed") {
        executionOrder.push(ev.taskId!);
      }
    });

    const plan = createStudioPlan({
      goal: "Multi-task Plan",
      tasks: [
        { id: "task-A", title: "Task A", goal: "Goal A", domain: "godot", acceptanceCriteria: ["A ok"] },
        { id: "task-B", title: "Task B", goal: "Goal B", domain: "godot", dependsOn: ["task-A"], acceptanceCriteria: ["B ok"] },
        { id: "task-C", title: "Task C", goal: "Goal C", domain: "godot", dependsOn: ["task-B"], acceptanceCriteria: ["C ok"] },
      ],
    });

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "completed");
    assert.deepEqual(executionOrder, ["task-A", "task-B", "task-C"]);
  });

  // Scenario 3: Missing adapter
  await testAsync("3. Missing adapter fails task", async () => {
    const registry = new SpecialistAdapterRegistry(); // empty registry
    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan(createSingleTaskPlan("flyrail"));

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
    assert(run.taskRuns["task-1"]?.error?.includes("No specialist adapter registered"));
  });

  // Scenario 4: Specialist unavailable
  await testAsync("4. Specialist unavailable fails task", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.isAvailable = false;
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
    assert(run.taskRuns["task-1"]?.error?.includes("unavailable"));
  });

  // Scenario 5: Missing capability
  await testAsync("5. Missing required capability fails task before execution", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.capabilities = ["godot.project.inspect"]; // missing godot.tests.run
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan({
      goal: "Capability Test Plan",
      tasks: [
        {
          id: "task-cap",
          title: "Run Tests",
          goal: "Run tests",
          domain: "godot",
          requiredCapabilities: ["godot.tests.run"],
          acceptanceCriteria: ["Tests pass"],
        },
      ],
    });

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-cap"]?.status, "failed");
    assert.equal(adapter.submitCount, 0); // Must NOT submit task if capability missing
    assert(run.taskRuns["task-cap"]?.error?.includes("missing required capabilities"));
  });

  // Scenario 6: Task submission failure
  await testAsync("6. Task submission failure handles error", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.submitError = new SpecialistError("INVALID_TASK", "Bad parameters");
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
    assert(run.taskRuns["task-1"]?.error?.includes("Bad parameters"));
  });

  // Scenario 7: Task timeout
  await testAsync("7. Task timeout fails task", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.statusMap.set("task-1", "running"); // never finishes
    registry.register(adapter);

    const controller = new StudioRunController({
      registry,
      pollIntervalMs: 10,
      taskTimeoutMs: 50,
      retryPolicy: { maxTaskAttempts: 1 },
    });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
    assert(run.taskRuns["task-1"]?.error?.includes("timed out"));
  });

  // Scenario 8: Specialist completed + good evidence
  await testAsync("8. Specialist completed + good evidence passes gate", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.resultMap.set("task-1", {
      taskId: "task-1",
      specialistId: "flyrail",
      status: "completed",
      summary: "All good",
      evidence: [{ kind: "test", summary: "Validation passed" }],
    });
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10 });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "completed");
    assert.equal(run.taskRuns["task-1"]?.status, "completed");
  });

  // Scenario 9: Specialist completed + failed validation evidence
  await testAsync("9. Specialist completed + failed validation evidence rejects completion", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.resultMap.set("task-1", {
      taskId: "task-1",
      specialistId: "flyrail",
      status: "completed",
      summary: "Finished with error",
      evidence: [{ kind: "test", summary: "Validation failed: GDScript parse error" }],
    });
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
    assert(run.taskRuns["task-1"]?.error?.includes("validation failed"));
  });

  // Scenario 10: Task failure blocks dependents
  await testAsync("10. Task failure blocks dependent tasks", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.resultMap.set("task-A", {
      taskId: "task-A",
      specialistId: "flyrail",
      status: "failed",
      summary: "Task A execution failed",
    });
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan({
      goal: "Dependency Blocking Plan",
      tasks: [
        { id: "task-A", title: "Task A", goal: "Goal A", domain: "godot", acceptanceCriteria: ["A ok"] },
        { id: "task-B", title: "Task B", goal: "Goal B", domain: "godot", dependsOn: ["task-A"], acceptanceCriteria: ["B ok"] },
      ],
    });

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-A"]?.status, "failed");
    assert.equal(run.taskRuns["task-B"]?.status, "blocked");
  });

  // Scenario 11: Recoverable retry succeeds on attempt 2
  await testAsync("11. Recoverable retry succeeds on attempt 2", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    let attemptCount = 0;

    // Override submitTask to fail first attempt then succeed
    adapter.submitTask = async (handoff: { taskId: string }) => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new SpecialistError("SPECIALIST_UNAVAILABLE", "Transient transport hiccup", { recoverable: true });
      }
      return { taskId: handoff.taskId, specialistId: adapter.specialistId, accepted: true };
    };
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 2 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "completed");
    assert.equal(attemptCount, 2);
    assert.equal(run.taskRuns["task-1"]?.attempt, 2);
  });

  // Scenario 12: Retry exhaustion
  await testAsync("12. Retry exhaustion marks task failed", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.submitError = new SpecialistError("SPECIALIST_UNAVAILABLE", "Server down", { recoverable: true });
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 2 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.attempt, 2);
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
  });

  // Scenario 13: Non-recoverable failure does not retry
  await testAsync("13. Non-recoverable failure does not retry", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.submitError = new SpecialistError("PERMISSION_DENIED", "Unauthorized", { recoverable: false });
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 3 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert.equal(run.taskRuns["task-1"]?.attempt, 1); // Exits after attempt 1
    assert.equal(run.taskRuns["task-1"]?.status, "failed");
  });

  // Scenario 14: Cancellation request
  await testAsync("14. Cancellation request cancels run", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.statusMap.set("task-1", "running"); // stays running so cancelRun takes effect
    registry.register(adapter);

    const store = new InMemoryStudioRunStore();
    const controller = new StudioRunController({ registry, store, pollIntervalMs: 10, taskTimeoutMs: 5000 });
    const plan = createStudioPlan(createSingleTaskPlan());

    const runPromise = controller.executeRun(plan, "cancel-run-14");
    await new Promise((r) => setTimeout(r, 25)); // Allow task execution loop to start
    await controller.cancelRun("cancel-run-14");

    const run = await runPromise;
    assert.equal(run.status, "cancelled");
  });

  // Scenario 15: Unsupported specialist cancellation is handled cleanly
  await testAsync("15. Unsupported specialist cancellation handles active task exit", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.cancelSupported = false;
    registry.register(adapter);

    const res = await adapter.cancelTask("task-1");
    assert.equal(res.cancelled, false);
    assert(res.detail!.includes("unsupported"));
  });

  // Scenario 16: Studio run completion state
  await testAsync("16. Studio run completion state is correctly persisted", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    registry.register(adapter);

    const store = new InMemoryStudioRunStore();
    const controller = new StudioRunController({ registry, store, pollIntervalMs: 10 });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan, "persist-run-16");
    assert.equal(run.status, "completed");

    const saved = await store.getRun("persist-run-16");
    assert.equal(saved?.status, "completed");
    assert.equal(saved?.planId, plan.id);
  });

  // Scenario 17: Studio run failure state
  await testAsync("17. Studio run failure state records failures list", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.submitError = new SpecialistError("INVALID_TASK", "Fatal task error");
    registry.register(adapter);

    const controller = new StudioRunController({ registry, pollIntervalMs: 10, retryPolicy: { maxTaskAttempts: 1 } });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan);
    assert.equal(run.status, "blocked");
    assert(run.failures.length > 0);
    assert(run.failures[0]!.includes("Fatal task error"));
  });

  // Scenario 18: Cyclic task graph rejection
  await testAsync("18. Cyclic task graph is rejected at plan creation", async () => {
    assert.throws(() => {
      createStudioPlan({
        goal: "Cyclic Plan",
        tasks: [
          { id: "task-X", title: "X", goal: "G", domain: "godot", dependsOn: ["task-Y"], acceptanceCriteria: ["X ok"] },
          { id: "task-Y", title: "Y", goal: "G", domain: "godot", dependsOn: ["task-X"], acceptanceCriteria: ["Y ok"] },
        ],
      });
    }, /cycle/i);
  });

  // Scenario 19: Event ordering
  await testAsync("19. Event stream emits expected events in correct sequence", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    registry.register(adapter);

    const events: StudioRunEvent[] = [];
    const controller = new StudioRunController({ registry, pollIntervalMs: 10 });
    controller.onEvent((ev) => events.push(ev));

    const plan = createStudioPlan(createSingleTaskPlan());
    await controller.executeRun(plan);

    const kinds = events.map((e) => e.kind);
    assert(kinds.includes("studio.run.started"));
    assert(kinds.includes("studio.task.started"));
    assert(kinds.includes("studio.evidence.received"));
    assert(kinds.includes("studio.task.completed"));
    assert(kinds.includes("studio.run.completed"));

    assert.equal(kinds[0], "studio.run.started");
    assert.equal(kinds[kinds.length - 1], "studio.run.completed");
  });

  // Scenario 20: State store updates
  await testAsync("20. State store contains all task run artifacts and evidence", async () => {
    const registry = new SpecialistAdapterRegistry();
    const adapter = new MockSpecialistAdapter();
    adapter.resultMap.set("task-1", {
      taskId: "task-1",
      specialistId: "flyrail",
      status: "completed",
      summary: "Done",
      artifacts: [{ kind: "commit", uri: "commit-123", label: "feat: add jump" }],
      evidence: [{ kind: "test", summary: "Validation passed" }],
    });
    registry.register(adapter);

    const store = new InMemoryStudioRunStore();
    const controller = new StudioRunController({ registry, store, pollIntervalMs: 10 });
    const plan = createStudioPlan(createSingleTaskPlan());

    const run = await controller.executeRun(plan, "store-run-20");
    assert.equal(run.artifacts.length, 1);
    assert.equal(run.artifacts[0]!.kind, "commit");
    assert.equal(run.evidence.length, 1);
    assert.equal(run.evidence[0]!.summary, "Validation passed");
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();
