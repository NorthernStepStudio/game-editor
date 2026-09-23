/** Explicit live gate: missing prerequisites are a failure, never a green skip. */
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FlyrailAdapter } from '../studio/adapters/flyrail/flyrailAdapter.js';
import { StudioAdapterRegistry } from '../studio/adapterRegistry.js';
import { StudioRunController } from '../studio/run/runController.js';
import { createStudioPlan } from '../studio/orchestrator.js';
import { terminalRun } from '../studio/runTypes.js';
async function main(): Promise<void> {
  const output = resolve(process.cwd(), '.matterhorn/evidence'); mkdirSync(output, { recursive: true });
  const adapter = new FlyrailAdapter({ requestTimeoutMs: 300000 });
  try {
    const health = await adapter.health();
    if (!health.available) throw new Error('LIVE GATE BLOCKED: start the Flyrail daemon with Godot available and configure FLYRAIL_DAEMON_URL / FLYRAIL_DAEMON_TOKEN or FLYRAIL_REPO_ROOT.');
    const project = mkdtempSync(join(tmpdir(), 'matterhorn live test '));
    cpSync(resolve(__dirname, '../../src/test/fixtures/disposable-godot-project'), project, { recursive: true });
    for (const args of [['init'], ['add', '.'], ['-c', 'user.name=Matterhorn Test', '-c', 'user.email=matterhorn-test@example.invalid', 'commit', '-m', 'Disposable fixture baseline']]) {
      const result = spawnSync('git', args, { cwd: project, encoding: 'utf8' });
      if (result.status !== 0 && !result.stdout?.includes('nothing to commit') && !result.stderr?.includes('nothing to commit')) throw new Error(`Fixture git setup failed (${args.join(' ')}): ${result.stderr || result.stdout || result.error}`);
    }
    const registry = new StudioAdapterRegistry(); registry.register(adapter);
    const controller = new StudioRunController({ registry, taskTimeoutMs: 300000 });
    const criteria = ['Godot validation passes', 'Scenario checks pass', 'QA checks pass'];
    const run = controller.start(createStudioPlan({ goal: 'Verify disposable scene node structure', tasks: [{ id: 'fixture-check', title: 'Verify fixture', goal: 'Verify disposable scene node structure', domain: 'godot', acceptanceCriteria: criteria, inputArtifacts: [{ kind: 'godot-project', uri: project }] }], finalAcceptanceCriteria: criteria }));
    const deadline = Date.now() + 340000;
    let latest = controller.store.get(run.id)!;
    while (!terminalRun(latest.status) && Date.now() < deadline) { await new Promise(r => setTimeout(r, 500)); latest = controller.store.get(run.id)!; }
    writeFileSync(join(output, 'studio-live.json'), JSON.stringify({ project, health, run: latest }, null, 2));
    if (latest.status !== 'completed') throw new Error(`LIVE GATE FAILED: ${latest.status}. Inspect .matterhorn/evidence/studio-live.json and the preserved disposable project.`);
    console.log('LIVE STUDIO GATE PASS: Matterhorn controller → Flyrail → persisted Godot evidence → validated completion. This does not prove arbitrary feature generation or visual gameplay quality.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeFileSync(join(output, 'studio-live-status.json'), JSON.stringify({ status: 'NOT_PASSED', message, checkedAt: new Date().toISOString() }, null, 2));
    console.error(message); process.exitCode = 1;
  } finally { adapter.disconnect(); }
}
void main();
