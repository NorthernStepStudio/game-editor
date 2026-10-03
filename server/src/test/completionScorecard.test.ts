import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  MATTERHORN_100_PILLARS,
  buildMatterhornCompletionScorecard,
} from '../services/completionScorecard.js';

test('Matterhorn 100 weights total exactly 100 and baseline stays evidence-weighted', () => {
  const scorecard = buildMatterhornCompletionScorecard();
  assert.equal(MATTERHORN_100_PILLARS.reduce((sum, pillar) => sum + pillar.weight, 0), 100);
  for (const pillar of MATTERHORN_100_PILLARS) {
    assert.equal(
      pillar.requirements.reduce((sum, requirement) => sum + requirement.weight, 0),
      pillar.weight,
    );
  }
  assert.equal(scorecard.target, 100);
  assert.equal(scorecard.capabilityCoverage, 57.5);
  assert.equal(scorecard.productionReadiness, 33.4);
  assert.equal(scorecard.status, 'red');
  assert(scorecard.criticalNext.length > 0);
  assert(scorecard.definitionOf100.length >= 8);
});

test('Matterhorn 100 exposes every pillar with coverage and readiness', () => {
  const scorecard = buildMatterhornCompletionScorecard();
  assert.equal(scorecard.pillars.length, 10);
  for (const pillar of scorecard.pillars) {
    assert(pillar.capabilityCoverage >= 0 && pillar.capabilityCoverage <= 100);
    assert(pillar.productionReadiness >= 0 && pillar.productionReadiness <= 100);
    assert(pillar.requirements.length > 0);
  }
});
