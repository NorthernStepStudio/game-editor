import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyFlyrailEvidence } from '../studio/adapters/flyrail/flyrailEvidence.js';
import type { NssStudioExecutionResult } from '../studio/types.js';
import type { FlyrailLoopReport } from '../studio/adapters/flyrail/flyrailMapper.js';

describe('Criterion-Specific System End-to-End Proof', () => {
  function setupTestFixture(taskId: string, customCriterionResults?: any[]) {
    const projectPath = mkdtempSync(join(tmpdir(), 'matterhorn-criterion-test-'));
    const evidenceDir = join(projectPath, '.flyrail', 'evidence');
    mkdirSync(evidenceDir, { recursive: true });

    const evidencePath = join(evidenceDir, `${taskId}.json`);
    const bundleContent = {
      schemaVersion: 1,
      requestId: taskId,
      generatedAt: new Date().toISOString(),
      ok: true,
      validation: { ok: true, details: null },
      scenario: { ok: true, details: null },
      qa: { ok: true, details: null },
      playtestOk: true,
      criterionResults: customCriterionResults ?? [],
    };
    writeFileSync(evidencePath, JSON.stringify(bundleContent, null, 2));

    const initialResult: NssStudioExecutionResult = {
      taskId,
      specialistId: 'flyrail',
      status: 'completed',
      summary: 'Task completed',
    };

    const report: FlyrailLoopReport = {
      requestId: taskId,
      ok: true,
      evidencePath,
      evidence: {
        validationOk: true,
        scenarioOk: true,
        qaOk: true,
        playtestOk: true,
      },
      criterionResults: customCriterionResults,
    };

    return { projectPath, evidencePath, initialResult, report };
  }

  it('1. Positive case: custom criterion expected and actual match -> completed', () => {
    const taskId = 'task-positive-1';
    const customResults = [
      {
        criterionId: 'criterion-1',
        description: 'player.health equals 100',
        checkType: 'health_damage',
        target: 'player.health',
        expected: 100,
        actual: 100,
        outcome: 'passed',
        executionId: taskId,
        timestamp: new Date().toISOString(),
      },
    ];

    const { projectPath, initialResult, report } = setupTestFixture(taskId, customResults);
    const validated = verifyFlyrailEvidence(initialResult, report, projectPath, ['player.health equals 100']);

    assert.equal(validated.status, 'completed');
    assert.equal(validated.criterionResults?.length, 1);
    assert.equal(validated.criterionResults![0].outcome, 'passed');
    assert.equal(validated.criterionResults![0].actual, 100);
  });

  it('2. Negative case: mismatched actual measurement -> failed', () => {
    const taskId = 'task-mismatch-1';
    const customResults = [
      {
        criterionId: 'criterion-1',
        description: 'player.health equals 100',
        checkType: 'health_damage',
        target: 'player.health',
        expected: 100,
        actual: 40, // Mismatch: 40 !== 100
        outcome: 'passed', // Claimed passed, but actual is 40
        executionId: taskId,
        timestamp: new Date().toISOString(),
      },
    ];

    const { projectPath, initialResult, report } = setupTestFixture(taskId, customResults);
    const validated = verifyFlyrailEvidence(initialResult, report, projectPath, ['player.health equals 100']);

    assert.equal(validated.status, 'failed');
    assert.equal(validated.criterionResults![0].outcome, 'failed');
  });

  it('3. Negative case: generic success with missing custom evidence -> blocked', () => {
    const taskId = 'task-missing-1';
    // No custom criterion results returned in evidence bundle
    const { projectPath, initialResult, report } = setupTestFixture(taskId, []);
    const validated = verifyFlyrailEvidence(initialResult, report, projectPath, ['Character jump height is at least 2.5 meters']);

    assert.equal(validated.status, 'blocked');
    assert.equal(validated.criterionResults![0].outcome, 'blocked');
    assert.match(validated.summary, /blocked/i);
  });
});
