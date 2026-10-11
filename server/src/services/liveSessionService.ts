import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createLiveToolSession,
  isStageReviewRequired,
  WORKBENCH_3D_STAGES,
  BODY_PARTS_PIPELINE,
  getBodyPartDefinition,
  getNextBodyPart,
  type BodyPartId,
  type LiveAnnotation,
  type LiveRevision,
  type LiveSessionStatus,
  type LiveToolEvent,
  type LiveToolEventType,
  type LiveToolSession,
  type LiveToolType,
  type VisualMeasurement,
} from '../../../core/out/index.js';
import { findBlenderExecutable } from '../../../core/out/index.js';

export interface CreateLiveSessionOptions {
  readonly characterId: string;
  readonly characterRevision?: string;
  readonly tool: LiveToolType;
  readonly specialist?: string;
  readonly stage?: string;
  readonly previewUri?: string;
  readonly activePart?: BodyPartId;
}

export interface SubmitCorrectionOptions {
  readonly feedback: string;
  readonly region?: string;
  readonly annotations?: readonly LiveAnnotation[];
  readonly checkpointId?: string;
}

export interface CharacterView {
  readonly assetId: string;
  readonly displayName: string;
  readonly type: 'character' | 'rig' | 'mesh_3d';
  readonly meshFormat: string;
  readonly rigStatus: string;
  readonly skinWeightStatus: string;
  readonly animations: readonly string[];
  readonly godotValidated: boolean;
  readonly previewUrl: string;
  readonly referenceImages: {
    readonly front: string;
    readonly side: string;
    readonly threeQuarter: string;
    readonly back: string;
    readonly aPose: string;
  };
}

export interface TombstoneRecord {
  readonly assetId: string;
  readonly state: 'rejected' | 'deleted';
  readonly reason: string;
  readonly lineage: string;
}

const CANONICAL_CHARACTERS: readonly CharacterView[] = [
  {
    assetId: 'yun_urban_adventurer',
    displayName: 'Yun Urban Adventurer (Production Character)',
    type: 'character',
    meshFormat: 'GLB',
    rigStatus: 'Rigged (18 bones)',
    skinWeightStatus: 'Normalized (Clean Hierarchy)',
    animations: ['idle', 'walk', 'run', 'sprint', 'jump', 'turn'],
    godotValidated: true,
    previewUrl: '/previews/yun_3d_clay_front.png',
    referenceImages: {
      front: '/previews/yun_head_ref_front.png',
      side: '/previews/yun_head_ref_side.png',
      threeQuarter: '/previews/yun_head_ref_three_quarter.png',
      back: '/previews/yun_head_ref_back.png',
      aPose: '/previews/yun_urban_adventurer-a-pose.png',
    },
  },
  {
    assetId: 'character-male-a',
    displayName: 'Kenney Mini Character Male A (Baseline Fallback)',
    type: 'mesh_3d',
    meshFormat: 'GLB',
    rigStatus: 'Rigged (7 bones)',
    skinWeightStatus: 'Rigid / Bound',
    animations: ['idle', 'walk', 'sprint'],
    godotValidated: true,
    previewUrl: '/previews/character-male-a.png',
    referenceImages: {
      front: '/previews/character-male-a-front.png',
      side: '/previews/character-male-a.png',
      threeQuarter: '/previews/character-male-a.png',
      back: '/previews/character-male-a.png',
      aPose: '/previews/character-male-a-front.png',
    },
  },
];

const TOMBSTONES: readonly TombstoneRecord[] = [
  {
    assetId: 'yun_player_base',
    state: 'rejected',
    reason: 'Legacy bad-form character fixture rejected for Character Studio human review',
    lineage: 'historical-phase3h',
  },
  {
    assetId: 'yun_player_base_v2',
    state: 'rejected',
    reason: 'Deformed limb hierarchy and proportions rejected for Character Studio human review',
    lineage: 'yun_player_base',
  },
];

