import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MatterhornWorkspaceManager } from "../studio/repo/workspaceManager.js";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

test("isolated specialist workspace preserves source and produces a reviewable branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-worktree-"));
  const repo = join(root, "repo");
  const project = join(repo, "game");
  const workspaceRoot = join(root, "workspaces");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "project.godot"), "; baseline\n", "utf8");

  try {
    git("init", repo);
    git("-C", repo, "config", "user.email", "matterhorn-test@example.invalid");
    git("-C", repo, "config", "user.name", "Matterhorn Test");
    git("-C", repo, "add", ".");
    git("-C", repo, "commit", "-m", "baseline");
    const sourceHead = git("-C", repo, "rev-parse", "HEAD");

    const manager = new MatterhornWorkspaceManager({ rootDirectory: workspaceRoot });
    const workspace = await manager.create(project, {
      agentId: "flyrail",
      runId: "run-1",
      taskId: "gameplay",
    });

    assert.equal(workspace.baseCommit, sourceHead);
    assert.equal(workspace.branch, "matterhorn/run-1-flyrail-gameplay");
    assert.equal(await readFile(join(workspace.projectPath, "project.godot"), "utf8"), "; baseline\n");

    await writeFile(join(workspace.projectPath, "project.godot"), "; specialist change\n", "utf8");
    git("-C", workspace.workspaceRoot, "add", ".");
    git("-C", workspace.workspaceRoot, "commit", "-m", "specialist change");

    const review = await manager.review(workspace);
    assert.equal(review.dirty, false);
    assert.equal(review.commitsAhead, 1);
    assert.equal(review.readyForReview, true);
    assert.notEqual(review.headCommit, sourceHead);

    assert.equal(git("-C", repo, "rev-parse", "HEAD"), sourceHead);
    assert.equal(await readFile(join(project, "project.godot"), "utf8"), "; baseline\n");

    const removed = await manager.remove(workspace);
    assert.equal(removed.removed, true);
    assert.equal(removed.branchKept, workspace.branch);
    assert.equal(git("-C", repo, "rev-parse", workspace.branch), review.headCommit);
  } finally {
    try { git("-C", repo, "worktree", "prune"); } catch {}
    await rm(root, { recursive: true, force: true });
  }
});

test("isolated workspace refuses dirty source and dirty removal", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-worktree-dirty-"));
  const repo = join(root, "repo");
  const project = join(repo, "game");
  const workspaceRoot = join(root, "workspaces");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "project.godot"), "; baseline\n", "utf8");

  try {
    git("init", repo);
    git("-C", repo, "config", "user.email", "matterhorn-test@example.invalid");
    git("-C", repo, "config", "user.name", "Matterhorn Test");
    git("-C", repo, "add", ".");
    git("-C", repo, "commit", "-m", "baseline");

    const manager = new MatterhornWorkspaceManager({ rootDirectory: workspaceRoot });
    await writeFile(join(project, "project.godot"), "; dirty source\n", "utf8");
    await assert.rejects(
      () => manager.create(project, { agentId: "forge", runId: "run-dirty", taskId: "asset" }),
      /clean Git project/i,
    );
    git("-C", repo, "checkout", "--", "game/project.godot");

    const workspace = await manager.create(project, {
      agentId: "forge",
      runId: "run-clean",
      taskId: "asset",
    });
    await writeFile(join(workspace.projectPath, "project.godot"), "; dirty workspace\n", "utf8");

    const review = await manager.review(workspace);
    assert.equal(review.dirty, true);
    assert.equal(review.readyForReview, false);
    await assert.rejects(() => manager.remove(workspace), /will not remove a dirty isolated workspace/i);
  } finally {
    try {
      for (const line of git("-C", repo, "worktree", "list", "--porcelain").split("\n")) {
        if (line.startsWith("worktree ") && !line.endsWith(repo)) {
          try { git("-C", repo, "worktree", "remove", "--force", line.slice(9)); } catch {}
        }
      }
      git("-C", repo, "worktree", "prune");
    } catch {}
    await rm(root, { recursive: true, force: true });
  }
});
