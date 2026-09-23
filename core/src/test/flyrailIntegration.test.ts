/**
 * Integration test for the Flyrail adapter.
 *
 * This test connects to a LIVE Flyrail daemon if one is running.
 * If no daemon is available, the test is skipped (not failed).
 */

import { FlyrailAdapter } from "../studio/adapters/flyrail/flyrailAdapter.js";

async function main(): Promise<void> {
  console.log("\nFlyrail Integration Test\n");

  const adapter = new FlyrailAdapter({
    discoveryPaths: [
      "d:\\dev\\Northern Step Studio\\apps\\flyrail",
    ],
  });

  // ── Health check ────────────────────────────────────────────────

  console.log("  Checking Flyrail daemon health...");
  const health = await adapter.health();

  if (!health.available) {
    console.log(`  ⊘ Flyrail daemon not available: ${health.detail ?? "no detail"}`);
    console.log("  ⊘ Skipping live integration tests (daemon not running).");
    console.log("\n  0 passed, 0 failed (skipped)\n");
    return;
  }

  console.log(`  ✓ Daemon available: version=${health.version} protocol=${health.protocolVersion}`);
  console.log(`    ${health.detail}`);

  let passed = 0;
  let failed = 0;

  // ── Capabilities ────────────────────────────────────────────────

  try {
    console.log("  Discovering capabilities...");
    const caps = await adapter.getCapabilities();
    console.log(`  ✓ Capabilities: ${caps.capabilities.join(", ")}`);
    console.log(`    Protocol: ${caps.protocolVersion}`);
    passed++;
  } catch (error) {
    console.error(`  ✗ Capability discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }

  // ── System ping ─────────────────────────────────────────────────

  try {
    console.log("  Testing system.ping...");
    // Access the client directly for a raw RPC test
    const client = (adapter as unknown as { client: { call: (m: string) => Promise<unknown> } }).client;
    const ping = await client.call("system.ping") as { ok: boolean; protocolVersion: string; phase: number };
    if (ping.ok && ping.protocolVersion && ping.phase) {
      console.log(`  ✓ system.ping: ok=${ping.ok} version=${ping.protocolVersion} phase=${ping.phase}`);
      passed++;
    } else {
      console.error(`  ✗ system.ping returned unexpected: ${JSON.stringify(ping)}`);
      failed++;
    }
  } catch (error) {
    console.error(`  ✗ system.ping failed: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  adapter.disconnect();

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();