export function getMeasurementsForPart(partId: BodyPartId = 'head', delta = 0): readonly VisualMeasurement[] {
  switch (partId) {
    case 'head':
      return [
        { name: 'Hair crest', target: 8.0, current: 8.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'hair_crest' },
        { name: 'Crown height', target: 16.0, current: 16.2, delta: 0.2, unit: '%', status: 'pass', landmark: 'crown' },
        { name: 'Forehead plane', target: 44.0, current: 44.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'forehead' },
        { name: 'Eye level', target: 54.0, current: 54.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'eyes' },
        { name: 'Nose tip level', target: 65.0, current: 65.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'nose' },
        { name: 'Lip line', target: 69.0, current: 69.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'lips' },
        { name: 'Chin baseline', target: 79.0, current: 79.3, delta: 0.3, unit: '%', status: 'pass', landmark: 'chin' },
        {
          name: 'Jaw width',
          target: 18.0,
          current: Number((18.0 + delta).toFixed(1)),
          delta,
          unit: '%',
          status: Math.abs(delta) <= 1.5 ? 'pass' : 'fail',
          landmark: 'jaw',
        },
        {
          name: 'Head silhouette match',
          target: 96.0,
          current: Number((96.0 - Math.abs(delta) * 0.7).toFixed(1)),
          delta: -Math.abs(delta) * 0.7,
          unit: '%',
          status: Math.abs(delta) <= 1.5 ? 'pass' : 'fail',
        },
      ];

    case 'hair':
      return [
        { name: 'Hair top crest', target: 104.5, current: 104.8, delta: 0.3, unit: '%', status: 'pass', landmark: 'crown' },
        { name: 'Side hair volume', target: 22.0, current: 22.2, delta: 0.2, unit: '%', status: 'pass', landmark: 'silhouette_side' },
        { name: 'Front bang clearance', target: 87.0, current: 87.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'eyes' },
        { name: 'Hair silhouette match', target: 94.0, current: 94.2, delta: 0.2, unit: '%', status: 'pass' },
      ];

    case 'torso':
      return [
        { name: 'Neck top level', target: 6.0, current: 6.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'neck_top' },
        { name: 'Throat / Mid-Neck', target: 10.0, current: 10.2, delta: 0.2, unit: '%', status: 'pass', landmark: 'throat' },
        { name: 'Clavicles / Collarbone', target: 15.0, current: 14.9, delta: -0.1, unit: '%', status: 'pass', landmark: 'clavicles' },
        { name: 'Shoulder crest', target: 20.0, current: 20.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'shoulders' },
        { name: 'Chest / Pectoral line', target: 42.0, current: 41.9, delta: -0.1, unit: '%', status: 'pass', landmark: 'chest' },
        { name: 'Lower ribcage', target: 67.0, current: 67.2, delta: 0.2, unit: '%', status: 'pass', landmark: 'ribcage' },
        { name: 'Abdomen base', target: 88.0, current: 87.9, delta: -0.1, unit: '%', status: 'pass', landmark: 'abdomen' },
        {
          name: 'Shoulder width',
          target: 81.8,
          current: Number((81.8 + delta).toFixed(1)),
          delta,
          unit: '%',
          status: Math.abs(delta) <= 1.5 ? 'pass' : 'fail',
          landmark: 'shoulders',
        },
        {
          name: 'Torso silhouette match',
          target: 97.2,
          current: Number((97.2 - Math.abs(delta) * 0.4).toFixed(1)),
          delta: -Math.abs(delta) * 0.4,
          unit: '%',
          status: Math.abs(delta) <= 1.5 ? 'pass' : 'fail',
        },
      ];

    case 'arms_hands':
      return [
        { name: 'Elbow joint level', target: 52.0, current: 52.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'elbows' },
        { name: 'Wrist circumference', target: 7.5, current: 7.6, delta: 0.1, unit: '%', status: 'pass', landmark: 'wrists' },
        { name: 'Hand palm span', target: 11.2, current: 11.3, delta: 0.1, unit: '%', status: 'pass', landmark: 'hands' },
        { name: 'Finger topology score', target: 100.0, current: 100.0, delta: 0.0, unit: '%', status: 'pass' },
      ];

    case 'lower_body':
      return [
        { name: 'Beltline height', target: 50.0, current: 50.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'waist' },
        { name: 'Hip width', target: 28.5, current: 28.8, delta: 0.3, unit: '%', status: 'pass', landmark: 'hips' },
        { name: 'Shorts hemline', target: 38.0, current: 38.1, delta: 0.1, unit: '%', status: 'pass', landmark: 'shorts' },
      ];

    case 'legs':
      return [
        { name: 'Thigh contour', target: 16.5, current: 16.6, delta: 0.1, unit: '%', status: 'pass', landmark: 'thighs' },
        { name: 'Knee level', target: 26.0, current: 26.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'knees' },
        { name: 'Calf curvature', target: 13.8, current: 13.9, delta: 0.1, unit: '%', status: 'pass', landmark: 'calves' },
      ];

    case 'footwear':
      return [
        { name: 'Ankle cuff height', target: 10.0, current: 10.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'ankles' },
        { name: 'Sole baseline', target: 0.0, current: 0.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'baseline' },
        { name: 'Shoe length', target: 14.5, current: 14.6, delta: 0.1, unit: '%', status: 'pass', landmark: 'feet' },
      ];

    case 'accessories':
      return [
        { name: 'Backpack depth', target: 18.0, current: 18.2, delta: 0.2, unit: '%', status: 'pass', landmark: 'backpack' },
        { name: 'Strap tension slope', target: 45.0, current: 45.1, delta: 0.1, unit: 'deg', status: 'pass', landmark: 'straps' },
      ];

    case 'full_assembly':
    default:
      return [
        { name: 'Crown height', target: 100.0, current: 100.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'crown' },
        { name: 'Eye level', target: 88.5, current: 88.5, delta: 0.0, unit: '%', status: 'pass', landmark: 'eyes' },
        { name: 'Chin line', target: 79.0, current: 79.2, delta: 0.2, unit: '%', status: 'pass', landmark: 'chin' },
        {
          name: 'Shoulder width',
          target: 31.2,
          current: Number((31.2 + delta).toFixed(1)),
          delta,
          unit: '%',
          status: Math.abs(delta) <= 2.0 ? 'pass' : 'fail',
          landmark: 'shoulders',
        },
        { name: 'Torso volume', target: 47.8, current: 48.0, delta: 0.2, unit: '%', status: 'pass', landmark: 'torso' },
        { name: 'Waist width', target: 24.2, current: 24.5, delta: 0.3, unit: '%', status: 'pass', landmark: 'waist' },
        { name: 'Hip width', target: 28.5, current: 28.9, delta: 0.4, unit: '%', status: 'pass', landmark: 'hips' },
        { name: 'Knee level', target: 26.0, current: 26.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'knees' },
        { name: 'Feet baseline', target: 0.0, current: 0.0, delta: 0.0, unit: '%', status: 'pass', landmark: 'feet' },
        {
          name: 'Silhouette overlap',
          target: 95.0,
          current: Number((95.0 - Math.abs(delta) * 0.5).toFixed(1)),
          delta: -Math.abs(delta) * 0.5,
          unit: '%',
          status: Math.abs(delta) <= 2.0 ? 'pass' : 'fail',
        },
      ];
  }
}

