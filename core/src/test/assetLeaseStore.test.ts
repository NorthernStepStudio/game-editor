import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MatterhornAssetLeaseStore } from "../studio/assets/assetLeaseStore.js";

test("binary asset leases refuse collisions, persist baselines, and detect silent edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-assets-"));
  const project = join(root, "project");
  const stateFile = join(root, "state", "leases.json");
  const assetDir = join(project, "art");
  const asset = join(assetDir, "hero.glb");
  await mkdir(assetDir, { recursive: true });
  await writeFile(asset, "v1", "utf8");

  const holderA = { agentId: "forge", runId: "run-1", taskId: "model" };
  const holderB = { agentId: "canvas", runId: "run-2", taskId: "texture" };

  try {
    const store = new MatterhornAssetLeaseStore({ projectRoot: project, stateFile });
    const first = await store.acquire("art/hero.glb", holderA, 60_000);
    assert.match(first.acquiredHash ?? "", /^[0-9a-f]{64}$/);

    await assert.rejects(
      () => store.acquire("art/hero.glb", holderB, 60_000),
      /already leased by forge/i,
    );

    await writeFile(asset, "v2", "utf8");
    const during = await store.verify();
    assert.equal(during[0].state, "locked-modified");
    assert.deepEqual(during[0].holder, holderA);

    const released = await store.release("art/hero.glb", holderA);
    assert.match(released.hash ?? "", /^[0-9a-f]{64}$/);
    assert.equal((await store.status()).length, 0);
    assert.equal((await store.verify())[0].state, "ok");

    await writeFile(asset, "changed-without-lease", "utf8");
    assert.equal((await store.verify())[0].state, "changed-unlocked");
    await assert.rejects(
      () => store.acquire("art/hero.glb", holderB, 60_000),
      /changed outside the tracked lease workflow/i,
    );

    await store.rebaseline("art/hero.glb");
    const second = await store.acquire("art/hero.glb", holderB, 60_000);
    assert.equal(second.holder.agentId, "canvas");
    await store.release("art/hero.glb", holderB);

    const recovered = new MatterhornAssetLeaseStore({ projectRoot: project, stateFile });
    assert.equal((await recovered.verify())[0].state, "ok");
    assert.equal((await recovered.status()).length, 0);

    await assert.rejects(
      () => recovered.acquire("../escape.glb", holderA, 60_000),
      /parent-directory|project-relative|escapes/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("only the current holder may renew or release an asset lease", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-assets-holder-"));
  const project = join(root, "project");
  const stateFile = join(root, "state", "leases.json");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "asset.bin"), "v1", "utf8");

  const owner = { agentId: "forge", runId: "run-a", taskId: "task-a" };
  const other = { agentId: "motion", runId: "run-b", taskId: "task-b" };

  try {
    const store = new MatterhornAssetLeaseStore({ projectRoot: project, stateFile });
    await store.acquire("asset.bin", owner, 60_000);
    await assert.rejects(() => store.renew("asset.bin", other, 60_000), /current asset lease holder/i);
    await assert.rejects(() => store.release("asset.bin", other), /current asset lease holder/i);
    const renewed = await store.renew("asset.bin", owner, 120_000);
    assert.equal(renewed.holder.runId, "run-a");
    await store.release("asset.bin", owner);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
