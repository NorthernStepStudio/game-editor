import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { StudioRun } from '../../../core/out/index.js';
import { StudioHistory } from '../services/studioHistory.js';

function sampleRun(id: string, status: StudioRun['status'] = 'completed'): StudioRun {
  const now = new Date().toISOString();
  return {
    id,
    status,
    createdAt: now,
    updatedAt: now,
    plan: {
      id: `plan-${id}`,
      goal: 'Persist history',
      createdAt: now,
      tasks: [{
        id: 'task',
        title: 'Task',
        goal: 'Persist history',
        domain: 'godot',
        specialistId: 'flyrail',
        status: 'planned',
        dependsOn: [],
        acceptanceCriteria: ['Works'],
      }],
      finalAcceptanceCriteria: ['Works'],
    },
    tasks: [{ id: 'task', executionId: `${id}-task`, status: status === 'completed' ? 'completed' : 'running' }],
  };
}

test('Studio history survives a new service instance with intact snapshots', () => {
  const dir = mkdtempSync(join(tmpdir(), 'matterhorn-history-'));
  try {
    const first = new StudioHistory(dir);
    const run = sampleRun('durable-run');
    first.persist(run);
    const second = new StudioHistory(dir);
    assert.deepEqual(second.load(), [run]);
    assert.equal(JSON.parse(readFileSync(join(dir, 'studio-runs', 'durable-run.json'), 'utf8')).id, 'durable-run');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
