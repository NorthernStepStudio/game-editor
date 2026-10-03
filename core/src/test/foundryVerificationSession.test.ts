import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FoundryVerificationSession,
  hashFoundryEvidence,
  type FoundryRuntimeSnapshot,
  type FoundryVerificationProvider,
} from "../foundry/index.js";

function snapshot(revision: number): FoundryRuntimeSnapshot {
  return {
    protocol: "nss.foundry.runtime-snapshot.v1",
    runtimeSessionId: "runtime-1",
    capturedAt: `2026-09-24T19:00:0${revision}.000Z`,
    scenePath: "res://main.tscn",
    ready: true,
    tree: {
      path: "/root/Main",
      name: "Main",
      type: "Node2D",
      properties: {},
      children: [],
    },
    errors: [],
    logs: [],
    performance: {
      fps: 60,
      frameTimeMs: 16,
      memoryMb: 128,
      objectCount: 20,
    },
    revision,
  };
}

describe("Foundry verification session", () => {
  it("collects deterministic step, snapshot and viewport proof into one report", async () => {
    let revision = 0;
    const provider: FoundryVerificationProvider = {
      async snapshot() {
        revision += 1;
        return snapshot(revision);
      },
      async beginAgent() {
        return { active: true };
      },
      async stepAgent(_id, frames) {
        return { stepId: 1, frames };
      },
      async observeAgent() {
        return {
          status: { simulationFrames: 12 },
          nodes: { Player: { health: 100 } },
          events: [{ name: "moved", frame: 12 }],
        };
      },
      async endAgent() {
        return { active: false };
      },
      async captureViewport() {
        return {
          ok: true,
          path: "/evidence/viewport.png",
          width: 1280,
          height: 720,
        };
      },
    };

    const session = new FoundryVerificationSession(provider, {
      executionId: "run-1",
      runtimeSessionId: "runtime-1",
      seed: 42,
      oracle: {
        performanceBudget: {
          targetFps: 60,
          maxFrameTimeMs: 16.67,
        },
      },
    });

    await session.begin();
    const step = await session.step({
      frames: 12,
      watchedPaths: ["Player"],
      captureViewport: true,
    });
    const report = await session.finish();

    assert.equal(step.simulationFrame, 12);
    assert.equal(step.observedNodes?.Player.health, 100);
    assert.equal(step.viewport?.uri, "/evidence/viewport.png");
    assert.equal(report.steps.length, 1);
    assert.equal(report.artifacts.length, 1);
    assert.equal(report.incidents.length, 0);
    assert.match(report.stateHash, /^[a-f0-9]{64}$/);
  });

  it("produces stable hashes independent of object key insertion order", () => {
    assert.equal(
      hashFoundryEvidence({ b: 2, a: 1 }),
      hashFoundryEvidence({ a: 1, b: 2 }),
    );
  });

  it("rejects stepping before begin", async () => {
    const provider: FoundryVerificationProvider = {
      async snapshot() {
        return snapshot(1);
      },
    };
    const session = new FoundryVerificationSession(provider, {
      executionId: "run-1",
      runtimeSessionId: "runtime-1",
    });
    await assert.rejects(
      () => session.step({ frames: 1 }),
      /not active/i,
    );
  });
});
