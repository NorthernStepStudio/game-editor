import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MatterhornPromotionApprovalStore } from "../studio/release/promotionApprovalStore.js";
import type { StudioRun } from "../studio/runTypes.js";

function completedRun(id = "run-1"): StudioRun {
  const createdAt = "2026-10-03T18:00:00.000Z";
  return {
    id,
    status: "completed",
    createdAt,
    updatedAt: "2026-10-03T18:10:00.000Z",
    detail: "All task and final acceptance checks passed.",
    plan: {
      id: `plan-${id}`,
      goal: "Ship a verified gameplay change",
      createdAt,
      tasks: [{
        id: "work",
        title: "Implement",
        goal: "Implement and verify",
        domain: "godot",
        specialistId: "flyrail",
        status: "planned",
        dependsOn: [],
        acceptanceCriteria: ["Godot validation passes"],
      }],
      finalAcceptanceCriteria: ["Godot validation passes"],
    },
    tasks: [{
      id: "work",
      executionId: `${id}-work`,
      status: "completed",
      startedAt: "2026-10-03T18:01:00.000Z",
      finishedAt: "2026-10-03T18:09:00.000Z",
      detail: "Accepted by Sentinel.",
      result: {
        taskId: `${id}-work`,
        specialistId: "flyrail",
        status: "completed",
        summary: "Verified",
        evidence: [],
        criterionResults: [{
          criterionId: "criterion-1",
          criterion: "Godot validation passes",
          outcome: "passed",
          executionId: `${id}-work`,
        }],
      },
    }],
  };
}

test("promotion approval is explicit, durable, and bound to the exact completed snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-promotion-"));
  try {
    const run = completedRun();
    const first = new MatterhornPromotionApprovalStore(root);

    assert.equal(first.status(run).state, "approval-required");
    assert.throws(() => first.requireApproved(run), /Promotion blocked/i);
    assert.throws(() => first.approve(run, "yes"), /exact confirmation "APPROVE"/i);

    const approval = first.approve(run, "APPROVE", "Reviewed locally.");
    assert.equal(approval.runId, run.id);
    assert.match(approval.runSnapshotHash, /^[0-9a-f]{64}$/);
    assert.equal(first.status(run).state, "approved");
    assert.equal(first.requireApproved(run).runSnapshotHash, approval.runSnapshotHash);

    const recovered = new MatterhornPromotionApprovalStore(root);
    assert.equal(recovered.status(run).state, "approved");

    const changed: StudioRun = {
      ...structuredClone(run),
      updatedAt: "2026-10-03T18:11:00.000Z",
      detail: "Snapshot changed after approval.",
    };
    assert.equal(recovered.status(changed).state, "stale");
    assert.throws(() => recovered.requireApproved(changed), /must be renewed/i);

    const renewed = recovered.approve(changed, "APPROVE");
    assert.notEqual(renewed.runSnapshotHash, approval.runSnapshotHash);
    assert.equal(recovered.status(changed).state, "approved");

    recovered.revoke(run.id);
    assert.equal(recovered.status(changed).state, "approval-required");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promotion approval refuses non-completed runs", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-promotion-ineligible-"));
  try {
    const store = new MatterhornPromotionApprovalStore(root);
    const run = completedRun("run-blocked");
    run.status = "blocked";
    assert.equal(store.status(run).state, "not-eligible");
    assert.equal(store.status(run).eligible, false);
    assert.throws(() => store.approve(run, "APPROVE"), /fully completed, acceptance-gated run/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("promotion approval rejects a forged completed status without completed tasks", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-promotion-forged-"));
  try {
    const store = new MatterhornPromotionApprovalStore(root);
    const run = completedRun("run-forged");
    run.tasks[0].status = "failed";
    assert.equal(run.status, "completed");
    assert.equal(store.status(run).state, "not-eligible");
    assert.throws(
      () => store.approve(run, "APPROVE"),
      /fully completed, acceptance-gated run/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
