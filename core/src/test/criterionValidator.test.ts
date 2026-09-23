import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCriterionSpec,
  validateTaskCriteria,
  verifyCriterionMeasurement,
} from '../studio/criterionValidator.js';
import type { NssStudioCriterionResult } from '../studio/types.js';

describe('Criterion Validator', () => {
  it('1. passing criterion-specific check', () => {
    const spec = parseCriterionSpec('player.health equals 80', 0);
    const result: NssStudioCriterionResult = {
      criterionId: spec.id,
      description: spec.description,
      checkType: 'health_damage',
      expected: 80,
      actual: 80,
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };

    const measurement = verifyCriterionMeasurement(spec, result);
    assert.equal(measurement, 'passed');

    const validation = validateTaskCriteria('task-100', ['player.health equals 80'], [result], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'completed');
    assert.equal(validation.criterionResults[0].outcome, 'passed');
  });

  it('2. failing criterion-specific check', () => {
    const result: NssStudioCriterionResult = {
      criterionId: 'criterion-1',
      description: 'player.health equals 80',
      checkType: 'health_damage',
      expected: 80,
      actual: 50,
      outcome: 'failed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };

    const validation = validateTaskCriteria('task-100', ['player.health equals 80'], [result], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'failed');
    assert.equal(validation.criterionResults[0].outcome, 'failed');
  });

  it('3. missing criterion evidence blocks task', () => {
    const validation = validateTaskCriteria('task-100', ['Player can wall climb'], [], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'blocked');
    assert.equal(validation.criterionResults[0].outcome, 'blocked');
    assert.match(validation.summary, /blocked/i);
  });

  it('4. duplicate criterion evidence', () => {
    const res1: NssStudioCriterionResult = {
      criterionId: 'criterion-1',
      description: 'player.health equals 80',
      checkType: 'health_damage',
      expected: 80,
      actual: 80,
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };
    const res2 = { ...res1 };

    const validation = validateTaskCriteria('task-100', ['player.health equals 80'], [res1, res2], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'completed'); // Only 1 required criterion was evaluated safely
    assert.equal(validation.criterionResults.length, 1);
  });

  it('5. mismatched criterion ID', () => {
    const result: NssStudioCriterionResult = {
      criterionId: 'criterion-wrong-id',
      description: 'Unrelated description',
      checkType: 'generic',
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };

    const validation = validateTaskCriteria('task-100', ['player.health equals 80'], [result], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'blocked');
    assert.equal(validation.criterionResults[0].outcome, 'blocked');
  });

  it('6. mismatched execution ID', () => {
    const result: NssStudioCriterionResult = {
      criterionId: 'criterion-1',
      description: 'player.health equals 80',
      checkType: 'health_damage',
      expected: 80,
      actual: 80,
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-OTHER-EXECUTION',
    };

    const validation = validateTaskCriteria('task-100', ['player.health equals 80'], [result], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'blocked');
    assert.equal(validation.criterionResults[0].outcome, 'blocked');
  });

  it('7. incorrect expected vs actual measurement overrides claimed pass', () => {
    const spec = parseCriterionSpec('player moves 100 pixels', 0);
    const result: NssStudioCriterionResult = {
      criterionId: spec.id,
      description: spec.description,
      checkType: 'movement_position',
      expected: 100,
      actual: 20, // Claimed passed, but actual is 20 < 100
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };

    const measurement = verifyCriterionMeasurement(spec, result);
    assert.equal(measurement, 'failed');

    const validation = validateTaskCriteria('task-100', ['player moves 100 pixels'], [result], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'failed');
    assert.equal(validation.criterionResults[0].outcome, 'failed');
  });

  it('8. malformed evidence (missing uri)', () => {
    const result: NssStudioCriterionResult = {
      criterionId: 'criterion-1',
      description: 'player.health equals 80',
      checkType: 'health_damage',
      expected: 80,
      actual: 80,
      outcome: 'passed',
      executionId: 'task-100',
    };

    const validation = validateTaskCriteria('task-100', ['player.health equals 80'], [result], undefined);
    assert.equal(validation.status, 'blocked');
    assert.equal(validation.criterionResults[0].outcome, 'blocked');
  });

  it('9. unsupported criterion type defaults safely to generic or blocked if invalid', () => {
    const spec = parseCriterionSpec('Generic Godot feature', 0);
    assert.equal(spec.checkType, 'generic');
  });

  it('10. partially successful multi-criterion run fails overall', () => {
    const res1: NssStudioCriterionResult = {
      criterionId: 'criterion-1',
      description: 'player moves 100 pixels',
      checkType: 'movement_position',
      expected: 100,
      actual: 120,
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };
    const res2: NssStudioCriterionResult = {
      criterionId: 'criterion-2',
      description: 'player.health equals 80',
      checkType: 'health_damage',
      expected: 80,
      actual: 50,
      outcome: 'failed',
      evidenceUri: 'file:///path/to/evidence.json#1',
      executionId: 'task-100',
    };

    const validation = validateTaskCriteria('task-100', ['player moves 100 pixels', 'player.health equals 80'], [res1, res2], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'failed');
    assert.equal(validation.criterionResults[0].outcome, 'passed');
    assert.equal(validation.criterionResults[1].outcome, 'failed');
  });

  it('11. generic Flyrail success with missing custom evidence remains blocked', () => {
    // Flyrail returns generic gate pass evidence only, but task requested custom gameplay criterion
    const genericGateResult: NssStudioCriterionResult = {
      criterionId: 'gate-1',
      description: 'Godot validation passes',
      checkType: 'generic',
      outcome: 'passed',
      evidenceUri: 'file:///path/to/evidence.json#0',
      executionId: 'task-100',
    };

    const validation = validateTaskCriteria('task-100', ['Character jump height is at least 2.5 meters'], [genericGateResult], 'file:///path/to/evidence.json');
    assert.equal(validation.status, 'blocked');
    assert.equal(validation.criterionResults[0].description, 'Character jump height is at least 2.5 meters');
    assert.equal(validation.criterionResults[0].outcome, 'blocked');
  });
});
