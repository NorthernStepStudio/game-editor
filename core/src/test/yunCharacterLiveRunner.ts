/**
 * Dedicated live PC runner for Yun character vertical slice.
 * Returns nonzero if required PC prerequisites are absent.
 *
 * Usage: npm run test:yun-character-live
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { findBlenderExecutable } from "../studio/adapters/blender/index.js";
import { DEFAULT_GODOT_BIN, FlyrailClient } from "../studio/adapters/flyrail/index.js";

async function main(): Promise<void> {
  const missing: string[] = [];
  const blender = findBlenderExecutable();
  if (!blender) missing.push("Blender executable");
  if (!existsSync(DEFAULT_GODOT_BIN)) missing.push(`Godot at ${DEFAULT_GODOT_BIN}`);

  const client = new FlyrailClient();
  try {
    const health = await client.health();
    if (!(health.ok && health.product === "flyrail")) {
      missing.push("Flyrail daemon health");
    }
  } catch (error) {
    missing.push(`Flyrail daemon (${error instanceof Error ? error.message : String(error)})`);
  } finally {
    client.disconnect();
  }

  if (missing.length > 0) {
    console.error("YUN LIVE PREREQUISITES MISSING:");
    for (const m of missing) console.error(`  - ${m}`);
    console.error("Result: FAIL — required PC prerequisites absent (not a silent skip)");
    process.exit(1);
  }

  console.log("YUN LIVE PREREQUISITES OK:");
  console.log(`  Blender: ${blender}`);
  console.log(`  Godot: ${DEFAULT_GODOT_BIN}`);
  console.log("  Flyrail: healthy");

  const tests = [
    resolve(__dirname, "yunCharacterSlice.test.js"),
    resolve(__dirname, "yunCharacterV2Slice.test.js"),
    resolve(__dirname, "yunProductionCharacterIntegration.test.js"),
  ];
  const res = spawnSync(process.execPath, ["--test", "--test-force-exit", ...tests], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    console.error("Result: FAIL — Yun character live tests failed");
    process.exit(res.status ?? 1);
  }
  console.log("Result: PASS — live Yun character Blender/Flyrail/Godot executed");
}

void main();
