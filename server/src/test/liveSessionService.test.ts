import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LiveSessionService } from '../services/liveSessionService.js';

test('LiveSessionService seeds with canonical Yun Urban Adventurer and tombstones for rejected models', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'm-live-test-'));
  try {
    const service = new LiveSessionService(tempDir);
    const characters = service.getCharacters();
    const tombstones = service.getTombstones();

    assert.equal(characters.length >= 2, true);
    assert.equal(characters[0].assetId, 'yun_urban_adventurer');
    assert.match(characters[0].displayName, /Yun Urban Adventurer/);
    assert.ok(characters[0].referenceImages.front);
    assert.ok(characters[0].referenceImages.side);
    assert.ok(characters[0].referenceImages.threeQuarter);
    assert.ok(characters[0].referenceImages.back);

    // Rejected fixtures are tombstones only, not in active character list
    assert.equal(characters.some((c) => c.assetId === 'yun_player_base'), false);
    assert.equal(characters.some((c) => c.assetId === 'yun_player_base_v2'), false);

    assert.equal(tombstones.some((t) => t.assetId === 'yun_player_base'), true);
    assert.equal(tombstones.some((t) => t.assetId === 'yun_player_base_v2'), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('LiveSessionService supports pause, resume, stop, approve, correct, retry, and revert', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'm-live-test-'));
  try {
    const service = new LiveSessionService(tempDir);
    const session = service.createSession({
      characterId: 'yun_urban_adventurer',
      characterRevision: 'mesh-v12',
      tool: 'blender',
      stage: 'Form Refinement / Silhouette Polish',
      activePart: 'torso',
    });

    assert.equal(session.characterRevision, 'mesh-v12');
    assert.equal(session.tool, 'blender');
    assert.equal(session.status, 'waiting-for-review');

    // Pause
    const paused = service.pause(session.sessionId);
    assert.equal(paused.status, 'paused');
    assert.equal(paused.canResume, true);

    // Resume
    const resumed = service.resume(session.sessionId);
    assert.equal(resumed.status, 'working');
    assert.equal(resumed.canPause, true);

    // Submit correction
    const corrected = service.correct(session.sessionId, {
      feedback: 'Shoulders too wide. Make jacket softer.',
      region: 'shoulders',
    });
    assert.equal(corrected.characterRevision, 'mesh-v13');
    assert.equal(corrected.status, 'waiting-for-review');
    const shoulderMeasurement = corrected.measurements?.find((m) => m.landmark === 'shoulders');
    assert.ok(shoulderMeasurement);
    assert.equal(shoulderMeasurement.status, 'pass');

    // Revert back to mesh-v12
    const reverted = service.revert(session.sessionId, 'mesh-v12');
    assert.equal(reverted.characterRevision, 'mesh-v12');
    assert.equal(reverted.checkpointId, 'head-polish-v3');

    // Approve
    const approved = service.approve(session.sessionId, 'Looks good to continue');
    assert.match(approved.lastMessage, /Stage approved/);

    // Stop
    const stopped = service.stop(session.sessionId);
    assert.equal(stopped.status, 'stopped');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('LiveSessionService broadcasts events over listener callback', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'm-live-test-'));
  try {
    const service = new LiveSessionService(tempDir);
    const session = service.createSession({
      characterId: 'yun_urban_adventurer',
      tool: 'blender',
    });

    const receivedEvents: string[] = [];
    const unsubscribe = service.subscribeEvents(session.sessionId, (e) => {
      receivedEvents.push(e.type);
    });

    service.pause(session.sessionId);
    service.resume(session.sessionId);
    service.retry(session.sessionId);

    unsubscribe();
    service.pause(session.sessionId);

    assert.deepEqual(receivedEvents, ['paused', 'resumed', 'preview-updated']);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('LiveSessionService manages modular body parts and head-to-bottom workflow', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'm-live-test-'));
  try {
    const service = new LiveSessionService(tempDir);
    const session = service.createSession({
      characterId: 'yun_urban_adventurer',
      tool: 'blender',
      activePart: 'head',
    });

    assert.equal(session.activePart, 'head');
    assert.equal(session.partFraming?.focusRegion, 'head');
    assert.ok(session.partFraming?.zoom && session.partFraming.zoom >= 2.0);

    // Switch body part manually
    const torsoSession = service.setBodyPart(session.sessionId, 'torso');
    assert.equal(torsoSession.activePart, 'torso');
    assert.equal(torsoSession.partFraming?.focusRegion, 'torso');

    // Switch back to head and approve part & advance to torso (Neck, Chest & Shoulders)
    service.setBodyPart(session.sessionId, 'head');
    const advancedSession = service.approvePartAndNext(session.sessionId, 'Head looks great');
    assert.equal(advancedSession.activePart, 'torso');
    assert.ok(advancedSession.completedParts?.includes('head'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
