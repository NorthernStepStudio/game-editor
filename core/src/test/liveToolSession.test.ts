import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLiveToolSession,
  isStageReviewRequired,
  WORKBENCH_3D_STAGES,
  type LiveToolSession,
} from '../index.js';

test('createLiveToolSession initializes with valid defaults and required fields', () => {
  const session = createLiveToolSession({
    sessionId: 'session-123',
    characterId: 'yun_urban_adventurer',
    tool: 'blender',
  });

  assert.equal(session.sessionId, 'session-123');
  assert.equal(session.characterId, 'yun_urban_adventurer');
  assert.equal(session.characterRevision, 'mesh-v1');
  assert.equal(session.tool, 'blender');
  assert.equal(session.specialist, 'blender-specialist');
  assert.equal(session.stage, WORKBENCH_3D_STAGES[0]);
  assert.equal(session.status, 'idle');
  assert.equal(session.toolState.connected, false);
  assert.equal(session.toolState.mode, 'live');
  assert.equal(session.checkpointId, 'checkpoint-init');
  assert.equal(session.canPause, false);
  assert.equal(session.canRevert, true);
});

test('high-risk visual stages require review before continuing', () => {
  assert.equal(isStageReviewRequired('Base Blockout'), true);
  assert.equal(isStageReviewRequired('Proportion Match'), true);
  assert.equal(isStageReviewRequired('Silhouette Match'), true);
  assert.equal(isStageReviewRequired('Head / Face'), true);
  assert.equal(isStageReviewRequired('Form Refinement / Silhouette Polish'), true);
  assert.equal(isStageReviewRequired('Final Model Before Rig'), true);

  assert.equal(isStageReviewRequired('Reference Alignment'), false);
  assert.equal(isStageReviewRequired('Hair'), false);
  assert.equal(isStageReviewRequired('UV / Materials'), false);
});

test('modular body parts pipeline enforces head-to-bottom sequence', () => {
  const session = createLiveToolSession({
    sessionId: 'session-head',
    characterId: 'yun_urban_adventurer',
    tool: 'blender',
  });
  assert.equal(session.activePart, 'head');
  assert.equal(session.partFraming?.focusRegion, 'head');
  assert.ok(session.partFraming?.zoom && session.partFraming.zoom > 1.0);
});
