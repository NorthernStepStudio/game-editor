import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inspectFoundryRuntimeSnapshot,
  validateFoundryReplayBundle,
  type FoundryRuntimeSnapshot,
} from "../foundry/index.js";
import {
  deriveFlyrailVerificationCapabilities,
  extractFlyrailRuntimeSessionId,
  mapFlyrailAgentRunToReplayBundle,
  mapFlyrailRuntimeSnapshot,
} from "../studio/adapters/flyrail/flyrailVerification.js";

describe("Foundry verification fabric", () => {
  it("derives verification capabilities from Flyrail capabilities", () => {
    const caps = deriveFlyrailVerificationCapabilities({
      phase: 15,
      capabilities: [
        "godot.project.run",
        "godot.input.send",
        "godot.frame.advance",
        "godot.screenshot.capture",
        "godot.performance.capture",
        "godot.explore.run",
        "godot.runtime.agent_step",
        "godot.runtime.viewport_capture",
        "godot.runtime.events",
      ],
    });
    assert.deepEqual(caps, {
      runtimeSnapshot: true,
      input: true,
      frameAdvance: true,
      screenshot: true,
      performance: true,
      agentPlaytest: true,
      agentStep: true,
      viewportCapture: true,
      runtimeEvents: true,
    });
  });

  it("extracts the nested runtime session id returned by Flyrail", () => {
    assert.equal(
      extractFlyrailRuntimeSessionId({
        runtime: { sessionId: "runtime-nested" },
      }),
      "runtime-nested",
    );
    assert.equal(
      extractFlyrailRuntimeSessionId({ runtimeSessionId: "runtime-direct" }),
      "runtime-direct",
    );
  });

  it("normalizes a Flyrail runtime snapshot into Foundry semantics", () => {
    const snapshot = mapFlyrailRuntimeSnapshot(
      {
        sessionId: "runtime-1",
        scenePath: "res://main.tscn",
        ready: true,
        tree: {
          path: "/root/Main",
          name: "Main",
          type: "Node2D",
          properties: { visible: true },
          children: [
            {
              path: "/root/Main/Player",
              name: "Player",
              type: "CharacterBody2D",
              properties: { health: 100 },
              children: [],
            },
          ],
        },
        errors: [],
        logs: ["ready"],
        performance: {
          fps: 60,
          frameTimeMs: 16,
          memoryMb: 128,
          objectCount: 42,
        },
        revision: 7,
      },
      "2026-09-24T19:00:00.000Z",
    );

    assert.equal(snapshot.protocol, "nss.foundry.runtime-snapshot.v1");
    assert.equal(snapshot.runtimeSessionId, "runtime-1");
    assert.equal(snapshot.tree?.children[0].name, "Player");
    assert.equal(snapshot.performance.fps, 60);
  });

  it("normalizes autonomous playtest evidence into a valid replay bundle", () => {
    const replay = mapFlyrailAgentRunToReplayBundle(
      {
        runId: "agent-run-1",
        adapterId: "generic",
        report: { ok: true },
        evidence: {
          directory: "/evidence/run-1",
          trace: "/evidence/run-1/decision_trace.jsonl",
          report: "/evidence/run-1/agent_report.json",
          replayPlan: "/evidence/run-1/replay-plan.json",
          incidents: "/evidence/run-1/incidents.jsonl",
          reproduction: "/evidence/run-1/reproduction.json",
        },
      },
      "runtime-1",
      42,
    );
    assert.equal(replay.executionId, "agent-run-1");
    assert.equal(replay.seed, 42);
    assert.equal(validateFoundryReplayBundle(replay).valid, true);
  });

  it("emits QA incidents from runtime and performance evidence", () => {
    const snapshot: FoundryRuntimeSnapshot = {
      protocol: "nss.foundry.runtime-snapshot.v1",
      runtimeSessionId: "runtime-2",
      capturedAt: "2026-09-24T19:00:00.000Z",
      scenePath: "res://main.tscn",
      ready: true,
      tree: null,
      errors: [{ at: "frame 10", message: "Invalid state transition" }],
      logs: [],
      performance: {
        fps: 30,
        frameTimeMs: 33,
        memoryMb: 600,
        objectCount: 5000,
      },
      revision: 1,
    };

    const incidents = inspectFoundryRuntimeSnapshot(snapshot, {
      performanceBudget: {
        targetFps: 60,
        maxFrameTimeMs: 16.67,
        maxMemoryMb: 256,
      },
      maxObjectCount: 1000,
    });

    assert.deepEqual(
      incidents.map((incident) => incident.kind),
      [
        "runtime_error",
        "low_fps",
        "frame_time_budget",
        "memory_budget",
        "object_budget",
      ],
    );
  });
});
