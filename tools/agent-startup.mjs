import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD") || "<unknown>";
const commit = git("rev-parse", "--short", "HEAD") || "<unknown>";
const status = git("status", "--short");
const workflow = (() => {
  try {
    return readFileSync(".github/workflows/matterhorn.yml", "utf8");
  } catch {
    return "";
  }
})();

const workflowStillTriggersFeat = /branches:\s*\[[^\]]*['"]feat\/\*\*['"]/m.test(workflow);
const ciTriggeringBranch = branch === "master" || branch.startsWith("feat/");
const intentionalCi = process.env.MATTERHORN_INTENTIONAL_CI === "1";

console.log("Matterhorn agent startup preflight");
console.log("--------------------------------");
console.log(`Branch: ${branch}`);
console.log(`Commit: ${commit}`);
console.log(`Working tree: ${status ? "has local changes" : "clean"}`);
console.log(`Workflow feat/** trigger detected: ${workflowStillTriggersFeat ? "yes" : "no/unknown"}`);
console.log("");
console.log("Required startup context:");
console.log("  1. AGENTS.md");
console.log("  2. .agents/STARTUP.md");
console.log("  3. docs/GATE-0-AUTONOMY-VALIDATION.md before adding another autonomy feature");
console.log("  4. docs/OSS-ACCELERATION.md for generic infrastructure/reuse work");
console.log("  5. docs/MATTERHORN-IMPLEMENTATION-PLAN.md before choosing next implementation work");
console.log("  6. docs/MATTERHORN-VALIDATION.md before claiming a gate or milestone is complete");
console.log("");
console.log("Non-negotiable workflow:");
console.log("  - iterative autonomous work -> integration/**");
console.log("  - batch changes before intentionally triggering CI");
console.log("  - inspect failed job/log before another CI attempt");
console.log("  - no speculative repeated pushes to feat/**");
console.log("  - Gate 0 local validation before the next autonomy feature");
console.log("  - reuse -> integrate -> customize -> build only when needed");
console.log("");

if (ciTriggeringBranch && !intentionalCi) {
  console.error("BLOCKED FOR ITERATIVE AGENT WORK:");
  console.error(`  ${branch} is a CI-triggering branch.`);
  console.error("  Do not perform iterative autonomous commits/pushes here.");
  console.error("  Switch/create an integration/** branch first.");
  console.error("");
  console.error("  For an intentionally review-ready CI validation only, rerun with");
  console.error("  MATTERHORN_INTENTIONAL_CI=1 after inspecting current failures and batching changes.");
  process.exitCode = 2;
} else if (ciTriggeringBranch && intentionalCi) {
  console.log("Intentional CI mode acknowledged for this review-ready batch.");
} else {
  console.log("PASS: current branch is suitable for iterative agent work without push-triggered feat/** CI.");
}

if (!workflowStillTriggersFeat) {
  console.log("");
  console.log("NOTE: workflow trigger shape differs from the recorded policy. Re-read .github/workflows/matterhorn.yml before pushing.");
}
