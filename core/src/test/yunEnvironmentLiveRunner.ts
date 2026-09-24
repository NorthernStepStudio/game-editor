/** Mandatory PC gate for Blender → Matterhorn → Flyrail → Godot Yun environment import. */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { findBlenderExecutable } from "../studio/adapters/blender/index.js";
import { DEFAULT_GODOT_BIN, FlyrailClient } from "../studio/adapters/flyrail/index.js";

async function main(): Promise<void> {
  const missing: string[] = [];
  const blender = findBlenderExecutable();
  if (!blender) missing.push("Blender executable");
  if (!existsSync(DEFAULT_GODOT_BIN)) missing.push(`Godot at ${DEFAULT_GODOT_BIN}`);
  const root = process.env.FLYRAIL_REPO_ROOT?.trim();
  if (!root || !existsSync(join(root, "games", "yun", "scripts", "court.gd"))) {
    missing.push("FLYRAIL_REPO_ROOT pointing to the Flyrail Yun production repository");
  }
  const client = new FlyrailClient();
  try {
    const health = await client.health();
    if (!health.ok || health.product !== "flyrail") missing.push("healthy Flyrail daemon");
  } catch (error) {
    missing.push(`Flyrail daemon (${error instanceof Error ? error.message : String(error)})`);
  } finally { client.disconnect(); }
  if (missing.length) {
    console.error("YUN ENVIRONMENT LIVE PREREQUISITES MISSING:");
    for (const item of missing) console.error(`  - ${item}`);
    console.error("Result: FAIL (live prerequisites are mandatory)");
    process.exit(1);
  }
  console.log(`Yun environment live prerequisites OK: Blender=${blender}; Godot=${DEFAULT_GODOT_BIN}; Flyrail=${resolve(root!)}`);
  const testPath = resolve(__dirname, "yunEnvironmentSlice.test.js");
  const result = spawnSync(process.execPath, ["--test", "--test-force-exit", testPath], {
    stdio: "inherit", env: { ...process.env, FLYRAIL_REPO_ROOT: resolve(root!) },
  });
  if (result.status !== 0) {
    console.error("Result: FAIL — Yun environment live validation failed");
    process.exit(result.status ?? 1);
  }
  console.log("Result: PASS — Blender generation and Flyrail/Godot environment import completed");
}

void main();