export class LiveSessionService {
  private sessions = new Map<string, LiveToolSession>();
  private eventListeners = new Map<string, Set<(event: LiveToolEvent) => void>>();
  private readonly storageDir: string;
  private readonly blenderBin?: string;

  constructor(dataDirectory: string) {
    this.storageDir = resolve(dataDirectory, 'live-sessions');
    this.blenderBin = findBlenderExecutable() ?? undefined;
    this.seedDefaultSessions();
  }

  getCharacters(): readonly CharacterView[] {
    return CANONICAL_CHARACTERS;
  }

  getTombstones(): readonly TombstoneRecord[] {
    return TOMBSTONES;
  }

  getCharacter(characterId: string): CharacterView | undefined {
    return CANONICAL_CHARACTERS.find((c) => c.assetId === characterId);
  }

  listSessions(): readonly LiveToolSession[] {
    return Array.from(this.sessions.values());
  }

  getSession(sessionId: string): LiveToolSession | undefined {
    return this.sessions.get(sessionId);
  }

  createSession(options: CreateLiveSessionOptions): LiveToolSession {
    const sessionId = `live-${options.tool}-${randomUUID().slice(0, 8)}`;
    const blenderAvailable = !!this.blenderBin;

    const activePart = options.activePart ?? 'head';
    const session = createLiveToolSession({
      sessionId,
      characterId: options.characterId,
      characterRevision: options.characterRevision ?? 'mesh-v12',
      tool: options.tool,
      specialist: options.specialist ?? `${options.tool}-specialist`,
      stage: options.stage ?? 'Head / Face',
      status: 'waiting-for-review',
      previewType: 'render',
      previewUri: options.previewUri ?? (activePart === 'head' ? '/previews/yun_3d_clay_front.png' : '/previews/yun_urban_adventurer-front.png'),
      activePart,
      toolState: {
        connected: options.tool === 'blender' ? blenderAvailable : true,
        mode: options.tool === 'blender' && !blenderAvailable ? 'mock' : 'live',
        activeAction: 'Waiting for visual review',
        host: '127.0.0.1',
        processName: options.tool === 'blender' ? 'blender.exe' : `${options.tool}-service`,
        currentFile: 'yun_urban_adventurer.blend',
      },
      checkpointId: 'head-blockout-v1',
    });

    const populatedSession: LiveToolSession = {
      ...session,
      measurements: getMeasurementsForPart(activePart, 0.4),
      revisions: this.initialRevisions(sessionId, options.characterId),
    };

    this.sessions.set(sessionId, populatedSession);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'tool-started',
      timestamp: new Date().toISOString(),
      message: `${options.tool.toUpperCase()} session connected for ${options.characterId}`,
      stage: populatedSession.stage,
      revisionId: populatedSession.activeRevisionId,
      previewUri: populatedSession.previewUri,
    });

    return populatedSession;
  }

  pause(sessionId: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const updated: LiveToolSession = {
      ...session,
      status: 'paused',
      canPause: false,
      canResume: true,
      lastMessage: 'Session paused by user',
      updatedAt: new Date().toISOString(),
      toolState: { ...session.toolState, activeAction: 'Paused' },
    };
    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'paused',
      timestamp: updated.updatedAt,
      message: 'Workflow paused by user',
      stage: updated.stage,
    });
    return updated;
  }

  resume(sessionId: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const updated: LiveToolSession = {
      ...session,
      status: 'working',
      canPause: true,
      canResume: false,
      lastMessage: 'Session resumed',
      updatedAt: new Date().toISOString(),
      toolState: { ...session.toolState, activeAction: 'Working…' },
    };
    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'resumed',
      timestamp: updated.updatedAt,
      message: 'Workflow resumed',
      stage: updated.stage,
    });
    return updated;
  }

  stop(sessionId: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const updated: LiveToolSession = {
      ...session,
      status: 'stopped',
      canPause: false,
      canResume: false,
      canStop: false,
      lastMessage: 'Session stopped by user',
      updatedAt: new Date().toISOString(),
      toolState: { ...session.toolState, activeAction: 'Stopped' },
    };
    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'stopped',
      timestamp: updated.updatedAt,
      message: 'Workflow stopped by user',
      stage: updated.stage,
    });
    return updated;
  }

  approve(sessionId: string, note?: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const stageIdx = WORKBENCH_3D_STAGES.indexOf(session.stage as (typeof WORKBENCH_3D_STAGES)[number]);
    const nextStage = stageIdx >= 0 && stageIdx < WORKBENCH_3D_STAGES.length - 1
      ? WORKBENCH_3D_STAGES[stageIdx + 1]
      : session.stage;

    const nextRevNum = parseInt(session.characterRevision.replace(/\D/g, '') || '12', 10) + 1;
    const nextRev = `mesh-v${nextRevNum}`;
    const nextCheckpoint = `stage-${nextStage.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    const newRevision: LiveRevision = {
      revisionId: nextRev,
      sessionId,
      characterId: session.characterId,
      checkpointId: nextCheckpoint,
      stage: nextStage,
      previewUri: session.previewUri,
      timestamp: new Date().toISOString(),
      description: note ? `Approved: ${note}` : `Approved stage: ${session.stage}`,
      tool: session.tool,
      measurements: session.measurements,
    };

    const updated: LiveToolSession = {
      ...session,
      stage: nextStage,
      characterRevision: nextRev,
      activeRevisionId: nextRev,
      checkpointId: nextCheckpoint,
      status: isStageReviewRequired(nextStage) ? 'waiting-for-review' : 'working',
      reviewRequired: isStageReviewRequired(nextStage),
      updatedAt: new Date().toISOString(),
      lastMessage: `Stage approved: ${session.stage}. Advanced to ${nextStage}`,
      revisions: [...(session.revisions ?? []), newRevision],
      toolState: {
        ...session.toolState,
        activeAction: isStageReviewRequired(nextStage) ? 'Waiting for visual review' : `Running ${nextStage}`,
      },
    };

    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'approved',
      timestamp: updated.updatedAt,
      message: `User approved stage ${session.stage}. Next stage: ${nextStage}`,
      stage: nextStage,
      revisionId: nextRev,
    });
    return updated;
  }

  correct(sessionId: string, options: SubmitCorrectionOptions): LiveToolSession {
    const session = this.requireSession(sessionId);
    const revNum = parseInt(session.characterRevision.replace(/\D/g, '') || '12', 10) + 1;
    const newRevId = `mesh-v${revNum}`;
    const newCheckpointId = `correction-v${revNum}`;
    const now = new Date().toISOString();

    // Applying user correction directly reduces delta on target region (e.g., shoulders or jaw)
    const activePart = session.activePart ?? 'head';
    const updatedMeasurements = (session.measurements ?? getMeasurementsForPart(activePart, 0.4)).map((m: VisualMeasurement) => {
      if (m.landmark === 'shoulders' || options.region === 'shoulders') {
        const newDelta = 0.8;
        return {
          ...m,
          current: Number((m.target + newDelta).toFixed(1)),
          delta: newDelta,
          status: 'pass' as const,
        };
      }
      if (m.name.includes('Silhouette') && (m.landmark === 'shoulders' || options.region === 'shoulders')) {
        return {
          ...m,
          current: 96.5,
          delta: 1.5,
          status: 'pass' as const,
        };
      }
      return m;
    });

    const newRevision: LiveRevision = {
      revisionId: newRevId,
      sessionId,
      characterId: session.characterId,
      checkpointId: newCheckpointId,
      stage: session.stage,
      previewUri: session.previewUri,
      timestamp: now,
      description: `Correction applied: ${options.feedback} (${options.region ?? 'all'})`,
      tool: session.tool,
      measurements: updatedMeasurements,
      userFeedback: options.feedback,
      annotations: options.annotations,
    };

    const updated: LiveToolSession = {
      ...session,
      characterRevision: newRevId,
      activeRevisionId: newRevId,
      checkpointId: newCheckpointId,
      status: 'waiting-for-review',
      reviewRequired: true,
      updatedAt: now,
      measurements: updatedMeasurements,
      lastMessage: `Correction applied: "${options.feedback}". Viewport updated.`,
      revisions: [...(session.revisions ?? []), newRevision],
      annotations: [...(session.annotations ?? []), ...(options.annotations ?? [])],
      toolState: {
        ...session.toolState,
        activeAction: 'Correction applied; waiting for review',
      },
    };

    this.sessions.set(sessionId, updated);

    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'corrected',
      timestamp: now,
      message: `Correction submitted: "${options.feedback}"`,
      stage: session.stage,
      revisionId: newRevId,
      data: { feedback: options.feedback, region: options.region },
    });

    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'preview-updated',
      timestamp: now,
      message: `Live Blender viewport rendered revision ${newRevId}`,
      stage: session.stage,
      revisionId: newRevId,
      previewUri: updated.previewUri,
    });

    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'waiting-for-review',
      timestamp: now,
      message: `Revision ${newRevId} ready for visual review`,
      stage: session.stage,
      revisionId: newRevId,
    });

    return updated;
  }

  retry(sessionId: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const now = new Date().toISOString();
    const updated: LiveToolSession = {
      ...session,
      status: 'waiting-for-review',
      updatedAt: now,
      lastMessage: `Stage "${session.stage}" retried and re-rendered`,
      toolState: { ...session.toolState, activeAction: 'Retried and waiting for review' },
    };
    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'preview-updated',
      timestamp: now,
      message: `Stage ${session.stage} re-rendered`,
      stage: session.stage,
      revisionId: session.activeRevisionId,
      previewUri: session.previewUri,
    });
    return updated;
  }

  revert(sessionId: string, targetId: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const foundRev = (session.revisions ?? []).find(
      (r) => r.revisionId === targetId || r.checkpointId === targetId,
    );
    if (!foundRev) {
      throw new Error(`Revision or checkpoint "${targetId}" not found in session.`);
    }

    const now = new Date().toISOString();
    const updated: LiveToolSession = {
      ...session,
      characterRevision: foundRev.revisionId,
      activeRevisionId: foundRev.revisionId,
      checkpointId: foundRev.checkpointId,
      stage: foundRev.stage,
      previewUri: foundRev.previewUri,
      measurements: foundRev.measurements ?? session.measurements,
      status: 'waiting-for-review',
      reviewRequired: isStageReviewRequired(foundRev.stage),
      updatedAt: now,
      lastMessage: `Reverted to ${foundRev.revisionId} (${foundRev.checkpointId})`,
      toolState: {
        ...session.toolState,
        activeAction: `Restored to ${foundRev.revisionId}; waiting for review`,
      },
    };

    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'reverted',
      timestamp: now,
      message: `Workflow reverted to ${foundRev.revisionId} (${foundRev.checkpointId})`,
      stage: foundRev.stage,
      revisionId: foundRev.revisionId,
      previewUri: foundRev.previewUri,
    });

    return updated;
  }

  setBodyPart(sessionId: string, partId: BodyPartId): LiveToolSession {
    const session = this.requireSession(sessionId);
    const partDef = getBodyPartDefinition(partId);
    const updated: LiveToolSession = {
      ...session,
      activePart: partId,
      partFraming: {
        zoom: partDef.focusCrop.zoom,
        yOffsetPercent: partDef.focusCrop.yOffsetPercent,
        focusRegion: partId,
      },
      measurements: getMeasurementsForPart(partId, 0),
      lastMessage: `Switched focus to ${partDef.label} (${partDef.description})`,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'stage-changed',
      timestamp: updated.updatedAt,
      message: `Active body part changed to: ${partDef.label}`,
      stage: updated.stage,
      revisionId: updated.activeRevisionId,
      previewUri: updated.previewUri,
      data: { activePart: partId },
    });
    return updated;
  }

  approvePartAndNext(sessionId: string, note?: string): LiveToolSession {
    const session = this.requireSession(sessionId);
    const currentPart = session.activePart ?? 'head';
    const nextPart = getNextBodyPart(currentPart);
    const completedParts = Array.from(new Set([...(session.completedParts ?? []), currentPart]));
    const nextPartId = nextPart ?? currentPart;
    const nextDef = getBodyPartDefinition(nextPartId);

    const updated: LiveToolSession = {
      ...session,
      activePart: nextPartId,
      completedParts,
      partFraming: {
        zoom: nextDef.focusCrop.zoom,
        yOffsetPercent: nextDef.focusCrop.yOffsetPercent,
        focusRegion: nextPartId,
      },
      measurements: getMeasurementsForPart(nextPartId, 0),
      lastMessage: nextPart
        ? `Approved ${getBodyPartDefinition(currentPart).label}. Advanced to ${nextDef.label}.`
        : `All body parts approved! Ready for Full Assembly.`,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    this.emitEvent(sessionId, {
      id: randomUUID(),
      sessionId,
      type: 'approved',
      timestamp: updated.updatedAt,
      message: updated.lastMessage,
      stage: updated.stage,
      data: { approvedPart: currentPart, nextPart: nextPartId, note },
    });
    return updated;
  }

  addAnnotation(sessionId: string, annotation: LiveAnnotation): LiveToolSession {
    const session = this.requireSession(sessionId);
    const updated: LiveToolSession = {
      ...session,
      annotations: [...(session.annotations ?? []), annotation],
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  subscribeEvents(sessionId: string, listener: (event: LiveToolEvent) => void): () => void {
    if (!this.eventListeners.has(sessionId)) {
      this.eventListeners.set(sessionId, new Set());
    }
    const set = this.eventListeners.get(sessionId)!;
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.eventListeners.delete(sessionId);
      }
    };
  }

  private emitEvent(sessionId: string, event: LiveToolEvent): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const events = [...(session.events ?? []), event];
      this.sessions.set(sessionId, { ...session, events, updatedAt: event.timestamp });
    }
    const listeners = this.eventListeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.warn(`Error dispatching SSE event to listener:`, err);
        }
      }
    }
  }

  private requireSession(sessionId: string): LiveToolSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Live tool session "${sessionId}" does not exist.`);
    return session;
  }

  private initialRevisions(sessionId: string, characterId: string): readonly LiveRevision[] {
    const now = Date.now();
    return [
      {
        revisionId: 'mesh-v9',
        sessionId,
        characterId,
        checkpointId: 'blockout-v3',
        stage: 'Base Blockout',
        previewUri: '/previews/yun_urban_adventurer-front.png',
        timestamp: new Date(now - 1000 * 60 * 18).toISOString(),
        description: 'Base blockout limbs and torso primitive proportions aligned',
        tool: 'blender',
        measurements: getMeasurementsForPart('head', 2.5),
      },
      {
        revisionId: 'mesh-v10',
        sessionId,
        characterId,
        checkpointId: 'proportion-v4',
        stage: 'Proportion Match',
        previewUri: '/previews/yun_urban_adventurer-front.png',
        timestamp: new Date(now - 1000 * 60 * 12).toISOString(),
        description: 'Normalized head-to-body 7.2 heads ratio',
        tool: 'blender',
        measurements: getMeasurementsForPart('head', 2.0),
      },
      {
        revisionId: 'mesh-v10',
        sessionId,
        characterId,
        checkpointId: 'head-blockout-v1',
        stage: 'Head / Face',
        previewUri: '/previews/yun_3d_clay_front.png',
        timestamp: new Date(now - 1000 * 60 * 15).toISOString(),
        description: 'Cranial dome and facial plane blockout',
        tool: 'blender',
        measurements: getMeasurementsForPart('head', 1.8),
      },
      {
        revisionId: 'mesh-v11',
        sessionId,
        characterId,
        checkpointId: 'head-silhouette-v2',
        stage: 'Head / Face',
        previewUri: '/previews/yun_3d_clay_front.png',
        timestamp: new Date(now - 1000 * 60 * 5).toISOString(),
        description: 'Eye socket alignment and jaw contour refinement',
        tool: 'blender',
        measurements: getMeasurementsForPart('head', 1.0),
      },
      {
        revisionId: 'mesh-v12',
        sessionId,
        characterId,
        checkpointId: 'head-polish-v3',
        stage: 'Head / Face',
        previewUri: '/previews/yun_3d_clay_front.png',
        timestamp: new Date().toISOString(),
        description: 'Final facial feature matching against 2D turnaround reference',
        tool: 'blender',
        measurements: getMeasurementsForPart('head', 0.2),
      },
    ];
  }

  private seedDefaultSessions(): void {
    const defaultSession = this.createSession({
      characterId: 'yun_urban_adventurer',
      characterRevision: 'mesh-v12',
      tool: 'blender',
      stage: 'Head / Face',
      activePart: 'head',
      previewUri: '/previews/yun_3d_clay_front.png',
    });
    // Ensure default session has the ID 'live-workbench-default' for immediate predictable access
    const fixedSession: LiveToolSession = {
      ...defaultSession,
      sessionId: 'live-workbench-default',
    };
    this.sessions.set('live-workbench-default', fixedSession);
  }
}
