import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectProjectGitSafety, requireProjectGitMutationSafety } from "../studio/repo/gitSafety.js";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

test("Git mutation safety blocks dirty projects unless a human explicitly allows them", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-git-safe-"));
  const project = join(root, "project");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "project.godot"), "; fixture\n", "utf8");

  try {
    git("init", project);
    git("-C", project, "config", "user.email", "matterhorn-test@example.invalid");
    git("-C", project, "config", "user.name", "Matterhorn Test");
    git("-C", project, "add", "project.godot");
    git("-C", project, "commit", "-m", "fixture baseline");

    const clean = await inspectProjectGitSafety(project);
    assert.equal(clean.gitAvailable, true);
    assert.equal(clean.repository, true);
    assert.equal(clean.dirty, false);
    assert.ok(clean.head);

    await writeFile(join(project, "project.godot"), "; changed\n", "utf8");
    const dirty = await inspectProjectGitSafety(project);
    assert.equal(dirty.repository, true);
    assert.equal(dirty.dirty, true);
    assert(dirty.changes.some(path => path.includes("project.godot")));

    await assert.rejects(
      () => requireProjectGitMutationSafety(project),
      /will not start autonomous mutation on a dirty Git project/i,
    );

    const allowed = await requireProjectGitMutationSafety(project, true);
    assert.equal(allowed.dirty, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("non-Git projects remain inspectable without fabricating a clean repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "matterhorn-git-unversioned-"));
  try {
    await writeFile(join(root, "project.godot"), "; fixture\n", "utf8");
    const result = await inspectProjectGitSafety(root);
    assert.equal(result.repository, false);
    assert.equal(result.dirty, false);
    const allowed = await requireProjectGitMutationSafety(root);
    assert.equal(allowed.repository, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
